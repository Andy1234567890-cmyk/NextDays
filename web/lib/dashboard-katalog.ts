// Kachel-Katalog der Startseite — die EINE Wahrheit darüber, welche Kacheln es
// gibt (Lastenheft §2.1, Migration 0402).
//
// Zwilling zu `apps/api/src/features/dashboard_layout/schemas.py:KachelId`.
// Kommt hier eine Kachel dazu, MUSS sie dort ergänzt werden, sonst weist der
// Server jedes Layout mit dieser ID per 422 ab — und umgekehrt wäre eine ID,
// die nur der Server kennt, im Raster unerreichbar. Beide Listen hält
// `scripts/diagnose/dashboard-kacheln-pruefen.mjs` deckungsgleich; es liest
// `KACHEL_IDS` unten textuell, deshalb bleibt das Array ein flaches Literal.
//
// Bewusst KEIN React hier: die Normalisierung (`dashboard-layout-normalisierung`)
// und ihr Test laufen unter `bun test` ohne DOM. Welche Komponente eine ID
// rendert, entscheidet `components/dashboard/kachel-inhalt.tsx`.

/** Alle Kachel-IDs. `liste:`/`kpi:`-Präfix, weil `checkins` zweimal vorkommt
 *  (Liste UND Kennzahl) — ohne Präfix überschrieben sie sich gegenseitig. */
export const KACHEL_IDS = [
  "liste:checkouts",
  "liste:checkins",
  "liste:freigabe",
  "liste:upcoming",
  "liste:im_haus",
  "kpi:checkins",
  "kpi:revenue_per_booking",
  "kpi:revenue",
  "kpi:confirmed",
  "nachricht:gesendet:summe",
  "nachricht:gesendet:schnitt",
  "nachricht:empfangen:summe",
  "nachricht:empfangen:schnitt",
  "nachricht:automation:summe",
  "nachricht:automation:schnitt",
  "nachricht:ungelesen",
  "objekt:gesamt",
  "objekt:inaktiv",
  "objekt:entwurf",
  "vorgaenge:eigentuemer",
] as const;

export type KachelId = (typeof KACHEL_IDS)[number];

/** Breite im 12-Spalten-Raster: s = 4, m = 6, l = 12 Spalten. */
export type KachelGroesse = "s" | "m" | "l";

export const SPALTEN = 12;

export const BREITE: Record<KachelGroesse, number> = { s: 4, m: 6, l: 12 };

/** Fachlicher Bereich — gruppiert die Kacheln im Anpassen-Modus und in der
 *  Leiste der ausgeblendeten Kacheln. Ersetzt die drei Abschnitts-Kopfzeilen
 *  des alten, starren Dashboards. */
export type KachelBereich =
  | "reservierungen"
  | "kennzahlen"
  | "nachrichten"
  | "objekte";

/**
 * Wer die Kachel sehen darf. Das ist DARSTELLUNG, nicht Schutz: die Daten
 * dahinter maskiert bzw. verweigert der Server ohnehin (Owner ohne
 * PM_BOOKING_TOTAL bekommt `revenue_30d = null`, ohne `pm_chat` antwortet
 * `/inbox/kennzahlen` mit 403). Der Katalog blendet nur aus, was für die Rolle
 * sowieso leer bliebe (§4.2/§4.3).
 *
 * - `capability`: Fähigkeit aus `me.capabilities` (grobe Rollen-Fähigkeit).
 * - `permission`: feingranulare Berechtigung aus `me.permissions`.
 * Admin sieht immer alles (wie `inboxAccessFor`).
 */
export type KachelZugang =
  | { art: "alle" }
  | { art: "capability"; capability: string }
  | { art: "permission"; permission: string }
  /** Beträge: `pm_booking_total` UND nicht `hide_prices` — dieselbe Regel wie
   *  `inboxAccessFor(...).amounts`, hier benannt statt kopiert. */
  | { art: "betraege" };

export type KachelDefinition = {
  id: KachelId;
  bereich: KachelBereich;
  /** Schlüssel im Namensraum `reservations` (die Titel gibt es dort seit dem
   *  starren Dashboard in allen Sprachen — keine zweite Kopie). */
  titelKey: string;
  icon: string;
  /** Größen, die die Kachel sinnvoll tragen kann. Eine Listen-Karte in `s`
   *  bräche ihre Zeilen (drei Aktions-Icons + Gastname + Objekt), eine reine
   *  Zahl in `l` wäre eine leere Fläche. */
  groessen: readonly KachelGroesse[];
  standardGroesse: KachelGroesse;
  zugang: KachelZugang;
};

