// OAuth-Callback (Supabase): nach „Mit Google anmelden" kehrt der Nutzer mit
// einem ?code hierher zurück. Wir tauschen den Code server-seitig gegen eine
// Session (Cookies via @supabase/ssr) und leiten weiter. Reines Auth-Routing,
// keine Business-Logik (PROJECT.md §2).
import { NextResponse } from "next/server";

import { getMe } from "@/lib/auth";
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
      // OAuth-Nutzer ohne Tenant (frisch per Google registriert) → ins
      // Onboarding, wo die Firma (Tenant) angelegt wird. Bestehende Nutzer
      // (mit Tenant) gehen ans eigentliche Ziel.
      const me = await getMe();
      const dest = me?.tenant_id ? next : "/onboarding";
      return NextResponse.redirect(new URL(dest, url.origin));
    }
  }

  // Fehlgeschlagen oder kein Code: zurück zum Login mit Hinweis.
  return NextResponse.redirect(new URL("/login?error=oauth", url.origin));
}
