"use client";

// Bestätigung für Veröffentlichen bzw. Zurückziehen.
//
// Warum ein eigener Dialog und nicht ein zweiter Knopf im Formular: das hier
// ist der einzige Schritt, der einen Fehler an ALLE Betriebe ausliefert. Der
// Text nennt die Folge im Klartext — und bei `als_popup` verlangt er eine
// Tipp-Bestätigung, weil ein Popup jeden Betrieb aktiv unterbricht.
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@nextdays/ui/dialog";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { veroeffentlichen, zurueckziehen } from "@/lib/announcement-actions";
import type { Ankuendigung } from "@/lib/announcements";

export function VeroeffentlichenDialog({
  ankuendigung,
  offen,
  aufSchliessen,
}: {
  ankuendigung: Ankuendigung;
  offen: boolean;
  aufSchliessen: () => void;
}) {
  const router = useRouter();
  const [tippen, setTippen] = useState("");
  const [laeuft, setLaeuft] = useState(false);

  const istRueckzug = ankuendigung.status === "veroeffentlicht";
  // Nur beim Veröffentlichen eines Popups: das Zurückziehen ist die schadens-
  // begrenzende Richtung und darf nicht künstlich erschwert werden.
  const brauchtTippen = !istRueckzug && ankuendigung.als_popup;
  const freigeschaltet =
    !brauchtTippen || tippen.trim() === ankuendigung.titel.trim();

  // Beim Schließen zurücksetzen, damit ein zweiter Anlauf nicht schon
  // freigeschaltet startet.
  useEffect(() => {
    if (!offen) setTippen("");
  }, [offen]);

  async function ausfuehren() {
    if (laeuft || !freigeschaltet) return;
    setLaeuft(true);
    const res = istRueckzug
      ? await zurueckziehen(ankuendigung.id)
      : await veroeffentlichen(ankuendigung.id);
    setLaeuft(false);
    if (!res.ok) {
      toast.error(res.fehler);
      return;
    }
    toast.success(istRueckzug ? "Zurückgezogen." : "Veröffentlicht.");
    aufSchliessen();
    router.refresh();
  }

  return (
    <Dialog open={offen} onOpenChange={(o) => !o && aufSchliessen()}>
      <DialogContent className="max-w-xl">
        <DialogTitle>
          {istRueckzug ? "Ankündigung zurückziehen?" : "Jetzt veröffentlichen?"}
        </DialogTitle>

        <DialogDescription className="mt-3 space-y-3">
          {istRueckzug ? (
            <>
              <span className="block">
                „{ankuendigung.titel}" verschwindet danach aus der Liste
                „Neuerungen" und wird niemandem mehr als Popup gezeigt.
              </span>
              <span className="block">
                Wer sie bereits gesehen und geschlossen hat, hat sie gesehen —
                das lässt sich nicht rückgängig machen. Zurückziehen stoppt nur
                die weitere Verbreitung.
              </span>
            </>
          ) : (
            <>
              <span className="block">
                „{ankuendigung.titel}" wird für <strong>alle Betriebe</strong>{" "}
                sichtbar — auf der Seite „Neuerungen"
                {ankuendigung.als_popup
                  ? " und zusätzlich als Dialog, den jeder Betrieb aktiv schließen muss."
                  : "."}
              </span>
              <span className="block">
                Sie erscheint <strong>beim nächsten Login</strong> des Betriebs,
                nicht sofort: es gibt bewusst keine Live-Zustellung. Wer gerade
                eingeloggt ist, sieht sie erst beim nächsten Vollladen.
              </span>
              <span className="block">
                Korrigieren geht danach nur eingeschränkt: wer die Ankündigung
                schon geschlossen hat, bekommt sie nicht erneut.
              </span>
            </>
          )}
        </DialogDescription>

        {brauchtTippen && (
          <label className="mt-5 block">
            <span className="mb-1.5 block text-xs text-muted-foreground">
              Zum Bestätigen den Titel wortwörtlich eintippen:{" "}
              <span className="font-medium text-foreground">
                {ankuendigung.titel}
              </span>
            </span>
            <input
              type="text"
              value={tippen}
              autoFocus
              onChange={(e) => setTippen(e.target.value)}
              className="w-full rounded-xl border border-border bg-transparent px-3.5 py-2 text-sm outline-none focus-visible:border-foreground"
            />
          </label>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={laeuft || !freigeschaltet}
            aria-busy={laeuft}
            onClick={() => void ausfuehren()}
            className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {laeuft
              ? "Einen Moment …"
              : istRueckzug
                ? "Zurückziehen"
                : "Veröffentlichen"}
          </button>
          <button
            type="button"
            onClick={aufSchliessen}
            className="text-sm font-semibold underline-offset-4 hover:underline"
          >
            Abbrechen
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
