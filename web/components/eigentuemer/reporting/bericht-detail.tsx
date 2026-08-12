"use client";

// Bericht-Detail — die Fläche, auf der der Betrieb einen Zeitraum wirklich
// beurteilt. Reihenfolge wie im Branchenstandard und nicht beliebig:
//
//   1. KPI-Zeile          Was ist entstanden?
//   2. Aktionen           Was kann ich damit tun?
//   3. Zahlungen          Was ist davon schon zugesagt?
//   4. Mieten je Objekt   Woher kam es?
//   5. Gebühren je Art    Woraus bestand es?
//   6. Provisionen        Was hat das Portal genommen?
//   7. Zahlungsarten      Wie hat der Gast bezahlt?
//   8. Netto je Kanal     Was bleibt je Vertriebsweg?
//
// Erst das Ganze, dann die Bestandteile. Umgekehrt liest man Zahlen, bevor man
// weiß, wovon sie ein Teil sind.
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@nextdays/ui/dialog";
import { NativeSelect } from "@nextdays/ui/native-select";
import { channelLabelLoose } from "@/lib/channel-logos";
import { formatCurrency } from "@/lib/currency";
import {
  createPayment,
  type EmpfaengerZeile,
  type ReportDetail,
} from "@/lib/owner-reporting";

