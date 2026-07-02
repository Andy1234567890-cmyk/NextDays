// Stop-Sell — Verkaufsstopp-Kalender (Multi-Property-Zeitleiste wie in den
// großen PMS): Server Component lädt Objekte + Reisebüros (Adressaten der
// Stop-Sale-Meldung), der Client-Kalender zeigt Belegung + Stopps pro Tag und
// setzt/hebt Stopps per Drag-Auswahl (Channex-Stops read-only).
import { StopSellCalendar } from "@/components/stop-sell/stop-sell-calendar";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { Card } from "@/components/ui/card";
import { listProperties } from "@/lib/properties";
import { listAgencies } from "@/lib/travel-agencies";

export const dynamic = "force-dynamic";

export default async function StopSellPage() {
  const [res, agencies] = await Promise.all([listProperties(), listAgencies()]);
  if (!res.ok) {
    return (
      <div className="mx-auto w-full max-w-3xl p-6">
        <Card className="p-5 text-sm text-destructive">
          Objekte konnten nicht geladen werden.
        </Card>
      </div>
    );
  }
  return (
    <>
      {/* Neu angelegte Partner sofort im Panel-Select, neue/gelöschte
          Objekte sofort als Kalenderzeilen (Realtime-Pflicht). */}
      <RealtimeRefresh tables={["travel_agencies", "properties"]} />
      <StopSellCalendar
        properties={res.data.items.map((p) => ({ id: p.id, title: p.title }))}
        agencies={
          agencies.ok
            ? agencies.data.items.map((a) => ({ id: a.id, name: a.name }))
            : []
        }
        agenciesError={agencies.ok ? null : agencies.error}
      />
    </>
  );
}
