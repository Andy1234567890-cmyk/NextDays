// Supabase-Browser-Client (Client Components).
// Nutzt ausschließlich den publishable/anon Key (NEXT_PUBLIC_*) — niemals
// Service-Role im Browser (PROJECT.md). DB-Zugriff über RLS.
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
