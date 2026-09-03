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
