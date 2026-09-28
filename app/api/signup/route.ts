import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server';
import { t } from '@/lib/i18n/strings';

const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  shop_name: z.string().min(1).max(80),
  shop_slug: z.string().regex(/^[a-z0-9-]{3,40}$/, 'lowercase letters, digits, dashes only (3–40 chars)'),
});

export async function POST(req: Request) {
  // Malformed JSON becomes null, which the schema rejects as a 400 rather than a 500.
  const body = await req.json().catch(() => null);
  const parsed = SignupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { email, password, shop_name, shop_slug } = parsed.data;

  // 1. Create the auth user (also signs them in via cookies)
  const supabase = await createSupabaseServerClient();
  const { data: signupData, error: signupError } = await supabase.auth.signUp({ email, password });
  if (signupError || !signupData.user) {
    // Never surface raw English Supabase messages to the Thai UI.
    const friendly = signupError?.message === 'User already registered'
      ? t.emailTaken.th
      : t.authError.th;
    return NextResponse.json({ error: friendly }, { status: 400 });
  }

  // 2. Insert the retailer row using the admin client (bypasses RLS during insert
  //    because the user's session may not be fully propagated yet).
  const admin = createSupabaseAdminClient();
  const { error: insertError } = await admin.from('retailers').insert({
    id: signupData.user.id,
    email,
    shop_name,
    shop_slug,
  });
  if (insertError) {
    // Best-effort cleanup: delete the orphaned auth user so the same email can
    // be retried after the user fixes their input (e.g. picks a non-colliding slug).
    // If the delete itself fails (e.g. transient network), the user is left with
    // an orphan and will see "User already registered" on retry — degraded path.
    await admin.auth.admin.deleteUser(signupData.user.id).catch(() => {});

    // Postgres unique_violation (most commonly shop_slug collision) → friendly Thai.
    const friendly =
      'code' in insertError && insertError.code === '23505'
        ? 'ลิงก์ร้านนี้ถูกใช้แล้ว กรุณาเลือกลิงก์อื่น'
        : t.authError.th; // raw Postgres messages must not reach the UI
    return NextResponse.json({ error: friendly }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
