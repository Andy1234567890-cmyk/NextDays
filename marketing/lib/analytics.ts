// GA4-Reichweitenmessung: Einwilligungsstand und Seitenaufrufe.
//
// DAS TAG LÄDT HIER NICHT. Es steht seit dem 27.08.2026 im Layout
// (components/google-tag.tsx) und lädt auf jeder Seite im Verweigerungs-Modus
// („Advanced Consent Mode"), weil Googles Anleitung das für den EWR so vorgibt
// und weil Googles Prüfwerkzeuge ein erst nach dem Klick nachgeladenes Tag
// grundsätzlich nicht finden. Die Begründung samt Datenschutz-Abwägung steht
// dort, nicht hier doppelt.
//
// Diese Datei hat danach zwei Aufgaben:
//   · `analyticsStarten` / `analyticsWiderrufen` — den Einwilligungsstand an
//     Google melden (`consent update`) und beim Widerruf die Cookies räumen.
//   · `seitenaufrufMelden` — der EINZIGE Zähler. Das Tag ist mit
//     `send_page_view: false` konfiguriert, weil der App Router keinen
//     Vollaufruf pro Seite macht; ohne diese Funktion hätte die Einstiegsseite
//     alle Zugriffe und jede Unterseite null.
//
// Die vier Werbe-Parameter werden hier NIE auf `granted` gesetzt — dafür ist
// lib/pixel.ts zuständig, und nur mit Einwilligung „marketing".
import { GA_MEASUREMENT_ID } from "@/lib/config";
import { cookiesLoeschen } from "@/lib/cookie-loeschen";
import { istErlaubt } from "@/lib/einwilligung";

const SKRIPT_ID = "nd-ga4";

type GtagArgumente = unknown[];

declare global {
  interface Window {
    // `IArguments`, weil der Stub das `arguments`-Objekt schiebt (siehe
    // `gtagVorbereiten`) und gtag.js selbst ebenfalls solche Einträge anlegt.
    dataLayer?: (GtagArgumente | IArguments)[];
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
    // MUSS das `arguments`-Objekt schieben, NICHT ein Array davon. Googles
    // Vorlage lautet wortgleich `function gtag(){dataLayer.push(arguments);}`
    // (developers.google.com/tag-platform/gtagjs/install?hl=de).
    //
    // Hier stand vorher `(...args) => dataLayer.push(args)`. Ein Rest-Parameter
    // ist ein ECHTES Array, `arguments` nur array-ARTIG — gtag.js unterscheidet
    // beides und behandelt ein echtes Array nicht als Befehl. Folge: die
    // Einträge landen sauber in der dataLayer, aber es geht KEIN Messtreffer an
    // Google. Genau so sah es live aus (27.08.2026): der Google Tag Assistant
    // fand das Tag und meldete „von diesem Tag wurden keine Treffer gesendet".
    // Der Kommentar an dieser Stelle beschrieb die Regel schon richtig, während
    // der Code darunter dagegen verstieß.
    //
    // `prefer-rest-params` ist deshalb hier bewusst abgeschaltet: die Regel
    // empfiehlt Rest-Parameter, aber genau die funktionieren an dieser Stelle
    // nicht. Eine Lint-Regel schlägt keine fremde Laufzeit-Vorgabe.
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params -- gtag.js verlangt IArguments
      window.dataLayer?.push(arguments);
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

  // Das Tag LÄDT HIER NICHT MEHR. Seit dem 27.08.2026 steht es im Layout
  // (components/google-tag.tsx) und lädt auf jeder Seite im Verweigerungs-
  // Modus, wie Googles Anleitung zum Einwilligungsmodus es vorgibt. Diese
  // Funktion hat nur noch eine Aufgabe: die Zustimmung nachziehen.
  //
  // Warum das die richtige Trennung ist: `consent update` ist ein
  // Zustandssetzer, kein Ereignis. Ihn mehrfach mit demselben Wert zu senden
  // ist folgenlos, ihn zu VERPASSEN ist der teure Fehler — also läuft er bei
  // jedem Aufruf. Vorher war beides in einer Funktion verschränkt, und ein
  // früher `return` beim schon geladenen Skript übersprang das Update: nach
  // Zustimmung, Widerruf und erneuter Zustimmung im selben Seitenaufruf stand
  // `analytics_storage` auf `denied`, während die Funktion `true` zurückgab.
  const gtag = gtagVorbereiten();
  gtag("consent", "update", { analytics_storage: "granted" });

  // Den Seitenaufruf melden, sobald zugestimmt wird. Erteilt jemand die
  // Zustimmung mitten im Besuch, hat der Effekt in
  // components/einwilligungs-dienste.tsx seinen `page_view` für diese Seite
  // längst abgeschickt — verworfen, weil damals nichts erlaubt war. Ohne diese
  // Zeile wäre die Seite, auf der zugestimmt wurde, die einzige ungezählte.
  //
  // Doppelt gezählt wird dabei nichts: `seitenaufrufMelden` sperrt denselben
  // Pfad über `letzterPfad`.
  seitenaufrufMelden(window.location.pathname + window.location.search);

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
