"use client";

// Kamera-Eingabe der unendlichen Bühne: Hand-Werkzeug (Toolbar-Klick, H,
// gehaltene Leertaste oder mittlere Maustaste → Pan), Wheel (⌘/Ctrl bzw.
// Trackpad-Pinch → Zoom-zum-Cursor, sonst Pan) und die Zoom-Schaltflächen
// (verankert am Viewport-Zentrum). `viewportRef` ist der überlauf-verborgene
// Ausschnitt, an dem alle Listener hängen.
import {
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { type Camera, panCamera, useCamera, zoomCamera, zoomToAt } from "../use-camera";

export function useCanvasCamera(initial: Camera) {
  const { camera, camRef, setCamera } = useCamera(initial);
  const zoom = camera.z;
  const viewportRef = useRef<HTMLDivElement>(null);
  // Hand-Werkzeug: entweder dauerhaft per Toolbar-Klick (handTool) ODER temporär
  // per gehaltener Leertaste (spaceDown). Beides → Pan-Modus (Cursor grab).
  const [handTool, setHandTool] = useState(false);
  const [spaceDown, setSpaceDown] = useState(false);
  const panMode = handTool || spaceDown; // effektiver Hand-/Pan-Modus
  const [panning, setPanning] = useState(false);

  // Cursor-Position relativ zum Viewport-Ursprung (für Zoom-zum-Cursor).
  const pointerInViewport = useCallback((clientX: number, clientY: number) => {
    const r = viewportRef.current?.getBoundingClientRect();
    return { x: clientX - (r?.left ?? 0), y: clientY - (r?.top ?? 0) };
  }, []);

  // Leertaste (halten) schaltet das Hand-Werkzeug (Pan) ein.
  useEffect(() => {
    const isTyping = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return (
        !!el &&
        (el.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))
      );
    };
    const down = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      if (e.code === "Space") {
        e.preventDefault();
        setSpaceDown(true);
      } else if (e.key === "h" || e.key === "H") {
        // Framer-Shortcut: H schaltet das Hand-Werkzeug dauerhaft um.
        setHandTool((v) => !v);
      } else if (e.key === "v" || e.key === "V" || e.key === "Escape") {
        // V / Escape → zurück zum Zeiger.
        setHandTool(false);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceDown(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // Wheel: ⌘/Ctrl (bzw. Trackpad-Pinch) → Zoom-zum-Cursor, sonst Pan.
  // preventDefault verhindert Browser-Zoom/Scroll; deshalb non-passiv verankert.
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const pt = pointerInViewport(e.clientX, e.clientY);
      if (e.ctrlKey || e.metaKey) {
        setCamera(zoomCamera(camRef.current, pt, e.deltaY * 0.01));
      } else {
        setCamera(panCamera(camRef.current, -e.deltaX, -e.deltaY));
      }
    };
    vp.addEventListener("wheel", onWheel, { passive: false });
    return () => vp.removeEventListener("wheel", onWheel);
  }, [pointerInViewport, camRef, setCamera]);

  // Pan per Drag (Hand-Werkzeug via Leertaste ODER mittlere Maustaste).
  function startPan(e: ReactMouseEvent) {
    e.preventDefault();
    setPanning(true);
    let px = e.clientX;
    let py = e.clientY;
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - px;
      const dy = ev.clientY - py;
      px = ev.clientX;
      py = ev.clientY;
      setCamera(panCamera(camRef.current, -dx, -dy));
    };
    const onUp = () => {
      setPanning(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  // Zoom-Schaltflächen: verankert am Viewport-Zentrum.
  const viewportCenter = () => {
    const r = viewportRef.current?.getBoundingClientRect();
    return { x: (r?.width ?? 0) / 2, y: (r?.height ?? 0) / 2 };
  };
  const zoomBy = (factor: number) =>
    setCamera((c) => zoomToAt(c, viewportCenter(), c.z * factor));
  const zoomTo = (z: number) => setCamera((c) => zoomToAt(c, viewportCenter(), z));

  return {
    camera,
    camRef,
    setCamera,
    zoom,
    viewportRef,
    handTool,
    setHandTool,
    panMode,
    panning,
    startPan,
    zoomBy,
    zoomTo,
  };
}
