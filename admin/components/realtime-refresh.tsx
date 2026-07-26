"use client";

// Realtime-Auslöser für Server-Component-Listen: abonniert eine Tabelle und
// lädt bei Änderungen die Server-Daten neu (router.refresh()).
//
// Warum so: Die Listen im Backoffice sind Server Components — sie holen ihre
// Daten über die gescopten /platform/*-Endpunkte, die mehr sehen als die
// RLS-Policy (z. B. interne Notizen, fremde Mandanten). Der Realtime-Client
// dient hier nur als SIGNAL („da hat sich was getan"), nicht als Datenquelle.
// Die Wahrheit kommt weiterhin vom Server.
import { useRouter } from "next/navigation";

import { useRealtime } from "@/lib/use-realtime";

export function RealtimeRefresh({
  table,
  filter,
}: {
  table: string;
  /** PostgREST-Filter, z. B. `id=eq.…`. Ohne Filter: die ganze Tabelle. */
  filter?: string;
}) {
  const router = useRouter();
  useRealtime({ table, filter, onChange: () => router.refresh() });
  return null;
}
