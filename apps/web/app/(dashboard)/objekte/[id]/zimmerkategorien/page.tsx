// Objekt → Zimmerkategorien (Hotel): room_types einer Property + je Kategorie
// eigene Rate-Plans (BAR, B&B …). Nur im Hotel-Modus über die Subnav erreichbar.
// Die Zimmerkategorien schalten die Property in das count-basierte Verfügbarkeits-
// modell (n Room-Types → Channex); ohne Kategorie bleibt das Ferienwohnungs-Modell.
import { getTranslations } from "next-intl/server";

import { RoomTypesManager } from "@/components/objekte/room-types-manager";
import { getProperty } from "@/lib/properties";
import { listRatePlans } from "@/lib/rates";
import { listRoomTypes } from "@/lib/room-types";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [prop, rooms, rates] = await Promise.all([
    getProperty(id),
    listRoomTypes(id),
    listRatePlans(id),
  ]);
  if (!prop.ok) {
    const t = await getTranslations("roomTypes");
    return (
      <div className="text-sm text-destructive">
        {t("loadFailed", { error: prop.error })}
      </div>
    );
  }
  return (
    <RoomTypesManager
      propertyId={id}
      initialRoomTypes={rooms.ok ? rooms.data.items : []}
      initialRatePlans={rates.ok ? rates.data.items : []}
    />
  );
}
