"use client";

// Preise & Markt — der Preisbericht eines Objekts mit Dynamic Pricing.
//
// VIER KACHELN, EIN DIAGRAMM, EINE TABELLE:
// Abstand zum Markt (Ø über alle Stichtage), Lage der Stichtage (unter / am /
// über Markt), Uplift der Automatik gegen den Grundpreis, Umgang mit dem
// Regel-Berater. Darunter die Kurve: Band = mittleres Feld der Umgebung,
// Linie = Median, gestrichelt der eigene Preis, grau der Grundpreis.
//
// KEINE FREMDNAMEN: gezeigt wird das Preisniveau der Umgebung, nie ein
// Wettbewerber — dieselbe Grenze wie die Marktkarte.
import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";

import { Card } from "@nextdays/ui/card";
import {
  Area,
  CartesianGrid,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from "@nextdays/ui/chart";
import { NativeSelect } from "@nextdays/ui/native-select";
import { formatCurrency } from "@/lib/currency";
import { getPreisbericht, type Preisbericht } from "@/lib/dynamic-pricing";

/** Farbe nach Abstand zum Markt — dieselben Stufen wie die Marktkarte. */
function farbe(abstand: number | null): string {
  if (abstand === null) return "text-muted-foreground";
  if (abstand <= -8) return "text-amber-700 dark:text-amber-300";
  if (abstand < 8) return "text-emerald-700 dark:text-emerald-300";
  return "text-sky-700 dark:text-sky-300";
}

export function PreisMarktBericht({
  objekte,
}: {
  objekte: { id: string; title: string; currency: string | null }[];
}) {
  const t = useTranslations("analysis");
  const locale = useLocale();
  const [pid, setPid] = useState<string>(objekte[0]?.id ?? "");
  const [b, setB] = useState<Preisbericht | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);

  useEffect(() => {
    if (!pid) return;
    let aktiv = true;
    setLaedt(true);
    void (async () => {
      const res = await getPreisbericht(pid);
      if (!aktiv) return;
      if (res.ok) {
        setB(res.data);
        setFehler(null);
      } else {
        setFehler(res.error);
        setB(null);
      }
      setLaedt(false);
    })();
    return () => {
      aktiv = false;
    };
  }, [pid]);

  if (!objekte.length) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        {t("prices.noProperties")}
      </Card>
    );
  }

  const cur = b?.waehrung ?? objekte.find((o) => o.id === pid)?.currency ?? null;
  const geld = (v: number | null | undefined) =>
    v === null || v === undefined || !cur ? "—" : formatCurrency(v, cur);
  const pct = (v: number | null) => (v === null ? "—" : `${v > 0 ? "+" : ""}${v} %`);
  const datum = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(locale, { day: "2-digit", month: "2-digit" });

  const daten =
    b?.verlauf.map((p) => ({
      tag: datum(p.tag),
      median: p.markt_median,
      feld: p.p25 !== null && p.p75 !== null ? [p.p25, p.p75] : null,
      eigen: p.eigener_preis,
      grund: p.grundpreis,
    })) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-64 flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">{t("prices.property")}</span>
          <NativeSelect value={pid} onChange={(e) => setPid(e.target.value)}>
            {objekte.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title}
              </option>
            ))}
          </NativeSelect>
        </label>
        {laedt && <Icon icon="ph:spinner" className="mb-2 size-4 animate-spin text-muted-foreground" />}
      </div>

      {fehler && <Card className="p-4 text-sm text-destructive">{fehler}</Card>}
      {b?.hinweis && (
        <Card className="p-4 text-sm text-amber-900 dark:text-amber-200">{b.hinweis}</Card>
      )}

      {b && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card className="flex flex-col gap-1 p-4">
              <span className="text-xs font-medium text-muted-foreground">{t("prices.distance")}</span>
              <span className={"font-display text-xl font-extrabold tabular-nums " + farbe(b.abstand_schnitt_pct)}>
                {pct(b.abstand_schnitt_pct)}
              </span>
              <span className="text-xs text-muted-foreground">
                {t("prices.distanceHint", {
                  n: b.stichtage_unter_markt + b.stichtage_am_markt + b.stichtage_ueber_markt,
                })}
              </span>
            </Card>
            <Card className="flex flex-col gap-1 p-4">
              <span className="text-xs font-medium text-muted-foreground">{t("prices.position")}</span>
              <span className="flex items-baseline gap-2 font-display text-xl font-extrabold tabular-nums">
                <span className="text-amber-700 dark:text-amber-300">{b.stichtage_unter_markt}</span>
                <span className="text-emerald-700 dark:text-emerald-300">{b.stichtage_am_markt}</span>
                <span className="text-sky-700 dark:text-sky-300">{b.stichtage_ueber_markt}</span>
              </span>
              <span className="text-xs text-muted-foreground">
                {t("prices.below")} · {t("prices.at")} · {t("prices.above")}
              </span>
            </Card>
            <Card className="flex flex-col gap-1 p-4">
              <span className="text-xs font-medium text-muted-foreground">{t("prices.uplift")}</span>
              <span className="font-display text-xl font-extrabold tabular-nums">{pct(b.uplift_pct)}</span>
              <span className="text-xs text-muted-foreground">
                {b.grundpreis === null
                  ? t("prices.noBase")
                  : t("prices.upliftHint", { days: b.tage_mit_preis, base: geld(b.grundpreis) })}
              </span>
            </Card>
            <Card className="flex flex-col gap-1 p-4">
              <span className="text-xs font-medium text-muted-foreground">{t("prices.range")}</span>
              <span className="font-display text-xl font-extrabold tabular-nums">
                {geld(b.preis_min)} – {geld(b.preis_max)}
              </span>
              <span className="text-xs text-muted-foreground">
                {b.preis_schnitt !== null ? t("prices.rangeHint", { avg: geld(b.preis_schnitt) }) : "—"}
              </span>
            </Card>
          </div>

          <Card className="flex flex-col gap-3 p-5">
            <div>
              <h3 className="font-display text-base font-extrabold">{t("prices.chart")}</h3>
              <p className="text-xs text-muted-foreground">{t("prices.chartHint")}</p>
            </div>
            {daten.length ? (
              <ChartContainer
                config={{
                  feld: { label: t("prices.mid"), color: "var(--chart-1)" },
                  median: { label: t("prices.market"), color: "var(--chart-1)" },
                  eigen: { label: t("prices.own"), color: "var(--foreground)" },
                  grund: { label: t("prices.base"), color: "var(--muted-foreground)" },
                }}
                className="h-72 w-full"
              >
                <ComposedChart data={daten}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="tag" tickLine={false} axisLine={false} fontSize={11} />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} width={60} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Area
                    type="monotone"
                    dataKey="feld"
                    stroke="none"
                    fill="var(--color-feld)"
                    fillOpacity={0.15}
                    connectNulls
                  />
                  <Line type="monotone" dataKey="median" stroke="var(--color-median)" strokeWidth={2} dot={false} connectNulls />
                  <Line type="monotone" dataKey="grund" stroke="var(--color-grund)" strokeWidth={1.5} dot={false} connectNulls />
                  <Line
                    type="monotone"
                    dataKey="eigen"
                    stroke="var(--color-eigen)"
                    strokeWidth={2}
                    strokeDasharray="5 3"
                    dot={{ r: 3 }}
                    connectNulls
                  />
                </ComposedChart>
              </ChartContainer>
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">{t("empty")}</p>
            )}
          </Card>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="overflow-hidden lg:col-span-2">
              <h3 className="border-b border-border px-4 py-3 font-display text-base font-extrabold">
                {t("prices.table")}
              </h3>
              <div className="max-h-96 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 border-b border-border bg-muted/40 text-left">
                    <tr>
                      <th className="px-3 py-2 font-medium">{t("col.date")}</th>
                      <th className="px-3 py-2 text-right font-medium">{t("prices.market")}</th>
                      <th className="px-3 py-2 text-right font-medium whitespace-nowrap">{t("prices.mid")}</th>
                      <th className="px-3 py-2 text-right font-medium">{t("prices.own")}</th>
                      <th className="px-3 py-2 text-right font-medium">{t("prices.distance")}</th>
                      <th className="px-3 py-2 text-right font-medium">{t("prices.offers")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {b.verlauf.map((p) => (
                      <tr key={p.tag} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 whitespace-nowrap">
                          {new Date(`${p.tag}T00:00:00`).toLocaleDateString(locale)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{geld(p.markt_median)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground whitespace-nowrap">
                          {p.p25 !== null && p.p75 !== null ? `${geld(p.p25)} – ${geld(p.p75)}` : "—"}
                        </td>
                        <td className="px-3 py-2 text-right font-medium tabular-nums">{geld(p.eigener_preis)}</td>
                        <td className={"px-3 py-2 text-right tabular-nums " + farbe(p.abstand_pct)}>
                          {pct(p.abstand_pct)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{p.anzahl}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className="flex flex-col gap-2 p-4">
              <span className="text-xs font-medium text-muted-foreground">{t("prices.ki")}</span>
              <span className="font-display text-xl font-extrabold tabular-nums">
                <span className="text-emerald-700 dark:text-emerald-300">{b.ki_angenommen_90}</span>
                <span className="text-muted-foreground"> / </span>
                <span className="text-amber-700 dark:text-amber-300">{b.ki_abgelehnt_90}</span>
              </span>
              <span className="text-xs text-muted-foreground">
                {t("prices.kiHint", { accepted: b.ki_angenommen_90, rejected: b.ki_abgelehnt_90 })}
              </span>
              <span className="text-xs text-muted-foreground">
                {t("prices.kiTotal", { accepted: b.ki_angenommen, rejected: b.ki_abgelehnt })}
              </span>
            </Card>
          </div>

          <p className="text-xs text-muted-foreground">
            {t("prices.footnote", {
              km: Math.round(b.radius_km),
              when: b.stand_vom ? new Date(b.stand_vom).toLocaleString(locale) : "—",
            })}
          </p>
        </>
      )}
    </div>
  );
}
