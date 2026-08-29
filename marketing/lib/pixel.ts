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
// Ohne konfigurierte Kennung lädt kein Skript — auch mit Einwilligung. Eine
// erfundene Kennung würde Daten an ein fremdes Konto schicken (Wurzel 4).
//
// EINE AUSNAHME, UND SIE IST DER PUNKT: die WERBE-EINWILLIGUNG geht immer an
// Google, auch ohne jede Kennung (`werbeEinwilligungMelden`). Sie ist ein
// Zustand des BESUCHERS, kein Merkmal unserer Konten — dass wir zufällig kein
// Google-Ads-Konto haben, ändert nichts daran, dass er zugestimmt hat.
// Bis zum 29.08.2026 hing sie am `if (!GOOGLE_ADS_ID) return;` von
// `adsStarten`, und `GOOGLE_ADS_ID` ist leer. Live gemessen an diesem Tag:
// Besucher klickt „Alle annehmen", alle drei Kategorien stehen auf `true` —
// und der GA4-Treffer an region1.google-analytics.com/g/collect trug trotzdem
// `gcs=G101`, also `ad_storage=denied`. In der dataLayer stand kein einziges
// `consent update` mit `ad_storage: granted`, und GA4 meldete unter
// Verwaltung → Einwilligungseinstellungen für alle drei Werbe-Parameter
// „Einwilligungssignale für Werbung inaktiv". Es sah funktionierend aus und
// war stumm — dieselbe Klasse wie ein verschlucktes Kontroll-Signal (Wurzel 5).
//
// KEIN `<noscript>`-Zaehlbild. Metas Vorlage enthaelt eines, und hier stand es
// bis zum 27.08.2026 — per JavaScript angelegt, damit es die Einwilligung
// respektiert. Damit war es sinnlos und schaedlich zugleich: sinnlos, weil ein
// Bild, das JavaScript anlegt, genau dann fehlt, wenn JavaScript aus ist (sein
// einziger Zweck); schaedlich, weil es bei eingeschaltetem JavaScript
// ZUSAETZLICH zum regulaeren Treffer feuerte. Live gemessen an diesem Tag:
// jeder Seitenaufruf sendete ZWEI `ev=PageView` an dieselbe Pixel-ID (das Bild
// nach 1427 ms, der echte Treffer nach 2331 ms) — Meta zaehlte also jede Seite
// doppelt, und der Bild-Treffer trug nur IP und User-Agent, weshalb Meta ihn
// als „Selbstdefinierte Event" statt als Standard-PageView fuehrte.
// Wer das Bild wieder einbaut, verdoppelt die Zahlen erneut.
import { gtagVorbereiten } from "@/lib/analytics";
import {
  GOOGLE_ADS_ID,
  LINKEDIN_PARTNER_ID,
  META_PIXEL_ID,
} from "@/lib/config";
import { cookiesLoeschen } from "@/lib/cookie-loeschen";
import { istErlaubt } from "@/lib/einwilligung";

