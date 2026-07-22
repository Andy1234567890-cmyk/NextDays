"use client";

// Kamera-Modell für die unendliche Canvas-Bühne (Figma-/Framer-Prinzip).
// Die Bühne ist ein fester, überlauf-verborgener Ausschnitt („Viewport"); alles
// Sichtbare wird über EINE Transform der Welt-Schicht bewegt/gezoomt — deshalb
// gibt es KEINE Scrollbars. Bewegung ausschließlich über Pan/Zoom der Kamera.
//
// Mathematik kanonisch nach Steve Ruiz „Creating a Zoom UI":
//   screenToWorld(p) = { x: p.x/z - cam.x, y: p.y/z - cam.y }
//   worldToScreen(p) = { x: (p.x + cam.x)*z, y: (p.y + cam.y)*z }
//   panCamera(dx,dy) verschiebt cam um Screen-Delta ÷ Zoom
//   zoomCamera(point,dz) hält den Welt-Punkt unter dem Cursor fix
import { createContext, useCallback, useContext, useRef, useState } from "react";

export type Camera = { x: number; y: number; z: number };
export type Point = { x: number; y: number };

// Zoom-Kontext: Nodes (FrameNode-Handles) rechnen Screen-Deltas ÷ Zoom in
// Welt-Pixel um. Der EditorShell stellt den aktuellen Zoom bereit.
const ZoomCtx = createContext<number>(1);
export const ZoomProvider = ZoomCtx.Provider;
export function useZoom(): number {
  return useContext(ZoomCtx);
}

export const ZOOM_MIN = 0.05;
export const ZOOM_MAX = 4;

export function clampZoom(z: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
}

export function screenToWorld(p: Point, cam: Camera): Point {
  return { x: p.x / cam.z - cam.x, y: p.y / cam.z - cam.y };
}

export function worldToScreen(p: Point, cam: Camera): Point {
  return { x: (p.x + cam.x) * cam.z, y: (p.y + cam.y) * cam.z };
}

// CSS-Transform der Welt-Schicht (transform-origin: 0 0).
// Erst verschieben (in Screen-Pixeln = cam.x·z), dann skalieren.
export function worldTransform(cam: Camera): string {
  return `translate(${cam.x * cam.z}px, ${cam.y * cam.z}px) scale(${cam.z})`;
}

export function panCamera(cam: Camera, dx: number, dy: number): Camera {
  return { x: cam.x - dx / cam.z, y: cam.y - dy / cam.z, z: cam.z };
}

// Zoom Richtung Cursor. `point` in Screen-Pixeln relativ zum Viewport-Ursprung.
export function zoomCamera(cam: Camera, point: Point, dz: number): Camera {
  const z2 = clampZoom(cam.z - dz * cam.z);
  const p1 = screenToWorld(point, cam);
  const p2 = screenToWorld(point, { ...cam, z: z2 });
  return { x: cam.x + (p2.x - p1.x), y: cam.y + (p2.y - p1.y), z: z2 };
}

// Zoom auf festen Faktor, verankert an einem Screen-Punkt (für +/−, 100 %).
export function zoomToAt(cam: Camera, point: Point, z2raw: number): Camera {
  const z2 = clampZoom(z2raw);
  const p1 = screenToWorld(point, cam);
  const p2 = screenToWorld(point, { ...cam, z: z2 });
  return { x: cam.x + (p2.x - p1.x), y: cam.y + (p2.y - p1.y), z: z2 };
}

// Eine Welt-Box (x,y,w,h) mittig in den Viewport einpassen (Zoom-to-fit).
export function fitBox(
  box: { x: number; y: number; w: number; h: number },
  vp: { w: number; h: number },
  padding = 80,
): Camera {
  const z = clampZoom(
    Math.min((vp.w - padding * 2) / box.w, (vp.h - padding * 2) / box.h),
  );
  return {
    z,
    x: (vp.w / z - box.w) / 2 - box.x,
    y: (vp.h / z - box.h) / 2 - box.y,
  };
}

export function useCamera(initial: Camera = { x: 0, y: 0, z: 1 }) {
  const [camera, setCamera] = useState<Camera>(initial);
  // Ref hält immer den aktuellen Wert für Event-Handler ohne Neuanmeldung.
  const camRef = useRef(camera);
  camRef.current = camera;

  const update = useCallback((next: Camera | ((c: Camera) => Camera)) => {
    setCamera((prev) => {
      const n = typeof next === "function" ? next(prev) : next;
      camRef.current = n;
      return n;
    });
  }, []);

  return { camera, camRef, setCamera: update };
}
