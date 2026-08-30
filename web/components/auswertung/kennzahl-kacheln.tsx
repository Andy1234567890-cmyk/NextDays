"use client";

// Die Kachelreihe oben — Hostaways „Metrics".
//
// REGEL FÜR JEDE KACHEL: `null` heißt „keine Grundlage" und wird als „—"
// gezeigt, NIE als 0. „Auslastung 0 %" behauptet, nichts sei verkauft worden;
// „—" sagt, dass kein Kalender gepflegt ist. Zwei verschiedene Sachverhalte,
// und der erste ist eine Falschaussage (Wurzel 4).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";

import { Card } from "@nextdays/ui/card";
import { formatCurrency } from "@/lib/currency";
import type { Kennzahlen } from "@/lib/auswertung-typen";

function Kachel({
  label,
  wert,
  hinweis,
  icon,
}: {
  label: string;
  wert: string;
  hinweis?: string;
  icon: string;
}) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon icon={icon} className="size-3.5" />
        {label}
      </span>
      <span className="font-display text-xl font-extrabold tabular-nums">
        {wert}
      </span>
      {hinweis && (
        <span className="text-xs text-muted-foreground">{hinweis}</span>
      )}
    </Card>
  );
}

export function KennzahlKacheln({
  k,
  waehrungen,
}: {
  k: Kennzahlen;
  waehrungen: string[];
}) {
  const t = useTranslations("analysis");

  /** Zahl oder Gedankenstrich — nie eine erfundene 0. */
  const z = (v: number | null, suffix = "") =>
    v === null ? "—" : `${v.toLocaleString()}${suffix}`;
  /** Geld nur mit eindeutiger Währung; sonst der Strich (Wurzel 4). */
  const geld = (v: number | null) =>
    v === null || !k.currency ? "—" : formatCurrency(v, k.currency);

  return (
    <div className="flex flex-col gap-3">
      {waehrungen.length > 1 && (
        // Mehrere Währungen: das Backend addiert bewusst nicht. Ohne diesen
        // Hinweis stünde überall „—" und niemand wüsste, warum.
        <Card className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
          <Icon icon="ph:warning" className="size-4 shrink-0" />
          {t("mixedCurrency", { list: waehrungen.join(", ") })}
        </Card>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <Kachel
          icon="ph:currency-circle-dollar"
          label={t("kpi.revenue")}
          wert={geld(k.umsatz)}
          hinweis={t("kpi.bookingsCount", { count: k.buchungen })}
        />
        <Kachel
          icon="ph:calendar-check"
          label={t("kpi.occupancy")}
          wert={z(k.auslastung_pct, " %")}
          hinweis={t("kpi.ofBookable", { count: k.naechte_buchbar })}
        />
        <Kachel
          icon="ph:moon"
          label={t("kpi.nights")}
          wert={k.naechte.toLocaleString()}
          hinweis={
            k.aufenthalt_schnitt === null
              ? undefined
              : t("kpi.avgStay", { n: k.aufenthalt_schnitt })
          }
        />
        <Kachel
          icon="ph:tag"
          label={t("kpi.adr")}
          wert={geld(k.adr)}
          hinweis={t("kpi.adrHint")}
        />
        <Kachel
          icon="ph:trend-up"
          label={t("kpi.revpar")}
          wert={geld(k.revpar)}
          hinweis={t("kpi.revparHint")}
        />
        <Kachel
          icon="ph:x-circle"
          label={t("kpi.cancellations")}
          wert={z(k.stornoquote_pct, " %")}
          hinweis={t("kpi.cancelHint", { count: k.stornos })}
        />
      </div>
    </div>
  );
}
