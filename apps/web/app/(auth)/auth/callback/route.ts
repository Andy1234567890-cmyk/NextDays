// OAuth-Callback (Supabase): nach „Mit Google anmelden" kehrt der Nutzer mit
// einem ?code hierher zurück. Wir tauschen den Code server-seitig gegen eine
// Session (Cookies via @supabase/ssr) und leiten weiter. Reines Auth-Routing,
// keine Business-Logik (PROJECT.md §2).
import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  // Ziel nach erfolgreichem Login (Standard: Dashboard).
  const next = url.searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }

  // Fehlgeschlagen oder kein Code: zurück zum Login mit Hinweis.
  return NextResponse.redirect(new URL("/login?error=oauth", url.origin));
}
