// Werbe-Pixel im Browser — Skripte erst nach Einwilligung („marketing").
//
// Dasselbe Muster wie bei Messung und Spamschutz (lib/analytics.ts,
// lib/captcha.ts): eigenes Skript-Tag, erst wenn erlaubt, und ein Gegenzustand,
// der beim Widerruf die gesetzten Cookies wieder entfernt (Wurzel 1).
//
// EINWILLIGUNG IST VORAUSSETZUNG. Fail-closed: „nicht entschieden" zählt wie
// „nicht erlaubt", ein gesperrter Speicher ebenso (lib/einwilligung.ts). Ohne
// Zustimmung entsteht KEIN Skript-Tag, also kein Request und keine
// IP-Übermittlung. Wer hier eine Ausnahme einbaut, macht die Leiste zur
// Attrappe und die Cookie-Richtlinie unwahr.
//
// Ohne konfigurierte Kennung passiert nichts — auch mit Einwilligung. Eine
// erfundene Kennung würde Daten an ein fremdes Konto schicken (Wurzel 4).
import {
  GOOGLE_ADS_ID,
  LINKEDIN_PARTNER_ID,
  META_PIXEL_ID,
} from "@/lib/config";
import { cookiesLoeschen } from "@/lib/cookie-loeschen";
import { istErlaubt } from "@/lib/einwilligung";

const META_ID = "nd-meta-pixel";
const META_BILD_ID = "nd-meta-pixel-bild";
const LINKEDIN_ID = "nd-linkedin-pixel";
const ADS_ID = "nd-google-ads";

type Fbq = ((...args: unknown[]) => void) & {
  queue?: unknown[];
  loaded?: boolean;
  version?: string;
  push?: unknown;
  callMethod?: (...args: unknown[]) => void;
};

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
    _linkedin_data_partner_ids?: string[];
    lintrk?: (...args: unknown[]) => void;
  }
}

/** Legt ein Skript-Tag an, falls es noch nicht existiert. */
function skript(id: string, src: string): void {
  if (document.getElementById(id)) return;
  const tag = document.createElement("script");
  tag.id = id;
  tag.async = true;
  tag.src = src;
  document.head.appendChild(tag);
}

/**
 * Meta-Pixel (Facebook/Instagram). Die Warteschlange muss VOR dem Skript
 * stehen, sonst gehen die Aufrufe verloren, die vor dem Laden passieren — das
 * ist der Grund für den Stub, den Meta selbst vorgibt.
 */
function metaStarten(): void {
  if (!META_PIXEL_ID) return;
  if (!window.fbq) {
    const f: Fbq = function (...args: unknown[]) {
      if (f.callMethod) f.callMethod(...args);
      else f.queue?.push(args);
    } as Fbq;
    f.queue = [];
    f.loaded = true;
    f.version = "2.0";
    window.fbq = f;
    window._fbq = f;
  }
  skript(META_ID, "https://connect.facebook.net/en_US/fbevents.js");
  window.fbq?.("init", META_PIXEL_ID);
  window.fbq?.("track", "PageView");
  metaNoscriptBild();
}

/**
 * Das `<noscript>`-Zählpixel aus Metas Vorlage — als Bild, das der Browser
 * abruft, wenn JavaScript den regulären Weg nicht gehen kann.
 *
 * WARUM ES NICHT IM HTML STEHT: Metas Snippet setzt es als echtes
 * `<noscript><img …></noscript>` in die Seite. Genau dort wäre es hier
 * rechtswidrig — `<noscript>`-Inhalt lädt, sobald JavaScript aus ist, und zwar
 * OHNE dass eine Einwilligung geprüft werden kann (die liegt im localStorage
 * und ist ohne JavaScript nicht lesbar). Der Zähler feuerte also ausgerechnet
 * bei den Besuchern ungefragt, die am wenigsten Skripte zulassen.
 *
 * Deshalb wird das Bild hier per JavaScript angelegt — nach der Einwilligung,
 * im selben Pfad wie das Skript. Das ist derselbe Request an dieselbe URL, nur
 * an die Zustimmung gebunden. Der Preis: bei abgeschaltetem JavaScript zählt
 * Meta nichts. Das ist kein Verlust, denn dort dürfte es ohnehin nicht zählen.
 *
 * `display:none` und 1×1 Pixel wie in der Vorlage; das Bild ist ein Zähler,
 * keine Grafik.
 */
