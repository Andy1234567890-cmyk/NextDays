"use client";

// Freigabe-Leiste: berechnete Preise erst nach einem Blick an die Portale.
//
// WARUM ES DIESEN SCHRITT GIBT
// Die Zahl geht an Airbnb und Booking. Ein Fehler ist dort sofort öffentlich
// und wird verkauft — zurücknehmen lässt sich eine Buchung nicht. Wer 18
// Objekte führt, will vor dem Senden draufschauen können.
//
// Die Leiste erscheint NUR, wenn das Objekt auf Freigabe gestellt ist und
// wirklich etwas wartet. Ein dauerhaft sichtbarer Hinweis ohne Handlungsbedarf
// wird nach zwei Tagen übersehen — und dann auch der, der zählt.
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@nextdays/ui/button";
import { freigabeErteilen, getFreigabeStand } from "@/lib/dynamic-pricing";

export function DpFreigabeLeiste({ propertyId }: { propertyId: string }) {
  const router = useRouter();
  const [offen, setOffen] = useState<number | null>(null);
  const [noetig, setNoetig] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = useCallback(async () => {
    const res = await getFreigabeStand(propertyId);
    if (!res.ok) {
      // Still: die Leiste ist eine Zusatzinformation. Ein Fehler hier darf
      // den Kalender nicht mit einer roten Meldung überdecken.
      setOffen(null);
      return;
    }
    setNoetig(res.data.freigabe_noetig);
    setOffen(res.data.offen);
  }, [propertyId]);

  useEffect(() => {
    void laden();
  }, [laden]);

  async function freigeben() {
    setBusy(true);
    setFehler(null);
    const res = await freigabeErteilen(propertyId);
    setBusy(false);
    if (!res.ok) {
      setFehler(res.error);
      return;
    }
    setOffen(res.data.offen);
    // Die freigegebenen Preise gelten ab jetzt — die Seite muss sie zeigen.
    router.refresh();
  }

  if (!noetig || offen === null || offen === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-(--radius) border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm dark:border-amber-800 dark:bg-amber-950/40">
      <span aria-hidden>⚠</span>
      <span>
        <span className="font-semibold">Preise prüfen:</span> {offen} berechnete{" "}
        {offen === 1 ? "Tag wartet" : "Tage warten"} auf die Freigabe. Erst
        danach gehen sie an die Portale.
      </span>
      {fehler && <span className="text-destructive">{fehler}</span>}
      <Button
        type="button"
        size="sm"
        className="ml-auto"
        onClick={freigeben}
        disabled={busy}
      >
        {busy ? "sendet…" : "Preise senden"}
      </Button>
    </div>
  );
}
