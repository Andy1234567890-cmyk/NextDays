"use client";

// Reiter „Kennzahlen" — das übernommene Kontrollzentrum.
//
// HERKUNFT: Bis zum 30.08.2026 lag das als eigene Seite unter
// `/reservierungen/kontrollzentrum`. Es ist hierher gezogen, weil es dasselbe
// beantwortet wie die übrigen Reiter — nur mit anderen Kennzahlen. Zwei Orte
// für „wie läuft mein Betrieb" hießen zwei Zeiträume, zwei Objektfilter und
// zwei Antworten auf dieselbe Frage.
//
// WAS ES KANN, WAS DIE ANDEREN REITER NICHT KÖNNEN:
// Sparklines je Kachel, Vergleich zur Vorperiode (`change_pct`) und eine
// Detailseite je Kennzahl mit Zeitreihe. Deshalb ist es übernommen und nicht
// ersetzt worden.
//
// EIGENE DATENQUELLE: `getTenantStats` (Slice `reservations`), nicht der
// `auswertung`-Endpunkt. Die Filter der Seite werden durchgereicht, damit
// beide dasselbe meinen — Zeitraum und Objektauswahl kommen aus der
// Filterleiste oben, nicht aus einem zweiten Wähler.
//
// ACHTUNG, BEKANNTE ABWEICHUNG: `occupancy_rate` rechnet in diesem Slice gegen
// `Spanne × Objektzahl` und kennt weder gesperrte Tage noch Stop-Sell — der
// Reiter „Auslastung" rechnet anders (und richtig). Die Kachel „Auslastung"
// ist hier deshalb ausgeblendet, statt zwei verschiedene Prozente auf einer
// Seite zu zeigen. Sie steht im eigenen Reiter.
import { useCallback, useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

// Der Erklärtext zieht mit um: er beschreibt genau diese Kacheln
// (Prozentwerte, aufgeklappte Diagramme, Live-Aktualisierung).
import { ControlCenterLearn } from "@/components/reservierungen/learn-dialog";
import { ChannelDonuts, StatsKpiGrid } from "@/components/reservierungen/stats-cards";
import { Card } from "@nextdays/ui/card";
import { formatCurrency } from "@/lib/currency";
import {
  type PropertyStats,
  type StatMetric,
  type StatPoint,
  getTenantStats,
} from "@/lib/reservations";
import { jahreZurueck } from "@/lib/auswertung-vergleich";
import type { FilterStand } from "./filterleiste";
import { VergleichHinweis } from "./vergleich-delta";

/** Wie viele Jahre der gewählte Vergleich zurückgeht — 0 = Vorperiode.
 *
 *  Der Reiter liest aus dem reservations-Slice, der den Anker als ZAHL nimmt
 *  (`vergleich_jahre`), nicht als Enum. Die Übersetzung steht hier, damit die
 *  Filterleiste weiterhin nur ihre eigenen Werte kennt. */
const VERGLEICH_JAHRE: Record<string, number> = { "1j": 1, "2j": 2, "5j": 5 };

export function ReiterKennzahlen({ stand }: { stand: FilterStand }) {
  const t = useTranslations("analysis");
  const router = useRouter();
  const [stats, setStats] = useState<PropertyStats | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(true);

  useEffect(() => {
    let abgebrochen = false;
    setLaedt(true);
    void (async () => {
      const res = await getTenantStats(
        stand.von,
        stand.bis,
        stand.propertyIds,
        VERGLEICH_JAHRE[stand.vergleich] ?? 0,
      );
      if (abgebrochen) return;
      if (res.ok) {
        setStats(res.data);
        setFehler(null);
      } else {
        setFehler(res.error);
        // Alte Zahlen stehen lassen wäre schlimmer als nichts: sie gehörten
        // zu einem anderen Filter und niemand sähe den Unterschied.
        setStats(null);
      }
      setLaedt(false);
    })();
    return () => {
      abgebrochen = true;
    };
    // `stand.vergleich` gehört in die Abhängigkeiten: ohne ihn bliebe beim
    // Umschalten die alte Antwort stehen und die Kacheln zeigten weiter den
    // Vorperioden-Vergleich, während die Leiste „Vorjahr" behauptet.
  }, [stand.von, stand.bis, stand.propertyIds, stand.vergleich]);

  const geld = useCallback(
    (v: number) => (stats ? formatCurrency(v, stats.currency) : String(v)),
    [stats],
  );

  const reihe = useCallback(
    (metric: string): StatPoint[] =>
      stats?.series.find((s) => s.metric === metric)?.points ?? [],
    [stats],
  );

  const oeffnen = useCallback(
    (metric: StatMetric) => {
      const p = new URLSearchParams({ from: stand.von, to: stand.bis });
      for (const id of stand.propertyIds) p.append("property_id", id);
      router.push(`/auswertung/kennzahl/${metric}?${p.toString()}`);
    },
    [router, stand.von, stand.bis, stand.propertyIds],
  );

  if (laedt && !stats) {
    return (
      <Card className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
        <Icon icon="ph:spinner" className="size-4 animate-spin" />
        {t("loading")}
      </Card>
    );
  }

  if (fehler) {
    return (
      <Card className="flex items-center gap-2 p-4 text-sm text-destructive">
        <Icon icon="ph:warning-circle" className="size-4 shrink-0" />
        {fehler}
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        {t("empty")}
      </Card>
    );
  }

  return (
    <div className={laedt ? "flex flex-col gap-4 opacity-60" : "flex flex-col gap-4"}>
      <div className="flex items-center justify-between gap-3">
        {/* Welcher Anker gilt: ohne diese Zeile sähe „−40 %" beim
            Vorjahresvergleich genauso aus wie beim Vorperiodenvergleich, und
            niemand wüsste, worauf sich die Zahl bezieht. */}
        {stand.vergleich === "keiner" ? (
          <span className="text-xs text-muted-foreground">
            {t("compareBaselinePrevious")}
          </span>
        ) : (
          <VergleichHinweis
            vergleich={stand.vergleich}
            von={jahreZurueck(stand.von, VERGLEICH_JAHRE[stand.vergleich] ?? 0)}
            bis={jahreZurueck(stand.bis, VERGLEICH_JAHRE[stand.vergleich] ?? 0)}
          />
        )}
        <ControlCenterLearn />
      </div>
      <StatsKpiGrid
        stats={stats}
        money={geld}
        seriesFor={reihe}
        onOpen={oeffnen}
      />
      <ChannelDonuts stats={stats} money={geld} />
      <p className="text-xs text-muted-foreground">{t("kpiFootnote")}</p>
    </div>
  );
}
