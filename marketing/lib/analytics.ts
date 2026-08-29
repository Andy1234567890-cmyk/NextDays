// GA4-Reichweitenmessung: Einwilligungsstand und Seitenaufrufe.
//
// DAS TAG LÄDT HIER NICHT. Es steht seit dem 27.08.2026 im Layout
// (components/google-tag.tsx) und lädt auf jeder Seite im Verweigerungs-Modus
// („Advanced Consent Mode"), weil Googles Anleitung das für den EWR so vorgibt
// und weil Googles Prüfwerkzeuge ein erst nach dem Klick nachgeladenes Tag
// grundsätzlich nicht finden. Die Begründung samt Datenschutz-Abwägung steht
// dort, nicht hier doppelt.
//
// Diese Datei hat danach drei Aufgaben:
//   · `analyticsStarten` / `analyticsWiderrufen` — den Einwilligungsstand an
//     Google melden (`consent update`) und beim Widerruf die Cookies räumen.
//   · `seitenaufrufMelden` — der EINZIGE Zähler. Das Tag ist mit
//     `send_page_view: false` konfiguriert, weil der App Router keinen
//     Vollaufruf pro Seite macht; ohne diese Funktion hätte die Einstiegsseite
//     alle Zugriffe und jede Unterseite null.
//   · `ereignisMelden` — der EINZIGE Weg, ein GA4-Ereignis zu senden. Bis zum
//     29.08.2026 kannte die ganze Marketing-App genau EIN Ereignis
//     (`page_view`); der Betreiber sah, welche Seite jemand aufruft, aber
//     nicht, was er dort tut.
//
// Und sie hält `gtagVorbereiten` — den einen idempotenten Weg zu
// `window.gtag`. lib/pixel.ts benutzt IHN und baut sich keinen zweiten Stub:
// zwei Stubs sind zwei Stellen, an denen die `arguments`-Regel (siehe unten)
// stimmen muss, und genau dieser Fehler war am 27.08.2026 in einer Kopie
// behoben und in der anderen noch drin.
//
// Die drei Werbe-Parameter werden hier NIE auf `granted` gesetzt — dafür ist
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
 *
 * Exportiert, weil lib/pixel.ts denselben Weg braucht (Google Ads und die
 * Werbe-Einwilligung laufen über dasselbe gtag.js). Dort stand bis zum
 * 29.08.2026 eine wortgleiche Kopie dieses Stubs — eine zweite Stelle, an der
 * die `arguments`-Regel unten stimmen muss, und damit die nächste Gelegenheit
 * für genau den Fehler, der am 27.08.2026 jeden Treffer verschluckte.
 * KEINE dritte Kopie: wer `window.gtag` braucht, ruft diese Funktion.
 */
