// Wer sitzt in diesem Token? — die EINE Stelle, die einen Sitzungs-JWT in
// seine Identität zerlegt (Nutzer, Betrieb, Rolle, Ablauf).
//
// WARUM ES DIESE DATEI GIBT: am 29.08.2026 sah ein Nutzer im Onboarding eines
// FRISCHEN Betriebs die 18 Objekte eines FREMDEN Betriebs. Vier Erklärungen
// standen im Raum (Backend-Scope, Next-Cache, Modul-State, DB-Policy) — alle
// vier waren falsch. Gemessen war die Wahrheit in einer Zeile:
//
//     Token mit tenant_id=AirSmil       → GET /properties → total = 18
//     Token mit tenant_id=UI-Test       → GET /properties → total =  1
//
// Das Backend war nie das Problem. Der Browser schickte schlicht das Token
// eines anderen Betriebs. Nur konnte das NIEMAND sehen: die Cookies sind
// `httpOnly` (JavaScript kommt nicht daran), sie heißen bei jedem Konto gleich
// (`nd_access`), und nichts im System sagte je, WESSEN Sitzung gerade läuft.
// Ein Fehler, der eine halbe Stunde Rätselraten kostet, weil die Antwort
// nirgends steht, ist ein Beobachtungs-Fehler, kein Logik-Fehler.
//
// KEINE VERTRAUENSPRÜFUNG: hier wird die Signatur NICHT geprüft. Diese Datei
// beantwortet ausschließlich „was BEHAUPTET das Token" — für Anzeige, Log und
// Vergleich. Worüber entschieden wird, entscheidet der Server nach
// Signaturprüfung (`core/security.py:_decode_token`). Diese Trennung ist
// Absicht: ein Debug-Werkzeug, das selbst zum Vertrauensanker wird, ist Wurzel 7.
import { cookies } from "next/headers";

/** Was ein Sitzungs-Token über sich behauptet. Alle Felder können fehlen —
 *  ein fremdes/kaputtes Token ist kein Grund zu werfen, sondern genau der
 *  Fall, den wir sehen wollen. */
export interface SitzungsIdentitaet {
  /** GoTrue-Nutzer-ID (`sub`). */
  userId: string | null;
  email: string | null;
  /** Der Betrieb aus `app_metadata.tenant_id` — das Feld, an dem JEDE
   *  Mandantentrennung hängt. Fehlt es, antwortet das Backend 400. */
  tenantId: string | null;
  /** Rolle aus `app_metadata.role`. NICHT maßgeblich (der Server liest sie aus
   *  der DB, Wurzel 7) — hier nur zur Anzeige. */
  rolle: string | null;
  /** Authenticator Assurance Level (`aal1` = 2FA offen, `aal2` = erfüllt). */
  aal: string | null;
  /** Ablauf als ISO-Zeit, oder null wenn der Claim fehlt. */
  laeuftAb: string | null;
  /** Ist das Token JETZT abgelaufen? */
  abgelaufen: boolean;
  /** Sekunden bis zum Ablauf (negativ = schon vorbei). */
  restSekunden: number | null;
}

/** Ein nicht dekodierbares Token liefert diese Gestalt — nie einen Wurf. */
const UNBEKANNT: SitzungsIdentitaet = {
  userId: null,
  email: null,
  tenantId: null,
  rolle: null,
  aal: null,
  laeuftAb: null,
  abgelaufen: false,
  restSekunden: null,
};

/**
 * Zerlegt einen JWT in seine Identität — OHNE Signaturprüfung.
 *
 * Base64url-Payload lesen, mehr nicht. Alles, was schiefgehen kann (kein
 * Punkt, kein Base64, kein JSON), endet in `UNBEKANNT` statt in einem Wurf:
 * diese Funktion läuft in Log-Pfaden und darf einen Request NIE kippen
 * (Wurzel 5, best-effort-Zweig).
 */
