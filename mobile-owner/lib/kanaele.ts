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
