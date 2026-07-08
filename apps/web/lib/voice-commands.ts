// Andy-Sprachbefehle: lokale Absichtserkennung VOR dem Backend-Call.
//
// Erkennt Andy im gesprochenen Satz eine Navigations-Absicht („geh zum
// Posteingang", „öffne den Kalender", „zeig mir die Gäste"), liefert diese
// Funktion das Ziel (Route + gesprochene Bestaetigung) zurueck. So navigiert die
// App direkt, ohne Umweg ueber die KI. Grundlage fuer die spaetere Vollsteuerung.

export type NavTarget = {
  key: string;
  href: string;
  // Gesprochene Bestaetigung nach dem Wechsel.
  spoken: string;
  // Begriffe, die auf dieses Ziel zeigen (klein geschrieben, ohne Umlaut-Varianten
  // muss der Nutzer nichts Genaues sagen — Teilstring-Treffer reicht).
  phrases: string[];
};

// Reihenfolge = Prioritaet. Spezifische Ziele (Unterseiten) VOR den Oberseiten,
// damit „Rechnungen"/„Umsatz" nicht faelschlich als „Buchhaltung" matcht.
export const NAV_TARGETS: NavTarget[] = [
  { key: "inbox", href: "/posteingang", spoken: "Öffne den Posteingang.", phrases: ["posteingang", "postfach", "nachrichten", "inbox"] },
  { key: "calendar", href: "/kalender", spoken: "Öffne den Kalender.", phrases: ["kalender", "belegungsplan", "kalendar"] },
  { key: "revenue", href: "/buchhaltung/umsatz", spoken: "Öffne den Umsatz.", phrases: ["umsatz", "umsätze", "umsatzuebersicht"] },
  { key: "payments", href: "/buchhaltung/zahlungen", spoken: "Öffne die Zahlungen.", phrases: ["zahlungen", "zahlung"] },
  { key: "invoices", href: "/buchhaltung", spoken: "Öffne die Buchhaltung.", phrases: ["buchhaltung", "rechnungen", "rechnung", "finanzen"] },
  { key: "guests", href: "/gaeste", spoken: "Öffne die Gäste.", phrases: ["gäste", "gaeste", "gast", "gästeliste"] },
  { key: "properties", href: "/objekte", spoken: "Öffne die Objekte.", phrases: ["objekte", "objekt", "ferienwohnungen", "ferienwohnung", "zimmer", "unterkünfte", "unterkunft"] },
  { key: "channels", href: "/channels", spoken: "Öffne die Kanäle.", phrases: ["kanäle", "kanal", "channel", "channels", "tschännel", "portale", "vertriebskanäle"] },
  { key: "pricing", href: "/dynamic-pricing", spoken: "Öffne die Preisautomatik.", phrases: ["dynamic pricing", "dynamische preise", "preisautomatik", "pricing", "preising", "dynamik pricing", "dynamische preisgestaltung"] },
  { key: "stopSell", href: "/stop-sell", spoken: "Öffne Stop-Sell.", phrases: ["stop sell", "stopp sell", "sperren", "sperrung"] },
  { key: "owners", href: "/eigentuemer", spoken: "Öffne die Eigentümer.", phrases: ["eigentümer", "eigentuemer", "besitzer"] },
  { key: "travelAgencies", href: "/reisebueros", spoken: "Öffne die Reisebüros.", phrases: ["reisebüros", "reisebüro", "reisebueros", "reisebuero"] },
  { key: "website", href: "/website", spoken: "Öffne den Webseiten-Baukasten.", phrases: ["website", "webseite", "web seite", "homepage", "hom page", "seiten builder", "seiten bilder", "website builder", "webseiten baukasten", "baukasten"] },
  { key: "employees", href: "/hr/mitarbeiter", spoken: "Öffne die Mitarbeiter.", phrases: ["mitarbeiter", "personal", "team"] },
  { key: "shiftPlan", href: "/hr/schichtplan", spoken: "Öffne den Schichtplan.", phrases: ["schichtplan", "schichten", "dienstplan"] },
  { key: "jobs", href: "/jobs/stellen", spoken: "Öffne die Stellen.", phrases: ["stellen", "stellenanzeigen", "jobs"] },
  { key: "marketplace", href: "/marktplatz/projekte", spoken: "Öffne den Marktplatz.", phrases: ["marktplatz", "projekte", "aufträge", "auftraege"] },
  { key: "settings", href: "/einstellungen", spoken: "Öffne die Einstellungen.", phrases: ["einstellungen", "settings", "konfiguration"] },
  { key: "account", href: "/konto", spoken: "Öffne dein Konto.", phrases: ["konto", "mein konto", "account", "profil"] },
  { key: "dashboard", href: "/", spoken: "Zurück zum Dashboard.", phrases: ["dashboard", "däschbord", "dash board", "übersicht", "uebersicht", "startseite", "start"] },
];

