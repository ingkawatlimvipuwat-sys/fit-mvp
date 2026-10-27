import { NextResponse } from 'next/server';
import { t } from '@/lib/i18n/strings';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadProductContext } from '@/lib/catalogue/ownership';
import { detachTag } from '@/lib/catalogue/tag-ops';

type Params = { params: Promise<{ id: string; tagId: string }> };

/** Remove one tag from a product. The tag itself stays (a tag on no product is simply hidden). */
export async function DELETE(_req: Request, props: Params) {
  const params = await props.params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: t.loginRequired.th }, { status: 401 });

  if (!z.uuid().safeParse(params.id).success || !z.uuid().safeParse(params.tagId).success) {
    return NextResponse.json({ error: t.itemNotFound.th }, { status: 404 });
  }

  // The product must be the caller's before any tag write.
  const found = await loadProductContext(supabase, user.id, params.id);
  if (!found.ok) return NextResponse.json({ error: found.error }, { status: found.status });

  const removed = await detachTag(supabase, user.id, params.id, params.tagId);
  if (!removed.ok) return NextResponse.json({ error: removed.error }, { status: removed.status });
  return NextResponse.json({ ok: true });
}