const VIEW_CALENDAR: KachelZugang = { art: "capability", capability: "view_calendar" };
const NACHRICHTEN: KachelZugang = { art: "permission", permission: "pm_chat" };
const BETRAEGE: KachelZugang = { art: "betraege" };

/** Der Katalog in STANDARD-Reihenfolge — sie ist zugleich das Layout, das ein
 *  Nutzer ohne eigenes Layout und ohne Rollen-Standard bekommt (der Server
 *  liefert dann `layout = null`, Wurzel 4: kein serverseitig erfundenes). */
export const KATALOG: readonly KachelDefinition[] = [
  // --- Reservierungen (die fünf Listen + Eigentümer-Vorgänge) ---------------
  {
    id: "liste:checkouts",
    bereich: "reservierungen",
    titelKey: "dashboard.todayCheckouts",
    icon: "ph:calendar-x",
    groessen: ["m", "l"],
    standardGroesse: "m",
    zugang: VIEW_CALENDAR,
  },
  {
    id: "liste:checkins",
    bereich: "reservierungen",
    titelKey: "dashboard.todayCheckins",
    icon: "ph:calendar-check",
    groessen: ["m", "l"],
    standardGroesse: "m",
    zugang: VIEW_CALENDAR,
  },
  {
    id: "liste:freigabe",
    bereich: "reservierungen",
    titelKey: "dashboard.approvalNeeded",
    icon: "ph:hourglass-medium",
    groessen: ["m", "l"],
    standardGroesse: "m",
    zugang: VIEW_CALENDAR,
  },
  {
    id: "liste:upcoming",
    bereich: "reservierungen",
    titelKey: "dashboard.upcoming",
    icon: "ph:calendar-dots",
    groessen: ["m", "l"],
    standardGroesse: "m",
    zugang: VIEW_CALENDAR,
  },
  {
    id: "liste:im_haus",
    bereich: "reservierungen",
    titelKey: "dashboard.stayingGuests",
    icon: "ph:house-line",
    groessen: ["m", "l"],
    standardGroesse: "m",
    zugang: VIEW_CALENDAR,
  },
  {
    id: "vorgaenge:eigentuemer",
    bereich: "reservierungen",
    titelKey: "dashboard.ownerRequests",
    icon: "ph:hand-palm",
    groessen: ["s", "m", "l"],
    standardGroesse: "m",
    zugang: { art: "capability", capability: "approve_block" },
  },
  // --- Kennzahlen (30 Tage, umschaltbar) ------------------------------------
  {
    id: "kpi:checkins",
    bereich: "kennzahlen",
    titelKey: "dashboard.checkIn",
    icon: "ph:sign-in",
    groessen: ["s", "m"],
    standardGroesse: "s",
    zugang: VIEW_CALENDAR,
  },
  {
    id: "kpi:revenue_per_booking",
    bereich: "kennzahlen",
    titelKey: "dashboard.revenuePerBooking",
    icon: "ph:chart-line-up",
    groessen: ["s", "m"],
    standardGroesse: "s",
    zugang: BETRAEGE,
  },
  {
    id: "kpi:revenue",
    bereich: "kennzahlen",
    titelKey: "dashboard.revenue",
    icon: "ph:currency-circle-dollar",
    groessen: ["s", "m"],
    standardGroesse: "s",
    zugang: BETRAEGE,
  },
  {
    id: "kpi:confirmed",
    bereich: "kennzahlen",
    titelKey: "dashboard.confirmed",
    icon: "ph:check-circle",
    groessen: ["s", "m"],
    standardGroesse: "s",
    zugang: VIEW_CALENDAR,
  },
  // --- Nachrichten (Summe und Tagesschnitt je Richtung + Ungelesen) ---------
  {
    id: "nachricht:gesendet:summe",
    bereich: "nachrichten",
    titelKey: "dashboard.messagesSent",
    icon: "ph:paper-plane-tilt",
    groessen: ["s", "m"],
    standardGroesse: "s",
    zugang: NACHRICHTEN,
  },
  {
    id: "nachricht:gesendet:schnitt",
    bereich: "nachrichten",
    titelKey: "dashboard.messagesAvgSent",
    icon: "ph:paper-plane-tilt",
    groessen: ["s", "m"],
    standardGroesse: "s",
    zugang: NACHRICHTEN,
  },
  {
    id: "nachricht:empfangen:summe",
    bereich: "nachrichten",
    titelKey: "dashboard.messagesReceived",
    icon: "ph:tray-arrow-down",
    groessen: ["s", "m"],
    standardGroesse: "s",
    zugang: NACHRICHTEN,
  },
  {
    id: "nachricht:empfangen:schnitt",
    bereich: "nachrichten",
    titelKey: "dashboard.messagesAvgReceived",
    icon: "ph:tray-arrow-down",
    groessen: ["s", "m"],
    standardGroesse: "s",
    zugang: NACHRICHTEN,
  },
  {
    id: "nachricht:automation:summe",
    bereich: "nachrichten",
    titelKey: "dashboard.messagesAutomation",
    icon: "ph:robot",
    groessen: ["s", "m"],
    standardGroesse: "s",
    zugang: NACHRICHTEN,
  },
  {
    id: "nachricht:automation:schnitt",
    bereich: "nachrichten",
    titelKey: "dashboard.messagesAvgAutomation",
    icon: "ph:robot",
    groessen: ["s", "m"],
    standardGroesse: "s",
    zugang: NACHRICHTEN,
  },
  {
    id: "nachricht:ungelesen",
    bereich: "nachrichten",
    titelKey: "dashboard.unreadConversations",
    icon: "ph:envelope-open",
    groessen: ["m", "l"],
    standardGroesse: "m",
    zugang: NACHRICHTEN,
  },
  // --- Objekte (Bestand, kein Zeitraum) -------------------------------------
  {
    id: "objekt:gesamt",
    bereich: "objekte",
    titelKey: "dashboard.listingsTotal",
    icon: "ph:buildings",
    groessen: ["s", "m"],
    standardGroesse: "s",
    zugang: { art: "alle" },
  },
  {
    id: "objekt:inaktiv",
    bereich: "objekte",
    titelKey: "dashboard.listingsInactive",
    icon: "ph:pause-circle",
    groessen: ["s", "m"],
    standardGroesse: "s",
    zugang: { art: "alle" },
  },
  {
    id: "objekt:entwurf",
    bereich: "objekte",
    titelKey: "dashboard.listingsDraft",
    icon: "ph:pencil-simple-line",
    groessen: ["s", "m"],
    standardGroesse: "s",
    zugang: { art: "alle" },
  },
];

