// Stop-Sell — Stop-Sell-Kalender (Multi-Property-Zeitleiste wie in den
// großen PMS): Server Component lädt Objekte + Reisebüros (Adressaten der
// Stop-Sell-Meldung), der Client-Kalender zeigt Belegung + Stopps pro Tag und
// setzt/hebt Stopps per Drag-Auswahl (Channex-Stops read-only).
import { StopSellCalendar } from "@/components/stop-sell/stop-sell-calendar";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { Card } from "@nextdays/ui/card";
import { listProperties } from "@/lib/properties";
import { listAgencies } from "@/lib/travel-agencies";

export const dynamic = "force-dynamic";

export default async function StopSellPage() {
  const [res, agencies] = await Promise.all([
    listProperties(),
    listAgencies(),
  ]);
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
      {/* Neue/gelöschte Objekte sofort als Kalenderzeilen (Realtime-Pflicht).
          `travel_agencies` ist hier ersatzlos gestrichen: für authenticated
          bewusst gesperrt (Wurzel 6, Migration 0337: revoke + raus aus
          supabase_realtime), ein Abo darauf wäre eine stumme Attrappe, und
          eine offene Tabelle mit demselben Ereignis gibt es nicht. Ehrlich
          benannt: ein neu angelegter Partner erscheint im Panel-Select des
          Kalenders erst beim nächsten Laden dieser Seite. */}
      <RealtimeRefresh tables={["properties"]} />
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
