// Daten-Schicht des Multi-Kalenders (Server Component, KEIN "use server").
//
// Zwei Quellen, ein Fenster: `/calendar/board` liefert je Objekt und Tag
// Verfügbarkeit + Tagespreis in EINEM Aufruf (kein N+1), `/reservations` die
// Buchungen. Deren Filter greift auf die ANREISE — eine Buchung, die vor dem
// Fenster begann und hineinragt, fiele sonst heraus. Deshalb wird die Anreise
// grosszügig vorher angesetzt und clientseitig auf Überlappung gefiltert.
import { api } from "./api-server";
import { tagPlus } from "./kalender-datum";

export { isoTag, tagPlus } from "./kalender-datum";

export type TagStatus = "open" | "booked" | "blocked";

export interface KalenderTag {
  date: string;
  status: TagStatus;
  source: string;
  /** Tagespreis aus dem Resolver; null = kein Preisplan (nichts erfinden). */
  price: number | null;
  price_source: string;
  /** Mindestaufenthalt aus dem Rate-Plan; null = keiner hinterlegt. */
  min_stay: number | null;
  closed_to_arrival?: boolean;
  closed_to_departure?: boolean;
}

export interface KalenderObjektDaten {
  property_id: string;
  currency: string | null;
  days: KalenderTag[];
}

export interface KalenderBuchung {
  id: string;
  property_id: string;
  guest_name: string;
  channel: string;
  ota_name: string | null;
  check_in: string;
  check_out: string;
  status: string;
  total_amount: number | null;
  currency: string;
  num_guests: number;
  is_owner_stay: boolean;
  stay_note: string | null;
}

/** Eine benannte Saison eines Objekts samt ihrer Zeiträume. */
export interface Saison {
  id: string;
  property_id: string;
  name: string;
  /** Farbe des Regelsatzes (#rrggbb) — dieselbe wie im Raster. */
  color: string;
  mode: "percent" | "fixed";
  amount: number;
  /** Mindestaufenthalt der zugewiesenen Tage; null = keine Regel. */
  min_stay: number | null;
  max_stay: number | null;
  /** Wochentage ohne Anreise bzw. Abreise, 0 = Montag … 6 = Sonntag. */
  closed_arrival_weekdays: number[];
  closed_departure_weekdays: number[];
  /**
   * Mindestaufenthalt je ANREISETAG (0576), Schlüssel „0"…„6" (0 = Montag).
   * Ein fehlender Wochentag heißt „hier gilt `min_stay`" — nicht 0.
   */
  min_stay_by_weekday: Record<string, number>;
  assignments: { id: string; season_id: string; start_date: string; end_date: string }[];
}

/** Ein Regelsatz zum Anlegen oder Ändern (alles, was der Editor sendet). */
export interface RegelsatzEingabe {
  name: string;
  color: string;
  mode: "percent" | "fixed";
  amount: number;
  min_stay: number | null;
  max_stay: number | null;
  closed_arrival_weekdays: number[];
  closed_departure_weekdays: number[];
  min_stay_by_weekday: Record<string, number>;
}

/**
 * Eine Rabattregel des Objekts (`property_discounts`). Sie steht als eigene
 * Zeile im Regelsatz — genau wie beim Vorbild, wo unter dem Saisonnamen die
 * einzelnen Regeln aufgezählt sind („10 % Rabatt · Mindestens 2 Wochen").
 */
export interface Rabatt {
  id: string;
  property_id: string;
  /** Regelsatz, zu dem der Rabatt gehört; null = gilt objektweit. */
  season_id: string | null;
  discount_type: "length_of_stay" | "early_booker" | "last_minute" | "custom" | "promotion";
  /** "percent" oder "fixed" — Prozentsatz oder Betrag in der Objektwährung. */
  discount_kind: string;
  /** Basispunkte: 1000 = 10,00 %. */
  discount_bps: number;
  discount_amount: number | null;
  active: boolean;
  min_nights: number | null;
  /** Frühbucher: so viele Tage VOR Anreise mindestens gebucht. */
  lead_min_days: number | null;
  /** Last-Minute: höchstens so viele Tage vor Anreise. */
  lead_max_days: number | null;
  stay_ranges: { from: string; to: string }[];
  name: Record<string, string>;
}

export interface KalenderFenster {
  start: string;
  end: string;
  objekte: KalenderObjektDaten[];
  buchungen: KalenderBuchung[];
}

/** Längste Buchung, die noch in ein Fenster hineinragen kann (Tage). */
const VORLAUF_TAGE = 120;

/** Verfügbarkeit, Preise und Buchungen aller Objekte für [start, end). */
export async function getKalenderFenster(
  propertyIds: string[],
  start: string,
  end: string,
): Promise<KalenderFenster> {
  if (propertyIds.length === 0) {
    return { start, end, objekte: [], buchungen: [] };
  }
  const qs = new URLSearchParams({ start, end });
  for (const id of propertyIds) qs.append("property_ids", id);
  const rq = new URLSearchParams({
    date_from: tagPlus(start, -VORLAUF_TAGE),
    date_to: end,
    limit: "500",
  });
  const [board, res] = await Promise.all([
    api<{ items: KalenderObjektDaten[] }>(`/calendar/board?${qs}`, { cache: "no-store" }),
    api<{ items: KalenderBuchung[]; truncated: boolean }>(`/reservations?${rq}`, {
      cache: "no-store",
    }),
  ]);
  const ids = new Set(propertyIds);
  const buchungen = res.items.filter(
    (b) =>
      ids.has(b.property_id) &&
      b.status !== "cancelled" &&
      b.check_out > start &&
      b.check_in < end,
  );
  return { start, end, objekte: board.items, buchungen };
}