function metaNoscriptBild(): void {
  if (document.getElementById(META_BILD_ID)) return;
  const bild = document.createElement("img");
  bild.id = META_BILD_ID;
  bild.height = 1;
  bild.width = 1;
  bild.style.display = "none";
  bild.alt = "";
  bild.src =
    `https://www.facebook.com/tr?id=${encodeURIComponent(META_PIXEL_ID)}` +
    "&ev=PageView&noscript=1";
  document.body.appendChild(bild);
}

/** LinkedIn Insight Tag. */
function linkedinStarten(): void {
  if (!LINKEDIN_PARTNER_ID) return;
  window._linkedin_data_partner_ids = window._linkedin_data_partner_ids ?? [];
  if (!window._linkedin_data_partner_ids.includes(LINKEDIN_PARTNER_ID)) {
    window._linkedin_data_partner_ids.push(LINKEDIN_PARTNER_ID);
  }
  skript(LINKEDIN_ID, "https://snap.licdn.com/li.lms-analytics/insight.min.js");
}

/**
 * Google Ads (Conversion-Tracking). Nutzt dasselbe gtag.js wie die Messung —
 * `gtag` wird deshalb hier NICHT neu angelegt, sondern nur konfiguriert, wenn
 * es bereits vorhanden ist bzw. das Skript geladen wird.
 */
function adsStarten(): void {
  if (!GOOGLE_ADS_ID) return;
  window.dataLayer = window.dataLayer ?? [];
  if (!window.gtag) {
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer?.push(args);
    };
  }
  skript(
    ADS_ID,
    `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GOOGLE_ADS_ID)}`,
  );
  // Werbe-Einwilligung erteilen — nur hier, nur mit „marketing". Die Messung
  // (lib/analytics.ts) lässt diese Parameter dauerhaft auf `denied`.
  window.gtag?.("consent", "update", {
    ad_storage: "granted",
    ad_user_data: "granted",
    ad_personalization: "granted",
  });
  window.gtag?.("config", GOOGLE_ADS_ID);
}

/**
 * Startet alle konfigurierten Werbe-Pixel, wenn „marketing" erlaubt ist.
 *
 * Rückgabe sagt, ob etwas läuft — für Tests und Diagnose, nicht für
 * Steuerungslogik. Mehrfache Aufrufe sind harmlos: die Skript-Tags entstehen
 * genau einmal (Prüfung über die Element-ID).
 */
export function pixelStarten(): boolean {
  if (typeof window === "undefined") return false;
  if (!istErlaubt("marketing")) return false;
  metaStarten();
  linkedinStarten();
  adsStarten();
  return Boolean(META_PIXEL_ID || LINKEDIN_PARTNER_ID || GOOGLE_ADS_ID);
}

/**
 * Widerruf: Werbe-Einwilligung zurücknehmen und die gesetzten Cookies löschen.
 *
 * Geladene Skripte lassen sich nicht zurücknehmen — wirksam ist, dass Google
 * die Werbe-Parameter wieder auf `denied` bekommt und die Kennungen
 * verschwinden. Bleibt ein Cookie stehen, meldet `cookiesLoeschen` es laut
 * (Wurzel 5).
 */
export function pixelWiderrufen(): void {
  if (typeof window === "undefined") return;
  // Das Zählbild entfernen. Der Request von vorhin lässt sich nicht
  // zurücknehmen, aber ein im DOM verbliebenes Bild würde bei einer erneuten
  // Zustimmung nicht neu geladen — und `metaNoscriptBild` hielte es für schon
  // erledigt.
  document.getElementById(META_BILD_ID)?.remove();
  window.gtag?.("consent", "update", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
  cookiesLoeschen(
    (name) =>
      name === "_fbp" ||
      name === "_fbc" ||
      name === "_gcl_au" ||
      name.startsWith("_gcl_") ||
      name === "li_gc" ||
      name === "bcookie" ||
      name === "lidc" ||
      name === "UserMatchHistory" ||
      name === "AnalyticsSyncHistory",
    "pixel",
  );
}
