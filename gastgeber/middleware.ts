// Grobe/optimistische Weiterleitung: ohne Host-Cookie → Anmeldung. Die ECHTE
// Autorisierung passiert nah an den Daten in den Server Components (getMe),
// NICHT allein hier — die Middleware ist als alleinige Auth-Schranke unsicher
// (heise-CVE Middleware-Bypass, ADR-0015). Sie verhindert nur, dass ausgeloggte
// Nutzer leere Dashboard-Shells sehen.
import { type NextRequest, NextResponse } from "next/server";

import { VOR_DEM_START, vorstartFrei } from "@/lib/vorstart";
import {
  VORSTART_COOKIE,
  VORSTART_PARAM,
  schluesselStimmt,
  vorstartSchluessel,
} from "@/lib/vorstart-zugang";

/** Vorstart-Tor. Gibt eine Antwort zurück, wenn die Anfrage hier endet.
 *
 *  Steht VOR der Auth-Weiche: solange der Marktplatz nicht öffentlich ist,
 *  soll auch die Anmeldeseite nicht erreichbar sein. Sie trug den Markennamen
 *  im Titel und viermal im Text — für einen Crawler ein vollwertiger
 *  Marktplatz-Auftritt.
 *
 *  Deckungsgleich mit plattform/middleware.ts; Unterschiede nur dort, wo die
 *  App sich unterscheidet (keine eigene Vorab-Seite, siehe unten).
 */
function vorstartTor(req: NextRequest): NextResponse | null {
  if (!VOR_DEM_START) return null;

  const { pathname, searchParams } = req.nextUrl;
  if (vorstartFrei(pathname)) return null;

  // Freischaltung per `?zugang=…`: Cookie setzen, Parameter aus der Adresse
  // entfernen (er soll nicht in Verlauf, Logs oder Referrer weiterwandern).
  const uebergeben = searchParams.get(VORSTART_PARAM);
  if (uebergeben !== null && schluesselStimmt(uebergeben)) {
    const ziel = req.nextUrl.clone();
    ziel.searchParams.delete(VORSTART_PARAM);
    const antwort = NextResponse.redirect(ziel);
    antwort.cookies.set(VORSTART_COOKIE, uebergeben, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return antwort;
  }

  // Der Cookie-Wert wird jedes Mal gegen das aktuelle Geheimnis geprüft — ein
  // gedrehter Schlüssel sperrt alte Sitzungen sofort aus.
  if (schluesselStimmt(req.cookies.get(VORSTART_COOKIE)?.value)) return null;

  if (!vorstartSchluessel()) {
    console.warn(
      "[vorstart] MARKETPLACE_PREVIEW_KEY fehlt oder ist zu kurz — es gibt derzeit keinen Durchlass.",
    );
  }

  // Anders als die Gäste-Seite bekommt das Gastgeber-Dashboard KEINE eigene
  // Vorab-Seite: es ist reines Werkzeug hinter Login, es gibt hier nichts zu
  // erwarten. Ein nackter 503 ohne Inhalt ist die ehrliche Antwort und
  // verrät nichts über die Marke. Crawler behandeln 503 als vorübergehend und
  // nehmen die Adresse nicht in den Index.
  return new NextResponse(null, {
    status: 503,
    headers: {
      "Retry-After": "2592000",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}

export function middleware(req: NextRequest) {
  const tor = vorstartTor(req);
  if (tor) return tor;

  const { pathname } = req.nextUrl;
  // Anmeldung + API-Route-Handler bleiben frei. Route-Handler (z. B. der Foto-
  // Upload /api/objekte/…/fotos) machen ihre eigene Auth über den Host-Cookie
  // (readToken); ein Redirect würde POST/multipart-Requests kaputt machen
  // (Next.js: „Failed to find Server Action").
  // Die Co-Gastgeber-Einladung gehört ebenfalls hierher: der Empfänger ist per
  // Definition noch NICHT eingeloggt (oft ohne Konto), und ihr Datenabruf ist
  // bewusst public (`lib/cohost-einladung.ts` → `public: true`). Ohne diese
  // Ausnahme lief er auf /anmelden und hat die Einladung nie gesehen — der
  // Absichtskommentar in der Seite war durch diese Denylist funktionslos.
  if (
    pathname.startsWith("/anmelden") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/co-gastgeber/einladung/")
  ) {
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
