"use client";

// Live-Aktualisierung der Eigentümer-Portal-Flächen (echtes Supabase-Realtime,
// KEIN Polling, kein manuelles Nachladen nach eigener Aktion).
//
// WELCHE TABELLEN HIER STEHEN DÜRFEN — und welche nicht:
// Ein Abo wirkt nur, wenn `authenticated` ein SELECT-Grant auf der Tabelle hat
// UND die Tabelle in der Publikation `supabase_realtime` steckt. Fehlt eines,
// ist das Abo eine stumme Attrappe: die UI sieht live aus und aktualisiert nie.
//
// BEWUSST NICHT ABONNIERT (Wurzel 6, Migration 0187 entzieht `authenticated`
// das SELECT):
//   * owner_statements — Abrechnungen. Ein Abo darauf feuert NIE.
//   * payments, commissions — dito.
//   * tasks — hat zwar ein SELECT-Grant, ABER `postgres_changes` liefert die
//     VOLLE Zeile inkl. `assignee_id`. Das Antwortmodell des Portals
//     (`ServiceRequestItem`) laesst dieses Feld bewusst weg: wer putzt, ist
//     Personaleinsatz des Betriebs (§4.3), der Eigentuemer erfaehrt nur, OB
//     jemand dran ist. Ein Abo lieferte den Datensplit am Service vorbei
//     direkt aus der DB — RLS begrenzt die ZEILEN auf seine Objekte, nicht die
//     SPALTEN. Die Dienstleistungs-Flaeche fuegt ihren eigenen neuen Auftrag
//     stattdessen optimistisch ein.
//   * block_requests — seit 0332 ohne SELECT-Grant. Die Zeilen tragen jetzt
//     `reason`/`decision_note`, also warum ein Eigentümer sperren will und was
//     die Agentur intern dazu notiert hat; das gehört nicht in den
//     DB-Direktpfad. Ersatz-Quelle ist `availability`: eine GENEHMIGUNG
//     schreibt dort die gesperrten Nächte, das ist die sichtbare Wirkung, auf
//     die die Portal-Fläche reagieren muss. Der reine Status-Wechsel auf
//     „abgelehnt" kommt beim nächsten Laden — dafür ein Finanz-/Begründungs-
//     Leck zu öffnen, wäre der falsche Tausch.
// Diese Zahlen entstehen aus Reservierungen; `reservations` ist erlaubt und
// live, ein Event von dort genügt für den Refresh der Server-Props. Wo es keine
// erlaubte Quelle gibt, steht hier lieber gar nichts als eine Attrappe.
//
// `reservations` und `availability` werden tabellenweit abonniert: RLS begrenzt
// die Events auf den eigenen Mandanten, ein Spaltenfilter auf den Eigentümer
// ist nicht möglich (der Bezug läuft über property_id → Zuordnung).
import { useRealtime } from "@/lib/use-realtime";

type Quelle =
  | "reservations"
  | "availability"
  | "stop_sell"
  | "block_requests"
  | "meter_readings"
  | "properties";

export function PortalRealtime({
  quellen,
  onChange,
}: {
  quellen: readonly Quelle[];
  onChange: () => void;
}) {
  // Feste Reihenfolge, feste Anzahl Hook-Aufrufe: useRealtime darf NICHT in
  // einer Schleife über eine variable Liste laufen (Regel der Hooks). Jede
  // Quelle bekommt daher ihren eigenen Aufruf und wird über `enabled`
  // zu-/abgeschaltet.
  const an = (q: Quelle) => quellen.includes(q);

  useRealtime({ table: "reservations", onChange, enabled: an("reservations") });
  useRealtime({
    table: "availability",
    onChange,
    // Auch für "block_requests" (siehe Kopf): die Genehmigung eines Antrags
    // schlägt sich in `availability` nieder, das ist die erlaubte Quelle.
    enabled: an("availability") || an("block_requests"),
  });
  useRealtime({ table: "stop_sell", onChange, enabled: an("stop_sell") });
  // block_requests: KEIN Abo (siehe Kopf) — wer "block_requests" anfordert,
  // hört ersatzweise auf `availability`, wo eine Genehmigung ihre Wirkung
  // hinterlässt.
  useRealtime({
    table: "meter_readings",
    onChange,
    enabled: an("meter_readings"),
  });
  useRealtime({ table: "properties", onChange, enabled: an("properties") });
  // tasks: KEIN Abo (siehe Kopf) — die volle Zeile traegt `assignee_id`.

  return null;
}
