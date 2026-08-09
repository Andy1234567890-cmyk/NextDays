// Kanal-Detailseite — /channels/[code] (z.B. /channels/BookingCom). Eigene
// Route je Kanal (Branchen-Muster: Hostaway/Guesty/Cloudbeds/SiteMinder/Lodgify
// öffnen den Kanal als eigene Fläche, nicht als Modal). Zweispaltig wie Lodgify:
// links die kategorisierte Kanalnavigation (mit Verbunden-Status), rechts der
// gewählte Kanal mit Mapping-Tabelle (Objekt ↔ OTA-Listing ↔ Sync-Status),
// Buchungen + Verlauf. Daten server-seitig laden; white-label.
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import {
  type ChannelMeta,
  ChannelDetail,
} from "@/components/channel-manager/channel-detail";
import { ChannelSidebar } from "@/components/channel-manager/channel-sidebar";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { getMe } from "@/lib/auth";
import {
  channelDetail,
  channelOverview,
  getChannexHealth,
  listChannexBookings,
  listPropertyMaps,
} from "@/lib/channex";

export const dynamic = "force-dynamic";

// Kanäle mit echtem Original-Logo (public/channels/*.svg). Alle anderen Kanäle
// (52 im Channex-Katalog) leiten Label + Icon aus dem Overview ab — kein
// Hardcode je Kanal. Code = stabiler Schlüssel wie im Backend-Portal-Katalog.
const CHANNEL_LOGO: Record<string, string> = {
  BookingCom: "/channels/booking.svg",
  AirBNB: "/channels/airbnb.svg",
  Expedia: "/channels/expedia.svg",
};

export default async function ChannelDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  const t = await getTranslations("channels");
  // Die Betriebsart entscheidet über das Verbinden-Modell (Hotel: eine
  // Portal-Kennung für alle Zimmer; Ferienobjekt: eine je Objekt) und muss
  // deshalb bis in den Assistenten durchgereicht werden.
  const [health, overview, detail, maps, bookings, me] = await Promise.all([
    getChannexHealth(),
    channelOverview(),
    channelDetail(code),
    listPropertyMaps(),
    listChannexBookings(),
    getMe(),
  ]);

  // meta aus dem Live-Katalog (Overview) ableiten: existiert der Kanal nicht,
  // ist die Route ungültig (echter Fake-Code) → 404. Bekannte bekommen ihr
  // SVG-Logo, der Rest Label + Icon aus dem Backend-Katalog.
  const otaEntry = overview.ok
    ? overview.data.ota.find((c) => c.code === code)
    : undefined;
  if (!otaEntry) notFound();
  const meta: ChannelMeta = {
    code,
    label: otaEntry.label,
    logo: CHANNEL_LOGO[code],
    icon: otaEntry.icon,
    connection_type: otaEntry.connection_type,
  };

  // Kein `max-w`-Deckel: die Zuordnungstabelle hat sechs Spalten (Objekt,
  // Listing, Status, Voll-Abgleich, Pausieren, Bearbeiten). Mit `max-w-6xl`
  // blieb die Seite bei 72rem stehen, auch wenn die Sidebar zugeklappt war —
  // der freie Platz ging ins Nichts, während Objektnamen wie „020 Lille
  // Lægehus (1966) · FeWo Lille Lægehus" auf vier Zeilen umbrachen.
  return (
    <div className="flex w-full flex-col gap-6 p-6">
      {/* Alle drei bisherigen Quellen (`channex_property_map`,
          `channex_booking`, `channex_channel_connection`) sind seit Migration
          0337 für `authenticated` gesperrt (Wurzel 6) — ohne SELECT-Grant
          wären die Abos stumme Attrappen und werden deshalb ersatzlos
          gestrichen. Eine erlaubte Ersatzquelle gibt es nicht: eine neue
          OTA-Buchung oder eine geänderte Zuordnung berührt keine offene
          Tabelle, und `reservations` wäre ein stiller Ersatz (die
          Buchungsliste dieser Seite kommt aus `channex_booking`, nicht aus
          `reservations`).
          `properties` bleibt als Abo: die Mapping-Tabelle zeigt Titel und
          Status der Objekte, und die Tabelle ist offen. ENTFÄLLT: Neue
          OTA-Buchungen und Zuordnungs-/Verbindungsänderungen erscheinen nicht
          mehr von selbst — die eigene Aktion lädt die Seite ohnehin neu,
          fremde werden beim nächsten Seitenaufruf sichtbar. */}
      <RealtimeRefresh tables={["properties"]} />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[16rem_1fr]">
        {/* Links: kategorisierte Kanalnavigation (Lodgify) */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          {overview.ok ? (
            <ChannelSidebar
              overview={overview.data}
              activeCode={code}
              labels={{
                allChannels: t("allChannels"),
                categoryOta: t("categoryOta"),
                categoryMarketplace: t("categoryMarketplace"),
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

        {/* Rechts: gewählter Kanal + Mapping-Tabelle */}
        <ChannelDetail
          meta={meta}
          configured={health.ok ? health.data.channel_manager_ready : false}
          detail={detail.ok ? detail.data : null}
          propertyMaps={maps.ok ? maps.data.items : []}
          bookings={bookings.ok ? bookings.data.items : []}
          accommodationType={me?.accommodation_type ?? null}
        />
      </div>
    </div>
  );
}
