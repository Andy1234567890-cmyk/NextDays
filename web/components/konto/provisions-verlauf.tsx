"use client";

// Provisions-Monatsverlauf — was wird wann abgerechnet. Aufbau wie der
// Rechnungsverlauf, damit beide Ansichten sich gleich anfühlen.
//
// Diese Liste zeigt AUSSCHLIESSLICH die Provisionen externer Portale
// (commission_ledger). Die 8 % des myBestDays-Marktplatzes werden direkt beim
// Zahlungseingang über die Stripe-application_fee einbehalten
// (payments/service.py) und stehen deshalb nie im Ledger — ohne diesen Hinweis
// liest ein Betrieb mit Marktplatz-Buchungen hier „keine Provisionen".
//
// `charge_date` ist der FAKTURIERUNGS-Tag (1. des Folgemonats), NICHT der
// Belastungstag: bill_pending_commissions legt nur ein Stripe-Invoice-Item an,
// das mit der nächsten regulären Abo-Rechnung mitläuft (Docstrings
// subscriptions/service.py `_einzugstag`, schemas.py `CommissionMonth`).
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { Fragment, useCallback, useEffect, useState } from "react";

import { channelLabelLoose } from "@/lib/channel-logos";
import { formatCurrency } from "@/lib/currency";
import {
  getCommissionEntries,
  getCommissionMonths,
  type CommissionEntry,
  type CommissionMonth,
  type CommissionStatus,
} from "@/lib/subscriptions";

type StatusLabel = { key: string; klasse: string };

// Zwei Anforderungen, die BEIDE gelten müssen:
//
// 1. Totalität für die bekannten Werte: der `Record<CommissionStatus, …>` zwingt
//    tsc, jeden Wert der Union zu belegen. Kommt im DB-Enum `commission_status`
//    (0006) ein Wert dazu und wird in `CommissionStatus` (lib/subscriptions.ts)
//    nachgetragen, schlägt der Build hier fehl, bis das Label existiert. Genau
//    dieses Netz fehlte, als 'paid' zum Absturz führte.
// 2. Rohanzeige für unbekannte Werte: die API-Grenze ist nicht typisierbar. Das
//    Backend gibt `status` bewusst als `str` heraus (subscriptions/schemas.py:
//    ein Literal würde bei einem neuen Enum-Wert einen 500er werfen) und
//    service.py reicht den DB-Wert unverändert durch. `CommissionStatus` ist
//    also eine Zusage über FREMDE Daten, die niemand zur Laufzeit prüft — ein
//    fünfter Enum-Wert käme bei grünem tsc hier an. Deshalb wird über
//    `statusLabel()` gelesen, das ehrlich `| undefined` liefert.
//
// Dieselbe Regel folgt STATUS_LABEL in konto-abo-section.tsx („Unbekanntes
// zeigen wir roh, statt es auf ‚aktiv' zu raten", Wurzel 4) — die zwei Maps
// behandeln den Fall bewusst gleich.
//
// 'pending' heißt „noch nicht fakturiert" — nicht „wird gerade eingezogen":
// der Einzug passiert erst mit der nächsten Abo-Rechnung. Der Text steht als
// i18n-Key hier, nicht als deutscher Literal.
const STATUS: Record<CommissionStatus, StatusLabel> = {
  invoiced: {
    key: "commissions.statusInvoiced",
    klasse: "bg-emerald-500/15 text-emerald-600",
  },
  paid: {
    key: "commissions.statusPaid",
    klasse: "bg-emerald-500/15 text-emerald-600",
  },
  pending: {
    key: "commissions.statusPending",
    klasse: "bg-amber-500/15 text-amber-600",
  },
  mixed: {
    key: "commissions.statusMixed",
    klasse: "bg-sky-500/15 text-sky-600",
  },
};

