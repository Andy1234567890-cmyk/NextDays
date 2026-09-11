// Bewerbung als Partner — direkt aus der Marketing-Seite an die API
// (`POST /affiliates/apply`, 0517/0520). Muster wie lib/kontakt.ts: Captcha-
// Token holen, senden, Fehler mit Status weiterreichen; die Anzeige übersetzt.
import { captchaToken } from "@/lib/captcha";
import { API_BASE } from "@/lib/config";
import type { SocialKanal } from "@/lib/kanaele";

// Muss dem `expectedAction` der API entsprechen (features/affiliates: „partner_bewerbung").
const CAPTCHA_AKTION = "partner_bewerbung";

export type Bewerbung = {
  email: string;
  password: string;
  full_name: string;
  company: string | null;
  legal_form: "company" | "private";
  country: string;
  vat_id: string | null;
  language: string;
  channels: SocialKanal[];
  sponsor_code: string | null;
  pitch: string | null;
  terms_accepted: boolean;
  terms_version: string;
  // Zweite, freiwillige Einwilligung — getrennt von `terms_accepted`. Der
  // Wortlaut geht mit, weil er der Nachweis ist (DSGVO Art. 7 Abs. 1); der
  // Server startet damit dasselbe Double-Opt-in wie das Marketing-Popup.
  newsletter_opt_in: boolean;
  newsletter_consent_text: string | null;
  website: string | null;
};

export class BewerbungFehler extends Error {
  constructor(
    public readonly status: number,
    public readonly detail: string,
  ) {
    super(detail || `HTTP ${status}`);
  }
}

/** Version der Partner-Bedingungen, der die Bewerbung zustimmt (= /partner/agb). */
export const PARTNER_TERMS_VERSION = "2026-09";

export async function bewerbungSenden(daten: Bewerbung): Promise<void> {
  const token = await captchaToken(CAPTCHA_AKTION);
  const res = await fetch(`${API_BASE}/affiliates/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...daten, captcha_token: token }),
  });
  if (!res.ok) {
    let detail = "";
    try {
      const body = (await res.json()) as { detail?: unknown };
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail ?? "");
    } catch {
      // kein JSON — nur der Status bleibt
    }
    console.error("[partner-bewerbung] fehlgeschlagen", { status: res.status, detail });
    throw new BewerbungFehler(res.status, detail);
  }
}

// EU27 + CH + GB — die Länder, die die API annimmt (is_iso2_country).
export const LAENDER = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT",
  "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "CH", "GB",
] as const;

export function landName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

// USt-IdNr.-Beispiel je Land — Platzhalter für das Eingabefeld.
//
// Bis zum 10.09.2026 stand im Formular fest `placeholder="DE123456789"` NEBEN
// der Länderauswahl, die nicht nachzog: ein dänischer Bewerber las ein
// deutsches Beispiel und tippte eine Nummer, die es in DK nicht gibt.
//
// Warum die Tabelle hier steht statt in `@nextdays/laender`: marketing baut
// BEWUSST isoliert (eigene bun.lock, eigener Dockerfile ohne Root-Kontext,
// ADR-0016) und nutzt daher KEINE Workspace-Packages — dieselbe dokumentierte
// Ausnahme wie bei der CSP-Kopie in `next.config.ts` und bei `LAENDER`/
// `landName` oben. Wer die Formate ändert, ändert BEIDE Stellen; die
// Deckungsgleichheit prüft `scripts/i18n/laender-formwissen-pruefen.mjs`.
//
// Quelle: EU-Kommission, „VAT identification number structure" (TAXUD, Anhang
// zum VIES-Dienst) je Mitgliedstaat; CH aus dem UID-Register der ESTV, GB aus
// HMRC VAT Notice 700.
const VAT_BEISPIEL: Readonly<Record<string, string>> = {
  DE: "DE123456789", // 9 Ziffern
  AT: "ATU12345678", // U + 8 Ziffern
  CH: "CHE-123.456.789 MWST", // ESTV UID/MWST (Nicht-EU)
  BE: "BE0123456789", // 10 Ziffern (führende 0/1)
  BG: "BG123456789", // 9 oder 10 Ziffern
  HR: "HR12345678901", // 11 Ziffern
  CY: "CY12345678L", // 8 Ziffern + 1 Buchstabe
  CZ: "CZ12345678", // 8, 9 oder 10 Ziffern
  DK: "DK12345678", // 8 Ziffern
  EE: "EE123456789", // 9 Ziffern
  FI: "FI12345678", // 8 Ziffern
  FR: "FRXX123456789", // 2 Prüfzeichen + 9 Ziffern (SIREN)
  GR: "EL123456789", // Präfix EL, 9 Ziffern
  HU: "HU12345678", // 8 Ziffern
  IE: "IE1234567L", // 7 Zeichen + 1–2 Buchstaben
  IT: "IT12345678901", // 11 Ziffern
  LV: "LV12345678901", // 11 Ziffern
  LT: "LT123456789", // 9 oder 12 Ziffern
  LU: "LU12345678", // 8 Ziffern
  MT: "MT12345678", // 8 Ziffern
  NL: "NL123456789B01", // 9 Ziffern + B + 2 Ziffern
  PL: "PL1234567890", // 10 Ziffern
  PT: "PT123456789", // 9 Ziffern
  RO: "RO123456789", // 2–10 Ziffern
  SK: "SK1234567890", // 10 Ziffern
  SI: "SI12345678", // 8 Ziffern
  ES: "ESX1234567X", // Zeichen + 7 Ziffern + Zeichen
  SE: "SE123456789012", // 12 Ziffern
  GB: "GB123456789", // 9 Ziffern (HMRC, seit dem Brexit kein VIES-Land)
};

/** Platzhalter-Beispiel für die USt-IdNr. eines Landes.
 *
 *  Leer, solange das Format nicht belegt ist: Wurzel 4 — ein zusammengebautes
 *  `XX123456789` sähe echt aus und wäre geraten. Ein leerer Platzhalter ist
 *  ehrlich, ein falscher führt in die Irre. */
export function vatBeispielFuerLand(code: string): string {
  return VAT_BEISPIEL[code.trim().toUpperCase()] ?? "";
}
