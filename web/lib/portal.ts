"use server";

// Eigentümer-Portal (§4.2) — Server-Actions gegen den FastAPI-public_portal-Slice
// (/api/v1/public-portal). Typen exakt am Pydantic-Contract
// (apps/api/src/features/public_portal/schemas.py); Schwesterdatei der
// React-Native-Fassung mobile-nextdays/lib/ownerPortal.ts.
//
// Der eingeloggte Eigentümer sieht NUR seine zugeordneten Objekte; Beträge sind
// serverseitig über guest_masking maskiert. `null` heißt „keine Beträge-Sicht"
// und wird als „—" gerendert — NIE als 0 und nie mit einem Ersatzwert
// aufgefüllt (Wurzel 4).
//
// Business-Logik bleibt im Backend (PROJECT.md §2): hier wird nur aufgerufen.
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function call<T>(
  path: string,
  opts: { method?: "GET" | "POST"; body?: unknown } = {},
): Promise<Result<T>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    return { ok: true, data: await api<T>(path, { ...opts, token }) };
  } catch (exc) {
    // Ein Ladefehler darf nicht als „nichts vorhanden" erscheinen: „leer" und
    // „konnte nicht laden" sind zwei verschiedene Aussagen (Wurzel 4/5).
    return {
      ok: false,
      error: exc instanceof ApiError ? exc.message : "Backend nicht erreichbar.",
    };
  }
}

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

// --- Objektbereich (pm_property_area, LESEND) -------------------------------
// Vier neue GET-Wege, alle read-only. Es gibt hier bewusst KEINE Schreib-Action:
// der Eigentümer ist §4.2 read-only, und ein Speicherpfad im Portal wäre nicht
// „ein Knopf zu viel", sondern eine zweite Tür an einer Fläche, die keine haben
// darf (Wurzel 3).
//
// KEIN GELDFELD IN DIESEM GANZEN ABSCHNITT — kein Betrag, kein Preis, KEINE
// WÄHRUNG. Die Antwort-Schemas des Backends führen bewusst keins
// (public_portal/schemas.py, Abschnitt „Objektbereich, Bilder, Fotoalbum,
// Statistik"), und diese Spiegelung führt deshalb auch keins: was der Typ nicht
// kennt, kann die Fläche nicht versehentlich rendern. Ein Währungsfeld in einer
// geldfreien Antwort wäre die Einladung, später doch einen Betrag danebenzu-
// stellen — deshalb steht hier auch kein `currency`.

/**
 * EIN Objekt des Eigentümers, lesend.
 *
 * Spiegelt `PortalPropertyDetail` aus
 * apps/api/src/features/public_portal/schemas.py (GET
 * /public-portal/properties/{property_id}) — Feld für Feld, inklusive der
 * NULLBARKEIT. `status` und `max_guests` sind serverseitig optional; hier
 * stehen sie deshalb als `| null` und werden in der Fläche als „—" gerendert,
 * nie als 0 oder leerer Text (Wurzel 4).
 *
 * `lat`/`lng` führt das Backend ebenfalls. Sie stehen hier NICHT, weil das
 * Portal keine Karte zeigt — ein Feld im Typ, das nichts rendert, ist eine
 * Behauptung über die Fläche, die nicht stimmt.
 */
