// Welches Objektfeld geht an welchen Vertriebskanal?
//
// EINZIGE QUELLE für die Kanal-Kennzeichnung in der Oberfläche. Bisher gab es
// dafür nur zwei Zustände („geht an die Portale" / „nur myBestDays"), das ist zu
// grob: die Wahrheit ist pro FELD und pro KANAL verschieden. Beschreibung und
// Fotos nimmt Airbnb, Booking.com nur bei vollständiger Anbindung, Expedia gar
// nicht. Eine Reinigungsgebühr nimmt Airbnb nur als Festbetrag. Und was ein
// Portal nicht kennt, verschwindet nicht — es wandert still in den Nachtpreis.
// Genau das muss am Feld stehen, sonst pflegt der Kunde ins Leere.
//
// WICHTIG: Diese Datei BESCHREIBT, was der Server ohnehin tut — sie steuert
// nichts. Wenn hier „übertragen" steht, der channel_manager-Slice das Feld aber
// nicht sendet, ist der Eintrag falsch, nicht die Software. Deshalb trägt jedes
// Feld einen Verweis auf die Stelle, die es tatsächlich sendet.
//
// Quellen: apps/api/src/features/channel_manager/content_sync.py,
// content_builder.py, ari_push.py · docs/CHANNEX-FELDER.md · Feldverhalten der
// Portale nach Lodgify-Referenz (Help-Center 360024014254), gegengeprüft mit
// docs.channex.io.

/** Kanäle, die eine Kennzeichnung tragen. Reihenfolge = Anzeigereihenfolge. */
export const KANAELE = ["airbnb", "booking", "mybestdays"] as const;
export type KanalCode = (typeof KANAELE)[number];

/**
 * Wie ein Kanal mit einem Feld umgeht.
 * - `voll`    — wird übertragen und dort angezeigt
 * - `bedingt` — wird übertragen, aber eingeschränkt (Grund steht dabei)
 * - `portal`  — existiert dort, muss aber IM Portal gepflegt werden
 * - `nein`    — kommt dort nicht an
 * - `unklar`  — keine belastbare Quelle; wird bewusst NICHT geraten
 */
export type Kanalstatus = "voll" | "bedingt" | "portal" | "nein" | "unklar";

/**
 * Wiederverwendbare Gründe statt Einzeltexten je Feld — hält die Zahl der zu
 * übersetzenden Strings klein (24 Sprachen).
 */
export type Grund =
  | "vollsync"
  | "festbetrag"
  | "nurProzent"
  | "imPortal"
  | "kennsNicht"
  | "nurBelegungspreise"
  | "eigeneStrecke"
  // Das Portal KENNT das Feld — unser Weg über den Aggregator hat es nicht.
  // Bewusst getrennt von `kennsNicht`: das eine ist eine Lücke bei uns, das
  // andere eine Eigenschaft des Portals.
  | "nichtUebertragbar"
  | "laengenlimit"
  | "nurErstExport"
  | "nurMitEntsprechung"
  | "nichtDeckungsgleich"
  | "ohneBeleg";

export type Kanalregel = { status: Kanalstatus; grund?: Grund };

export type Feldregel = {
  /** Stabiler Schlüssel; auch der i18n-Schlüssel unter `kanalFelder.felder`. */
  feld: string;
  kanaele: Record<KanalCode, Kanalregel>;
};

// Kürzel, damit die Tabelle unten lesbar bleibt.
const ja: Kanalregel = { status: "voll" };
const nein: Kanalregel = { status: "nein", grund: "kennsNicht" };
const portal: Kanalregel = { status: "portal", grund: "imPortal" };
const vollsync: Kanalregel = { status: "bedingt", grund: "vollsync" };
const unklar: Kanalregel = { status: "unklar", grund: "ohneBeleg" };
const nichtUebertragbar: Kanalregel = {
  status: "nein",
  grund: "nichtUebertragbar",
};

/**
 * Die Matrix. Gruppiert nach den Abschnitten der Objektverwaltung, damit die
 * Übersichtsseite dieselbe Gliederung zeigen kann wie die Formulare.
 */
