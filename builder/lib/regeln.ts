// Personalisierungs-Regeln im Browser auswerten (0440).
//
// WARUM IM BROWSER: Die Bedingungen sind Zustände des BESUCHERS — welches
// Gerät, wievielter Besuch, welche Uhrzeit, mit welchem Kampagnen-Parameter er
// kam. Der Server weiß davon nichts, und er soll es auch nicht wissen: das wäre
// ein Profil je Gast. Er liefert die Regeln aus, hier fällt die Entscheidung.
//
// Die einzige Ausnahme ist der ORT. Dafür braucht es die IP, und die hat nur
// der Server. Solange kein Geo-Dienst eingerichtet ist, RUHT eine Regel mit
// Ort-Bedingung — sie fällt nicht auf „trifft zu" zurück. Ein Angebot für
// Kopenhagen weltweit auszuspielen wäre schlimmer, als es gar nicht zu zeigen.

export type Ausloeser = {
  geraet?: "desktop" | "mobile";
  zeit?: {
    start_datum?: string | null;
    end_datum?: string | null;
    ganztags?: boolean;
    von?: string | null;
    bis?: string | null;
    zeitzone?: string;
    wiederholung?: "keine" | "taeglich" | "woechentlich" | "monatlich" | "jaehrlich";
  };
  besuche?: { modus: "first" | "min"; anzahl?: number };
  ort?: { land?: string | null; ort?: string | null; radius_km?: number };
  kampagne?: { parameter: Record<string, string>; exakt?: boolean };
};

export type Regel = {
  id: string;
  triggers: Ausloeser;
  action_type: "popup" | "top_bar" | "effect" | "script";
  action: Record<string, unknown>;
  seiten: string[];
  einmal_je_besucher: boolean;
  wieder_nach_tagen?: number | null;
};

export type RegelListe = { items: Regel[]; ort_verfuegbar: boolean };

/** Grenze zwischen „mobil" und „nicht mobil".
 *
 *  Dieselben 768 px, die Tailwind für `md:` benutzt und an denen die Website
 *  ohnehin umbricht. Zwei verschiedene Vorstellungen von „mobil" auf derselben
 *  Seite wären die Art Widerspruch, die niemand mehr findet. */
const MOBIL_BIS = 768;

/** Zähler und Zeitstempel des Besuchers.
 *
 *  Zwei Werte in EINEM Eintrag, wie bei Duda (dort zwei Cookies): die Zahl der
 *  Besuche und wann der letzte war. Ein Besuch zählt neu, wenn seit dem letzten
 *  mehr als 30 Minuten vergangen sind — sonst zählte jeder Seitenwechsel als
 *  eigener Besuch und „ab dem dritten Besuch" wäre nach zwei Klicks erreicht. */
const BESUCH_SCHLUESSEL = "nd-besuche";
const BESUCH_ABSTAND_MS = 30 * 60 * 1000;

export type Besuchsstand = { anzahl: number; zuletzt: number };

/** Liest den Besuchsstand und schreibt ihn fort.
 *
 *  Wirft nie: in einem privaten Fenster scheitert schon der Zugriff auf
 *  `localStorage`. Dann gilt „erster Besuch" — das ist der ehrliche Ausgang für
 *  jemanden, über den wir nichts wissen dürfen. */
export function besuchZaehlen(jetzt: number = Date.now()): Besuchsstand {
  const leer: Besuchsstand = { anzahl: 1, zuletzt: jetzt };
  try {
    const roh = window.localStorage.getItem(BESUCH_SCHLUESSEL);
    const alt = roh ? (JSON.parse(roh) as Besuchsstand) : null;
    const stand: Besuchsstand =
      alt && typeof alt.anzahl === "number" && typeof alt.zuletzt === "number"
        ? jetzt - alt.zuletzt > BESUCH_ABSTAND_MS
          ? { anzahl: alt.anzahl + 1, zuletzt: jetzt }
          : { ...alt, zuletzt: jetzt }
        : leer;
    window.localStorage.setItem(BESUCH_SCHLUESSEL, JSON.stringify(stand));
    return stand;
  } catch {
    return leer;
  }
}

/** Passt das Gerät? Ohne Angabe: jedes. */
function geraetPasst(a: Ausloeser, breite: number): boolean {
  if (!a.geraet) return true;
  const mobil = breite <= MOBIL_BIS;
  return a.geraet === "mobile" ? mobil : !mobil;
}

/** Datum und Uhrzeit in der Zeitzone des BETRIEBS, nicht des Gastes.
 *
 *  Ein Betrieb, der „ab 18 Uhr" einstellt, meint 18 Uhr bei sich. Würde hier
 *  die Uhr des Gastes gelten, sähe jemand aus New York das Abendangebot am
 *  Nachmittag — und der Betrieb hätte keine Möglichkeit, das zu bemerken.
 *
 *  `Intl.DateTimeFormat` mit `timeZone` rechnet ohne eigene Zeitzonen-Tabelle:
 *  die steht im Browser. Bei einer unbekannten Zone wirft es — dann gilt die
 *  Bedingung als NICHT erfüllt (fail-closed), statt sie zu überspringen. */
