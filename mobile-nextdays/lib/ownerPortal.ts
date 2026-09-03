// Eigentümer-Portal — gegen den FastAPI-public_portal-Slice
// (/api/v1/public-portal). Typen exakt am Pydantic-Contract
// (apps/api/src/features/public_portal/schemas.py). Der eingeloggte Owner
// (Tenant-Auth, Rolle owner) sieht NUR seine zugeordneten Objekte; Beträge sind
// serverseitig maskiert (payout/price = null ohne Beträge-Sicht → als „—"
// rendern, NIE 0, Wurzel 4). Datenzugriff ausschließlich über lib/api.ts.
import { call, type Result } from "@/lib/api";

// --- Objekte ---------------------------------------------------------------

export type PortalProperty = {
  id: string;
  title: string;
  city: string | null;
  photo: string | null;
};

export async function getOwnerProperties(): Promise<
  Result<{ items: PortalProperty[]; total: number }>
> {
  return call("/public-portal/properties");
}

// --- Objektbereich: ein Objekt lesend (`pm_property_area`) ------------------

/**
 * Stammdaten EINES eigenen Objekts, lesend (`pm_property_area`).
 * Spiegel von apps/api/.../public_portal/schemas.py; die Feldnamen sind
 * bewusst dieselben wie im properties-Slice (lib/properties.ts), damit die
 * beiden Objekt-Ansichten der App nicht auseinanderlaufen.
 *
 * BEWUSST OHNE jedes Geldfeld — kein Preis, keine Währung, kein Umsatz. Der
 * Eigentümer sieht hier das HAUS, nicht das Geschäft; Beträge stehen in
 * „Auszahlungen" und unterliegen dort der serverseitigen Maske.
 */
export type PortalPropertyDetail = {
  id: string;
  title: string;
  description: string | null;
  property_type: string | null;
  // Objekt-Taxonomie (0198): Kategorie → Immobilientyp → Angebotsart.
  category_slug: string | null;
  subtype_slug: string | null;
  listing_type: string | null;
  total_rooms: string | null;
  status: string | null;
  street: string | null;
  house_number: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  timezone: string | null;
  max_guests: number | null;
  floors_total: number | null;
  floor_number: number | null;
  year_built: number | null;
  size_value: number | null;
  size_unit: string | null;
  bfe_number: string | null;
  /** Slugs des Objekt-Katalogs (Labels: lib/ausstattung.ts). */
  amenities: string[];
  /** Zweiter, GETRENNTER Katalog (0243) — nie mit `amenities` mischen. */
  room_amenities: string[];
  /** Einheiten dieses TYPS (property_units, 0265). 1 = der Normalfall. */
  units_total: number;
  cover_image_url: string | null;
};

/**
 * Fremdes/unbekanntes Objekt beantwortet der Server mit 404 (nie 403 — die
 * Existenz wird nicht verraten). Die App zeigt das als „nicht gefunden", nicht
 * als „kein Zugriff": sie weiß es schlicht nicht besser.
 */
export async function getOwnerProperty(
  propertyId: string,
): Promise<Result<PortalPropertyDetail>> {
  return call(`/public-portal/properties/${encodeURIComponent(propertyId)}`);
}

// --- Bilder eines Objekts (`pm_view_property_images`) -----------------------

/**
 * Ein Bild eines Objekts (`property_photos`). `url` ist absolut und öffentlich
 * (Bucket `property-images`, Migration 0062) — es gibt nichts zu signieren.
 * `caption` ist Locale → Text; die App führt genau eine Sprache (Deutsch) und
 * greift deshalb `de` ab, ohne einen anderen Eintrag zu erfinden.
 */
export type PortalImage = {
  id: string;
  property_id: string;
  url: string;
  sort_order: number;
  is_cover: boolean;
  caption: Record<string, string>;
  author: string | null;
};

export type PortalImageList = {
  property_id: string;
  items: PortalImage[];
  total: number;
};

export async function getOwnerPropertyImages(
  propertyId: string,
): Promise<Result<PortalImageList>> {
  return call(`/public-portal/properties/${encodeURIComponent(propertyId)}/images`);
}

// --- Fotoalbum über alle eigenen Objekte (`pm_photo_album`) -----------------

export type PortalAlbumGroup = {
  property_id: string;
  title: string;
  /** Ort des Objekts; null = nicht hinterlegt (dann steht dort nichts). */
  city: string | null;
  items: PortalImage[];
  total: number;
};

export type PortalPhotoAlbum = {
  groups: PortalAlbumGroup[];
  /** Summe über alle Gruppen — nicht selbst zusammenzählen. */
  total: number;
};

export async function getOwnerPhotoAlbum(): Promise<Result<PortalPhotoAlbum>> {
  return call("/public-portal/photo-album");
}

// --- Nicht-Umsatz-Statistiken (`pm_nonrevenue_charts`) ----------------------

