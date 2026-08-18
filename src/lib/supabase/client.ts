import { createBrowserClient } from "@supabase/ssr";

// No generated Database generic (this project doesn't run `supabase gen
// types`) — table rows are typed manually in database.types.ts instead.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
