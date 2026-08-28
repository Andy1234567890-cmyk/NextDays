"use client";

// Der eine Ort, an dem der Baukasten fragt: ist der KI-Assistent überhaupt
// eingerichtet? (0463–0465)
//
// EIN Aufruf pro Baukasten-Öffnung, nicht einer je Knopf. Ohne diesen Kontext
// würde jede der vier Oberflächen (Texteditor, SEO, Mediathek, Einstellungen)
// ihren eigenen `kiStatus()`-Aufruf machen — vier Anfragen für dieselbe
// Auskunft, und beim Wechseln zwischen ihnen jedes Mal neu.
//
// Sitzt in `BaukastenSchale` (siehe `../schale.tsx`): das ist die EINE
// Komponente, durch die JEDE Baukasten-Route läuft — der Abschnitts-Editor
// direkt, SEO und Einstellungen über `BaukastenRahmen`. Ein Provider an
// dieser einen Stelle deckt beide Wege ab, ohne dass eine Route ihn selbst
// einbinden müsste (und vergessen könnte).
//
// `verfuegbar=false` ist der Normalfall auf jedem System ohne Vertex-Zugang.
// Konsumierende Knöpfe blenden sich dann selbst aus — kein Knopf, der beim
// Klicken 503 antwortet.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { type KiStatus, kiStatus } from "@/lib/site-ki";

type KiKontext = {
  status: KiStatus | null;
  /** true, solange die erste Antwort noch aussteht. Knöpfe sollen in dieser
   *  Zeit NICHT aufblitzen und wieder verschwinden — sie bleiben aus, bis
   *  klar ist, ob es sie geben darf. */
  laedt: boolean;
  verfuegbar: boolean;
  /** Nach einer erzeugten Antwort neu fragen (Tageslimit hat sich geändert).
   *  Die einzelnen Erzeugungs-Antworten tragen ihren eigenen Verbrauchsstand
   *  bereits mit — dieser Aufruf ist nur für den seltenen Fall gedacht, dass
   *  eine Oberfläche den Stand OHNE eigene Erzeugung auffrischen will. */
  aktualisieren: () => void;
};

const Kontext = createContext<KiKontext>({
  status: null,
  laedt: true,
  verfuegbar: false,
  aktualisieren: () => {},
});

export function KiProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<KiStatus | null>(null);
  const [laedt, setLaedt] = useState(true);

  const laden = useCallback(() => {
    setLaedt(true);
    void kiStatus().then((res) => {
      // Ein Fehlschlag (z. B. Netzwerk) ist NICHT dasselbe wie „nicht
      // eingerichtet" — aber die Oberfläche kann beides nur gleich behandeln:
      // ohne gesicherte Auskunft „verfügbar" zeigt sie lieber keinen Knopf als
      // einen, der dann scheitert.
      setStatus(res.ok ? res.data : null);
      setLaedt(false);
    });
  }, []);

  useEffect(() => {
    laden();
  }, [laden]);

  return (
    <Kontext.Provider
      value={{
        status,
        laedt,
        verfuegbar: status?.verfuegbar ?? false,
        aktualisieren: laden,
      }}
    >
      {children}
    </Kontext.Provider>
  );
}

/** Ob und was der KI-Assistent gerade kann. `verfuegbar` ist die einzige
 *  Auskunft, die ein Knopf für sein Erscheinen braucht — alles andere
 *  (Verbrauch, Modell) ist für Anzeigen gedacht, die es genauer wissen wollen. */
export function useKi(): KiKontext {
  return useContext(Kontext);
}