export type PortalPropertyDetail = {
  id: string;
  title: string;
  /** Objektbeschreibung. `null` = nicht hinterlegt → eigener Hinweistext,
   *  nie ein erfundener Platzhaltertext (Wurzel 4). */
  description: string | null;
  /** Legacy-Objekttyp (ferienhaus, appartement, …) für `objects.meta.type.*`. */
  property_type: string | null;
  /** Objekt-Taxonomie (0198). Slugs, keine Anzeigetexte. */
  category_slug: string | null;
  subtype_slug: string | null;
  listing_type: string | null;
  /** Zimmeranzahl-Bucket („2-5", „50+") — nur bei Hotels/Betrieben gesetzt. */
  total_rooms: string | null;
  /** draft | active | inactive. `null` = nicht erfasst. */
  status: string | null;

  // Adresse
  street: string | null;
  house_number: string | null;
  postal_code: string | null;
  city: string | null;
  /** ISO-3166-1 alpha-2. */
  country: string | null;
  /** IANA-Zeitzone (0258). `null` = nicht erfasst. */
  timezone: string | null;

  // Kapazität und Bau
  max_guests: number | null;
  floors_total: number | null;
  floor_number: number | null;
  year_built: number | null;
  size_value: number | null;
  size_unit: string | null;
  /** DK-Katasternummer (Objektkartei Stufe 1). */
  bfe_number: string | null;

  /** Objekt-Ausstattung (Slugs) — Anzeige über `useAmenityLabels`. */
  amenities: string[];
  /** Zimmer-Ausstattung (eigener Channex-Katalog, 0243) — eigener Namensraum,
   *  nie mit `amenities` in eine Liste mischen. */
  room_amenities: string[];

  /** Anzahl der Einheiten dieses TYPS (property_units, 0265). Serverseitig
   *  mit Vorgabe 1 — 1 property = 1 Typ mit n ≥ 1 Einheiten. */
  units_total: number;
  /** Titelbild, falls vorhanden — dieselbe URL wie in `images`. */
  cover_image_url: string | null;
};

export async function getOwnerProperty(
  propertyId: string,
): Promise<Result<PortalPropertyDetail>> {
  // Fremde/unbekannte ID beantwortet das Backend mit 404 (nie 403): die
  // Existenz fremder Objekte wird nicht verraten.
  return call(`/public-portal/properties/${encodeURIComponent(propertyId)}`);
}

// --- Bilder (pm_view_property_images / pm_photo_album) ----------------------

/**
 * EIN Bild eines Objekts (`property_photos`, 0061) — spiegelt `PortalImage`.
 *
 * `url` ist eine fertige, absolute URL: der Bucket `property-images` ist
 * öffentlich (0062, damit die Buchungsstrecke sie anonym laden kann). Es gibt
 * hier nichts zu signieren und keine Ablaufzeit zu behandeln.
 */
export type PortalImage = {
  id: string;
  /** Zu welchem Objekt das Bild gehört — im Album die Klammer zur Gruppe. */
  property_id: string;
  url: string;
  sort_order: number;
  is_cover: boolean;
  /** Locale → Bildunterschrift. Leer = keine. */
  caption: Record<string, string>;
  /** Urheber/Fotograf. `null` = nicht erfasst. */
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
  return call(
    `/public-portal/properties/${encodeURIComponent(propertyId)}/images`,
  );
}

/** Ein Objekt mit seinen Bildern im Fotoalbum (`PortalAlbumGroup`). Die
 *  Gruppierung kommt VOM SERVER — die UI ordnet kein Bild selbst zu. */
export type PortalAlbumGroup = {
  property_id: string;
  title: string;
  /** Ort unter dem Objektnamen. `null` = keiner erfasst → Zeile bleibt leer,
   *  es wird keiner erfunden. */
  city: string | null;
  items: PortalImage[];
  /** Anzahl der Bilder DIESER Gruppe. */
  total: number;
};

export type PortalPhotoAlbum = {
  groups: PortalAlbumGroup[];
  /** Summe über alle Gruppen. */
  total: number;
};

export async function getOwnerPhotoAlbum(): Promise<Result<PortalPhotoAlbum>> {
  return call("/public-portal/photo-album");
}

// --- Statistiken (pm_nonrevenue_charts) -------------------------------------
//
// ZWEI BEZUGSGRÖSSEN, die das Backend bewusst trennt — und die die Fläche
// deshalb BESCHRIFTEN muss, sonst liest sich das Ergebnis wie ein Widerspruch
// („12 Buchungen, aber 400 Nächte"):
//   * Belegung (`nights_booked`, `owner_stay_nights`, `occupancy_rate`) zählt
//     NÄCHTE, die IM Zeitraum liegen — auch aus früher begonnenen Buchungen.
//   * `reservations`, `avg_stay_nights`, `avg_lead_time_days` beziehen sich auf
//     ANREISEN im Zeitraum. Eine Buchung ist ein Ereignis und lässt sich nicht
//     über zwei Monate halbieren.
// Ebenfalls kein Geld: keine Beträge, keine Preise, keine Währung (§4.3).

