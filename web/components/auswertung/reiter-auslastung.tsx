"use client";

// Reiter „Auslastung" — Hostaways `Occupancy Report`, eigener Nenner.
//
// DER NENNER (Entscheidung des Betreibers, 30.08.2026): jeder Tag des
// Zeitraums ist entweder frei oder belegt. Belegt ist belegt — ob über ein
// Portal, die eigene Website, selbst angelegt oder durch den Eigentümer.
//
// Aus dem Nenner fallen nur Tage, an denen das Objekt NICHT im Verkauf war,
// und die stehen deshalb als eigene Spalten daneben statt still abgezogen zu
// werden: „Gesperrt" (`availability.status='blocked'`, live ausschließlich
// gekündigte Objekte) und „Stop-Sell" (eigene Tabelle, bewusste
// Verkaufssperre). Ohne diese beiden Spalten erklärte sich eine hohe Quote
// bei leerem Haus nicht.
//
// Hostaway rechnet gegen ALLE Tage und kennt weder Stop-Sell noch die
// Trennung — dort drückt jede Sperre die Kennzahl.
import { useTranslations } from "next-intl";

import { Card } from "@nextdays/ui/card";
import { formatCurrency } from "@/lib/currency";
import type { Auswertung } from "@/lib/auswertung-typen";

export function ReiterAuslastung({ a }: { a: Auswertung }) {
  const t = useTranslations("analysis");

  if (!a.objekte.length) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        {t("empty")}
      </Card>
    );
  }

  const geld = (v: number | null) =>
    v === null || !a.currency ? "—" : formatCurrency(v, a.currency);
  const pct = (v: number | null) => (v === null ? "—" : `${v} %`);

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">{t("col.property")}</th>
              <th className="px-4 py-3 text-right font-medium whitespace-nowrap">
                {t("col.bookable")}
              </th>
              <th className="px-4 py-3 text-right font-medium whitespace-nowrap">
                {t("col.booked")}
              </th>
              <th className="px-4 py-3 text-right font-medium whitespace-nowrap">
                {t("col.blocked")}
              </th>
              <th className="px-4 py-3 text-right font-medium whitespace-nowrap">
                {t("col.stopSell")}
              </th>
              <th className="px-4 py-3 text-right font-medium whitespace-nowrap">
                {t("kpi.occupancy")}
              </th>
              <th className="px-4 py-3 text-right font-medium whitespace-nowrap">
                {t("col.arrivals")}
              </th>
              <th className="px-4 py-3 text-right font-medium whitespace-nowrap">
                {t("kpi.revenue")}
              </th>
              <th className="px-4 py-3 text-right font-medium">
                {t("kpi.adr")}
              </th>
              <th className="px-4 py-3 text-right font-medium">
                {t("kpi.revpar")}
              </th>
              <th className="px-4 py-3 text-right font-medium whitespace-nowrap">
                {t("col.cancellations")}
              </th>
            </tr>
          </thead>
          <tbody>
            {a.objekte.map((o) => (
              <tr
                key={o.property_id}
                className="border-b border-border last:border-0"
              >
                <td className="px-4 py-3">{o.title}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {o.naechte_buchbar}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {o.naechte_gebucht}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                  {o.naechte_gesperrt}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                  {o.naechte_stop_sell}
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">
                  {pct(o.auslastung_pct)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {o.anreisen}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {geld(o.umsatz)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {geld(o.adr)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {geld(o.revpar)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                  {o.stornos}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Der Nenner gehört unter die Tabelle, nicht in einen Hilfe-Artikel:
          zwei Systeme mit verschiedenen Nennern zeigen für denselben Monat
          verschiedene Prozente, und niemand fände den Grund. */}
      <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
        {t("occupancyFootnote")}
      </p>
    </Card>
  );
}