// Der Lesezugriff auf STATUS. Der Parametertyp `Partial<Record<string, …>>` ist
// die ehrliche Sicht auf eine Map, die mit einem beliebigen API-String befragt
// wird: `STATUS` passt ohne `as` hinein, der Rückgabetyp trägt aber das
// `| undefined`, das ein direktes `STATUS[r.status]` verschweigt (`Record` über
// die Union behauptet einen Treffer, den es bei einem neuen Enum-Wert nicht
// gibt). So bleibt Punkt 1 (Totalität) erzwungen und Punkt 2 (kein Crash) wahr.
function statusLabel(
  map: Partial<Record<string, StatusLabel>>,
  status: string,
): StatusLabel | undefined {
  return map[status];
}

function monatsName(period: string, locale: string): string {
  const [jahr, monat] = period.split("-").map(Number);
  // Tag 1 ist willkürlich — es geht nur um Monat + Jahr in der Anzeige.
  return new Date(jahr, monat - 1, 1).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
}

// Die aufgeklappte Aufstellung EINES Monats.
//
// Eigene Komponente, damit jeder Monat seinen eigenen Ladezustand hat: eine
// gemeinsame `entries`-Variable im Elternteil zeigte beim Umschalten kurz die
// Posten des vorigen Monats unter der neuen Überschrift.
//
// Geladen wird erst beim Aufklappen. Ein Betrieb mit drei Jahren Historie hätte
// sonst 36 Abfragen beim Öffnen der Seite, für Daten, die niemand ansieht.
function MonatsAufstellung({ period }: { period: string }) {
  const locale = useLocale();
  const t = useTranslations("account");
  const [rows, setRows] = useState<CommissionEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let aktiv = true;
    void (async () => {
      const res = await getCommissionEntries(period);
      if (!aktiv) return;
      if (res.ok) setRows(res.data);
      else setError(res.error);
    })();
    // Ein zwischenzeitlich zugeklappter Monat darf seinen Zustand nicht mehr
    // setzen — sonst warnt React über ein Update auf einer entfernten
    // Komponente, und bei schnellem Auf/Zu gewinnt die langsamere Antwort.
    return () => {
      aktiv = false;
    };
  }, [period]);

  const zeitraum = (e: CommissionEntry) => {
    if (!e.check_in) return "—";
    const von = new Date(e.check_in).toLocaleDateString(locale, {
      day: "numeric",
      month: "short",
    });
    if (!e.check_out) return von;
    const bis = new Date(e.check_out).toLocaleDateString(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    return `${von} – ${bis}`;
  };

  if (error) {
    return (
      <p className="px-4 py-3 text-sm text-destructive">
        {t("commissions.entriesFailed", { error })}
      </p>
    );
  }
  if (!rows) {
    return (
      <p className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
        <Icon icon="svg-spinners:180-ring" className="size-4" />
        {t("commissions.entriesLoading")}
      </p>
    );
  }
  if (rows.length === 0) {
    return (
      <p className="px-4 py-3 text-sm text-muted-foreground">
        {t("commissions.entriesEmpty")}
      </p>
    );
  }

  // Summe nur bei EINER Währung — gemischte Beträge zu addieren wäre ein
  // erfundener Kurs (Wurzel 4), dieselbe Regel wie in der Monatszeile.
  const waehrungen = new Set(rows.map((r) => r.currency));
  const summe =
    waehrungen.size === 1
      ? rows.reduce((s, r) => s + r.commission_amount, 0)
      : null;

  return (
    <div className="bg-muted/30 px-4 py-4">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-sm font-semibold">
          {t("commissions.entriesTitle")}
        </h3>
        <p className="text-xs text-muted-foreground">
          {t("commissions.entriesHint")}
        </p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[46rem] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">
                {t("commissions.colProperty")}
              </th>
              <th className="px-3 py-2 font-medium">
                {t("commissions.colGuest")}
              </th>
              <th className="px-3 py-2 font-medium">
                {t("commissions.colStay")}
              </th>
              <th className="px-3 py-2 font-medium">
                {t("commissions.colChannel")}
              </th>
              <th className="px-3 py-2 text-right font-medium">
                {t("commissions.colGross")}
              </th>
              <th className="px-3 py-2 text-right font-medium">
                {t("commissions.colRate")}
              </th>
              <th className="px-3 py-2 text-right font-medium">
                {t("commissions.colCommission")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id} className="border-b border-border last:border-0">
                <td className="px-3 py-2 font-medium">
                  {/* Gelöschte Reservierung: die Provisionszeile bleibt als
                      Forderung bestehen. Das wird benannt, statt eine leere
                      Zelle zu zeigen, die wie ein Ladefehler aussieht. */}
                  {e.property_title ?? (
                    <span className="text-muted-foreground">
                      {t("commissions.entryNoProperty")}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {e.guest_name ?? "—"}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {zeitraum(e)}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {channelLabelLoose(e.channel)}
                </td>
                <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">
                  {formatCurrency(e.gross_amount, e.currency)}
                </td>
                <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">
                  {/* Der eingefrorene Satz DIESER Zeile, nicht der heutige
                      Tarif — sonst zeigte eine Tarifänderung rückwirkend
                      falsche Vergangenheit. */}
                  {(e.rate * 100).toLocaleString(locale, {
                    maximumFractionDigits: 2,
                  })}{" "}
                  %
                </td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">
                  {formatCurrency(e.commission_amount, e.currency)}
                </td>
              </tr>
            ))}
          </tbody>
          {summe !== null && (
            <tfoot>
              <tr className="border-t border-border">
                <td
                  colSpan={6}
                  className="px-3 py-2 text-right text-muted-foreground"
                >
                  {t("commissions.entrySum")}
                </td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">
                  {formatCurrency(summe, rows[0].currency)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

export function ProvisionsVerlauf({ onBack }: { onBack: () => void }) {
  const locale = useLocale();
  const t = useTranslations("account");
  const [rows, setRows] = useState<CommissionMonth[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offen, setOffen] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await getCommissionMonths(36);
      if (res.ok) setRows(res.data);
      else setError(res.error);
    })();
  }, []);

  const umschalten = useCallback((period: string) => {
    setOffen((v) => (v === period ? null : period));
  }, []);

  return (
    <div className="flex flex-1 flex-col gap-4">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 self-start text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <Icon icon="lucide:chevron-left" className="size-4" />
        {t("commissions.backToBilling")}
      </button>

      <div>
        {/* Nur die Überschrift: die Konditionen (Satz, Abrechnungsrhythmus,
            Kanalvergleich) sind Vertragsinhalt und stehen in den AGB, nicht
            über einer Aufstellung, die den Ist-Stand zeigt. Die Keys
            `commissions.monthsIntro`/`monthsChannels` bleiben für die AGB
            erhalten. */}
        <h2 className="font-display text-xl font-extrabold">
          {t("commissions.monthsTitle")}
        </h2>
      </div>

      {error && (
        <p className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {!rows && !error && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon icon="svg-spinners:180-ring" className="size-4" />
          {t("commissions.monthsLoading")}
        </div>
      )}

      {rows && rows.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          {/* Reine Sachaussage. Die frühere Fassung erklärte im Leerzustand die
              Konditionen (provisionsfrei / 8 % Marktplatz) — Vertragsinhalt,
              der in die AGB gehört. Key `monthsEmpty` bleibt dafür erhalten. */}
          {t("commissions.monthsEmptyPlain")}
        </div>
      )}

      {rows && rows.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[44rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">
                  {t("commissions.colMonth")}
                </th>
                <th className="px-4 py-3 font-medium">
                  {t("commissions.colBookings")}
                </th>
                <th className="px-4 py-3 font-medium">
                  {t("commissions.colGross")}
                </th>
                <th className="px-4 py-3 font-medium">
                  {t("commissions.colCommission")}
                </th>
                {/* `chargedOn` heißt „Abgerechnet am": der 1. ist der
                    Fakturierungstag, nicht der Belastungstag. */}
                <th className="px-4 py-3 font-medium">
                  {t("commissions.chargedOn")}
                </th>
                <th className="px-4 py-3 font-medium">
                  {t("commissions.colStatus")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const st = statusLabel(STATUS, r.status);
                const auf = offen === r.period;
                return (
                  <Fragment key={r.period}>
                  <tr
                    onClick={() => umschalten(r.period)}
                    className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/40"
                  >
                    <td className="px-4 py-3 font-medium">
                      {/* Der Umschalter ist ein echter Button, nicht nur die
                          klickbare Zeile: eine Zeile mit onClick erreicht man
                          weder per Tab noch mit Enter, und Screenreader
                          bekommen ohne aria-expanded nicht mit, dass sich
                          darunter etwas öffnet. */}
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          umschalten(r.period);
                        }}
                        aria-expanded={auf}
                        aria-label={t("commissions.entriesToggle")}
                        className="flex items-center gap-1.5 text-left font-medium hover:text-primary"
                      >
                        <Icon
                          icon="lucide:chevron-right"
                          className={`size-4 text-muted-foreground transition-transform ${
                            auf ? "rotate-90" : ""
                          }`}
                        />
                        {monatsName(r.period, locale)}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {r.booking_count}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">
                      {/* Gemischte Währungen werden nicht addiert (Wurzel 4) —
                          dann steht die Summe ohne Symbol da. */}
                      {formatCurrency(r.gross_total, r.currency)}
                    </td>
                    <td className="px-4 py-3 font-semibold tabular-nums">
                      {/* Greift der Deckel, ist `commission_total` NICHT der
                          Betrag, den der Betrieb zahlt: er liegt darüber, und
                          der Überhang verfällt (bill_pending_commissions kappt
                          die Summe und setzt trotzdem alle Zeilen auf
                          `invoiced` — er wandert nicht in den Folgemonat).
                          Fett steht deshalb der berechnete Betrag, die
                          entstandene Provision darunter als Beleg. Bis zum
                          30.08.2026 stand hier nur die entstandene Summe und
                          der Deckel in einer Fußnote — welcher Betrag wirklich
                          fällig wird, ging daraus nicht hervor. */}
                      {r.billed_total !== null &&
                      r.billed_total < r.commission_total ? (
                        <>
                          {formatCurrency(r.billed_total, r.currency)}
                          <span className="block text-xs font-normal text-muted-foreground">
                            {t("commissions.colCommissionIncurred", {
                              total: formatCurrency(
                                r.commission_total,
                                r.currency,
                              ),
                            })}
                          </span>
                        </>
                      ) : (
                        formatCurrency(r.commission_total, r.currency)
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5">
                        <Icon
                          icon="lucide:calendar"
                          className="size-3.5 text-muted-foreground"
                        />
                        {new Date(r.charge_date).toLocaleDateString(locale, {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {/* Unbekannter Status: neutrale Farbe und der rohe Wert
                          der API — nicht auf ein bekanntes Label raten
                          (Wurzel 4), wie in konto-abo-section.tsx. */}
                      <span
                        className={`rounded-full px-3 py-0.5 text-xs font-semibold ${
                          st?.klasse ?? "bg-muted text-muted-foreground"
                        }`}
                      >
                        {st ? t(st.key) : r.status}
                      </span>
                    </td>
                  </tr>
                  {auf && (
                    <tr className="border-b border-border last:border-0">
                      <td colSpan={6} className="p-0">
                        <MonatsAufstellung period={r.period} />
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Die Spalte „Provision" zeigt jetzt den BERECHNETEN Betrag; wo der
          Deckel greift, steht die entstandene Summe darunter. Der allgemeine
          Hinweis ist damit nur noch dort nötig, wo der Deckel NICHT beziffert
          werden konnte (kein ECB-Kurs, gemischte Währungen) — dann fehlt die
          Angabe in der Zeile und der Leser braucht die Erklärung. Steht sie
          überall, wäre der Satz Rauschen. */}
      {rows && rows.some((r) => r.cap_amount === null) && (
        <p className="text-sm text-muted-foreground">
          {t("commissions.capHint")}
        </p>
      )}

      {rows && rows.some((r) => r.currency === null) && (
        <p className="text-sm text-muted-foreground">
          {t("commissions.mixedCurrencyHint")}
        </p>
      )}
    </div>
  );
}
