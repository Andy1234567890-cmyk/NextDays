// Serverseitiger Schutz: JEDE Anfrage (außer Login + Auth-Endpunkte) verlangt
// eine gültige Supabase-Session. Ohne Session -> Redirect auf /login.
// Greift auch für das ausgelieferte Storybook (Route /sb -> geschützte Assets).
import { type NextRequest, NextResponse } from "next/server";

import { updateSession } from "@/lib/supabase-server";

// /healthz bleibt offen, damit der Coolify/Traefik-Healthcheck 200 erhält
// (sonst würde die Auth-Middleware ihn auf /login umleiten → „unhealthy").
// Das Logo braucht die Login-Seite selbst — ohne Freigabe würde die
// Bild-Anfrage auf /login umgeleitet (kaputtes Bild).
const PUBLIC_PATHS = ["/login", "/auth", "/healthz", "/Logo_transparent.png"];

// Optionale strikte Allowlist. Wenn gesetzt (STORYBOOK_ALLOWED_EMAILS), dürfen
// NUR diese E-Mails rein. Wenn LEER, darf jeder eingeloggte Nutzer rein — das
// ist sicher, weil Accounts ausschließlich von Admins über /admin angelegt
// werden (kein Self-Signup im Storybook-Flow).
const RAW_ALLOWED = (process.env.STORYBOOK_ALLOWED_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);
const ALLOWED = new Set(RAW_ALLOWED);
const STRICT = ALLOWED.size > 0;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Login-Seite und Auth-Callback bleiben offen.
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  // API-Routen prüfen die Session selbst und antworten mit JSON (403) statt
  // Redirect — sonst bekäme der Browser-Fetch eine Login-HTML-Seite zurück.
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const { response, user } = await updateSession(request);

  // Keine Session -> raus. Bei strikter Allowlist zusätzlich E-Mail prüfen.
  const ok = user && (!STRICT || ALLOWED.has((user.email ?? "").toLowerCase()));
  if (!ok) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    if (user) loginUrl.searchParams.set("denied", "1");
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  // Alles abfangen AUSSER Next-Interna und der Login-Seite selbst.
  // Wichtig: Die Storybook-Assets laufen über /sb/* und werden so geschützt.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
