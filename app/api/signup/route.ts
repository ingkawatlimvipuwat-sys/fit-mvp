import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server';

const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  shop_name: z.string().min(1).max(80),
  shop_slug: z.string().regex(/^[a-z0-9-]{3,40}$/, 'lowercase letters, digits, dashes only (3–40 chars)'),
});

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = SignupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { email, password, shop_name, shop_slug } = parsed.data;

  // 1. Create the auth user (also signs them in via cookies)
  const supabase = createSupabaseServerClient();
  const { data: signupData, error: signupError } = await supabase.auth.signUp({ email, password });
  if (signupError || !signupData.user) {
    return NextResponse.json({ error: signupError?.message ?? 'signup failed' }, { status: 400 });
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
    // Slug collision is the common case
    return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
