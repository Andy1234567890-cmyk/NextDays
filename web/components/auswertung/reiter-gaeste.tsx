"use client";

// Reiter „Gäste" — der Teil, den kein Wettbewerber so führt.
//
// Hostaway, Guesty, Lodgify und Smoobu berichten über Objekte, Umsatz und
// Kanäle; über die Gäste selbst berichtet keiner. Dabei ist „woher kommen
// meine Gäste und kommen sie wieder" die Frage, aus der Marketing-
// Entscheidungen folgen.
import { useTranslations } from "next-intl";

import { Card } from "@nextdays/ui/card";
import { countryName } from "@nextdays/ui/countries";
import type { Auswertung } from "@/lib/auswertung-typen";

import { VergleichDelta, VergleichHinweis, deltaStand } from "./vergleich-delta";

export function ReiterGaeste({ a }: { a: Auswertung }) {
  const t = useTranslations("analysis");
  const g = a.gaeste;

  const v = a.vorher?.gaeste;

  // Leer nur, wenn BEIDE Zeiträume nichts hergeben.
  if (!g.herkunft.length && !a.vorher?.gaeste.herkunft.length) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        {t("empty")}
      </Card>
    );
  }

  const zahl = (wert: number | null, suffix = "") =>
    wert === null ? "—" : `${wert}${suffix}`;

  /** Vergleichszeile einer Gäste-Kachel. Alle Größen hier sind Zählwerte oder
   *  Quoten — währungsunabhängig, deshalb ohne Währungsprüfung. */
  const delta = (jetzt: number | null, vorwert: number | null, suffix = "") =>
    a.vorher ? (
      <VergleichDelta
        stand={deltaStand(jetzt, vorwert)}
        vorherAnzeige={zahl(vorwert, suffix)}
      />
    ) : null;

  return (
    <div className="flex flex-col gap-4">
      {a.vorher && (
        <VergleichHinweis
          vergleich={a.vorher.vergleich}
          von={a.vorher.von}
          bis={a.vorher.bis}
        />
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="flex flex-col gap-1 p-4">
          <span className="text-xs font-medium text-muted-foreground">
            {t("guests.total")}
          </span>
          <span className="font-display text-xl font-extrabold tabular-nums">
            {g.gaeste_gesamt.toLocaleString()}
          </span>
          {delta(g.gaeste_gesamt, v?.gaeste_gesamt ?? null)}
        </Card>
        <Card className="flex flex-col gap-1 p-4">
          <span className="text-xs font-medium text-muted-foreground">
            {t("guests.returning")}
          </span>
          <span className="font-display text-xl font-extrabold tabular-nums">
            {/* Ohne zuordenbare Person gibt es keine Quote — dann der Strich
                und nicht „0 %". Eine 0 behauptet „keine Stammgäste", während
                die Wahrheit „nicht erkennbar" lautet (Wurzel 4). */}
            {g.personen_zuordenbar === 0 ? "—" : zahl(g.wiederkehrer_pct, " %")}
          </span>
          {/* Nur vergleichen, wo BEIDE Zeiträume überhaupt zuordenbare
              Personen hatten: sonst verglichen wir „nicht erkennbar" mit einer
              Quote und bekämen eine Veränderung, die es nicht gibt. */}
          {g.personen_zuordenbar > 0 && (v?.personen_zuordenbar ?? 0) > 0
            ? delta(g.wiederkehrer_pct, v?.wiederkehrer_pct ?? null, " %")
            : null}
          <span className="text-xs text-muted-foreground">
            {g.personen_zuordenbar === 0
              ? t("guests.notIdentifiable")
              : t("guests.returningOf", {
                  count: g.wiederkehrer,
                  base: g.personen_zuordenbar,
                })}
          </span>
        </Card>
        <Card className="flex flex-col gap-1 p-4">
          <span className="text-xs font-medium text-muted-foreground">
            {t("guests.avgStay")}
          </span>
          <span className="font-display text-xl font-extrabold tabular-nums">
            {zahl(g.aufenthalt_schnitt)}
          </span>
          {delta(g.aufenthalt_schnitt, v?.aufenthalt_schnitt ?? null)}
        </Card>
        <Card className="flex flex-col gap-1 p-4">
          <span className="text-xs font-medium text-muted-foreground">
            {t("guests.perBooking")}
          </span>
          <span className="font-display text-xl font-extrabold tabular-nums">
            {zahl(g.gaeste_je_buchung)}
          </span>
          {delta(g.gaeste_je_buchung, v?.gaeste_je_buchung ?? null)}
        </Card>
      </div>

      <Card className="overflow-hidden">
        <h3 className="border-b border-border px-4 py-3 font-display text-base font-extrabold">
          {t("guests.origin")}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">{t("col.country")}</th>
                <th className="px-4 py-3 text-right font-medium">
                  {t("col.bookingsShort")}
                </th>
                <th className="px-4 py-3 text-right font-medium">
                  {t("col.nights")}
                </th>
                <th className="px-4 py-3 text-right font-medium">
                  {t("guests.total")}
                </th>
                <th className="px-4 py-3 text-right font-medium">
                  {t("col.share")}
                </th>
              </tr>
            </thead>
            <tbody>
              {g.herkunft.map((h) => (
                <tr
                  key={h.land ?? "unbekannt"}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-4 py-3">
                    {/* Ein unbekanntes Land ist eine eigene Zeile, keine stille
                        Lücke: sonst summierten sich die Anteile nicht auf 100
                        und niemand wüsste, wo der Rest blieb. */}
                    {h.land ? countryName(h.land) : t("guests.unknownCountry")}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {h.buchungen}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {h.naechte}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {h.gaeste}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {h.anteil_pct} %
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