export function gtagVorbereiten(): (...args: GtagArgumente) => void {
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
  // Eingeplante, aber noch nicht gesendete Ereignisse fallen lassen — VOR der
  // Ausstiegsprüfung darunter, weil eine wartende Uhr auch dann läuft, wenn
  // gtag.js gar nicht da ist. `ereignisMelden` prüft die Einwilligung beim
  // Auslösen zwar erneut; die Uhr trotzdem abzuräumen ist der Gegenzustand
  // (Wurzel 1), statt sich auf die zweite Prüfung zu verlassen.
  for (const uhr of drosselUhren.values()) clearTimeout(uhr);
  drosselUhren.clear();
  if (!window.gtag && !document.getElementById(SKRIPT_ID)) return;
  // NUR `analytics_storage`. Bis zum 29.08.2026 setzte diese Funktion alle vier
  // Parameter auf `denied` — auch die drei Werbe-Parameter, für die sie nicht
  // zuständig ist. Solange beide Zwecke gemeinsam widerrufen wurden, fiel das
  // nicht auf; sobald aber „Marketing" erlaubt bleibt und nur „Analytisch"
  // widerrufen wird, nahm dieser Aufruf dem Besucher eine Einwilligung weg, die
  // er gerade erteilt hat. Der Gegenzustand der Werbe-Parameter gehört zu
  // `pixelWiderrufen` (Wurzel 1: wer setzt, pflegt — und nur, was er setzt).
  gtagVorbereiten()("consent", "update", {
    analytics_storage: "denied",
  });
  // Merker zurücksetzen: wer erneut zustimmt, beginnt eine neue Messung, und
  // die Seite, auf der das passiert, muss wieder zählen dürfen.
  letzterAufruf = null;
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
 * Der zuletzt gemeldete Aufruf, als `sprache|pfad`. Verhindert, dass dieselbe
 * Seite zweimal gezählt wird — der Zähler muss idempotent sein, nicht nur
 * „normalerweise einmal".
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
 *
 * Die SPRACHE gehört in den Schlüssel, nicht nur der Pfad. Diese App hat KEIN
 * Sprachpräfix in der URL (next.config.ts: „die Sprache kommt aus dem
 * nd_locale-Cookie"); ein Sprachwechsel setzt das Cookie und ruft
 * `router.refresh()`, wobei der Pfad gleich bleibt. Mit dem Pfad allein als
 * Schlüssel war der Wechsel deshalb unsichtbar: gemessen am 27.08.2026 sendete
 * ein Wechsel von Deutsch auf Griechisch auf `/preise` keinen einzigen Treffer.
 */
let letzterAufruf: string | null = null;

/**
 * Die Sprache der gerenderten Seite, aus `<html lang>` (layout.tsx:107 setzt
 * dort den next-intl-Locale).
 *
 * Nur als Rückfallweg für Aufrufer ohne React-Kontext (`analyticsStarten`, und
 * jeder Aufrufer von `ereignisMelden`, der keinen `useLocale()` zur Hand hat —
 * ein Klick-Handler tief in einer Komponente etwa).
 * Fehlt das Attribut, ist die Rückgabe `undefined` und der Treffer trägt keinen
 * Sprachparameter — NIE ein erfundener Ersatzwert wie „de" (Wurzel 4): eine
 * falsche Sprache in der Auswertung ist schlimmer als gar keine, weil sie
 * niemand als Fehler erkennt.
 */
function spracheAusDokument(): string | undefined {
  const lang = document.documentElement.lang.trim();
  return lang === "" ? undefined : lang;
}

/**
 * Meldet einen Seitenwechsel — höchstens EINEN je Pfad und Sprache.
 *
 * Im App Router gibt es keinen Vollaufruf pro Seite; gtag.js feuert von sich
 * aus keinen `page_view` (`send_page_view: false`), also ist dies die einzige
 * Quelle. Ohne sie hätte die Einstiegsseite alle Zugriffe und jede Unterseite
 * null.
 *
 * `sprache` übergibt die aufrufende Komponente aus `useLocale()`. Sie NICHT
 * hier aus dem DOM zu lesen ist Absicht: nach `router.refresh()` steht der neue
 * Locale im React-Baum, bevor `<html lang>` neu gesetzt ist — wer das Dokument
 * fragt, misst je nach Reihenfolge die alte Sprache.
 */
export function seitenaufrufMelden(pfad: string, sprache?: string): void {
  if (typeof window === "undefined") return;
  if (!GA_MEASUREMENT_ID) return;
  if (!istErlaubt("analytisch")) return;

  const gemeldeteSprache = sprache ?? spracheAusDokument();
  const aufruf = `${gemeldeteSprache ?? ""}|${pfad}`;
  if (aufruf === letzterAufruf) return;

  // `gtagVorbereiten()` statt `window.gtag?.(…)`: das optionale Aufrufen war
  // ein stiller Verlust. Blockt ein Inhaltsfilter `gtag/js`, bleibt der
  // Inline-Stub aus components/google-tag.tsx zwar bestehen — steht `gtag` aus
  // irgendeinem Grund aber NICHT, verschluckte das `?.` den Treffer wortlos,
  // während der Merker darüber schon auf „gezählt" stand. Diese Reihenfolge ist
  // deshalb umgedreht: erst einreihen, DANN merken (Wurzel 5 — nichts still als
  // erledigt markieren, was nie passiert ist).
  const gtag = gtagVorbereiten();
  gtag("event", "page_view", {
    page_path: pfad,
    page_location: window.location.href,
    page_title: document.title,
    // Ohne diesen Parameter sind die 24 Sprachfassungen in der Auswertung
    // NICHT unterscheidbar: `page_path`, `page_location` und `page_title` sind
    // für die deutsche und die griechische Preisseite identisch, weil die URL
    // keine Sprache trägt. `language`/`ul` im Treffer ist die BROWSER-Sprache
    // des Besuchers, nicht die ausgelieferte Fassung — beides fällt regelmäßig
    // auseinander (griechischer Browser, Seite auf Englisch).
    // In GA4 dafür eine benutzerdefinierte Dimension auf `sprache` anlegen.
    ...(gemeldeteSprache === undefined ? {} : { sprache: gemeldeteSprache }),
  });
  letzterAufruf = aufruf;
}

/**
 * Die erlaubten GA4-Ereignisse dieser App — der ganze Katalog.
 *
 * Eine Aufzählung statt `string`, aus demselben Grund wie `MetaEreignis` in
 * lib/pixel.ts: ein Vertipper wäre in GA4 kein Fehler, sondern ein NEUES
 * Ereignis. Es erscheint als eigene Zeile im Bericht, die Zahlen fehlen der
 * richtigen Zeile, und nichts meldet sich. GA4 zählt zudem höchstens 500
 * verschiedene Ereignisnamen je Property, und ein einmal angelegter Name lässt
 * sich nicht löschen — jeder Vertipper verbraucht einen davon dauerhaft.
 *
 * snake_case, weil GA4 es so führt (`page_view`, `sign_up`, `purchase`).
 * Deutsche Namen sind Absicht: die Auswertung liest der Betreiber, nicht
 * Google, und ein halb englischer Katalog wäre nur eine weitere Frage
 * („heißt es jetzt cta_click oder cta_klick?").
 *
 * WICHTIG für den Betrieb: die Parameter (`ziel`, `quelle`, `thema`, …) sind in
 * den Standardberichten NICHT sichtbar, solange in GA4 unter Verwaltung →
 * Benutzerdefinierte Definitionen keine Dimension darauf angelegt ist —
 * dasselbe gilt für `sprache` am `page_view`. Das Ereignis wird trotzdem
 * gezählt; nur die Aufschlüsselung fehlt.
 */
export type Ga4Ereignis =
  // Klick auf einen Haupt-Handlungsknopf (Voranmelden, Demo, Preise ansehen).
  // Parameter: `ziel` (wohin der Knopf führt), `stelle` (wo er stand — Kopf,
  // Held, Fußzeile). Ohne `stelle` ist nicht unterscheidbar, ob der Knopf im
  // Seitenkopf oder der am Seitenende zieht, und genau das entscheidet, wo der
  // nächste hingehört.
  | "cta_klick"
  // Voranmeldung erfolgreich abgeschickt — die eigentliche Conversion dieser
  // Seite. Parameter: `quelle` (welches Formular/Popup). Meta bekommt dasselbe
  // Ereignis als `Lead` (lib/pixel.ts); die beiden Zahlen dürfen auseinander
  // laufen, weil die Einwilligungen getrennt sind (analytisch ≠ marketing).
  | "voranmeldung"
  // Kontaktformular erfolgreich abgeschickt. Parameter: `thema` — die Auswahl
  // steuert serverseitig den Empfänger (info@/developer@), also ist sie die
  // interessante Aufschlüsselung.
  | "kontakt_gesendet"
  // Double-Opt-in bestätigt (/newsletter/bestaetigen). Kein Parameter: die
  // Seite kennt nur das Token, und das gehört nirgends in eine Auswertung.
  | "newsletter_bestaetigt"
  // Sprachumschalter benutzt. Parameter: `von`, `zu`. Der `page_view` trägt
  // zwar die Sprache, sagt aber nicht, dass jemand GEWECHSELT hat — und ein
  // Wechsel weg von der ausgelieferten Fassung ist die Aussage, dass die
  // Spracherkennung danebenlag.
  | "sprache_gewechselt"
  // Support-Chat geöffnet. Zählt den Bedarf an Rückfragen je Seite; die
  // Seite steht im `page_view` davor, nicht als Parameter hier.
  | "chat_geoeffnet"
  // Das Voranmelde-Popup ging auf. Parameter: `quelle` (was es ausgelöst hat).
  // Erst zusammen mit `voranmeldung` ergibt das eine Quote — ein Popup ohne
  // Öffnungszahl lässt nicht erkennen, ob es nicht gezeigt wird oder nicht
  // überzeugt.
  | "popup_geoeffnet"
  // Eine Frage im FAQ-Block aufgeklappt. Parameter: `frage` (der Schlüssel,
  // nicht der übersetzte Text — sonst ist dieselbe Frage in 24 Sprachen 24
  // verschiedene Werte).
  | "faq_geoeffnet"
  // Objektanzahl im Preisrechner verändert. Parameter: `anzahl`. Siehe die
  // Drossel unten — dieses Ereignis ist das einzige, das ohne sie flutet.
  | "preis_geaendert";

/**
 * Parameter eines Ereignisses.
 *
 * `string | number`, nicht `unknown`: GA4 nimmt nur flache Werte an.
 * Verschachtelte Objekte und Arrays verwirft es beim Empfang STILL — der
 * Treffer geht hinaus, das Ereignis wird gezählt, der Parameter fehlt einfach.
 * Ein Typ, der das verbietet, ist billiger als die Suche danach.
 */
export type Ga4Parameter = Record<string, string | number>;

/**
 * Wie lange dieses Ereignis Ruhe abwarten muss, bevor es hinausgeht (ms).
 *
 * NUR `preis_geaendert` steht hier. Es hängt an einem Zahlenfeld: wer von 1 auf
 * 25 geht, erzeugt beim Tippen `2`, `25` — und über die Pfeiltasten oder einen
 * Schieberegler ein Dutzend Zwischenwerte, von denen keiner eine Absicht ist.
 * Ohne Drossel wäre die häufigste „Handlung" auf der Preisseite ein
 * Tastendruck.
 *
 * DIE DROSSEL SITZT HIER UND NICHT BEIM AUFRUFER. Dieselbe Begründung wie bei
 * den Einwilligungs-Wächtern darüber: was der Aufrufer selbst tun muss, vergisst
 * der übernächste Aufrufer. Und sie gehört an den NAMEN, nicht an die Stelle —
 * wenn der Preisrechner ein zweites Mal eingebaut wird (Startseite und
 * Preisseite), gilt sie dort ohne Zutun.
 *
 * Alle anderen Ereignisse laufen bewusst UNGEDROSSELT und ohne Idempotenz-
 * Sperre: anders als `page_view` sind das Handlungen, kein Zustand. Zwei Klicks
 * auf denselben Knopf sind zwei Ereignisse — wer sie zusammenfasst, misst
 * Zögern als Entschlossenheit.
 */
const DROSSEL_MS: Partial<Record<Ga4Ereignis, number>> = {
  // 600 ms: länger als eine Tippfolge, kürzer als eine Denkpause.
  preis_geaendert: 600,
};

/** Laufende Drossel-Uhren je Ereignis — die letzte gewinnt. */
const drosselUhren = new Map<Ga4Ereignis, ReturnType<typeof setTimeout>>();

/**
 * Reiht das Ereignis wirklich ein. Ohne Wächter — die stehen in
 * `ereignisMelden`, und der verzögerte Pfad prüft sie erneut.
 */
function ereignisSenden(
  name: Ga4Ereignis,
  parameter: Ga4Parameter | undefined,
  sprache: string | undefined,
): void {
  // `gtagVorbereiten()` statt `window.gtag?.(…)` — dieselbe Begründung wie in
  // `seitenaufrufMelden`: das optionale Aufrufen verschluckt den Treffer
  // wortlos, wenn `gtag` wider Erwarten fehlt.
  const gtag = gtagVorbereiten();
  gtag("event", name, {
    ...parameter,
    // Die Sprache ZULETZT, damit sie ein gleichnamiger Parameter nicht
    // überschreibt: sie ist die gerenderte Fassung und keine Meinung des
    // Aufrufers. Fehlt sie, geht der Parameter GAR NICHT mit — nie ein
    // erfundenes „de" (Wurzel 4).
    ...(sprache === undefined ? {} : { sprache }),
  });
}

/**
 * Meldet ein GA4-Ereignis — der EINZIGE Weg dorthin, so wie
 * `pixelEreignisMelden` es für Meta ist. Aufrufer nennen nur den Namen, nie
 * `window.gtag`.
 *
 * Fail-closed und mit denselben drei Wächtern wie `seitenaufrufMelden`: kein
 * `window`, keine Mess-ID, keine Einwilligung „analytisch" → nichts geht
 * hinaus. Die Prüfung steht HIER und nicht bei den Aufrufern, damit niemand sie
 * vergessen kann — ein Knopf, der nach dem Widerruf noch zählt, wäre derselbe
 * Fehler wie ein Skript ohne Zustimmung.
 *
 * `sprache` übergibt die aufrufende Komponente aus `useLocale()`, genau wie bei
 * `seitenaufrufMelden` und aus demselben Grund: nach `router.refresh()` steht
 * der neue Locale im React-Baum, bevor `<html lang>` ihn trägt. Wer keinen
 * React-Kontext hat, lässt das Argument weg und bekommt den Wert aus dem
 * Dokument.
 *
 * Rückgabe: `true` heißt ANGENOMMEN, nicht „bereits gesendet" — bei einem
 * gedrosselten Ereignis (siehe `DROSSEL_MS`) ist es zu diesem Zeitpunkt erst
 * eingeplant. Der Wert ist für Diagnose und Tests da, nicht für
 * Steuerungslogik; `false` heißt immer, dass einer der drei Wächter griff.
 */
export function ereignisMelden(
  name: Ga4Ereignis,
  parameter?: Ga4Parameter,
  sprache?: string,
): boolean {
  if (typeof window === "undefined") return false;
  if (!GA_MEASUREMENT_ID) return false;
  if (!istErlaubt("analytisch")) return false;

  const gemeldeteSprache = sprache ?? spracheAusDokument();

  const ruhe = DROSSEL_MS[name];
  if (ruhe !== undefined) {
    const laufend = drosselUhren.get(name);
    if (laufend !== undefined) clearTimeout(laufend);
    drosselUhren.set(
      name,
      setTimeout(() => {
        drosselUhren.delete(name);
        // Die Einwilligung ERNEUT prüfen. Zwischen Einplanen und Auslösen liegt
        // knapp eine Sekunde, und in der kann in diesem oder einem anderen Tab
        // widerrufen worden sein. Ein Ereignis, das an einem Widerruf
        // vorbeirutscht, weil es schon eingeplant war, wäre der fehlende
        // Gegenzustand (Wurzel 1) — und niemand sähe ihn.
        if (!istErlaubt("analytisch")) return;
        ereignisSenden(name, parameter, gemeldeteSprache);
      }, ruhe),
    );
    return true;
  }

  ereignisSenden(name, parameter, gemeldeteSprache);
  return true;
}
