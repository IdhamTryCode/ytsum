import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL atau Anon Key tidak ditemukan di environment variables.');
}

// Membuat Supabase client untuk sisi client (browser)
export const supabaseBrowserClient = createClient(supabaseUrl, supabaseAnonKey);

// Catatan: Untuk operasi sisi server (API routes), Anda mungkin perlu membuat
// client dengan service_role key atau menggunakan helper Supabase untuk Next.js
// yang menangani autentikasi server-side jika diperlukan.
// Untuk saat ini, kita akan fokus pada client-side dan API routes yang diautentikasi Clerk. 