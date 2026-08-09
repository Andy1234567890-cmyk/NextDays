"use server";

// Server-Actions der öffentlichen Auth-Vorgänge: Einladung annehmen,
// Passwort vergessen, neues Passwort setzen.
//
// Warum Server-Actions und nicht fetch im Browser: der Einmal-Token aus dem
// Link darf den Server nicht als Query-Parameter eines Client-Requests
// verlassen, der in Proxy-/Zugriffslogs landet. Hier geht er im POST-Body an
// FastAPI und taucht in keiner URL auf.
//
// Diese Aufrufe sind bewusst OHNE Session — die Berechtigung IST der Token.
// Geprüft wird er ausschließlich serverseitig (Wurzel 3): das Frontend kennt
// weder Gültigkeitsdauer noch Verbrauchszustand und rät sie auch nicht.
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

/** Warum ein Token-Vorgang scheiterte — steuert, welcher Zustand angezeigt
 *  wird. Der Server unterscheidet aus Sicherheitsgründen nicht zwischen
 *  „ungültig", „abgelaufen" und „schon benutzt" (das wäre ein Orakel), daher
 *  fasst `ungueltig` alle drei zusammen und die UI nennt sie gemeinsam. */
export type TokenFehler = "ungueltig" | "schwach" | "fehler";

export type TokenErgebnis =
  | { ok: true }
  | { ok: false; grund: TokenFehler };

/** Ordnet den HTTP-Status einem Anzeigezustand zu. Bewusst KEIN Durchreichen
 *  des Server-Textes an die Oberfläche: die Meldungen sind übersetzt (24
 *  Sprachen), ein deutscher Backend-Text wäre in jeder anderen Sprache falsch.
 *  Der Token selbst steht nie in einer Meldung. */
function grundAusFehler(exc: unknown): TokenFehler {
  if (!(exc instanceof ApiError)) return "fehler";
  // 400/401/403/404/410: der Server lehnt den Token ab — ohne Unterschied.
  if ([400, 401, 403, 404, 410].includes(exc.status)) return "ungueltig";
  // 422: Passwortregeln des Servers nicht erfüllt.
  if (exc.status === 422) return "schwach";
  return "fehler";
}

/**
 * Vorab-Prüfung des Tokens (docs/API.md: `GET /auth/einladung/pruefen` bzw.
 * `/auth/passwort-neu/pruefen`). Verbraucht den Token NICHT.
 *
 * Wozu: damit die Seite „Link abgelaufen" zeigen kann, BEVOR jemand ein
 * Passwort eintippt. Ohne diesen Schritt tippt der Nutzer ein Passwort und
 * erfährt erst beim Absenden, dass der Link tot ist.
 *
 * Beide Endpunkte antworten immer `200` mit `{gueltig: bool}` — ein `404` wäre
 * ein Orakel über fremde Tokens. Ein technischer Fehler (Backend nicht
 * erreichbar) gilt hier bewusst als „gültig": dann läuft der Nutzer in das
 * Formular und bekommt beim Absenden die echte Antwort. Ihn wegen einer
 * kurzen Störung auf „Link ungültig" zu schicken wäre eine Falschaussage.
 */
export async function tokenPruefen(
  vorgang: "einladung" | "reset",
  token: string,
): Promise<boolean> {
  const pfad =
    vorgang === "einladung"
      ? "/auth/einladung/pruefen"
      : "/auth/passwort-neu/pruefen";
  try {
    const res = await api<{ gueltig: boolean }>(
      `${pfad}?token=${encodeURIComponent(token)}`,
    );
    return res.gueltig;
  } catch {
    return true; // siehe oben — im Zweifel weiterlaufen lassen
  }
}

/**
 * Einladung annehmen: der Eingeladene setzt sein erstes eigenes Passwort.
 * docs/API.md: `POST /auth/einladung/annehmen` → `204`.
 */
export async function einladungAnnehmen(
  token: string,
  passwort: string,
): Promise<TokenErgebnis> {
  try {
    await api<void>("/auth/einladung/annehmen", {
      method: "POST",
      body: { token, password: passwort },
    });
    return { ok: true };
  } catch (exc) {
    return { ok: false, grund: grundAusFehler(exc) };
  }
}

/**
 * Passwort vergessen: Reset-Link anfordern.
 * docs/API.md: `POST /auth/passwort-vergessen` → immer `200`.
 *
 * Gibt IMMER `ok` zurück — auch wenn der Server einen Fehler meldet. Das ist
 * Absicht: eine unterscheidbare Antwort wäre ein Verzeichnis, welche Adressen
 * ein Konto haben (User-Enumeration). Der Server antwortet dafür bereits immer
 * `200` mit derselben Nachricht; die verschluckte Ausnahme deckt nur noch den
 * technischen Ausfall ab, der sonst als „Adresse unbekannt" lesbar wäre.
 * Rate-Limits und Sperrfristen setzt der Server durch, nicht die Oberfläche.
 */
export async function passwortVergessen(email: string): Promise<{ ok: true }> {
  try {
    await api<void>("/auth/passwort-vergessen", {
      method: "POST",
      body: { email },
    });
  } catch {
    // Bewusst verschluckt und NICHT geloggt (Wurzel 5: best-effort, kippt den
    // Hauptpfad nicht). Ein Log mit der Adresse wäre genau das Verzeichnis,
    // das die neutrale Antwort verhindern soll.
  }
  return { ok: true };
}

/**
 * Neues Passwort per Reset-Token setzen.
 * docs/API.md: `POST /auth/passwort-neu` → `204`.
 *
 * Der Sitzungswiderruf nach dem Reset ist Backend-Sache — das Frontend meldet
 * den Nutzer bewusst NICHT automatisch an, sondern führt ihn zur regulären
 * Anmeldung (OWASP: kein Auto-Login nach einem Passwort-Vorgang).
 */
export async function passwortNeuSetzen(
  token: string,
  passwort: string,
): Promise<TokenErgebnis> {
  try {
    await api<void>("/auth/passwort-neu", {
      method: "POST",
      body: { token, password: passwort },
    });
    return { ok: true };
  } catch (exc) {
    return { ok: false, grund: grundAusFehler(exc) };
  }
}

/**
 * Einladung erneut senden (Mail kam nicht an).
 * docs/API.md: `POST /auth/invite/{user_id}/resend` → `204`.
 *
 * Läuft MIT Session — nur admin/co_admin (`MANAGE_STAFF`); der Nutzer muss im
 * eigenen Tenant liegen. Beides erzwingt der Server (Wurzel 9: derselbe Scope
 * wie die Nutzerliste), das Frontend verlässt sich nicht auf sein eigenes
 * Gating. Der Server hat eine eigene Sperrfrist von einer Minute je Nutzer und
 * antwortet dann `429` — die Meldung reichen wir unverändert durch.
 */
export async function einladungErneutSenden(
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const token = await currentToken();
    await api<void>(`/auth/invite/${userId}/resend`, {
      method: "POST",
      token: token ?? undefined,
    });
    return { ok: true };
  } catch (exc) {
    return {
      ok: false,
      error: exc instanceof ApiError ? exc.message : "",
    };
  }
}
