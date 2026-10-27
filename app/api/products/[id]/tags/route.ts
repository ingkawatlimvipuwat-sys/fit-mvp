import { NextResponse } from 'next/server';
import { t } from '@/lib/i18n/strings';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadProductContext } from '@/lib/catalogue/ownership';
import { parseTagName } from '@/lib/catalogue/parse';
import { attachTagByName } from '@/lib/catalogue/tag-ops';

const AttachBody = z.object({ name: z.string() }).strict();

/**
 * Attach a tag to a product BY NAME (never by id: product_tags RLS checks only
 * the product side, so an id could link another shop's tag). An existing tag of
 * the caller's is reused; a new word creates one.
 */
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: t.loginRequired.th }, { status: 401 });

  if (!z.uuid().safeParse(params.id).success) return NextResponse.json({ error: t.itemNotFound.th }, { status: 404 });
  const body = AttachBody.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: t.requestInvalid.th }, { status: 400 });
  const name = parseTagName(body.data.name);
  if (!name.ok) return NextResponse.json({ error: name.error }, { status: 400 });

  // The product must be the caller's before any tag write.
  const found = await loadProductContext(supabase, user.id, params.id);
  if (!found.ok) return NextResponse.json({ error: found.error }, { status: found.status });

  const attached = await attachTagByName(supabase, user.id, params.id, name.value);
  if (!attached.ok) return NextResponse.json({ error: attached.error }, { status: attached.status });
  return NextResponse.json({ ok: true, tag: attached.tag });
}
