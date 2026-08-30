"use client";

// Ist React im Browser fertig hydriert?
//
// Gebraucht überall dort, wo eine Anzeige von der AKTUELLEN UHRZEIT abhängt.
// `"use client"` heisst bei Next.js nicht „läuft nur im Browser": die
// Komponente wird trotzdem serverseitig vorgerendert und danach hydriert.
// Ein `new Date()` liefert dabei ZWEI verschiedene Werte — einen zur
// Anfragezeit auf dem Server, einen Sekundenbruchteile später im Browser.
// Fällt dazwischen eine Schwelle („vor 59 Min." → „vor 1 Std."), unterscheiden
// sich die gerenderten Textknoten und React bricht die Hydration mit
// Fehler #418 ab — sichtbar als roter Konsolenfehler, der die Seite in den
// Client-Neuaufbau zwingt.
//
// Der Hook gibt beim Server-Render und beim ERSTEN Client-Render `false`
// zurück (beide Male identisch, also kein Mismatch) und erst danach `true`.
// Der Aufrufer zeigt bis dahin einen zeitunabhängigen Ersatz.
import { useEffect, useState } from "react";

export function useHydriert(): boolean {
  const [hydriert, setHydriert] = useState(false);
  useEffect(() => setHydriert(true), []);
  return hydriert;
}