const META_ID = "nd-meta-pixel";
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
    // MUSS das `arguments`-Objekt schieben, NICHT ein Array davon — dieselbe
    // Regel wie beim gtag-Stub in lib/analytics.ts, wo genau dieser Fehler
    // live dafuer sorgte, dass kein einziger Treffer hinausging. Hier stand
    // `f.queue?.push(args)` mit einem Rest-Parameter, also einem ECHTEN Array.
    // Metas Vorlage lautet wortgleich
    // `n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)`
    // (developers.facebook.com/docs/meta-pixel/get-started).
    //
    // Warum es trotzdem nie aufgefallen ist: fbevents.js arbeitet die
    // Warteschlange mit `apply` ab, und `apply` nimmt ein Array genauso wie
    // ein `arguments`-Objekt. Der Fehler war also latent, nicht wirksam. Er
    // wird hier behoben, weil `fbq.push` (siehe unten) ohne ihn falsch liegt
    // und weil eine Vorlage, von der man ohne Not abweicht, beim naechsten
    // Umbau der Bibliothek zur Falle wird.
    const f: Fbq = function () {
      // Beim DIREKTEN Aufruf ist die Form gleichgueltig: `callMethod` bekommt
      // einzelne Argumente, ob per `apply` oder per Spread. Entscheidend ist
      // die Warteschlange darunter — dort MUSS das `arguments`-Objekt liegen.
      // eslint-disable-next-line prefer-rest-params -- fbevents.js verlangt IArguments
      if (f.callMethod) f.callMethod(...(arguments as unknown as unknown[]));
      // eslint-disable-next-line prefer-rest-params -- s. o.
      else f.queue?.push(arguments);
    } as Fbq;
    f.queue = [];
    f.loaded = true;
    f.version = "2.0";
    // Metas Vorlage setzt `n.push = n`. Fremde Einbindungen (Tag-Manager,
    // Partner-Snippets) rufen `fbq.push(...)` statt `fbq(...)`; ohne diese
    // Zeile waere das Array-`push` von `f.queue` gemeint und der Aufruf
    // verschwaende sich in einer Warteschlange, die niemand mehr leert.
    f.push = f;
    window.fbq = f;
    window._fbq = f;
  }
  skript(META_ID, "https://connect.facebook.net/en_US/fbevents.js");
  // Einwilligung ausdruecklich erteilen. Wir sind an dieser Stelle nur, WEIL
  // „marketing" erlaubt ist (pixelStarten prueft das). Metas Vorgabe ist
  // `grant` nach der Zustimmung; ohne den Aufruf gilt der Standard, der zwar
  // ebenfalls erlaubt, aber nach einem vorangegangenen `revoke` (siehe
  // pixelWiderrufen) gesperrt BLEIBT. Genau das ist der Fall, wenn jemand
  // widerruft und im selben Besuch wieder zustimmt.
  window.fbq?.("consent", "grant");
  window.fbq?.("init", META_PIXEL_ID);
  window.fbq?.("track", "PageView");
}

/**
 * Meldet ein Meta-Standard-Event — der EINZIGE Weg, ein Ereignis an den Pixel
 * zu geben. Aufrufer nennen nur den Namen, nicht `window.fbq`.
 *
 * Fail-closed wie der Start: ohne Einwilligung „marketing" und ohne Kennung
 * passiert nichts. Die Prüfung steht hier und nicht bei den Aufrufern, damit
 * niemand sie vergessen kann — ein Formular, das nach dem Widerruf noch ein
 * Event schiebt, wäre derselbe Fehler wie ein Skript ohne Zustimmung.
 *
 * Läuft der Pixel noch nicht (jemand hat zugestimmt, aber diese Datei hat
 * `metaStarten` in diesem Tab nie ausgeführt), wird er hier gestartet. Sonst
 * ginge das erste Event verloren, und genau das erste ist die Conversion.
 *
 * `window.fbq` existiert nach `metaStarten` immer — die Warteschlange nimmt
 * Aufrufe an, bevor fbevents.js geladen ist, und arbeitet sie danach ab.
 *
 * Nur STANDARD-Events, keine selbstdefinierten: `track` erwartet einen Namen
 * aus Metas Katalog (Lead, Contact, CompleteRegistration, …). Ein Tippfehler
 * käme in Metas Oberfläche als „Selbstdefinierte Event" an und wäre für
 * Kampagnen-Optimierung wertlos — deshalb ist der Typ eine Aufzählung und
 * kein `string`.
 */
export type MetaEreignis =
  | "Lead"
  | "Contact"
  | "CompleteRegistration"
  | "ViewContent";

