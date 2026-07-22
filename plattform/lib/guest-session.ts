"use server";

// Session-Verwaltung des PORTAL-GASTES (Demand-Seite der Plattform).
// Der Gast-Login (/api/v1/guest-auth/login|register) liefert access+refresh;
// diese Server Actions legen die Tokens als HttpOnly-Cookies ab. Der Proxy
// (app/api/v1/[...path]/route.ts) hängt nd_access danach automatisch als
// `Authorization: Bearer` an ALLE /api/v1-Requests — dieselbe Cookie-Mechanik
// wie beim Gastgeber-Login (lib/auth.ts), nur ist auf /plattform der Inhaber
// dieses Cookies der PORTAL-GAST, nicht der Gastgeber. Zwei strikt getrennte
// Auth-Welten (Gastgeber sitzen auf apps/web).
import { cookies } from "next/headers";

const ACCESS = "nd_access";
const REFRESH = "nd_refresh";

/** access+refresh eines eingeloggten Portal-Gastes persistieren. maxAge des
 *  Access-Cookies = expires_in (Sekunden); refresh 30 Tage. */
export async function setGuestSession(
  access: string,
  refresh: string,
  expiresIn: number,
): Promise<void> {
  const jar = await cookies();
  const secure = process.env.NODE_ENV === "production";
  jar.set(ACCESS, access, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: expiresIn,
  });
  jar.set(REFRESH, refresh, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

/** Beide Cookies löschen (Logout). */
export async function clearGuestSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(ACCESS);
  jar.delete(REFRESH);
}

/** Access-Token des eingeloggten Gastes (oder null). Für die Realtime-Client-
 *  Komponente, die setAuth(token) VOR subscribe() braucht. */
export async function guestAccessToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(ACCESS)?.value ?? null;
}

/** Ist ein Portal-Gast eingeloggt? (nur Cookie-Präsenz, nicht validiert — die
 *  Endpunkte prüfen die Signatur serverseitig.) */
export async function isGuestLoggedIn(): Promise<boolean> {
  const jar = await cookies();
  return Boolean(jar.get(ACCESS)?.value);
}
