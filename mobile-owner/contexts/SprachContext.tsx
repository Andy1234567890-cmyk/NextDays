// Die Sprache der Oberfläche — ein Provider, ein Hook.
//
// WARUM EIN CONTEXT und keine Modulvariable: die Sprache ändert sich zur
// Laufzeit (Menü → Sprache), und jeder Screen muss danach neu zeichnen. Eine
// Modulvariable täte das nicht; die Oberfläche bliebe bis zum Neustart auf der
// alten Sprache stehen.
//
// Gespeichert wird die WAHL, nicht die berechnete Sprache: fällt eine Sprache
// später weg oder kommt eine dazu, gilt wieder die Kette aus `spracheWaehlen`.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { spracheLaden, spracheSpeichern } from "@/lib/spracheSpeicher";
import {
  geraeteSprache,
  uebersetzen,
  spracheWaehlen,
  type Sprache,
  type TextSchluessel,
} from "@/lib/sprache";

type SprachState = {
  sprache: Sprache;
  /** Übersetzt einen Schlüssel; `werte` füllt Platzhalter `{name}`. */
  t: (schluessel: TextSchluessel, werte?: Record<string, string | number>) => string;
  /** Sprache umstellen und die Wahl behalten. */
  spracheSetzen: (s: Sprache) => void;
};

const Ctx = createContext<SprachState | null>(null);

export function SprachProvider({ children }: { children: React.ReactNode }) {
  const { me } = useAuth();
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  useEffect(() => {
    let aktuell = true;
    void spracheLaden().then((wert) => {
      if (!aktuell) return;
      setGewaehlt(wert);
    });
    return () => {
      aktuell = false;
    };
  }, []);

  const vomGeraet = useMemo(() => geraeteSprache(), []);
  const sprache = useMemo(
    () => spracheWaehlen(gewaehlt, me?.preferred_language, vomGeraet),
    [gewaehlt, me?.preferred_language, vomGeraet],
  );

  const spracheSetzen = useCallback((s: Sprache) => {
    setGewaehlt(s);
    // Best effort: scheitert das Speichern, gilt die Wahl für diese Sitzung.
    // Ein Fehler hier darf die Oberfläche nicht aufhalten.
    void spracheSpeichern(s);
  }, []);

  const t = useCallback(
    (schluessel: TextSchluessel, werte?: Record<string, string | number>) =>
      uebersetzen(sprache, schluessel, werte),
    [sprache],
  );

  const wert = useMemo<SprachState>(
    () => ({ sprache, t, spracheSetzen }),
    [sprache, t, spracheSetzen],
  );

  // KEIN wechselnder `key`: der hängte beim Umschalten den ganzen Baum ab und
  // neu an — die Navigation verlöre ihren Zustand, und React Native meldete
  // beim Fast Refresh „Rendered more hooks than during the previous render".
  // Der Context genügt: ändert sich die Sprache, zeichnen die Verbraucher neu.
  return <Ctx.Provider value={wert}>{children}</Ctx.Provider>;
}

/**
 * Die Sprache und die Übersetzungsfunktion.
 *
 * Wirft außerhalb des Providers — ein Screen, der Texte zeigt, gehört in den
 * Baum. Ein stiller Rückfall auf Deutsch versteckte den Einbaufehler.
 */
export function useSprache(): SprachState {
  const wert = useContext(Ctx);
  if (!wert) throw new Error("useSprache außerhalb von SprachProvider");
  return wert;
}

/** Kurzform für Screens, die nur Texte brauchen. */
export function useT(): SprachState["t"] {
  return useSprache().t;
}
