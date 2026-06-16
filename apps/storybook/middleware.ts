// Serverseitiger Schutz: JEDE Anfrage (außer Login + Auth-Endpunkte) verlangt
// eine gültige Supabase-Session. Ohne Session -> Redirect auf /login.
// Greift auch für das ausgelieferte Storybook (Route /sb -> geschützte Assets).
import { type NextRequest, NextResponse } from "next/server";

import { updateSession } from "@/lib/supabase-server";

const PUBLIC_PATHS = ["/login", "/auth"];

// Allowlist: NUR diese E-Mails dürfen ins Storybook — unabhängig davon, ob
// sich jemand sonst einen Supabase-Account anlegen kann (PMS bleibt unberührt).
// Erweiterbar über die Env STORYBOOK_ALLOWED_EMAILS (kommagetrennt).
const ALLOWED = new Set(
  (process.env.STORYBOOK_ALLOWED_EMAILS ?? "a.staudinger32@gmail.com")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Login-Seite und Auth-Callback bleiben offen.
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const { response, user } = await updateSession(request);

  // Keine Session ODER E-Mail nicht auf der Allowlist -> raus.
  if (!user || !ALLOWED.has((user.email ?? "").toLowerCase())) {
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
