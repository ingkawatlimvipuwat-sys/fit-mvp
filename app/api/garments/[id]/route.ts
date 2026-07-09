import { NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server';

const STORAGE_PREFIX = '/object/public/garment-photos/';

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: garment } = await supabase
    .from('garments')
    .select('photo_url')
    .eq('id', params.id)
    .eq('retailer_id', user.id)
    .single();
  if (!garment) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const { error: delErr } = await supabase
    .from('garments')
    .delete()
    .eq('id', params.id)
    .eq('retailer_id', user.id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  // Best-effort cleanup of the Storage object. Failure here shouldn't fail
  // the request — the row is already gone.
  const idx = garment.photo_url?.indexOf(STORAGE_PREFIX) ?? -1;
  if (idx !== -1) {
    const path = decodeURIComponent(garment.photo_url.slice(idx + STORAGE_PREFIX.length));
    if (path.startsWith(`${user.id}/`)) {
      const admin = createSupabaseAdminClient();
      try {
        const { error: storageErr } = await admin.storage.from('garment-photos').remove([path]);
        if (storageErr) console.error('storage cleanup failed (non-fatal):', storageErr);
      } catch (e) {
        console.error('storage cleanup failed (non-fatal):', e);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
