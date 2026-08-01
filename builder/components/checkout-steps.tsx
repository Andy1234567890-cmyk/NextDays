// Checkout-Schritte (links): Zahlungszeitpunkt mit Auswahl, dann Zahlungsart
// und Buchungs-Prüfung als Folge-Schritte. Eigenes myNextDays-Design.
"use client";

import { useState } from "react";

export function CheckoutSteps({ gesamt }: { gesamt: string }) {
  const [zahlung, setZahlung] = useState<"jetzt" | "spaeter">("jetzt");

  return (
    <div className="flex flex-col gap-6">
      {/* Schritt 1 — aktiv */}
      <section className="rounded-2xl border border-border p-6 shadow-sm">
        <h2 className="font-display text-lg font-semibold">
          1. Lege fest, wann du zahlen möchtest
        </h2>

        <div className="mt-4 flex flex-col">
          <button
            type="button"
            onClick={() => setZahlung("jetzt")}
            className="flex items-start justify-between gap-4 border-b border-border py-4 text-left"
          >
            <span>{gesamt} jetzt zahlen</span>
            <RadioDot aktiv={zahlung === "jetzt"} />
          </button>
          <button
            type="button"
            onClick={() => setZahlung("spaeter")}
            className="flex items-start justify-between gap-4 py-4 text-left"
          >
            <span>
              <span className="block">Später bezahlen</span>
              <span className="mt-1 block text-sm text-muted-foreground">
                Wähle eine flexible Zahlungsoption, die für dich passt.{" "}
                <span className="underline">Weitere Informationen</span>
              </span>
            </span>
            <RadioDot aktiv={zahlung === "spaeter"} />
          </button>
        </div>

        <div className="mt-2 flex justify-end">
          <button
            type="button"
            className="rounded-full bg-primary px-7 py-3 font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Weiter
          </button>
        </div>
      </section>

      {/* Schritt 2 — inaktiv */}
      <section className="rounded-2xl border border-border p-6">
        <h2 className="font-display text-lg font-semibold text-muted-foreground">
          2. Füge eine Zahlungsart hinzu
        </h2>
      </section>

      {/* Schritt 3 — inaktiv */}
      <section className="rounded-2xl border border-border p-6">
        <h2 className="font-display text-lg font-semibold text-muted-foreground">
          3. Überprüfe deine Buchung
        </h2>
      </section>
    </div>
  );
}

function RadioDot({ aktiv }: { aktiv: boolean }) {
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
