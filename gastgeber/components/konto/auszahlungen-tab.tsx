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

/** Rohe Stripe-Feldpfade in verständliche Angaben übersetzen. */
const FELD_TEXTE: { passt: (r: string) => boolean; label: string }[] = [
  { passt: (r) => r.includes("external_account"), label: "Bankverbindung (IBAN)" },
  { passt: (r) => r.includes("dob"), label: "Geburtsdatum" },
  { passt: (r) => r.includes("address"), label: "Adresse" },
  { passt: (r) => r.includes("first_name") || r.includes("last_name"), label: "Name" },
  { passt: (r) => r.includes("email"), label: "E-Mail-Adresse" },
  { passt: (r) => r.includes("phone"), label: "Telefonnummer" },
  { passt: (r) => r.includes("verification.document"), label: "Ausweisdokument" },
  { passt: (r) => r.includes("business_profile.url"), label: "Website" },
  { passt: (r) => r.includes("registration_number") || r.includes("tax_id"), label: "Handelsregisternummer" },
  { passt: (r) => r.includes("company.name"), label: "Firmenname" },
];

function lesbareAngaben(offen: string[]): string[] {
  const gesehen = new Set<string>();
  for (const r of offen) {
    // Die Zustimmung holen wir über den Knopf — nicht als „fehlende Angabe".
    if (r.includes("tos_acceptance")) continue;
    const treffer = FELD_TEXTE.find((f) => f.passt(r));
    if (treffer) gesehen.add(treffer.label);
  }
  return [...gesehen];
}

const RHYTHMEN: { key: PayoutInterval; label: string; hinweis: string }[] = [
  { key: "daily", label: "Täglich", hinweis: "Einen Tag nach der Abreise" },
  { key: "weekly", label: "Wöchentlich", hinweis: "Donnerstags, für Abreisen Do–Mi" },
  { key: "monthly", label: "Monatlich", hinweis: "Bis zum 15. des Folgemonats" },
];

const POSTEN_TEXTE: Record<string, string> = {
  refund: "Erstattung an den Gast",
  chargeback: "Rückbuchung",
  cancellation_fee: "Stornogebühr",
  correction: "Korrektur",
};

