"use client";

// Reiter „Ausgaben & Extras" — Hostaways `Expenses & Extras`.
//
// Quelle sind die Verrechnungsposten der Eigentümer-Abrechnung
// (`owner_expenses`): „Ausgaben" sind Posten zulasten des Eigentümers
// (`from_owner`), „Extras" Posten zu seinen Gunsten (`to_owner`) — Hostaways
// Aufteilung „Ausgaben = negative Werte, Extras = positive Werte", nur ohne
// Vorzeichen-Raterei, weil unsere Posten die Richtung als Feld tragen.
//
// Zeitraum ist das DATUM DES POSTENS: eine Reinigungsrechnung vom 3. gehört
// in den Monat des 3., egal wann die Buchung anreiste.
import { useLocale, useTranslations } from "next-intl";

import { Card } from "@nextdays/ui/card";
import { formatCurrency } from "@/lib/currency";
import type { Auswertung } from "@/lib/auswertung-typen";

export function ReiterAusgaben({ a }: { a: Auswertung }) {
  const t = useTranslations("analysis");
  const locale = useLocale();
  const x = a.ausgaben;

  if (!x.anzahl) {
    return (
      <Card className="flex flex-col gap-1 p-8 text-center text-sm text-muted-foreground">
        <span>{t("expenses.empty")}</span>
        <span className="text-xs">{t("expenses.emptyHint")}</span>
      </Card>
    );
  }

  const geld = (v: number, w: string | null = x.currency) =>
    w ? formatCurrency(v, w) : String(v);
  const datum = (iso: string) =>
    iso ? new Date(`${iso}T00:00:00`).toLocaleDateString(locale) : "—";

  return (
    <div className="flex flex-col gap-4">
      {!x.currency && x.waehrungen.length > 1 && (
        <Card className="p-4 text-sm text-muted-foreground">
          {t("mixedCurrency", { list: x.waehrungen.join(", ") })}
        </Card>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kachel label={t("expenses.expenses")} wert={x.currency ? geld(x.ausgaben) : "—"} ton="rot" />
        <Kachel label={t("expenses.extras")} wert={x.currency ? geld(x.extras) : "—"} ton="gruen" />
        <Kachel
          label={t("expenses.balance")}
          wert={x.currency ? geld(x.saldo) : "—"}
          hinweis={t("expenses.balanceHint")}
        />
        <Kachel label={t("expenses.count")} wert={String(x.anzahl)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Gruppen
          titel={t("expenses.byCategory")}
          zeilen={x.kategorien.map((k) => ({
            key: k.schluessel ?? "—",
            label: k.schluessel ?? t("expenses.noCategory"),
            ...k,
          }))}
          geld={geld}
          hatWaehrung={!!x.currency}
        />
        <Gruppen
          titel={t("expenses.byProperty")}
          zeilen={x.objekte.map((o) => ({
            key: o.schluessel ?? "—",
            label: o.title ?? t("expenses.noProperty"),
            ...o,
          }))}
          geld={geld}
          hatWaehrung={!!x.currency}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-border px-4 py-3 text-sm text-muted-foreground">
          {t("expenses.rowCount", { count: x.posten.length })}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left">
              <tr>
                <th className="px-3 py-3 font-medium whitespace-nowrap">{t("col.date")}</th>
                <th className="px-3 py-3 font-medium">{t("col.name")}</th>
                <th className="px-3 py-3 font-medium">{t("col.category")}</th>
                <th className="px-3 py-3 font-medium">{t("col.property")}</th>
                <th className="px-3 py-3 font-medium">{t("col.kind")}</th>
                <th className="px-3 py-3 text-right font-medium">{t("col.amount")}</th>
                <th className="px-3 py-3 text-center font-medium">{t("col.receipt")}</th>
              </tr>
            </thead>
            <tbody>
              {x.posten.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2.5 whitespace-nowrap">{datum(p.date)}</td>
                  <td className="px-3 py-2.5">{p.name}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{p.kategorie ?? "—"}</td>
                  <td className="px-3 py-2.5">{p.property_title ?? "—"}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className={
                        "rounded-full px-2 py-0.5 text-xs " +
                        (p.art === "ausgabe"
                          ? "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300"
                          : "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300")
                      }
                    >
                      {t(`expenses.kind.${p.art}`)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {p.art === "ausgabe" ? "−" : "+"}
                    {geld(p.betrag, p.currency)}
                  </td>
                  <td className="px-3 py-2.5 text-center text-muted-foreground">
                    {p.hat_beleg ? "📎" : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
          {t("expenses.footnote")}
        </p>
      </Card>
    </div>
  );
}

function Kachel({
  label,
  wert,
  hinweis,
  ton,
}: {
  label: string;
  wert: string;
  hinweis?: string;
  ton?: "rot" | "gruen";
}) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span
        className={
          "font-display text-xl font-extrabold tabular-nums " +
          (ton === "rot" ? "text-red-700 dark:text-red-300" : ton === "gruen" ? "text-emerald-700 dark:text-emerald-300" : "")
        }
      >
        {wert}
      </span>
      {hinweis && <span className="text-xs text-muted-foreground">{hinweis}</span>}
    </Card>
  );
}

function Gruppen({
  titel,
  zeilen,
  geld,
  hatWaehrung,
}: {
  titel: string;
  zeilen: { key: string; label: string; anzahl: number; ausgaben: number; extras: number; saldo: number }[];
  geld: (v: number) => string;
  hatWaehrung: boolean;
}) {
  const t = useTranslations("analysis");
  return (
    <Card className="overflow-hidden">
      <h3 className="border-b border-border px-4 py-3 font-display text-base font-extrabold">{titel}</h3>
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/40 text-left">
          <tr>
            <th className="px-3 py-2 font-medium">{t("col.name")}</th>
            <th className="px-3 py-2 text-right font-medium">{t("col.count")}</th>
            <th className="px-3 py-2 text-right font-medium">{t("expenses.expenses")}</th>
            <th className="px-3 py-2 text-right font-medium">{t("expenses.extras")}</th>
            <th className="px-3 py-2 text-right font-medium">{t("expenses.balance")}</th>
          </tr>
        </thead>
        <tbody>
          {zeilen.map((z) => (
            <tr key={z.key} className="border-b border-border last:border-0">
              <td className="px-3 py-2">{z.label}</td>
              <td className="px-3 py-2 text-right tabular-nums">{z.anzahl}</td>
              <td className="px-3 py-2 text-right tabular-nums">{hatWaehrung ? geld(z.ausgaben) : "—"}</td>
              <td className="px-3 py-2 text-right tabular-nums">{hatWaehrung ? geld(z.extras) : "—"}</td>
              <td className="px-3 py-2 text-right font-medium tabular-nums">{hatWaehrung ? geld(z.saldo) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
