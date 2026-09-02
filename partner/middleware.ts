// Grobe/optimistische Weiterleitung: ohne Partner-Cookie → Anmeldung. Die ECHTE
// Autorisierung passiert nah an den Daten (Server Component ruft
// /affiliates/me, FastAPI prüft Token UND affiliates.status frisch) — NICHT
// hier. Die Middleware ist als alleinige Auth-Schranke unsicher
// (CVE-2025-29927, ADR-0015); sie verhindert nur, dass Ausgeloggte leere
// Dashboard-Shells sehen.
import { type NextRequest, NextResponse } from "next/server";

const FREI = ["/anmelden", "/bewerben", "/passwort-vergessen", "/healthz"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (FREI.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (/\.(?:png|jpe?g|svg|gif|webp|avif|ico|woff2?|ttf|otf|txt|xml)$/i.test(pathname)) {
    return NextResponse.next();
  }
  const token =
    req.cookies.get("__Host-nd_partner")?.value ?? req.cookies.get("nd_partner")?.value;
  if (token) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/anmelden";
  url.searchParams.set("weiter", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
