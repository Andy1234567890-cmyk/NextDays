// Buchhaltung → Listen: Offene Posten Debitoren zum heutigen Stichtag mit
// Alterungsstruktur (0-30/31-60/61-90/>90 Tage). Kein Zeitraum — die OP-Liste
// ist ein Stichtagsbericht. Kein Realtime (Finanztabellen gesperrt, Wurzel 6).
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { Card } from "@nextdays/ui/card";
import { CsvExportKnopf } from "@/components/buchhaltung/berichte/csv-export-knopf";
import { datum } from "@/components/buchhaltung/berichte/format";
import { FremdwaehrungHinweis } from "@/components/buchhaltung/berichte/fremdwaehrung-hinweis";
import { OpListe } from "@/components/buchhaltung/berichte/op-liste";
import { getOffenePosten } from "@/lib/buchhaltung-berichte";

export default async function ListenPage() {
  const t = await getTranslations("finance");
  const locale = await getLocale();
  const res = await getOffenePosten();
  if (!res.ok && res.status === 403) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-extrabold">{t("listenPage.listenTitle")}</h2>
          <p className="text-sm text-muted-foreground">
            {res.ok
              ? t("listenPage.stichtag", { datum: datum(res.data.stichtag, locale) })
              : t("listenPage.listenDescription")}
          </p>
        </div>
        <CsvExportKnopf report="open-items" params={{}} />
      </div>
      {!res.ok ? (
        <Card className="p-5 text-sm text-destructive">{res.error}</Card>
      ) : (
        <>
          <FremdwaehrungHinweis eintraege={res.data.fremdwaehrungen} />
          <OpListe daten={res.data} />
        </>
      )}
    </div>
  );
}
