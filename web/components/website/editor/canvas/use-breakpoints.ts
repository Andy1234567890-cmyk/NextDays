"use client";

// Breakpoints (wie Framer): mehrere Device-Flächen NEBENEINANDER. Genau EINE
// ist aktiv (editierbar, hält den Craft-Content); die anderen sind Live-
// Spiegel derselben Seite in ihrer Breite. `x` = Weltposition (frei
// verschiebbar). Die aktive Breite fließt in `frameWidth` (Alias) → die
// bestehende Resize-/Zoom-Logik bleibt unverändert.
//
// Der Hook hält den GESAMTEN Flächen-State: aktive Fläche, Breite/Höhe je
// Breakpoint, gemessene Auto-Höhe, ⊕-Menü/Custom-Dialog, freies Verschieben
// mit Snapping-Guides und den 8-Griff-Resize des aktiven Frames.
import {
  type MouseEvent as ReactMouseEvent,
  type RefObject,
  useEffect,
  useState,
} from "react";

import { FRAME_MAX, FRAME_MIN } from "../frame-context";
import type { Camera } from "../use-camera";
import type { Breakpoint } from "./breakpoints";
import type { SnapGuides } from "./chrome";

export function useBreakpoints({
  camRef,
  frameRef,
  zoom,
}: {
  camRef: { readonly current: Camera };
  frameRef: RefObject<HTMLDivElement | null>;
  zoom: number;
}) {
  const [breakpoints, setBreakpoints] = useState<Breakpoint[]>([
    { id: "desktop", name: "Desktop", width: 1200, x: 0, y: 0, heightMode: "auto", fixedHeight: 0 },
  ]);
  const [activeBpId, setActiveBpId] = useState("desktop");
  const activeBp = breakpoints.find((b) => b.id === activeBpId) ?? breakpoints[0];
  const frameWidth = activeBp.width;
  // Ein einzelnes Feld des AKTIVEN Breakpoints ändern (Breite/Höhe/Modus …).
  const patchActiveBp = (patch: Partial<Breakpoint>) =>
    setBreakpoints((prev) => prev.map((b) => (b.id === activeBpId ? { ...b, ...patch } : b)));
  const setFrameWidth = (updater: number | ((w: number) => number)) =>
    patchActiveBp({ width: typeof updater === "function" ? updater(activeBp.width) : updater });
  // Höhe pro Breakpoint (Desktop/Tablet/Mobil unterschiedlich lang möglich).
  const heightMode = activeBp.heightMode;
  const fixedHeight = activeBp.fixedHeight;
  const setHeightMode = (m: "auto" | "fixed") => patchActiveBp({ heightMode: m });
  const setFixedHeight = (updater: number | ((h: number) => number)) =>
    patchActiveBp({ fixedHeight: typeof updater === "function" ? updater(activeBp.fixedHeight) : updater });
  const [dragging, setDragging] = useState(false);
  const [frameHeight, setFrameHeight] = useState(0); // gemessene Auto-Höhe

  // Breakpoint-Menü (⊕ am Frame, wie Framer): Tablet/Phone/Custom.
  const [bpMenu, setBpMenu] = useState(false);
  const [bpCustom, setBpCustom] = useState(false);

  // NEUE Device-Fläche erzeugen (wie Framer): rechts neben der letzten Fläche
  // anlegen und aktiv machen. Kein Ändern der bestehenden Breite.
  const GAP = 80; // Weltabstand zwischen Flächen
  const addBreakpoint = (name: string, width: number) => {
    setBreakpoints((prev) => {
      if (prev.some((b) => b.id === name.toLowerCase())) {
        // Name existiert → eindeutige ID.
      }
      const rightmost = prev.reduce((m, b) => Math.max(m, b.x + b.width), 0);
      const id = `${name.toLowerCase()}-${prev.length}`;
      // Neue Fläche startet mit Auto-Höhe (folgt dem Inhalt in ihrer Breite).
      const bp: Breakpoint = { id, name, width, x: rightmost + GAP, y: 0, heightMode: "auto", fixedHeight: 0 };
      setActiveBpId(id);
      return [...prev, bp];
    });
    setBpMenu(false);
    setBpCustom(false);
  };

  // Frame-Höhe live messen (fürs Maß-Badge beim Ziehen).
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setFrameHeight(Math.round(el.getBoundingClientRect().height / zoom)));
    ro.observe(el);
    setFrameHeight(Math.round(el.getBoundingClientRect().height / zoom));
    return () => ro.disconnect();
  }, [zoom, frameWidth, frameRef]);

  const applyWidth = (w: number) =>
    setFrameWidth(Math.round(Math.min(FRAME_MAX, Math.max(FRAME_MIN, w))));
  const applyFixedHeight = (h: number) => setFixedHeight(Math.max(200, Math.round(h)));

  // Höhe eines Breakpoints in Weltpixeln: fester Wert oder – als Näherung – die
  // gemessene Höhe des aktiven Frames (Auto-Höhe).
  const bpHeight = (b: Breakpoint) =>
    b.heightMode === "fixed" && b.fixedHeight
      ? b.fixedHeight
      : frameHeight || 640;

  // Snapping-Guides, nur während eines Frame-Drags gefüllt (Weltkoordinaten).
  const [guides, setGuides] = useState<SnapGuides>({ lines: [], gaps: [] });

  // Frame frei verschieben (Drag am Frame-Label, wie Framer). Die Maus-Delta
  // wird durch den Zoom geteilt, um Weltkoordinaten (x/y des Breakpoints) zu
  // bewegen. Beim Aufsetzen wird der Frame aktiv gesetzt. Beim Ziehen rasten
  // Kanten an anderen Flächen ein (rote Linien) und Abstände werden pink gezeigt.
  const [movingFrame, setMovingFrame] = useState(false);
  function startFrameMove(e: ReactMouseEvent, bpId: string) {
    e.preventDefault();
    e.stopPropagation();
    setActiveBpId(bpId);
    setMovingFrame(true);
    let px = e.clientX;
    let py = e.clientY;
    const SNAP = 6; // Einrast-Toleranz in Weltpixeln
    const onMove = (ev: MouseEvent) => {
      const dx = (ev.clientX - px) / camRef.current.z;
      const dy = (ev.clientY - py) / camRef.current.z;
      px = ev.clientX;
      py = ev.clientY;
      setBreakpoints((prev) => {
        const moving = prev.find((b) => b.id === bpId);
        if (!moving) return prev;
        let nx = moving.x + dx;
        let ny = moving.y + dy;
        const w = moving.width;
        const h = bpHeight(moving);
        const others = prev.filter((b) => b.id !== bpId);

        // Kandidaten-Kanten je Achse: [Position des bewegten Frames, Ziel].
        const lines: SnapGuides["lines"] = [];
        // vertikale Ausrichtung (x-Kanten: links/mitte/rechts)
        const myX = [nx, nx + w / 2, nx + w];
        for (const o of others) {
          const oX = [o.x, o.x + o.width / 2, o.x + o.width];
          for (let i = 0; i < myX.length; i++) {
            for (const ox of oX) {
              if (Math.abs(myX[i] - ox) <= SNAP) {
                nx += ox - myX[i]; // einrasten
                const y1 = Math.min(ny, o.y);
                const y2 = Math.max(ny + h, o.y + bpHeight(o));
                lines.push({ axis: "x", pos: ox, from: y1, to: y2 });
              }
            }
          }
        }
        // horizontale Ausrichtung (y-Kanten: oben/mitte/unten)
        const myY = [ny, ny + h / 2, ny + h];
        for (const o of others) {
          const oY = [o.y, o.y + bpHeight(o) / 2, o.y + bpHeight(o)];
          for (let i = 0; i < myY.length; i++) {
            for (const oy of oY) {
              if (Math.abs(myY[i] - oy) <= SNAP) {
                ny += oy - myY[i];
                const x1 = Math.min(nx, o.x);
                const x2 = Math.max(nx + w, o.x + o.width);
                lines.push({ axis: "y", pos: oy, from: x1, to: x2 });
              }
            }
          }
        }

        // Pinke Abstandsmaße: horizontaler Gap zu Flächen, die sich vertikal
        // mit dem bewegten Frame überlappen (nebeneinander); analog vertikal.
        const gaps: SnapGuides["gaps"] = [];
        for (const o of others) {
          const vOverlap = ny < o.y + bpHeight(o) && ny + h > o.y;
          if (vOverlap) {
            const midY =
              (Math.max(ny, o.y) + Math.min(ny + h, o.y + bpHeight(o))) / 2;
            if (o.x + o.width <= nx) {
              gaps.push({ axis: "x", pos: midY, start: o.x + o.width, end: nx, dist: Math.round(nx - (o.x + o.width)) });
            } else if (nx + w <= o.x) {
              gaps.push({ axis: "x", pos: midY, start: nx + w, end: o.x, dist: Math.round(o.x - (nx + w)) });
            }
          }
          const hOverlap = nx < o.x + o.width && nx + w > o.x;
          if (hOverlap) {
            const midX =
              (Math.max(nx, o.x) + Math.min(nx + w, o.x + o.width)) / 2;
            if (o.y + bpHeight(o) <= ny) {
              gaps.push({ axis: "y", pos: midX, start: o.y + bpHeight(o), end: ny, dist: Math.round(ny - (o.y + bpHeight(o))) });
            } else if (ny + h <= o.y) {
              gaps.push({ axis: "y", pos: midX, start: ny + h, end: o.y, dist: Math.round(o.y - (ny + h)) });
            }
          }
        }

        setGuides({ lines, gaps });
        return prev.map((b) => (b.id === bpId ? { ...b, x: nx, y: ny } : b));
      });
    };
    const onUp = () => {
      setMovingFrame(false);
      setGuides({ lines: [], gaps: [] }); // Guides beim Loslassen ausblenden
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  // EIN Resize-Handler für ALLE 8 Handles (4 Ecken + 4 Kanten), wie in Framer.
  // hx/hy geben an, welche Kante das Handle bewegt: -1 = linke/obere,
  // +1 = rechte/untere, 0 = Achse unverändert. Delta wird in Welt-Pixel
  // umgerechnet (÷ Zoom). Der Frame sitzt links im Welt-Ursprung: die rechte
  // Kante wächst frei, die linke Kante verschiebt zusätzlich die Kamera, damit
  // der Frame optisch an der linken Kante „stehen" bleibt.
  function startResize(e: ReactMouseEvent, hx: -1 | 0 | 1, hy: -1 | 0 | 1) {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = frameWidth;
    const startH = heightMode === "fixed" && fixedHeight ? fixedHeight : frameHeight || 640;
    if (hy !== 0) {
      setHeightMode("fixed");
      setFixedHeight(startH);
    }
    function onMove(ev: MouseEvent) {
      const z = camRef.current.z;
      if (hx !== 0) {
        const dW = ((ev.clientX - startX) / z) * hx;
        applyWidth(startW + dW);
      }
      if (hy !== 0) {
        const dH = ((ev.clientY - startY) / z) * hy;
        applyFixedHeight(startH + dH);
      }
    }
    function onUp() {
      setDragging(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  return {
    breakpoints,
    activeBp,
    activeBpId,
    setActiveBpId,
    frameWidth,
    setFrameWidth,
    heightMode,
    fixedHeight,
    setHeightMode,
    setFixedHeight,
    frameHeight,
    applyWidth,
    applyFixedHeight,
    addBreakpoint,
    bpMenu,
    setBpMenu,
    bpCustom,
    setBpCustom,
    guides,
    movingFrame,
    startFrameMove,
    dragging,
    startResize,
  };
}
