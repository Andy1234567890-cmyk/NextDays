"use client";

// Forecast & Pace (SiteMinder „Forecasting"): belegt gegen gelernte Erwartung
// der nächsten 90 Tage, dazu die Angebotsdichte der Umgebung.
//
// Die Erwartung kommt aus DEMSELBEN Pickup-Modell, das die Engine für den
// Faktor „Buchungstempo" nutzt (dp_pickup_snapshots). Ohne gelernte Kurve
// steht das hier — kein erfundener Prozentwert (Wurzel 4).
import { useEffect, useState } from "react";
import { useLocale } from "next-intl";

import { Card } from "@nextdays/ui/card";
import {
  Bar,
  CartesianGrid,
  Cell,
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
import { getForecast, type Forecast } from "@/lib/dynamic-pricing";

const PACE_TEXT: Record<
  NonNullable<Forecast["pace"]>,
  { text: string; cls: string; symbol: string }
> = {
  vor: { text: "vor Plan", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300", symbol: "↑" },
  im_plan: { text: "im Plan", cls: "bg-muted text-muted-foreground", symbol: "→" },
  hinter: { text: "hinter Plan", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300", symbol: "↓" },
};

type Woche = {
  /** Erster Tag der Woche, formatiert (X-Achse). */
  ab: string;
  abIso: string;
  belegt: number;
  erwartet: number | null;
  markt: number | null;
  /** Belegt vs. Erwartung: über/unter/ohne Erwartung — steuert die Balkenfarbe. */
  lage: "vor" | "hinter" | "neutral";
};

export function DpForecastKarte({ propertyId }: { propertyId: string }) {
  const locale = useLocale();
  const [f, setF] = useState<Forecast | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    let aktiv = true;
    getForecast(propertyId).then((res) => {
      if (!aktiv) return;
      if (res.ok) setF(res.data);
      else setFehler(res.error);
    });
    return () => {
      aktiv = false;
    };
  }, [propertyId]);

  if (fehler) {
    return (
      <Card className="p-4 text-sm text-muted-foreground">
        Forecast nicht verfügbar: {fehler}
      </Card>
    );
  }
  if (!f) return null;

  // 90 Tage als Wochen: je Woche der Anteil belegter Tage (Balken) und die
  // gelernte Erwartung (Linie). Ein Tag pro Pixel wäre unlesbar.
  const wochen: Woche[] = [];
  for (let i = 0; i < f.tage.length; i += 7) {
    const stueck = f.tage.slice(i, i + 7);
    const e = stueck.filter((t) => t.erwartet !== null);
    const m = stueck.filter((t) => t.markt_angebote !== null);
    const belegt = Math.round((stueck.filter((t) => t.belegt).length / stueck.length) * 100);
    const erwartet = e.length
      ? Math.round((e.reduce((s, t) => s + (t.erwartet ?? 0), 0) / e.length) * 100)
      : null;
    const ab = stueck[0]?.date ?? "";
    wochen.push({
      abIso: ab,
      ab: ab
        ? new Date(`${ab}T00:00:00`).toLocaleDateString(locale, { day: "2-digit", month: "2-digit" })
        : "",
      belegt,
      erwartet,
      markt: m.length
        ? Math.round(m.reduce((s, t) => s + (t.markt_angebote ?? 0), 0) / m.length)
        : null,
      lage:
        erwartet === null ? "neutral" : belegt >= erwartet ? "vor" : "hinter",
    });
  }
  const mitErwartung = wochen.some((w) => w.erwartet !== null);
  const mitMarkt = wochen.some((w) => w.markt !== null);

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            Belegung der nächsten {f.horizont_tage} Tage
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="font-display text-3xl font-extrabold tabular-nums">
              {f.belegt_pct.toFixed(0)} %
            </span>
            {f.erwartet_pct !== null ? (
              <span className="text-sm text-muted-foreground">
                erwartet <span className="font-semibold text-foreground">{f.erwartet_pct.toFixed(0)} %</span>
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">noch keine gelernte Erwartung</span>
            )}
          </div>
        </div>
        {f.pace && (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${PACE_TEXT[f.pace].cls}`}
          >
            <span aria-hidden>{PACE_TEXT[f.pace].symbol}</span>
            Buchungstempo {PACE_TEXT[f.pace].text}
          </span>
        )}
      </div>

      <ChartContainer
        config={{
          belegt: { label: "Belegt", color: "var(--accent)" },
          erwartet: { label: "Erwartet", color: "var(--foreground)" },
          markt: { label: "Freie Angebote im Umkreis", color: "var(--muted-foreground)" },
        }}
        className="h-44 w-full"
      >
        <ComposedChart data={wochen} barCategoryGap="28%">
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="ab" tickLine={false} axisLine={false} fontSize={11} />
          <YAxis
            yAxisId="pct"
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            tickFormatter={(v: number) => `${v} %`}
            tickLine={false}
            axisLine={false}
            fontSize={11}
            width={44}
          />
          {mitMarkt && (
            <YAxis
              yAxisId="markt"
              orientation="right"
              tickLine={false}
              axisLine={false}
              fontSize={11}
              width={32}
              allowDecimals={false}
            />
          )}
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(label) => `Woche ab ${String(label)}`}
                formatter={(value, name) =>
                  name === "markt"
                    ? [`${value} Objekte frei`, "Freie Angebote im Umkreis"]
                    : [`${value} %`, name === "belegt" ? "Belegt" : "Erwartet"]
                }
              />
            }
          />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar yAxisId="pct" dataKey="belegt" radius={[4, 4, 0, 0]} fill="var(--color-belegt)">
            {wochen.map((w) => (
              // Blass, wo die Woche hinter der Erwartung liegt — die Farbe
              // bleibt eine, sonst braucht der Balken eine zweite Legende.
              <Cell key={w.abIso} fillOpacity={w.lage === "hinter" ? 0.45 : 0.9} />
            ))}
          </Bar>
          {mitErwartung && (
            <Line
              yAxisId="pct"
              type="monotone"
              dataKey="erwartet"
              stroke="var(--color-erwartet)"
              strokeWidth={2}
              strokeDasharray="5 3"
              dot={{ r: 3 }}
              connectNulls
            />
          )}
          {mitMarkt && (
            <Line
              yAxisId="markt"
              type="monotone"
              dataKey="markt"
              stroke="var(--color-markt)"
              strokeWidth={1.5}
              dot={false}
              connectNulls
            />
          )}
        </ComposedChart>
      </ChartContainer>

      <p className="text-xs text-muted-foreground">
        {f.hinweis ??
          "Balken: Anteil belegter Nächte je Woche, blass wo er unter der Erwartung liegt. Gestrichelt: gelernte Erwartung bei diesem Vorlauf. Graue Linie: freie Angebote der Umgebung (rechte Achse)."}
      </p>
    </Card>
  );
}