export const FELD_GRUPPEN: { gruppe: string; felder: Feldregel[] }[] = [
  {
    gruppe: "stammdaten",
    felder: [
      {
        // content_sync.py:501 (Property), :898 (Room-Type). Airbnb begrenzt
        // API-verbundene Inserate auf 50 Zeichen — wir kürzen nicht.
        // Hotel-Sonderfall: bei geteilter Property überschreibt jeder
        // Zimmer-Sync den Property-Titel mit dem Betriebsnamen (:511-514).
        feld: "titel",
        kanaele: {
          airbnb: { status: "bedingt", grund: "laengenlimit" },
          booking: vollsync,
          mybestdays: ja,
        },
      },
      {
        // content_builder.py:132-134 (Property), :156-158 (Room-Type).
        // Airbnb begrenzt auf 500 Zeichen; Booking.com verlangt 500–1000 —
        // zu kurze Texte scheitern dort.
        feld: "beschreibung",
        kanaele: {
          airbnb: { status: "bedingt", grund: "laengenlimit" },
          booking: vollsync,
          mybestdays: ja,
        },
      },
      {
        // properties.platform_description — bewusst NICHT an Portale
        feld: "plattformBeschreibung",
        kanaele: {
          airbnb: { status: "nein", grund: "eigeneStrecke" },
          booking: { status: "nein", grund: "eigeneStrecke" },
          mybestdays: ja,
        },
      },
      {
        // content_sync.py:642-646, Mapping common.py:152-171. Die Codes sind
        // Aggregator-Taxonomie, nicht Airbnb-Taxonomie; für Booking.com ist der
        // Typ in keiner Quelle als übertragenes Feld belegt — der Aggregator
        // ordnet ihn ausdrücklich der Abrechnung zu.
        feld: "objekttyp",
        kanaele: {
          airbnb: { status: "bedingt", grund: "nichtDeckungsgleich" },
          booking: unklar,
          mybestdays: ja,
        },
      },
      {
        // content_sync.py:626-637. Booking.com übernimmt den Standort nur beim
        // ERSTEN Export — spätere Korrekturen kommen dort nicht mehr an.
        feld: "adresse",
        kanaele: {
          airbnb: ja,
          booking: { status: "bedingt", grund: "nurErstExport" },
          mybestdays: ja,
        },
      },
      {
        // content_sync.py:647-648. Für Airbnb nennt keine Quelle Koordinaten
        // als übertragenes Feld; bei Booking.com fallen sie unter „Standort"
        // und damit unter dieselbe Einmal-Regel wie die Adresse.
        feld: "geokoordinaten",
        kanaele: {
          airbnb: unklar,
          booking: { status: "bedingt", grund: "nurErstExport" },
          mybestdays: ja,
        },
      },
      {
        // content_sync.py:690-712 — Room-Type-Belegung
        feld: "belegung",
        kanaele: { airbnb: ja, booking: ja, mybestdays: ja },
      },
      {
        // Liegt in type_attributes und wird von _property_attrs nicht gemappt.
        // Booking.com KENNT die Zimmergröße — der Aggregator hat schlicht kein
        // Feld dafür. Airbnb kennt sie in dieser Kette nicht.
        feld: "groesseQm",
        kanaele: {
          airbnb: { status: "nein", grund: "kennsNicht" },
          booking: nichtUebertragbar,
          mybestdays: ja,
        },
      },
    ],
  },
  {
    gruppe: "ausstattung",
    felder: [
      {
        // content_sync.py:652-657 → common.py:531-541. NUR Property-
        // Ausstattung; die Room-Type-Liste des Aggregators senden wir nicht.
        // Airbnb übernimmt nur Merkmale mit eigener Entsprechung, der Rest
        // fällt still weg; bei Booking.com gilt zusätzlich eine Ausschlussliste.
        feld: "ausstattung",
        kanaele: {
          airbnb: { status: "bedingt", grund: "nurMitEntsprechung" },
          booking: vollsync,
          mybestdays: ja,
        },
      },
      {
        // content_builder.py:66-91 — Cover zuerst, Bildunterschrift mehrsprachig
        feld: "fotos",
        kanaele: { airbnb: ja, booking: vollsync, mybestdays: ja },
      },
      {
        // Beide Portale kennen Räume und Schlafmöglichkeiten sehr wohl — der
        // Aggregator hat dafür kein Feld (Betten nur lesend in seiner
        // Ausgabe-API). Also eine Lücke unseres Wegs, keine des Portals.
        feld: "raeume",
        kanaele: {
          airbnb: nichtUebertragbar,
          booking: nichtUebertragbar,
          mybestdays: ja,
        },
      },
    ],
  },
  {
    gruppe: "preise",
    felder: [
      {
        // ari_push.py:903-935 — Preis-Push je Rate-Plan
        feld: "grundpreis",
        kanaele: { airbnb: ja, booking: ja, mybestdays: ja },
      },
      {
        // ari_push.py:1127-1226 — Saison-/Segmentpreise
        feld: "saisonpreise",
        kanaele: { airbnb: ja, booking: ja, mybestdays: ja },
      },
      {
        // content_sync.py:938-982 setzt sell_mode per_person + derived_option.
        // ERREICHT AIRBNB NICHT: Channex mappt dorthin nur EINEN per_room-
        // Rate-Plan, der Gast-Aufschlag ist ein Listing-Setting in Airbnb, das
        // wir nirgends schreiben. Booking.com nur, wenn das Zimmer dort
        // Belegungspreise (OBP) aktiv hat — sonst sendet channels.py:712
        // pricing_type "Standard" und der Aufschlag fällt weg.
        feld: "zusatzgast",
        kanaele: {
          airbnb: portal,
          booking: { status: "bedingt", grund: "nurBelegungspreise" },
          mybestdays: ja,
        },
      },
      {
        // WIRD NICHT GESENDET: der channel_manager liest ausschließlich
        // pricing.taxes (content_sync.py:1127); pricing.fees[] — wo die
        // Reinigungsgebühr liegt — wird dort nie gelesen. Channex kennt zwar
        // type "fee", unser _TAX_TYPE (content_sync.py:1110) erzeugt ihn nie.
        feld: "reinigungsgebuehr",
        kanaele: { airbnb: portal, booking: portal, mybestdays: ja },
      },
      {
        // WIRD NICHT GESENDET (wie reinigungsgebuehr). Und sie landen auch
        // NICHT im Nachtpreis: der gepushte Preis kommt aus
        // resolver.effective_prices (resolver.py:402-431) und kennt nur
        // Rate-Plan, Override, Dynamic, Wochentag, Basis — keine Gebühren.
        feld: "weitereGebuehren",
        kanaele: { airbnb: portal, booking: portal, mybestdays: ja },
      },
      {
        // Wir legen Steuern in Channex an (content_sync.py:1112-1218), aber
        // Channex reicht sie nicht an die Portale weiter: der ausgehende
        // Payload (Open-Channel-API) enthält nur Verfügbarkeit, Preis und
        // Restriktionen — kein Steuerfeld. Booking.com-Steuern liegen im
        // Extranet, Airbnb-Steuern im Listing.
        feld: "steuern",
        kanaele: { airbnb: portal, booking: portal, mybestdays: ja },
      },
      {
        // Zusatzleistungen sind bei keinem Portal Teil der Rate
        feld: "zusatzleistungen",
        kanaele: {
          airbnb: { status: "nein", grund: "eigeneStrecke" },
          booking: { status: "nein", grund: "eigeneStrecke" },
          mybestdays: ja,
        },
      },
    ],
  },
  {
    gruppe: "verfuegbarkeit",
    felder: [
      {
        // ari_push.py:551-687. Belegt: der ausgehende Payload des Aggregators
        // besteht ausschließlich aus Verfügbarkeits- und Restriktions-
        // Änderungen — genau das kommt bei den Portalen an.
        feld: "verfuegbarkeit",
        kanaele: { airbnb: ja, booking: ja, mybestdays: ja },
      },
      {
        // ari_push.py:959-1005 (closed_to_arrival/closed_to_departure) — Teil
        // des ausgehenden Restriktions-Payloads.
        feld: "anAbreisetage",
        kanaele: { airbnb: ja, booking: ja, mybestdays: ja },
      },
      {
        // ari_push.py:903-957. min_stay_arrival, min_stay_through und max_stay
        // sind Teil des ausgehenden Payloads. Airbnb kennt allerdings kein
        // „Mindestaufenthalt über den Zeitraum" — dort wirkt nur die
        // Anreise-Variante.
        feld: "aufenthaltsdauer",
        kanaele: {
          airbnb: { status: "bedingt", grund: "nichtDeckungsgleich" },
          booking: ja,
          mybestdays: ja,
        },
      },
      {
        // common.py:182-219 setzt cut_off_time/cut_off_days als EINSTELLUNG am
        // Aggregator, nicht als Feld im ausgehenden Payload. Ob und wie die
        // Portale das übernehmen, ist nicht belegt.
        feld: "vorlaufzeit",
        kanaele: { airbnb: unklar, booking: unklar, mybestdays: ja },
      },
      {
        // common.py:182-219 (max_day_advance) — wie die Vorlaufzeit eine
        // Aggregator-Einstellung, kein Payload-Feld. Nicht belegt.
        feld: "buchungsfenster",
        kanaele: { airbnb: unklar, booking: unklar, mybestdays: ja },
      },
      {
        // ari_push.py:1043-1118 — stop_sell an ALLE Rate-Plans; Teil des
        // ausgehenden Restriktions-Payloads.
        feld: "stopSell",
        kanaele: { airbnb: ja, booking: ja, mybestdays: ja },
      },
    ],
  },
  {
    gruppe: "richtlinien",
    felder: [
      {
        // content_sync.py:316-420 schreibt die Zeiten in die Richtlinien des
        // Aggregators. Eine Weitergabe an die Portale ist dort nicht
        // dokumentiert — beide pflegen Richtlinien im eigenen Bereich.
        feld: "checkinZeiten",
        kanaele: { airbnb: unklar, booking: unklar, mybestdays: ja },
      },
      {
        // hotel_policies (Haustiere, Rauchen, Parken, Internet) — wie die
        // Check-in-Zeiten: geschrieben, aber keine belegte Weitergabe.
        feld: "hausregeln",
        kanaele: { airbnb: unklar, booking: unklar, mybestdays: ja },
      },
      {
        // NOCH NICHT gepusht — nur Freitext in important_information
        // (content_builder.py:114-116). Siehe Paket 1 des Ausbauplans.
        feld: "stornobedingungen",
        kanaele: { airbnb: portal, booking: portal, mybestdays: ja },
      },
      {
        // Kaution: Channex kennt sie nicht als Rate-Feld
        feld: "kaution",
        kanaele: {
          airbnb: { status: "nein", grund: "kennsNicht" },
          booking: portal,
          mybestdays: ja,
        },
      },
      {
        // Booking verlangt regional die Registriernummer
        feld: "lizenznummer",
        kanaele: { airbnb: portal, booking: ja, mybestdays: ja },
      },
      {
        // Mietvertrag/AGB: Portale akzeptieren keine Fremd-Vereinbarung
        feld: "mietvertrag",
        kanaele: { airbnb: nein, booking: nein, mybestdays: ja },
      },
    ],
  },
];

/** Zeilenform, die das Badge erwartet (ohne Abhängigkeit auf das UI-Paket). */
export type ChannelFieldRowLike = {
  name: string;
  status: Kanalstatus;
  hinweis?: string;
};

/** Flache Sicht für Nachschlagen am einzelnen Formularfeld. */
export const FELDER: Record<string, Feldregel> = Object.fromEntries(
  FELD_GRUPPEN.flatMap((g) => g.felder).map((f) => [f.feld, f]),
);

/**
 * Kurz-Kennzeichnung fürs Badge: geht das Feld an mindestens ein Portal, oder
 * lebt es nur auf der eigenen Strecke?
 */
export function istPortalfeld(feld: string): boolean {
  const regel = FELDER[feld];
  if (!regel) return false;
  return KANAELE.filter((k) => k !== "mybestdays").some((k) =>
    ["voll", "bedingt"].includes(regel.kanaele[k].status),
  );
}
