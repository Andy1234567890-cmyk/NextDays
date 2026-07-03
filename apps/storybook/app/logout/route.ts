// Abmelden: widerruft die Supabase-Session (Refresh-Token) und räumt die
// Auth-Cookies ab, dann Redirect auf die Login-Seite. Erreichbar unter /logout
// (der schwebende „Abmelden"-Button im Storybook verlinkt hierher).
import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url));

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Widerruft das Refresh-Token serverseitig; setAll trägt die Cookies aus.
  await supabase.auth.signOut();

  // Sicherheitsnetz: alle Supabase-Auth-Cookies (sb-*) explizit löschen.
  request.cookies.getAll().forEach((c) => {
    if (c.name.startsWith("sb-")) response.cookies.delete(c.name);
  });

  return response;
}