const STATUS_TEXTE: Record<string, { text: string; ton: string }> = {
  scheduled: { text: "Geplant", ton: "bg-muted text-muted-foreground" },
  due: { text: "Fällig", ton: "bg-sky-100 text-sky-800" },
  held: { text: "In Prüfung", ton: "bg-amber-100 text-amber-800" },
  paid: { text: "Ausgezahlt", ton: "bg-emerald-100 text-emerald-800" },
  withheld: { text: "Einbehalten", ton: "bg-muted text-muted-foreground" },
  failed: { text: "Fehlgeschlagen", ton: "bg-rose-100 text-rose-800" },
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
  const router = useRouter();
  const [laeuft, setLaeuft] = useState(false);

  // Realtime-Pflicht: Auszahlungen entstehen serverseitig (Worker), der
  // Kontostatus über den Webhook. Ohne Abo bliebe die Ansicht stehen.
  useRealtime({ table: "payouts", onChange: () => router.refresh() });
  useRealtime({ table: "payout_adjustments", onChange: () => router.refresh() });

  const bereit = !!kontoStatus?.payouts_enabled;
  const fehlend = kontoStatus ? lesbareAngaben(kontoStatus.requirements) : [];

  async function aktivieren() {
    if (!kontoId) return;
    setLaeuft(true);
    const res = await aktiviereAuszahlungen(kontoId);
    setLaeuft(false);
    if (res.ok) toast.success("Auszahlungen aktiviert.");
    else toast.error(res.fehler);
  }

  async function rhythmusWaehlen(interval: PayoutInterval) {
    const res = await setzeAuszahlungsRhythmus(interval);
    if (res.ok) toast.success("Rhythmus gespeichert.");
    else toast.error(res.fehler);
  }

  return (
    <div>
      <h2 className="font-display text-3xl font-semibold tracking-tight">
        So wirst du bezahlt
      </h2>
      <p className="mt-3 max-w-xl text-[0.9375rem] leading-relaxed text-muted-foreground">
        Deine Einnahmen werden nach der Abreise deiner Gäste ausgezahlt. Bis
        dahin verwahren wir das Geld — so lassen sich Rückfragen klären, bevor
        etwas fließt.
      </p>

      {/* Zustand des Auszahlungskontos */}
      <div className="mt-8 rounded-2xl border border-border p-5">
        {!kontoId ? (
          <>
            <p className="font-medium">Auszahlungskonto noch nicht angelegt</p>
            <p className="mt-1 text-[0.9375rem] text-muted-foreground">
              Speichere zuerst deine Stammdaten mit Land und E-Mail-Adresse.
              Dein Auszahlungskonto entsteht daraus automatisch — du musst
              nichts doppelt eintragen.
            </p>
          </>
        ) : bereit ? (
          <div className="flex items-start gap-3">
            <Icon
              icon="solar:check-circle-bold"
              className="mt-0.5 size-5 shrink-0 text-emerald-600"
            />
            <div>
              <p className="font-medium">Auszahlungen aktiv</p>
              <p className="mt-1 text-[0.9375rem] text-muted-foreground">
                Buchungen über myNextDays werden nach der Abreise überwiesen.
              </p>
            </div>
          </div>
        ) : (
          <>
            <p className="font-medium">Noch nicht abrechnungsfähig</p>
            {fehlend.length > 0 && (
              <>
                <p className="mt-1 text-[0.9375rem] text-muted-foreground">
                  Diese Angaben fehlen noch:
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
                  Du trägst sie in deinen Stammdaten ein.
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
                {laeuft ? "Wird aktiviert …" : "Auszahlungen aktivieren"}
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
      toast.success("Bankverbindung gespeichert.");
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
          <p className="font-medium">Bankverbindung</p>
          <p className="mt-0.5 text-[0.9375rem] text-muted-foreground">
            {hinterlegt
              ? "Hinterlegt — deine Auszahlungen gehen auf dieses Konto."
              : fehltNoch
                ? "Noch keine Bankverbindung hinterlegt."
                : "Wird geprüft."}
          </p>
        </div>
        {!landFehlt && (
          <button
            type="button"
            onClick={() => setOffen(!offen)}
            className="shrink-0 text-[0.9375rem] font-medium underline underline-offset-4 outline-none hover:opacity-70 focus-visible:ring-2 focus-visible:ring-foreground/20"
          >
            {offen ? "Abbrechen" : hinterlegt ? "Ändern" : "Hinzufügen"}
          </button>
        )}
      </div>

      {landFehlt && (
        <p className="mt-3 text-[0.9375rem] text-muted-foreground">
          Trage zuerst das Land deines Unternehmens ein — daraus ergibt sich die
          Währung deiner Auszahlungen.
        </p>
      )}

      {offen && !landFehlt && (
        <div className="mt-5 space-y-4">
          <div>
            <label htmlFor="bank-inhaber" className="block text-sm text-muted-foreground">
              Kontoinhaber
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
              Muss genau so lauten wie bei deiner Bank hinterlegt.
            </p>
          </div>

          <div>
            <label htmlFor="bank-iban" className="block text-sm text-muted-foreground">
              IBAN
            </label>
            <input
              id="bank-iban"
              type="text"
              inputMode="text"
              value={iban}
              onChange={(e) => setIban(e.target.value.toUpperCase())}
              placeholder={`${land} …`}
              autoComplete="off"
              spellCheck={false}
              className="mt-1.5 w-full rounded-xl border border-border bg-background px-4 py-3 font-mono outline-none focus-visible:border-foreground"
            />
            <p className="mt-1.5 text-sm text-muted-foreground">
              Einen BIC brauchen wir nicht — er steckt bereits in der IBAN.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void speichern()}
            disabled={!bereit || laeuft}
            className="rounded-full bg-foreground px-7 py-3 text-sm font-medium text-background outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-foreground/20 disabled:opacity-40"
          >
            {laeuft ? "Wird gespeichert …" : "Bankverbindung speichern"}
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
  return (
    <section className="mt-10">
      <h3 className="font-medium">Wie oft möchtest du ausgezahlt werden?</h3>
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
              <span className="block font-semibold">{r.label}</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">
                {r.hinweis}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Summen({ uebersicht }: { uebersicht: AuszahlungsUebersicht }) {
  if (!uebersicht.summary.length) return null;
  return (
    <section className="mt-10 flex flex-wrap gap-10 border-t border-border pt-8">
      {uebersicht.summary.map((s) => (
        <div key={s.currency}>
          <p className="text-sm text-muted-foreground">Unterwegs zu dir</p>
          <p className="font-display text-2xl font-semibold tabular-nums">
            {formatCurrency(s.pending_amount_cents / 100, s.currency)}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Bisher ausgezahlt:{" "}
            {formatCurrency(s.paid_amount_cents / 100, s.currency)}
          </p>
        </div>
      ))}
    </section>
  );
}

/** Verrechnungsposten offen ausweisen — nie stillschweigend abziehen. */
function Posten({ posten }: { posten: Verrechnungsposten[] }) {
  const offen = posten.filter((p) => p.settled_cents < p.amount_cents);
  if (!offen.length) return null;

  return (
    <section className="mt-10 rounded-2xl bg-amber-50 p-5">
      <h3 className="font-medium text-amber-900">
        Wird mit der nächsten Auszahlung verrechnet
      </h3>
      <ul className="mt-3 space-y-2">
        {offen.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between gap-4 text-[0.9375rem] text-amber-900"
          >
            <span>{POSTEN_TEXTE[p.kind] ?? p.kind}</span>
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
  if (!zeilen.length) return null;

  return (
    <section className="mt-10 border-t border-border pt-8">
      <h3 className="font-display text-xl font-semibold tracking-tight">
        Auszahlungen
      </h3>
      <ul className="mt-4 divide-y divide-border">
        {zeilen.map((z) => {
          const status = STATUS_TEXTE[z.status] ?? {
            text: z.status,
            ton: "bg-muted text-muted-foreground",
          };
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
                  {formatCurrency(z.gross_amount_cents / 100, z.currency)} Umsatz
                  {z.platform_fee_cents > 0 && (
                    <>
                      {" · "}−
                      {formatCurrency(z.platform_fee_cents / 100, z.currency)}{" "}
                      Gebühr
                    </>
                  )}
                  {z.cohost_cents > 0 && (
                    <>
                      {" · "}−
                      {formatCurrency(z.cohost_cents / 100, z.currency)}{" "}
                      Co-Gastgeber
                    </>
                  )}
                  {z.donation_cents > 0 && (
                    <>
                      {" · "}−
                      {formatCurrency(z.donation_cents / 100, z.currency)} Spende
                    </>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${status.ton}`}
                >
                  {status.text}
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