export function pixelEreignisMelden(
  ereignis: MetaEreignis,
  parameter?: Record<string, unknown>,
): boolean {
  if (typeof window === "undefined") return false;
  if (!META_PIXEL_ID) return false;
  if (!istErlaubt("marketing")) return false;
  metaStarten();
  if (parameter) window.fbq?.("track", ereignis, parameter);
  else window.fbq?.("track", ereignis);
  return true;
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
 * Google Ads (Conversion-Tracking). Nutzt dasselbe gtag.js wie die Messung.
 *
 * CONSENT MODE V2 — DIE VORGABE MUSS AUCH HIER STEHEN. Sie wird zwar in
 * lib/analytics.ts gesetzt, aber nur dann, wenn „Analytisch" erlaubt ist. Wer
 * ausschließlich „Marketing" erlaubt, lässt `analyticsStarten` nie laufen: dann
 * lud Google Ads sein gtag.js OHNE vorheriges `consent default` — und ein
 * gtag.js ohne Vorgabe kennt den Einwilligungsmodus nicht, verarbeitet also
 * ungebremst. Genau der Reihenfolgefehler, den Googles Doku beschreibt
 * („Wenn Ihr Einwilligungscode in der falschen Reihenfolge aufgerufen wird,
 * funktionieren die Standardeinstellungen für die Einwilligung nicht").
 *
 * Die Vorgabe ist idempotent: setzt lib/analytics.ts sie zuerst, ist der
 * zweite Aufruf mit denselben Werten folgenlos. Sie zu VERPASSEN ist der
 * teure Fehler, nicht sie doppelt zu senden.
 */
function adsStarten(): void {
  if (!GOOGLE_ADS_ID) return;
  // Der Stub kommt aus lib/analytics.ts — hier stand bis zum 29.08.2026 eine
  // wortgleiche Kopie. Zwei Kopien heißen zwei Stellen, an denen die
  // `arguments`-Regel stimmen muss; die Begründung dazu steht dort einmal
  // ausführlich und gehört nicht ein zweites Mal hierher.
  const gtag = gtagVorbereiten();

  // 1) Vorgabe VOR dem Skript — alles verweigert, damit der Einwilligungsmodus
  //    überhaupt aktiv ist. `analytics_storage` bleibt hier `denied`: darüber
  //    entscheidet allein lib/analytics.ts, sonst würde die Marketing-Zusage
  //    stillschweigend die Messung mitschalten.
  //
  //    Genau WEIL hier eine Vorgabe mit `denied` steht, sendet `pixelStarten`
  //    die Werbe-Einwilligung NACH dieser Funktion und nicht davor: ein
  //    `consent default` nach einem `update` ist bei Google nicht vorgesehen,
  //    und ein Zustandssetzer, dessen Wirkung von der Reihenfolge zweier
  //    Funktionsaufrufe abhängt, ist eine Falle für den nächsten Umbau.
  gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
  });

  // 2) Keine Kennungen über URL-Parameter (siehe lib/analytics.ts).
  //    `ads_data_redaction` wird hier NICHT gesetzt, und die Arbeitsteilung
  //    dazu stand bis zum 29.08.2026 falsch im Kommentar („lib/analytics.ts
  //    setzt es"): nachgezählt setzt es components/google-tag.tsx, EINMAL im
  //    `<head>`, zusammen mit der Vorgabe und vor jedem Tag. Das ist auch der
  //    einzig richtige Ort — die Einstellung wirkt laut Google nur, solange
  //    `ad_storage` verweigert ist, also genau in dem Zustand, in dem weder
  //    diese Datei noch lib/analytics.ts überhaupt etwas tun.
  gtag("set", "url_passthrough", false);

  skript(
    ADS_ID,
    `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GOOGLE_ADS_ID)}`,
  );

  // `js` ist PFLICHT, nicht Zierde: der Befehl startet die Bibliothek (er
  // erzeugt das `gtm.js`-Ereignis mit dem Startzeitstempel). Fehlt er, laedt
  // gtag.js und sendet KEINEN EINZIGEN Treffer — nachgemessen am 27.08.2026 in
  // einem echten Browser gegen Googles Server: mit `js` ein Treffer, ohne `js`
  // null. Er fehlte hier, was erst beim ersten Google-Ads-Einsatz aufgefallen
  // waere, und zwar als genau dasselbe stumme Symptom wie bei der Messung.
  // lib/analytics.ts setzt ihn ebenfalls; doppelt ist folgenlos, fehlend nicht.
  gtag("js", new Date());

  // 3) Das Ads-Konto konfigurieren. Die Werbe-Einwilligung stand bis zum
  //    29.08.2026 HIER, drei Zeilen darüber — und damit hinter dem
  //    `if (!GOOGLE_ADS_ID) return;` am Anfang dieser Funktion. Sie ist nach
  //    `pixelStarten` gewandert, wo sie hingehört; die Messung im Kopf dieser
  //    Datei sagt, was das gekostet hat.
  gtag("config", GOOGLE_ADS_ID);
}

