"use client";

// Reiter „Muster" — was SiteMinder als Kennzahlen führt und Hostaway gar
// nicht: Leistung je Wochentag, Buchungsfenster (Vorlauf) und
// Aufenthaltsdauer als Verteilung.
//
// Drei Fragen, drei Karten: An welchen Wochentagen verdiene ich? Wie lange
// vorher buchen meine Gäste? Wie lange bleiben sie? Alle drei aus DENSELBEN
// Buchungen wie die übrigen Reiter.
//
// UMSATZ JE WOCHENTAG verteilt den Buchungsbetrag gleichmäßig auf die Nächte
// der Buchung — die Portale liefern keinen Preis je Nacht. Das steht unter
// der Tabelle, nicht in einem Hilfe-Artikel.
import { useLocale, useTranslations } from "next-intl";

import { Card } from "@nextdays/ui/card";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  XAxis,
  YAxis,
} from "@nextdays/ui/chart";
import { formatCurrency } from "@/lib/currency";
import type { Auswertung, VerteilungZeile } from "@/lib/auswertung-typen";

import { VergleichHinweis } from "./vergleich-delta";

/** Kurzname eines ISO-Wochentags (0 = Montag) in der Sprache des Nutzers. */
export function wochentagName(w: number, locale: string, art: "short" | "long" = "short"): string {
  // 2026-09-07 ist ein Montag.
  const d = new Date(2026, 8, 7 + w);
  return d.toLocaleDateString(locale, { weekday: art });
}

export function ReiterMuster({ a }: { a: Auswertung }) {
  const t = useTranslations("analysis");
  const locale = useLocale();

  const geld = (v: number | null) =>
    v === null || !a.currency ? "—" : formatCurrency(v, a.currency);
  const pct = (v: number | null) => (v === null ? "—" : `${v} %`);

  const leer = !a.kennzahlen.buchungen && !a.vorher?.kennzahlen.buchungen;
  if (leer) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">{t("empty")}</Card>
    );
  }

  const wtDaten = a.wochentage.map((w) => ({
    tag: wochentagName(w.wochentag, locale),
    auslastung: w.auslastung_pct ?? 0,
    umsatz: w.umsatz,
  }));

  return (
    <div className="flex flex-col gap-4">
      {a.vorher && (
        <VergleichHinweis vergleich={a.vorher.vergleich} von={a.vorher.von} bis={a.vorher.bis} />
      )}

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-1 border-b border-border px-4 py-3">
          <h3 className="font-display text-base font-extrabold">{t("patterns.weekday")}</h3>
          <p className="text-xs text-muted-foreground">{t("patterns.weekdayHint")}</p>
        </div>
        <div className="grid gap-4 p-4 lg:grid-cols-2">
          <ChartContainer
            config={{ auslastung: { label: t("kpi.occupancy"), color: "var(--chart-1)" } }}
            className="h-48 w-full"
          >
            <BarChart data={wtDaten}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="tag" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis tickLine={false} axisLine={false} fontSize={11} width={36} unit=" %" />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="auslastung" fill="var(--color-auslastung)" radius={3} />
            </BarChart>
          </ChartContainer>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">{t("col.weekday")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("col.booked")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("kpi.occupancy")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("col.arrivals")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("kpi.revenue")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("kpi.adr")}</th>
                </tr>
              </thead>
              <tbody>
                {a.wochentage.map((w) => {
                  const vorher = a.vorher?.wochentage.find((v) => v.wochentag === w.wochentag);
                  return (
                    <tr key={w.wochentag} className="border-b border-border last:border-0">
                      <td className="px-3 py-2">{wochentagName(w.wochentag, locale, "long")}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {w.naechte_gebucht}
                        <span className="text-muted-foreground"> / {w.naechte_buchbar}</span>
                      </td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">
                        {pct(w.auslastung_pct)}
                        {vorher && (
                          <span className="block text-xs font-normal text-muted-foreground">
                            {t("comparePrevious", { value: pct(vorher.auslastung_pct) })}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{w.anreisen}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{geld(w.umsatz)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{geld(w.adr)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Verteilung
          titel={t("patterns.leadTime")}
          hinweis={t("patterns.leadTimeHint")}
          einheit={t("patterns.days")}
          zeilen={a.buchungsfenster}
          vorher={a.vorher?.buchungsfenster}
          geld={geld}
        />
        <Verteilung
          titel={t("patterns.stayLength")}
          hinweis={t("patterns.stayLengthHint")}
          einheit={t("patterns.nights")}
          zeilen={a.aufenthaltsdauer}
          vorher={a.vorher?.aufenthaltsdauer}
          geld={geld}
        />
      </div>
    </div>
  );
}

function Verteilung({
  titel,
  hinweis,
  einheit,
  zeilen,
  vorher,
  geld,
}: {
  titel: string;
  hinweis: string;
  einheit: string;
  zeilen: VerteilungZeile[];
  vorher?: VerteilungZeile[];
  geld: (v: number | null) => string;
}) {
  const t = useTranslations("analysis");
  const daten = zeilen.map((z) => ({ eimer: `${z.schluessel} ${einheit}`, anteil: z.anteil_pct }));
  const gesamt = zeilen.reduce((n, z) => n + z.buchungen, 0);
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-1 border-b border-border px-4 py-3">
        <h3 className="font-display text-base font-extrabold">{titel}</h3>
        <p className="text-xs text-muted-foreground">{hinweis}</p>
      </div>
      {gesamt === 0 ? (
        <p className="p-8 text-center text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <>
          <ChartContainer
            config={{ anteil: { label: t("col.share"), color: "var(--chart-1)" } }}
            className="h-40 w-full px-4 pt-4"
          >
            <BarChart data={daten}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="eimer" tickLine={false} axisLine={false} fontSize={10} />
              <YAxis tickLine={false} axisLine={false} fontSize={11} width={36} unit=" %" />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="anteil" fill="var(--color-anteil)" radius={3} />
            </BarChart>
          </ChartContainer>
          <table className="w-full text-sm">
            <thead className="border-y border-border bg-muted/40 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">{einheit}</th>
                <th className="px-3 py-2 text-right font-medium">{t("col.bookingsShort")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("col.share")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("col.nights")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("kpi.revenue")}</th>
              </tr>
            </thead>
            <tbody>
              {zeilen.map((z) => {
                const v = vorher?.find((x) => x.schluessel === z.schluessel);
                return (
                  <tr key={z.schluessel} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 tabular-nums">{z.schluessel}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{z.buchungen}</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">
                      {z.anteil_pct} %
                      {v && (
                        <span className="block text-xs font-normal text-muted-foreground">
                          {t("comparePrevious", { value: `${v.anteil_pct} %` })}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{z.naechte}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{geld(z.umsatz)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </Card>
  );
}
