"use client";

// Die drei Schritte des Checkouts (linke Spalte) — Reihenfolge und Zuschnitt wie
// bei Airbnb, live abgelesen am 11.08.2026:
//   1. Wann zahlen?      (nur wenn der Betrieb eine Ratenzahlung anbietet)
//   2. Kontaktdaten
//   3. Prüfen und bezahlen
//
// Unterschied zu Airbnb, bewusst: KEIN „Später zahlen mit Klarna". Wir haben
// Stripe; welche Methoden im Payment Element erscheinen, entscheidet das
// Stripe-Konto des Betriebs. Eine Option anzubieten, die es hier nicht gibt,
// wäre eine Attrappe.
//
// Die Reservierung entsteht ERST in Schritt 3 (`bucheGast`) und wird unmittelbar
// danach bezahlt. Vorher wird nichts angelegt: ein Gast, der den Checkout
// verlässt, hinterlässt keine halbe Buchung im Kalender des Gastgebers.
import { Icon } from "@iconify/react";
import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { StripeCheckout } from "@/components/stripe-checkout";
import { type Angebot, bucheGast } from "@/lib/buchung";
import { formatCurrency } from "@/lib/listings";

type Zustand =
  | { kind: "eingabe" }
  | { kind: "bucht" }
  | { kind: "fehler"; msg: string }
  | { kind: "bezahlen"; reservationId: string }
  | { kind: "fertig"; email: string };

export type CheckoutDaten = {
  propertyId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  pets: number;
  promoCode?: string;
};

export function CheckoutAblauf({
  daten,
  angebot,
}: {
  daten: CheckoutDaten;
  angebot: Angebot;
}) {
  const t = useTranslations("checkout");
  const format = useFormatter();
  const [schritt, setSchritt] = useState(1);
  const [vorname, setVorname] = useState("");
  const [nachname, setNachname] = useState("");
  const [email, setEmail] = useState("");
  const [telefon, setTelefon] = useState("");
  const [zustand, setZustand] = useState<Zustand>({ kind: "eingabe" });

  const plan = angebot.payment_plan;
  const rate = plan != null && plan.due_later > 0;
  const waehrung = angebot.currency;

  // Schritt 1 entfällt, wenn es nichts zu entscheiden gibt: ohne Ratenzahlung ist
  // der ganze Betrag jetzt fällig. Dann startet der Ablauf direkt bei den
  // Kontaktdaten — ein Schritt mit genau einer Option ist eine Klick-Attrappe.
  const ersterSchritt = rate ? 1 : 2;
  const aktiv = Math.max(schritt, ersterSchritt);

  async function buchenUndBezahlen() {
    if (!vorname.trim() || !nachname.trim() || !email.trim()) {
      setZustand({ kind: "fehler", msg: t("fehlerKontakt") });
      return;
    }
    setZustand({ kind: "bucht" });
    const res = await bucheGast({
      property_id: daten.propertyId,
      check_in: daten.checkIn,
      check_out: daten.checkOut,
      contact: {
        first_name: vorname.trim(),
        last_name: nachname.trim(),
        email: email.trim(),
        phone: telefon.trim() || undefined,
      },
      // Der Server rechnet erneut; dieser Betrag ist die Zustimmung des Gastes
      // zu dem, was ihm angezeigt wurde.
      total_amount: angebot.total,
      guests: daten.guests,
      pets: daten.pets,
      promo_code: daten.promoCode,
    });
    if (!res.ok) {
      setZustand({ kind: "fehler", msg: res.error });
      return;
    }
    setZustand({ kind: "bezahlen", reservationId: res.data.id });
  }

  if (zustand.kind === "fertig") {
    return (
      <div className="flex flex-col items-start gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 p-6 dark:border-emerald-800 dark:bg-emerald-950/40">
        <Icon icon="ph:check-circle" className="size-8 text-emerald-700" />
        <h2 className="font-display text-xl font-semibold">
          {t("fertigTitel")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("fertigText", { email: zustand.email })}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Schritt 1 — Zahlungszeitpunkt, nur bei echter Ratenzahlung */}
      {rate && plan && (
        <Abschnitt
          nummer={1}
          titel={t("schritt1")}
          aktiv={aktiv === 1}
          erledigt={aktiv > 1}
        >
          <div className="flex flex-col">
            <div className="flex items-start justify-between gap-4 border-b border-border py-4">
              <span>
                <span className="block">
                  {t("anzahlungJetzt", {
                    betrag: formatCurrency(plan.due_now, waehrung),
                  })}
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  {plan.balance_due_date
                    ? t("restBis", {
                        betrag: formatCurrency(plan.due_later, waehrung),
                        datum: format.dateTime(
                          new Date(`${plan.balance_due_date}T00:00:00Z`),
                          { dateStyle: "long", timeZone: "UTC" },
                        ),
                      })
                    : t("restSpaeter", {
                        betrag: formatCurrency(plan.due_later, waehrung),
                      })}
                </span>
              </span>
              <Punkt aktiv />
            </div>
          </div>
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => setSchritt(2)}
              className="rounded-full bg-primary px-7 py-3 font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              {t("weiter")}
            </button>
          </div>
        </Abschnitt>
      )}

      {/* Schritt 2 — Kontaktdaten */}
      <Abschnitt
        nummer={2}
        titel={t("schritt2")}
        aktiv={aktiv === 2}
        erledigt={aktiv > 2}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Feld
            label={t("vorname")}
            wert={vorname}
            onChange={setVorname}
            autoComplete="given-name"
          />
          <Feld
            label={t("nachname")}
            wert={nachname}
            onChange={setNachname}
            autoComplete="family-name"
          />
          <Feld
            label={t("email")}
            wert={email}
            onChange={setEmail}
            typ="email"
            autoComplete="email"
          />
          <Feld
            label={t("telefon")}
            wert={telefon}
            onChange={setTelefon}
            typ="tel"
            autoComplete="tel"
            optional={t("optional")}
          />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {t("kontaktHinweis")}
        </p>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => setSchritt(3)}
            disabled={!vorname.trim() || !nachname.trim() || !email.trim()}
            className="rounded-full bg-primary px-7 py-3 font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {t("weiter")}
          </button>
        </div>
      </Abschnitt>

      {/* Schritt 3 — Prüfen und bezahlen */}
      <Abschnitt nummer={3} titel={t("schritt3")} aktiv={aktiv === 3}>
        {zustand.kind === "bezahlen" ? (
          <StripeCheckout
            reservationId={zustand.reservationId}
            depositHint={
              angebot.deposit
                ? t("kautionHinweis", {
                    betrag: formatCurrency(
                      angebot.deposit.amount,
                      angebot.deposit.currency || waehrung,
                    ),
                  })
                : null
            }
            onPaid={() => setZustand({ kind: "fertig", email })}
          />
        ) : (
          <>
            <div className="flex flex-col gap-2 text-sm">
              <Zeile label={t("name")} wert={`${vorname} ${nachname}`.trim()} />
              <Zeile label={t("email")} wert={email} />
              <Zeile
                label={t("jetztFaellig")}
                wert={formatCurrency(plan ? plan.due_now : angebot.total, waehrung)}
              />
            </div>
            {zustand.kind === "fehler" && (
              <p className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {zustand.msg}
              </p>
            )}
            <button
              type="button"
              onClick={buchenUndBezahlen}
              disabled={zustand.kind === "bucht"}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-accent px-7 py-3 font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {zustand.kind === "bucht" ? (
                <Icon icon="ph:spinner" className="size-5 animate-spin" />
              ) : (
                <Icon icon="ph:lock-simple" className="size-5" />
              )}
              {t("bestaetigenUndBezahlen")}
            </button>
          </>
        )}
      </Abschnitt>
    </div>
  );
}