/** Verteilung nach Buchungskanal — ausschließlich ANZAHLEN. */
export type PortalStatisticsChannel = {
  /** Interner Kanalwert (`calendar.channel.*`). */
  channel: string;
  /** Echter Portalname (`ota_name`, z. B. „Booking.com", „myBestDays").
   *  `null` = kein Portal im Spiel (Direktbuchung). Für Label UND Logo hat er
   *  Vorrang vor `channel` — das ist im Projekt der Weg
   *  (components/reservierungen/stats-cards.tsx). */
  ota_name: string | null;
  /** ANREISEN im Zeitraum über diesen Kanal. */
  reservations: number;
  /** Nächte, die DIESE Anreisen insgesamt umfassen — der ganze Aufenthalt,
   *  auch über das Zeitraum-Ende hinaus. Passt damit zu `reservations`, NICHT
   *  zu `nights_booked`. */
  nights: number;
};

/** EIN Monat der Zeitreihe. Die Reihe ist lückenlos: auch ein Monat ohne
 *  Buchung kommt vor (0 Nächte, echte Kapazität). */
export type PortalStatisticsMonth = {
  /** „YYYY-MM". */
  month: string;
  /** Gastnächte, die IN diesem Monat liegen. Summe über alle Monate =
   *  `nights_booked`. */
  nights_booked: number;
  /** Nächte der Eigennutzung in diesem Monat. */
  owner_stay_nights: number;
  /** Einheiten × Tage DIESES Monats, die IM ZEITRAUM liegen — Randmonate sind
   *  angeschnitten. */
  capacity_unit_nights: number;
  /** (nights_booked + owner_stay_nights) / capacity_unit_nights in Prozent.
   *  `null` = keine Kapazität in diesem Monat → „—", NIE 0 (Wurzel 4). */
  occupancy_rate: number | null;
  /** ANREISEN in diesem Monat. Summe über alle Monate = `reservations`. */
  reservations: number;
};

export type PortalStatisticsResponse = {
  /** `null` = über alle zugeordneten Objekte gerechnet. */
  property_id: string | null;
  date_from: string;
  date_to: string;

  // --- Bezugsgröße NÄCHTE IM ZEITRAUM ---
  /** Nächte, die im Zeitraum durch GASTbuchungen belegt sind. */
  nights_booked: number;
  /** Nächte, die der Eigentümer selbst nutzt (0241). Getrennt ausgewiesen: sie
   *  belegen den Kalender genauso, sind aber keine Vermarktungsleistung — wer
   *  beides in einer Zahl sähe, hielte die eigene Ferienwoche für Auslastung. */
  owner_stay_nights: number;
  /** Einheiten × Tage im Zeitraum = die Nächte, die überhaupt verkauft werden
   *  KONNTEN (0265). */
  capacity_unit_nights: number;
  units_total: number;
  /** (nights_booked + owner_stay_nights) / capacity_unit_nights in Prozent.
   *  `null` = keine Kapazität → „—", nie 0 % (Wurzel 4). */
  occupancy_rate: number | null;

  // --- Bezugsgröße ANREISEN IM ZEITRAUM ---
  reservations: number;
  /** Durchschnittliche Aufenthaltsdauer in Nächten. `null` ohne Anreise. */
  avg_stay_nights: number | null;
  /** Durchschnittliche Vorlaufzeit in Tagen: von der Buchung beim Portal
   *  (`reservations.booked_at`) bis zur Anreise — NIE aus `created_at`
   *  (Wurzel 5b). `null` = keine Buchung mit bekanntem Buchungszeitpunkt. */
  avg_lead_time_days: number | null;
  /** Auf wie vielen Buchungen die Vorlaufzeit beruht. 0 zusammen mit
   *  `avg_lead_time_days = null` heißt „nicht bekannt" — die Fläche muss das
   *  benennen, statt einen Durchschnitt ohne Grundlage zu zeigen. */
  avg_lead_time_basis: number;

  by_channel: PortalStatisticsChannel[];
  /** Monatsreihe, aufsteigend und lückenlos. */
  months: PortalStatisticsMonth[];
};

/**
 * Nicht-Umsatz-Auswertungen des Eigentümers.
 *
 * `propertyId` muss im Owner-Scope liegen, sonst 404. Die Spanne ist
 * serverseitig auf 730 Tage gedeckelt (422 darüber, Wurzel 8) — die Fläche
 * meldet den Grund, statt still einen kürzeren Zeitraum zu zeigen.
 */
