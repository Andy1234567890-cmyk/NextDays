"use client";

// Der Handschlag mit dem Renderer im iframe — EINE Stelle für alle Reiter.
//
// Vorher lag er nur im Seiten-Editor. Das war der Grund, warum die Vorschau im
// Design-Reiter tot war: derselbe iframe, dieselbe Brücke drüben, aber
// diesseits hörte niemand zu. Ein zweiter Handschlag daneben wäre eine zweite
// Wahrheit über denselben Kanal gewesen.
//
// Sicherheit (Wurzel 3): Es wird NUR angenommen, was vom konfigurierten
// Renderer-Origin kommt. Fehlt der Origin, wird gar nichts angenommen —
// fail-CLOSED. Ohne ihn gibt es ohnehin keine Vorschau, und die Alternative
// wäre, jeder fremden Seite mit einem Handle auf dieses Fenster zu glauben.
import { useCallback, useEffect, useRef } from "react";

/** Origin des Renderers, aus seiner Basis-Adresse. `null`, wenn nicht
 *  konfiguriert — dann ist die Brücke geschlossen. */
function rendererOrigin(): string | null {
  const basis = process.env.NEXT_PUBLIC_BUILDER_URL;
  if (!basis) return null;
  try {
    return new URL(basis).origin;
  } catch {
    return null;
  }
}

const ORIGIN = rendererOrigin();

/** Was der Renderer schicken kann. */
export type CanvasMeldung = {
  source?: string;
  type?: string;
  index?: number | null;
  /** DB-ID des gemeldeten Blocks.
   *
   *  Sie ist die VERLÄSSLICHE Zuordnung, nicht `index`: der Renderer zählt
   *  seine `data-block-index` über den ganzen Baum (Abschnitt · Spalte ·
   *  Baustein), der Editor kennt über `list_blocks` aber nur die Bausteine.
   *  Bei sechs Bausteinen meldet der Renderer 0,1,2 / 3,4,5 / … und der Editor
   *  erwartet 0,1,2 — die Auswahl landete dadurch auf dem falschen Abschnitt
   *  (26.08.2026: Klick auf „Bild" markierte „Kontakt").
   *
   *  Optional, weil ein Baustein, der noch nie gespeichert wurde, keine ID
   *  hat. Dann bleibt der Index der Notweg. */
  id?: string;
  /** DB-ID des CONTAINERS, in dem der Klick landete (Abschnitt · Spalte ·
   *  innere Spalte, 0479).
   *
   *  Sie wandert bei `select` und `contextmenu` mit — auch dann, wenn KEIN
   *  Baustein getroffen wurde (leerer Abschnitt, leere Spalte, der Rand
   *  zwischen zwei Spalten). Vorher meldete die Brücke ausschließlich
   *  Bausteine, und damit war im Editor kein Container anfassbar: ein Klick
   *  auf einen leeren Abschnitt tat gar nichts. */
  containerId?: string;
  /** Die Art des Containers: `section` · `column` · `inner_column`. */
  containerKind?: string;
  /** Der TEIL eines Bausteins unter dem Zeiger (06.09.2026): der Schlüssel im
   *  `content`, den der Renderer als `data-feld` an die Stelle schreibt.
   *
   *  Er wandert bei `select`, `dblclick` und `text` mit. In Framer ist jede
   *  Überschrift und jeder Absatz eine eigene Ebene mit eigenem Style-Panel;
   *  bei uns ist es dieser Schlüssel, der aus einem Baustein mehrere
   *  gestaltbare Stellen macht. */
  feld?: string;
  wert?: string;
  rechtecke?: Array<{
    index: number;
    id?: string;
    /** `section` · `column` · `inner_column` · `widget` — ein leerer Container
     *  ist ein Abwurfziel, kein auswählbarer Baustein. */
    kind?: string;
    top: number;
    left: number;
    width: number;
    height: number;
  }>;
  /** Die STRUKTUR der Bausteine (06.09.2026): jeder Knoten mit eigener Box,
   *  dazu Bilder und Videos — Framers Frame · Stack · Grid · Masonry · Image ·
   *  Video. `feld` ist der Schlüssel (Feldname oder Pfad `c1_3_2`), `eltern`
   *  der Schlüssel des übergeordneten Knotens (`null` = direkt im Baustein). */
  teile?: Array<{
    id: string;
    feld: string;
    eltern?: string | null;
    art?: string;
    marke?: string | null;
    top: number;
    left: number;
    width: number;
    height: number;
  }>;
  /** Kopf-/Fußzeile und ihre Teile (0570) — eigene Liste ohne Block-Index. */
  regionen?: Array<{
    region: string;
    teil?: string;
    top: number;
    left: number;
    width: number;
    height: number;
  }>;
  /** Bei `select`: ein Klick in die Kopf- oder Fußzeile (0570). `teil` ist
   *  `null`, wenn die Region selbst getroffen wurde. */
  region?: string | null;
  teil?: string | null;
  /** Warum gemessen wurde. Nur `scroll` heißt, dass die Abschnitte unter einem
   *  offenen Menü weggewandert sind. */
  grund?: "hallo" | "layout" | "scroll";
  /** Höhe der ganzen Seite in CSS-Pixeln (bei `rects`) — der Rahmen des
   *  Breakpoints wird so hoch. */
  seitenHoehe?: number;
  x?: number | null;
  y?: number | null;
  /** `rad`: Mausrad/Pinch über dem iframe, für die Kamera der Fläche. */
  dx?: number;
  dy?: number;
  modus?: number;
  zoom?: boolean;
  /** `zug`: ein Element wird auf der Fläche gezogen (06.09.2026). `start`
   *  beginnt die Geste, `bewegt` meldet jede Bewegung, `ende` den Abwurf. */
  phase?: "start" | "bewegt" | "ende";
  /** `taste`: ein Kamera-Kürzel aus dem iframe (⌘+/−/0/1/2, Leertaste). */
  key?: string;
  code?: string;
  meta?: boolean;
  typ?: string;
  alt?: boolean;
  shift?: boolean;
};