export function identitaetAusToken(token: string | null | undefined): SitzungsIdentitaet {
  if (!token) return UNBEKANNT;
  try {
    const payload = token.split(".")[1];
    if (!payload) return UNBEKANNT;
    const json = Buffer.from(
      payload.replace(/-/g, "+").replace(/_/g, "/"),
      "base64",
    ).toString("utf8");
    const c = JSON.parse(json) as {
      sub?: string;
      email?: string;
      aal?: string;
      exp?: number;
      app_metadata?: { tenant_id?: string; role?: string };
    };
    const exp = typeof c.exp === "number" ? c.exp : null;
    const jetzt = Math.floor(Date.now() / 1000);
    return {
      userId: c.sub ?? null,
      email: c.email ?? null,
      // Leerer String ist KEIN Tenant — sonst sähe ein Token mit `tenant_id: ""`
      // im Log aus wie ein gültiger Betrieb, während das Backend 400 antwortet.
      tenantId: c.app_metadata?.tenant_id || null,
      rolle: c.app_metadata?.role ?? null,
      aal: c.aal ?? null,
      laeuftAb: exp !== null ? new Date(exp * 1000).toISOString() : null,
      abgelaufen: exp !== null ? exp <= jetzt : false,
      restSekunden: exp !== null ? exp - jetzt : null,
    };
  } catch {
    return UNBEKANNT;
  }
}

/**
 * Kurzform für Logzeilen: `tenant=a25577cf user=5ed7c939 rolle=admin`.
 *
 * IDs bewusst auf 8 Zeichen gekürzt und die E-Mail bewusst NICHT dabei: diese
 * Zeile landet in Server-Logs, die weiterverarbeitet werden. Acht Zeichen
 * genügen, um zwei Betriebe zu unterscheiden — mehr braucht eine Diagnose nicht,
 * und personenbezogene Daten gehören nicht ungefragt ins Log.
 */
export function identitaetKurz(id: SitzungsIdentitaet): string {
  const k = (v: string | null) => (v ? v.slice(0, 8) : "—");
  const ablauf = id.abgelaufen
    ? "ABGELAUFEN"
    : id.restSekunden !== null
      ? `${id.restSekunden}s`
      : "—";
  return `tenant=${k(id.tenantId)} user=${k(id.userId)} rolle=${id.rolle ?? "—"} aal=${id.aal ?? "—"} rest=${ablauf}`;
}

/**
 * Die Identität BEIDER Sitzungs-Cookies nebeneinander.
 *
 * Warum beide: genau ihr Auseinanderlaufen ist der Fehler, den wir suchen. Das
 * Access-Cookie trägt eine kurze Laufzeit und verschwindet aus dem Jar, das
 * Refresh-Cookie bleibt 30 Tage. Steht im Refresh-Cookie ein ANDERER Betrieb
 * als im Access-Cookie, wird beim nächsten Seitenaufruf die alte Sitzung
 * wiederbelebt — der Nutzer wechselt den Betrieb, ohne etwas zu tun.
 *
 * Das Refresh-Token ist bei Supabase KEIN JWT (Zufallszeichenkette), es liefert
 * deshalb `UNBEKANNT`. Sein Vorhandensein ist trotzdem die halbe Diagnose:
 * „Access weg, Refresh da" ist exakt der Zustand, in dem die Middleware
 * ungefragt erneuert.
 */
export async function sitzungsLage(namen: {
  access: string;
  refresh: string;
}): Promise<{
  access: SitzungsIdentitaet & { vorhanden: boolean };
  refreshVorhanden: boolean;
  /** true, wenn die Middleware bei der nächsten Navigation erneuern WÜRDE. */
  erneuerungSteht: boolean;
}> {
  const jar = await cookies();
  const access = jar.get(namen.access)?.value ?? null;
  const refresh = jar.get(namen.refresh)?.value ?? null;
  return {
    access: { ...identitaetAusToken(access), vorhanden: access !== null },
    refreshVorhanden: refresh !== null,
    erneuerungSteht: access === null && refresh !== null,
  };
}
