"use client";

// Beteiligung eines Co-Gastgebers festlegen.
//
// Der wichtigste Punkt der ganzen Ansicht steht ganz oben: Diese Beteiligung
// kommt ZUSÄTZLICH zur Plattform-Gebühr und geht vom Anteil des Gastgebers ab.
// Wer das nicht sofort versteht, vereinbart womöglich mehr, als ihm bleibt.
//
// Deshalb die Beispielrechnung: eine konkrete Zahl sagt mehr als jede
// Erklärung. Sie rechnet mit einem Beispielbetrag, nicht mit echten Buchungen —
// die tatsächliche Aufteilung macht das Backend je Buchung.
import { Icon } from "@iconify/react";
import { useState } from "react";
import { toast } from "sonner";

import { formatCurrency } from "@nextdays/currency";

import { setzeCohostBeteiligung } from "@/lib/cohost-actions";
import type { Cohost, ShareKind } from "@/lib/cohosts";

/** Beispielbetrag für die Vorschau — greifbar und rund. */
const BEISPIEL_CENTS = 100_000;

export function CohostBeteiligung({
  propertyId,
  cohost,
  waehrung,
  plattformBps,
  onGeaendert,
  onSchliessen,
}: {
  propertyId: string;
  cohost: Cohost;
  /** Währung des Objekts. Kann fehlen — dann rendert formatCurrency
   *  symbollos statt eines erfundenen Symbols (Wurzel 4). */
  waehrung: string | null;
  /** Feste Plattform-Gebühr in Basispunkten (800 = 8 %). */
  plattformBps: number;
  onGeaendert: (c: Cohost) => void;
  onSchliessen: () => void;
}) {
  const [art, setArt] = useState<ShareKind>(cohost.share_kind);
  const [prozent, setProzent] = useState(
    cohost.share_bps ? String(cohost.share_bps / 100) : "",
  );
  const [betrag, setBetrag] = useState(
    cohost.share_fixed_cents ? String(cohost.share_fixed_cents / 100) : "",
  );
  const [laeuft, setLaeuft] = useState(false);

  // Vorschau. Ganzzahl-Arithmetik wie im Backend, damit die angezeigte Zahl
  // der späteren Abrechnung entspricht.
  const plattformCents = Math.floor((BEISPIEL_CENTS * plattformBps) / 10000);
  const cohostCents =
    art === "percent"
      ? Math.floor((BEISPIEL_CENTS * Math.round(Number(prozent) * 100)) / 10000)
      : art === "fixed"
        ? Math.round(Number(betrag) * 100)
        : 0;
  const gastgeberCents = BEISPIEL_CENTS - plattformCents - cohostCents;
  const zuHoch = gastgeberCents < 0;

  const eingabeFehlt =
    (art === "percent" && !(Number(prozent) > 0)) ||
    (art === "fixed" && !(Number(betrag) > 0));

  async function speichern() {
    setLaeuft(true);
    const res = await setzeCohostBeteiligung(propertyId, cohost.id, {
      share_kind: art,
      share_bps:
        art === "percent" ? Math.round(Number(prozent) * 100) : null,
      share_fixed_cents:
        art === "fixed" ? Math.round(Number(betrag) * 100) : null,
      share_currency: art === "fixed" ? waehrung : null,
    });
    setLaeuft(false);
    if (res.ok) {
      onGeaendert(res.data);
      toast.success("Beteiligung gespeichert.");
      onSchliessen();
    } else {
      // Die Backend-Meldung nennt die konkrete Grenze („höchstens 92 %").
      toast.error(res.fehler);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-8 pb-8 pt-12">
        <h2 className="font-sans text-[2rem] font-bold tracking-tight">
          Beteiligung
        </h2>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted-foreground">
          Was bekommt {cohost.full_name || cohost.email} je Buchung? Der Anteil
          geht von deinem Teil ab — die Plattform-Gebühr bleibt davon unberührt.
        </p>

        <div className="mt-8 space-y-3">
          {(
            [
              {
                key: "none" as const,
                label: "Unentgeltlich",
                hint: "Hilft ohne Beteiligung",
                icon: "ph:hand-heart",
              },
              {
                key: "percent" as const,
                label: "Anteil je Buchung",
                hint: "Prozentual vom Buchungsbetrag",
                icon: "ph:percent",
              },
              {
                key: "fixed" as const,
                label: "Fester Betrag",
                hint: "Gleicher Betrag je Buchung",
                icon: "ph:coins",
              },
            ] satisfies { key: ShareKind; label: string; hint: string; icon: string }[]
          ).map((o) => {
            const gewaehlt = art === o.key;
            return (
              <button
                key={o.key}
                type="button"
                onClick={() => setArt(o.key)}
                aria-pressed={gewaehlt}
                className={`block w-full rounded-2xl p-5 text-left outline-none transition-all focus-visible:ring-2 focus-visible:ring-foreground/20 ${
                  gewaehlt
                    ? "border-2 border-foreground"
                    : "border border-border hover:shadow-md"
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon icon={o.icon} className="size-6 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{o.label}</span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">
                      {o.hint}
                    </span>
                  </span>
                </span>

                {gewaehlt && o.key === "percent" && (
                  <span className="mt-4 flex items-center gap-3 border-t border-border pt-4">
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0.1"
                      max="90"
                      step="0.1"
                      value={prozent}
                      onChange={(e) => setProzent(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label="Anteil in Prozent"
                      className="w-28 rounded-xl border border-border bg-background px-4 py-2.5 text-right outline-none focus-visible:border-foreground"
                    />
                    <span className="text-sm text-muted-foreground">
                      % je Buchung
                    </span>
                  </span>
                )}

                {gewaehlt && o.key === "fixed" && (
                  <span className="mt-4 flex items-center gap-3 border-t border-border pt-4">
                    <input
                      type="number"
                      inputMode="decimal"
                      min="1"
                      step="1"
                      value={betrag}
                      onChange={(e) => setBetrag(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Betrag in ${waehrung ?? "Objektwährung"}`}
                      className="w-32 rounded-xl border border-border bg-background px-4 py-2.5 text-right outline-none focus-visible:border-foreground"
                    />
                    <span className="text-sm text-muted-foreground">
                      {waehrung} je Buchung
                    </span>
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Beispielrechnung — macht sofort sichtbar, wer was bekommt. */}
        {art !== "none" && !eingabeFehlt && (
          <div className="mt-8 rounded-2xl bg-muted/50 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Beispiel: Buchung über{" "}
              {formatCurrency(BEISPIEL_CENTS / 100, waehrung)}
            </p>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">
                  Plattform-Gebühr ({plattformBps / 100} %)
                </dt>
                <dd className="font-medium">
                  −{formatCurrency(plattformCents / 100, waehrung)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">
                  {cohost.full_name || "Co-Gastgeber"}
                </dt>
                <dd className="font-medium">
                  −{formatCurrency(cohostCents / 100, waehrung)}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-border pt-2">
                <dt className="font-semibold">Bleibt bei dir</dt>
                <dd
                  className={`font-semibold ${zuHoch ? "text-destructive" : ""}`}
                >
                  {formatCurrency(gastgeberCents / 100, waehrung)}
                </dd>
              </div>
            </dl>
            {zuHoch && (
              <p className="mt-3 text-sm text-destructive">
                Die Beteiligung übersteigt den Buchungsbetrag abzüglich
                Plattform-Gebühr.
              </p>
            )}
          </div>
        )}

        {art !== "none" && (
          <p className="mt-6 flex gap-2 text-sm text-muted-foreground">
            <Icon icon="ph:info" className="mt-0.5 size-4 shrink-0" />
            Die Auszahlung läuft automatisch über das Auszahlungskonto des
            Co-Gastgebers — nach der Abreise des Gastes, zusammen mit deiner
            eigenen Auszahlung.
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between gap-4 border-t border-border px-8 py-5">
        <button
          type="button"
          onClick={onSchliessen}
          className="text-sm font-semibold underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-foreground/20"
        >
          Abbrechen
        </button>
        <button
          type="button"
          onClick={() => void speichern()}
          disabled={laeuft || zuHoch || eingabeFehlt}
          className="rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-foreground/20 disabled:opacity-40"
        >
          {laeuft ? "Wird gespeichert …" : "Speichern"}
        </button>
      </div>
    </div>
  );
}
