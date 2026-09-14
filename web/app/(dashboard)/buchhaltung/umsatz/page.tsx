// Buchhaltung → Umsatz: Zeitreihe (Monat/Quartal/Jahr), optional nach Kunde,
// Objekt oder Kanal aufgeschlüsselt, plus Tabelle. Zeitraum, Gruppierung und
// Aufschlüsselung stehen in der URL. Kein Realtime (Finanztabellen gesperrt,
// Wurzel 6) — die Seite lädt bei jedem Wechsel neu.
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { Card } from "@nextdays/ui/card";
import { CsvExportKnopf } from "@/components/buchhaltung/berichte/csv-export-knopf";
import { FremdwaehrungHinweis } from "@/components/buchhaltung/berichte/fremdwaehrung-hinweis";
import { UmsatzChart } from "@/components/buchhaltung/berichte/umsatz-chart";
import { UmsatzSteuerung } from "@/components/buchhaltung/berichte/umsatz-steuerung";
import { UmsatzTabelle } from "@/components/buchhaltung/berichte/umsatz-tabelle";
import { ZeitraumWaehler } from "@/components/buchhaltung/berichte/zeitraum-waehler";
import { getBerichtRevenue } from "@/lib/buchhaltung-berichte";
import {
  type Aufschluesselung,
  type Gruppierung,
  zeitraumAusParams,
} from "@/lib/buchhaltung-berichte-typen";

const GRUPPEN: readonly Gruppierung[] = ["month", "quarter", "year"];
const NACH: readonly Aufschluesselung[] = ["customer", "property", "channel"];

export default async function UmsatzPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; group?: string; by?: string }>;
}) {
  const params = await searchParams;
  const t = await getTranslations("finance");
  const { from, to } = zeitraumAusParams(params);
  const group: Gruppierung = (GRUPPEN as readonly string[]).includes(params.group ?? "")
    ? (params.group as Gruppierung)
    : "month";
  const by: Aufschluesselung | null = (NACH as readonly string[]).includes(params.by ?? "")
    ? (params.by as Aufschluesselung)
    : null;

  const res = await getBerichtRevenue(from, to, group, by);
  if (!res.ok && res.status === 403) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-extrabold">{t("umsatzPage.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("umsatzPage.description")}</p>
        </div>
        <CsvExportKnopf report="revenue" params={{ from, to, group, by: by ?? undefined }} />
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <ZeitraumWaehler from={from} to={to} />
        <UmsatzSteuerung group={group} by={by} />
      </div>
      {!res.ok ? (
        <Card className="p-5 text-sm text-destructive">{res.error}</Card>
      ) : (
        <>
          <FremdwaehrungHinweis eintraege={res.data.fremdwaehrungen} />
          <Card className="p-5">
            <UmsatzChart daten={res.data} />
          </Card>
          <Card className="overflow-hidden p-0">
            <UmsatzTabelle daten={res.data} />
          </Card>
        </>
      )}
    </div>
  );
}
