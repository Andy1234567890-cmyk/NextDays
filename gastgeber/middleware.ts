// Grobe/optimistische Weiterleitung: ohne Host-Cookie → Anmeldung. Die ECHTE
// Autorisierung passiert nah an den Daten in den Server Components (getMe),
// NICHT allein hier — die Middleware ist als alleinige Auth-Schranke unsicher
// (heise-CVE Middleware-Bypass, ADR-0015). Sie verhindert nur, dass ausgeloggte
// Nutzer leere Dashboard-Shells sehen.
import { type NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // Anmeldung + API-Route-Handler bleiben frei. Route-Handler (z. B. der Foto-
  // Upload /api/objekte/…/fotos) machen ihre eigene Auth über den Host-Cookie
  // (readToken); ein Redirect würde POST/multipart-Requests kaputt machen
  // (Next.js: „Failed to find Server Action").
  if (pathname.startsWith("/anmelden") || pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Statische Dateien aus public/ (Illustrationen, Bilder, Fonts …) NIE auf die
  // Anmeldung umleiten — sonst liefert Next einen 307 statt der Datei, und
  // next/image kann das Bild nicht laden. Der Matcher unten deckt nur _next/*
  // ab, nicht eigene public/-Assets → hier per Dateiendung freigeben.
  if (/\.(?:png|jpe?g|svg|gif|webp|avif|ico|woff2?|ttf|otf)$/i.test(pathname)) {
    return NextResponse.next();
  }

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
