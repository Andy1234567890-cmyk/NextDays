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
      {/* `channex_property_map`, `channex_booking` und
          `channex_channel_connection` sind seit Migration 0337 für
          `authenticated` gesperrt (Wurzel 6) und hier ersatzlos gestrichen —
          ohne SELECT-Grant wären es stumme Attrappen. Eine erlaubte
          Ersatzquelle für die Verbindungsdaten gibt es nicht; sie ändern sich
          ohnehin nur durch eigene Aktionen in dieser Oberfläche, die die Seite
          danach selbst neu lädt. ENTFÄLLT: Verbindet ein Kollege im zweiten
          Fenster einen Kanal, ändert sich der Verbunden-Status der Kanal-Karte
          hier erst beim nächsten Seitenaufruf.
          `properties` (Marktplatz-Zahl) und `external_calendar` (iCal-Zahl)
          bleiben — sie sind offen und tragen genau die Zahlen dieser Seite. */}
      <RealtimeRefresh tables={["properties", "external_calendar"]} />
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      <ChannelGrid overview={overview.ok ? overview.data : null} />
    </div>
  );
}
