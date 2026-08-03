// Objekt × Portal — Kennungen, Verkaufsschalter, Tarifpläne, letzter Abgleich.
// Serverseitig laden; alle speisenden Tabellen werden live abonniert, damit ein
// Sync-Lauf oder eine Freigabe sofort sichtbar wird (Realtime-Pflicht).
import { getLocale, getTranslations } from "next-intl/server";

import { PropertyChannelDetail } from "@/components/objekte/property-channel-detail";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { channelPropertyDetail } from "@/lib/channex";

export default async function ObjektKanalPage({
  params,
}: {
  params: Promise<{ id: string; portal: string }>;
}) {
  const { id, portal } = await params;
  const [res, t, locale] = await Promise.all([
    channelPropertyDetail(id, portal),
    getTranslations("objects.channelDetail"),
    getLocale(),
  ]);

  if (!res.ok) {
    return <p className="text-sm text-destructive">{t("loadFailed")}</p>;
  }

  return (
    <>
      <RealtimeRefresh
        tables={[
          "channex_channel_connection",
          "channex_property_map",
        ]}
      />
      <PropertyChannelDetail detail={res.data} locale={locale} />
    </>
  );
}
