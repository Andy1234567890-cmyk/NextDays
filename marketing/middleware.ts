// Zugangssperre vor der gesamten Marketing-Site.
//
// WARUM DIE SPERRSEITE HIER GERENDERT WIRD UND NICHT ALS NEXT-SEITE:
// Eine Anmeldeseite unter `app/zugang/page.tsx` müsste `/_next/static/*`
// freigeben, damit sie ihre eigenen Chunks laden kann. In diesen Chunks steht
// der kompilierte Inhalt ALLER Seiten — wer sie abruft, liest die Site, ohne
// sich je anzumelden. Die Sperre wäre eine Attrappe. Die Middleware antwortet
// deshalb selbst mit einer in sich geschlossenen HTML-Seite: kein Skript, kein
// Stylesheet, keine Schrift von außerhalb. Offen bleibt einzig `/healthz` —
// der Docker-HEALTHCHECK im Dockerfile fragt ihn ab; wäre er gesperrt, meldete
// Coolify den Container dauerhaft als „unhealthy" und schaltete den Verkehr
// nie um.
//
// Fail-closed (Wurzel 5): fehlt `MARKETING_ZUGANG_PASSWORT`, wird NICHT
// geöffnet, sondern mit 503 dichtgemacht. Ein Konfigurationsfehler darf die
// Sperre nicht aufheben, und er soll auffallen statt still zu wirken.
import { NextResponse } from "next/server";

import {
  ZUGANG_COOKIE,
  ZUGANG_DAUER_MS,
  ZUGANG_PFAD,
  passwortStimmt,
  sitzungAusstellen,
  sitzungGueltig,
  zugangsPasswort,
} from "@/lib/zugang";

import type { NextRequest } from "next/server";

/** Pfade, die ohne Anmeldung erreichbar bleiben müssen. */
const OFFEN = new Set(["/healthz"]);

/**
 * Verzögerung nach falschem Passwort. Die Edge-Runtime hat keinen geteilten
 * Zustand, ein echter Zähler je IP ist hier also nicht zu haben. Eine feste
 * halbe Sekunde drückt den Durchsatz eines Rateversuchs aber von tausenden auf
 * unter zwei Versuche pro Sekunde und Verbindung — genug für eine Sperre, die
 * ohnehin nur ein Passwort schützt, das nicht öffentlich steht.
 */
const FEHLVERSUCH_BREMSE_MS = 500;

/** Nur seiteninterne Ziele zulassen — kein offener Redirect (Wurzel 8). */
function sicheresZiel(wert: string | null): string {
  if (!wert || !wert.startsWith("/") || wert.startsWith("//")) return "/";
  return wert;
}

function escape(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sperrSeite(ziel: string, fehler: boolean, status: number): NextResponse {
  const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>myNextDays</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: grid; place-items: center;
    padding: 24px; background: #0b1020; color: #e8ecf8;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  .karte {
    width: 100%; max-width: 380px; background: #131a2e; border: 1px solid #243052;
    border-radius: 14px; padding: 32px 28px; box-shadow: 0 18px 50px rgba(0,0,0,.45);
  }
  .marke { margin: 0 0 4px; font-size: 20px; font-weight: 650; letter-spacing: -.01em; }
  .hinweis { margin: 0 0 22px; font-size: 14px; line-height: 1.5; color: #93a0c0; }
  label { display: block; margin-bottom: 8px; font-size: 13px; font-weight: 600; }
  input {
    width: 100%; padding: 11px 13px; font-size: 15px; color: #e8ecf8;
    background: #0b1020; border: 1px solid #2d3a60; border-radius: 9px;
  }
  input:focus { outline: 2px solid #5b7cfa; outline-offset: 1px; border-color: #5b7cfa; }
  button {
    width: 100%; margin-top: 16px; padding: 11px 13px; font-size: 15px; font-weight: 600;
    color: #fff; background: #3b5bfd; border: 0; border-radius: 9px; cursor: pointer;
  }
  button:hover { background: #2f4ce8; }
  .fehler {
    margin: 0 0 16px; padding: 10px 12px; font-size: 13.5px; border-radius: 9px;
    background: #3a1720; border: 1px solid #7d2438; color: #ffc9d2;
  }
</style>
</head>
<body>
  <main class="karte">
    <h1 class="marke">myNextDays</h1>
    <p class="hinweis">Diese Seite ist derzeit nicht öffentlich. Bitte Zugangspasswort eingeben.</p>
    ${fehler ? '<p class="fehler" role="alert">Das Passwort stimmt nicht.</p>' : ""}
    <form method="POST" action="${escape(ZUGANG_PFAD)}">
      <input type="hidden" name="ziel" value="${escape(ziel)}">
      <label for="passwort">Passwort</label>
      <input id="passwort" name="passwort" type="password" autocomplete="current-password" autofocus required>
      <button type="submit">Weiter</button>
    </form>
  </main>
</body>
</html>`;

  return new NextResponse(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      // Eigene, enge CSP: die Seite braucht nichts außer ihrem inline-CSS.
      "content-security-policy":
        "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
      "x-frame-options": "DENY",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    },
  });
}

async function bremsen(): Promise<void> {
  await new Promise((weiter) => setTimeout(weiter, FEHLVERSUCH_BREMSE_MS));
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  if (OFFEN.has(pathname)) return NextResponse.next();

  const passwort = zugangsPasswort();
  if (!passwort) {
    // Kein Passwort gesetzt → dicht, nicht offen. Sichtbar als 503, damit der
    // Zustand beim Betreiber ankommt und nicht wie eine normale Anmeldung aussieht.
    return new NextResponse("Zugang nicht konfiguriert.", {
      status: 503,
      headers: { "cache-control": "no-store" },
    });
  }

  // Anmeldeversuch.
  if (request.method === "POST" && pathname === ZUGANG_PFAD) {
    const formular = await request.formData();
    const eingabe = formular.get("passwort");
    const ziel = sicheresZiel(typeof formular.get("ziel") === "string" ? String(formular.get("ziel")) : null);

    if (typeof eingabe !== "string" || !(await passwortStimmt(eingabe, passwort))) {
      await bremsen();
      return sperrSeite(ziel, true, 401);
    }

    const antwort = NextResponse.redirect(new URL(ziel, request.url), 303);
    antwort.cookies.set(ZUGANG_COOKIE, await sitzungAusstellen(passwort), {
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      path: "/",
      maxAge: Math.floor(ZUGANG_DAUER_MS / 1000),
    });
    return antwort;
  }

  if (await sitzungGueltig(request.cookies.get(ZUGANG_COOKIE)?.value, passwort)) {
    return NextResponse.next();
  }

  // Ziel merken, damit nach der Anmeldung die ursprünglich gewünschte Seite kommt.
  return sperrSeite(sicheresZiel(request.nextUrl.pathname + request.nextUrl.search), false, 401);
}

export const config = {
  // Alles abfangen. Bewusst OHNE die übliche `_next`-Ausnahme: die statischen
  // Chunks sind genau das, was sonst an der Sperre vorbei lesbar wäre.
  matcher: "/:pfad*",
};
