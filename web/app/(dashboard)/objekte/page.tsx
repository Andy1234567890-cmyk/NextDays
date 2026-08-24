// Objekte-Übersicht (Rentals): Liste aller Objekte des Tenants.
// Server Component — lädt über die Server-Action, rendert Kopf + Anlage-Button
// und übergibt die Objekte an die Client-Liste (Suche/Filter/Karten, Lodgify).
import { getTranslations } from "next-intl/server";

import { NewPropertyButton } from "@/components/objekte/new-property-button";
import { ObjectsList } from "@/components/objekte/objects-list";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { getMe } from "@/lib/auth";
import { listProperties } from "@/lib/properties";
import { ruleCoverage } from "@/lib/tasks";

export default async function ObjektePage({
  searchParams,
}: {
  searchParams: Promise<{ archiv?: string }>;
}) {
  // Archiv-Ansicht (0416). Über die Adresse gesteuert, nicht über Client-State:
  // ein archiviertes Objekt muss per Link auffindbar und teilbar sein — sonst
  // ist es aus der Oberfläche verschwunden, sobald es aus der Liste fällt.
  const archiv = (await searchParams).archiv === "1";
  // Betriebsart mitladen: Hotel spricht von „Zimmern" und bekommt die
  // Zimmertypen-Liste in der Anlage (0090/0098).
  //
  // Die Archiv-Zahl kommt IMMER mit, auch in der normalen Ansicht: nur so gibt
  // es überhaupt einen sichtbaren Weg ins Archiv. Ohne sie wüsste niemand, dass
  // dort etwas liegt.
  // Regel-Deckung mitladen: ein neu angelegtes Objekt fällt aus einer Regel,
  // der schon Objekte zugeordnet sind — sie gilt dann NUR für die gelisteten.
  // Bisher erfuhr man das nirgends: die Aufgaben blieben einfach aus. Der
  // Hinweis gehört genau hierhin, weil hier Objekte entstehen; wer keine
  // Aufgabenverwaltung darf, bekommt einen Fehler und damit kein Banner.
  const [res, archivRes, me, t, tAufgaben, deckung] = await Promise.all([
    listProperties({ archiviert: archiv }),
    archiv ? Promise.resolve(null) : listProperties({ archiviert: true }),
    getMe(),
    getTranslations("objects"),
    getTranslations("reservations"),
    archiv ? Promise.resolve(null) : ruleCoverage(),
  ]);
  const ohneRegel =
    deckung?.ok && deckung.data.betroffen.length > 0 ? deckung.data : null;
  const archivAnzahl = archiv
    ? res.ok
      ? res.data.items.length
      : 0
    : archivRes?.ok
      ? archivRes.data.items.length
      : 0;
  const accommodationType = me?.accommodation_type ?? null;
  const isHotel = accommodationType === "hotel";

  return (
    <div className="flex flex-col gap-6">
      <RealtimeRefresh tables={["properties"]} />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-extrabold">
            {archiv
              ? t("objektePage.archivTitle")
              : isHotel
                ? t("objektePage.titleHotel")
                : t("objektePage.titleDefault")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {archiv
              ? t("objektePage.archivSubtitle")
              : isHotel
                ? t("objektePage.subtitleHotel")
                : t("objektePage.subtitleDefault")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Der Weg ins Archiv und zurück. Nur sichtbar, wenn dort etwas
              liegt (bzw. man schon drin ist) — ein leeres Archiv braucht
              keinen Knopf. Ohne diesen Link ist ein archiviertes Objekt aus
              der Oberfläche verschwunden: es fällt aus der Liste und es gibt
              keine zweite Stelle, an der es auftaucht. */}
          {(archiv || archivAnzahl > 0) && (
            <Button asChild variant="outline" size="sm">
              <Link href={archiv ? "/objekte" : "/objekte?archiv=1"}>
                <Icon
                  icon={archiv ? "ph:arrow-left" : "ph:archive"}
                  className="size-4"
                />
                {archiv
                  ? t("objektePage.archivBack")
                  : t("objektePage.archivOpen", { count: archivAnzahl })}
              </Link>
            </Button>
          )}
          {!archiv && <NewPropertyButton accommodationType={accommodationType} />}
        </div>
      </div>

      {ohneRegel && (
        <Card className="border-warning/40 bg-warning/10 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Icon icon="ph:warning-circle" className="size-4 shrink-0" />
            {tAufgaben("ruleList.deckung.titel")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {tAufgaben("ruleList.deckung.text", {
              count: ohneRegel.betroffen.length,
              total: ohneRegel.objekte,
            })}
          </p>
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link href="/reservierungen/aufgaben/planmaessig">
              <Icon icon="ph:list-checks" className="size-4" />
              {tAufgaben("ruleList.kindTitle.auto")}
            </Link>
          </Button>
        </Card>
      )}

      {!res.ok ? (
        <Card className="p-5 text-sm text-destructive">
          {t("objektePage.loadError")}
        </Card>
      ) : res.data.items.length === 0 ? (
        archiv ? (
          <Card className="p-5 text-sm text-muted-foreground">
            {t("objektePage.archivEmpty")}
          </Card>
        ) : (
          <EmptyState accommodationType={accommodationType} t={t} />
        )
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
