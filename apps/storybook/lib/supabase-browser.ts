// Supabase-Browser-Client für die Login-Seite (setzt die Session-Cookies,
// die die Middleware dann serverseitig prüft).
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
