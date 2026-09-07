"use client";

// Reiter „Kontostand" — damit der Gastgeber die Auszahlung NACHVOLLZIEHEN kann.
//
// Das Geld einer Marktplatz-Buchung nimmt vier Stationen:
//   Gast zahlt an myBestDays → myBestDays verwahrt bis Abreise + Prüffrist →
//   Überweisung auf das Stripe-Konto des Gastgebers → Auszahlung auf die Bank.
// Vorher war davon nur der Rhythmus sichtbar. Hier stehen beide Töpfe
// nebeneinander: der Plattform-Ledger (was myBestDays je Buchung noch hält
// oder schon überwiesen hat) und das Stripe-Konto (was dort verfügbar oder
// noch in Abwicklung ist, und die letzten Überweisungen auf die Bank).
//
// Jede Buchung ist eine Zeile mit Objekt, Gast, Zeitraum, Brutto → Gebühr →
// Netto, Stand und Datum — nicht nur eine UUID und ein Betrag.
//
// Beträge tragen immer ihre eigene Währung (Wurzel 4); ein Saldo, der nicht
// abrufbar war, steht als Fehler da, nie als „0".
import { useTranslations } from "next-intl";

import { formatCurrency } from "@nextdays/currency";

import type {
  AuszahlungsUebersicht,
  AuszahlungsZeile,
  GuthabenErgebnis,
  StripeAuszahlung,
  StripeSaldoPosten,
} from "@/lib/auszahlungen";
import { useFormatierung } from "@/lib/formatierung";

import { GeldwegKarten } from "./geldweg-karten";

const STATUS: Record<string, { key: string; ton: string }> = {
  scheduled: { key: "azStatusScheduled", ton: "bg-muted text-muted-foreground" },
  due: { key: "azStatusDue", ton: "bg-sky-100 text-sky-800" },
  held: { key: "azStatusHeld", ton: "bg-amber-100 text-amber-800" },
  paid: { key: "azStatusPaid", ton: "bg-emerald-100 text-emerald-800" },
  withheld: { key: "azStatusWithheld", ton: "bg-muted text-muted-foreground" },
  failed: { key: "azStatusFailed", ton: "bg-rose-100 text-rose-800" },
};