// Verben, die eine Navigationsabsicht signalisieren. Nur wenn eines davon
// vorkommt (oder der Satz sehr kurz ist), werten wir es als Befehl — sonst
// wuerde eine Frage wie „wie viele Gäste haben wir?" faelschlich navigieren.
const NAV_VERBS = [
  "geh",
  "gehe",
  "wechsel",
  "wechsle",
  "öffne",
  "oeffne",
  "öffnen",
  "zeig",
  "zeige",
  "zeig mir",
  "bring mich",
  "navigier",
  "navigiere",
  "spring",
  "springe",
  "ruf",
  "rufe",
  "los zu",
  "zu ",
  "zum ",
  "zur ",
  "auf ",
  "nach ",
];

// Frage-Woerter: signalisieren eine INHALTS-Abfrage („sind neue Nachrichten
// da?"), KEINE Navigation. Als WORTGRENZEN-Regex, damit kurze Woerter wie „ist"
// nicht faelschlich in „Statistik" oder „vor" in „bevor" matchen.
const QUESTION_RE =
  /\b(gibt es|gibt's|sind|ist|habe?|haben wir|wie ?viele?|wie ?viel|was|welche|wer|wann|ungelesen|check|prüf\w*|pruef\w*|schau\w*|lies|vorlesen|aktiv|läuft|laeuft)\b/;

function isQuestionLike(text: string): boolean {
  return QUESTION_RE.test(text);
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,!?;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchTarget(text: string): NavTarget | null {
  for (const target of NAV_TARGETS) {
    if (target.phrases.some((p) => text.includes(p))) {
      return target;
    }
  }
  return null;
}

// Daten-Skills: Bereiche, deren echten Zustand Andy lesen kann (statt die KI
// raten zu lassen). Jeder Skill erkennt seine Fragen selbst und formatiert die
// gesprochene Antwort aus der API-Antwort. NEUE Bereiche = ein Eintrag hier.
export type DataSkill<TPayload = unknown> = {
  key: string;
  // Endpoint (relativ zu /api/v1), den Andy fuer die Antwort abruft.
  endpoint: string;
  // Trifft zu, wenn die Aeusserung eine Frage an diesen Bereich ist.
  matches: (text: string, isQuestion: boolean, target: NavTarget | null) => boolean;
  // Baut die gesprochene Antwort aus der API-Antwort.
  summarize: (payload: TPayload) => string;
  // Bei nacktem Stichwort ohne Nav-Verb: Antwort bevorzugen statt navigieren.
  // Fuer Bereiche, die man eher „abfragt" als „aufruft" (z. B. Dynamic Pricing).
  // Bei „Posteingang" hingegen navigiert man eher → false/undefined lassen.
  preferAnswer?: boolean;
};

export const DATA_SKILLS: DataSkill[] = [
  // Posteingang: neue Nachrichten / Buchungen.
  {
    key: "inbox",
    endpoint: "/inbox?status=active",
    matches: (text, isQuestion, target) => {
      if (!isQuestion) {
        return false;
      }
      if (target?.key === "inbox") {
        return true;
      }
      return /\b(nachricht|nachrichten|buchung|buchungen|anfrage|anfragen)\b/.test(
        text,
      );
    },
    summarize: (payload) =>
      summarizeInbox(
        ((payload as { items?: InboxThreadLite[] } | null)?.items ?? []),
      ),
  },
  // Dynamic Pricing: an/aus, bei wie vielen Objekten.
  {
    key: "pricing",
    endpoint: "/pricing/overview",
    matches: (text, isQuestion) => {
      if (!isQuestion) {
        return false;
      }
      // „pricing"/„preising" ist das zuverlaessige Signal — der de-DE-Erkenner
      // verhunzt „dynamic" oft (z. B. „dein nameic pricing"), transkribiert
      // „pricing" aber meist korrekt. Plus die sauberen deutschen Varianten.
      return (
        /\b(pricing|preising|prizing)\b/.test(text) ||
        /dynamische?\s*prei/.test(text) ||
        /preisautomatik|automatische?\s*preise|preisgestaltung/.test(text)
      );
    },
    summarize: (payload) =>
      summarizePricing(
        ((payload as { items?: PricingItemLite[] } | null)?.items ?? []),
      ),
    preferAnswer: true, // „dynamic pricing" ohne Verb → lieber Status nennen.
  },
];

// Lokale Snapshot-Abfragen: aus den Daten, die Andy ohnehin schon hat (heutige
// An-/Abreisen, anstehende Reservierungen) — kein Fetch, sofortige Antwort.
export type LocalQueryKind =
  | "arrivals-today"
  | "departures-today"
  | "upcoming"
  | "arrivals-30d";

function matchLocalQuery(text: string, isQuestion: boolean): LocalQueryKind | null {
  if (!isQuestion) {
    return null;
  }
  const asks30d =
    /\b(letzte\w*|letzten|letzter|vergangene\w*|vergangenen)\s+30\s*(tage|tagen)\b/.test(text) ||
    /\b30\s*(tage|tagen)\b/.test(text);

  // 30-Tage-Check-ins zuerst pruefen, damit diese Fragen nicht als
  // "heute anreisen" fehlklassifiziert werden.
  const arrivals30d =
    asks30d &&
    (/\b(check[- ]?ins?|anreise\w*|ankunft|ankünfte|ankuenfte|anreist)\b/.test(text) ||
      /\bwie\s+viel\w*\s+check/.test(text));
  if (arrivals30d) {
    return "arrivals-30d";
  }

  // Reihenfolge: spezifischer zuerst. „reist … ab/an" wird gesondert erkannt,
  // da hier das Verb (nicht ein Substantiv) die Absicht traegt.
  const departs =
    /\b(abreise\w*|check[- ]?outs?|auschecken|abfahrt|abreist)\b/.test(text) ||
    /reis\w*\s+\w*\s*ab\b/.test(text) ||
    /\breist\w*\s+ab\b/.test(text);
  if (departs) {
    return "departures-today";
  }
  const arrives =
    /\b(anreise\w*|check[- ]?ins?|einchecken|ankunft|ankünfte|ankuenfte|anreist)\b/.test(text) ||
    /reis\w*\s+\w*\s*an\b/.test(text) ||
    /\breist\w*\s+an\b/.test(text) ||
    /\bheute\s+an\b/.test(text);
  if (arrives) {
    return "arrivals-today";
  }
  if (
    /\b(anstehend\w*|kommende\w*|nächste\w*|naechste\w*|bevorstehend\w*)\b/.test(text) &&
    /\b(reservierung\w*|buchung\w*)\b/.test(text)
  ) {
    return "upcoming";
  }
  return null;
}

// Aktionen, die echte Daten AENDERN. Werden immer erst nach Rueckfrage
// ausgefuehrt (siehe Andy-Bestaetigungsmodus). NEUE Aktionen = ein Eintrag.
export type VoiceAction = {
  key: string;
  // true = einschalten, false = ausschalten.
  turnOn: boolean;
};

// AUSschalten: entweder ein eindeutiges Verb (deaktivieren, ausschalten …) ODER
// ein Aktions-Verb (mach/schalt/setz/dreh) zusammen mit dem Partikel „aus".
const OFF_RE =
  /\b(ausschalten|ausmachen|deaktivier\w*|abschalten|abstellen|stopp\w*|beenden|pausier\w*)\b|\b(mach\w*|schalt\w*|setz\w*|dreh\w*|nimm)\b[^]*\b(aus|ab)\b/;
// EINschalten: analog. „an"/„ein" NUR zusammen mit einem Aktions-Verb, damit die
// Statusfrage „ist die Preisautomatik an?" NICHT als Aktion gilt.
const ON_RE =
  /\b(einschalten|einmachen|anschalten|anmachen|aktivier\w*|einstellen|anstellen)\b|\b(mach\w*|schalt\w*|setz\w*|dreh\w*)\b[^]*\b(an|ein)\b/;

// Erkennt eine Aktion (nur Dynamic Pricing an/aus vorerst). Gibt null zurueck,
// wenn keine Aenderungsabsicht erkennbar ist. Verlangt bewusst ein Verb — „an"/
// „aus" allein (wie in der Statusfrage) loest KEINE Aktion aus.
function matchAction(text: string): VoiceAction | null {
  const isPricing =
    /\b(pricing|preising|prizing|preisautomatik)\b/.test(text) ||
    /dynamische?\s*prei/.test(text) ||
    /preisgestaltung/.test(text);
  if (!isPricing) {
    return null;
  }
  // „ausschalten" hat Vorrang vor „einschalten", falls beides vorkommt.
  if (OFF_RE.test(text)) {
    return { key: "pricing", turnOn: false };
  }
  if (ON_RE.test(text)) {
    return { key: "pricing", turnOn: true };
  }
  return null;
}

export type VoiceCommand =
  | { kind: "navigate"; target: NavTarget }
  | { kind: "data-query"; skill: DataSkill } // echten Bereichs-Zustand lesen (Fetch)
  | { kind: "local-query"; query: LocalQueryKind } // aus vorhandenem Snapshot
  | { kind: "action"; action: VoiceAction } // echte Daten aendern (mit Rueckfrage)
  | { kind: "ai" }; // an die KI weiterreichen

// Klassifiziert die Aeusserung in Aktion / Navigation / Daten-Abfrage / KI.
export function classifyCommand(utterance: string): VoiceCommand {
  const text = normalize(utterance);
  if (!text) {
    return { kind: "ai" };
  }

  // 0) Aenderungsabsicht (aus-/einschalten) hat Vorrang — sonst wuerde
  //    „schalt die Preisautomatik aus" als reine Statusfrage gelesen.
  const action = matchAction(text);
  if (action) {
    return { kind: "action", action };
  }

  const target = matchTarget(text);
  const isQuestion = isQuestionLike(text);
  const hasVerb = NAV_VERBS.some((v) => text.includes(v));

  // 1) Fragt die Aeusserung nach dem Zustand eines Daten-Bereichs? Dann lesen (Fetch).
  for (const skill of DATA_SKILLS) {
    if (skill.matches(text, isQuestion, target)) {
      return { kind: "data-query", skill };
    }
  }

  // 1b) Ziel hat einen Daten-Skill mit preferAnswer (z. B. Dynamic Pricing) und
  //     der Nutzer hat KEIN explizites Navigations-Verb gesagt → lieber die
  //     Frage beantworten als blind zu navigieren. Deckt auch von der
  //     Spracherkennung zerhackte Saetze ab, bei denen nur das Stichwort ankommt.
  if (target && !hasVerb) {
    const skill = DATA_SKILLS.find(
      (s) => s.key === target.key && s.preferAnswer,
    );
    if (skill) {
      return { kind: "data-query", skill };
    }
  }

  // 2) Lokale Snapshot-Frage (heutige An-/Abreisen, anstehende Reservierungen)?
  //    Nur wenn NICHT gerade ein Navigations-Ziel gemeint ist.
  if (!target) {
    const local = matchLocalQuery(text, isQuestion);
    if (local) {
      return { kind: "local-query", query: local };
    }
  }

  // 3) Navigation: Ziel-Wort erkannt UND (Nav-Verb ODER keine Frage) → wechseln.
  if (target) {
    if (hasVerb || !isQuestion) {
      return { kind: "navigate", target };
    }
  }

  return { kind: "ai" };
}

// --- Posteingang lesen -----------------------------------------------------

export type InboxThreadLite = {
  is_read?: boolean;
  status?: string | null; // new | modified | cancelled
  guest_name?: string | null;
  ota_name?: string | null;
  last_message?: string | null;
};

// Baut aus der Thread-Liste eine gesprochene Zusammenfassung: wie viele
// ungelesen, wie viele neue Buchungen, und die neuesten Absender.
export function summarizeInbox(threads: InboxThreadLite[]): string {
  if (!threads || threads.length === 0) {
    return "Im Posteingang ist alles ruhig, es gibt keine offenen Nachrichten.";
  }

  const unread = threads.filter((t) => t.is_read === false);
  const newBookings = threads.filter((t) => t.status === "new");

  const parts: string[] = [];

  if (unread.length === 0) {
    parts.push("Du hast keine ungelesenen Nachrichten.");
  } else if (unread.length === 1) {
    const t = unread[0];
    const who = t.guest_name?.trim();
    parts.push(
      who
        ? `Du hast eine ungelesene Nachricht von ${who}.`
        : "Du hast eine ungelesene Nachricht.",
    );
  } else {
    const names = unread
      .slice(0, 3)
      .map((t) => t.guest_name?.trim())
      .filter((n): n is string => Boolean(n));
    const namePart =
      names.length > 0 ? ` Unter anderem von ${names.join(", ")}.` : "";
    parts.push(`Du hast ${unread.length} ungelesene Nachrichten.${namePart}`);
  }

  if (newBookings.length === 1) {
    parts.push("Es ist eine neue Buchung dabei.");
  } else if (newBookings.length > 1) {
    parts.push(`Es sind ${newBookings.length} neue Buchungen dabei.`);
  }

  return parts.join(" ");
}

// --- Dynamic Pricing lesen -------------------------------------------------

export type PricingItemLite = {
  property_id?: string;
  title?: string | null;
  enabled?: boolean;
};

// Beantwortet „ist die Preisautomatik an?" aus der Objekt-Uebersicht. Andy
// SPRICHT bewusst „Preisautomatik" (deutsch) statt „Dynamic Pricing" — so
// versteht der deutsche Erkenner die Frage sauber (kein „dein nameic pricing").
// Die UI-Bezeichnung „Dynamic Pricing" bleibt unveraendert.
export function summarizePricing(items: PricingItemLite[]): string {
  if (!items || items.length === 0) {
    return "Es sind noch keine Objekte für die Preisautomatik hinterlegt.";
  }
  const enabled = items.filter((i) => i.enabled === true);
  const total = items.length;

  if (enabled.length === 0) {
    return "Die Preisautomatik ist bei keinem deiner Objekte aktiv.";
  }

  // Namen der aktiven Objekte (bis zu 4 werden ausgesprochen, sonst gekuerzt).
  const names = enabled
    .map((i) => i.title?.trim())
    .filter((n): n is string => Boolean(n));
  const spokenNames = names.slice(0, 4).join(", ");
  const more = names.length > 4 ? ` und ${names.length - 4} weitere` : "";
  const namePart = spokenNames ? ` Aktiv bei ${spokenNames}${more}.` : "";

  if (enabled.length === total) {
    return total === 1
      ? `Ja, die Preisautomatik ist für dein Objekt aktiv.${namePart}`
      : `Ja, die Preisautomatik ist für alle ${total} Objekte aktiv.${namePart}`;
  }
  return `Die Preisautomatik ist bei ${enabled.length} von ${total} Objekten aktiv.${namePart}`;
}

// --- Lokale Snapshot-Antworten (heutige An-/Abreisen, anstehende Reservierungen) ---

export type SnapshotEntryLite = {
  guest_name?: string | null;
  property_title?: string | null;
  check_in?: string | null;
  check_out?: string | null;
};

export type SnapshotLite = {
  checkins_today?: SnapshotEntryLite[];
  checkouts_today?: SnapshotEntryLite[];
  upcoming?: SnapshotEntryLite[];
  checkins_30d?: { value?: number | null } | null;
};

function nameList(entries: SnapshotEntryLite[], max = 3): string {
  const names = entries
    .slice(0, max)
    .map((e) => e.guest_name?.trim())
    .filter((n): n is string => Boolean(n));
  return names.join(", ");
}

// Beantwortet lokale Snapshot-Fragen ohne Netzwerk. Gibt null zurueck, wenn der
// Snapshot fehlt (dann faellt Andy auf die KI zurueck).
export function answerLocalQuery(
  query: LocalQueryKind,
  snap: SnapshotLite | null,
): string | null {
  if (!snap) {
    return null;
  }
  if (query === "arrivals-today") {
    const list = snap.checkins_today ?? [];
    if (list.length === 0) {
      return "Heute reist niemand neu an.";
    }
    const who = nameList(list);
    const whoPart = who ? ` Unter anderem ${who}.` : "";
    return list.length === 1
      ? `Heute reist ein Gast an.${whoPart}`
      : `Heute reisen ${list.length} Gäste an.${whoPart}`;
  }
  if (query === "departures-today") {
    const list = snap.checkouts_today ?? [];
    if (list.length === 0) {
      return "Heute reist niemand ab.";
    }
    const who = nameList(list);
    const whoPart = who ? ` Unter anderem ${who}.` : "";
    return list.length === 1
      ? `Heute reist ein Gast ab.${whoPart}`
      : `Heute reisen ${list.length} Gäste ab.${whoPart}`;
  }
  if (query === "arrivals-30d") {
    const countRaw = snap.checkins_30d?.value;
    const count =
      typeof countRaw === "number" && Number.isFinite(countRaw)
        ? Math.round(countRaw)
        : null;
    if (count === null) {
      return "Die Check-In-Zahl für die letzten 30 Tage ist gerade nicht verfügbar.";
    }
    return count === 1
      ? "In den letzten 30 Tagen gab es einen Check-In."
      : `In den letzten 30 Tagen gab es ${count} Check-Ins.`;
  }
  // upcoming
  const list = snap.upcoming ?? [];
  if (list.length === 0) {
    return "Es stehen keine Reservierungen an.";
  }
  const who = nameList(list);
  const whoPart = who ? ` Unter anderem für ${who}.` : "";
  return list.length === 1
    ? `Es steht eine Reservierung an.${whoPart}`
    : `Es stehen ${list.length} Reservierungen an.${whoPart}`;
}

// --- Aktionen ausfuehren (mit Rueckfrage) ----------------------------------

// Ja/Nein-Erkennung fuer die Bestaetigung einer Aktion.
export type Confirmation = "yes" | "no" | "unclear";

export function classifyConfirmation(utterance: string): Confirmation {
  const text = normalize(utterance);
  if (/\b(ja|jap|jo|jawohl|klar|mach|bestätige|bestaetige|okay|ok|gerne|passt|genau|richtig)\b/.test(text)) {
    return "yes";
  }
  if (/\b(nein|ne|nö|noe|stopp?|abbrechen|doch nicht|lass|nicht)\b/.test(text)) {
    return "no";
  }
  return "unclear";
}

// Baut den Bestaetigungssatz („Ich schalte … aus. Soll ich das tun?") aus den
// Objekten, die von der Aktion betroffen waeren.
export function buildActionConfirmation(
  action: VoiceAction,
  items: PricingItemLite[],
): { spoken: string; targets: PricingItemLite[] } {
  // Betroffen: beim Ausschalten die aktiven, beim Einschalten die inaktiven.
  const targets = items.filter((i) =>
    action.turnOn ? i.enabled !== true : i.enabled === true,
  );
  const verb = action.turnOn ? "einschalten" : "ausschalten";

  if (targets.length === 0) {
    return {
      spoken: action.turnOn
        ? "Die Preisautomatik ist bereits bei allen Objekten aktiv."
        : "Die Preisautomatik ist bei keinem Objekt aktiv, es gibt nichts auszuschalten.",
      targets: [],
    };
  }

  const names = targets
    .map((i) => i.title?.trim())
    .filter((n): n is string => Boolean(n));
  const spokenNames = names.slice(0, 4).join(", ");
  const more = names.length > 4 ? ` und ${names.length - 4} weitere` : "";

  const scope =
    targets.length === 1
      ? spokenNames
        ? `für ${spokenNames}`
        : "für dein Objekt"
      : `für ${targets.length} Objekte${spokenNames ? ` (${spokenNames}${more})` : ""}`;

  return {
    spoken: `Ich würde die Preisautomatik ${scope} ${verb}. Soll ich das tun?`,
    targets,
  };
}
