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
import { useFormatter, useLocale, useTranslations } from "next-intl";

import { StripeCheckout } from "@/components/stripe-checkout";
import { type Angebot, bucheGast } from "@/lib/buchung";
import { formatCurrency } from "@/lib/listings";

type Zustand =
  | { kind: "eingabe" }
  | { kind: "bucht" }
  | { kind: "fehler"; msg: string }
  | {
      kind: "bezahlen";
      reservationId: string;
      // Seit 0409 liefert der Buchungsaufruf die Zahlungsdaten gleich mit —
      // eine Reservierung, gegen die man den Intent nachladen könnte, gibt es
      // an dieser Stelle noch gar nicht.
      clientSecret?: string | null;
      publishableKey?: string | null;
    }
  | { kind: "fertig"; email: string };

export type CheckoutDaten = {
  propertyId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  pets: number;
  promoCode?: string;
  /** Zugewählte optionale Gebühren — dieselben IDs wie im Angebot. */
  fees?: string[];
};

/** Was am Kontakt-Schritt noch fehlt - `null`, wenn nichts fehlt.
 *
 *  Als reine Funktion und nicht als Kette im Ablauf: dieselbe Regel entscheidet
 *  den Weiter-Knopf UND die Pruefung vor dem Absenden. Zweimal ausgeschrieben
 *  waere eine von beiden irgendwann falsch - und der Gast saehe einen aktiven
 *  Knopf, der ihn in einen Serverfehler laufen laesst. */
function fehlenderSchritt(
  vorname: string,
  nachname: string,
  email: string,
  frage: string | null,
  antwort: string,
): "fehlerKontakt" | "fehlerVorabAntwort" | null {
  if (!vorname.trim() || !nachname.trim() || !email.trim()) {
    return "fehlerKontakt";
  }
  // Ohne Frage gibt es nichts zu beantworten.
  if (frage && !antwort.trim()) return "fehlerVorabAntwort";
  return null;
}

/** Die „Nachricht vor der Buchung" des Gastgebers samt Antwortfeld.
 *
 *  Eigene Komponente und kein Block im Ablauf: der Checkout trägt bereits drei
 *  Schritte, eine Ratenlogik und den Zahlungszustand. Jede weitere Verzweigung
 *  darin macht ihn schwerer lesbar, ohne dass sie mit den anderen etwas zu tun
 *  hätte. Ohne Frage rendert sie nichts. */
function VorabFrage({
  frage,
  wert,
  onChange,
}: {
  frage: string | null;
  wert: string;
  onChange: (wert: string) => void;
}) {
  const t = useTranslations("checkout");
  if (!frage) return null;

  return (
    <div className="mt-5 rounded-2xl border border-border p-4">
      <label htmlFor="vorab-antwort" className="block text-sm font-medium">
        {t("vorabTitel")}
      </label>
      {/* Im Wortlaut des Gastgebers — nicht zusammengefasst, nicht ersetzt. */}
      <p className="mt-1 whitespace-pre-line text-[0.9375rem]">{frage}</p>
      <textarea
        id="vorab-antwort"
        value={wert}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        maxLength={2000}
        required
        className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2 text-[0.9375rem] outline-none focus:border-foreground"
        placeholder={t("vorabPlatzhalter")}
      />
    </div>
  );
}

export function CheckoutAblauf({
  daten,
  angebot,
}: {
  daten: CheckoutDaten;
  angebot: Angebot;
}) {
  const t = useTranslations("checkout");
  const format = useFormatter();
  // Dieselbe Sprache wie im angezeigten Angebot: die Posten wandern in die
  // Reservierung und stehen später auf der Rechnung des Gastes.
  const locale = useLocale();
  const [schritt, setSchritt] = useState(1);
  const [vorname, setVorname] = useState("");
  const [nachname, setNachname] = useState("");
  const [email, setEmail] = useState("");
  const [telefon, setTelefon] = useState("");
  // Antwort auf die „Nachricht vor der Buchung" des Gastgebers (Airbnb).
  // Steht im Angebot keine Frage, gibt es dieses Feld nicht.
  const [vorabAntwort, setVorabAntwort] = useState("");
  const [zustand, setZustand] = useState<Zustand>({ kind: "eingabe" });

  // Einmal abgeleitet statt an zwei Stellen ausgeschrieben: die Prüfung vor
  // dem Absenden und der Weiter-Knopf müssen dieselbe Regel verwenden, sonst
  // ist einer von beiden irgendwann falsch.
  const plan = angebot.payment_plan;
  const rate = plan != null && plan.due_later > 0;
  const waehrung = angebot.currency;
  // Stellt der Gastgeber eine Frage, ist ihre Beantwortung Voraussetzung für
  // die Sofortbuchung. Der Server lehnt sonst mit 422 ab — die Frage MUSS hier
  // also stehen, sonst liefe der Gast in einen Fehler ohne erkennbaren Grund.
  const frage = angebot.pre_booking_question;
  const fehlt = fehlenderSchritt(vorname, nachname, email, frage, vorabAntwort);

  // Schritt 1 entfällt, wenn es nichts zu entscheiden gibt: ohne Ratenzahlung ist
  // der ganze Betrag jetzt fällig. Dann startet der Ablauf direkt bei den
  // Kontaktdaten — ein Schritt mit genau einer Option ist eine Klick-Attrappe.
  const ersterSchritt = rate ? 1 : 2;
  const aktiv = Math.max(schritt, ersterSchritt);

  async function buchenUndBezahlen() {
    // Der Server prüft dasselbe (Wurzel 3) — hier nur, damit der Gast es
    // erfährt, bevor er auf „bezahlen" drückt, statt danach.
    if (fehlt) {
      setZustand({ kind: "fehler", msg: t(fehlt) });
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
      locale,
      fees: daten.fees,
      // Ohne Frage verwirft der Server die Antwort ohnehin — hier braucht es
      // dafür keine zweite Verzweigung.
      vorab_antwort: vorabAntwort.trim() || undefined,
    });
    if (!res.ok) {
      setZustand({ kind: "fehler", msg: res.error });
      return;
    }
    // `res.data.id` ist seit 0409 die BuchungsABSICHT, nicht die Reservierung:
    // Die Buchung entsteht erst, wenn Stripe die Zahlung bestätigt hat. Bis
    // dahin ist nichts reserviert — deshalb hier auch kein „gebucht"-Zustand.
    setZustand({
      kind: "bezahlen",
      reservationId: res.data.id,
      clientSecret: res.data.client_secret,
      publishableKey: res.data.publishable_key,
    });
  }

  if (zustand.kind === "fertig") {
    return (
      <div className="flex flex-col items-start gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/40 sm:p-6">
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

        <VorabFrage
          frage={frage}
          wert={vorabAntwort}
          onChange={setVorabAntwort}
        />

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => setSchritt(3)}
            disabled={fehlt !== null}
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
            clientSecret={zustand.clientSecret}
            publishableKey={zustand.publishableKey}
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
              className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-accent px-5 font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
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
        "rounded-2xl border p-4 sm:p-6 " +
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
        // text-base ist Pflicht: unter 16 px zoomt iOS Safari beim Fokus in das
        // Feld, danach sitzt die ganze Seite verschoben. Ab sm wieder 14 px.
        className="h-12 rounded-xl border border-border bg-background px-3 text-base outline-none focus:border-foreground sm:h-11 sm:text-sm"
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
