// Zwei Aufgaben, in dieser Reihenfolge:
//
//  1. VORSTART-TOR: Solange `VOR_DEM_START` gilt, bekommt jeder öffentliche
//     Pfad die Vorab-Seite. Der Marktplatz gehört künftig einer eigenen
//     Gesellschaft und tritt bis dahin nicht öffentlich auf.
//  2. Route-Guard für die geschützten Gast-Bereiche: ohne nd_access-Cookie
//     (Portal-Gast nicht eingeloggt) → Redirect nach /anmelden.
//
// Zu (2) unverändert gilt: die eigentliche Autorisierung passiert serverseitig
// in FastAPI (Signaturprüfung); dieser Guard verhindert nur, dass ausgeloggte
// Nutzer leere Dashboard-Shells sehen.
//
// Zu (1) NICHT VERGESSEN: Eine Middleware ist als ALLEINIGE Schranke unsicher
// (Middleware-Bypass-CVE, ADR-0015 hält das für gastgeber/ ausdrücklich fest).
// Das Tor ist deshalb nur die erste von vier Sperren, die alle denselben
// Schalter lesen: `noindex` im Layout (app/layout.tsx), `Disallow: /` in
// robots.txt und die leere sitemap.xml wirken auch dann, wenn das Tor umgangen
// wird. Ein Bypass zeigte also eine Seite, holte sie aber nicht in den Index —
// und das Verstecken vor dem Index ist hier der eigentliche Zweck.
import { type NextRequest, NextResponse } from "next/server";

import { VOR_DEM_START, vorstartFrei } from "@/lib/vorstart";
import {
  VORSTART_COOKIE,
  VORSTART_PARAM,
  schluesselStimmt,
  vorstartSchluessel,
} from "@/lib/vorstart-zugang";

const GESCHUETZT = [
  "/konto",
  "/buchungen",
  "/aufenthalt",
  "/nachrichten",
  "/merkzettel",
  "/bewertungen",
];

/** Vorstart-Tor. Gibt eine Antwort zurück, wenn die Anfrage hier endet. */
function vorstartTor(req: NextRequest): NextResponse | null {
  if (!VOR_DEM_START) return null;

  const { pathname, searchParams } = req.nextUrl;
  if (vorstartFrei(pathname)) return null;

  // Freischaltung per `?zugang=…`: Schlüssel stimmt → Cookie setzen und den
  // Parameter aus der Adresse entfernen, damit er nicht in Verlauf, Logs oder
  // Referrer-Headern weiterwandert.
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

  // Bereits freigeschaltete Sitzung? Der Cookie-Wert wird jedes Mal gegen das
  // aktuelle Geheimnis geprüft — ein gedrehter Schlüssel sperrt alte Sitzungen
  // damit sofort aus, ohne dass jemand Cookies löschen muss.
  if (schluesselStimmt(req.cookies.get(VORSTART_COOKIE)?.value)) return null;

  // Kein Zugang: die Vorab-Seite ausliefern. `rewrite` statt `redirect`, damit
  // die angefragte Adresse stehen bleibt — ein Besucher, der einen geteilten
  // Inserat-Link öffnet, landet nicht auf einer fremden URL, und wir verraten
  // über die Adresszeile nicht, dass es hinter dem Tor etwas gibt.
  const ziel = req.nextUrl.clone();
  ziel.pathname = "/demnaechst";
  ziel.search = "";
  const antwort = NextResponse.rewrite(ziel, { status: 503 });
  // 503 + Retry-After ist die ehrliche Antwort auf „noch nicht da": Crawler
  // behandeln sie als vorübergehend und nehmen die Adresse NICHT in den Index
  // (ein 200 auf jeder Adresse wäre für sie dagegen echter Inhalt — und für
  // dieselbe Seite unter tausend Adressen gleich Duplicate Content).
  antwort.headers.set("Retry-After", "2592000");
  antwort.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  // Ein falscher/fehlender Schlüssel und ein gar nicht gesetzter Schlüssel
  // sehen für den Besucher identisch aus. Nur im Log steht der Unterschied,
  // damit ein vergessenes Secret auffindbar bleibt.
  if (!vorstartSchluessel()) {
    console.warn(
      "[vorstart] MARKETPLACE_PREVIEW_KEY fehlt oder ist zu kurz — es gibt derzeit keinen Durchlass.",
    );
  }
  return antwort;
}

export function middleware(req: NextRequest) {
  const tor = vorstartTor(req);
  if (tor) return tor;

  const { pathname } = req.nextUrl;
  const geschuetzt = GESCHUETZT.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  if (!geschuetzt) return NextResponse.next();

  const token = req.cookies.get("nd_access")?.value;
  if (token) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/anmelden";
  url.searchParams.set("weiter", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Vor dem Start muss der Matcher ALLES sehen (nicht nur die geschützten
  // Gast-Bereiche wie vorher), sonst liefe die Startseite am Tor vorbei.
  // Ausgenommen bleiben Next-Interna und das Favicon — sie tragen keinen
  // Inhalt, und ein 307 auf `_next/*` nähme der Vorab-Seite ihr Styling.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
