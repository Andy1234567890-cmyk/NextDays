// Token-Erneuerung an der EINZIGEN Stelle im Request-Zyklus, die Cookies
// zuverlässig schreiben darf.
//
// Warum das hier stehen MUSS (die Ursache der willkürlichen Abmeldungen):
// `nd_access` trägt `maxAge = expires_in`, ist also nach einer Stunde aus dem
// Cookie-Jar verschwunden. Der nächste Seitenaufruf löste die Erneuerung
// bislang mitten im Server-Component-Render aus (`currentToken()` im
// Dashboard-Layout). Dort ist das Cookie-Jar NUR LESBAR: GoTrue verbrauchte
// und rotierte das alte Refresh-Token, das neue konnte nicht gespeichert
// werden und ging verloren. Der Browser schickte beim nächsten Request wieder
// das inzwischen verbrauchte Token — GoTrue antwortete „Invalid Refresh Token:
// Already Used", das BFF wertete den 401 als abgemeldet und warf den Nutzer
// mitten in der Arbeit auf /login.
//
// In der Middleware ist das Jar SCHREIBBAR. Wir erneuern hier einmal pro
// Navigation, hängen die frischen Cookies an die Response und reichen sie im
// selben Zug über die Request-Header an das Rendering weiter — so sieht der
// Layout-Render bereits das neue Access-Token und muss selbst nichts mehr
// tauschen.
//
// KEINE Auth-Schranke: die echte Autorisierung passiert nah an den Daten in den
// Server Components (getSession/getMe). Middleware allein wäre unsicher
// (Middleware-Bypass-CVE, ADR-0015). Hier wird ausschließlich erneuert; wer
// kein Token hat, läuft normal weiter und der Layout-Guard entscheidet.
import { type NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const PROD = process.env.NODE_ENV === "production";

const ACCESS = "nd_access";
const REFRESH = "nd_refresh";

interface SessionAntwort {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

// Pfade, die nie eine Erneuerung brauchen: die Anmeldung selbst und die
// Route-Handler (die haben ihre eigene Auth und dürfen nicht angefasst werden).
function ueberspringen(pathname: string): boolean {
  return (
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/api/")
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (ueberspringen(pathname)) return NextResponse.next();

  // Access-Token noch da → nichts zu tun. Das ist der Normalfall und kostet
  // keinen einzigen Backend-Aufruf.
  if (req.cookies.get(ACCESS)?.value) return NextResponse.next();

  const refresh = req.cookies.get(REFRESH)?.value;
  if (!refresh) return NextResponse.next();

  let session: SessionAntwort | null = null;
  let abgelehnt = false;
  try {
    const res = await fetch(`${BACKEND}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
      cache: "no-store",
    });
    if (res.ok) {
      session = (await res.json()) as SessionAntwort;
    } else if (res.status === 401 || res.status === 403) {
      // Nur eine echte Ablehnung beendet die Sitzung. 429/503 heißt „gerade
      // nicht möglich" — dann bleibt das Refresh-Cookie liegen und der nächste
      // Versuch gelingt (Wurzel 5: technischen Fehler nicht als Abmeldung
      // ausgeben).
      abgelehnt = true;
    }
  } catch {
    // Backend nicht erreichbar → Sitzung unangetastet lassen.
  }

  if (abgelehnt) {
    // Totes Refresh-Token entfernen, damit nicht jeder Folgerequest erneut
    // dagegenläuft. Der Layout-Guard leitet dann auf /login.
    const antwort = NextResponse.next();
    antwort.cookies.delete(ACCESS);
    antwort.cookies.delete(REFRESH);
    return antwort;
  }

  if (!session?.access_token) return NextResponse.next();

  // Das frische Access-Token dem Rendering SOFORT mitgeben: die Server
  // Components dieses Requests lesen ihr Cookie aus den Request-Headern, nicht
  // aus der Response. Ohne das hier liefe der aktuelle Render noch ohne Token
  // und der Nutzer sähe einmalig die abgemeldete Ansicht.
  const headers = new Headers(req.headers);
  const jar = req.cookies;
  jar.set(ACCESS, session.access_token);
  jar.set(REFRESH, session.refresh_token);
  headers.set("cookie", jar.toString());

  const antwort = NextResponse.next({ request: { headers } });
  const common = {
    httpOnly: true,
    secure: PROD,
    sameSite: "lax" as const,
    path: "/",
    // bewusst KEIN domain — host-only, identisch zu persistSession (ADR-0017).
  };
  antwort.cookies.set(ACCESS, session.access_token, {
    ...common,
    maxAge: session.expires_in,
  });
  antwort.cookies.set(REFRESH, session.refresh_token, {
    ...common,
    maxAge: 60 * 60 * 24 * 30,
  });
  return antwort;
}

export const config = {
  // Alles außer statischen Assets / Next-Interna.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
