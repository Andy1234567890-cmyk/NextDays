"use client";

// Reiter „Spenden" (Airbnb-Vorbild: /account-settings/payments/donations).
//
// Aufbau exakt wie dort: oben ein Hinweis, solange kein Auszahlungskonto
// verbunden ist, darunter Titel + Erklärung, dann die Prozent-Pillen
// (1 % / 3 % / 5 % / Anderer) und ein Speichern-Knopf.
//
// Die Beispielrechnung nutzt Airbnbs eigene Zahl (3 % von 250 = 7,50) — eine
// konkrete Summe erklärt den Mechanismus besser als jeder Fließtext.
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { formatCurrency } from "@nextdays/currency";

import { setzeSpendenAnteil } from "@/lib/spenden-actions";
import type { SpendenUebersicht } from "@/lib/spenden";
import { useRealtime } from "@/lib/use-realtime";

/** Vorgaben wie bei Airbnb. */
const PILLEN = [100, 300, 500] as const;

/** Beispielbetrag der Erklärung (250 in der Währung des Betriebs). */
const BEISPIEL = 250;

export function SpendenTab({
  uebersicht,
  waehrung,
}: {
  uebersicht: SpendenUebersicht;
  /** Währung des Betriebs. Fehlt sie, rendert formatCurrency symbollos. */
  waehrung: string | null;
}) {
  const { settings, recipients } = uebersicht;
  const gesperrt = !settings.payouts_ready;

  const [bps, setBps] = useState(settings.share_bps);
  const [eigenerWert, setEigenerWert] = useState(
    settings.share_bps && !PILLEN.includes(settings.share_bps as 100)
      ? String(settings.share_bps / 100)
      : "",
  );
  const [eigenerAktiv, setEigenerAktiv] = useState(
    settings.share_bps > 0 && !PILLEN.includes(settings.share_bps as 100),
  );
  const [empfaenger, setEmpfaenger] = useState(
    settings.recipient_id ?? recipients[0]?.id ?? null,
  );
  const [laeuft, setLaeuft] = useState(false);
  const router = useRouter();

  // Realtime-Pflicht: Neue Spendenzeilen entstehen serverseitig beim Bezahlen
  // einer Buchung — ohne Abo bliebe die Übersicht stehen, bis der Nutzer neu
  // lädt. Die Einstellung kann sich zudem in einem zweiten Tab ändern.
  useRealtime({ table: "donations", onChange: () => router.refresh() });
  useRealtime({
    table: "tenant_donation_settings",
    onChange: () => router.refresh(),
  });

  const geaendert = bps !== settings.share_bps;
  const ueberGrenze = bps > settings.max_share_bps;
  const kannSpeichern =
    !gesperrt && geaendert && !ueberGrenze && (bps === 0 || !!empfaenger);

  function waehlePille(wert: number) {
    setEigenerAktiv(false);
    setEigenerWert("");
    setBps(bps === wert ? 0 : wert);
  }

  function eigenerEingabe(text: string) {
    setEigenerWert(text);
    const zahl = Number(text.replace(",", "."));
    setBps(Number.isFinite(zahl) && zahl > 0 ? Math.round(zahl * 100) : 0);
  }

  async function speichern() {
    setLaeuft(true);
    // Zustimmung ist implizit mit dem Speichern eines Satzes > 0 gegeben —
    // der Hinweis darauf steht direkt über dem Knopf, wie bei Airbnb.
    const res = await setzeSpendenAnteil(bps, empfaenger, bps > 0);
    setLaeuft(false);
    if (res.ok) {
      toast.success(
        bps > 0 ? "Spendenanteil gespeichert." : "Spende beendet.",
      );
    } else {
      toast.error(res.fehler);
    }
  }

  const beispielSpende = (BEISPIEL * bps) / 10000;

  return (
    <div>
      {/* Sperrhinweis — bei Airbnb der blaue Kasten ganz oben. */}
      {gesperrt && (
        <div className="mb-8 flex gap-4 rounded-2xl border border-border p-5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700">
            <Icon icon="solar:bell-bold" className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="font-medium">Auszahlungskonto hinzufügen</p>
            <p className="mt-0.5 text-[0.9375rem] text-muted-foreground">
              Bevor du spendest, richte ein, wie du bezahlt werden möchtest.
            </p>
            <a
              href="/konto?bereich=zahlungen&tab=auszahlungen"
              className="mt-2 inline-block text-[0.9375rem] font-medium underline underline-offset-4"
            >
              Auszahlungen ansehen
            </a>
          </div>
        </div>
      )}

      <h2 className="font-display text-3xl font-semibold tracking-tight">
        An {recipients[0]?.name ?? "gemeinnützige Organisationen"} spenden
      </h2>
      <p className="mt-3 max-w-xl text-[0.9375rem] leading-relaxed text-muted-foreground">
        {recipients[0]?.description ??
          "Gib einen Teil jeder Auszahlung weiter."}{" "}
        Der Anteil geht von deiner Auszahlung ab — die Plattform-Gebühr bleibt
        davon unberührt.
      </p>

      <h3 className="mt-8 font-medium">Anteil wählen</h3>
      <p className="mt-1 text-[0.9375rem] text-muted-foreground">
        Beispiel: {formatCurrency((BEISPIEL * 300) / 10000, waehrung)} bei einer
        Auszahlung von {formatCurrency(BEISPIEL, waehrung)} entsprechen 3 %.
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        {PILLEN.map((wert) => {
          const aktiv = !eigenerAktiv && bps === wert;
          return (
            <button
              key={wert}
              type="button"
              disabled={gesperrt}
              onClick={() => waehlePille(wert)}
              aria-pressed={aktiv}
              className={`rounded-full border px-7 py-3 text-[0.9375rem] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 disabled:cursor-not-allowed disabled:opacity-40 ${
                aktiv
                  ? "border-foreground bg-foreground text-background"
                  : "border-border hover:border-foreground"
              }`}
            >
              {wert / 100} %
            </button>
          );
        })}
        <button
          type="button"
          disabled={gesperrt}
          onClick={() => {
            setEigenerAktiv(true);
            setBps(0);
          }}
          aria-pressed={eigenerAktiv}
          className={`rounded-full border px-7 py-3 text-[0.9375rem] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 disabled:cursor-not-allowed disabled:opacity-40 ${
            eigenerAktiv
              ? "border-foreground bg-foreground text-background"
              : "border-border hover:border-foreground"
          }`}
        >
          Anderer
        </button>
      </div>

      {eigenerAktiv && (
        <div className="mt-4 flex items-center gap-3">
          <input
            type="number"
            inputMode="decimal"
            min="0"
            max={settings.max_share_bps / 100}
            step="0.5"
            value={eigenerWert}
            onChange={(e) => eigenerEingabe(e.target.value)}
            aria-label="Eigener Spendenanteil in Prozent"
            className="w-28 rounded-xl border border-border bg-background px-4 py-2.5 text-right outline-none focus-visible:border-foreground"
          />
          <span className="text-[0.9375rem] text-muted-foreground">
            % je Auszahlung
          </span>
        </div>
      )}

      {/* Live-Beispiel, sobald ein Satz gewählt ist. */}
      {bps > 0 && !ueberGrenze && (
        <p className="mt-5 rounded-2xl bg-muted/50 px-5 py-4 text-[0.9375rem]">
          Bei einer Auszahlung von {formatCurrency(BEISPIEL, waehrung)} gehen{" "}
          <strong>{formatCurrency(beispielSpende, waehrung)}</strong> an{" "}
          {recipients.find((r) => r.id === empfaenger)?.name ?? "die Organisation"}.
        </p>
      )}

      {ueberGrenze && (
        <p className="mt-5 text-[0.9375rem] text-destructive">
          Nach Abzug von Plattform-Gebühr und Beteiligungen stehen höchstens{" "}
          {(settings.max_share_bps / 100).toFixed(2)} % zur Verfügung.
        </p>
      )}

      {/* Empfängerwahl nur zeigen, wenn es wirklich etwas zu wählen gibt. */}
      {recipients.length > 1 && bps > 0 && (
        <div className="mt-6">
          <label
            htmlFor="spenden-empfaenger"
            className="block font-medium"
          >
            Organisation
          </label>
          <select
            id="spenden-empfaenger"
            value={empfaenger ?? ""}
            onChange={(e) => setEmpfaenger(e.target.value)}
            disabled={gesperrt}
            className="mt-2 w-full max-w-md rounded-xl border border-border bg-background px-4 py-3 outline-none focus-visible:border-foreground"
          >
            {recipients.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <button
        type="button"
        onClick={() => void speichern()}
        disabled={!kannSpeichern || laeuft}
        className="mt-8 rounded-full bg-foreground px-8 py-3 font-medium text-background outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-foreground/20 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {laeuft ? "Wird gespeichert …" : "Speichern"}
      </button>

      {bps > 0 && (
        <p className="mt-4 max-w-xl text-sm text-muted-foreground">
          Mit dem Speichern stimmst du zu, dass der gewählte Anteil jeder
          künftigen Auszahlung an die Organisation weitergegeben wird. Du kannst
          das jederzeit ändern oder beenden.
        </p>
      )}

      <SpendenVerlauf uebersicht={uebersicht} waehrung={waehrung} />
    </div>
  );
}

/** Bisherige Spenden — bei Airbnb „Your donations at work". */
function SpendenVerlauf({
  uebersicht,
  waehrung,
}: {
  uebersicht: SpendenUebersicht;
  waehrung: string | null;
}) {
  const { summary, recent } = uebersicht;
  if (!summary.length) return null;

  return (
    <section className="mt-12 border-t border-border pt-8">
      <h3 className="font-display text-xl font-semibold tracking-tight">
        Deine Spenden
      </h3>

      <div className="mt-4 flex flex-wrap gap-8">
        {summary.map((s) => {
          // Storniertes abziehen — sonst zeigte die Übersicht Geld an, das nie
          // geflossen ist.
          const netto =
            (s.total_amount_cents - s.reversed_amount_cents) / 100;
          return (
            <div key={s.currency}>
              <p className="font-display text-2xl font-semibold tabular-nums">
                {formatCurrency(netto, s.currency || waehrung)}
              </p>
              <p className="text-sm text-muted-foreground">
                {s.count} {s.count === 1 ? "Buchung" : "Buchungen"}
              </p>
            </div>
          );
        })}
      </div>

      {recent.length > 0 && (
        <ul className="mt-6 divide-y divide-border">
          {recent.slice(0, 5).map((z) => (
            <li key={z.id} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="text-[0.9375rem]">
                  {new Date(z.created_at).toLocaleDateString("de-DE", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
                <p className="text-sm text-muted-foreground">
                  {z.share_bps / 100} % von{" "}
                  {formatCurrency(z.gross_amount_cents / 100, z.currency)}
                </p>
              </div>
              <span className="shrink-0 text-[0.9375rem] font-medium tabular-nums">
                {z.status === "reversed" ? (
                  <span className="text-muted-foreground line-through">
                    {formatCurrency(z.amount_cents / 100, z.currency)}
                  </span>
                ) : (
                  formatCurrency(
                    (z.amount_cents - z.reversed_amount_cents) / 100,
                    z.currency,
                  )
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
