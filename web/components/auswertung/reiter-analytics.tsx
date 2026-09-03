"use client";

// Reiter „Analytics" — Verlauf und Verteilung.
//
// Drei Diagramme statt eines Widget-Baukastens (Hostaways Weg): der Baukasten
// verlangt, dass jeder Betrieb sich seine Sicht erst zusammenklickt. Die drei
// Fragen, die jeder stellt — wie läuft es über die Zeit, woher kommt der
// Umsatz, welches Objekt trägt — beantwortet die Seite ungefragt.
import { useTranslations } from "next-intl";
import { Card } from "@nextdays/ui/card";
// ALLES aus EINER Quelle — auch die recharts-Primitiven. Sie direkt aus
// "recharts" zu holen, holt im Monorepo eine ZWEITE Modulinstanz (packages/ui
// und web haben je eine eigene Kopie). recharts reicht die berechnete
// Diagrammgröße über einen React-Context weiter, der an die Instanz gebunden
// ist: der Provider des `ChartContainer` füllt dann einen Context, den
// `LineChart` nie liest. Ergebnis ist ein korrekt bemessener, aber komplett
// leerer Kasten — kein SVG, keine Fehlermeldung. Live passiert am 30.08.2026,
// derselbe Fehler wie zuvor in portal-statistiken.tsx.
import type { ChartConfig } from "@nextdays/ui/chart";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "@nextdays/ui/chart";
import { formatCurrency } from "@/lib/currency";
import type { Auswertung } from "@/lib/auswertung-typen";
import type { AvailabilitySource } from "@/lib/calendar";
import { channelChartColor } from "@/lib/calendar-channels";
import { channelLabelLoose } from "@/lib/channel-logos";
import { useCalendarLabels } from "@/lib/use-calendar-labels";

import { VergleichHinweis } from "./vergleich-delta";

// Feste Farbfolge aus den Design-Tokens — keine arbitrary Hex-Werte.
const FARBEN = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

/** Ein Punkt der zusammengeführten Reihe.
 *
 *  `umsatz` ist hier `number | null` — anders als in `Punkt`: ein Tag, den es
 *  nur im Vergleichszeitraum gab, hat in der Gegenwart KEINEN Wert, und `0`
 *  wäre dort die falsche Aussage „null Umsatz". */
type VerlaufPunkt = {
  period: string;
  umsatz: number | null;
  naechte: number;
  buchungen: number;
  vorherUmsatz?: number | null;
};

