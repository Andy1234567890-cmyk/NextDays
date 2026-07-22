"use client";

// Zeichenmodus-Overlay: Fadenkreuz über der Canvas. Drücken+Ziehen zieht ein
// Vorschau-Rechteck (mit Live-Maß) auf; beim Loslassen wird ein Frame mit genau
// dieser Geometrie erstellt. Koordinaten relativ zum Device-Frame (÷ Zoom).
import { useRef, useState } from "react";

import { useInsert } from "../insert-panel";

export function FrameDrawLayer({
  zoom,
  frameRef,
  onDone,
}: {
  zoom: number;
  frameRef: React.RefObject<HTMLDivElement | null>;
  onDone: () => void;
}) {
  const insert = useInsert();
  // Vorschau-Rechteck in SCREEN-Koordinaten relativ zum Overlay.
  const [rect, setRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const startRef = useRef<{ sx: number; sy: number } | null>(null);
  const layerRef = useRef<HTMLDivElement>(null);

  function down(e: React.MouseEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    const base = layerRef.current?.getBoundingClientRect();
    const sx = e.clientX - (base?.left ?? 0);
    const sy = e.clientY - (base?.top ?? 0);
    startRef.current = { sx, sy };
    setRect({ x: sx, y: sy, w: 0, h: 0 });

    const move = (ev: MouseEvent) => {
      const cx = ev.clientX - (base?.left ?? 0);
      const cy = ev.clientY - (base?.top ?? 0);
      const x = Math.min(sx, cx);
      const y = Math.min(sy, cy);
      setRect({ x, y, w: Math.abs(cx - sx), h: Math.abs(cy - sy) });
    };
    const up = (ev: MouseEvent) => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      const base2 = layerRef.current?.getBoundingClientRect();
      const cx = ev.clientX - (base2?.left ?? 0);
      const cy = ev.clientY - (base2?.top ?? 0);
      const rx = Math.min(sx, cx);
      const ry = Math.min(sy, cy);
      const rw = Math.abs(cx - sx);
      const rh = Math.abs(cy - sy);
      setRect(null);
      if (rw > 4 && rh > 4 && insert) {
        // Screen-Rechteck → Device-Frame-lokale Welt-Koordinaten (÷ Zoom).
        const frameBox = frameRef.current?.getBoundingClientRect();
        const fx = frameBox ? frameBox.left - (base2?.left ?? 0) : 0;
        const fy = frameBox ? frameBox.top - (base2?.top ?? 0) : 0;
        insert.createFrameAt((rx - fx) / zoom, (ry - fy) / zoom, rw / zoom, rh / zoom);
      }
      onDone();
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  return (
    <div
      ref={layerRef}
      onMouseDown={down}
      className="absolute inset-0 z-40"
      style={{ cursor: "crosshair" }}
    >
      {rect ? (
        <>
          <div
            className="absolute border border-[#0099ff] bg-[#0099ff]/10"
            style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
          />
          <div
            className="pointer-events-none absolute rounded bg-[#0099ff] px-1.5 py-0.5 text-xs font-medium text-white"
            style={{ left: rect.x + rect.w + 6, top: rect.y + rect.h + 6 }}
          >
            {Math.round(rect.w / zoom)} × {Math.round(rect.h / zoom)}
          </div>
        </>
      ) : (
        <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-foreground/80 px-3 py-1 text-xs text-background">
          Frame aufziehen — klicken und ziehen
        </div>
      )}
    </div>
  );
}
