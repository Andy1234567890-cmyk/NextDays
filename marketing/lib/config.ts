// Umgebung der Marketing-App an EINER Stelle.
//
// Die Landingpage ist ansonsten backend-frei (ADR-0002). Einzige Ausnahme ist
// der Support-Chat unten rechts: er spricht direkt mit der FastAPI, damit deren
// IP-Rate-Limit die IP des BESUCHERS sieht. Ginge der Aufruf über eine
// Next-Proxy-Route, käme jede Anfrage von der Server-IP der Marketing-App —
// ein gemeinsamer Zähler für alle Besucher wäre entweder wirkungslos oder
// würde beim ersten Ansturm alle aussperren.
//
// Betrieb: die Marketing-Domain muss in CORS_ORIGINS der API stehen, sonst
// blockt der Browser die Anfrage.
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const API_BASE = `${API_URL.replace(/\/$/, "")}/api/v1`;
