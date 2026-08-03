"use client";

// 30-Tage-Preisvorschau pro Objekt im Hostaway-Stil: Wochenraster (Mo–So),
// pro Tag der empfohlene Preis oben rechts, Tageszahl unten links, „Heute“-
// Marker. Bei dynamischem Preis ein Blitz + „Warum dieser Preis?"-Tooltip.
// Read-only — manuelle Tagespreise setzt man im Kalender (gewinnen immer).
import { useLocale } from "next-intl";
import { useState } from "react";

import type { DayAvailability } from "@/lib/calendar";
import { Card } from "@nextdays/ui/card";
import { formatCurrency } from "@/lib/currency";
import { explainFactors } from "@/lib/dp-factors";
import { explainDpPrice } from "@/lib/dynamic-pricing";

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

// Preis in der OBJEKT-Währung (aus dem Rate-Plan) — kein €-Hardcode (27 EU-Länder).
// Centgenau wie Kalender/Channex: EINE Zahl überall — eine gerundete „119 €"
// neben „118,68 €" im Kalender las sich als Fehler in der Preisführung.
function fmt(value: number | null, currency: string | null, locale: string): string {
  if (value === null) return "—";
  return formatCurrency(value, currency, locale);
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

export function DpPreviewGrid({
  days,
  propertyId,
  currency,
}: {
  days: DayAvailability[];
  propertyId: string;
  currency: string | null;
}) {
  const locale = useLocale();
  // Geladene KI-Erklärung je Tag (ISO → Text | "…" beim Laden | Fehlertext).
  const [explained, setExplained] = useState<Record<string, string>>({});
  const [loadingDay, setLoadingDay] = useState<string | null>(null);

  async function loadExplanation(day: string) {
    if (explained[day] || loadingDay) return;
    setLoadingDay(day);
    const res = await explainDpPrice(propertyId, day);
    setExplained((prev) => ({
      ...prev,
      [day]: res.ok ? res.data.explanation : res.error,
    }));
    setLoadingDay(null);
  }

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
          const isOverride = d.price_source === "override";
          const why = explainFactors(d.price_factors);
          const aiText = explained[d.date];
          // Jede Zelle erklärt ihre Preisquelle — eine nackte 333 € neben
          // lauter Blitz-Preisen las sich als Fehler statt als manueller
          // Vorrang.
          const quelle = isDynamic
            ? why || "Dynamisch berechneter Tagespreis"
            : isOverride
              ? "Manuell gesetzter Tagespreis — hat immer Vorrang"
              : "Grund-/Wochentagspreis (kein dynamischer Preis für diesen Tag)";
          return (
            <div
              key={d.date}
              title={quelle}
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
                  {isOverride && (
                    <span
                      className="text-muted-foreground"
                      aria-label="manuell gesetzt"
                    >
                      ✎
                    </span>
                  )}
                  {fmt(d.price, currency, locale)}
                </span>
              </div>
              {/* KI-Erklärung: bei dynamischem Preis on-demand abrufbar */}
              {isDynamic && (
                <button
                  type="button"
                  onClick={() => loadExplanation(d.date)}
                  className="mt-1 self-end text-[0.65rem] text-accent hover:underline disabled:opacity-60"
                  disabled={loadingDay === d.date}
                >
                  {loadingDay === d.date
                    ? "lädt…"
                    : aiText
                      ? "KI-Erklärung ▾"
                      : "Warum? (KI)"}
                </button>
              )}
              {aiText && (
                <p className="mt-1 rounded-(--radius) bg-muted/60 p-1.5 text-[0.65rem] leading-snug text-muted-foreground">
                  {aiText}
                </p>
              )}
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