export function BerichtDetail({
  bericht,
  empfaenger,
  objektNamen,
}: {
  bericht: ReportDetail;
  /** Die Empfänger, für die eine Zahlung erzeugt werden kann. */
  empfaenger: EmpfaengerZeile[];
  /** Titel der Objekte im Scope — für die „ohne Buchung"-Zeilen, die keine
   *  Auswertung haben und darum keinen Namen mitbringen. */
  objektNamen: Record<string, string>;
}) {
  const t = useTranslations("ownerReporting.reportDetail");
  const locale = useLocale();
  const [zahlungDialog, setZahlungDialog] = useState(false);
  const w = bericht.currency;
  const geld = (v: number) => formatCurrency(v, w, locale);
  // `null` heißt „nicht bestimmbar", nicht „null Kronen": ohne hinterlegten
  // Provisionssatz steht nicht fest, was das Portal einbehält. Als 0,00
  // gerendert läse sich das als Tatsache und schenkte dem Eigentümer den
  // Portal-Anteil als Ertrag (Wurzel 4).
  const geldOpt = (v: number | null) => (v === null ? "—" : geld(v));
  const fehlendeKanaele = bericht.channels_without_commission;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href="/eigentuemer/reporting"
          className="w-fit text-sm text-muted-foreground hover:text-foreground"
        >
          ← {t("back")}
        </Link>
        <h1 className="font-display text-3xl font-extrabold">
          {bericht.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("scope", {
            from: bericht.period_from,
            to: bericht.period_to,
            count: bericht.property_ids.length,
          })}{" "}
          · {t(`basis.${bericht.basis}`)}
        </p>
      </div>

      {/* Ein Zeitraum ohne Buchung ist eine AUSSAGE, keine leere Seite: sonst
          liest sich der Bericht wie ein Fehler („alles 0,00"), und niemand
          erkennt, dass Zeitraum, Bezug oder Status daneben liegen. Nur wenn es
          auch keine ungeklärten Buchungen gibt — die wären die eigentliche
          Ursache und stehen dann unten. */}
      {bericht.summary.bookings === 0 && bericht.warnungen.length === 0 && (
        <Card className="flex flex-col gap-3 border-border bg-secondary/30 p-5">
          <div className="flex flex-col gap-1">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Icon icon="ph:calendar-blank" className="size-4" />
              {t("noBookings.title")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("noBookings.body", {
                from: bericht.period_from,
                to: bericht.period_to,
                basis: t(`basis.${bericht.basis}`),
              })}
            </p>
          </div>
          <Button variant="outline" size="sm" className="w-fit" asChild>
            <Link
              href={`/eigentuemer/reporting/berichte/${bericht.id}/bearbeiten`}
            >
              <Icon icon="ph:pencil-simple" className="size-4" />
              {t("noBookings.action")}
            </Link>
          </Button>
        </Card>
      )}

      {/* Fehlt der Provisionssatz, ist das keine Buchungs-Panne, sondern eine
          Lücke in den Einstellungen des Betriebs — also eine Handlungs-
          aufforderung mit Weg dorthin, nicht nur eine Fehlermeldung. Sie steht
          VOR der Warnungsliste, weil sie deren Ursache ist. */}
      {fehlendeKanaele.length > 0 && (
        <Card className="flex flex-col gap-3 border-warning/50 bg-warning/5 p-5">
          <div className="flex flex-col gap-1">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Icon icon="ph:percent" className="size-4" />
              {t("noCommissionRate.title", {
                channels: fehlendeKanaele.join(", "),
              })}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("noCommissionRate.body")}
            </p>
          </div>
          <Button variant="outline" size="sm" className="w-fit" asChild>
            <Link href="/eigentuemer/reporting/einstellungen">
              <Icon icon="ph:sliders-horizontal" className="size-4" />
              {t("noCommissionRate.action")}
            </Link>
          </Button>
        </Card>
      )}

      {bericht.warnungen.length > 0 && (
        // Ungeklärte Buchungen werden BENANNT, nicht verschluckt: eine
        // fehlende Zeile ergäbe eine zu niedrige, aber nummerierte Summe, die
        // niemandem auffällt (Wurzel 5).
        <Card className="flex flex-col gap-2 border-destructive/40 p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
            <Icon icon="ph:warning" className="size-4" />
            {t("warningsTitle", { count: bericht.warnungen.length })}
          </p>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
            {bericht.warnungen.map((warnung) => (
              <li key={warnung}>{warnung}</li>
            ))}
          </ul>
        </Card>
      )}

      {/* 1. KPI-Zeile */}
      <Card className="grid grid-cols-2 gap-6 p-6 md:grid-cols-3 xl:grid-cols-6">
        <Kpi icon="ph:currency-circle-dollar" label={t("kpi.income")} value={geldOpt(bericht.summary.income)} />
        <Kpi icon="ph:buildings" label={t("kpi.rent")} value={geld(bericht.summary.rent)} />
        <Kpi icon="ph:tag" label={t("kpi.fees")} value={geld(bericht.summary.fees)} />
        <Kpi icon="ph:sparkle" label={t("kpi.addons")} value={geld(bericht.summary.addons)} />
        <Kpi icon="ph:bank" label={t("kpi.taxes")} value={geld(bericht.summary.taxes)} />
        <Kpi
          icon="ph:broadcast"
          label={t("kpi.channel")}
          value={geldOpt(bericht.summary.channel_commission)}
        />
      </Card>

      {/* 2. Aktionen */}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" asChild>
          <Link href={`/eigentuemer/reporting/berichte/${bericht.id}/buchungen`}>
            <Icon icon="ph:list-bullets" className="size-4" />
            {t("actions.byBooking")}
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link
            href={`/eigentuemer/reporting/berichte/${bericht.id}/bearbeiten`}
          >
            <Icon icon="ph:pencil-simple" className="size-4" />
            {t("actions.edit")}
          </Link>
        </Button>
        <Button onClick={() => setZahlungDialog(true)}>
          <Icon icon="ph:hand-coins" className="size-4" />
          {t("actions.createPayment")}
        </Button>
      </div>

      {/* 3. Zahlungen */}
      <Card className="flex flex-col gap-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-extrabold">
            {t("payments.title")}
          </h2>
          <Button variant="outline" size="sm" asChild>
            <Link href="/eigentuemer/reporting/zahlungen">
              {t("payments.viewAll")}
            </Link>
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-6 md:grid-cols-3 xl:grid-cols-5">
          <Kpi icon="ph:check-circle" label={t("payments.payout")} value={geld(bericht.payments_summary.payout)} />
          <Kpi icon="ph:buildings" label={t("payments.rent")} value={geld(bericht.payments_summary.rent)} />
          <Kpi icon="ph:tag" label={t("payments.fees")} value={geld(bericht.payments_summary.fees)} />
          <Kpi icon="ph:bank" label={t("payments.taxes")} value={geld(bericht.payments_summary.taxes)} />
          <Kpi icon="ph:arrow-circle-down" label={t("payments.expenses")} value={geld(bericht.payments_summary.expenses)} />
        </div>
      </Card>

      {/* 4. Mieten je Objekt */}
      <Tabelle
        titel={t("rent.title")}
        kopf={[
          t("rent.cols.property"),
          t("rent.cols.bookings"),
          t("rent.cols.nights"),
          t("rent.cols.guests"),
          t("rent.cols.rent"),
          t("rent.cols.fees"),
          t("rent.cols.addons"),
          t("rent.cols.taxes"),
          t("rent.cols.channel"),
          t("rent.cols.income"),
        ]}
        leer={t("rent.empty")}
        zeilen={[
          ...bericht.rent_rows.map((r) => ({
            key: r.property_id,
            zellen: [
              r.property_name ?? r.property_id,
              `${r.bookings}`,
              `${r.nights}`,
              `${r.guests}`,
              geld(r.rent),
              geld(r.fees),
              geld(r.addons),
              geld(r.taxes),
              geldOpt(r.channel),
              geldOpt(r.income),
            ],
          })),
          // Objekte ohne Buchung erscheinen mit „—" statt zu verschwinden:
          // sonst sähe der Bericht aus, als wären sie nie ausgewählt worden.
          ...bericht.empty_property_ids.map((id) => ({
            key: id,
            gedimmt: true,
            zellen: [
              objektNamen[id] ?? id,
              "—",
              "—",
              "—",
              "—",
              "—",
              "—",
              "—",
              "—",
              "—",
            ],
          })),
        ]}
        summe={
          bericht.rent_rows.length > 0
            ? [
                t("total"),
                `${bericht.summary.bookings}`,
                `${bericht.summary.nights}`,
                `${bericht.summary.guests}`,
                geld(bericht.summary.rent),
                geld(bericht.summary.fees),
                geld(bericht.summary.addons),
                geld(bericht.summary.taxes),
                geldOpt(bericht.summary.channel_commission),
                geldOpt(bericht.summary.income),
              ]
            : null
        }
      />

      {/* 5. Gebühren je Art */}
      <Tabelle
        titel={t("fees.title")}
        kopf={[
          t("fees.cols.fee"),
          t("fees.cols.count"),
          t("fees.cols.average"),
          t("fees.cols.total"),
        ]}
        leer={t("fees.empty")}
        zeilen={bericht.fee_rows.map((r) => ({
          key: r.fee_type,
          zellen: [r.label, `${r.count}`, geld(r.average), geld(r.total)],
        }))}
        summe={
          bericht.fee_rows.length > 0
            ? [
                t("total"),
                `${bericht.fee_rows.reduce((s, r) => s + r.count, 0)}`,
                "",
                geld(bericht.summary.fees),
              ]
            : null
        }
      />

      {/* 6. Provisionen je Kanal */}
      <Tabelle
        titel={t("commission.title")}
        kopf={[t("commission.cols.channel"), t("commission.cols.amount")]}
        leer={t("commission.empty")}
        zeilen={bericht.commission_rows.map((r) => ({
          key: `${r.channel}-${r.ota_name ?? ""}`,
          zellen: [
            r.ota_name ?? channelLabelLoose(r.channel),
            geldOpt(r.commission),
          ],
        }))}
        summe={
          bericht.commission_rows.length > 0
            ? [t("total"), geldOpt(bericht.summary.channel_commission)]
            : null
        }
      />

      {/* 7. Zahlungsarten des Gastes */}
      <Tabelle
        titel={t("methods.title")}
        kopf={[t("methods.cols.method"), t("methods.cols.total")]}
        leer={t("methods.empty")}
        zeilen={bericht.payment_method_rows.map((r) => ({
          key: r.method,
          zellen: [r.method, geld(r.total)],
        }))}
        summe={
          bericht.payment_method_rows.length > 0
            ? [
                t("methods.paidByGuest"),
                geld(
                  bericht.payment_method_rows.reduce((s, r) => s + r.total, 0),
                ),
              ]
            : null
        }
      />

      {/* 8. Nettoeinkommen je Kanal */}
      <Tabelle
        titel={t("net.title")}
        kopf={[
          t("net.cols.channel"),
          t("net.cols.outstanding"),
          t("net.cols.income"),
        ]}
        leer={t("net.empty")}
        zeilen={bericht.net_income_rows.map((r) => ({
          key: `${r.channel}-${r.ota_name ?? ""}`,
          zellen: [
            r.ota_name ?? channelLabelLoose(r.channel),
            geld(r.outstanding),
            geldOpt(r.income),
          ],
        }))}
        summe={
          bericht.net_income_rows.length > 0
            ? [
                t("total"),
                geld(bericht.outstanding_total),
                geldOpt(bericht.summary.income),
              ]
            : null
        }
      />

      {zahlungDialog && (
        <ZahlungErstellenDialog
          reportId={bericht.id}
          empfaenger={empfaenger}
          onClose={() => setZahlungDialog(false)}
        />
      )}
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon icon={icon} className="size-4" />
        {label}
      </span>
      <span className="font-display text-xl font-extrabold tabular-nums">
        {value}
      </span>
    </div>
  );
}