/**
 * Meldet sich beim Renderer an und reicht dessen Meldungen weiter.
 *
 * `onMeldung` bekommt nur geprüfte Nachrichten: richtiger Origin, richtige
 * Quelle. `ready` wird hier abgefangen — es beendet den Handschlag und geht
 * den Aufrufer nichts an.
 *
 * Rückgabe ist die `onLoad`-Behandlung für den iframe. Sie MUSS gesetzt werden,
 * sonst beginnt der Handschlag nie.
 */
export function useCanvasBruecke(
  iframeRef: React.RefObject<HTMLIFrameElement | null>,
  onMeldung: (m: CanvasMeldung) => void,
): {
  /** An `onLoad` des iframe: startet den Handschlag. */
  iframeBereit: () => void;
  /** Die Vorschau zu einem Baustein scrollen (D4). */
  scrolleZu: (id: string | null) => void;
  /** Die Darstellung eines Bausteins SOFORT in der Vorschau zeigen — ohne
   *  Neuladen (06.09.2026). Geschickt werden die SETTINGS, nicht fertiges CSS:
   *  gerechnet wird drüben mit derselben Funktion, die auch die Live-Seite
   *  baut (`stilCss`). Zwei Rechenwege wären zwei Wahrheiten, und die falsche
   *  fiele erst dem Gast auf. */
  sendeStil: (id: string | null, settings: Record<string, unknown>, span?: number | null) => void;
} {
  const begruesst = useRef(false);
  const handschlag = useRef<ReturnType<typeof setInterval> | null>(null);
  const frist = useRef<ReturnType<typeof setTimeout> | null>(null);
  const meldungRef = useRef(onMeldung);
  meldungRef.current = onMeldung;

  const stoppe = useCallback(() => {
    if (handschlag.current) {
      clearInterval(handschlag.current);
      handschlag.current = null;
    }
    if (frist.current) {
      clearTimeout(frist.current);
      frist.current = null;
    }
  }, []);

  const iframeBereit = useCallback(() => {
    begruesst.current = false;
    stoppe();
    const gruessen = () => {
      if (begruesst.current) {
        stoppe();
        return;
      }
      // Zielt auf den Renderer, nicht auf "*": eine Begrüßung an jeden Origin
      // wäre der Anfang, den die Brücke gerade vermeiden soll.
      iframeRef.current?.contentWindow?.postMessage(
        { source: "builder-editor", type: "hello" },
        ORIGIN ?? "*",
      );
    };
    gruessen();
    // Der iframe meldet `load`, bevor sein React hydratisiert ist — die erste
    // Begrüßung kommt also regelmäßig zu früh. Deshalb wiederholen, bis er
    // antwortet.
    handschlag.current = setInterval(gruessen, 250);
    // Nach 10 Sekunden aufgeben: dann ist der iframe nicht die Vorschau, und
    // ein Intervall, das ewig weiterläuft, ist ein Leck.
    frist.current = setTimeout(stoppe, 10_000);
  }, [iframeRef, stoppe]);

  useEffect(() => stoppe, [stoppe]);

  useEffect(() => {
    function aufNachricht(e: MessageEvent) {
      if (!ORIGIN || e.origin !== ORIGIN) return;
      const data = e.data as CanvasMeldung | null;
      if (data?.source !== "builder-canvas") return;
      if (data.type === "ready") {
        begruesst.current = true;
        stoppe();
        return;
      }
      meldungRef.current(data);
    }
    window.addEventListener("message", aufNachricht);
    return () => window.removeEventListener("message", aufNachricht);
  }, [stoppe]);

  /** Die Vorschau zu einem Abschnitt scrollen.
   *
   *  Nötig, weil eine Auswahl AUSSERHALB der Vorschau (Ebenen-Baum,
   *  Abschnittsliste) sie bisher nicht bewegte: der Inspektor zeigte den
   *  richtigen Abschnitt, im Bild stand ein anderer (Prüfbericht D4).
   *
   *  Adressiert wird über die DB-ID und NICHT über einen Index: der Renderer
   *  nummeriert jeden Baumknoten (Abschnitt · Spalte · Baustein), der Editor
   *  kennt nur die Bausteine — dieselbe Verwechslung hat am 26.08.2026 die
   *  Auswahl auf den falschen Abschnitt gesetzt. Ein Baustein ohne ID (noch
   *  nie gespeichert) steht ohnehin am Ende und braucht keinen Sprung. */
  const scrolleZu = useCallback(
    (id: string | null) => {
      if (!id) return;
      iframeRef.current?.contentWindow?.postMessage(
        { source: "builder-editor", type: "scrollTo", id },
        ORIGIN ?? "*",
      );
    },
    [iframeRef],
  );

  const sendeStil = useCallback(
    (id: string | null, settings: Record<string, unknown>, span: number | null = null) => {
      // Ohne ID gibt es drüben nichts zu finden: ein Baustein, der noch nie
      // gespeichert wurde, steht in der Vorschau ohnehin noch nicht.
      if (!id) return;
      iframeRef.current?.contentWindow?.postMessage(
        { source: "builder-editor", type: "stil", id, settings, span },
        ORIGIN ?? "*",
      );
    },
    [iframeRef],
  );

  return { iframeBereit, scrolleZu, sendeStil };
}
