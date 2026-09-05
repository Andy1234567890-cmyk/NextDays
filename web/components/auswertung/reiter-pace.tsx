"use client";

// Reiter „Pace" — SiteMinders Pace-Bericht: was für die nächsten zwölf
// Monate HEUTE gebucht ist, gegen das, was vor einem Jahr am selben
// Kalendertag für dieselben Monate gebucht WAR — und was daraus wurde.
//
// EIGENER ABRUF: Pace kennt keinen Zeitraum, er blickt immer von heute nach
// vorn. Objekt- und Kanalfilter der Seite gelten trotzdem.
//
// Der Vorjahres-Stichtag braucht den echten Buchungszeitpunkt (`booked_at`).
// Buchungen ohne ihn fehlen im Stichtagswert und stehen als Zahl unter der
// Tabelle, statt still zu fehlen (Wurzel 5b).
import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";

import { Card } from "@nextdays/ui/card";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  XAxis,
  YAxis,
} from "@nextdays/ui/chart";
import { getPace } from "@/lib/auswertung";
import type { PaceBericht, PaceMonat } from "@/lib/auswertung-typen";
import { formatCurrency } from "@/lib/currency";

export function ReiterPace({
  propertyIds,
  channels,
  onDaten,
}: {
  propertyIds: string[];
  channels: string[];
  /** Für den Export: die geladenen Daten nach oben reichen. */
  onDaten?: (p: PaceBericht | null) => void;
}) {
  const t = useTranslations("analysis");
  const locale = useLocale();
  const [p, setP] = useState<PaceBericht | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(true);

  useEffect(() => {
    let aktiv = true;
    setLaedt(true);
    void (async () => {
      const res = await getPace({ propertyIds, channels });
      if (!aktiv) return;
      if (res.ok) {
        setP(res.data);
        setFehler(null);
        onDaten?.(res.data);
      } else {
        setFehler(res.error);
        setP(null);
        onDaten?.(null);
      }
      setLaedt(false);
    })();
    return () => {
      aktiv = false;
    };
    // `onDaten` bewusst nicht in den Abhängigkeiten: eine neue Funktions-
    // identität je Render löste sonst eine Abruf-Schleife aus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyIds.join(","), channels.join(",")]);

  if (laedt && !p) {
    return (
      <Card className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
        <Icon icon="ph:spinner" className="size-4 animate-spin" />
        {t("loading")}
      </Card>
    );
  }
  if (fehler || !p) {
    return <Card className="p-5 text-sm text-destructive">{fehler ?? t("empty")}</Card>;
  }

  const geld = (v: number) => (p.currency ? formatCurrency(v, p.currency) : "—");
  const monat = (m: string) =>
    new Date(`${m}-01T00:00:00`).toLocaleDateString(locale, { month: "short", year: "2-digit" });
  const stichtagVorjahr = (() => {
    const d = new Date(`${p.stichtag}T00:00:00`);
    d.setFullYear(d.getFullYear() - 1);
    return d.toLocaleDateString(locale);
  })();

  const daten = p.monate.map((m) => ({
    monat: monat(m.monat),
    jetzt: m.jetzt_naechte,
    vorjahrStichtag: m.vorjahr_stichtag_naechte,
    vorjahrEnde: m.vorjahr_ende_naechte,
  }));

  const monate = p.monate;
  const sum = (f: (m: PaceMonat) => number) => monate.reduce((n, m) => n + f(m), 0);
  const sumJetzt = sum((m) => m.jetzt_naechte);
  const sumStichtag = sum((m) => m.vorjahr_stichtag_naechte);
  const gesamtDelta = sumStichtag ? Math.round(((sumJetzt - sumStichtag) * 1000) / sumStichtag) / 10 : null;

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h3 className="font-display text-base font-extrabold">{t("pace.title")}</h3>
            <p className="text-xs text-muted-foreground">
              {t("pace.subtitle", {
                heute: new Date(`${p.stichtag}T00:00:00`).toLocaleDateString(locale),
                vorjahr: stichtagVorjahr,
              })}
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-2xl font-extrabold tabular-nums">
              {sumJetzt} <span className="text-base font-normal text-muted-foreground">{t("kpi.nights")}</span>
            </p>
            {gesamtDelta !== null && (
              <p
                className={
                  "text-sm font-medium " +
                  (gesamtDelta >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300")
                }
              >
                {gesamtDelta >= 0 ? "+" : ""}
                {gesamtDelta} % {t("pace.vsLastYear")}
              </p>
            )}
          </div>
        </div>
        <ChartContainer
          config={{
            jetzt: { label: t("pace.now"), color: "var(--chart-1)" },
            vorjahrStichtag: { label: t("pace.lastYearSameDay"), color: "var(--muted-foreground)" },
            vorjahrEnde: { label: t("pace.lastYearFinal"), color: "var(--chart-3)" },
          }}
          className="h-64 w-full"
        >
          <BarChart data={daten}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="monat" tickLine={false} axisLine={false} fontSize={11} />
            <YAxis tickLine={false} axisLine={false} fontSize={11} width={40} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="vorjahrEnde" fill="var(--color-vorjahrEnde)" radius={3} opacity={0.35} />
            <Bar dataKey="vorjahrStichtag" fill="var(--color-vorjahrStichtag)" radius={3} />
            <Bar dataKey="jetzt" fill="var(--color-jetzt)" radius={3} />
          </BarChart>
        </ChartContainer>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left">
              <tr>
                <th className="px-3 py-3 font-medium">{t("col.month")}</th>
                <th className="px-3 py-3 text-right font-medium whitespace-nowrap">{t("pace.nowNights")}</th>
                <th className="px-3 py-3 text-right font-medium whitespace-nowrap">{t("pace.nowRevenue")}</th>
                <th className="px-3 py-3 text-right font-medium whitespace-nowrap">{t("pace.lastYearSameDayNights")}</th>
                <th className="px-3 py-3 text-right font-medium whitespace-nowrap">{t("pace.delta")}</th>
                <th className="px-3 py-3 text-right font-medium whitespace-nowrap">{t("pace.lastYearFinalNights")}</th>
                <th className="px-3 py-3 text-right font-medium whitespace-nowrap">{t("pace.lastYearFinalRevenue")}</th>
              </tr>
            </thead>
            <tbody>
              {p.monate.map((m) => (
                <tr key={m.monat} className="border-b border-border last:border-0">
                  <td className="px-3 py-2.5 whitespace-nowrap">{monat(m.monat)}</td>
                  <td className="px-3 py-2.5 text-right font-medium tabular-nums">{m.jetzt_naechte}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{geld(m.jetzt_umsatz)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{m.vorjahr_stichtag_naechte}</td>
                  <td
                    className={
                      "px-3 py-2.5 text-right tabular-nums " +
                      (m.delta_naechte_pct === null
                        ? "text-muted-foreground"
                        : m.delta_naechte_pct >= 0
                          ? "text-emerald-700 dark:text-emerald-300"
                          : "text-amber-700 dark:text-amber-300")
                    }
                  >
                    {m.delta_naechte_pct === null
                      ? "—"
                      : `${m.delta_naechte_pct >= 0 ? "+" : ""}${m.delta_naechte_pct} %`}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{m.vorjahr_ende_naechte}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{geld(m.vorjahr_ende_umsatz)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-foreground/40 bg-muted/30 font-semibold">
              <tr>
                <td className="px-3 py-2.5">{t("table.total")}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{sumJetzt}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{geld(sum((m) => m.jetzt_umsatz))}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{sumStichtag}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {gesamtDelta === null ? "—" : `${gesamtDelta >= 0 ? "+" : ""}${gesamtDelta} %`}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">{sum((m) => m.vorjahr_ende_naechte)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{geld(sum((m) => m.vorjahr_ende_umsatz))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
          {t("pace.footnote")}
          {p.vorjahr_ohne_zeitstempel > 0 && (
            <> {t("pace.withoutTimestamp", { count: p.vorjahr_ohne_zeitstempel })}</>
          )}
        </p>
      </Card>
    </div>
  );
}