function inZeitzone(
  zeitzone: string,
  jetzt: Date,
): { datum: string; minuten: number; wochentag: number; tagImMonat: number } | null {
  try {
    const teile = new Intl.DateTimeFormat("en-CA", {
      timeZone: zeitzone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      weekday: "short",
    }).formatToParts(jetzt);
    const teil = (art: string) =>
      teile.find((p) => p.type === art)?.value ?? "";
    const jahr = teil("year");
    const monat = teil("month");
    const tag = teil("day");
    if (!jahr || !monat || !tag) return null;
    const stunde = Number(teil("hour"));
    const minute = Number(teil("minute"));
    const wochennamen = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return {
      datum: `${jahr}-${monat}-${tag}`,
      // `24:00` kommt bei hour12:false für Mitternacht vor — auf 0 normalisieren,
      // sonst liegt Mitternacht rechnerisch NACH 23:59 und jede Spanne, die über
      // Mitternacht geht, kippt.
      minuten: (stunde % 24) * 60 + minute,
      wochentag: Math.max(0, wochennamen.indexOf(teil("weekday"))),
      tagImMonat: Number(tag),
    };
  } catch {
    return null;
  }
}

/** Passt das Zeitfenster?
 *
 *  Vier Fragen nacheinander, jede darf allein absagen:
 *   1. Liegt HEUTE im Zeitraum (Start-/Enddatum)?
 *   2. Passt der Wiederholungs-Rhythmus (täglich/wöchentlich/monatlich/jährlich)?
 *   3. Liegt die Uhrzeit in der Spanne — auch wenn sie über Mitternacht geht?
 *
 *  Der Rhythmus wird gegen das STARTDATUM gerechnet: „wöchentlich" heißt
 *  „an demselben Wochentag wie der Start", „monatlich" an demselben Tag im
 *  Monat, „jährlich" an demselben Tag und Monat. Das ist die Bedeutung, die ein
 *  Kalender hat — nicht „alle sieben Tage ab jetzt". */
function zeitPasst(a: Ausloeser, jetzt: Date): boolean {
  const z = a.zeit;
  if (!z) return true;
  const nun = inZeitzone(z.zeitzone || "UTC", jetzt);
  if (!nun) return false;

  if (z.start_datum && nun.datum < z.start_datum) return false;
  if (z.end_datum && nun.datum > z.end_datum) return false;

  const rhythmus = z.wiederholung || "keine";
  if (rhythmus !== "keine" && z.start_datum) {
    const start = inZeitzone(z.zeitzone || "UTC", new Date(`${z.start_datum}T12:00:00Z`));
    if (!start) return false;
    if (rhythmus === "woechentlich" && start.wochentag !== nun.wochentag) return false;
    if (rhythmus === "monatlich" && start.tagImMonat !== nun.tagImMonat) return false;
    if (rhythmus === "jaehrlich" && z.start_datum.slice(5) !== nun.datum.slice(5)) {
      return false;
    }
    // `taeglich` stellt keine zusätzliche Bedingung — jeder Tag passt.
  }

  if (z.ganztags === false && z.von && z.bis) {
    const [vh, vm] = z.von.split(":").map(Number);
    const [bh, bm] = z.bis.split(":").map(Number);
    const von = vh * 60 + vm;
    const bis = bh * 60 + bm;
    // Über Mitternacht (22:00–02:00): dann sind es ZWEI Spannen, und die
    // Bedingung ist erfüllt, wenn eine davon greift. Ohne diesen Fall wäre
    // „abends bis nachts" gar nicht einstellbar.
    return von <= bis
      ? nun.minuten >= von && nun.minuten <= bis
      : nun.minuten >= von || nun.minuten <= bis;
  }
  return true;
}

/** Passt die Besuchszahl? */
function besuchePasst(a: Ausloeser, stand: Besuchsstand): boolean {
  if (!a.besuche) return true;
  if (a.besuche.modus === "first") return stand.anzahl === 1;
  return stand.anzahl >= (a.besuche.anzahl ?? 2);
}

/** Passen die Kampagnen-Parameter?
 *
 *  Gelesen wird aus der AKTUELLEN Adresse. Ein Gast, der über einen Newsletter
 *  kommt und dann weiterklickt, verliert die Parameter — das ist gewollt: die
 *  Regel gilt der Ankunft, nicht dem ganzen Besuch. Wer sie über den Besuch
 *  halten will, nimmt zusätzlich „einmal je Sitzung". */
