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
//
// SEIT 05.09.2026 wie Hostaway: Umschalter „je Monat" (eine Zeile je Objekt
// und Monat), Spalte „Eigennutzung" (Owner-stay nights) und eine Summenzeile.
import { useLocale, useTranslations } from "next-intl";

import { Card } from "@nextdays/ui/card";
import { Switch } from "@nextdays/ui/switch";
import { formatCurrency } from "@/lib/currency";
import type { Auswertung, ObjektMonatZeile, ObjektZeile } from "@/lib/auswertung-typen";
import { zeilenVereinen } from "@/lib/auswertung-vergleich";

import { VergleichDelta, VergleichHinweis, deltaStand } from "./vergleich-delta";

export type AuslastungOptionen = { jeMonat: boolean };

export function ReiterAuslastung({
  a,
  optionen,
  setOptionen,
}: {
  a: Auswertung;
  optionen: AuslastungOptionen;
  setOptionen: (o: AuslastungOptionen) => void;
}) {
  const t = useTranslations("analysis");
  const locale = useLocale();

  // Leer nur, wenn BEIDE Zeiträume nichts hergeben — sonst verschwände der
  // Vergleich genau dann, wenn er am meisten sagt.
  if (!a.objekte.length && !a.vorher?.objekte.length) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        {t("empty")}
      </Card>
    );
  }

  const geld = (v: number | null) =>
    v === null || !a.currency ? "—" : formatCurrency(v, a.currency);
  const pct = (v: number | null) => (v === null ? "—" : `${v} %`);
  const geldVorher = (v: number | null) =>
    v === null || !a.vorher?.currency
      ? "—"
      : formatCurrency(v, a.vorher.currency);
  const monatsname = (m: string) =>
    new Date(`${m}-01T00:00:00`).toLocaleDateString(locale, { month: "short", year: "numeric" });

  // Ein Objekt, das es NUR im Vorjahr gab (inzwischen archiviert), bleibt
  // sichtbar — sein Wegfall erklärt einen Umsatzrückgang.
  const zeilen = zeilenVereinen(
    a.objekte,
    a.vorher?.objekte,
    (o: ObjektZeile) => o.property_id,
  );
  // `!!a.currency` ist der entscheidende Teil: liegen in BEIDEN Zeiträumen
  // mehrere Währungen vor, ist `currency` beide Male `null` — und `null ===
  // null` wäre `true`. Ohne diese Prüfung liefe ein Delta aus zwei
  // Misch­summen durch, die beide keine gültige Zahl sind, und die Zeile
  // zeigte „— · +14,2 %": ein Prozentwert ohne Bezugswert (Wurzel 4).
  const geldVergleichbar =
    !!a.vorher && !!a.currency && a.vorher.currency === a.currency;

  // Summenzeile über die Gegenwart. Die Auslastung der Summe ist
  // gebucht / buchbar über alle Objekte — nicht der Mittelwert der Prozente.
  const alle = a.objekte;
  const sumBuchbar = alle.reduce((n, o) => n + o.naechte_buchbar, 0);
  const sumGebucht = alle.reduce((n, o) => n + o.naechte_gebucht, 0);
  const sumUmsatz = alle.reduce((n, o) => n + o.umsatz, 0);
  const sumNaechteVerkauft = alle.reduce(
    (n, o) => n + (o.adr && o.umsatz ? Math.round(o.umsatz / o.adr) : 0),
    0,
  );

  const kopf = (
    <tr>
      <th className="px-3 py-3 font-medium">{t("col.property")}</th>
      {optionen.jeMonat && (
        <th className="px-3 py-3 font-medium whitespace-nowrap">{t("col.month")}</th>
      )}
      {(
        [
          "bookable",
          "booked",
          "ownerNights",
          "blocked",
          "stopSell",
        ] as const
      ).map((k) => (
        <th key={k} className="px-3 py-3 text-right font-medium whitespace-nowrap">
          {t(`col.${k}`)}
        </th>
      ))}
      <th className="px-3 py-3 text-right font-medium whitespace-nowrap">{t("kpi.occupancy")}</th>
      <th className="px-3 py-3 text-right font-medium whitespace-nowrap">{t("col.arrivals")}</th>
      <th className="px-3 py-3 text-right font-medium whitespace-nowrap">{t("kpi.revenue")}</th>
      <th className="px-3 py-3 text-right font-medium">{t("kpi.adr")}</th>
      <th className="px-3 py-3 text-right font-medium">{t("kpi.revpar")}</th>
      <th className="px-3 py-3 text-right font-medium whitespace-nowrap">{t("col.cancellations")}</th>
    </tr>
  );

  const zahlenZellen = (o: ObjektZeile | ObjektMonatZeile, gedimmt: boolean) => (
    <>
      <td className="px-3 py-2.5 text-right tabular-nums">{gedimmt ? "—" : o.naechte_buchbar}</td>
      <td className="px-3 py-2.5 text-right tabular-nums">{gedimmt ? "—" : o.naechte_gebucht}</td>
      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
        {gedimmt ? "—" : o.naechte_eigennutzung || "—"}
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
        {gedimmt ? "—" : o.naechte_gesperrt}
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
        {gedimmt ? "—" : o.naechte_stop_sell}
      </td>
    </>
  );

  return (
    <div className="flex flex-col gap-3">
      {a.vorher && (
        <VergleichHinweis
          vergleich={a.vorher.vergleich}
          von={a.vorher.von}
          bis={a.vorher.bis}
        />
      )}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <span className="text-sm text-muted-foreground">
            {t("occupancy.propertyCount", { count: a.objekte.length })}
          </span>
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={optionen.jeMonat}
              onCheckedChange={(v) => setOptionen({ jeMonat: v })}
            />
            {t("occupancy.byMonth")}
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left">{kopf}</thead>
            <tbody>
              {optionen.jeMonat
                ? a.objekte_monatlich.map((o) => (
                    <tr key={`${o.property_id}-${o.monat}`} className="border-b border-border last:border-0">
                      <td className="px-3 py-2.5">{o.title}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{monatsname(o.monat)}</td>
                      {zahlenZellen(o, false)}
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{pct(o.auslastung_pct)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{o.anreisen}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{geld(o.umsatz)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{geld(o.adr)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{geld(o.revpar)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{o.stornos}</td>
                    </tr>
                  ))
                : zeilen.map(({ key, jetzt, vorher }) => {
                    const o = jetzt ?? vorher;
                    if (!o) return null;
                    // Nur im Vorzeitraum vorhanden (Objekt inzwischen archiviert):
                    // die Gegenwartsspalten stehen auf „—", statt eine 0 zu
                    // behaupten, die nach „nichts verkauft" aussähe.
                    const nurFrueher = jetzt === null;
                    return (
                      <tr
                        key={key}
                        className={
                          "border-b border-border last:border-0 " +
                          (nurFrueher ? "text-muted-foreground" : "")
                        }
                      >
                        <td className="px-3 py-2.5">
                          {o.title}
                          {nurFrueher && (
                            <span className="ml-2 text-xs">{t("compareOnlyBefore")}</span>
                          )}
                        </td>
                        {zahlenZellen(o, nurFrueher)}
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                          {nurFrueher ? "—" : pct(o.auslastung_pct)}
                          {a.vorher && (
                            <span className="mt-0.5 flex justify-end font-normal">
                              <VergleichDelta
                                klein
                                stand={deltaStand(
                                  jetzt?.auslastung_pct ?? null,
                                  vorher?.auslastung_pct ?? null,
                                )}
                                vorherAnzeige={pct(vorher?.auslastung_pct ?? null)}
                              />
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{nurFrueher ? "—" : o.anreisen}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {nurFrueher ? "—" : geld(o.umsatz)}
                          {a.vorher && (
                            <span className="mt-0.5 flex justify-end">
                              <VergleichDelta
                                klein
                                stand={deltaStand(
                                  jetzt?.umsatz ?? null,
                                  vorher?.umsatz ?? null,
                                  {
                                    waehrungGleich: geldVergleichbar,
                                    vorherWaehrung: a.vorher?.currency ?? null,
                                  },
                                )}
                                vorherAnzeige={geldVorher(vorher?.umsatz ?? null)}
                              />
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{nurFrueher ? "—" : geld(o.adr)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{nurFrueher ? "—" : geld(o.revpar)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                          {nurFrueher ? "—" : o.stornos}
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
            {/* Summenzeile — Hostaways TOTALS. Die Auslastung ist gebucht /
                buchbar über alles, nicht der Mittelwert der Zeilen. */}
            <tfoot className="border-t-2 border-foreground/40 bg-muted/30 font-semibold">
              <tr>
                <td className="px-3 py-2.5">{t("table.total")}</td>
                {optionen.jeMonat && <td />}
                <td className="px-3 py-2.5 text-right tabular-nums">{sumBuchbar}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{sumGebucht}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {alle.reduce((n, o) => n + o.naechte_eigennutzung, 0) || "—"}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {alle.reduce((n, o) => n + o.naechte_gesperrt, 0)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {alle.reduce((n, o) => n + o.naechte_stop_sell, 0)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {sumBuchbar ? `${Math.round((sumGebucht * 10000) / sumBuchbar) / 100} %` : "—"}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {alle.reduce((n, o) => n + o.anreisen, 0)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">{geld(Math.round(sumUmsatz * 100) / 100)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {sumNaechteVerkauft ? geld(Math.round((sumUmsatz / sumNaechteVerkauft) * 100) / 100) : "—"}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {sumBuchbar ? geld(Math.round((sumUmsatz / sumBuchbar) * 100) / 100) : "—"}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {alle.reduce((n, o) => n + o.stornos, 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        {/* Der Nenner gehört unter die Tabelle, nicht in einen Hilfe-Artikel:
            zwei Systeme mit verschiedenen Nennern zeigen für denselben Monat
            verschiedene Prozente, und niemand fände den Grund. */}
        <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
          {t("occupancyFootnote")}
        </p>
      </Card>
    </div>
  );
}
