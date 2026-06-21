// Einstellungen — Konto-/Firmen- und Integrations-Einstellungen.
// Lädt server-seitig den Channel-Manager-Status (Channex) und reicht ihn an
// die Client-Komponente weiter. Weitere Abschnitte folgen.
import { ChannelManagerSettings } from "@/components/settings/channel-manager-settings";
import {
  getChannexHealth,
  listChannexBookings,
  listPropertyMaps,
} from "@/lib/channex";

export const dynamic = "force-dynamic";

export default async function EinstellungenPage() {
  const [health, maps, bookings] = await Promise.all([
    getChannexHealth(),
    listPropertyMaps(),
    listChannexBookings(),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Einstellungen</h1>
        <p className="text-sm text-muted-foreground">
          Konto-, Firmen- und Integrations-Einstellungen.
        </p>
      </header>

      <ChannelManagerSettings
        configured={health.ok ? health.data.channex_configured : false}
        propertyMaps={maps.ok ? maps.data.items : []}
        bookings={bookings.ok ? bookings.data.items : []}
      />
    </div>
  );
}
