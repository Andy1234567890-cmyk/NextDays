// Katalog der Ressourcen-Scopes für den Entwickler-API-Zugang (Spiegel des
// Backend-API_SCOPES). Read/Write je Domäne, funktionsgebunden (Booking-
// „Connection Type"-Prinzip). Bewusst KEINE "use server"-Datei — reine
// Konstante, damit sie clientseitig importierbar ist (Server-Actions liegen in
// lib/api-clients.ts).
export const API_SCOPE_CATALOG = [
  { key: "reservations", labelKey: "reservations" },
  { key: "availability", labelKey: "availability" },
  { key: "properties", labelKey: "properties" },
  { key: "calendar_sync", labelKey: "calendarSync" },
] as const;
