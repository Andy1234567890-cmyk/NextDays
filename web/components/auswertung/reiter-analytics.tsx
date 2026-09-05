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

export type AnalyticsOptionen = {
  /** Hostaways „Gruppieren nach": keine, Kanäle, Objekte. */
  gruppe: "keine" | "kanal" | "objekt";
  /** Hostaways Diagrammtyp für den Verlauf. */
  diagramm: "linie" | "balken";
  /** Welche Kennzahl der Verlauf zeigt. */
  kennzahl: "umsatz" | "naechte" | "buchungen";
};

export const ANALYTICS_VORGABE: AnalyticsOptionen = {
  gruppe: "keine",
  diagramm: "linie",
  kennzahl: "umsatz",
};

// Höchstens so viele Gruppen im Verlauf — mehr Linien sind nicht lesbar; die
// übrigen Objekte laufen unter „weitere".
const MAX_GRUPPEN = 6;

export function ReiterAnalytics({
  a,
  optionen = ANALYTICS_VORGABE,
  setOptionen,
}: {
  a: Auswertung;
  optionen?: AnalyticsOptionen;
  setOptionen?: (o: AnalyticsOptionen) => void;
}) {
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

  // GRUPPIERTER VERLAUF (Hostaway „Gruppieren nach Kanälen / Einträgen"):
  // je Gruppe eine Reihe aus `verlauf_je_kanal` bzw. `verlauf_je_objekt`.
  // Die Gruppenreihen kommen aus demselben Rechenweg wie die Gesamtreihe
  // und summieren sich exakt zu ihr. Bei Objekten werden die sechs größten
  // gezeigt, der Rest als „weitere" — zwölf Linien liest niemand.
  const kennzahl = optionen.kennzahl;
  const gruppen: { key: string; name: string; farbe: string; reihe: typeof a.verlauf }[] = (() => {
    if (optionen.gruppe === "keine") return [];
    if (optionen.gruppe === "kanal") {
      return Object.entries(a.verlauf_je_kanal).map(([ch, reihe]) => ({
        key: ch,
        name: channelLabel(ch as AvailabilitySource),
        farbe: channelChartColor(ch as AvailabilitySource),
        reihe,
      }));
    }
    const nachUmsatz = [...a.objekte].sort((x, y) => y.umsatz - x.umsatz);
    const top = nachUmsatz.slice(0, MAX_GRUPPEN);
    const rest = nachUmsatz.slice(MAX_GRUPPEN);
    const zeilen = top.map((o, i) => ({
      key: o.property_id,
      name: o.title,
      farbe: FARBEN[i % FARBEN.length],
      reihe: a.verlauf_je_objekt[o.property_id] ?? [],
    }));
    if (rest.length) {
      const summe = new Map<string, { umsatz: number; naechte: number; buchungen: number }>();
      for (const o of rest) {
        for (const p of a.verlauf_je_objekt[o.property_id] ?? []) {
          const e = summe.get(p.period) ?? { umsatz: 0, naechte: 0, buchungen: 0 };
          e.umsatz += p.umsatz;
          e.naechte += p.naechte;
          e.buchungen += p.buchungen;
          summe.set(p.period, e);
        }
      }
      zeilen.push({
        key: "__rest",
        name: t("chart.otherProperties", { count: rest.length }),
        farbe: "var(--muted-foreground)",
        reihe: [...summe.entries()]
          .sort(([x], [y]) => x.localeCompare(y))
          .map(([period, e]) => ({ period, ...e })),
      });
    }
    return zeilen;
  })();
  const gruppenDaten: Record<string, string | number | null>[] = (() => {
    if (!gruppen.length) return [];
    const perioden = a.verlauf.map((p) => p.period);
    return perioden.map((period) => {
      const zeile: Record<string, string | number | null> = { period };
      for (const g of gruppen) {
        const p = g.reihe.find((x) => x.period === period);
        zeile[g.key] = p ? p[kennzahl] : 0;
      }
      return zeile;
    });
  })();
  const gruppenConfig: ChartConfig = Object.fromEntries(
    gruppen.map((g) => [g.key, { label: g.name, color: g.farbe }]),
  );
  const kennzahlLabel = t(
    kennzahl === "umsatz" ? "kpi.revenue" : kennzahl === "naechte" ? "kpi.nights" : "col.bookingsShort",
  );

  const steuerung = setOptionen ? (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <Umschalter
        label={t("chart.metric")}
        wert={optionen.kennzahl}
        werte={["umsatz", "naechte", "buchungen"] as const}
        text={(v) => t(`chart.metricValues.${v}`)}
        setzen={(v) => setOptionen({ ...optionen, kennzahl: v })}
      />
      <Umschalter
        label={t("chart.groupBy")}
        wert={optionen.gruppe}
        werte={["keine", "kanal", "objekt"] as const}
        text={(v) => t(`chart.groupValues.${v}`)}
        setzen={(v) => setOptionen({ ...optionen, gruppe: v })}
      />
      <Umschalter
        label={t("chart.type")}
        wert={optionen.diagramm}
        werte={["linie", "balken"] as const}
        text={(v) => t(`chart.typeValues.${v}`)}
        setzen={(v) => setOptionen({ ...optionen, diagramm: v })}
      />
    </div>
  ) : null;

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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-base font-extrabold">
            {optionen.gruppe === "keine" && kennzahl === "umsatz"
              ? t("chart.revenueOverTime")
              : t("chart.overTime", { metric: kennzahlLabel })}
          </h3>
          {steuerung}
        </div>
        {a.vorher && !waehrungGleich && optionen.gruppe === "keine" && kennzahl === "umsatz" && (
          // Der Vergleich ist angefordert, aber nicht darstellbar. Das
          // stillschweigend wegzulassen sähe aus wie „kein Vorjahr vorhanden".
          <p className="text-xs text-muted-foreground">
            {t("compareChartCurrencyMismatch")}
          </p>
        )}
        {gruppen.length ? (
          <ChartContainer config={gruppenConfig} className="h-64 w-full">
            {optionen.diagramm === "balken" ? (
              <BarChart data={gruppenDaten}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="period" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} width={70} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                {gruppen.map((g) => (
                  <Bar key={g.key} dataKey={g.key} stackId="g" fill={`var(--color-${g.key})`} radius={2} />
                ))}
              </BarChart>
            ) : (
              <LineChart data={gruppenDaten}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="period" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} width={70} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                {gruppen.map((g) => (
                  <Line
                    key={g.key}
                    type="monotone"
                    dataKey={g.key}
                    stroke={`var(--color-${g.key})`}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            )}
          </ChartContainer>
        ) : optionen.diagramm === "balken" || kennzahl !== "umsatz" ? (
          <ChartContainer
            config={{ [kennzahl]: { label: kennzahlLabel, color: FARBEN[0] } }}
            className="h-64 w-full"
          >
            {optionen.diagramm === "balken" ? (
              <BarChart data={a.verlauf}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="period" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} width={70} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey={kennzahl} fill={`var(--color-${kennzahl})`} radius={3} />
              </BarChart>
            ) : (
              <LineChart data={a.verlauf}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="period" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} width={70} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey={kennzahl} stroke={`var(--color-${kennzahl})`} strokeWidth={2} dot={false} />
              </LineChart>
            )}
          </ChartContainer>
        ) : nurUnvergleichbaresVorjahr ? (
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

function Umschalter<T extends string>({
  label,
  wert,
  werte,
  text,
  setzen,
}: {
  label: string;
  wert: T;
  werte: readonly T[];
  text: (v: T) => string;
  setzen: (v: T) => void;
}) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="inline-flex rounded-md border border-border p-0.5">
        {werte.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setzen(v)}
            className={
              "rounded px-2 py-0.5 transition-colors " +
              (wert === v ? "bg-foreground text-background" : "hover:bg-muted")
            }
          >
            {text(v)}
          </button>
        ))}
      </span>
    </label>
  );
}
