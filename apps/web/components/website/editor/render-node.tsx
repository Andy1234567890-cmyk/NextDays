"use client";

// onRender-Wrapper: wendet die im Style-Inspektor gesetzten Stil-Settings
// (Opazität, Sichtbarkeit, Radius, Drehung) auf JEDEN gerenderten Block an —
// so wirkt der Inspektor live auf der Canvas.
import { useNode } from "@craftjs/core";

export function RenderNode({ render }: { render: React.ReactElement }) {
  const { opacity, visible, radius, rotation } = useNode((node) => {
    const p = node.data.props as Record<string, unknown>;
    return {
      opacity: typeof p.opacity === "number" ? p.opacity : 1,
      visible: typeof p.visible === "boolean" ? p.visible : true,
      radius: typeof p.radius === "number" ? p.radius : 0,
      rotation: typeof p.rotation === "number" ? p.rotation : 0,
    };
  });

  const style: React.CSSProperties = {};
  // „Sichtbar = Nein": im EDITOR NICHT entfernen (wie Framer), sondern ausgrauen
  // (halbtransparent + grayscale), damit die Node anklick-/bearbeitbar bleibt.
  // Der echte Ausblend-Effekt greift erst im builder-Renderer.
  if (!visible) {
    style.opacity = 0.4;
    style.filter = "grayscale(1)";
  } else if (opacity !== 1) {
    style.opacity = opacity;
  }
  if (radius > 0) {
    style.borderRadius = `${radius}px`;
    style.overflow = "hidden";
  }
  if (rotation !== 0) style.transform = `rotate(${rotation}deg)`;

  // Kein zusätzliches Wrapper-Element, wenn nichts zu tun ist (hält das DOM
  // schlank und Crafts Selektion intakt).
  if (Object.keys(style).length === 0) return render;
  return <div style={style}>{render}</div>;
}
