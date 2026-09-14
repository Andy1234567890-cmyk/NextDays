// Buchhaltung → Statistik: Verteilung des Netto-Umsatzes über Kunden, Objekte
// und Kanäle im Zeitraum. Drei Abfragen desselben Berichts (revenue?by=…).
// Kein Realtime (Finanztabellen gesperrt, Wurzel 6).
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { Card } from "@nextdays/ui/card";
import { FremdwaehrungHinweis } from "@/components/buchhaltung/berichte/fremdwaehrung-hinweis";
import { Verteilung } from "@/components/buchhaltung/berichte/verteilung";
import { ZeitraumWaehler } from "@/components/buchhaltung/berichte/zeitraum-waehler";
import { getBerichtRevenue } from "@/lib/buchhaltung-berichte";
import { zeitraumAusParams } from "@/lib/buchhaltung-berichte-typen";

export default async function StatistikPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const t = await getTranslations("finance");
  const { from, to } = zeitraumAusParams(params);
  const [kunden, objekte, kanaele] = await Promise.all([
    getBerichtRevenue(from, to, "year", "customer"),
    getBerichtRevenue(from, to, "year", "property"),
    getBerichtRevenue(from, to, "year", "channel"),
  ]);
  if (!kunden.ok && kunden.status === 403) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-2xl font-extrabold">{t("statistikPage.statistikTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("statistikPage.beschreibung")}</p>
      </div>
      <ZeitraumWaehler from={from} to={to} />
      {!kunden.ok ? (
        <Card className="p-5 text-sm text-destructive">{kunden.error}</Card>
      ) : (
        <>
          <FremdwaehrungHinweis eintraege={kunden.data.fremdwaehrungen} />
          <div className="grid gap-4 xl:grid-cols-3">
            <Verteilung titel={t("statistikPage.nachKunde")} daten={kunden.data} farbe="var(--chart-1)" />
            {objekte.ok ? (
              <Verteilung titel={t("statistikPage.nachObjekt")} daten={objekte.data} farbe="var(--chart-2)" />
            ) : (
              <Card className="p-5 text-sm text-destructive">{objekte.error}</Card>
            )}
            {kanaele.ok ? (
              <Verteilung titel={t("statistikPage.nachKanal")} daten={kanaele.data} farbe="var(--chart-3)" />
            ) : (
              <Card className="p-5 text-sm text-destructive">{kanaele.error}</Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}