type Zeile = { key: string; zellen: string[]; gedimmt?: boolean };

/**
 * Eine Aufschlüsselungstabelle.
 *
 * EINE Komponente für alle fünf Tabellen: sie unterscheiden sich nur in
 * Spalten und Zeilen. Fünf handgeschriebene Tabellen liefen in Ausrichtung,
 * Summenzeile und Leerzustand auseinander — beim sechsten Bericht hätte eine
 * davon rechtsbündige Beträge und eine linksbündige.
 *
 * Ab Spalte 2 rechtsbündig und `tabular-nums`: Beträge untereinander sind nur
 * vergleichbar, wenn die Ziffern gleich breit sind.
 */
function Tabelle({
  titel,
  kopf,
  zeilen,
  summe,
  leer,
}: {
  titel: string;
  kopf: string[];
  zeilen: Zeile[];
  summe: string[] | null;
  leer: string;
}) {
  return (
    <Card className="flex flex-col gap-0 overflow-hidden p-0">
      <div className="border-b border-border px-4 py-3">
        <h2 className="font-display text-base font-extrabold">{titel}</h2>
      </div>
      {zeilen.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">{leer}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/40">
                {kopf.map((h, i) => (
                  <th
                    key={h}
                    className={`px-4 py-2 font-semibold ${
                      i === 0 ? "text-left" : "text-right"
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {zeilen.map((z) => (
                <tr
                  key={z.key}
                  className={`border-b border-border last:border-0 ${
                    z.gedimmt ? "text-muted-foreground" : ""
                  }`}
                >
                  {z.zellen.map((c, i) => (
                    <td
                      key={`${z.key}-${kopf[i] ?? i}`}
                      className={`px-4 py-2 ${
                        i === 0
                          ? "font-medium"
                          : "text-right tabular-nums"
                      }`}
                    >
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {summe && (
              <tfoot>
                <tr className="bg-secondary/60 font-semibold">
                  {summe.map((c, i) => (
                    <td
                      key={`sum-${kopf[i] ?? i}`}
                      className={`px-4 py-2 ${
                        i === 0 ? "" : "text-right tabular-nums"
                      }`}
                    >
                      {c}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </Card>
  );
}

/**
 * Zahlung für EINEN Empfänger erzeugen.
 *
 * Bewusst kein „für alle Empfänger auf einmal": eine Zahlung ist eine
 * Forderung mit eigenem Beleg. Schlägt sie für einen Empfänger fehl (kein
 * Vertrag am Stichtag, ungeklärte Buchung), wäre bei einem Sammellauf nicht
 * mehr erkennbar, welche entstanden sind und welche nicht.
 */
function ZahlungErstellenDialog({
  reportId,
  empfaenger,
  onClose,
}: {
  reportId: string;
  empfaenger: EmpfaengerZeile[];
  onClose: () => void;
}) {
  const t = useTranslations("ownerReporting.reportDetail");
  const router = useRouter();
  const [ownerId, setOwnerId] = useState(empfaenger[0]?.owner_id ?? "");
  const [busy, setBusy] = useState(false);
  const gewaehlt = empfaenger.find((e) => e.owner_id === ownerId);

  async function submit() {
    if (!ownerId) return;
    setBusy(true);
    const res = await createPayment(reportId, ownerId);
    setBusy(false);
    if (!res.ok) {
      // Der 422 („kein Abrechnungsvertrag", „ungeklärte Buchungen") ist die
      // fachliche Antwort des Servers und wird im Wortlaut gezeigt.
      toast.error(res.error);
      return;
    }
    onClose();
    router.push(`/eigentuemer/reporting/zahlungen/${res.data.id}`);
    router.refresh();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-w-md">
        <div className="flex flex-col gap-4">
          <DialogTitle>{t("createPayment.title")}</DialogTitle>
          <DialogDescription>{t("createPayment.hint")}</DialogDescription>
          {empfaenger.length === 0 ? (
            <p className="rounded-(--radius) border border-destructive/40 p-4 text-sm text-destructive">
              {t("createPayment.noRecipients")}
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              <NativeSelect
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
              >
                {empfaenger.map((e) => (
                  <option key={e.owner_id} value={e.owner_id}>
                    {e.name}
                  </option>
                ))}
              </NativeSelect>
              {gewaehlt && !gewaehlt.hat_vertrag && (
                // Vorwarnung statt 422 nach dem Klick: ohne Vertrag am
                // Stichtag ist die Auszahlung nicht berechenbar.
                <p className="text-xs text-destructive">
                  {t("createPayment.noTerms")}
                </p>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              {t("createPayment.cancel")}
            </Button>
            <Button
              onClick={() => void submit()}
              disabled={busy || !ownerId}
            >
              {busy ? (
                <Icon icon="ph:spinner" className="size-4 animate-spin" />
              ) : null}
              {t("createPayment.submit")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
