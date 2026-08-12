// Kanal-Detailseite des EIGENEN Marktplatzes — /channels/mybestdays.
//
// Eigene statische Route neben `/channels/[code]` (die Kanal-Codes von Channex):
// myBestDays ist kein Channex-Portal, hat kein Mapping und keine Verbindung, aber
// für den Betrieb ist er ein Vertriebskanal wie Booking oder Airbnb — und
// brauchte deshalb dieselbe Fläche. Vorher sprang die Kanal-Karte auf /objekte;
// dass 17 Objekte auf die Marktplatz-Freigabe warteten, stand nirgends.
//
// Zweispaltig wie die OTA-Seite: links dieselbe Kanalnavigation, rechts die
// Objekttabelle des Marktplatzes.
import { getTranslations } from "next-intl/server";

import { ChannelSidebar } from "@/components/channel-manager/channel-sidebar";
import { MarketplaceDetailView } from "@/components/channel-manager/marketplace-detail";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { channelOverview, marketplaceDetail } from "@/lib/channex";

export const dynamic = "force-dynamic";

export default async function MarketplaceChannelPage() {
  const t = await getTranslations("channels");
  const [overview, detail] = await Promise.all([
    channelOverview(),
    marketplaceDetail(),
  ]);

  return (
    <div className="flex w-full flex-col gap-6 p-6">
      {/* `properties` speist Titel, Schalter und Freigabe-Stand, `reservations`
          die Buchungszahl je Objekt — beide sind für `authenticated` lesbar, das
          Abo ist also keine Attrappe. Die Freigabe selbst wird im Backoffice
          gesetzt und ändert eine properties-Zeile, kommt hier also mit. */}
      <RealtimeRefresh tables={["properties", "reservations"]} />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[16rem_1fr]">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          {overview.ok ? (
            <ChannelSidebar
              overview={overview.data}
              activeCode="mybestdays"
              labels={{
                allChannels: t("allChannels"),
                categoryOta: t("categoryOta"),
                categoryMarketplace: t("categoryMarketplace"),
                marketplaceWaiting: t("marketplaceWaiting"),
                categoryIcal: t("categoryIcal"),
                connected: t("connectedStatus"),
                notConnected: t("notConnectedStatus"),
                addChannel: t("addChannel"),
                searchChannel: t("searchChannel"),
                noResults: t("noResults"),
              }}
            />
          ) : null}
        </aside>

        {detail.ok ? (
          <MarketplaceDetailView detail={detail.data} />
        ) : (
          // Kein erfundener Leerzustand: der Grund des Backends steht da.
          <p className="rounded-(--radius) border border-border p-4 text-sm text-destructive">
            {detail.error}
          </p>
        )}
      </div>
    </div>
  );
}
