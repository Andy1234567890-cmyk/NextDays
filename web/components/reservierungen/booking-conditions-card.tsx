"use client";

// Buchungskonditionen + Zahlungsstand einer Buchung (Lodgify-Gleichzug:
// „Buchungskonditionen" + „Zahlungsanforderung"):
//   * Zahlungsrichtlinie — was ist wann fällig (aus der geltenden Kondition)
//   * Stornierungsrichtlinie — die Staffel, die dem Gast zugesagt wurde
//   * Kaution — Vorautorisierung/manuell, Betrag ausgerechnet
//   * Zahlungsplan + Transaktionen — geplante und vollzogene Zahlungen
//
// Die Zahlen kommen fertig aus `/reservations/{id}/conditions`; hier wird
// NICHTS nachgerechnet. Genau das ist der Punkt: der Gast-Checkout, der Einzug
// und diese Anzeige müssen dieselbe Rechnung zeigen — eine eigene Rechnung im
// Frontend wäre die zweite Wahrheit.
//
// Ohne gepflegte Kondition kommt der Plan leer zurück: dann steht hier „alles
// sofort fällig" statt eines erfundenen Plans (Wurzel 4). Ohne Finanzeinblick
// (§4.3) liefert der Endpunkt gar keine Zahlen — die Karte bleibt dann weg.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { Card } from "@nextdays/ui/card";
import { formatCurrency } from "@/lib/currency";
import {
  type ReservationConditions,
  getReservationConditions,
} from "@/lib/reservations";

