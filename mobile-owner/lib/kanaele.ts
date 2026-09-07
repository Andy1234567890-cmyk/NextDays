// Buchungskanäle — der Typ und die Namen, die der Eigentümer sieht.
//
// Diese App führt KEINEN Reservierungs-Slice: der Eigentümer bekommt Kanäle
// ausschließlich als Verteilung aus der Statistik (`PortalStatistics.by_channel`,
// `PortalStatisticsChannel.channel`). Der Typ steht deshalb hier und nicht in
// einer `reservations.ts`, die es in dieser App nicht gibt.
//
// Spiegelt apps/api/.../reservations/schemas.py:ReservationChannel — dieselbe
// Union wie mobile-nextdays/lib/reservations.ts. Ein neuer Kanalwert im Backend
// gehört an ALLE Stellen der Kette (`node scripts/i18n/kanal-enums-pruefen.mjs`
// hält DB-Enum → Pydantic → Frontend-Unions → Kanal-Meta → Sprachdateien →
// Mail-Katalog deckungsgleich); diese Datei ist eine davon.
// „ota_other" = Sammelkanal für OTAs ohne eigenen Wert (Expedia, Agoda …).
export type ReservationChannel =
  | "direct"
  // Eigene Website des Betriebs (0380) — provisionsfrei wie „direct", aber
  // getrennt auswertbar.
  | "website"
  | "portal"
  | "booking"
  | "airbnb"
  | "vrbo"
  | "ota_other";

/**
 * Ordnet die `booking_source` einer Buchung einem Kanal zu.
 *
 * `booking_source` ist entweder der Klarname des Portals (`ota_name`, etwa
 * „Booking.com") ODER der Kanal-Code der Reservierung (`channel`, etwa
 * „booking"). Beides landet hier — deshalb wird schreibweisen-tolerant
 * verglichen, genau wie `kanalFarbe` im Web (portal-kalender.tsx) und
 * `channelLogoLoose` (web/lib/channel-logos.ts). Was sich keinem bekannten
 * Kanal zuordnen lässt, ist `ota_other`: die ehrliche Aussage „irgendein
 * Portal", keine geratene Marke. Leer bleibt leer (`null`).
 */
const QUELLE_ZU_KANAL: Record<string, ReservationChannel> = {
  bookingcom: "booking",
  booking: "booking",
  airbnb: "airbnb",
  vrbo: "vrbo",
  fewodirekt: "vrbo",
  portal: "portal",
  mybestdays: "portal",
  direct: "direct",
  direkt: "direct",
  website: "website",
};

export function kanalAusQuelle(quelle: string | null | undefined): ReservationChannel | null {
  if (!quelle || !quelle.trim()) return null;
  const key = quelle.toLowerCase().replace(/[^a-z0-9]/g, "");
  return QUELLE_ZU_KANAL[key] ?? "ota_other";
}

// Anzeigename je Kanal. Nur der Sammelkanal `ota_other` hat keinen festen
// Namen — dort zeigt die Oberfläche die gemeldete Quelle (über `portalLabel`,
// lib/portal-logos.ts), nie einen erfundenen Klarnamen.
const KANAL_LABEL: Record<Exclude<ReservationChannel, "ota_other">, string> = {
  booking: "Booking.com",
  airbnb: "Airbnb",
  vrbo: "Vrbo",
  portal: "myBestDays",
  direct: "Direkt",
  website: "Website",
};

export function kanalLabel(kanal: ReservationChannel, quelle: string | null): string {
  if (kanal === "ota_other") return quelle ?? "Portal";
  return KANAL_LABEL[kanal];
}
