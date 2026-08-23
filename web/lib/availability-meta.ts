// Verfügbarkeits-Datenmodell (Availability). Gespeichert im flexiblen
// jsonb-Feld `type_attributes.availability` eines Objekts — keine Migration.
// Mehrere Blöcke unterstützen „Custom setup per channel": ein globaler Wert
// plus optional ein Wert je Kanal.

// Vertriebskanäle. „direct" = NextDays-Direktbuchung.
export type Channel = "direct" | "airbnb" | "booking" | "google";
export const CHANNELS: Channel[] = ["direct", "airbnb", "booking", "google"];

export const CHANNEL_LABELS: Record<Channel, string> = {
  direct: "NextDays",
  airbnb: "Airbnb",
  booking: "Booking.com",
  google: "Google",
};

// Kanal-Logos. Airbnb/Google sind farbig in Iconify verfügbar; Booking.com
// gibt es dort nur einfarbig, daher echtes farbiges SVG aus /public/channels.
// `kind` unterscheidet, wie das Logo gerendert wird (Iconify-Icon vs. <img>).
export type ChannelLogo =
  | { kind: "icon"; icon: string }
  | { kind: "img"; src: string };

export const CHANNEL_LOGOS: Record<Channel, ChannelLogo> = {
  direct: { kind: "icon", icon: "ph:house-line" },
  airbnb: { kind: "icon", icon: "logos:airbnb-icon" },
  booking: { kind: "img", src: "/channels/booking.svg" },
  google: { kind: "icon", icon: "logos:google-icon" },
};

// Ein Wert, der global ODER pro Kanal gesetzt sein kann.
export type PerChannel<T> = {
  custom: boolean; // true = eigener Wert je Kanal
  global: T; // gilt, wenn custom = false
  channels: Record<Channel, T>; // gilt je Kanal, wenn custom = true
};

function perChannel<T>(value: T): PerChannel<T> {
  return {
    custom: false,
    global: value,
    channels: { direct: value, airbnb: value, booking: value, google: value },
  };
}

export type WeekdayFlags = {
  mon: boolean; tue: boolean; wed: boolean; thu: boolean;
  fri: boolean; sat: boolean; sun: boolean;
};
const NO_DAYS: WeekdayFlags = {
  mon: false, tue: false, wed: false, thu: false, fri: false, sat: false, sun: false,
};

export const WEEKDAYS: { key: keyof WeekdayFlags; label: string }[] = [
  { key: "mon", label: "Montag" },
  { key: "tue", label: "Dienstag" },
  { key: "wed", label: "Mittwoch" },
  { key: "thu", label: "Donnerstag" },
  { key: "fri", label: "Freitag" },
  { key: "sat", label: "Samstag" },
  { key: "sun", label: "Sonntag" },
];

// Mindestaufenthalt-Typ (Channex settings.min_stay_type). "both" = beide Regeln,
// "arrival" = nur bei Anreise, "through" = durchgehend.
export type MinStayType = "both" | "arrival" | "through";

export type Availability = {
  minStay: number; // Mindestaufenthalt (Nächte)
  minStayByDays: boolean; // Regeln nach Buchungstagen aktiv
  minStayType: MinStayType; // welche Mindestaufenthalts-Regel gilt (Channex)
  maxStay: number; // Maximalaufenthalt (Nächte)
  preparationDays: PerChannel<number>; // Vorbereitungszeit zwischen Buchungen
  bookingWindowDays: PerChannel<number>; // wie weit im Voraus buchbar
  advanceNotice: PerChannel<string>; // späteste Buchungszeit (z. B. "12:00")
  unavailableCheckIn: WeekdayFlags;
  unavailableCheckOut: WeekdayFlags;
  // Verkaufssteuerung → geht an Booking/Airbnb & Co. (Channex property.settings).
  cutOffTime: string; // Same-Day-Verkaufsstopp ab Uhrzeit ("" = aus)
  cutOffDays: number; // Verkaufsstopp N Tage vor Anreise (0 = aus)
  maxDayAdvance: number; // ferne Zukunft schließen (0 = aus)
  // Automatische Verfügbarkeitsanpassung bei Buchungsereignissen (Channex).
  autoUpdateOnConfirmation: boolean; // neue Buchung → Verfügbarkeit senken
  autoUpdateOnModification: boolean; // geänderte Buchung anpassen
  autoUpdateOnCancellation: boolean; // Storno → Verfügbarkeit zurückgeben
};

