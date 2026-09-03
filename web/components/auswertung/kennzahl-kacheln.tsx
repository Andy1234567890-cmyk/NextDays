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
import type { Kennzahlen, VergleichBericht } from "@/lib/auswertung-typen";

import { VergleichDelta, VergleichHinweis, deltaStand } from "./vergleich-delta";

function Kachel({
  label,
  wert,
  hinweis,
  icon,
  vergleich,
}: {
  label: string;
  wert: string;
  hinweis?: string;
  icon: string;
  /** Die Vergleichszeile, wenn ein Vorzeitraum geladen ist. */
  vergleich?: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      {/* `min-w-0` + `truncate`: sonst schiebt ein langes Label die Kachel
          auf schmalen Bildschirmen auseinander. */}
      <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon icon={icon} className="size-3.5 shrink-0" />
        <span className="truncate" title={label}>
          {label}
        </span>
      </span>
      <span className="font-display text-xl font-extrabold tabular-nums">
        {wert}
      </span>
      {vergleich}
      {hinweis && (
        <span className="text-xs text-muted-foreground">{hinweis}</span>
      )}
    </Card>
  );
}

export function KennzahlKacheln({
  k,
  waehrungen,
  vorher,
}: {
  k: Kennzahlen;
  waehrungen: string[];
  vorher?: VergleichBericht | null;
}) {
  const t = useTranslations("analysis");

  /** Zahl oder Gedankenstrich — nie eine erfundene 0. */
  const z = (v: number | null, suffix = "") =>
    v === null ? "—" : `${v.toLocaleString()}${suffix}`;
  /** Geld nur mit eindeutiger Währung; sonst der Strich (Wurzel 4). */
  const geld = (v: number | null) =>
    v === null || !k.currency ? "—" : formatCurrency(v, k.currency);

  // Betrags-Deltas nur bei GLEICHER Währung. Lag der Vorzeitraum in einer
  // anderen (Betrieb hat gewechselt, oder damals mehrere), wäre die
  // Veränderung ein Wechselkurs-Artefakt und keine Geschäftszahl.
  const geldVergleichbar =
    !!vorher && !!k.currency && vorher.currency === k.currency;

  /** Die Vergleichszeile einer BETRAGS-Kachel. */
  const geldDelta = (
    jetzt: number | null,
    vorwert: number | null,
    invertiert = false,
  ) =>
    vorher ? (
      <VergleichDelta
        stand={deltaStand(jetzt, vorwert, {
          waehrungGleich: geldVergleichbar,
          vorherWaehrung: vorher.currency,
        })}
        vorherAnzeige={
          vorwert === null || !vorher.currency
            ? "—"
            : formatCurrency(vorwert, vorher.currency)
        }
        invertiert={invertiert}
      />
    ) : undefined;

  /** Die Vergleichszeile einer ZÄHL-/PROZENT-Kachel (währungsunabhängig). */
  const zahlDelta = (
    jetzt: number | null,
    vorwert: number | null,
    suffix = "",
    invertiert = false,
  ) =>
    vorher ? (
      <VergleichDelta
        stand={deltaStand(jetzt, vorwert)}
        vorherAnzeige={z(vorwert, suffix)}
        invertiert={invertiert}
      />
    ) : undefined;

  const v = vorher?.kennzahlen;

  return (
    <div className="flex flex-col gap-3">
      {vorher && (
        <VergleichHinweis
          vergleich={vorher.vergleich}
          von={vorher.von}
          bis={vorher.bis}
        />
      )}
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
          vergleich={geldDelta(k.umsatz, v?.umsatz ?? null)}
          hinweis={t("kpi.bookingsCount", { count: k.buchungen })}
        />
        <Kachel
          icon="ph:calendar-check"
          label={t("kpi.occupancy")}
          wert={z(k.auslastung_pct, " %")}
          vergleich={zahlDelta(k.auslastung_pct, v?.auslastung_pct ?? null, " %")}
          hinweis={t("kpi.ofBookable", { count: k.naechte_buchbar })}
        />
        <Kachel
          icon="ph:moon"
          label={t("kpi.nights")}
          wert={k.naechte.toLocaleString()}
          vergleich={zahlDelta(k.naechte, v?.naechte ?? null)}
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
          vergleich={geldDelta(k.adr, v?.adr ?? null)}
          hinweis={t("kpi.adrHint")}
        />
        <Kachel
          icon="ph:trend-up"
          label={t("kpi.revpar")}
          wert={geld(k.revpar)}
          vergleich={geldDelta(k.revpar, v?.revpar ?? null)}
          hinweis={t("kpi.revparHint")}
        />
        <Kachel
          icon="ph:x-circle"
          label={t("kpi.cancellations")}
          wert={z(k.stornoquote_pct, " %")}
          vergleich={zahlDelta(
            k.stornoquote_pct,
            v?.stornoquote_pct ?? null,
            " %",
            // Eine STEIGENDE Stornoquote ist schlecht: hier ist mehr nicht
            // besser, deshalb dreht `invertiert` die Farbgebung um.
            true,
          )}
          hinweis={t("kpi.cancelHint", { count: k.stornos })}
        />
      </div>
    </div>
  );
}
