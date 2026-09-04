"use client";

// Generisches Live-Update für Server-Component-Seiten: abonniert eine oder
// mehrere Tabellen (Supabase-Realtime) und lädt bei jeder Änderung die Server-
// Components neu (router.refresh) — so erscheinen Listen/Stammdaten ohne Reload,
// egal ob die Änderung lokal, von einem anderen Nutzer oder extern (z. B.
// Channex-Import) kam. RLS gilt: der Client empfängt nur Zeilen seines Tenants.
//
// Verwendung in einer Server-Component-Page:
//   <RealtimeRefresh tables={["reservations", "availability"]} />
//
// NUR Tabellen nennen, auf denen `authenticated` ein SELECT-Grant hat UND die
// in der Publikation `supabase_realtime` liegen — sonst ist das Abo eine stumme
// Attrappe (verbindet sich, liefert nie ein Event). Sensible Tabellen (Gast-PII,
// Finanzen, Nachrichten) sind bewusst gesperrt (Wurzel 6, Migrationen 0336/0337)
// und taugen NICHT als Quelle; ein Re-Grant „damit das Abo wieder geht" ist der
// falsche Weg. Gegenprobe: `bash scripts/realtime/abos-pruefen.sh`.
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
  // Feste Zahl an Hooks: bis zu 6 Tabellen je Seite (Hook-Regeln verlangen eine
  // konstante Aufrufanzahl — daher kein .map über tables). 6, weil die Dynamic-
  // Pricing-Vorschau alle preis-speisenden Tabellen der Resolver-Kette abonnieren
  // muss (dynamic_prices bei aktivem DP > price_overrides > property_pricing_config > rate_plans
  // + availability + dp_settings), damit ein manueller Tagespreis sofort erscheint.
  useRealtime({ table: tables[0] ?? "", filter, onChange: () => router.refresh(), enabled: !!tables[0] });
  useRealtime({ table: tables[1] ?? "", onChange: () => router.refresh(), enabled: !!tables[1] });
  useRealtime({ table: tables[2] ?? "", onChange: () => router.refresh(), enabled: !!tables[2] });
  useRealtime({ table: tables[3] ?? "", onChange: () => router.refresh(), enabled: !!tables[3] });
  useRealtime({ table: tables[4] ?? "", onChange: () => router.refresh(), enabled: !!tables[4] });
  useRealtime({ table: tables[5] ?? "", onChange: () => router.refresh(), enabled: !!tables[5] });
  return null;
}
