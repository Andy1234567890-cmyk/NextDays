// Channel-Manager — eigene Seite (Sidebar „Channel Manager" → /channels).
// Verteilt Objekte an Buchungsportale, zeigt verbundene Kanäle/Objekte und
// eingehende OTA-Buchungen. Status + Daten server-seitig laden, an die
// Client-Komponente reichen. White-label: kein Provider-Name sichtbar.
import { ChannexDebugPanel } from "@/components/channel-manager/channex-debug-panel";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { ChannelManagerSettings } from "@/components/settings/channel-manager-settings";
import {
  getChannexHealth,
  listChannexBookings,
  listChannexDebugTrace,
  listPropertyMaps,
} from "@/lib/channex";

export const dynamic = "force-dynamic";

export default async function ChannelsPage() {
  const [health, maps, bookings, trace] = await Promise.all([
    getChannexHealth(),
    listPropertyMaps(),
    listChannexBookings(),
    listChannexDebugTrace(),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <RealtimeRefresh tables={["channex_property_map", "channex_booking"]} />
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Channel Manager</h1>
        <p className="text-sm text-muted-foreground">
          Verbinde deine Buchungsportale und verteile Verfügbarkeit &amp; Preise
          automatisch.
        </p>
      </header>

      <ChannelManagerSettings
        configured={health.ok ? health.data.channel_manager_ready : false}
        propertyMaps={maps.ok ? maps.data.items : []}
        bookings={bookings.ok ? bookings.data.items : []}
      />

      <ChannexDebugPanel initial={trace.ok ? trace.data.items : []} />
    </div>
  );
}
