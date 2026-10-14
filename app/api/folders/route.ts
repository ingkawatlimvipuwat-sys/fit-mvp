import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { checkFolderOwnership } from '@/lib/catalogue/ownership';
import { parseFolderName } from '@/lib/catalogue/parse';
import { t } from '@/lib/i18n/strings';

const CreateBody = z.object({ name: z.string(), parent_id: z.uuid().nullable() }).strict();

/** Create a folder inside parent_id (null = top level). The parent must be the caller's own (rule 2). */
export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = CreateBody.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  const name = parseFolderName(body.data.name);
  if (!name.ok) return NextResponse.json({ error: name.error }, { status: 400 });

  if (body.data.parent_id !== null) {
    const owns = await checkFolderOwnership(supabase, user.id, body.data.parent_id);
    if (!owns.ok) return NextResponse.json({ error: owns.error }, { status: owns.status });
  }

  const { data, error } = await supabase
    .from('folders')
    .insert({ retailer_id: user.id, parent_id: body.data.parent_id, name: name.value })
    .select('id')
    .single();
  if (error || !data) {
    console.error('folder insert failed:', error);
    return NextResponse.json({ error: t.saveFailed.th }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: data.id });
}