export async function getOwnerStatistics(input: {
  propertyId?: string | null;
  from: string;
  to: string;
}): Promise<Result<PortalStatisticsResponse>> {
  const p = new URLSearchParams({ from: input.from, to: input.to });
  if (input.propertyId) p.set("property_id", input.propertyId);
  return call(`/public-portal/statistics?${p.toString()}`);
}

// --- Belegungskalender (read-only, maskiert) --------------------------------

/**
 * EINE Buchung, die eine Nacht belegt — eine Zeile je EINHEIT (0265).
 * Spiegelt apps/api/.../public_portal/schemas.py:PortalNightBooking.
 *
 * Seit 0265 führt ein Objekt (= ein Einheiten-TYP) n ≥ 1 Einheiten; dieselbe
 * Nacht kann daher mehrere Buchungen tragen. Die verdichteten Felder auf
 * `PortalCalendarDay` (guest_first_name, booking_source) beschreiben nur die
 * ERSTE davon — wer sie neben der SUMME `owner_payout_per_night` rendert,
 * ordnet den Gesamtbetrag einem einzelnen Gast zu. Deshalb rendert die UI
 * je Buchung einen eigenen Chip aus dieser Liste.
 */
export type PortalNightBooking = {
  /** Klammert die Nächte EINES Aufenthalts zusammen (Chip über den Aufenthalt
   *  statt je Nacht) und ist der Schlüssel für die Aufenthaltssumme. */
  reservation_id: string;
  /** Belegte Einheit; `null` = Buchung liegt auf dem Typ als Ganzes
   *  (Altbestand vor 0265 oder Objekt mit genau einer Einheit). */
  unit_id: string | null;
  /** Netto-Auszahlung des Eigentümers für DIESE Buchung in DIESER Nacht.
   *  `null` = nicht ausweisbar → „—", nie eine 0 (Wurzel 4). */
  owner_payout_per_night: number | null;
  /** Währung DIESES Betrags, aus den Daten. Kein €-Fallback. */
  currency: string | null;
  /** provision | betrag | naechte — warum kein Betrag ausgewiesen wird. */
  payout_unknown_reason: string | null;
  /** NUR der Vorname (zentrale GuestMask, §4.2). */
  guest_first_name: string | null;
  /** Buchungsquelle (ota_name, sonst channel) — für Logo und Kanalfarbe. */
  booking_source: string | null;
  /**
   * EIGENNUTZUNG des Eigentümers (0241) — der genehmigte Sperrantrag.
   *
   * Die Nacht ist belegt, bringt aber keinen Umsatz: `owner_payout_per_night`
   * und `payout_unknown_reason` sind beide `null`. Das unterscheidet sie von
   * einer Buchung ohne ausweisbaren Betrag, wo eine Grundlage FEHLT. Ohne
   * dieses Feld müsste die UI den Unterschied am leeren Gastnamen raten und
   * würde die eigene Sperre als „nicht ausweisbar" beschriften.
   */
  is_owner_stay: boolean;
};

export type PortalCalendarDay = {
  date: string; // YYYY-MM-DD
  status: string; // open | booked | blocked
  /**
   * GAST-Verkaufspreis der Nacht. Für einen Eigentümer laut §4.2 IMMER `null`
   * (die Maske gibt ihm keine Gast-Beträge). Dieses Feld wird im Portal
   * bewusst NICHT gerendert — es steht hier nur, weil der Contract es führt.
   */
  price: number | null;
  /**
   * Der EINZIGE Betrag, den der Eigentümer sehen darf: seine Netto-Auszahlung
   * für DIESE Nacht (Buchungs-Payout abzüglich Provision, über die Nächte des
   * Aufenthalts verteilt). `null` = kein Betrag ausweisbar → „—" rendern, nie
   * eine 0 erfinden (Wurzel 4); den Grund nennt `owner_payout_unknown_reason`.
   */
  owner_payout_per_night: number | null;
  /** Währung DIESES Betrags, aus den Daten. Fehlt sie, rendert formatCurrency
   *  symbollos — es wird kein „EUR" ergänzt (Wurzel 4). */
  currency: string | null;
  /** provision | betrag | naechte — warum kein Betrag ausgewiesen wird. */
  owner_payout_unknown_reason: string | null;
  /** NUR der Vorname (zentrale GuestMask). Der volle Name erscheint im
   *  Eigentümer-Pfad nie (§4.2). Bei mehreren belegten Einheiten der ERSTE —
   *  die vollständige Aufstellung steht in `bookings`. */
  guest_first_name: string | null;
  /** Buchungsquelle der Nacht (ota_name, sonst channel) — für das echte
   *  Portal-Logo aus lib/channel-logos.ts. Ebenfalls nur die ERSTE Buchung. */
  booking_source: string | null;
  /** Alle Buchungen dieser Nacht, eine je belegter EINHEIT. Leer = keine
   *  Buchung. Die drei Felder oben sind nur ihre Verdichtung. */
  bookings: PortalNightBooking[];
  /** Wie viele Einheiten des Typs an diesem Tag belegt sind. */
  units_booked: number;
  /** Wie viele Einheiten der Typ überhaupt führt (property_units). Ohne diese
   *  Zahl ist `units_booked` nicht einzuordnen. */
  units_total: number;
};

