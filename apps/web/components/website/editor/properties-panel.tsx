"use client";

// Rechter Inspektor im Framer-Stil — dünner Einstieg: wählt je nach Auswahl
// den passenden Inspektor. Die Bausteine liegen in ./inspector/*:
//  • Nichts gewählt → SeitenInspektor (Haltepunkt/Typography/Stile der Seite)
//  • Frame gewählt  → FrameInspektor (voller Framer-Inspektor)
//  • Block gewählt  → ElementInspektor (+ block-spezifische Felder)
import { useEditor } from "@craftjs/core";

import { ElementInspektor } from "./inspector/element-inspektor";
import { FrameInspektor } from "./inspector/frame-inspektor";
import { SeitenInspektor } from "./inspector/seiten-inspektor";

export function PropertiesPanel() {
  const { activeId, activeName } = useEditor((state) => {
    const id = state.events.selected.values().next().value as string | undefined;
    const okId = id && id !== "ROOT" ? id : null;
    return { activeId: okId, activeName: okId ? state.nodes[okId]?.data.displayName ?? "" : "" };
  });

  if (!activeId) return <SeitenInspektor />;
  // Frame = frei positionierbares Objekt → voller Frame-Inspektor (Framer).
  if (activeName === "Frame") return <FrameInspektor id={activeId} />;
  return <ElementInspektor id={activeId} />;
}
