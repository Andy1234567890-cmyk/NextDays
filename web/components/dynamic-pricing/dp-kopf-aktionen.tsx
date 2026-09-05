"use client";

// Kopfzeile der Objektseite nach Hostaway (oben rechts: „Unsubscribe listing"
// · „Sync prices"): zwei BUTTONS, keine Schalter-Zeile.
//
// WARUM ZWEI STÄNDIG SICHTBARE BUTTONS
// Die erste Fassung (Switch + „Preise senden" nur bei wartenden Tagen) war
// fachlich vollständig, aber nicht sichtbar: ohne offene Tage stand da nur ein
// Schalter, und der Nutzer hielt die Sende-Funktion für fehlend (05.09.2026).
// Ein Button, der auch disabled dasteht, zeigt, DASS es die Aktion gibt und
// WARUM sie gerade nichts tut — ein fehlender Button zeigt nichts.
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@nextdays/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@nextdays/ui/tooltip";
import {
  freigabeErteilen,
  getFreigabeStand,
  getPortalstand,
  portalstandAngleichen,
  saveDpSettings,
} from "@/lib/dynamic-pricing";

// Wie lange „Abgleich läuft" höchstens steht: der Job braucht Sekunden, nicht
// Minuten. Danach kommt der Knopf zurück — was noch abweicht, sagt die Leiste
// über dem Kalender (dp-portalstand-leiste). Ein Zustand ohne Ende war der
// Fehler vom 05.09.2026 („der Abgleich schließt nicht ab").
const ABGLEICH_TAKT_MS = 5000;
const ABGLEICH_VERSUCHE = 6;
const PUSH_HORIZONT_TAGE = 365;

function isoPlus(tage: number): string {
  const d = new Date();
  d.setDate(d.getDate() + tage);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const t = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${t}`;
}

export function DpKopfAktionen({
  propertyId,
  enabled,
  offenInitial,
  freigabeNoetig,
}: {
  propertyId: string;
  enabled: boolean;
  /** Server-Stand aus der Übersicht, damit der Zähler nicht erst nach dem
   *  Client-Fetch erscheint (kein Aufblitzen von „0"). */
  offenInitial: number;
  /** Ob der Betrieb Preise erst freigeben will. Ohne Freigabepflicht ist
   *  „Preise senden" keine Pflichtaufgabe — die Automatik sendet selbst. */
  freigabeNoetig: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [offen, setOffen] = useState(offenInitial);
  const [sendet, setSendet] = useState(false);
  const [angestossen, setAngestossen] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = useCallback(async () => {
    const res = await getFreigabeStand(propertyId);
    if (!res.ok) return;
    setOffen(res.data.offen);
    setSendet(res.data.sendet);
  }, [propertyId]);

  useEffect(() => {
    void laden();
  }, [laden]);

  useEffect(() => {
    if (!angestossen) return;
    let versuch = 0;
    let aktiv = true;
    const takt = setInterval(async () => {
      versuch += 1;
      const res = await getPortalstand(propertyId, isoPlus(0), isoPlus(PUSH_HORIZONT_TAGE));
      if (!aktiv) return;
      const fertig = (res.ok && res.data.abweichend === 0) || versuch >= ABGLEICH_VERSUCHE;
      if (fertig) {
        clearInterval(takt);
        setAngestossen(false);
        router.refresh();
      }
    }, ABGLEICH_TAKT_MS);
    return () => {
      aktiv = false;
      clearInterval(takt);
    };
  }, [angestossen, propertyId, router]);

  async function umschalten(an: boolean) {
    setBusy(true);
    setFehler(null);
    const res = await saveDpSettings(propertyId, { enabled: an });
    setBusy(false);
    if (!res.ok) {
      setFehler(res.error);
      return;
    }
    router.refresh();
  }

  async function senden() {
    setBusy(true);
    setFehler(null);
    if (freigabeNoetig) {
      // Freigabepflicht: der Klick IST die Freigabe.
      const res = await freigabeErteilen(propertyId);
      setBusy(false);
      if (!res.ok) {
        setFehler(res.error);
        return;
      }
      setOffen(res.data.offen);
      router.refresh();
      return;
    }
    // Sofort-Modus: die Automatik sendet selbst. Der Knopf stößt den
    // Soll/Ist-Abgleich mit den Portalen an (Hostaway „Sync prices") — er
    // fragt nicht nach einer Freigabe, die es nicht gibt.
    const res = await portalstandAngleichen(propertyId);
    setBusy(false);
    if (!res.ok) {
      setFehler(res.error);
      return;
    }
    setAngestossen(true);
  }

  // Warum der Knopf gerade nichts tut — als Grund im Tooltip, statt ihn zu
  // verstecken. Im Sofort-Modus ist er immer nutzbar: ein Abgleich schadet
  // nie (er sendet nur Differenzen).
  const sendenGrund = !enabled
    ? "Dynamic Pricing ist aus — erst starten, dann senden."
    : freigabeNoetig && offen === 0
      ? "Alle berechneten Preise sind an die Portale gesendet."
      : angestossen
        ? "Abgleich läuft — der Portalstand wird alle paar Sekunden nachgeladen."
        : null;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-wrap items-center gap-3">
        {fehler && <span className="text-sm text-destructive">{fehler}</span>}
        {enabled ? (
          <Button
            type="button"
            variant="outline"
            className="border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20"
            disabled={busy}
            onClick={() => umschalten(false)}
          >
            Dynamic Pricing beenden
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => umschalten(true)}
          >
            Dynamic Pricing starten
          </Button>
        )}
        <Tooltip>
          {/* span als Trigger: ein disabled Button feuert keine Hover-Events,
              der Tooltip käme sonst genau dann nicht, wenn er erklären soll. */}
          <TooltipTrigger asChild>
            <span tabIndex={sendenGrund ? 0 : -1} className="inline-flex">
              <Button
                type="button"
                variant="accent"
                onClick={senden}
                disabled={busy || sendenGrund !== null}
                aria-disabled={sendenGrund !== null}
              >
                {busy
                  ? "sendet…"
                  : freigabeNoetig
                    ? offen > 0
                      ? `Preise freigeben (${offen})`
                      : "Preise freigeben"
                    : angestossen
                      ? "Abgleich läuft"
                      : sendet
                        ? "Wird gesendet…"
                        : "Portale abgleichen"}
              </Button>
            </span>
          </TooltipTrigger>
          {sendenGrund && <TooltipContent>{sendenGrund}</TooltipContent>}
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
