"use client";

// Pop-ups einer Kunden-Website (0437, Etappe G).
//
// Client-Komponente, weil die Auslöser im Browser entschieden werden: Zeit,
// Verlassensabsicht, gelesener Anteil. Der Server weiß von alldem nichts — und
// soll es auch nicht: es wäre ein Zustand je Besucher.
//
// Was gemerkt wird und wo: `popup_once` unterscheidet „einmal je Browser"
// (localStorage, überlebt das Schließen) von „einmal je Sitzung"
// (sessionStorage). Beides bleibt im Browser des Gastes; es geht nichts an uns
// zurück.
//
// Und was es NICHT gibt: ein Pop-up, das bei jedem Seitenwechsel wieder
// aufgeht. Der Fall ist in der Datenbank gar nicht darstellbar (0437) — er
// vertreibt Gäste, und ein Baukasten, der ihn anbietet, hat ihn nicht zu Ende
// gedacht.
import { useEffect, useState } from "react";

import { texte } from "@/lib/texte";

export type PopupDaten = {
  id: string;
  title: string;
  trigger: "delay" | "exit" | "scroll";
  value: number | null;
  device: "mobile" | "desktop" | null;
  once: boolean;
};

/** Hat dieser Browser das Pop-up schon gesehen?
 *
 *  Wirft nie: in einem privaten Fenster oder bei blockierten Site-Daten
 *  scheitert schon der Zugriff auf `localStorage`. Dann gilt „noch nicht
 *  gesehen" — lieber ein Pop-up zu viel als eine Ausnahme, die die ganze Seite
 *  zerlegt. */
function schonGesehen(id: string, once: boolean): boolean {
  try {
    const speicher = once ? window.localStorage : window.sessionStorage;
    return speicher.getItem(`nd-popup-${id}`) === "1";
  } catch {
    return false;
  }
}

function merken(id: string, once: boolean): void {
  try {
    const speicher = once ? window.localStorage : window.sessionStorage;
    speicher.setItem(`nd-popup-${id}`, "1");
  } catch {
    // Nicht speicherbar: das Pop-up kommt beim nächsten Aufruf wieder. Das ist
    // der ehrliche Ausgang.
  }
}

/** Passt das Pop-up zum Gerät? `null` = überall.
 *
 *  Die Grenze bei 768 px ist dieselbe, die Tailwind für `md:` verwendet — die
 *  Website bricht dort ohnehin um, also ist es dieselbe Vorstellung von
 *  „mobil". */
function passtZumGeraet(device: PopupDaten["device"]): boolean {
  if (!device) return true;
  const schmal = window.matchMedia("(max-width: 767px)").matches;
  return device === "mobile" ? schmal : !schmal;
}

export function Popups({
  popups,
  sprache,
  kinder,
}: {
  popups: PopupDaten[];
  sprache: string;
  /** Der gerenderte Inhalt je Pop-up, nach ID. Er entsteht serverseitig (die
   *  Abschnitte sind Server-Components) und wird hier nur eingeblendet. */
  kinder: Record<string, React.ReactNode>;
}) {
  const [offen, setOffen] = useState<string | null>(null);

  useEffect(() => {
    // Das erste Pop-up, das noch nicht gesehen wurde und zum Gerät passt.
    // Nur EINES gleichzeitig: zwei übereinander wären für den Gast eine
    // Sackgasse.
    const kandidat = popups.find(
      (p) => !schonGesehen(p.id, p.once) && passtZumGeraet(p.device),
    );
    if (!kandidat) return;

    let abgeraeumt = false;
    const zeige = () => {
      if (abgeraeumt) return;
      setOffen(kandidat.id);
      merken(kandidat.id, kandidat.once);
    };

    if (kandidat.trigger === "delay") {
      const ms = (kandidat.value ?? 5) * 1000;
      const timer = setTimeout(zeige, ms);
      return () => {
        abgeraeumt = true;
        clearTimeout(timer);
      };
    }

    if (kandidat.trigger === "scroll") {
      const anteil = (kandidat.value ?? 50) / 100;
      const beiScroll = () => {
        const gesamt = document.body.scrollHeight - window.innerHeight;
        // Eine Seite, die kürzer ist als das Fenster, kann nicht gescrollt
        // werden — dort greift der Auslöser sofort, statt nie.
        if (gesamt <= 0 || window.scrollY / gesamt >= anteil) zeige();
      };
      window.addEventListener("scroll", beiScroll, { passive: true });
      beiScroll();
      return () => {
        abgeraeumt = true;
        window.removeEventListener("scroll", beiScroll);
      };
    }

    // `exit` — die Verlassensabsicht. Auf dem Telefon gibt es keinen Zeiger,
    // der die Seite nach oben verlässt: dort wird daraus eine Verzögerung von
    // 20 Sekunden. Ohne diesen Ersatz erschiene das Pop-up auf Mobilgeräten
    // NIE, und der Betrieb würde den Grund nie finden.
    const schmal = window.matchMedia("(max-width: 767px)").matches;
    if (schmal) {
      const timer = setTimeout(zeige, 20_000);
      return () => {
        abgeraeumt = true;
        clearTimeout(timer);
      };
    }
    const beiMaus = (e: MouseEvent) => {
      if (e.clientY <= 0) zeige();
    };
    document.addEventListener("mouseout", beiMaus);
    return () => {
      abgeraeumt = true;
      document.removeEventListener("mouseout", beiMaus);
    };
  }, [popups]);

  useEffect(() => {
    if (!offen) return;
    // Escape schließt. Ein Fenster, das die Seite überdeckt und nur mit der
    // Maus zu schließen ist, sperrt jeden aus, der mit der Tastatur bedient.
    const beiTaste = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOffen(null);
    };
    document.addEventListener("keydown", beiTaste);
    return () => document.removeEventListener("keydown", beiTaste);
  }, [offen]);

  if (!offen) return null;
  const aktuell = popups.find((p) => p.id === offen);
  if (!aktuell) return null;

  return (
    <div
      // `dialog` mit `aria-modal`: ein Screenreader kündigt es als Fenster an
      // und liest nicht weiter die Seite dahinter vor.
      role="dialog"
      aria-modal="true"
      aria-label={aktuell.title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        // Klick auf den Hintergrund schließt — aber nur auf ihn, nicht auf den
        // Inhalt. Ohne diese Prüfung schließt jeder Klick im Fenster.
        if (e.target === e.currentTarget) setOffen(null);
      }}
    >
      <div className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-background shadow-2xl">
        <button
          type="button"
          onClick={() => setOffen(null)}
          aria-label={texte(sprache).popupSchliessen}
          className="absolute right-3 top-3 z-10 flex size-9 items-center justify-center rounded-full bg-background/80 text-xl leading-none text-foreground shadow backdrop-blur transition hover:bg-secondary"
        >
          ×
        </button>
        {kinder[aktuell.id]}
      </div>
    </div>
  );
}
