"use client";

// Generisches Live-Update für Server-Component-Seiten: abonniert eine oder
// mehrere Tabellen (Supabase-Realtime) und lädt bei jeder Änderung die Server-
// Components neu (router.refresh) — so erscheinen Listen/Stammdaten ohne Reload,
// egal ob die Änderung lokal, von einem anderen Nutzer oder extern (z. B.
// Channex-Import) kam. RLS gilt: der Client empfängt nur Zeilen seines Tenants.
//
// Verwendung in einer Server-Component-Page:
//   <RealtimeRefresh tables={["reservations", "guests"]} />
import { useRouter } from "next/navigation";

import { useRealtime } from "@/lib/use-realtime";

export function RealtimeRefresh({
  tables,
  filter,
}: {
  tables: string[];
  /** Optionaler Server-Filter, z. B. `id=eq.${id}` (nur sinnvoll bei 1 Tabelle). */
  filter?: string;
}) {
  const router = useRouter();
  // Feste Zahl an Hooks: bis zu 4 Tabellen je Seite (Hook-Regeln verlangen eine
  // konstante Aufrufanzahl — daher kein .map über tables).
  useRealtime({ table: tables[0] ?? "", filter, onChange: () => router.refresh(), enabled: !!tables[0] });
  useRealtime({ table: tables[1] ?? "", onChange: () => router.refresh(), enabled: !!tables[1] });
  useRealtime({ table: tables[2] ?? "", onChange: () => router.refresh(), enabled: !!tables[2] });
  useRealtime({ table: tables[3] ?? "", onChange: () => router.refresh(), enabled: !!tables[3] });
  return null;
}
