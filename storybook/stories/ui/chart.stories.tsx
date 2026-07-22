import type { Meta, StoryObj } from "@storybook/react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis } from "recharts";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

// Monatlicher Umsatz je Buchungskanal (glatte Beträge, keine Cent).
const umsatzDaten = [
  { monat: "Januar", portal: 5200, booking: 3100, airbnb: 1800 },
  { monat: "Februar", portal: 4800, booking: 2900, airbnb: 1600 },
  { monat: "März", portal: 6100, booking: 3600, airbnb: 2400 },
  { monat: "April", portal: 7400, booking: 4200, airbnb: 2900 },
  { monat: "Mai", portal: 9200, booking: 5800, airbnb: 3500 },
  { monat: "Juni", portal: 12500, booking: 7300, airbnb: 4100 },
];

// Kanal-Konfiguration: Plattform führt, Farben aus den Chart-Tokens.
const umsatzConfig = {
  portal: { label: "Plattform", color: "var(--chart-1)" },
  booking: { label: "Booking.com", color: "var(--chart-3)" },
  airbnb: { label: "Airbnb", color: "var(--chart-5)" },
} satisfies ChartConfig;

// Belegungsquote in Prozent, Vorjahresvergleich.
const belegungDaten = [
  { monat: "Januar", quote2025: 42, quote2026: 51 },
  { monat: "Februar", quote2025: 45, quote2026: 54 },
  { monat: "März", quote2025: 52, quote2026: 63 },
  { monat: "April", quote2025: 58, quote2026: 70 },
  { monat: "Mai", quote2025: 66, quote2026: 76 },
  { monat: "Juni", quote2025: 78, quote2026: 88 },
];

const belegungConfig = {
  quote2026: { label: "Belegung 2026 (%)", color: "var(--chart-1)" },
  quote2025: { label: "Belegung 2025 (%)", color: "var(--chart-4)" },
} satisfies ChartConfig;

const meta = {
  title: "UI-Bausteine/Chart",
  component: ChartContainer,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Diagramm-Wrapper um recharts: ChartContainer verdrahtet eine ChartConfig " +
          "(Beschriftungen + Farben aus den Chart-Tokens --chart-1 … --chart-5) mit " +
          "Tooltip und Legende. Beträge sind fachlich immer glatt (keine Cent).",
      },
    },
  },
  // Pflicht-Props für die Typisierung; die Stories rendern eigene Diagramme.
  args: { config: umsatzConfig, children: <BarChart data={[]} /> },
} satisfies Meta<typeof ChartContainer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Balken: monatlicher Umsatz je Buchungskanal, gruppiert. */
export const BalkenUmsatz: Story = {
  render: () => (
    <ChartContainer config={umsatzConfig} className="min-h-52 w-full max-w-2xl">
      <BarChart accessibilityLayer data={umsatzDaten}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="monat"
          tickLine={false}
          tickMargin={10}
          axisLine={false}
          tickFormatter={(wert: string) => wert.slice(0, 3)}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="portal" fill="var(--color-portal)" radius={4} />
        <Bar dataKey="booking" fill="var(--color-booking)" radius={4} />
        <Bar dataKey="airbnb" fill="var(--color-airbnb)" radius={4} />
      </BarChart>
    </ChartContainer>
  ),
};

/** Gestapelte Balken: Kanal-Mix pro Monat als Gesamtsäule. */
export const BalkenGestapelt: Story = {
  render: () => (
    <ChartContainer config={umsatzConfig} className="min-h-52 w-full max-w-2xl">
      <BarChart accessibilityLayer data={umsatzDaten}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="monat"
          tickLine={false}
          tickMargin={10}
          axisLine={false}
          tickFormatter={(wert: string) => wert.slice(0, 3)}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="portal" stackId="umsatz" fill="var(--color-portal)" />
        <Bar dataKey="booking" stackId="umsatz" fill="var(--color-booking)" />
        <Bar
          dataKey="airbnb"
          stackId="umsatz"
          fill="var(--color-airbnb)"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ChartContainer>
  ),
};

/** Linie: Belegungsquote im Vorjahresvergleich (2025 vs. 2026). */
export const LinieBelegung: Story = {
  render: () => (
    <ChartContainer
      config={belegungConfig}
      className="min-h-52 w-full max-w-2xl"
    >
      <LineChart
        accessibilityLayer
        data={belegungDaten}
        margin={{ left: 12, right: 12 }}
      >
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="monat"
          tickLine={false}
          tickMargin={10}
          axisLine={false}
          tickFormatter={(wert: string) => wert.slice(0, 3)}
        />
        <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Line
          dataKey="quote2026"
          type="monotone"
          stroke="var(--color-quote2026)"
          strokeWidth={2}
          dot={false}
        />
        <Line
          dataKey="quote2025"
          type="monotone"
          stroke="var(--color-quote2025)"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ChartContainer>
  ),
};
