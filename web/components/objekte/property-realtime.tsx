"use client";

// Live-Aktualisierung der Objektseite: abonniert die eigene properties-Zeile
// (Supabase-Realtime) und lädt bei jeder Änderung die Server-Components neu
// (router.refresh) — so erscheinen Status/Stammdaten ohne Reload, egal ob die
// Änderung lokal (Veröffentlichen/Speichern) oder extern (Channex-Import) kam.
// RLS gilt: der Client empfängt nur Zeilen seines Tenants.
import { useRouter } from "next/navigation";

import { useRealtime } from "@/lib/use-realtime";

export function PropertyRealtime({ propertyId }: { propertyId: string }) {
  const router = useRouter();
  useRealtime({
    table: "properties",
    filter: `id=eq.${propertyId}`,
    onChange: () => router.refresh(),
  });
  return null;
}
