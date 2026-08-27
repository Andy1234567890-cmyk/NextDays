// GA4-Reichweitenmessung im Browser — Skript erst nach Einwilligung.
//
// WARUM NICHT `@next/third-parties/google`: Dessen `<GoogleAnalytics>` lädt das
// Tag beim Rendern und kennt keinen Weg, den Einwilligungsstand nachträglich zu
// ändern (vercel/next.js#66718). Wir brauchen genau das: die Leiste entscheidet
// NACH dem ersten Rendern, und ein Widerruf muss ohne Neuladen greifen. Deshalb
// dasselbe Muster wie beim Captcha (lib/captcha.ts): eigenes Skript-Tag, erst
// wenn erlaubt.
//
// EINWILLIGUNG IST VORAUSSETZUNG. Fail-closed: „nicht entschieden" zählt wie
// „nicht erlaubt", ein gesperrter Speicher ebenso (lib/einwilligung.ts). Ohne
// Zustimmung entsteht KEIN Skript-Tag, also kein Request an googletagmanager.com
// und keine IP-Übermittlung. Wer hier eine Ausnahme einbaut, macht die Leiste
// zur Attrappe und die Cookie-Richtlinie unwahr.
//
// CONSENT MODE V2 — die Reihenfolge ist vorgeschrieben und nicht beliebig
// (developers.google.com/tag-platform/security/guides/consent): dataLayer und
// gtag definieren → `consent default` auf `denied` → DANN das Skript laden →
// `config` → später `consent update`. Läuft es in anderer Reihenfolge, greifen
// die Vorgaben nicht. Wir setzen die Vorgabe deshalb im gleichen Zug, in dem
// wir das Tag anlegen, und zwar VOR dem Anhängen des Skripts.
//
// Warum die vier Werbe-Parameter überhaupt auftauchen, obwohl wir nicht werben:
// Consent Mode v2 verlangt sie, und sie bleiben dauerhaft auf `denied` — genau
// das ist die Aussage „keine Werbe-Einwilligung, auch nicht implizit". Sie
// werden NIE auf `granted` gesetzt.
import { GA_MEASUREMENT_ID } from "@/lib/config";
import { cookiesLoeschen } from "@/lib/cookie-loeschen";
import { istErlaubt } from "@/lib/einwilligung";

const SKRIPT_ID = "nd-ga4";

type GtagArgumente = unknown[];

declare global {
  interface Window {
    dataLayer?: GtagArgumente[];
    gtag?: (...args: GtagArgumente) => void;
  }
}

/**
 * Legt `dataLayer`/`gtag` an, falls noch nicht vorhanden, und gibt `gtag`
 * zurück. Idempotent: mehrfache Aufrufe teilen dieselbe Warteschlange — sonst
 * verliert ein zweiter Aufruf die bereits eingereihten Befehle.
 */
function gtagVorbereiten(): (...args: GtagArgumente) => void {
  window.dataLayer = window.dataLayer ?? [];
  if (!window.gtag) {
    window.gtag = function gtag(...args: GtagArgumente) {
      // Muss `arguments` in die Warteschlange schieben, nicht ein Array davon —
      // gtag.js liest die Einträge als Argumentlisten. Ein `push([...])` würde
      // von Google als EIN Argument gelesen und stillschweigend ignoriert.
      window.dataLayer?.push(args);
    };
  }
  return window.gtag;
}

/**
 * Startet die Messung, wenn sie erlaubt UND konfiguriert ist.
 *
 * Rückgabe sagt, ob gemessen wird — nützlich für Tests und Diagnose, nicht für
 * Steuerungslogik. Mehrfache Aufrufe sind harmlos und ausdrücklich vorgesehen:
 * das Skript entsteht genau einmal, die Zustimmung wird jedes Mal gesetzt.
 */
