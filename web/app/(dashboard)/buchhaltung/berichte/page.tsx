// Buchhaltung → Berichte: Kennzahlen des Zeitraums + BWA/SuSa/GuV als Reiter.
// Server Component — lädt alle Berichte über die Server-Actions; Zeitraum und
// Reiter stehen in der URL. Kein Realtime: die Finanztabellen sind für
// authenticated bewusst gesperrt (Wurzel 6), ein Abo darauf wäre eine stumme
// Attrappe. Die Seite lädt nach jedem Zeitraumwechsel ohnehin neu.
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { Card } from "@nextdays/ui/card";
import {
  BERICHT_TABS,
  BerichteTabs,
  type BerichtTab,
} from "@/components/buchhaltung/berichte/berichte-tabs";
import { CsvExportKnopf } from "@/components/buchhaltung/berichte/csv-export-knopf";
import { geld } from "@/components/buchhaltung/berichte/format";
import { FremdwaehrungHinweis } from "@/components/buchhaltung/berichte/fremdwaehrung-hinweis";
import { BerichtKpi } from "@/components/buchhaltung/berichte/kpi-kachel";
import { NachbarHinweis } from "@/components/buchhaltung/berichte/nachbar-hinweis";
import { ZeitraumWaehler } from "@/components/buchhaltung/berichte/zeitraum-waehler";
import {
  getBerichtBwa,
  getBerichtGuv,
  getBerichtOverview,
  getBerichtSusa,
} from "@/lib/buchhaltung-berichte";
import { zeitraumAusParams } from "@/lib/buchhaltung-berichte-typen";

export default async function BerichtePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; tab?: string }>;
}) {
  const params = await searchParams;
  const t = await getTranslations("finance");
  const locale = await getLocale();
  const { from, to } = zeitraumAusParams(params);
  const tab: BerichtTab = (BERICHT_TABS as readonly string[]).includes(params.tab ?? "")
    ? (params.tab as BerichtTab)
    : "bwa";
  const jahr = Number(to.slice(0, 4));

  const [overview, bwa, susa, guv] = await Promise.all([
    getBerichtOverview(from, to),
    getBerichtBwa(from, to),
    getBerichtSusa(from, to),
    getBerichtGuv(jahr),
  ]);
  // Fehlende Berechtigung → die Buchhaltung existiert für diesen Nutzer nicht
  // (Sidebar blendet sie aus, Wurzel 3); jeder andere Fehler bleibt sichtbar.
  if (!overview.ok && overview.status === 403) notFound();

  const ariaInfo = t("berichteGemeinsam.infoAria");
  const anzahl = new Intl.NumberFormat(locale);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-extrabold">{t("berichtePage.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("berichtePage.description")}</p>
        </div>
        <CsvExportKnopf report="overview" params={{ from, to }} />
      </div>
      <ZeitraumWaehler from={from} to={to} />

      {!overview.ok ? (
        <Card className="p-5 text-sm text-destructive">{overview.error}</Card>
      ) : (
        <>
          <FremdwaehrungHinweis eintraege={overview.data.fremdwaehrungen} />
          <NachbarHinweis ausgaben={overview.data.ausgabenVerfuegbar} />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <BerichtKpi
              icon="ph:trend-up"
              title={t("berichtePage.kpi.umsatz")}
              wert={geld(overview.data.umsatzNetto, overview.data.currency)}
              unterzeile={t("berichtePage.kpi.umsatzBrutto", {
                betrag: geld(overview.data.umsatzBrutto, overview.data.currency),
              })}
              hinweis={t("berichtePage.kpi.umsatzHinweis")}
              ariaInfo={ariaInfo}
            />
            <BerichtKpi
              icon="ph:receipt"
              title={t("berichtePage.kpi.offen")}
              wert={geld(overview.data.offeneForderungen, overview.data.currency)}
              hinweis={t("berichtePage.kpi.offenHinweis")}
              ariaInfo={ariaInfo}
            />
            <BerichtKpi
              icon="ph:warning"
              title={t("berichtePage.kpi.ueberfaellig")}
              wert={geld(overview.data.ueberfaellig, overview.data.currency)}
              unterzeile={t("berichtePage.kpi.ueberfaelligAnzahl", {
                anzahl: overview.data.ueberfaelligAnzahl,
              })}
              ton={Number(overview.data.ueberfaellig) > 0 ? "schlecht" : "neutral"}
              ariaInfo={ariaInfo}
            />
            <BerichtKpi
              icon="ph:shopping-cart"
              title={t("berichtePage.kpi.ausgaben")}
              wert={
                overview.data.ausgabenVerfuegbar
                  ? geld(overview.data.ausgabenNetto, overview.data.currency)
                  : "—"
              }
              unterzeile={
                overview.data.ausgabenVerfuegbar
                  ? t("berichtePage.kpi.ausgabenAnzahl", { anzahl: overview.data.anzahlAusgaben })
                  : t("berichteGemeinsam.nachbarAusgabenKurz")
              }
              ariaInfo={ariaInfo}
            />
            <BerichtKpi
              icon="ph:scales"
              title={t("berichtePage.kpi.ergebnis")}
              wert={geld(overview.data.ergebnis, overview.data.currency)}
              ton={Number(overview.data.ergebnis) < 0 ? "schlecht" : "gut"}
              hinweis={t("berichtePage.kpi.ergebnisHinweis")}
              ariaInfo={ariaInfo}
            />
            <BerichtKpi
              icon="ph:files"
              title={t("berichtePage.kpi.belege")}
              wert={anzahl.format(overview.data.anzahlBelege)}
              unterzeile={t("berichtePage.kpi.storni", { anzahl: overview.data.anzahlStorni })}
              hinweis={t("berichtePage.kpi.belegeHinweis")}
              ariaInfo={ariaInfo}
            />
          </div>

          {overview.data.topKunden.length > 0 ? (
            <Card className="p-5">
              <h3 className="mb-3 font-semibold">{t("berichtePage.topKunden")}</h3>
              <ul className="divide-y divide-border text-sm">
                {overview.data.topKunden.map((k, i) => (
                  <li key={k.customerId ?? `ohne-${i}`} className="flex items-center justify-between gap-3 py-2">
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="w-5 shrink-0 text-xs text-muted-foreground">{i + 1}.</span>
                      <span className="truncate">{k.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {t("berichtePage.kpi.belegeKurz", { anzahl: k.anzahl })}
                      </span>
                    </span>
                    <span className="font-medium tabular-nums">{geld(k.netto, overview.data.currency)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </>
      )}

      <BerichteTabs tab={tab} from={from} to={to} jahr={jahr} bwa={bwa} susa={susa} guv={guv} />
    </div>
  );
}