export function KontostandTab({
  uebersicht,
  guthaben,
}: {
  uebersicht: AuszahlungsUebersicht | null;
  guthaben: GuthabenErgebnis | null;
}) {
  const t = useTranslations("konto");

  return (
    <div>
      <h2 className="font-display text-3xl font-semibold tracking-tight">
        {t("ksTitel")}
      </h2>
      <p className="mt-3 max-w-xl text-[0.9375rem] leading-relaxed text-muted-foreground">
        {t("ksEinleitung")}
      </p>

      {/* Der Weg des Geldes — vier Flip-Karten, damit die Zahlen unten einen
          Ort haben. */}
      <GeldwegKarten karenzTage={uebersicht?.settings.karenz_tage ?? 0} />

      {/* Plattform-Ledger: was myBestDays noch hält / schon überwiesen hat */}
      <section className="mt-10">
        <h3 className="font-medium">{t("ksLedgerTitel")}</h3>
        {!uebersicht ? (
          <p className="mt-2 text-[0.9375rem] text-muted-foreground">{t("ksNichtAbrufbar")}</p>
        ) : uebersicht.summary.length === 0 ? (
          <p className="mt-2 text-[0.9375rem] text-muted-foreground">{t("ksNochNichts")}</p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {uebersicht.summary.map((s) => (
              <div key={s.currency} className="rounded-2xl border border-border p-5">
                <p className="text-sm text-muted-foreground">{t("azSummeUnterwegs")}</p>
                <p className="font-display text-2xl font-semibold tabular-nums">
                  {formatCurrency(s.pending_amount_cents / 100, s.currency)}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("azSummeBisher", {
                    betrag: formatCurrency(s.paid_amount_cents / 100, s.currency),
                  })}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {t("ksBuchungenAnzahl", { anzahl: s.count })}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Stripe-Konto: was schon beim Gastgeber angekommen ist */}
      <section className="mt-10">
        <h3 className="font-medium">{t("ksStripeTitel")}</h3>
        {!guthaben ? null : !guthaben.ok ? (
          <p className="mt-2 rounded-2xl bg-rose-50 p-4 text-[0.9375rem] text-rose-900">
            {guthaben.fehler}
          </p>
        ) : !guthaben.data.konto_verbunden ? (
          <p className="mt-2 text-[0.9375rem] text-muted-foreground">{t("ksKeinKonto")}</p>
        ) : (
          <>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Saldo titel={t("ksVerfuegbar")} posten={guthaben.data.auszahlbar} leer={t("ksNull")} />
              <Saldo titel={t("ksAusstehend")} posten={guthaben.data.ausstehend} leer={t("ksNull")} />
              <Saldo
                titel={t("ksEinlage")}
                posten={guthaben.data.einlage}
                leer={t("ksNull")}
                hinweis={
                  guthaben.data.einlage_frei_ab
                    ? t("ksEinlageFreiAb", { datum: guthaben.data.einlage_frei_ab })
                    : undefined
                }
              />
            </div>
            {guthaben.data.letzte_auszahlungen.length > 0 && (
              <LetzteAuszahlungen auszahlungen={guthaben.data.letzte_auszahlungen} />
            )}
          </>
        )}
      </section>

      {/* Buchungen: je Zeile der komplette Weg */}
      <section className="mt-10 border-t border-border pt-8">
        <h3 className="font-display text-xl font-semibold tracking-tight">
          {t("ksBuchungenTitel")}
        </h3>
        {!uebersicht ? (
          <p className="mt-2 text-[0.9375rem] text-muted-foreground">{t("ksNichtAbrufbar")}</p>
        ) : uebersicht.recent.length === 0 ? (
          <p className="mt-2 text-[0.9375rem] text-muted-foreground">{t("ksNochNichts")}</p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {uebersicht.recent.map((z) => (
              <Buchung key={z.id} zeile={z} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Saldo({
  titel,
  posten,
  leer,
  hinweis,
}: {
  titel: string;
  posten: StripeSaldoPosten[];
  leer: string;
  hinweis?: string;
}) {
  return (
    <div className="rounded-2xl border border-border p-5">
      <p className="text-sm text-muted-foreground">{titel}</p>
      {posten.length === 0 ? (
        <p className="font-display text-2xl font-semibold tabular-nums">{leer}</p>
      ) : (
        posten.map((p) => (
          <p key={p.currency} className="font-display text-2xl font-semibold tabular-nums">
            {formatCurrency(p.amount_cents / 100, p.currency)}
          </p>
        ))
      )}
      {hinweis && <p className="mt-2 text-sm text-muted-foreground">{hinweis}</p>}
    </div>
  );
}

function LetzteAuszahlungen({
  auszahlungen,
}: {
  auszahlungen: StripeAuszahlung[];
}) {
  const t = useTranslations("konto");
  const f = useFormatierung();
  return (
    <div className="mt-4">
      <p className="text-sm font-medium">{t("ksBankTitel")}</p>
      <ul className="mt-2 divide-y divide-border">
        {auszahlungen.map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-4 py-3 text-sm">
            <div>
              <p>
                {a.created ? f.datum(a.created, { day: "2-digit", month: "long", year: "numeric" }) : "—"}
                {a.arrival_date && (
                  <span className="text-muted-foreground">
                    {" · "}
                    {t("ksAnkunft", {
                      datum: f.datum(a.arrival_date, { day: "2-digit", month: "short" }),
                    })}
                  </span>
                )}
              </p>
              {a.failure_message && (
                <p className="mt-0.5 text-rose-700">{a.failure_message}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {/* Roher Stripe-Status: unbekannte Werte nicht verschlucken. */}
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">{a.status}</span>
              <span className="font-medium tabular-nums">
                {formatCurrency(a.amount_cents / 100, a.currency)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Buchung({ zeile: z }: { zeile: AuszahlungsZeile }) {
  const t = useTranslations("konto");
  const f = useFormatierung();
  const direkt = z.charge_modell === "destination" && z.status !== "paid";
  const eintrag = STATUS[z.status];
  const statusText = direkt ? t("azStatusDirekt") : eintrag ? t(eintrag.key) : z.status;
  const statusTon = direkt
    ? "bg-emerald-100 text-emerald-800"
    : (eintrag?.ton ?? "bg-muted text-muted-foreground");
  const kurz: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" };
  const zeitraum =
    z.check_in && z.check_out
      ? `${f.datum(z.check_in, kurz)} – ${f.datum(z.check_out, { ...kurz, year: "numeric" })}`
      : null;
  const kanal = z.ota_name || z.channel;
  const abzuege = z.platform_fee_cents + z.cohost_cents + z.donation_cents;

  return (
    <li className="py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-medium">
            {z.property_title ?? t("ksObjektUnbekannt")}
            {z.guest_name && (
              <span className="font-normal text-muted-foreground"> · {z.guest_name}</span>
            )}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {zeitraum ?? t("nichtAngegeben")}
            {kanal && <> · {kanal}</>}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusTon}`}>
            {statusText}
          </span>
          <span className="font-medium tabular-nums">
            {formatCurrency(z.net_amount_cents / 100, z.currency)}
          </span>
        </div>
      </div>
      {/* Rechenweg sichtbar: Brutto − Abzüge = Netto, plus der Termin. */}
      <p className="mt-2 text-sm text-muted-foreground tabular-nums">
        {t("ksRechenweg", {
          brutto: formatCurrency(z.gross_amount_cents / 100, z.currency),
          abzuege: formatCurrency(abzuege / 100, z.currency),
          netto: formatCurrency(z.net_amount_cents / 100, z.currency),
        })}
        {" · "}
        {z.paid_at
          ? t("ksAusgezahltAm", {
              datum: f.datum(z.paid_at, { day: "2-digit", month: "long", year: "numeric" }),
            })
          : direkt
            ? t("azStatusDirekt")
            : t("ksFaelligAm", {
                datum: f.datum(z.due_at, { day: "2-digit", month: "long", year: "numeric" }),
              })}
      </p>
    </li>
  );
}
