"use client";

// Forecast & Pace (SiteMinder „Forecasting"): belegt gegen gelernte Erwartung
// der nächsten 90 Tage, dazu die Angebotsdichte der Umgebung.
//
// Die Erwartung kommt aus DEMSELBEN Pickup-Modell, das die Engine für den
// Faktor „Buchungstempo" nutzt (dp_pickup_snapshots). Ohne gelernte Kurve
// steht das hier — kein erfundener Prozentwert (Wurzel 4).
import { useEffect, useState } from "react";

import { Card } from "@nextdays/ui/card";
import { getForecast, type Forecast } from "@/lib/dynamic-pricing";

const PACE_TEXT: Record<NonNullable<Forecast["pace"]>, { text: string; cls: string }> = {
  vor: { text: "vor Plan", cls: "text-emerald-700 dark:text-emerald-300" },
  im_plan: { text: "im Plan", cls: "text-muted-foreground" },
  hinter: { text: "hinter Plan", cls: "text-amber-700 dark:text-amber-300" },
};

export function DpForecastKarte({ propertyId }: { propertyId: string }) {
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

  // 90 Tage als Wochenbalken: 13 Spalten, je Woche der Anteil belegter Tage
  // (Balken) und die Erwartung (Strich). Ein Tag pro Pixel wäre unlesbar.
  const wochen: { belegt: number; erwartet: number | null; markt: number | null }[] = [];
  for (let i = 0; i < f.tage.length; i += 7) {
    const stueck = f.tage.slice(i, i + 7);
    const e = stueck.filter((t) => t.erwartet !== null);
    const m = stueck.filter((t) => t.markt_angebote !== null);
    wochen.push({
      belegt: stueck.filter((t) => t.belegt).length / stueck.length,
      erwartet: e.length ? e.reduce((s, t) => s + (t.erwartet ?? 0), 0) / e.length : null,
      markt: m.length
        ? Math.round(m.reduce((s, t) => s + (t.markt_angebote ?? 0), 0) / m.length)
        : null,
    });
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">
            Nächste {f.horizont_tage} Tage
          </p>
          <p className="text-2xl font-semibold">
            {f.belegt_pct.toFixed(0)} % belegt
            {f.erwartet_pct !== null && (
              <span className="ml-2 text-base font-normal text-muted-foreground">
                · erwartet {f.erwartet_pct.toFixed(0)} %
              </span>
            )}
          </p>
        </div>
        {f.pace && (
          <p className={`text-sm font-medium ${PACE_TEXT[f.pace].cls}`}>
            Buchungstempo {PACE_TEXT[f.pace].text}
          </p>
        )}
      </div>

      {/* Wochenbalken: Belegung als Balken, Erwartung als Marke darüber. */}
      {/* Je Woche eine Spalte voller Hoehe: der Balken (belegt) waechst von
          unten, die Marke (erwartet) sitzt auf ihrer eigenen Hoehe — beide
          relativ zur SPALTE, nicht zueinander. Vorher hing die Marke am
          Balken und rutschte bei leeren Wochen in den Text darunter. */}
      <div className="flex h-16 items-stretch gap-1" aria-label="Belegung je Woche">
        {wochen.map((w, i) => (
          <div
            key={i}
            className="relative flex-1 overflow-hidden rounded-t bg-muted/40"
            title={`Woche ${i + 1}: ${(w.belegt * 100).toFixed(0)} % belegt${
              w.erwartet !== null ? ` · erwartet ${(w.erwartet * 100).toFixed(0)} %` : ""
            }${w.markt !== null ? ` · ${w.markt} freie Angebote im Umkreis` : ""}`}
          >
            <div
              className="absolute inset-x-0 bottom-0 rounded-t bg-accent/70"
              style={{ height: `${Math.max(2, w.belegt * 100)}%` }}
            />
            {w.erwartet !== null && (
              <span
                className="absolute inset-x-0 h-0.5 bg-foreground/80"
                style={{ bottom: `${Math.min(99, w.erwartet * 100)}%` }}
                aria-hidden
              />
            )}
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        {f.hinweis ??
          "Balken = belegt, Strich = gelernte Erwartung bei diesem Vorlauf. Im Tooltip die freien Angebote der Umgebung."}
      </p>
    </Card>
  );
}
