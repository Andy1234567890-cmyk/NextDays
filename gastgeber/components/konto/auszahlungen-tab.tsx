"use client";

// Reiter „Auszahlungen" (Airbnb-Vorbild: „How you'll get paid").
//
// Aufbau wie dort: Titel, Erklärung, dann der Zustand des Auszahlungskontos.
// Ist es noch nicht abrechnungsfähig, stehen die konkret fehlenden Angaben da —
// anklickbar, damit der Nutzer direkt zum Feld springt statt suchen zu müssen.
//
// Darunter der Rhythmus (Booking-Modell: täglich/wöchentlich/monatlich), die
// Summen und der Verlauf. Verrechnungsposten werden ausgewiesen, nicht
// versteckt — der Betrieb muss sehen, warum weniger ankommt.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { formatCurrency } from "@nextdays/currency";

import {
  aktiviereAuszahlungen,
  setzeAuszahlungsKonto,
  setzeAuszahlungsRhythmus,
} from "@/lib/auszahlung-actions";
import type {
  AuszahlungsUebersicht,
  AuszahlungsZeile,
  PayoutInterval,
  Verrechnungsposten,
} from "@/lib/auszahlungen";
import type { AuszahlungsStatus } from "@/lib/payments";
import { useRealtime } from "@/lib/use-realtime";

type Uebersetzer = ReturnType<typeof useTranslations<"konto">>;

/** Rohe Stripe-Feldpfade auf Textschlüssel abbilden. */
const FELD_SCHLUESSEL: { passt: (r: string) => boolean; key: string }[] = [
  { passt: (r) => r.includes("external_account"), key: "azFeldExternalAccount" },
  { passt: (r) => r.includes("dob"), key: "azFeldDob" },
  { passt: (r) => r.includes("address"), key: "azFeldAdresse" },
  { passt: (r) => r.includes("first_name") || r.includes("last_name"), key: "azFeldName" },
  { passt: (r) => r.includes("email"), key: "azFeldEmail" },
  { passt: (r) => r.includes("phone"), key: "azFeldTelefon" },
  { passt: (r) => r.includes("verification.document"), key: "azFeldAusweis" },
  { passt: (r) => r.includes("business_profile.url"), key: "azFeldWebsite" },
  { passt: (r) => r.includes("registration_number") || r.includes("tax_id"), key: "azFeldRegisternummer" },
  { passt: (r) => r.includes("company.name"), key: "azFeldFirmenname" },
];

function lesbareAngaben(offen: string[], t: Uebersetzer): string[] {
  const gesehen = new Set<string>();
  for (const r of offen) {
    // Die Zustimmung holen wir über den Knopf — nicht als „fehlende Angabe".
    if (r.includes("tos_acceptance")) continue;
    const treffer = FELD_SCHLUESSEL.find((f) => f.passt(r));
    if (treffer) gesehen.add(t(treffer.key));
  }
  return [...gesehen];
}

const RHYTHMEN: { key: PayoutInterval; label: string; hinweis: string }[] = [
  {
    key: "daily",
    label: "azRhythmusTaeglich",
    hinweis: "azRhythmusTaeglichHinweis",
  },
  {
    key: "weekly",
    label: "azRhythmusWoechentlich",
    hinweis: "azRhythmusWoechentlichHinweis",
  },
  {
    key: "monthly",
    label: "azRhythmusMonatlich",
    hinweis: "azRhythmusMonatlichHinweis",
  },
];

const POSTEN_SCHLUESSEL: Record<string, string> = {
  refund: "azPostenRefund",
  chargeback: "azPostenChargeback",
  cancellation_fee: "azPostenCancellationFee",
  correction: "azPostenCorrection",
};

const STATUS_SCHLUESSEL: Record<string, { key: string; ton: string }> = {
  scheduled: { key: "azStatusScheduled", ton: "bg-muted text-muted-foreground" },
  due: { key: "azStatusDue", ton: "bg-sky-100 text-sky-800" },
  held: { key: "azStatusHeld", ton: "bg-amber-100 text-amber-800" },
  paid: { key: "azStatusPaid", ton: "bg-emerald-100 text-emerald-800" },
  withheld: { key: "azStatusWithheld", ton: "bg-muted text-muted-foreground" },
  failed: { key: "azStatusFailed", ton: "bg-rose-100 text-rose-800" },
};