function kampagnePasst(a: Ausloeser, suche: string): boolean {
  const k = a.kampagne;
  if (!k || Object.keys(k.parameter || {}).length === 0) return true;
  const params = new URLSearchParams(suche);
  return Object.entries(k.parameter).every(([name, wert]) => {
    const ist = params.get(name);
    if (ist === null) return false;
    return k.exakt === false
      ? ist.toLowerCase().includes(wert.toLowerCase())
      : ist === wert;
  });
}

/** Gilt die Regel auf DIESER Seite?
 *
 *  Leere Liste = überall. Verglichen wird der Slug ohne führenden Schrägstrich,
 *  die Startseite trägt den leeren Slug — dieselbe Schreibweise wie in
 *  `site_pages`. */
function seitePasst(regel: Regel, pfad: string): boolean {
  if (!regel.seiten || regel.seiten.length === 0) return true;
  const slug = pfad.replace(/^\/+/, "").replace(/\/+$/, "").toLowerCase();
  return regel.seiten.includes(slug);
}

/** Wurde die Aktion schon gezeigt — und darf sie wieder?
 *
 *  Drei Fälle, und der dritte ist der, den Duda nicht hat:
 *   · einmal je Sitzung  → `sessionStorage`, weg beim Schließen des Tabs
 *   · einmal je Besucher → `localStorage`, bleibt
 *   · wieder nach N Tagen → bleibt, aber mit Verfallsdatum
 *
 *  Der dritte ist für Unterkünfte der wichtigste: ein Gast entscheidet über
 *  Wochen. Bei „einmal je Besucher" sieht er das Angebot genau einmal und nie
 *  wieder, obwohl er noch nicht gebucht hat. */
export function schonGezeigt(regel: Regel, jetzt: number = Date.now()): boolean {
  try {
    const speicher = regel.einmal_je_besucher
      ? window.localStorage
      : window.sessionStorage;
    const roh = speicher.getItem(`nd-regel-${regel.id}`);
    if (!roh) return false;
    const wann = Number(roh);
    if (!Number.isFinite(wann)) return true;
    const tage = regel.wieder_nach_tagen;
    if (!tage) return true;
    return jetzt - wann < tage * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

/** Merkt, dass die Aktion gezeigt wurde. */
export function gezeigtMerken(regel: Regel, jetzt: number = Date.now()): void {
  try {
    const speicher = regel.einmal_je_besucher
      ? window.localStorage
      : window.sessionStorage;
    speicher.setItem(`nd-regel-${regel.id}`, String(jetzt));
  } catch {
    // Nicht speicherbar: die Aktion kommt beim nächsten Aufruf wieder. Das ist
    // der ehrliche Ausgang, kein stilles Unterdrücken.
  }
}

export type Umgebung = {
  breite: number;
  pfad: string;
  suche: string;
  jetzt: Date;
  besuche: Besuchsstand;
  ortVerfuegbar: boolean;
};

/** Greift diese Regel gerade? Alle Bedingungen UND-verknüpft.
 *
 *  ODER gibt es bewusst nicht: in einer Oberfläche ohne Klammern wäre es nicht
 *  erklärbar. Wer ODER braucht, legt zwei Regeln an — dafür ist die Reihenfolge
 *  da. Duda macht es genauso.
 */
export function regelGreift(regel: Regel, u: Umgebung): boolean {
  const a = regel.triggers || {};
  if (!seitePasst(regel, u.pfad)) return false;
  // Der Ort ist die einzige Bedingung, die der Browser nicht entscheiden kann.
  // Ohne Geo-Dienst ruht die Regel — sie fällt NICHT auf „trifft zu" zurück.
  if (a.ort && !u.ortVerfuegbar) return false;
  if (!geraetPasst(a, u.breite)) return false;
  if (!zeitPasst(a, u.jetzt)) return false;
  if (!besuchePasst(a, u.besuche)) return false;
  if (!kampagnePasst(a, u.suche)) return false;
  return true;
}

/** Die greifenden Regeln, je Aktionsart nur die erste.
 *
 *  Dudas Vorrangregel, wörtlich: bei zwei Regeln DERSELBEN Aktionsart auf
 *  derselben Seite gewinnt die oberste. Verschiedene Aktionsarten dürfen
 *  gleichzeitig laufen — eine Hinweisleiste und ein Pop-up schließen einander
 *  nicht aus.
 *
 *  Die Reihenfolge der Liste ist der Vorrang; sie kommt so vom Server
 *  (`order by sort_order`) und wird hier nicht noch einmal sortiert. */
export function greifendeRegeln(regeln: Regel[], u: Umgebung): Regel[] {
  const genommen = new Set<string>();
  const raus: Regel[] = [];
  for (const regel of regeln) {
    if (genommen.has(regel.action_type)) continue;
    if (!regelGreift(regel, u)) continue;
    if (schonGezeigt(regel)) continue;
    genommen.add(regel.action_type);
    raus.push(regel);
  }
  return raus;
}
