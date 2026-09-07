"use client";

// Ein-/Ausschalter für die Debug-Overlays (Sitzung + Realtime).
//
// WARUM (07.09.2026)
// ==================
// Beide Panels hingen allein an `NODE_ENV`/`NEXT_PUBLIC_*`: in der Entwicklung
// waren sie IMMER da und ließen sich nicht wegklicken. Sie sitzen unten links
// und unten rechts über dem Inhalt — beim Arbeiten an genau diesen Ecken (und
// für jeden Screenshot) standen sie im Weg, und der einzige Weg, sie
// loszuwerden, war ein Neustart des Dev-Servers mit anderer Variable.
//
// Der Schalter ändert NICHT, ob die Panels ins Bundle kommen — das entscheiden
// weiterhin die Layouts über `NODE_ENV`, damit in Produktion nichts
// mitgeliefert wird, was Tenant-IDs im Klartext zeigt. Er entscheidet nur, ob
// die eingebauten Panels SICHTBAR sind.
//
// Die Wahl überlebt einen Seitenwechsel (`localStorage`), weil es sonst nach
// jedem Klick auf einen Menüpunkt von vorn losginge. `localStorage` kann in
// manchen Kontexten werfen (privates Fenster, blockierte Site-Daten), deshalb
// steht jeder Zugriff in `try`.
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useState } from "react";

const SCHLUESSEL = "nd-debug-overlays";
// Ein eigenes Ereignis, damit BEIDE Panels und der Knopf im selben Tab
// mitbekommen, dass sich die Wahl geändert hat: `storage` feuert nur in den
// ANDEREN Tabs, nie in dem, der geschrieben hat.
const EREIGNIS = "nd-debug-overlays-geaendert";

function lesen(): boolean {
  try {
    // Voreinstellung: AN. Wer die Panels nie brauchte, hat sie bisher auch
    // gesehen — ein stiller Wechsel auf „aus" ließe jemanden vergeblich nach
    // dem gewohnten Overlay suchen.
    return localStorage.getItem(SCHLUESSEL) !== "aus";
  } catch {
    return true;
  }
}

/** Sind die Debug-Overlays sichtbar? Für die Panels selbst. */
export function useDebugSichtbar(): boolean {
  // Serverseitig und beim ersten Rendern `true`: ein abweichender Startwert
  // ergäbe eine Hydration-Abweichung. Der echte Wert kommt im Effekt.
  const [sichtbar, setSichtbar] = useState(true);
  useEffect(() => {
    const aktualisieren = () => setSichtbar(lesen());
    aktualisieren();
    window.addEventListener(EREIGNIS, aktualisieren);
    window.addEventListener("storage", aktualisieren);
    return () => {
      window.removeEventListener(EREIGNIS, aktualisieren);
      window.removeEventListener("storage", aktualisieren);
    };
  }, []);
  return sichtbar;
}

/** Der Knopf. Sitzt unten rechts, unter den Panels, und bleibt sichtbar, wenn
 *  sie ausgeblendet sind — sonst gäbe es keinen Weg zurück. */
export function DebugSchalter() {
  const sichtbar = useDebugSichtbar();
  const [bereit, setBereit] = useState(false);
  useEffect(() => setBereit(true), []);

  const umschalten = useCallback(() => {
    try {
      localStorage.setItem(SCHLUESSEL, sichtbar ? "aus" : "an");
    } catch {
      /* kein Speicher — die Wahl gilt dann nur für diese Seite */
    }
    window.dispatchEvent(new Event(EREIGNIS));
  }, [sichtbar]);

  // Erst nach dem Einhängen zeichnen: der Knopf zeigt den gespeicherten
  // Zustand, den der Server nicht kennt.
  if (!bereit) return null;

  return (
    <button
      type="button"
      onClick={umschalten}
      // Unter den Panels (`bottom-2`), damit er sie nicht verdeckt, und mit
      // höherem z-index, damit er immer erreichbar bleibt.
      className="fixed right-2 bottom-2 z-[60] flex size-7 items-center justify-center rounded-full border border-border bg-popover text-muted-foreground shadow-lg transition-colors hover:text-foreground"
      title={sichtbar ? "Debug-Anzeigen ausblenden" : "Debug-Anzeigen einblenden"}
      aria-label={sichtbar ? "Debug-Anzeigen ausblenden" : "Debug-Anzeigen einblenden"}
      aria-pressed={sichtbar}
    >
      <Icon icon={sichtbar ? "ph:eye-slash" : "ph:bug"} className="size-4" />
    </button>
  );
}
