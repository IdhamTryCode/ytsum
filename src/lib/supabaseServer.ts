import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createSupabaseServerClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
             cookieStore.set({ name, value, ...options });
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
             cookieStore.set({ name, value: '', ...options });
          } catch (error) {
             // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}

// Opsional: Buat Supabase client dengan service role jika diperlukan di beberapa tempat
// Tapi untuk API routes yang diautentikasi user, client di atas lebih baik.
// import { createClient } from '@supabase/supabase-js';
// export const supabaseAdmin = createClient(
//    process.env.NEXT_PUBLIC_SUPABASE_URL!,
//    process.env.SUPABASE_SERVICE_ROLE_KEY!
// ); 