export const DEFAULT_AVAILABILITY: Availability = {
  minStay: 1,
  minStayByDays: false,
  // "both" — am Wire-XML belegt (23.08.2026), NICHT "arrival":
  //
  // Booking.com bekommt von Channex ZWEI getrennte AvailStatusMessage-Bloecke,
  // einen je Min-Stay-Achse (`ArrivalDateBased="1"` = arrival, `="0"` = through)
  // und entscheidet selbst. Ein Kanal-`min_stay_type` gibt es fuer Booking.com
  // nicht (GET /channels/adapter?code=BookingCom kennt das Feld nicht — Expedia
  // und Airbnb schon). Beide Achsen muessen deshalb den Wert tragen.
  //
  // Was "arrival" anrichtet, gemessen an dem, was Channex wirklich gesendet hat
  // (GET /channel_events/{id}/logs, Feriehus Kornblomst, Rate 64872019):
  //     00:42 Uhr, min_stay_type "both":     through SetMinLOS 2, arrival SetMinLOS 2
  //     14:56 Uhr, min_stay_type "arrival":  through SetMinLOS 1, arrival LEER
  // Bei "arrival" normalisiert Channex die through-Achse auf 1 UND sendet die
  // arrival-Achse ohne jeden Wert — fuer den Zeitraum bis 04.01.2028, von
  // Booking mit <Success/> quittiert. Ergebnis: bei Booking gilt "min stay 1",
  // also gar keine Regel. "both" ist damit der einzige Wert, unter dem
  // Booking.com den Mindestaufenthalt ueberhaupt erhaelt.
  //
  // Airbnb ist von dieser Einstellung unabhaengig: es bekommt seinen Typ
  // separat gesetzt (airbnb_oauth.py: MIN_STAY_ANREISE = "Arrival") und zeigte
  // die Werte durchgehend korrekt an.
  //
  // ACHTUNG, nicht erneut umstellen: "Booking kennt nur einen Min-Stay-Typ,
  // also muessen wir uns auf einen festlegen" klingt plausibel, ist aber am
  // Wire-XML widerlegt. Warum der Mindestaufenthalt trotz korrekter Werte im
  // Extranet fehlte, ist damit NICHT geklaert — die Suche geht dort weiter,
  // nicht an dieser Zeile.
  minStayType: "both",
  maxStay: 365,
  preparationDays: perChannel(0),
  bookingWindowDays: perChannel(365),
  advanceNotice: perChannel("00:00"),
  unavailableCheckIn: { ...NO_DAYS },
  unavailableCheckOut: { ...NO_DAYS },
  cutOffTime: "",
  cutOffDays: 0,
  maxDayAdvance: 0,
  // Channex-Defaults (live gegengelesen): neue Buchung senkt automatisch, Storno
  // gibt nicht automatisch zurück, Änderung wird nicht automatisch angepasst.
  autoUpdateOnConfirmation: true,
  autoUpdateOnModification: false,
  autoUpdateOnCancellation: false,
};

// Auswahloptionen für die Verkaufssteuerung.
export const CUT_OFF_TIME_OPTIONS = [
  { value: "", label: "Aus (bis Mitternacht buchbar)" },
  { value: "12:00", label: "12:00 Uhr" },
  { value: "14:00", label: "14:00 Uhr" },
  { value: "16:00", label: "16:00 Uhr" },
  { value: "18:00", label: "18:00 Uhr" },
  { value: "20:00", label: "20:00 Uhr" },
  { value: "22:00", label: "22:00 Uhr" },
];