/**
 * Verteilung nach Buchungskanal — ausschließlich ANZAHLEN, kein Betrag.
 * `nights` gehört zu den ANREISEN im Zeitraum (ganzer Aufenthalt), passt also
 * zu `reservations`/`avg_stay_nights` und NICHT zu `nights_booked`.
 */
export type PortalStatisticsChannel = {
  channel: string;
  /** Echter Portalname (`ota_name`); null = Direktbuchung. */
  ota_name: string | null;
  reservations: number;
  nights: number;
};

/**
 * EIN Monat der Auslastungsreihe.
 *
 * Randmonate sind ANGESCHNITTEN: `capacity_unit_nights` zählt dort nur die
 * Tage, die im angefragten Zeitraum liegen. Wer den ersten oder letzten Monat
 * mit einem vollen vergleicht, vergleicht deshalb zwei verschiedene
 * Bezugsgrößen — die Quote stimmt, die absoluten Nächte sind kürzer.
 *
 * Die App TYPISIERT die Reihe, RENDERT sie aber nicht: zwölf Monatsbalken sind
 * auf einem Telefon eine Tapete, und die Aussage („wie voll ist mein Haus")
 * steht schon in der Kennzahl oben. Die Monatssicht bleibt bewusst dem Web
 * vorbehalten. Der Typ steht hier trotzdem vollständig, damit er die Antwort
 * wahrheitsgemäß beschreibt — und damit ihn niemand später aus einer Anzeige
 * rückwärts erfindet.
 */
export type PortalStatisticsMonth = {
  month: string; // YYYY-MM
  nights_booked: number;
  owner_stay_nights: number;
  capacity_unit_nights: number;
  /** Prozent (0…100) wie oben; null = keine Kapazität in diesem Monat. */
  occupancy_rate: number | null;
  reservations: number;
};

/**
 * Auswertung OHNE Geld (Contract): Belegung, Auslastung, Aufenthaltsdauer,
 * Vorlaufzeit. Spiegel von PortalStatisticsResponse.
 *
 * ZWEI BEZUGSGRÖSSEN, die die Oberfläche NICHT vermischen darf: Belegung zählt
 * Nächte IM Zeitraum, die Buchungszahlen zählen ANREISEN im Zeitraum. Und
 * `occupancy_rate` ist bereits PROZENT (0…100), keine Quote — noch einmal mal
 * 100 gerechnet stünde dort das Hundertfache.
 *
 * `null` heißt „nicht berechenbar" (keine Kapazität, keine Anreise, kein
 * `booked_at`) und wird als „—" gerendert — nie als 0 (Wurzel 4).
 */
export type PortalStatistics = {
  property_id: string | null;
  date_from: string;
  date_to: string;
  /** Nächte im Zeitraum, die GASTbuchungen belegen. */
  nights_booked: number;
  /** Nächte der Eigennutzung (genehmigter Sperrantrag) — getrennt gezählt. */
  owner_stay_nights: number;
  /** Einheiten × Tage: die Nächte, die überhaupt verkauft werden konnten. */
  capacity_unit_nights: number;
  units_total: number;
  occupancy_rate: number | null;
  /** Anreisen im Zeitraum. */
  reservations: number;
  avg_stay_nights: number | null;
  avg_lead_time_days: number | null;
  /** Auf wie vielen Buchungen die Vorlaufzeit beruht (0 = nicht bekannt). */
  avg_lead_time_basis: number;
  by_channel: PortalStatisticsChannel[];
  /** Monatsreihe — vollständig typisiert, in der App bewusst nicht gerendert. */
  months: PortalStatisticsMonth[];
};

/**
 * Harte Obergrenze der Zeitspanne (Wurzel 8). Der Server lehnt alles darüber
 * mit 422 ab; die App baut deshalb gar keine längere Spanne — sie soll den
 * Fehler nicht erst provozieren und dann erklären müssen.
 */
export const STATISTIK_MAX_TAGE = 730;

