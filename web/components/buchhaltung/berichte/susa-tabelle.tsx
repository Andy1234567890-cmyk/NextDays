// Summen- und Saldenliste je Buchungskonto (Soll = Aufwand, Haben = Erlöse).
import { useTranslations } from "next-intl";

import type { SusaResponse } from "@/lib/buchhaltung-berichte-typen";

import { geld } from "./format";
import { NachbarHinweis } from "./nachbar-hinweis";

export function SusaTabelle({ daten }: { daten: SusaResponse }) {
  const t = useTranslations("finance");
  return (
    <div className="flex flex-col gap-3">
      <NachbarHinweis ausgaben={daten.ausgabenVerfuegbar} konten={daten.kontenVerfuegbar} />
      {daten.zeilen.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          {t("berichteGemeinsam.keineDaten")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-secondary/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">{t("berichtePage.susa.konto")}</th>
                <th className="px-4 py-3 font-medium">{t("berichtePage.susa.bezeichnung")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("berichtePage.susa.belege")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("berichtePage.susa.soll")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("berichtePage.susa.haben")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("berichtePage.susa.saldo")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {daten.zeilen.map((z) => (
                <tr key={`${z.nummer ?? "-"}-${z.name}`}>
                  <td className="px-4 py-2.5 font-medium tabular-nums">{z.nummer ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    {z.name}
                    {z.typ ? <span className="ml-2 text-xs text-muted-foreground">{z.typ}</span> : null}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{z.anzahl}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{geld(z.soll, daten.currency)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{geld(z.haben, daten.currency)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{geld(z.saldo, daten.currency)}</td>
                </tr>
              ))}
              <tr className="bg-secondary/40 font-semibold">
                <td className="px-4 py-2.5" colSpan={3}>
                  {t("berichtePage.susa.summe")}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{geld(daten.summeSoll, daten.currency)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{geld(daten.summeHaben, daten.currency)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{geld(daten.saldo, daten.currency)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