export function AuszahlungenTab({
  uebersicht,
  kontoStatus,
  kontoId,
  land,
  kontoinhaber,
}: {
  uebersicht: AuszahlungsUebersicht | null;
  /** Live-Status beim Zahlungsanbieter. Null, wenn kein Konto besteht. */
  kontoStatus: AuszahlungsStatus | null;
  kontoId: string | null;
  /** Land des Betriebs — bestimmt die Auszahlungswährung. Fehlt es, kann
   *  keine Bankverbindung hinterlegt werden (Wurzel 4: nichts raten). */
  land: string | null;
  /** Vorbelegung des Kontoinhabers aus den Stammdaten. */
  kontoinhaber: string;
}) {
  const t = useTranslations("konto");
  const router = useRouter();
  const [laeuft, setLaeuft] = useState(false);

  // Realtime-Pflicht: Auszahlungen entstehen serverseitig (Worker), der
  // Kontostatus über den Webhook. Ohne Abo bliebe die Ansicht stehen.
  useRealtime({ table: "payouts", onChange: () => router.refresh() });
  useRealtime({ table: "payout_adjustments", onChange: () => router.refresh() });

  const bereit = !!kontoStatus?.payouts_enabled;
  const fehlend = kontoStatus ? lesbareAngaben(kontoStatus.requirements, t) : [];

  async function aktivieren() {
    if (!kontoId) return;
    setLaeuft(true);
    const res = await aktiviereAuszahlungen(kontoId);
    setLaeuft(false);
    if (res.ok) toast.success(t("azAktiviert"));
    else toast.error(res.fehler);
  }

  async function rhythmusWaehlen(interval: PayoutInterval) {
    const res = await setzeAuszahlungsRhythmus(interval);
    if (res.ok) toast.success(t("azRhythmusGespeichert"));
    else toast.error(res.fehler);
  }

  return (
    <div>
      <h2 className="font-display text-3xl font-semibold tracking-tight">
        {t("azTitel")}
      </h2>
      <p className="mt-3 max-w-xl text-[0.9375rem] leading-relaxed text-muted-foreground">
        {t("azEinleitung")}
      </p>

      {/* Zustand des Auszahlungskontos */}
      <div className="mt-8 rounded-2xl border border-border p-5">
        {!kontoId ? (
          <>
            <p className="font-medium">{t("azKontoFehlt")}</p>
            <p className="mt-1 text-[0.9375rem] text-muted-foreground">
              {t("azKontoFehltText")}
            </p>
          </>
        ) : bereit ? (
          <div className="flex items-start gap-3">
            <Icon
              icon="solar:check-circle-bold"
              className="mt-0.5 size-5 shrink-0 text-emerald-600"
            />
            <div>
              <p className="font-medium">{t("azAktiv")}</p>
              <p className="mt-1 text-[0.9375rem] text-muted-foreground">
                {t("azAktivText")}
              </p>
            </div>
          </div>
        ) : (
          <>
            <p className="font-medium">{t("azNichtBereit")}</p>
            {fehlend.length > 0 && (
              <>
                <p className="mt-1 text-[0.9375rem] text-muted-foreground">
                  {t("azFehlendeAngaben")}
                </p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {fehlend.map((f) => (
                    <li
                      key={f}
                      className="rounded-full border border-border px-3 py-1 text-sm"
                    >
                      {f}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-sm text-muted-foreground">
                  {t("azFehlendeAngabenHinweis")}
                </p>
              </>
            )}
            {kontoStatus && !kontoStatus.details_submitted && (
              <button
                type="button"
                onClick={() => void aktivieren()}
                disabled={laeuft}
                className="mt-5 rounded-full bg-foreground px-8 py-3 font-medium text-background outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-foreground/20 disabled:opacity-40"
              >
                {laeuft ? t("azAktivierenLaeuft") : t("azAktivieren")}
              </button>
            )}
          </>
        )}
      </div>

      {kontoId && (
        <BankKarte
          kontoId={kontoId}
          land={land}
          kontoinhaber={kontoinhaber}
          hinterlegt={!!kontoStatus?.payouts_enabled}
          fehltNoch={
            kontoStatus?.requirements.some((r) =>
              r.includes("external_account"),
            ) ?? false
          }
        />
      )}

      {uebersicht && (
        <>
          <RhythmusWahl
            aktiv={uebersicht.settings.interval}
            gesperrt={uebersicht.settings.paused}
            onWahl={(i) => void rhythmusWaehlen(i)}
          />
          <Summen uebersicht={uebersicht} />
          <Posten posten={uebersicht.adjustments} />
          <Verlauf zeilen={uebersicht.recent} />
        </>
      )}
    </div>
  );
}

/**
 * Bankverbindung für die Auszahlung (Airbnb: „Auszahlungsmethode hinzufügen").
 *
 * Nur IBAN und Kontoinhaber. Einen BIC verlangt unser Zahlungsdienst nicht —
 * die Bankkennung steckt bereits in der IBAN, ein zusätzliches Feld wäre eine
 * Fehlerquelle ohne Nutzen.
 *
 * Die IBAN wird nach dem Speichern NIE wieder ausgeliefert; sichtbar bleiben
 * nur die letzten Stellen. Deshalb zeigt die Karte den Zustand, nicht den Wert.
 */
function BankKarte({
  kontoId,
  land,
  kontoinhaber,
  hinterlegt,
  fehltNoch,
}: {
  kontoId: string;
  land: string | null;
  kontoinhaber: string;
  hinterlegt: boolean;
  fehltNoch: boolean;
}) {
  const t = useTranslations("konto");
  const [offen, setOffen] = useState(false);
  const [iban, setIban] = useState("");
  const [inhaber, setInhaber] = useState(kontoinhaber);
  const [laeuft, setLaeuft] = useState(false);

  // Ohne Land keine Währung und damit keine Bankverbindung — nichts raten.
  const landFehlt = !land;

  async function speichern() {
    if (!land) return;
    setLaeuft(true);
    const res = await setzeAuszahlungsKonto(kontoId, iban, inhaber, land);
    setLaeuft(false);
    if (res.ok) {
      toast.success(t("azBankGespeichert"));
      setIban("");
      setOffen(false);
    } else {
      toast.error(res.fehler);
    }
  }

  const bereit = iban.replace(/\s+/g, "").length >= 15 && inhaber.trim().length > 1;

  return (
    <section className="mt-6 rounded-2xl border border-border p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-medium">{t("azBankTitel")}</p>
          <p className="mt-0.5 text-[0.9375rem] text-muted-foreground">
            {hinterlegt
              ? t("azBankHinterlegt")
              : fehltNoch
                ? t("azBankFehlt")
                : t("azBankPruefung")}
          </p>
        </div>
        {!landFehlt && (
          <button
            type="button"
            onClick={() => setOffen(!offen)}
            className="shrink-0 text-[0.9375rem] font-medium underline underline-offset-4 outline-none hover:opacity-70 focus-visible:ring-2 focus-visible:ring-foreground/20"
          >
            {offen
              ? t("azBankAbbrechen")
              : hinterlegt
                ? t("azBankAendern")
                : t("azBankHinzufuegen")}
          </button>
        )}
      </div>

      {landFehlt && (
        <p className="mt-3 text-[0.9375rem] text-muted-foreground">
          {t("azBankLandFehlt")}
        </p>
      )}

      {offen && !landFehlt && (
        <div className="mt-5 space-y-4">
          <div>
            <label htmlFor="bank-inhaber" className="block text-sm text-muted-foreground">
              {t("azBankInhaber")}
            </label>
            <input
              id="bank-inhaber"
              type="text"
              value={inhaber}
              onChange={(e) => setInhaber(e.target.value)}
              autoComplete="off"
              className="mt-1.5 w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus-visible:border-foreground"
            />
            <p className="mt-1.5 text-sm text-muted-foreground">
              {t("azBankInhaberHinweis")}
            </p>
          </div>

          <div>
            <label htmlFor="bank-iban" className="block text-sm text-muted-foreground">
              {t("azBankIban")}
            </label>
            <input
              id="bank-iban"
              type="text"
              inputMode="text"
              value={iban}
              onChange={(e) => setIban(e.target.value.toUpperCase())}
              placeholder={t("azBankIbanPlatzhalter", { land })}
              autoComplete="off"
              spellCheck={false}
              className="mt-1.5 w-full rounded-xl border border-border bg-background px-4 py-3 font-mono outline-none focus-visible:border-foreground"
            />
            <p className="mt-1.5 text-sm text-muted-foreground">
              {t("azBankIbanHinweis")}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void speichern()}
            disabled={!bereit || laeuft}
            className="rounded-full bg-foreground px-7 py-3 text-sm font-medium text-background outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-foreground/20 disabled:opacity-40"
          >
            {laeuft ? t("azBankSpeichernLaeuft") : t("azBankSpeichern")}
          </button>
        </div>
      )}
    </section>
  );
}

function RhythmusWahl({
  aktiv,
  gesperrt,
  onWahl,
}: {
  aktiv: PayoutInterval;
  gesperrt: boolean;
  onWahl: (i: PayoutInterval) => void;
}) {
  const t = useTranslations("konto");
  return (
    <section className="mt-10">
      <h3 className="font-medium">{t("azRhythmusTitel")}</h3>
      <div className="mt-4 space-y-3">
        {RHYTHMEN.map((r) => {
          const gewaehlt = aktiv === r.key;
          return (
            <button
              key={r.key}
              type="button"
              disabled={gesperrt}
              onClick={() => onWahl(r.key)}
              aria-pressed={gewaehlt}
              className={`block w-full rounded-2xl p-5 text-left outline-none transition-all focus-visible:ring-2 focus-visible:ring-foreground/20 disabled:opacity-40 ${
                gewaehlt
                  ? "border-2 border-foreground"
                  : "border border-border hover:shadow-md"
              }`}
            >
              <span className="block font-semibold">{t(r.label)}</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">
                {t(r.hinweis)}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Summen({ uebersicht }: { uebersicht: AuszahlungsUebersicht }) {
  const t = useTranslations("konto");
  if (!uebersicht.summary.length) return null;
  return (
    <section className="mt-10 flex flex-wrap gap-10 border-t border-border pt-8">
      {uebersicht.summary.map((s) => (
        <div key={s.currency}>
          <p className="text-sm text-muted-foreground">{t("azSummeUnterwegs")}</p>
          <p className="font-display text-2xl font-semibold tabular-nums">
            {formatCurrency(s.pending_amount_cents / 100, s.currency)}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("azSummeBisher", {
              betrag: formatCurrency(s.paid_amount_cents / 100, s.currency),
            })}
          </p>
        </div>
      ))}
    </section>
  );
}

/** Verrechnungsposten offen ausweisen — nie stillschweigend abziehen. */
function Posten({ posten }: { posten: Verrechnungsposten[] }) {
  const t = useTranslations("konto");
  const offen = posten.filter((p) => p.settled_cents < p.amount_cents);
  if (!offen.length) return null;

  return (
    <section className="mt-10 rounded-2xl bg-amber-50 p-5">
      <h3 className="font-medium text-amber-900">{t("azPostenTitel")}</h3>
      <ul className="mt-3 space-y-2">
        {offen.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between gap-4 text-[0.9375rem] text-amber-900"
          >
            {/* Unbekannte Art: der rohe Wert ist die Wahrheit, kein Ersatztext. */}
            <span>
              {POSTEN_SCHLUESSEL[p.kind] ? t(POSTEN_SCHLUESSEL[p.kind]) : p.kind}
            </span>
            <span className="font-medium tabular-nums">
              −
              {formatCurrency(
                (p.amount_cents - p.settled_cents) / 100,
                p.currency,
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Verlauf({ zeilen }: { zeilen: AuszahlungsZeile[] }) {
  const t = useTranslations("konto");
  if (!zeilen.length) return null;

  return (
    <section className="mt-10 border-t border-border pt-8">
      <h3 className="font-display text-xl font-semibold tracking-tight">
        {t("azVerlaufTitel")}
      </h3>
      <ul className="mt-4 divide-y divide-border">
        {zeilen.map((z) => {
          const eintrag = STATUS_SCHLUESSEL[z.status];
          // Unbekannter Status: den rohen Wert zeigen statt ihn zu erfinden.
          const statusText = eintrag ? t(eintrag.key) : z.status;
          const statusTon = eintrag?.ton ?? "bg-muted text-muted-foreground";
          const datum = z.paid_at ?? z.due_at;
          return (
            <li key={z.id} className="flex items-center justify-between gap-4 py-4">
              <div className="min-w-0">
                <p className="text-[0.9375rem]">
                  {new Date(datum).toLocaleDateString("de-DE", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {t("azVerlaufUmsatz", {
                    betrag: formatCurrency(
                      z.gross_amount_cents / 100,
                      z.currency,
                    ),
                  })}
                  {z.platform_fee_cents > 0 &&
                    t("azVerlaufGebuehr", {
                      betrag: formatCurrency(
                        z.platform_fee_cents / 100,
                        z.currency,
                      ),
                    })}
                  {z.cohost_cents > 0 &&
                    t("azVerlaufCohost", {
                      betrag: formatCurrency(z.cohost_cents / 100, z.currency),
                    })}
                  {z.donation_cents > 0 &&
                    t("azVerlaufSpende", {
                      betrag: formatCurrency(
                        z.donation_cents / 100,
                        z.currency,
                      ),
                    })}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${statusTon}`}
                >
                  {statusText}
                </span>
                <span className="font-medium tabular-nums">
                  {formatCurrency(z.net_amount_cents / 100, z.currency)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
