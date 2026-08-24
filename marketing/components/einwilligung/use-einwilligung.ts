"use client";

// Der gemeinsame Lesezugriff auf die Einwilligung für alle Komponenten:
// Leiste, Einstellungsfeld auf der Cookie-Richtlinie und das Kontaktformular.
//
// `geladen` ist wichtig: Auf dem Server gibt es keinen localStorage, der erste
// Client-Render muss also mit dem Server übereinstimmen (sonst
// Hydrations-Fehler). Deshalb liest der Hook erst im Effekt und meldet vorher
// „noch nichts gelesen" — die Leiste zeigt in diesem Moment nichts an, statt
// aufzublitzen und wieder zu verschwinden.
import { useCallback, useEffect, useState } from "react";

import {
  type Auswahl,
  EINWILLIGUNG_EREIGNIS,
  type Entscheidung,
  entscheidungLesen,
  entscheidungSpeichern,
} from "@/lib/einwilligung";

export function useEinwilligung(): {
  entscheidung: Entscheidung | null;
  geladen: boolean;
  speichern: (auswahl: Auswahl) => void;
} {
  const [entscheidung, setEntscheidung] = useState<Entscheidung | null>(null);
  const [geladen, setGeladen] = useState(false);

  useEffect(() => {
    const lesen = () => {
      setEntscheidung(entscheidungLesen());
      setGeladen(true);
    };
    lesen();
    // Eigenes Ereignis: Änderung in DIESEM Tab (Leiste ↔ Einstellungsfeld ↔
    // Kontaktformular). `storage`: Änderung in einem anderen Tab derselben
    // Seite — wer dort widerruft, soll hier nicht weiter als „erlaubt" gelten.
    window.addEventListener(EINWILLIGUNG_EREIGNIS, lesen);
    window.addEventListener("storage", lesen);
    return () => {
      window.removeEventListener(EINWILLIGUNG_EREIGNIS, lesen);
      window.removeEventListener("storage", lesen);
    };
  }, []);

  const speichern = useCallback((auswahl: Auswahl) => {
    // Schreiben und Ereignis in einem: den Zustand aktualisiert der Zuhörer
    // oben. So gibt es genau EINEN Weg, wie die Anzeige an ihren Wert kommt —
    // kein zweiter, der irgendwann abweicht.
    entscheidungSpeichern(auswahl);
  }, []);

  return { entscheidung, geladen, speichern };
}