export type PortalCalendar = {
  property_id: string;
  days: PortalCalendarDay[];
};

export async function getOwnerCalendar(
  propertyId: string,
  start: string,
  end: string,
): Promise<Result<PortalCalendar>> {
  const p = new URLSearchParams({ property_id: propertyId, start, end });
  return call(`/public-portal/calendar?${p.toString()}`);
}

// --- Einnahmen (maskiert) ---------------------------------------------------

export type PortalEarningsItem = {
  property_id: string;
  title: string;
  nights: number;
  reservations: number;
  /** `null` ohne Beträge-Sicht (kein Fallback). */
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
  const p = new URLSearchParams({
    period_from: periodFrom,
    period_to: periodTo,
  });
  return call(`/public-portal/earnings?${p.toString()}`);
}

// --- Abrechnungen (eigene, finalisierte) ------------------------------------

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

// --- Sperr-Anträge ----------------------------------------------------------
// Der Eigentümer kann NICHT selbst sperren, nur BEANTRAGEN (§4.2). Es gibt im
// Portal bewusst keinen Weg auf /calendar/block — die Agentur entscheidet.

export type BlockRequest = {
  id: string;
  property_id: string;
  /** INKLUSIV („vom 1. bis zum 5."). */
  start_date: string;
  /** INKLUSIV — die Umrechnung auf den exklusiven Kalender-Range macht erst
   *  die Genehmigung im Backend. */
  end_date: string;
  status: string;
  /** Warum gesperrt werden soll (Eigennutzung, Handwerker …). */
  reason: string | null;
  /** Wann entschieden wurde — nicht, WER entschieden hat (§4.3). */
  decided_at: string | null;
  /** Anmerkung der Verwaltung zur Entscheidung. */
  decision_note: string | null;
  created_at: string | null;
  /** Ich habe beim Antrag erklärt, den Vertrag beenden zu wollen. */
  ist_kuendigung: boolean;
  /** Die Verwaltung hat meinen Sperrantrag als Kündigung ausgelegt. Muss
   *  sichtbar sein — es ist eine Auslegung MEINER Erklärung, und ich muss ihr
   *  widersprechen können, wenn sie falsch ist. */
  als_kuendigung_gewertet: boolean;
  /** Zu diesem Tag endet der Vertrag (erster Tag ohne Vertrag). */
  vertragsende_gesetzt_auf: string | null;
  /** Stufe 1 der Freigabe (0389): „nicht_noetig" (mein eigener Antrag —
   *  Normalfall), „offen" (wartet auf den Eigentümer), „freigegeben",
   *  „abgelehnt". Ein Familienmitglied muss sehen, WO sein Antrag liegt:
   *  „offen" allein hieße wahlweise „wartet auf die Familie" oder „wartet auf
   *  die Verwaltung" — zwei sehr verschiedene Wartezeiten. */
  owner_freigabe: string;
  /** Begründung des Eigentümers bei Ablehnung. */
  owner_decision_note: string | null;
  /** Was ich zu dieser Sperre BESTELLT habe (0510). Leer = es entsteht keine
   *  Aufgabe. Vorher erzeugte jede Sperre dieselbe Kette wie eine Gastbuchung
   *  — Reinigung und Wäsche liefen an, ohne dass jemand sie beauftragt hatte. */
  bestellte_leistungen: BestellteLeistung[];
};