const _INDEX = new Map<KachelId, KachelDefinition>(
  KATALOG.map((k) => [k.id, k]),
);

export function kachelDefinition(id: KachelId): KachelDefinition {
  const def = _INDEX.get(id);
  // Kann nur reißen, wenn KACHEL_IDS und KATALOG auseinanderlaufen — das ist
  // ein Programmierfehler, kein Laufzeitzustand, also laut (Wurzel 5).
  if (!def) throw new Error(`Kachel ohne Katalogeintrag: ${id}`);
  return def;
}

export function istKachelId(wert: unknown): wert is KachelId {
  return (
    typeof wert === "string" && (KACHEL_IDS as readonly string[]).includes(wert)
  );
}

/** Reihenfolge der Bereiche für Gruppierungen in der UI. */
export const BEREICHE: readonly KachelBereich[] = [
  "reservierungen",
  "kennzahlen",
  "nachrichten",
  "objekte",
];

/**
 * Entscheidet aus Rolle, Fähigkeiten und Berechtigungen, ob eine Kachel für
 * diesen Nutzer überhaupt in Frage kommt. Fail-closed: unbekannte Zugangsart
 * oder fehlende Rolle → nein.
 */
export function darfKachelSehen(
  zugang: KachelZugang,
  me: {
    role: string | null;
    capabilities: readonly string[];
    permissions: readonly string[];
  },
): boolean {
  if (me.role === "admin") return true;
  switch (zugang.art) {
    case "alle":
      return true;
    case "capability":
      return me.capabilities.includes(zugang.capability);
    case "permission":
      return me.permissions.includes(zugang.permission);
    case "betraege":
      return (
        me.permissions.includes("pm_booking_total") &&
        !me.permissions.includes("hide_prices")
      );
    default:
      return false;
  }
}
