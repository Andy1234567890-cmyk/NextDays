"use client";

// Screen-Raum-Chrome der Canvas-Bühne: Werkzeug-Button (Toolbar + untere
// Leiste), die 8 Frame-Ziehgriffe und die Snapping-Guides (rote Ausrichtungs-
// linien + pinke Abstandsmaße), die nur während eines Frame-Drags sichtbar sind.
import { Icon } from "@iconify/react";

import { type Camera, worldToScreen } from "../use-camera";

export function ToolBtn({
  icon,
  label,
  active = false,
  onClick,
}: {
  icon: string;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={
        "flex size-8 items-center justify-center rounded-md transition " +
        (active
          ? "bg-secondary text-foreground"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground")
      }
    >
      <Icon icon={icon} className="size-4" />
    </button>
  );
}

// Einer von 8 Ziehgriffen (4 Ecken + 4 Kanten), Framer-Stil. hx/hy ∈ {-1,0,1}
// verorten den Griff an der Frame-Box: -1 = links/oben, +1 = rechts/unten,
// 0 = Mitte der Achse. Die sichtbare Marke (Punkt bzw. Kantenbalken) wird gegen
// den Zoom normalisiert (1/zoom), damit Griffe wie in Framer stets gleich groß
// bleiben. Der ganze Frame zeigt die Griffe nur bei Hover (group-hover/frame).
export function ResizeHandle({
  hx,
  hy,
  zoom,
  onStart,
}: {
  hx: -1 | 0 | 1;
  hy: -1 | 0 | 1;
  zoom: number;
  onStart: (e: React.MouseEvent) => void;
}) {
  // Position an der Box-Kante (%), zentriert per translate(-50%,-50%).
  const left = hx === -1 ? "0%" : hx === 1 ? "100%" : "50%";
  const top = hy === -1 ? "0%" : hy === 1 ? "100%" : "50%";
  const isCorner = hx !== 0 && hy !== 0;
  // Cursor je Griff (Framer: nwse/nesw/ns/ew).
  const cursor = isCorner
    ? hx === hy
      ? "nwse-resize"
      : "nesw-resize"
    : hx !== 0
      ? "ew-resize"
      : "ns-resize";
  // Trefferfläche (konstant, gegen Zoom normalisiert).
  const hit = 14 / zoom;
  const dot = 9 / zoom;
  const edge = 2 / zoom;
  return (
    <div
      onMouseDown={onStart}
      style={{
        position: "absolute",
        left,
        top,
        width: isCorner ? hit : hx !== 0 ? hit : "100%",
        height: isCorner ? hit : hy !== 0 ? hit : "100%",
        transform: "translate(-50%, -50%)",
        cursor,
      }}
      className="z-40 flex items-center justify-center opacity-0 transition group-hover/frame:opacity-100"
    >
      {/* Kantenbalken (nur Kanten-Griffe) */}
      {!isCorner ? (
        <span
          style={
            hx !== 0
              ? { width: edge, height: "100%" }
              : { width: "100%", height: edge }
          }
          className="bg-primary"
        />
      ) : null}
      {/* Marke: Eck-Griffe → Quadrat, Kanten-Griffe → runder Punkt (Framer). */}
      <span
        style={{ width: dot, height: dot, borderWidth: edge }}
        className={
          "absolute border-primary bg-background " +
          (isCorner ? "rounded-[2px]" : "rounded-full")
        }
      />
    </div>
  );
}

// Framer-Snapping-Guides, die NUR während eines Frame-Drags sichtbar sind:
// rote Ausrichtungslinien (Kanten fluchten) + pinke Abstandsmaße (Gap zwischen
// zwei benachbarten Flächen). Alle Werte in Weltkoordinaten.
export type SnapGuides = {
  lines: { axis: "x" | "y"; pos: number; from: number; to: number }[];
  gaps: {
    axis: "x" | "y";
    pos: number; // Querachse (Mitte des Zwischenraums)
    start: number;
    end: number;
    dist: number;
  }[];
};

// Snapping-Guides im SCREEN-Raum: rote Ausrichtungslinien laufen durchgezogen
// von Rand zu Rand (wie Framer), pinke Abstandsmaße sitzen mittig im
// Zwischenraum. Nur die Achsen-Position kommt per worldToScreen aus
// Weltkoordinaten.
export function SnapGuidesOverlay({
  guides,
  camera,
}: {
  guides: SnapGuides;
  camera: Camera;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {guides.lines.map((l, i) => {
        const s = worldToScreen({ x: l.pos, y: l.pos }, camera);
        return l.axis === "x" ? (
          <div key={`vl-${i}`} className="absolute inset-y-0 bg-red-500" style={{ left: s.x, width: 1 }} />
        ) : (
          <div key={`hl-${i}`} className="absolute inset-x-0 bg-red-500" style={{ top: s.y, height: 1 }} />
        );
      })}
      {guides.gaps.map((g, i) => {
        // Endpunkte + Querposition in Screen-Koordinaten umrechnen.
        const a = worldToScreen({ x: g.axis === "x" ? g.start : g.pos, y: g.axis === "x" ? g.pos : g.start }, camera);
        const b = worldToScreen({ x: g.axis === "x" ? g.end : g.pos, y: g.axis === "x" ? g.pos : g.end }, camera);
        const midX = (a.x + b.x) / 2;
        const midY = (a.y + b.y) / 2;
        return g.axis === "x" ? (
          <div key={`gx-${i}`}>
            <div className="absolute" style={{ left: a.x, top: a.y, width: b.x - a.x, height: 1, backgroundColor: "#ec4899" }} />
            <div className="absolute -translate-x-1/2 -translate-y-1/2 rounded px-1 py-0.5 text-[0.625rem] font-semibold text-white" style={{ left: midX, top: midY, backgroundColor: "#ec4899" }}>{g.dist}</div>
          </div>
        ) : (
          <div key={`gy-${i}`}>
            <div className="absolute" style={{ left: a.x, top: a.y, height: b.y - a.y, width: 1, backgroundColor: "#ec4899" }} />
            <div className="absolute -translate-x-1/2 -translate-y-1/2 rounded px-1 py-0.5 text-[0.625rem] font-semibold text-white" style={{ left: midX, top: midY, backgroundColor: "#ec4899" }}>{g.dist}</div>
          </div>
        );
      })}
    </div>
  );
}
