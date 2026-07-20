// Channel-Manager — Übersicht (Sidebar „Channel Manager" → /channels).
// Nur die kategorisierten Kanal-Karten (Buchungsportale · eigener Marktplatz ·
// Suchmaschinen · iCal). Ein Klick auf eine Portal-Karte führt auf die eigene
// Kanal-Detailseite /channels/[code] (Branchen-Muster: Kanal = eigene Route,
// kein Modal). Alle Zahlen tenant-lokal aus der DB. White-label: kein Provider-
// Name sichtbar.
import { getTranslations } from "next-intl/server";

import { ChannelGrid } from "@/components/channel-manager/channel-grid";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { channelOverview } from "@/lib/channex";

export const dynamic = "force-dynamic";

export default async function ChannelsPage() {
  const t = await getTranslations("channels");
  const overview = await channelOverview();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <RealtimeRefresh
        tables={[
          "channex_property_map",
          "channex_booking",
          "channex_channel_connection",
          "external_calendar",
        ]}
      />
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      <ChannelGrid overview={overview.ok ? overview.data : null} />
    </div>
  );
}
