import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadShopFolders } from '@/lib/catalogue/ownership';
import { checkFolderMove, deleteFolderMovingUp } from '@/lib/catalogue/folder-ops';
import { parseFolderName } from '@/lib/catalogue/parse';
import { t } from '@/lib/i18n/strings';

type Params = { params: Promise<{ id: string }> };
const notFound = () => NextResponse.json({ error: t.itemNotFound.th }, { status: 404 });

const PatchBody = z.object({
  name: z.string().optional(),
  parent_id: z.uuid().nullable().optional(),
}).strict();

/** Rename and/or move a folder. Body: { name?, parent_id? } (parent_id null = top level). */
export async function PATCH(req: Request, props: Params) {
  const params = await props.params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: t.loginRequired.th }, { status: 401 });
  if (!z.uuid().safeParse(params.id).success) return notFound();

  const body = PatchBody.safeParse(await req.json().catch(() => null));
  if (!body.success || (body.data.name === undefined && body.data.parent_id === undefined)) {
    return NextResponse.json({ error: t.requestInvalid.th }, { status: 400 });
  }
  const update: { name?: string; parent_id?: string | null } = {};
  if (body.data.name !== undefined) {
    const name = parseFolderName(body.data.name);
    if (!name.ok) return NextResponse.json({ error: name.error }, { status: 400 });
    update.name = name.value;
  }

  const loaded = await loadShopFolders(supabase, user.id);
  if (!loaded.ok) return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  if (body.data.parent_id !== undefined) {
    const check = checkFolderMove(loaded.folders, params.id, body.data.parent_id);
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });
    update.parent_id = body.data.parent_id;
  } else if (!loaded.folders.some(f => f.id === params.id)) {
    return notFound();
  }

  const { error } = await supabase.from('folders').update(update).eq('id', params.id).eq('retailer_id', user.id);
  if (error) {
    console.error('folder update failed:', error);
    return NextResponse.json({ error: t.saveFailed.th }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

/** Delete a folder; its subfolders and products move up one level (rule 6). Nothing else is deleted. */
export async function DELETE(_req: Request, props: Params) {
  const params = await props.params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: t.loginRequired.th }, { status: 401 });
  if (!z.uuid().safeParse(params.id).success) return notFound();

  const loaded = await loadShopFolders(supabase, user.id);
  if (!loaded.ok) return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  const folder = loaded.folders.find(f => f.id === params.id);
  if (!folder) return notFound();

  const result = await deleteFolderMovingUp(supabase, user.id, folder);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
