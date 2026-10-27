import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { parseTagName } from '@/lib/catalogue/parse';
import { deleteTag, renameTag } from '@/lib/catalogue/tag-ops';
import { t } from '@/lib/i18n/strings';

type Params = { params: Promise<{ id: string }> };
const RenameBody = z.object({ name: z.string() }).strict();
const notFound = () => NextResponse.json({ error: t.itemNotFound.th }, { status: 404 });

/** Rename a tag shop-wide. A name another of the shop's tags has is refused (409), never merged. */
export async function PATCH(req: Request, props: Params) {
  const params = await props.params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: t.loginRequired.th }, { status: 401 });
  if (!z.uuid().safeParse(params.id).success) return notFound();

  const body = RenameBody.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: t.requestInvalid.th }, { status: 400 });
  const name = parseTagName(body.data.name);
  if (!name.ok) return NextResponse.json({ error: name.error }, { status: 400 });

  // renameTag looks the id up among the caller's own tags first (another shop's = 404).
  const r = await renameTag(supabase, user.id, params.id, name.value);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, tag: r.tag });
}

/** Delete a tag; it comes off every product (ON DELETE CASCADE). Products are untouched. The client confirms first. */
export async function DELETE(_req: Request, props: Params) {
  const params = await props.params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: t.loginRequired.th }, { status: 401 });
  if (!z.uuid().safeParse(params.id).success) return notFound();

  const r = await deleteTag(supabase, user.id, params.id);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true });
}
