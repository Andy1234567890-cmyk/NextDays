"use client";

// Live-Aktualisierung der Eigentümer-Seite (echtes Supabase-Realtime, KEIN
// Polling). Abonniert alle Tabellen, die die Owner-Ansicht speisen, und feuert
// bei jeder Änderung onChange — so schlagen Objekt-Zuweisungen, Provisions-/
// Stammdaten-Änderungen, neue Buchungen (Channex/Plattform) und Ausgaben sofort
// in Vorschau und Summen durch, ohne Reload. RLS begrenzt die Events auf den
// eigenen Tenant; reservations wird tabellenweit abonniert (Filter nur über eine
// Spalte möglich, owner-Bezug läuft über property_id).
import { useRealtime } from "@/lib/use-realtime";

export function OwnerRealtime({
  ownerId,
  onChange,
}: {
  ownerId: string;
  onChange: () => void;
}) {
  useRealtime({ table: "owners", filter: `id=eq.${ownerId}`, onChange });
  useRealtime({
    table: "owner_properties",
    filter: `owner_id=eq.${ownerId}`,
    onChange,
  });
  useRealtime({
    table: "owner_expenses",
    filter: `owner_id=eq.${ownerId}`,
    onChange,
  });
  // owner_statements ist für authenticated bewusst gesperrt (Wurzel 6) und taugt
  // deshalb nicht als Abo-Quelle; die Abrechnungszahlen speisen sich aus den
  // Reservierungen darunter.
  // reservations: tenant-weit (RLS), owner-Bezug nicht als Spaltenfilter abbildbar.
  useRealtime({ table: "reservations", onChange });
  return null;
}