function Abschnitt({
  nummer,
  titel,
  aktiv,
  erledigt = false,
  children,
}: {
  nummer: number;
  titel: string;
  aktiv: boolean;
  erledigt?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={
        "rounded-2xl border p-6 " +
        (aktiv ? "border-border shadow-sm" : "border-border")
      }
    >
      <h2
        className={
          "flex items-center gap-2 font-display text-lg font-semibold " +
          (aktiv ? "" : "text-muted-foreground")
        }
      >
        {erledigt && (
          <Icon icon="ph:check-circle-fill" className="size-5 text-emerald-600" />
        )}
        {nummer}. {titel}
      </h2>
      {aktiv && <div className="mt-4">{children}</div>}
    </section>
  );
}

function Punkt({ aktiv }: { aktiv: boolean }) {
  return (
    <span
      className={
        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 " +
        (aktiv ? "border-primary" : "border-muted-foreground/50")
      }
    >
      {aktiv && <span className="size-2.5 rounded-full bg-primary" />}
    </span>
  );
}

function Feld({
  label,
  wert,
  onChange,
  typ = "text",
  autoComplete,
  optional,
}: {
  label: string;
  wert: string;
  onChange: (v: string) => void;
  typ?: "text" | "email" | "tel";
  autoComplete?: string;
  optional?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">
        {label}
        {optional ? ` · ${optional}` : ""}
      </span>
      <input
        type={typ}
        value={wert}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-foreground"
      />
    </label>
  );
}

function Zeile({ label, wert }: { label: string; wert: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{wert || "—"}</span>
    </div>
  );
}
