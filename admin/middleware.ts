// Grobe/optimistische Weiterleitung: ohne Admin-Cookie → Anmeldung. Die ECHTE
// Autorisierung passiert nah an den Daten (Server Component ruft /platform/me,
// FastAPI prüft die Rolle gegen public.platform_admins) — NICHT hier. Die
// Middleware ist als alleinige Auth-Schranke unsicher (Middleware-Bypass
// CVE-2025-29927, ADR-0015); sie verhindert nur, dass Ausgeloggte leere
// Backoffice-Shells sehen.
import { type NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Anmeldung bleibt frei.
  if (pathname.startsWith("/anmelden")) {
    return NextResponse.next();
  }

  // Statische Dateien aus public/ nie umleiten (sonst 307 statt Datei).
  if (/\.(?:png|jpe?g|svg|gif|webp|avif|ico|woff2?|ttf|otf)$/i.test(pathname)) {
    return NextResponse.next();
  }

  // host-only Cookie (dev: nd_admin, prod: __Host-nd_admin).
  const token =
    req.cookies.get("__Host-nd_admin")?.value ??
    req.cookies.get("nd_admin")?.value;
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
