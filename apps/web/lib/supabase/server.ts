// Supabase-Server-Client (Server Components / Server Actions).
// Liest/schreibt Auth-Cookies über die Next.js cookies()-API.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Aufruf aus einer Server Component ohne Schreibzugriff auf Cookies —
            // unkritisch, wenn Middleware die Session aktualisiert.
          }
        },
      },
    },
  );
}