export function BookingConditionsCard({
  reservationId,
  currency,
  // Wechselt, wenn sich die Buchung geändert hat (Check-out, Storno, Zahlung) —
  // dann werden Plan und Transaktionen neu geholt. Bewusst kein eigenes
  // Realtime-Abo auf `payments`: die Tabelle ist für Clients gesperrt
  // (CLAUDE.md Wurzel 6, Finanzen), ein Abo darauf wäre eine stumme Attrappe.
  reloadKey,
  geldKopf,
  geldFuss,
}: {
  reservationId: string;
  currency: string;
  reloadKey?: unknown;
  /** Inhalt ÜBER dem Zahlungsplan (der Zahlungsfortschritt der Buchung).
   *
   *  WARUM SLOTS UND KEINE EIGENEN KARTEN (25.08.2026): Die Buchungsansicht
   *  hatte vier Karten, die alle dasselbe Geld zeigten — „Zahlungen"
   *  (Fortschritt), „Zahlungsanforderung" (Plan + Transaktionen),
   *  „Zusatzleistungen" (Positionen) und „Nachberechnung". Dieselben 150,00 DKK
   *  standen dadurch dreimal auf der Seite, und beim Storno fiel es auf.
   *
   *  Zusammengelegt wird über Slots und nicht durch Verschieben der Blöcke, weil
   *  Plan und Transaktionen aus DIESEM einen Abruf kommen
   *  (`/reservations/{id}/conditions`). Ein zweites Rendern dieser Komponente
   *  neben dem Fortschritt hätte den Abruf verdoppelt — zwei Fetches, die
   *  kurzzeitig verschiedene Beträge zeigen können. Ein Datenstand, eine Karte.
   *
   *  Die Karte „Buchungskonditionen" (Richtlinien) bleibt getrennt: das ist
   *  Vertragstext, kein Geld. */
  geldKopf?: React.ReactNode;
  /** Inhalt UNTER den Transaktionen: Positionslisten mit Aktionen
   *  (Zusatzleistungen, Nachberechnung). Sie gehören unter das Journal, weil
   *  sie erklären, WOFÜR die Zeilen darüber stehen. */
  geldFuss?: React.ReactNode;
}) {
  const t = useTranslations("reservations");
  const locale = useLocale();
  const [data, setData] = useState<ReservationConditions | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await getReservationConditions(reservationId);
    if (res.ok) {
      setData(res.data);
      console.debug("[BookingConditions] geladen", {
        reservationId,
        transaktionen: res.data.transactions.length,
        kondition: res.data.condition_name,
      });
    } else {
      setError(res.error);
      console.debug("[BookingConditions] Laden fehlgeschlagen:", res.error);
    }
  }, [reservationId]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  if (error) {
    return (
      <Card className="p-5 text-sm text-destructive">{error}</Card>
    );
  }
  if (!data) return null;

  const waehrung = data.currency || currency;
  const geld = (v: number | null | undefined) =>
    v == null ? "—" : formatCurrency(v, waehrung);
  const datum = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  const zeitpunkt = (iso: string) =>
    new Date(iso).toLocaleString(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const hatPlan = data.due_now != null;
  const hatStorno = data.cancellation_mode != null;
  const hatKaution = data.deposit != null;
  const hatZahlungen = data.transactions.length > 0;

  // Ohne Betrags-Sichtbarkeit (§4.3) kommt die Antwort komplett leer — auch
  // ohne Währung. Dann gibt es hier nichts zu zeigen. Ist die Währung dagegen
  // gesetzt, gehört der Konditions-Block hin, selbst wenn der Betrieb keine
  // Kondition gepflegt hat: „gesamter Betrag sofort fällig" ist die geltende
  // Regel und beantwortet die Frage, statt sie offen zu lassen.
  if (!waehrung && !hatPlan && !hatStorno && !hatKaution && !hatZahlungen) {
    return null;
  }

  return (
    <>
      {(hatPlan || hatStorno || hatKaution || !!waehrung) && (
        <Card className="flex flex-col gap-4 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-lg font-bold">
              {t("bookingConditions.title")}
            </h2>
            {data.condition_name && (
              <span className="text-sm text-muted-foreground">
                {data.condition_name}
              </span>
            )}
          </div>

          {hatPlan ? (
            <Block title={t("bookingConditions.paymentPolicy")}>
              {data.installments <= 1 || !data.due_later ? (
                <p>
                  {t("bookingConditions.paymentFull", {
                    amount: geld(data.due_now),
                  })}
                </p>
              ) : (
                <p>
                  {t("bookingConditions.paymentSplit", {
                    now: geld(data.due_now),
                    later: geld(data.due_later),
                  })}
                  {data.balance_due_date
                    ? ` ${t("bookingConditions.balanceDue", {
                        date: datum(data.balance_due_date),
                      })}`
                    : ""}
                </p>
              )}
            </Block>
          ) : (
            // Keine Kondition gepflegt: das ist der dokumentierte
            // Ausgangszustand des Zahlungspfads, kein Datenloch.
            <Block title={t("bookingConditions.paymentPolicy")}>
              <p>{t("bookingConditions.noCondition")}</p>
            </Block>
          )}

          {hatStorno && (
            <Block title={t("bookingConditions.cancellationPolicy")}>
              <p>
                {t(`bookingConditions.mode.${data.cancellation_mode}`)}
              </p>
              {data.refund_rules.length > 0 && (
                <ul className="mt-1 flex flex-col gap-0.5">
                  {data.refund_rules.map((r, i) => (
                    <li key={i}>
                      {t("bookingConditions.refundRule", {
                        percent: r.refund_percent,
                        days: r.days_before_arrival,
                      })}
                    </li>
                  ))}
                </ul>
              )}
            </Block>
          )}

          {data.deposit && (
            <Block title={t("bookingConditions.deposit")}>
              <p>
                {t(
                  data.deposit.method === "preauth"
                    ? "bookingConditions.depositPreauth"
                    : "bookingConditions.depositManual",
                  {
                    amount: formatCurrency(
                      data.deposit.amount,
                      data.deposit.currency || waehrung,
                    ),
                  },
                )}
              </p>
              {(data.deposit.preauth_days_before_arrival != null ||
                data.deposit.release_days_after_departure != null) && (
                <p>
                  {data.deposit.preauth_days_before_arrival != null &&
                    t("bookingConditions.depositHold", {
                      days: data.deposit.preauth_days_before_arrival,
                    })}
                  {data.deposit.release_days_after_departure != null &&
                    ` ${t("bookingConditions.depositRelease", {
                      days: data.deposit.release_days_after_departure,
                    })}`}
                </p>
              )}
            </Block>
          )}
        </Card>
      )}

      {(hatPlan || hatZahlungen || !!waehrung || geldKopf || geldFuss) && (
        <Card className="flex flex-col gap-3 p-5">
          <h2 className="font-display text-lg font-bold">
            {t("bookingConditions.paymentRequest")}
          </h2>

          {geldKopf}

          {hatPlan && (
            <div className="flex flex-col gap-1 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("bookingConditions.plan")}
              </p>
              <Zeile
                label={t("bookingConditions.dueNow")}
                value={geld(data.due_now)}
              />
              {data.due_later ? (
                <Zeile
                  label={
                    data.balance_due_date
                      ? t("bookingConditions.dueLaterOn", {
                          date: datum(data.balance_due_date),
                        })
                      : t("bookingConditions.dueLater")
                  }
                  value={geld(data.due_later)}
                />
              ) : null}
            </div>
          )}

          {hatZahlungen ? (
            <div className="flex flex-col gap-1 text-sm">
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("bookingConditions.transactions")}
              </p>
              {data.transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 border-b py-1.5 last:border-0"
                >
                  <span className="flex flex-wrap items-baseline gap-2">
                    <span className="text-muted-foreground">
                      {tx.due_at
                        ? t("bookingConditions.txDue", {
                            date: zeitpunkt(tx.due_at),
                          })
                        : zeitpunkt(tx.at)}
                    </span>
                    <span>{t(`bookingConditions.txType.${tx.type}`)}</span>
                    {/* Farbe nach den ECHTEN Enum-Werten (payment_status:
                        pending/succeeded/failed/refunded/partially_refunded) —
                        ein erfundener Wert („paid") wäre still immer gelb. */}
                    <span
                      className={
                        "text-xs font-semibold " +
                        (tx.status === "succeeded"
                          ? "text-success"
                          : tx.status === "failed"
                            ? "text-destructive"
                            : "text-warning")
                      }
                    >
                      {t(`bookingConditions.txStatus.${tx.status}`)}
                    </span>
                  </span>
                  <span className="font-semibold tabular-nums">
                    {tx.amount == null
                      ? "—"
                      : formatCurrency(tx.amount, tx.currency || waehrung)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Icon icon="ph:receipt" className="size-4" />
              {t("bookingConditions.noTransactions")}
            </p>
          )}

          {geldFuss}
        </Card>
      )}
    </>
  );
}

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5 text-sm">
      <p className="font-semibold">{title}</p>
      <div className="text-muted-foreground">{children}</div>
    </div>
  );
}

function Zeile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}