export const MIN_STAY_TYPE_OPTIONS: { value: MinStayType; label: string }[] = [
  { value: "both", label: "Beide (Anreise + durchgehend)" },
  { value: "arrival", label: "Nur bei Anreise" },
  { value: "through", label: "Durchgehend" },
];

// Auswahloptionen. Die drei Listen unten bilden GENAU die Stufen ab, die
// Airbnb am Listing kennt (`Airbnb.ListingSettings.AvailabilitySettings.yaml`:
// turnover_days 0|1|2, max_days_notice -1|0|30…365, booking_lead_time
// 0-24|48|72|168). Eine Option anzubieten, die Airbnb nicht kennt, hieße:
// der Betrieb stellt etwas ein, das dort nie ankommt — der Wert würde beim
// Übersetzen verworfen und die Maske zeigte stillschweigend eine Regel, die
// nicht gilt. Umgekehrt fehlte „7 Tage vorher" (168 h), sodass ein bei Airbnb
// gesetzter Wert beim Import verloren ging.
export const PREPARATION_OPTIONS = [
  { value: 0, label: "Keine" },
  { value: 1, label: "1 Tag" },
  { value: 2, label: "2 Tage" },
];

export const BOOKING_WINDOW_OPTIONS = [
  { value: 30, label: "30 Tage im Voraus" },
  { value: 60, label: "60 Tage im Voraus" },
  { value: 90, label: "90 Tage im Voraus" },
  { value: 120, label: "120 Tage im Voraus" },
  { value: 180, label: "180 Tage im Voraus" },
  { value: 270, label: "270 Tage im Voraus" },
  { value: 365, label: "365 Tage im Voraus" },
];

export const ADVANCE_NOTICE_OPTIONS = [
  { value: "00:00", label: "Keine Vorlaufzeit" },
  { value: "12:00", label: "bis 12 Uhr (mittags)" },
  { value: "18:00", label: "bis 18 Uhr" },
  { value: "24h", label: "1 Tag vorher" },
  { value: "48h", label: "2 Tage vorher" },
  { value: "72h", label: "3 Tage vorher" },
  { value: "168h", label: "7 Tage vorher" },
];

export function labelFor(
  options: { value: string | number; label: string }[],
  value: string | number,
): string {
  return options.find((o) => o.value === value)?.label ?? String(value);
}

// Liest die Verfügbarkeit aus einem Objekt (mit Defaults aufgefüllt).
export function readAvailability(
  typeAttributes: Record<string, unknown> | undefined,
): Availability {
  const raw = (typeAttributes?.availability ?? {}) as Partial<Availability>;
  return {
    ...DEFAULT_AVAILABILITY,
    ...raw,
    preparationDays: mergePerChannel(raw.preparationDays, DEFAULT_AVAILABILITY.preparationDays),
    bookingWindowDays: mergePerChannel(raw.bookingWindowDays, DEFAULT_AVAILABILITY.bookingWindowDays),
    advanceNotice: mergePerChannel(raw.advanceNotice, DEFAULT_AVAILABILITY.advanceNotice),
    unavailableCheckIn: { ...NO_DAYS, ...(raw.unavailableCheckIn ?? {}) },
    unavailableCheckOut: { ...NO_DAYS, ...(raw.unavailableCheckOut ?? {}) },
  };
}

function mergePerChannel<T>(
  raw: PerChannel<T> | undefined,
  def: PerChannel<T>,
): PerChannel<T> {
  if (!raw) return def;
  return {
    custom: raw.custom ?? def.custom,
    global: raw.global ?? def.global,
    channels: { ...def.channels, ...(raw.channels ?? {}) },
  };
}

// Zählt aktive Wochentage (für die Vorschau).
export function countDays(f: WeekdayFlags): number {
  return WEEKDAYS.filter((d) => f[d.key]).length;
}