// Kalendertag als UTC-Zeitstempel. BEWUSST nicht die lokale Mitternacht: eine
// Zeitumstellung im Fenster macht einen Tag 23 oder 25 Stunden lang, und die
// Differenz zweier lokaler Mitternächte ist dann keine ganze Tagesanzahl mehr
// (die Spanne 01.03.–01.04.2026 kam so einen Tag zu kurz heraus). Hier wird
// nur GEZÄHLT, nicht angezeigt — dafür ist UTC die richtige Achse.
function tagWert(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return NaN;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Ganze Tage zwischen zwei ISO-Daten (from inklusive, to inklusive). */
export function statistikSpanneTage(from: string, to: string): number {
  const a = tagWert(from);
  const b = tagWert(to);
  if (Number.isNaN(a) || Number.isNaN(b)) return NaN;
  return (b - a) / 86_400_000 + 1;
}

/** Liegt die Spanne innerhalb der Server-Obergrenze und ist sie vorwärts? */
export function statistikSpanneErlaubt(from: string, to: string): boolean {
  const tage = statistikSpanneTage(from, to);
  return Number.isFinite(tage) && tage >= 1 && tage <= STATISTIK_MAX_TAGE;
}

// Lokales YYYY-MM-DD (kein toISOString → keine UTC-Verschiebung).
function isoTag(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * Zeitraum „die letzten N Monate bis heute". 12 Monate ist der Server-Default
 * ohne from/to; die App schickt ihn trotzdem mit, weil sie auch 3 und 6 Monate
 * anbietet und der Zeitraum dann sichtbar EINE Quelle hat.
 */
export function statistikZeitraum(monate: number, heute: Date): { from: string; to: string } {
  const von = new Date(heute.getFullYear(), heute.getMonth() - monate + 1, 1);
  return { from: isoTag(von), to: isoTag(heute) };
}

export async function getOwnerStatistics(input: {
  from: string;
  to: string;
  propertyId?: string | null;
}): Promise<Result<PortalStatistics>> {
  const p = new URLSearchParams({ from: input.from, to: input.to });
  if (input.propertyId) p.set("property_id", input.propertyId);
  return call(`/public-portal/statistics?${p.toString()}`);
}

// --- Kalender (read-only, maskiert) ----------------------------------------

export type PortalCalendarDay = {
  date: string; // YYYY-MM-DD
  status: string; // open | booked | blocked
  // Netto-Preis/Nacht; null ohne Beträge-Sicht (kein Fallback).
  price: number | null;
};

export async function getOwnerCalendar(
  propertyId: string,
  start: string,
  end: string,
): Promise<Result<{ property_id: string; days: PortalCalendarDay[] }>> {
  const p = new URLSearchParams({ property_id: propertyId, start, end });
  return call(`/public-portal/calendar?${p.toString()}`);
}

// --- Earnings (maskiert) ----------------------------------------------------

export type PortalEarningsItem = {
  property_id: string;
  title: string;
  nights: number;
  reservations: number;
  // null ohne Beträge-Sicht (kein Fallback).
  payout: number | null;
  currency: string;
};

export type PortalEarnings = {
  period_from: string;
  period_to: string;
  items: PortalEarningsItem[];
  total_payout: number | null;
  currency: string;
};

export async function getOwnerEarnings(
  periodFrom: string,
  periodTo: string,
): Promise<Result<PortalEarnings>> {
  const p = new URLSearchParams({ period_from: periodFrom, period_to: periodTo });
  return call(`/public-portal/earnings?${p.toString()}`);
}

// --- Statements (eigene, finalisiert) --------------------------------------

export type PortalStatement = {
  id: string;
  period_from: string;
  period_to: string;
  status: string;
  owner_payout: number;
  currency: string;
  invoice_number: string | null;
  created_at: string | null;
};

export async function getOwnerStatements(): Promise<
  Result<{ items: PortalStatement[]; total: number }>
> {
  return call("/public-portal/statements");
}

// --- Sperr-Anfragen ---------------------------------------------------------

export type BlockRequest = {
  id: string;
  property_id: string;
  start_date: string;
  end_date: string;
  status: string;
  created_at: string | null;
};

export async function getBlockRequests(): Promise<
  Result<{ items: BlockRequest[]; total: number }>
> {
  return call("/public-portal/block-requests");
}

/** Eine bestellbare Leistung zu einer Sperre (0510). Der Name kommt vom
 *  Server — die Regelliste selbst darf ein Eigentümer nicht sehen (§4.3). */
export type BestellteLeistung = {
  rule_id: string;
  name: string;
};

/** Was zu einer Sperre DIESES Objekts bestellbar ist. Bis 0538 kannte die App
 *  das nicht: ein Antrag von hier bestellte strukturell nie eine Leistung und
 *  erzeugte damit garantiert keine Reinigung. */
export async function getBestellbareLeistungen(
  propertyId: string,
): Promise<Result<{ items: BestellteLeistung[] }>> {
  return call(
    `/public-portal/block-requests/leistungen/${encodeURIComponent(propertyId)}`,
  );
}

export async function createBlockRequest(input: {
  property_id: string;
  start_date: string;
  end_date: string;
  /** Regel-IDs der Leistungen, die ich zu dieser Sperre bestelle (0510).
   *  Leer = keine Aufgabe. Die Agentur genehmigt jede einzeln (0538). */
  bestellte_leistungen?: string[];
}): Promise<Result<BlockRequest>> {
  return call("/public-portal/block-requests", { method: "POST", body: input });
}

// --- Zählerstände -----------------------------------------------------------

export type MeterReading = {
  id: string;
  property_id: string;
  meter_kind: string;
  value: number;
  read_at: string;
  created_at: string | null;
};

export async function getMeterReadings(
  propertyId: string,
): Promise<Result<{ items: MeterReading[]; total: number }>> {
  const p = new URLSearchParams({ property_id: propertyId });
  return call(`/public-portal/meter-readings?${p.toString()}`);
}

export async function createMeterReading(input: {
  property_id: string;
  meter_kind: string;
  value: number;
  read_at: string;
}): Promise<Result<MeterReading>> {
  return call("/public-portal/meter-readings", { method: "POST", body: input });
}
