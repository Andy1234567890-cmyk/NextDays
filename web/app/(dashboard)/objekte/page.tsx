// Objekte-Übersicht (Rentals): Liste aller Objekte des Tenants.
// Server Component — lädt über die Server-Action, rendert Kopf + Anlage-Button
// und übergibt die Objekte an die Client-Liste (Suche/Filter/Karten, Lodgify).
import { getTranslations } from "next-intl/server";

import { NewPropertyButton } from "@/components/objekte/new-property-button";
import { ObjectsList } from "@/components/objekte/objects-list";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { Card } from "@nextdays/ui/card";
import { Icon } from "@iconify/react";
import { getMe } from "@/lib/auth";
import { listProperties } from "@/lib/properties";

export default async function ObjektePage() {
  // Betriebsart mitladen: Hotel spricht von „Zimmern" und bekommt die
  // Zimmertypen-Liste in der Anlage (0090/0098).
  const [res, me, t] = await Promise.all([
    listProperties(),
    getMe(),
    getTranslations("objects"),
  ]);
  const accommodationType = me?.accommodation_type ?? null;
  const isHotel = accommodationType === "hotel";

  return (
    <div className="flex flex-col gap-6">
      <RealtimeRefresh tables={["properties"]} />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-extrabold">
            {isHotel ? t("objektePage.titleHotel") : t("objektePage.titleDefault")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isHotel
              ? t("objektePage.subtitleHotel")
              : t("objektePage.subtitleDefault")}
          </p>
        </div>
        <NewPropertyButton accommodationType={accommodationType} />
      </div>

      {!res.ok ? (
        <Card className="p-5 text-sm text-destructive">
          {t("objektePage.loadError")}
        </Card>
      ) : res.data.items.length === 0 ? (
        <EmptyState accommodationType={accommodationType} t={t} />
      ) : (
        <ObjectsList
          items={res.data.items}
          accommodationType={accommodationType}
        />
      )}
    </div>
  );
}

function EmptyState({
  accommodationType,
  t,
}: {
  accommodationType: "vacation_rental" | "hotel" | null;
  t: Awaited<ReturnType<typeof getTranslations<"objects">>>;
}) {
  const isHotel = accommodationType === "hotel";
  return (
    <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-secondary">
        <Icon
          icon={isHotel ? "ph:bed" : "ph:house-line"}
          className="size-7 text-muted-foreground"
        />
      </span>
      <div>
        <p className="font-display text-lg font-extrabold">
          {isHotel
            ? t("objektePage.emptyTitleHotel")
            : t("objektePage.emptyTitleDefault")}
        </p>
        <p className="text-sm text-muted-foreground">
          {isHotel
            ? t("objektePage.emptyBodyHotel")
            : t("objektePage.emptyBodyDefault")}
        </p>
      </div>
      <NewPropertyButton accommodationType={accommodationType} />
    </Card>
  );
}
