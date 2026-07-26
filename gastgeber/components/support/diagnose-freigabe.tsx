"use client";

// Diagnose-Freigabe direkt in der Support-Anfrage.
//
// Warum hier und nicht nur im Konto: Wer gerade ein Problem meldet, ist genau
// in dem Moment bereit, uns Einblick zu geben. Ihn dafür in einen anderen
// Bereich zu schicken, kostet den Vorgang — die Freigabe muss dort sein, wo
// das Problem beschrieben wird.
//
// Der Umfang wird auch hier benannt: eine Freigabe, deren Reichweite unklar
// ist, wäre keine informierte Einwilligung.
import {
  reportClientInfo,
  setAktivitaetsAufzeichnung,
} from "@nextdays/diagnostics";
import { Icon } from "@iconify/react";
import { useState } from "react";
import { toast } from "sonner";

import type { DebugSession } from "@/lib/diagnose";
import { diagnoseFreigeben, diagnoseWiderrufen } from "@/lib/diagnose-actions";

export function DiagnoseFreigabe({
  aktiv,
  ticketId,
}: {
  /** Laufende Freigabe, falls vorhanden. */
  aktiv: DebugSession | null;
  ticketId: string;
}) {
  const [laeuft, setLaeuft] = useState(false);
  const [offen, setOffen] = useState(false);

  async function freigeben() {
    setLaeuft(true);
    // 8 Stunden: deckt einen Arbeitstag ab, ohne zur Dauerfreigabe zu werden.
    const res = await diagnoseFreigeben(8, `Support-Anfrage ${ticketId.slice(0, 8)}`);
    setLaeuft(false);
    if (res.ok) {
      // Umgebung sofort mitschicken, damit der Support nicht auf den nächsten
      // Fehler warten muss und die Liste nie leer wirkt.
      await reportClientInfo();
      setAktivitaetsAufzeichnung(true);
      setOffen(false);
      toast.success("Diagnose freigegeben — danke, das hilft uns.");
    } else {
      toast.error(res.fehler);
    }
  }

  async function widerrufen() {
    setLaeuft(true);
    const res = await diagnoseWiderrufen();
    setLaeuft(false);
    if (res.ok) {
      setAktivitaetsAufzeichnung(false);
      toast.success("Freigabe beendet.");
    }
    else toast.error(res.fehler);
  }

  if (aktiv) {
    return (
      <div className="mt-6 flex items-start justify-between gap-4 rounded-2xl border-2 border-foreground p-5">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-semibold">
            <Icon icon="ph:check-circle" className="size-5 shrink-0" />
            Diagnose freigegeben
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Unser Support sieht deine Schritte und Fehlermeldungen bis{" "}
            {new Date(aktiv.expires_at).toLocaleTimeString("de-DE", {
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            Uhr deine Fehlermeldungen einsehen.
          </p>
        </div>
        <button
          type="button"
          disabled={laeuft}
          onClick={() => void widerrufen()}
          className="shrink-0 text-sm font-semibold underline-offset-4 hover:underline disabled:opacity-50"
        >
          Beenden
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-2xl border border-dashed border-border p-5">
      <p className="flex items-center gap-2 font-semibold">
        <Icon icon="ph:activity" className="size-5 shrink-0" />
        Hilf uns, den Fehler zu finden
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Gib unserem Support befristet Einblick — er sieht dann deine
        Schritte und die Fehlermeldungen deines Kontos.
      </p>

      {offen && (
        <div className="mt-4 rounded-xl bg-muted/40 p-4 text-sm">
          <p className="font-semibold">Der Support sieht dann</p>
          <p className="mt-1 text-muted-foreground">
            Fehlermeldungen, fehlgeschlagene Aufrufe, Browser und Gerät —
            und während der Freigabe, welche Seiten du öffnest und welche
            Schaltflächen du anklickst.
          </p>
          <p className="mt-3 font-semibold">Nicht sichtbar</p>
          <p className="mt-1 text-muted-foreground">
            Deine Eingaben, Nachrichten und Gastdaten. Nach Ablauf oder
            Widerruf endet die Aufzeichnung sofort.
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            Die Freigabe gilt 8 Stunden und lässt sich jederzeit beenden.
          </p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={laeuft}
          onClick={() => void freigeben()}
          className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {laeuft ? "Wird freigegeben …" : "Diagnose freigeben"}
        </button>
        <button
          type="button"
          onClick={() => setOffen((o) => !o)}
          className="text-sm font-semibold underline-offset-4 hover:underline"
        >
          {offen ? "Weniger" : "Was wird geteilt?"}
        </button>
      </div>
    </div>
  );
}
