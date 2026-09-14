"use client";

// BWA / SuSa / GuV als Reiter. Alle drei Berichte kommen serverseitig geladen
// mit; der Reiter steht in der URL (`tab`), damit der CSV-Link den richtigen
// Bericht exportiert und ein geteilter Link denselben Reiter öffnet.
import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Card } from "@nextdays/ui/card";
import { Segmented } from "@nextdays/ui/segmented";
import type {
  BerichtResult,
  BwaResponse,
  GuvResponse,
  SusaResponse,
} from "@/lib/buchhaltung-berichte-typen";

import { BwaTabelle } from "./bwa-tabelle";
import { CsvExportKnopf } from "./csv-export-knopf";
import { FremdwaehrungHinweis } from "./fremdwaehrung-hinweis";
import { GuvTabelle } from "./guv-tabelle";
import { SusaTabelle } from "./susa-tabelle";

export type BerichtTab = "bwa" | "susa" | "guv";
export const BERICHT_TABS: readonly BerichtTab[] = ["bwa", "susa", "guv"];

export function BerichteTabs({
  tab,
  from,
  to,
  jahr,
  bwa,
  susa,
  guv,
}: {
  tab: BerichtTab;
  from: string;
  to: string;
  jahr: number;
  bwa: BerichtResult<BwaResponse>;
  susa: BerichtResult<SusaResponse>;
  guv: BerichtResult<GuvResponse>;
}) {
  const t = useTranslations("finance");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function wechseln(neu: BerichtTab) {
    const q = new URLSearchParams(params.toString());
    q.set("tab", neu);
    router.replace(`${pathname}?${q}`);
  }

  const aktiv = tab === "bwa" ? bwa : tab === "susa" ? susa : guv;
  const exportParams =
    tab === "guv" ? { year: String(jahr) } : { from, to };

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          value={tab}
          onChange={wechseln}
          options={BERICHT_TABS.map((k) => ({ value: k, label: t(`berichtePage.tabs.${k}`) }))}
        />
        <CsvExportKnopf report={tab} params={exportParams} />
      </div>
      {!aktiv.ok ? (
        <p className="text-sm text-destructive">{aktiv.error}</p>
      ) : (
        <>
          <FremdwaehrungHinweis eintraege={aktiv.data.fremdwaehrungen} />
          {tab === "bwa" && bwa.ok ? <BwaTabelle daten={bwa.data} /> : null}
          {tab === "susa" && susa.ok ? <SusaTabelle daten={susa.data} /> : null}
          {tab === "guv" && guv.ok ? <GuvTabelle daten={guv.data} /> : null}
        </>
      )}
    </Card>
  );
}