export function analyticsStarten(): boolean {
  if (typeof window === "undefined") return false;
  if (!GA_MEASUREMENT_ID) return false;
  if (!istErlaubt("analytisch")) return false;

  // Das Skript-Tag entsteht genau EINMAL, die Zustimmung wird JEDES MAL
  // nachgezogen. Diese Trennung ist der Kern der Funktion und war zuerst
  // falsch: ein früher `return`, sobald das Tag existierte, übersprang das
  // `consent update` weiter unten. Folge — Zustimmung, Widerruf, erneute
  // Zustimmung im selben Seitenaufruf (über das Cookie-Symbol jederzeit
  // möglich) ließ `analytics_storage` auf `denied` stehen, während die Funktion
  // `true` zurückgab: es wurde nichts mehr gemessen, und die Rückgabe behauptete
  // das Gegenteil. Genau Wurzel 1 — der Gegenzustand (`denied`) wurde gesetzt,
  // aber beim Zurückschalten nicht mitgepflegt.
  //
  // `consent update` ist ein Zustandssetzer, kein Ereignis: ihn mehrfach mit
  // demselben Wert zu senden ist folgenlos, ihn zu VERPASSEN ist der teure
  // Fehler. Also läuft er immer.
  const bereitsGeladen = document.getElementById(SKRIPT_ID) !== null;
  const gtag = gtagVorbereiten();

  if (!bereitsGeladen) {
    // 1) Vorgabe: alles verweigert. Sie gilt für den kurzen Moment zwischen
    //    Skript-Start und dem `update` unten — und dauerhaft für die vier
    //    Werbe-Parameter.
    gtag("consent", "default", {
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "denied",
    });

    // 2) Skript laden. `async`, damit es das Rendern nicht blockiert.
    const skript = document.createElement("script");
    skript.id = SKRIPT_ID;
    skript.async = true;
    skript.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_MEASUREMENT_ID)}`;
    document.head.appendChild(skript);

    // 3) Grundkonfiguration.
    gtag("js", new Date());
    gtag("config", GA_MEASUREMENT_ID, {
    // IP-Kürzung ist in GA4 immer an und nicht abschaltbar; hier steht deshalb
    // nur, was wir zusätzlich einschränken:
    //
    // `anonymize_ip` gibt es in GA4 NICHT mehr (es war Universal Analytics) —
    // es hier zu setzen wäre eine wirkungslose Beruhigungszeile.
    //
    // Keine Google-Signale, keine Werbe-Personalisierung: damit entstehen keine
    // geräteübergreifenden Profile und keine Zielgruppenlisten.
      // Der Seitenaufruf wird AUSSCHLIESSLICH von `seitenaufrufMelden`
      // gezählt. Ohne diese Zeile feuert gtag.js beim `config` selbst einen
      // `page_view` (Standard ist `true`), und der Effekt in
      // components/analytics-messung.tsx läuft beim ersten Rendern ebenfalls
      // los: die Einstiegsseite wurde DOPPELT gezählt, jede Folgeseite
      // einfach. Absprungrate und „Aufrufe pro Sitzung" wären verfälscht —
      // plausibel genug, dass es niemandem auffällt.
      //
      // Eine Quelle statt zwei ist auch inhaltlich richtiger: gtag leitet den
      // Pfad aus `location` ab und protokolliert bei einer Zustimmung mitten
      // im Besuch die falsche Seite.
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
  }

  // 4) Zustimmung nachziehen — NUR die Statistik. Die Werbe-Parameter bleiben
  //    verweigert, weil dafür niemand um Zustimmung gebeten wurde und es auch
  //    keinen Dienst gibt, der sie bräuchte. Läuft bei JEDEM Aufruf (siehe
  //    oben), nicht nur beim ersten.
  gtag("consent", "update", { analytics_storage: "granted" });

  // Erteilt jemand die Zustimmung erst mitten im Besuch, hat der Effekt in
  // analytics-messung.tsx seinen `page_view` für diese Seite längst
  // abgeschickt — verworfen, weil damals nichts erlaubt war. Ohne diese Zeile
  // wäre die Seite, auf der zugestimmt wurde, die einzige ungezählte. Nur beim
  // erstmaligen Laden, sonst zählte jeder Widerruf-und-wieder-Klick erneut.
  if (!bereitsGeladen) {
    seitenaufrufMelden(window.location.pathname + window.location.search);
  }

  return true;
}

/**
 * Widerruf: Messung sofort abschalten, ohne Neuladen der Seite.
 *
 * Das Skript-Tag lässt sich nicht zurücknehmen — geladener Code bleibt geladen.
 * Wirksam ist deshalb das `consent update` auf `denied`: gtag.js hört danach
 * auf, Kennungen zu setzen oder Ereignisse mit Kennung zu senden. Zusätzlich
 * werden die von GA4 gesetzten Cookies gelöscht, damit keine Kennung
 * zurückbleibt, der niemand mehr zugestimmt hat (Wurzel 1: die Aktion hat einen
 * Gegenzustand, und der ist hier das gesetzte Cookie).
 */
export function analyticsWiderrufen(): void {
  if (typeof window === "undefined") return;
  if (!window.gtag && !document.getElementById(SKRIPT_ID)) return;
  gtagVorbereiten()("consent", "update", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
  });
  // Merker zurücksetzen: wer erneut zustimmt, beginnt eine neue Messung, und
  // die Seite, auf der das passiert, muss wieder zählen dürfen.
  letzterPfad = null;
  ga4CookiesLoeschen();
}

/**
 * Löscht die Cookies, die GA4 gesetzt hat: `_ga` (Client-Kennung) und
 * `_ga_<STROM>` (Sitzungsstand).
 *
 * Die Domain-Logik und die laute Meldung bei Rückstand liegen in
 * `lib/cookie-loeschen.ts` — dieselbe Aufgabe hat der Spamschutz auch.
 */
function ga4CookiesLoeschen(): void {
  cookiesLoeschen(
    (name) => name === "_ga" || name.startsWith("_ga_"),
    "analytics",
  );
}

/**
 * Der zuletzt gemeldete Pfad. Verhindert, dass dieselbe Seite zweimal gezählt
 * wird — der Zähler muss idempotent sein, nicht nur „normalerweise einmal".
 *
 * Zwei Wege führen real zum Doppelaufruf, beide gemessen am 26.08.2026:
 *   · React StrictMode montiert Effekte in der ENTWICKLUNG doppelt
 *     (`reactStrictMode: true` in next.config.ts) — eine Seitenladung erzeugte
 *     `["/preise", "/preise"]` in der dataLayer.
 *   · `analyticsStarten` meldet den Aufruf der Seite nach, auf der zugestimmt
 *     wurde; ohne Sperre käme dort ein zweiter dazu.
 * Ein Zähler, der von einer Build-Einstellung abhängt, ist kein Zähler: die
 * Zahlen wären in der Entwicklung doppelt und in Produktion einfach, und keiner
 * der beiden Werte ließe sich prüfen.
 */
let letzterPfad: string | null = null;

/**
 * Meldet einen Seitenwechsel — höchstens EINEN je Pfad.
 *
 * Im App Router gibt es keinen Vollaufruf pro Seite; gtag.js feuert von sich
 * aus keinen `page_view` (`send_page_view: false`), also ist dies die einzige
 * Quelle. Ohne sie hätte die Einstiegsseite alle Zugriffe und jede Unterseite
 * null.
 */
export function seitenaufrufMelden(pfad: string): void {
  if (typeof window === "undefined") return;
  if (!GA_MEASUREMENT_ID) return;
  if (!istErlaubt("analytisch")) return;
  if (pfad === letzterPfad) return;
  letzterPfad = pfad;
  window.gtag?.("event", "page_view", {
    page_path: pfad,
    page_location: window.location.href,
    page_title: document.title,
  });
}
