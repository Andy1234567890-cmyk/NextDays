"use client";

// Aufschlüsselung nach Buchung — je Aufenthalt zwei Blöcke nebeneinander:
// links die Bezugsdaten (Referenz, Quelle, Gäste, Nächte, Kunde), rechts die
// Posten mit Endpreis, Portal-Provision und Einkommen.
//
// Bewusst KEINE flache Tabelle über alle Buchungen: die Posten je Buchung sind
// unterschiedlich viele (Miete, 0–n Gebühren, Zusatzleistungen, Steuern). In
// eine Tabelle gepresst bräuchte jede Gebührenart eine eigene Spalte, und bei
// sieben Arten wären fünf davon in jeder Zeile leer.
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { Icon } from "@iconify/react";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { channelLabelLoose } from "@/lib/channel-logos";
import { formatCurrency } from "@/lib/currency";
import type { BuchungsAufschluesselung } from "@/lib/owner-reporting";

export function BuchungsAufschluesselungAnsicht({
  reportId,
  reportName,
  daten,
}: {
  reportId: string;
  reportName: string;
  daten: BuchungsAufschluesselung;
}) {
  const t = useTranslations("ownerReporting.bookings");
  const locale = useLocale();
  const geld = (v: number) => formatCurrency(v, daten.currency, locale);
  // `null` = nicht bestimmbar (kein Provisionssatz hinterlegt). Als 0,00
  // gerendert wäre es die Behauptung, das Portal habe nichts genommen.
  const geldOpt = (v: number | null) => (v === null ? "—" : geld(v));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href={`/eigentuemer/reporting/berichte/${reportId}`}
          className="w-fit text-sm text-muted-foreground hover:text-foreground"
        >
          ← {reportName}
        </Link>
        <h1 className="font-display text-3xl font-extrabold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("count", { count: daten.rows.length })}
        </p>
      </div>

      {daten.channels_without_commission.length > 0 && (
        <Card className="flex flex-col gap-3 border-warning/50 bg-warning/5 p-5">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Icon icon="ph:percent" className="size-4" />
            {t("noCommissionRate", {
              channels: daten.channels_without_commission.join(", "),
            })}
          </p>
          <Button variant="outline" size="sm" className="w-fit" asChild>
            <Link href="/eigentuemer/reporting/einstellungen">
              <Icon icon="ph:sliders-horizontal" className="size-4" />
              {t("openSettings")}
            </Link>
          </Button>
        </Card>
      )}

      {daten.warnungen.length > 0 && (
        <Card className="flex flex-col gap-2 border-destructive/40 p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
            <Icon icon="ph:warning" className="size-4" />
            {t("warnings", { count: daten.warnungen.length })}
          </p>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
            {daten.warnungen.map((warnung) => (
              <li key={warnung}>{warnung}</li>
            ))}
          </ul>
        </Card>
      )}

      {daten.rows.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {t("empty")}
        </Card>
      ) : (
        daten.rows.map((b) => (
          <Card key={b.reservation_id} className="flex flex-col gap-0 p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
              <p className="font-semibold">
                {b.property_name ?? b.property_id} ·{" "}
                {t("stay", { from: b.check_in, to: b.check_out })}
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/reservierungen/${b.reservation_id}`}>
                  {t("openBooking")}
                </Link>
              </Button>
            </div>
            <div className="grid gap-0 md:grid-cols-[18rem_1fr]">
              <dl className="flex flex-col gap-0 border-b border-border text-sm md:border-b-0 md:border-r">
                <Info
                  label={t("info.reference")}
                  value={b.reference ?? "—"}
                />
                <Info
                  label={t("info.source")}
                  // `ota_name` zuerst: unter `channel='portal'` stehen mehrere
                  // Marktplätze, und „portal" wäre für den Eigentümer keine
                  // Auskunft darüber, wo gebucht wurde.
                  value={b.ota_name ?? (channelLabelLoose(b.channel) || "—")}
                />
                <Info
                  label={t("info.guests")}
                  value={t("guestCount", { count: b.guests })}
                />
                <Info
                  label={t("info.nights")}
                  value={t("nightCount", { count: b.nights })}
                />
                <Info label={t("info.guest")} value={b.guest_name ?? "—"} />
              </dl>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/40 text-left">
                    <th className="px-4 py-2 font-semibold">
                      {t("cols.concept")}
                    </th>
                    <th className="px-4 py-2 font-semibold">
                      {t("cols.description")}
                    </th>
                    <th className="px-4 py-2 text-right font-semibold">
                      {t("cols.amount")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {b.items.map((p, i) => (
                    <tr
                      key={`${b.reservation_id}-${p.kind}-${p.label}-${i}`}
                      className="border-b border-border"
                    >
                      <td className="px-4 py-2 text-muted-foreground">
                        {t(`kind.${p.kind}`)}
                      </td>
                      <td className="px-4 py-2">{p.label}</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {geld(p.amount)}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-b border-border">
                    <td className="px-4 py-2" colSpan={2} />
                    <td className="px-4 py-2 text-right tabular-nums" />
                  </tr>
                  <tr className="border-b border-border">
                    <td className="px-4 py-2 text-right font-medium" colSpan={2}>
                      {t("gross")}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {geld(b.gross)}
                    </td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="px-4 py-2 text-right font-medium" colSpan={2}>
                      {t("commission")}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-destructive">
                      {/* Vorzeichen sichtbar: der Betrag wird ABGEZOGEN. Ohne
                          Minus läse sich die Zeile als weitere Einnahme. Bei
                          unbekanntem Abzug steht „—" ohne Minus — ein „−—"
                          behauptete eine Richtung, die niemand kennt. */}
                      {b.channel_commission === null
                        ? "—"
                        : `−${geld(b.channel_commission)}`}
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className="bg-secondary/60 font-semibold">
                    <td className="px-4 py-2" colSpan={2}>
                      {t("income")}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {geldOpt(b.income)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border px-4 py-2 last:border-0">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