/** Eine bestellbare bzw. bestellte Leistung (0510). Der Name kommt vom Server
 *  mit, damit hier keine UUID steht — die Regelliste selbst darf ein
 *  Eigentümer nicht sehen (§4.3). */
export type BestellteLeistung = {
  rule_id: string;
  name: string;
};

/** Was zu einer Sperre DIESES Objekts bestellbar ist. */
export async function getBestellbareLeistungen(
  propertyId: string,
): Promise<Result<{ items: BestellteLeistung[] }>> {
  return call(
    `/public-portal/block-requests/leistungen/${encodeURIComponent(propertyId)}`,
  );
}

export async function getBlockRequests(): Promise<
  Result<{ items: BlockRequest[]; total: number }>
> {
  return call("/public-portal/block-requests");
}

export async function createBlockRequest(input: {
  property_id: string;
  start_date: string;
  end_date: string;
  reason?: string | null;
  /** Ich will den Vermarktungsvertrag beenden, nicht nur Nächte sperren. Ein
   *  eigenes Feld, weil es eine andere Erklärung ist — aus dem Begründungstext
   *  wird nichts abgeleitet. */
  ist_kuendigung?: boolean;
  /** Regel-IDs der Leistungen, die ich zu dieser Sperre bestelle (0510).
   *  Leer/weggelassen = keine Aufgabe. */
  bestellte_leistungen?: string[];
}): Promise<Result<BlockRequest>> {
  return call("/public-portal/block-requests", { method: "POST", body: input });
}

// --- Zählerstände (append-only) ---------------------------------------------
// Es gibt bewusst KEIN PATCH/DELETE im Contract: ein abgelesener Zählerstand
// ist eine Messung, keine Meinung. Korrekturen laufen über einen NEUEN Eintrag,
// die Historie bleibt vollständig.

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

// --- Dienstleistungen buchen ------------------------------------------------
// Der Katalog kommt VOM SERVER (/public-portal/service-types) — die UI führt
// keine eigene Leistungsliste. Der Anzeigename entsteht aus dem stabilen `key`
// über `portal.services.type.<key>`; ein deutsches Wort aus der DB wäre in 23
// von 24 Sprachen falsch (Wurzel 4).
//
// Ein Auftrag ist ENTWEDER ein Katalogtyp (`service_type_id`) ODER ein Freitext
// — nie beides und nie keines; das Backend antwortet sonst mit 422. Der POST
// ist serverseitig idempotent (derselbe Auftrag am selben Tag liefert den
// bestehenden zurück, Wurzel 2).

export type ServiceType = {
  id: string;
  /** Stabiler Katalog-Schlüssel (endreinigung, hauptreinigung, …). */
  key: string;
  kategorie: string; // cleaning | maintenance | inspection
  standard_dauer_minuten: number | null;
  /** true = Systemvorgabe, false = eigener Typ des Betriebs. */
  system: boolean;
};

export async function getServiceTypes(): Promise<
  Result<{ items: ServiceType[]; total: number }>
> {
  return call("/public-portal/service-types");
}

export type ServiceRequest = {
  id: string;
  property_id: string | null;
  service_type_id: string | null;
  /** Katalog-Schlüssel für die Übersetzung; null bei Freitext-Aufträgen. */
  service_key: string | null;
  titel: string;
  notiz: string | null;
  status: string;
  /** Sagt NUR, OB jemand dran ist — wer, geht den Eigentümer nichts an (§4.3). */
  zugewiesen: boolean;
  start_at: string | null;
  created_at: string | null;
};

export async function getServiceRequests(): Promise<
  Result<{ items: ServiceRequest[]; total: number }>
> {
  return call("/public-portal/service-requests");
}

export async function createServiceRequest(input: {
  property_id: string;
  service_type_id?: string | null;
  freitext?: string | null;
  datum: string;
  datum_bis?: string | null;
  notiz?: string | null;
}): Promise<Result<ServiceRequest>> {
  return call("/public-portal/service-requests", {
    method: "POST",
    body: input,
  });
}