export function ReiterAnalytics({ a }: { a: Auswertung }) {
  const t = useTranslations("analysis");
  // Kanalnamen aus `calendar.channel.*` — dem EINEN Katalog, den
  // `scripts/i18n/kanal-enums-pruefen.mjs` über alle fünf Stellen
  // deckungsgleich hält.
  const { channelLabel } = useCalendarLabels();

  // Leer ist der Reiter nur, wenn BEIDE Zeiträume nichts hergeben. Sonst
  // verschwände der Vergleich genau dann, wenn er am meisten sagt: „dieses
  // Jahr kein Umsatz, letztes Jahr 40.000" ist die stärkste Aussage, die ein
  // Vorjahresvergleich machen kann — und stünde hier als bloßes „keine Daten".
  if (!a.verlauf.length && !a.vorher?.verlauf.length) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        {t("empty")}
      </Card>
    );
  }

  // Betrags-Vergleich NUR bei gleicher Währung: sonst lägen DKK und EUR auf
  // derselben Achse und die Vorjahreslinie sähe aus, als wäre der Umsatz
  // eingebrochen (Wurzel 4). `!!a.currency` gehört dazu — bei mehreren
  // Währungen ist beides `null`, und `null === null` wäre `true`.
  const waehrungGleich =
    !!a.vorher && !!a.currency && a.vorher.currency === a.currency;

  // Der laufende Zeitraum ist leer und der Vergleich lässt sich nicht
  // zeichnen (andere Währung): dann gäbe es zwar Vorjahresdaten, aber keine
  // Linie. Ein leeres Diagrammgerüst wäre schlechter als eine Auskunft.
  const nurUnvergleichbaresVorjahr =
    !a.verlauf.length && !!a.vorher?.verlauf.length && !waehrungGleich;

  const geld = (v: number) => (a.currency ? formatCurrency(v, a.currency) : String(v));

  // Beide Zeitreihen auf EINER Achse.
  //
  // Verbunden wird über `period_normal` — den Schlüssel des Vorjahrespunktes,
  // auf die Gegenwart umgerechnet („2025-08-03" → „2026-08-03"). NICHT über
  // die Position im Array: das Backend legt nur Punkte an, in denen etwas
  // liegt, die Reihen sind also verschieden lang. Gemessen (03.09.2026): drei
  // Buchungstage 2026 gegen zwei 2025 ergaben per Index „3. August 2026 gegen
  // 1. August 2025" und „10. August gegen 25. August" — eine Kurve, die
  // plausibel aussieht und falsche Tage gegenüberstellt.
  //
  // Die Achse trägt die Beschriftung des laufenden Zeitraums; ein
  // Vorjahrespunkt ohne Partner in der Gegenwart (damals verkauft, heute
  // nicht) bekommt dadurch eine eigene Achsenposition.
  //
  const verlaufDaten: VerlaufPunkt[] = (() => {
    if (!a.vorher || !waehrungGleich) return a.verlauf;
    const vorherNachKey = new Map<string, number>();
    for (const p of a.vorher.verlauf) {
      if (p.period_normal) vorherNachKey.set(p.period_normal, p.umsatz);
    }
    const reihe: VerlaufPunkt[] = a.verlauf.map((punkt) => {
      const treffer = vorherNachKey.get(punkt.period);
      vorherNachKey.delete(punkt.period);
      return { ...punkt, vorherUmsatz: treffer ?? null };
    });
    // Was übrig bleibt, gab es NUR im Vorjahr. Diese Punkte hängen hinten an
    // und werden nach Schlüssel einsortiert — sie wegzulassen hieße, einen
    // weggefallenen Umsatz aus dem Bild zu nehmen.
    for (const [key, umsatz] of vorherNachKey) {
      reihe.push({
        // `null`, nicht 0: an diesem Tag gibt es im laufenden Zeitraum keinen
        // Datenpunkt. Eine 0 wäre die Aussage „null Umsatz" und zöge die
        // Hauptlinie sichtbar auf die Grundlinie herunter (Wurzel 4);
        // `null` lässt recharts die Lücke einfach aus.
        period: key,
        umsatz: null,
        naechte: 0,
        buchungen: 0,
        vorherUmsatz: umsatz,
      });
    }
    return reihe.sort((x, y) => x.period.localeCompare(y.period));
  })();

  // Kanal-Donut: Farbe und Name aus dem KANAL, nicht aus der Listenposition
  // (03.09.2026, dieselbe Wurzel wie im Kontrollzentrum).
  //
  // Vorher lief die Füllung über `FARBEN[i]` — eine allgemeine Chart-Palette:
  // Booking.com bekam Rot, Airbnb Blau, je nachdem wer zuerst in den Daten
  // stand. Die Portalfarben (#003580 / #ff5a5f) liegen längst als Tokens in
  // `globals.css`. Zusätzlich stand `config={{}}`, weshalb der Donut WEDER
  // eine Legende hatte NOCH einen Kanalnamen im Tooltip — im Screenshot vom
  // 03.09.2026 drei namenlose Segmente.
  const kanalDaten = a.kanaele
    // EIGENNUTZUNG GEHÖRT NICHT IN EINEN UMSATZ-DONUT.
    //
    // Sie trägt per Definition 0,00 — der Hauseigentümer zahlt nicht. Im
    // Diagramm erschien sie als Segment ohne Fläche, in der Legende aber als
    // vollwertiger Eintrag „owner_stay" (Screenshot 03.09.2026). Ein Kanal
    // mit 0 % Anteil in einer Anteils-Darstellung ist eine Aussage über
    // einen Anteil, den es nicht gibt. Die Kanal-TABELLE führt sie weiter —
    // dort steht die Nächtezahl, und die ist echt.
    .filter((k) => k.channel !== "owner_stay" && k.umsatz > 0)
    .map((k) => ({
      key: `${k.channel}-${k.ota_name ?? ""}`,
      // Der echte Portalname, wo einer vorliegt („Booking.com" — auch aus der
      // Rohform „BookingCom"), sonst der ÜBERSETZTE Kanalname aus
      // `calendar.channel.*`. NICHT `channelLabel` aus `channel-logos`: das
      // ist der Channex-Portalkatalog, er kennt unsere internen Kanalwerte
      // (`website`, `direct`, `portal`) nicht und gäbe den Rohcode zurück —
      // im Screenshot stand deshalb „website" statt „Website".
      name: k.ota_name
        ? channelLabelLoose(k.ota_name)
        : channelLabel(k.channel as AvailabilitySource),
      value: k.umsatz,
      fill: channelChartColor(k.channel as AvailabilitySource),
    }));

  const kanalConfig: ChartConfig = Object.fromEntries(
    // Schlüssel ist der NAME: `ChartLegendContent` schlägt über `nameKey`
    // nach und nimmt dabei den Wert des Feldes als Schlüssel.
    kanalDaten.map((k) => [k.name, { label: k.name, color: k.fill }]),
  );

  const verlaufConfig: ChartConfig =
    a.vorher && waehrungGleich
      ? {
          umsatz: { label: t("kpi.revenue"), color: FARBEN[0] },
          vorherUmsatz: {
            label: t(`compare.${a.vorher.vergleich}`),
            // Gedämpftes Grau, NICHT `FARBEN[1]` (= `--chart-2`, reines
            // Schwarz): der Vorwert ist Bezugsgröße, nicht gleichrangige
            // Aussage. Schwarz auf Weiß war kontraststärker als die rote
            // Hauptlinie und zog den Blick auf das Vorjahr.
            color: "var(--muted-foreground)",
          },
        }
      : { umsatz: { label: t("kpi.revenue"), color: FARBEN[0] } };

  return (
    <div className="flex flex-col gap-4">
      {a.vorher && (
        <VergleichHinweis
          vergleich={a.vorher.vergleich}
          von={a.vorher.von}
          bis={a.vorher.bis}
        />
      )}
      <Card className="flex flex-col gap-3 p-5">
        <h3 className="font-display text-base font-extrabold">
          {t("chart.revenueOverTime")}
        </h3>
        {a.vorher && !waehrungGleich && (
          // Der Vergleich ist angefordert, aber nicht darstellbar. Das
          // stillschweigend wegzulassen sähe aus wie „kein Vorjahr vorhanden".
          <p className="text-xs text-muted-foreground">
            {t("compareChartCurrencyMismatch")}
          </p>
        )}
        {nurUnvergleichbaresVorjahr ? (
          // Nichts zu zeichnen: der laufende Zeitraum ist leer, und die
          // Vorjahreslinie scheidet wegen der Währung aus. Ein leeres
          // Diagrammgerüst behauptete „Verlauf bei null" (Wurzel 4).
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t("empty")}
          </p>
        ) : (
        <ChartContainer config={verlaufConfig} className="h-64 w-full">
          <LineChart data={verlaufDaten}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="period" tickLine={false} axisLine={false} fontSize={11} />
            <YAxis tickLine={false} axisLine={false} fontSize={11} width={70} />
            <ChartTooltip content={<ChartTooltipContent />} />
            {a.vorher && waehrungGleich && (
              // Gestrichelt und hinter der Hauptlinie: der Vorwert ist
              // Bezugsgröße, nicht gleichrangige Aussage.
              <Line
                type="monotone"
                dataKey="vorherUmsatz"
                stroke="var(--color-vorherUmsatz)"
                strokeWidth={2}
                strokeDasharray="4 3"
                dot={false}
                connectNulls
              />
            )}
            {/* `connectNulls` wie bei der Vorjahreslinie: ein Tag ohne
                Datenpunkt (nur im Vergleichszeitraum vorhanden) darf die Kurve
                nicht ZERREISSEN. Ohne das lag die Hauptlinie in Stücken,
                während die Vorjahreslinie durchlief — im Screenshot vom
                03.09.2026 sichtbar als abgerissene rote Segmente. */}
            <Line
              type="monotone"
              dataKey="umsatz"
              stroke="var(--color-umsatz)"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          </LineChart>
        </ChartContainer>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-3 p-5">
          <h3 className="font-display text-base font-extrabold">
            {t("chart.shareByChannel")}
          </h3>
          {kanalDaten.length ? (
            <ChartContainer config={kanalConfig} className="h-64 w-full">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                <Pie
                  data={kanalDaten}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={95}
                >
                  {kanalDaten.map((k) => (
                    <Cell key={k.key} fill={k.fill} />
                  ))}
                </Pie>
                <ChartLegend content={<ChartLegendContent nameKey="name" />} />
              </PieChart>
            </ChartContainer>
          ) : (
            <p className="py-16 text-center text-sm text-muted-foreground">
              {t("empty")}
            </p>
          )}
        </Card>

        <Card className="flex flex-col gap-3 p-5">
          <h3 className="font-display text-base font-extrabold">
            {t("chart.revenueByProperty")}
          </h3>
          {a.objekte.some((o) => o.umsatz > 0) ? (
            <ChartContainer
              // `FARBEN[0]` (Markenrot), nicht `FARBEN[1]`: das ist
              // `--chart-2` = #0a0a0a, also reines Schwarz — ein Balkenblock
              // ohne jede Farbe (Screenshot 03.09.2026).
              config={{ umsatz: { label: t("kpi.revenue"), color: FARBEN[0] } }}
              className="h-64 w-full"
            >
              <BarChart
                data={a.objekte.filter((o) => o.umsatz > 0).slice(0, 10)}
                layout="vertical"
              >
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis
                  type="category"
                  dataKey="title"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  width={130}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="umsatz" fill="var(--color-umsatz)" radius={4} />
              </BarChart>
            </ChartContainer>
          ) : (
            <p className="py-16 text-center text-sm text-muted-foreground">
              {t("empty")}
            </p>
          )}
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        {t("chart.footnote", { total: geld(a.kennzahlen.umsatz) })}
      </p>
    </div>
  );
}
