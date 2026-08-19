// Zugriff auf das Kontaktformular (/api/v1/contact/message).
//
// Wie Newsletter und Support-Chat geht der Aufruf DIREKT an die FastAPI, nicht
// über eine Next-Proxy-Route (siehe lib/config.ts): nur so sieht die API die IP
// des Besuchers — und die braucht sie zweimal, für ihr IP-Rate-Limit und für die
// reCAPTCHA-Bewertung. Über eine Proxy-Route käme jede Anfrage von der Server-IP
// der Marketing-App; das Limit wäre ein gemeinsamer Zähler für alle Besucher und
// Google bewertete immer dieselbe IP.
//
// Betrieb: die Marketing-Domain muss in CORS_ORIGINS der API stehen.
import { captchaToken } from "@/lib/captcha";
import { API_BASE } from "@/lib/config";

// Aktionsname des Captcha-Tokens. MUSS mit `CAPTCHA_AKTION` in
// apps/api/src/features/contact/service.py übereinstimmen — Google prüft ihn
// gegen, und ein Tippfehler ergibt einen 403 ohne erkennbaren Grund.
export const CAPTCHA_AKTION = "kontakt";

// Die auswählbaren Anliegen. Reihenfolge = Reihenfolge im Auswahlfeld.
// Dieselben Kürzel wie `KontaktThema` in der API; ein unbekanntes Kürzel
// beantwortet sie mit 422 statt es einem Standard-Postfach zuzuschlagen.
export const KONTAKT_THEMEN = [
  "allgemein",
  "vertrieb",
  "abrechnung",
  "technik",
  "api",
  "partner",
  "presse",
  "datenschutz",
  "sicherheit",
] as const;

export type KontaktThema = (typeof KONTAKT_THEMEN)[number];

// Welche Themen an das technische Postfach gehen — NUR für den Hinweis unter dem
// Auswahlfeld („geht an unser Entwicklerteam"). Die tatsächliche Zuordnung
// entscheidet der Server (features/contact/themen.py); diese Liste ist Anzeige,
// keine Steuerung. Sie zu ändern verschiebt keine Mail.
const TECHNISCHE_THEMEN: ReadonlySet<string> = new Set([
  "technik",
  "api",
  "sicherheit",
]);

export function istTechnisch(thema: string): boolean {
  return TECHNISCHE_THEMEN.has(thema);
}

export type KontaktAntwort = { detail: string };

/**
 * Fehler mit HTTP-Status. Der Status ist der Punkt: die Seite läuft in 24
 * Sprachen, die `detail`-Texte der API sind deutsch. Angezeigt wird deshalb ein
 * übersetzter Text NACH STATUS (`kontakt.formular.fehler*`), und der
 * Originaltext der API landet nur in der Konsole — er ist für uns beim
 * Fehlersuchen geschrieben, nicht für einen griechischen Besucher.
 */
export class KontaktFehler extends Error {
  readonly status: number;

  constructor(status: number, detail: string) {
    super(detail || `HTTP ${status}`);
    this.name = "KontaktFehler";
    this.status = status;
  }
}

export type KontaktDaten = {
  name: string;
  email: string;
  firma?: string;
  telefon?: string;
  thema: KontaktThema;
  nachricht: string;
  locale: string;
  /** Honigtopf — muss leer bleiben. Gefüllt = Bot. */
  website?: string;
};

/**
 * Nachricht abschicken. Holt vorher ein frisches Captcha-Token (falls ein
 * Schlüssel konfiguriert ist) und wirft bei Fehlern einen `KontaktFehler` mit
 * dem HTTP-Status — die Anzeige übersetzt danach (siehe dort).
 */
export async function kontaktSenden(
  daten: KontaktDaten,
): Promise<KontaktAntwort> {
  const token = await captchaToken(CAPTCHA_AKTION);

  const res = await fetch(`${API_BASE}/contact/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: daten.name,
      email: daten.email,
      firma: daten.firma || null,
      telefon: daten.telefon || null,
      thema: daten.thema,
      nachricht: daten.nachricht,
      locale: daten.locale,
      captcha_token: token,
      website: daten.website || null,
    }),
  });

  if (!res.ok) {
    let detail = "";
    try {
      detail = ((await res.json()) as { detail?: string }).detail ?? "";
    } catch {
      // Kein JSON im Body (z. B. 502 vom Proxy) → nur der Status bleibt.
    }
    // Diagnose: der Originaltext der API steht in der Konsole, damit ein Fehler
    // nachvollziehbar ist, ohne dass der Besucher deutschen Technikjargon liest.
    console.error("[kontakt] Absenden fehlgeschlagen", {
      status: res.status,
      detail,
    });
    throw new KontaktFehler(res.status, detail);
  }
  return (await res.json()) as KontaktAntwort;
}
