// Umgebung der Marketing-App an EINER Stelle.
//
// Die Landingpage ist ansonsten backend-frei (ADR-0002). Einzige Ausnahme ist
// der Support-Chat unten rechts: er spricht direkt mit der FastAPI, damit deren
// IP-Rate-Limit die IP des BESUCHERS sieht. Ginge der Aufruf über eine
// Next-Proxy-Route, käme jede Anfrage von der Server-IP der Marketing-App —
// ein gemeinsamer Zähler für alle Besucher wäre entweder wirkungslos oder
// würde beim ersten Ansturm alle aussperren.
//
// Betrieb: die Marketing-Domain muss in CORS_ORIGINS der API stehen, sonst
// blockt der Browser die Anfrage.
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const API_BASE = `${API_URL.replace(/\/$/, "")}/api/v1`;

// Öffentlicher reCAPTCHA-Enterprise-Schlüssel (Google Cloud). Er ist bewusst
// öffentlich — geheim ist nur der API-Schlüssel, mit dem die FastAPI das Token
// bewerten lässt. Beide Seiten MÜSSEN dieselbe Kennung tragen (`RECAPTCHA_SITE_KEY`
// in der API), sonst hält Google jedes Token für ungültig.
//
// Leer heißt: kein Captcha-Skript, kein Token. Das ist der lokale Normalfall —
// die API riegelt dann über ihre eigene Sandbox ab (`captcha_sandbox`). In
// Produktion ist ein leerer Wert ein Konfigurationsfehler: die API antwortet
// dann mit 503, statt ungeprüft anzunehmen. Kein Ersatzwert (Wurzel 4).
export const RECAPTCHA_SITE_KEY =
  process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? "";

// GA4-Mess-ID für die Reichweitenmessung dieser Seite.
//
// Sie ist öffentlich — sie steht im HTML jeder Seite, das ist ihr Zweck — und
// benennt die Property, sie berechtigt zu nichts.
//
// Fest im Code und nicht nur als Umgebungsvariable, aus demselben Grund wie der
// Meta-Pixel und der Search-Console-Nachweis: `NEXT_PUBLIC_*` wird beim BAUEN
// eingesetzt. Eine Variable, die nur in Coolify steht, wäre im fertigen Image
// leer — die Messung liefe still nicht, und das fällt erst auf, wenn Wochen
// später niemand Zahlen hat (Wurzel 5: ein fehlender Konfigurationswert muss
// laut sein, nicht stumm).
//
// Überschreibbar bleibt sie: eine zweite Property (Staging) setzt
// `NEXT_PUBLIC_GA_MEASUREMENT_ID` und baut neu. Leerer Wert = bewusst keine
// Messung; die Kategorie „Analytische Cookies" erscheint dann trotzdem im
// Dialog (sonst wäre sie nicht abwählbar, sondern unsichtbar) und meldet
// „nicht eingerichtet".
//
// KEIN Platzhalter als Vorgabe (Wurzel 4): eine erfundene `G-XXXXXXXXXX` würde
// ein Skript laden, das Daten an eine fremde oder nicht existierende Property
// sendet — schlimmer als keine Messung.
const GA_MEASUREMENT_STANDARD = "G-8V80HGPYVW";

export const GA_MEASUREMENT_ID = (
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? GA_MEASUREMENT_STANDARD
).trim();

// Werbe-Pixel (Marketing-Kategorie) — Kennungen der Dienste, die nur nach
// Einwilligung laden dürfen.
//
// Leer = dieser Pixel lädt nicht. Kein Platzhalter als Vorgabewert (Wurzel 4):
// eine erfundene Kennung würde ein Skript laden, das Daten an ein fremdes Konto
// schickt. Die Kennungen sind öffentlich (sie stehen im HTML), müssen aber echt
// sein.
//
// In Coolify als Build-Argument setzen — `NEXT_PUBLIC_*` wird beim BAUEN
// eingesetzt (siehe marketing/Dockerfile).
// Die Kennung des Meta-Pixels (Facebook/Instagram) dieses Kontos. Sie ist
// öffentlich — sie steht im HTML jeder Seite, das ist ihr Zweck — und
// identifiziert das Werbekonto, sie berechtigt zu nichts.
//
// Fest im Code und nicht nur als Umgebungsvariable, aus demselben Grund wie der
// Search-Console-Nachweis (lib/site-verification.ts): `NEXT_PUBLIC_*` wird beim
// BAUEN eingesetzt. Eine Variable, die nur in Coolify steht, wäre im Image leer
// — der Pixel lädt dann nicht, und das fällt erst auf, wenn Wochen später keine
// Kampagnendaten da sind (Wurzel 5: ein fehlender Konfigurationswert muss laut
// sein, nicht stumm).
//
// Überschreibbar bleibt sie: ein zweites Werbekonto (Staging) setzt
// `NEXT_PUBLIC_META_PIXEL_ID` und baut neu. Leerer Wert = bewusst kein Pixel.
const META_PIXEL_STANDARD = "2299389937556025";

export const META_PIXEL_ID =
  (process.env.NEXT_PUBLIC_META_PIXEL_ID ?? META_PIXEL_STANDARD).trim();
export const LINKEDIN_PARTNER_ID =
  process.env.NEXT_PUBLIC_LINKEDIN_PARTNER_ID ?? "";
export const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID ?? "";

/**
 * Ist überhaupt ein Werbe-Pixel eingerichtet?
 *
 * Entscheidet, ob die Marketing-Kategorie im Einwilligungs-Dialog einen
 * eingerichteten Dienst meldet. Die Kategorie erscheint IMMER (sonst wäre sie
 * nicht abwählbar, sondern unsichtbar) — dieser Wert steuert nur den Hinweis,
 * dass hier gerade nichts lädt.
 */
export const MARKETING_PIXEL_VORHANDEN =
  META_PIXEL_ID !== "" || LINKEDIN_PARTNER_ID !== "" || GOOGLE_ADS_ID !== "";
