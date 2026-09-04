"use client";

// Freigabe-Leiste über der OBJEKTLISTE — für alle Objekte auf einmal.
//
// WARUM ZUSÄTZLICH ZUR EINZELNEN LEISTE
// Der Schalter „Preise erst nach Freigabe senden" wird in der Liste gesetzt,
// und dort blieb es danach still: die Preise warteten, aber der Hinweis stand
// eine Ebene tiefer auf der Detailseite. Wer 18 Objekte führt, öffnet die
// nicht einzeln, um nachzusehen — er würde annehmen, alles sei versendet.
//
// Ein wartender Preis, von dem niemand weiss, ist schlimmer als gar keine
// Freigabe: das Objekt verkauft weiter zum alten Preis, und es sieht aus, als
// funktioniere die Automatik.
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@nextdays/ui/button";
import { freigabeErteilen, type DpOverviewItem } from "@/lib/dynamic-pricing";

export function DpFreigabeSammelleiste({ items }: { items: DpOverviewItem[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const wartend = items.filter((i) => i.freigabe_noetig && i.offene_tage > 0);
  const tage = wartend.reduce((n, i) => n + i.offene_tage, 0);

  async function alleFreigeben() {
    setBusy(true);
    setFehler(null);
    // Nacheinander, nicht parallel: jede Freigabe reiht einen Recompute-Job
    // ein, der die Portale beschickt. Achtzehn gleichzeitig würden das
    // Channex-Token-Budget in einem Schwung leeren.
    for (const i of wartend) {
      const res = await freigabeErteilen(i.property_id);
      if (!res.ok) {
        setFehler(`${i.title}: ${res.error}`);
        break;
      }
    }
    setBusy(false);
    router.refresh();
  }

  if (wartend.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-(--radius) border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm dark:border-amber-800 dark:bg-amber-950/40">
      <span aria-hidden>⚠</span>
      <span>
        <span className="font-semibold">Preise prüfen:</span>{" "}
        {wartend.length === 1
          ? `Bei „${wartend[0].title}" warten ${tage} berechnete Tage`
          : `Bei ${wartend.length} Objekten warten ${tage} berechnete Tage`}{" "}
        auf die Freigabe. Bis dahin gehen sie nicht an die Portale.
      </span>
      {fehler && <span className="text-destructive">{fehler}</span>}
      <Button
        type="button"
        size="sm"
        className="ml-auto"
        onClick={alleFreigeben}
        disabled={busy}
      >
        {busy ? "sendet…" : "Alle senden"}
      </Button>
    </div>
  );
}
