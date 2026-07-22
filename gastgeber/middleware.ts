// Grobe/optimistische Weiterleitung: ohne Host-Cookie → Anmeldung. Die ECHTE
// Autorisierung passiert nah an den Daten in den Server Components (getMe),
// NICHT allein hier — die Middleware ist als alleinige Auth-Schranke unsicher
// (heise-CVE Middleware-Bypass, ADR-0015). Sie verhindert nur, dass ausgeloggte
// Nutzer leere Dashboard-Shells sehen.
import { type NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // Anmeldung + API-interne Pfade bleiben frei.
  if (pathname.startsWith("/anmelden")) return NextResponse.next();

  // host-only Cookie (dev: nd_host, prod: __Host-nd_host).
  const token =
    req.cookies.get("__Host-nd_host")?.value ??
    req.cookies.get("nd_host")?.value;
  if (token) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/anmelden";
  url.searchParams.set("weiter", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Alles außer statischen Assets / Next-Interna.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