/**
 * Meldet Google die WERBE-Einwilligung des Besuchers — die drei Parameter des
 * Consent Mode v2 auf `granted`.
 *
 * Das ist ein Zustand des Besuchers, kein Merkmal unserer Konten: er gilt
 * unabhängig davon, ob ein Google-Ads-Konto (`GOOGLE_ADS_ID`) oder ein
 * Meta-Pixel (`META_PIXEL_ID`) eingerichtet ist. Deshalb hat diese Funktion
 * KEINE Kennungs-Prüfung — jede wäre wieder der Fehler vom 29.08.2026.
 *
 * Wirksam wird sie über das gtag.js der MESSUNG (components/google-tag.tsx),
 * das auf jeder Seite lädt: dessen Treffer trägt den Einwilligungsstand als
 * `gcs`-Parameter mit. Ohne dieses Update sendet GA4 dauerhaft `gcs=G101` und
 * meldet die Werbe-Signale als inaktiv.
 *
 * Idempotent: `consent update` ist ein Zustandssetzer, kein Ereignis. Ihn
 * mehrfach mit demselben Wert zu senden ist folgenlos, ihn zu VERPASSEN ist
 * der teure Fehler — dieselbe Abwägung wie bei `analyticsStarten`.
 *
 * Die Einwilligungsprüfung steht beim einzigen Aufrufer (`pixelStarten`), weil
 * dort auch der Gegenzustand hängt (`pixelWiderrufen`). Wer diese Funktion von
 * einer zweiten Stelle aus ruft, prüft `istErlaubt("marketing")` selbst.
 */
function werbeEinwilligungMelden(): void {
  gtagVorbereiten()("consent", "update", {
    ad_storage: "granted",
    ad_user_data: "granted",
    ad_personalization: "granted",
  });
}

/**
 * Startet alle konfigurierten Werbe-Pixel, wenn „marketing" erlaubt ist, und
 * meldet Google in JEDEM Fall die Werbe-Einwilligung.
 *
 * Rückgabe sagt, ob ein PIXEL läuft — für Tests und Diagnose, nicht für
 * Steuerungslogik. Sie sagt bewusst NICHT, ob die Einwilligung gemeldet wurde:
 * das passiert immer, sobald „marketing" erlaubt ist, und genau diese zwei
 * Dinge wurden hier bis zum 29.08.2026 verwechselt. Mehrfache Aufrufe sind
 * harmlos: die Skript-Tags entstehen genau einmal (Prüfung über die
 * Element-ID), das `consent update` ist idempotent.
 */
export function pixelStarten(): boolean {
  if (typeof window === "undefined") return false;
  if (!istErlaubt("marketing")) return false;
  metaStarten();
  linkedinStarten();
  adsStarten();
  // NACH `adsStarten`, nicht davor: die Funktion setzt eine `consent default`
  // mit `denied`, und eine Vorgabe nach einem Update ist bei Google nicht
  // vorgesehen. In dieser Reihenfolge steht die Vorgabe immer zuerst — und
  // wenn `adsStarten` mangels Kennung gar nichts tut, hat
  // components/google-tag.tsx die Vorgabe längst im `<head>` gesetzt.
  werbeEinwilligungMelden();
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
  // Meta ausdruecklich sperren. Das geladene fbevents.js laesst sich nicht
  // zurueckholen, aber `revoke` haelt es an: es sendet danach nichts mehr und
  // setzt `_fbp` nicht neu. Ohne diesen Aufruf raeumte der Widerruf nur die
  // Cookies, und das naechste Ereignis (ein Formular, ein zweiter Tab) hat sie
  // sofort wieder angelegt — der Widerruf waere eine Attrappe gewesen
  // (Wurzel 1: jede Aktion braucht ihren Gegenzustand).
  window.fbq?.("consent", "revoke");
  // `gtagVorbereiten()` statt `window.gtag?.(…)`: der Widerruf muss auch dann
  // ankommen, wenn in diesem Tab NIE ein Pixel lief. Mit dem `?.` hing er an
  // der Frage, ob irgendjemand vorher `window.gtag` angelegt hat — das tut
  // components/google-tag.tsx zwar auf jeder Seite, aber nur solange eine
  // Mess-ID gesetzt ist. Ohne sie verschluckte das `?.` den Widerruf wortlos,
  // während `cookiesLoeschen` darunter weiterlief und alles erledigt aussah
  // (Wurzel 5). Der Gegenzustand darf nicht schwächer abgesichert sein als die
  // Aktion — und die Aktion (`werbeEinwilligungMelden`) geht ebenfalls immer.
  gtagVorbereiten()("consent", "update", {
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
