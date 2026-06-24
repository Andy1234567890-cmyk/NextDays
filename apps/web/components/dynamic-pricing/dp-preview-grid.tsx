"use client";

// 30-Tage-Preisvorschau pro Objekt im Hostaway-Stil: Wochenraster (Mo–So),
// pro Tag der empfohlene Preis oben rechts, Tageszahl unten links, „Heute“-
// Marker. Bei dynamischem Preis ein Blitz + „Warum dieser Preis?"-Tooltip.
// Read-only — manuelle Tagespreise setzt man im Kalender (gewinnen immer).
import type { DayAvailability } from "@/lib/calendar";
import { Card } from "@/components/ui/card";

const FACTOR_LABELS: Record<string, string> = {
  season: "Saison",
  event: "Event",
  weekend: "Wochenende",
  occupancy: "Auslastung",
  last_minute: "Last-Minute",
  orphan: "Lückenfüllung",
  market: "Markt",
};

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function explainFactors(factors: Record<string, number> | null | undefined): string {
  if (!factors) return "";
  const lines: string[] = [];
  for (const [key, mult] of Object.entries(factors)) {
    if (mult == null || Math.abs(mult - 1) < 0.001) continue;
    const pct = Math.round((mult - 1) * 100);
    lines.push(`${FACTOR_LABELS[key] ?? key} ${pct >= 0 ? "+" : ""}${pct} %`);
  }
  return lines.length ? `Warum dieser Preis?\n${lines.join("\n")}` : "";
}

function fmt(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

// Mo=0 … So=6 (JS getDay: So=0).
function mondayIndex(iso: string): number {
  return (new Date(iso + "T00:00:00").getDay() + 6) % 7;
}

function todayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export function DpPreviewGrid({ days }: { days: DayAvailability[] }) {
  if (days.length === 0) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        Keine Preise im Vorschauzeitraum.
      </Card>
    );
  }
  const today = todayIso();
  // Führende Leerzellen, damit der erste Tag unter seinem Wochentag steht.
  const lead = mondayIndex(days[0].date);
  const cells: (DayAvailability | null)[] = [
    ...Array(lead).fill(null),
    ...days,
  ];
  // Auf volle Wochen auffüllen.
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <Card className="overflow-hidden p-0">
      <div className="grid grid-cols-7 border-b">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          if (!d) {
            return (
              <div
                key={`empty-${i}`}
                className="min-h-24 border-b border-r bg-muted/20"
              />
            );
          }
          const dayNum = Number(d.date.slice(8, 10));
          const isToday = d.date === today;
          const isDynamic = d.price_source === "dynamic";
          const why = explainFactors(d.price_factors);
          return (
            <div
              key={d.date}
              title={why || undefined}
              className="relative flex min-h-24 flex-col justify-between border-b border-r p-2"
            >
              {/* Preis oben rechts (wie Hostaway) */}
              <div className="flex justify-end">
                <span
                  className={`flex items-center gap-1 text-sm ${
                    d.price === null
                      ? "text-muted-foreground"
                      : "font-semibold"
                  }`}
                >
                  {isDynamic && (
                    <span className="text-accent" aria-label="dynamisch">
                      ⚡
                    </span>
                  )}
                  {fmt(d.price)}
                </span>
              </div>
              {/* Tageszahl unten links, Heute hervorgehoben */}
              <span
                className={
                  isToday
                    ? "flex size-7 items-center justify-center self-start rounded-full bg-accent text-sm font-semibold text-accent-foreground"
                    : "self-start text-sm text-muted-foreground"
                }
              >
                {dayNum}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
