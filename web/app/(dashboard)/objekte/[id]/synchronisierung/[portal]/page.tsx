// Objekt × Portal — Kennungen, Verkaufsschalter, Tarifpläne, letzter Abgleich.
// Serverseitig laden. Kein Realtime: die speisenden Tabellen sind seit
// Migration 0337 gesperrt — Begründung an der Rückgabe unten.
import { getLocale, getTranslations } from "next-intl/server";

import { PropertyChannelDetail } from "@/components/objekte/property-channel-detail";
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

  // KEIN Realtime mehr auf dieser Seite. Ihre beiden einzigen Quellen —
  // `channex_channel_connection` und `channex_property_map`, siehe
  // `objekt_kanal.channel_property_detail` — sind seit Migration 0337 für
  // `authenticated` gesperrt (Wurzel 6, Vertriebsdaten des Portal-Anschlusses).
  // Ohne SELECT-Grant passt keine Policy mehr; die Abos wären stumme
  // Attrappen. Eine erlaubte Ersatzquelle gibt es nicht: Kennungen,
  // Verkaufsschalter, Tarifplan-Zuordnung und der Zeitpunkt des letzten
  // Abgleichs stehen ausschließlich in diesen beiden Tabellen. `properties`
  // wäre ein stiller Ersatz — ein Sync-Lauf ändert dort keine Zeile.
  //
  // WAS DADURCH ENTFÄLLT: Ein serverseitiger Sync-Lauf oder eine Freigabe
  // durch das Portal wird nicht mehr live sichtbar. Jede eigene Aktion auf
  // dieser Seite lädt die Server-Components ohnehin neu; ein fremder oder
  // serverseitiger Vorgang erscheint beim nächsten Aufruf der Seite.
  return <PropertyChannelDetail detail={res.data} locale={locale} />;
}
