"use client";

// Live-Aktualisierung der Eigentümer-Seite (echtes Supabase-Realtime, KEIN
// Polling). Abonniert die Tabellen, die die Owner-Ansicht speisen und für
// `authenticated` noch offen sind, und feuert bei jeder Änderung onChange — so
// schlagen neue Buchungen (Channex/Plattform) sofort in Vorschau und Summen
// durch, ohne Reload. RLS begrenzt die Events auf den eigenen Tenant;
// reservations wird tabellenweit abonniert (Filter nur über eine Spalte
// möglich, owner-Bezug läuft über property_id).
import { useRealtime } from "@/lib/use-realtime";

export function OwnerRealtime({ onChange }: { onChange: () => void }) {
  // owners, owner_properties und owner_expenses sind für authenticated bewusst
  // gesperrt (Wurzel 6, Migration 0337: revoke + raus aus supabase_realtime) —
  // Abos darauf wären stumme Attrappen. Es gibt keine offene Tabelle, die
  // dieselben Ereignisse trägt: reservations bildet weder eine Stammdaten- noch
  // eine Zuordnungs- oder Ausgabenänderung ab. Ersatzlos gestrichen, ehrlich
  // benannt, was dadurch NICHT mehr live ist:
  //   • Eigentümer-Stammdaten (Name, Provisionssatz, Bankdaten),
  //   • Objekt-Zuweisungen (welches Objekt hängt an diesem Eigentümer),
  //   • Ausgaben (owner_expenses) inklusive der daraus gerechneten Summen.
  // Diese Änderungen erscheinen erst beim nächsten Laden der Seite. Stammdaten
  // und Zuweisungen pflegt der Nutzer in derselben Oberfläche, die danach neu
  // lädt; Ausgaben können serverseitig entstehen und fehlen dann bis zum Reload.
  // owner_statements ist ebenfalls gesperrt (Wurzel 6) und taugt nicht als
  // Ersatzquelle.
  // reservations: tenant-weit (RLS), owner-Bezug nicht als Spaltenfilter
  // abbildbar. Buchungsänderungen bleiben dadurch live.
  useRealtime({ table: "reservations", onChange });
  return null;
}
