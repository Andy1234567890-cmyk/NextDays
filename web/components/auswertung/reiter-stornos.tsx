"use client";

// Reiter „Stornos" — der Storno-Bericht, den beide Wettbewerber nur als
// Quote führen: je Kanal, nach Grund, nach Vorlauf.
//
// „Entgangener Umsatz" ist der Gesamtpreis der stornierten Buchungen — kein
// „Verlust": ein Teil der Nächte wurde neu verkauft. Der Vorlauf (Tage
// zwischen Storno und geplanter Anreise) rechnet nur mit Buchungen, die einen
// Stornozeitpunkt tragen; wie viele das sind, steht dran (Wurzel 5b).
import { useTranslations } from "next-intl";

import { Card } from "@nextdays/ui/card";
import { formatCurrency } from "@/lib/currency";
import type { Auswertung } from "@/lib/auswertung-typen";
import type { AvailabilitySource } from "@/lib/calendar";
import { channelLabelLoose } from "@/lib/channel-logos";
import { useCalendarLabels } from "@/lib/use-calendar-labels";

import { VergleichDelta, VergleichHinweis, deltaStand } from "./vergleich-delta";

export function ReiterStornos({ a }: { a: Auswertung }) {
  const t = useTranslations("analysis");
  const { channelLabel } = useCalendarLabels();
  const s = a.stornos;
  const v = a.vorher?.stornos;

  if (!s.stornos && !v?.stornos) {
    return (
      <Card className="flex flex-col gap-1 p-8 text-center text-sm text-muted-foreground">
        <span>{t("cancellations.empty")}</span>
        <span className="text-xs">{t("cancellations.emptyHint", { count: a.kennzahlen.buchungen })}</span>
      </Card>
    );
  }

  const geld = (val: number | null) =>
    val === null || !a.currency ? "—" : formatCurrency(val, a.currency);
  const pct = (val: number | null) => (val === null ? "—" : `${val} %`);
  const kanalName = (channel: string, ota: string | null) =>
    ota ? channelLabelLoose(ota) : channelLabel(channel as AvailabilitySource);
  // Die Quote je Kanal braucht die gültigen Buchungen je Kanal aus der
  // Kanaltabelle — beide Tabellen liegen im selben Bericht.
  const gueltigJeKanal = new Map(a.kanaele.map((k) => [k.channel, k.buchungen]));

  return (
    <div className="flex flex-col gap-4">
      {a.vorher && (
        <VergleichHinweis vergleich={a.vorher.vergleich} von={a.vorher.von} bis={a.vorher.bis} />
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kachel
          label={t("kpi.cancellations")}
          wert={pct(s.stornoquote_pct)}
          hinweis={t("kpi.cancelHint", { count: s.stornos })}
          vergleich={
            a.vorher ? (
              <VergleichDelta
                stand={deltaStand(s.stornoquote_pct, v?.stornoquote_pct ?? null)}
                vorherAnzeige={pct(v?.stornoquote_pct ?? null)}
                invertiert
              />
            ) : null
          }
        />
        <Kachel label={t("cancellations.nights")} wert={String(s.naechte)} />
        <Kachel
          label={t("cancellations.lostRevenue")}
          wert={geld(s.umsatz_entgangen)}
          hinweis={t("cancellations.lostRevenueHint")}
        />
        <Kachel
          label={t("cancellations.leadTime")}
          wert={s.vorlauf_tage === null ? "—" : t("patterns.daysValue", { n: s.vorlauf_tage })}
          hinweis={t("cancellations.leadTimeBase", { count: s.mit_zeitpunkt, total: s.stornos })}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2">
          <h3 className="border-b border-border px-4 py-3 font-display text-base font-extrabold">
            {t("cancellations.byChannel")}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">{t("col.channel")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("col.cancellations")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("kpi.cancellations")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("col.nights")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("cancellations.lostRevenue")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("cancellations.leadTime")}</th>
                </tr>
              </thead>
              <tbody>
                {s.kanaele.map((k) => {
                  const gueltig = gueltigJeKanal.get(k.channel) ?? 0;
                  const quote = gueltig + k.stornos ? Math.round((k.stornos * 10000) / (gueltig + k.stornos)) / 100 : null;
                  return (
                    <tr key={k.channel} className="border-b border-border last:border-0">
                      <td className="px-3 py-2">{kanalName(k.channel, k.ota_name)}</td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">{k.stornos}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{pct(quote)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{k.naechte}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{geld(k.umsatz_entgangen)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {k.vorlauf_tage === null ? "—" : t("patterns.daysValue", { n: k.vorlauf_tage })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <h3 className="border-b border-border px-4 py-3 font-display text-base font-extrabold">
            {t("cancellations.byLeadTime")}
          </h3>
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">{t("patterns.days")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("col.cancellations")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("col.share")}</th>
              </tr>
            </thead>
            <tbody>
              {s.vorlauf.map((z) => (
                <tr key={z.schluessel} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 tabular-nums">{z.schluessel}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{z.buchungen}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{z.anteil_pct} %</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3 className="border-y border-border px-4 py-3 font-display text-base font-extrabold">
            {t("cancellations.byReason")}
          </h3>
          <table className="w-full text-sm">
            <tbody>
              {s.gruende.map((g) => (
                <tr key={g.grund ?? "—"} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">{g.grund ?? t("cancellations.noReason")}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{g.anzahl}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
      <p className="text-xs text-muted-foreground">{t("cancellations.footnote")}</p>
    </div>
  );
}

function Kachel({
  label,
  wert,
  hinweis,
  vergleich,
}: {
  label: string;
  wert: string;
  hinweis?: string;
  vergleich?: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="font-display text-xl font-extrabold tabular-nums">{wert}</span>
      {vergleich}
      {hinweis && <span className="text-xs text-muted-foreground">{hinweis}</span>}
    </Card>
  );
}
