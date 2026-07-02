"use client";

// Geteilter Frame-Zustand (Breite/Höhe des Device-Frames), damit Canvas-Frame,
// Ziehgriffe und der rechte Seiten-Inspektor DIESELBE Breite bearbeiten —
// bidirektional: Inspektor-Eingabe bewegt den Frame, Frame-Ziehen aktualisiert
// den Inspektor.
import { createContext, useContext } from "react";

export type FrameState = {
  width: number;
  setWidth: (w: number) => void;
  // Höhe: "auto" folgt dem Inhalt (gemessen), "fixed" ist ein fester Wert.
  autoHeight: number; // gemessene Ist-Höhe (bei Auto)
  heightMode: "auto" | "fixed";
  fixedHeight: number; // gesetzter Wert (bei Fixed)
  setHeightMode: (m: "auto" | "fixed") => void;
  setFixedHeight: (h: number) => void;
  // Globale Schrift der Seite (Framer „Typography" → Body-Font). Wird als
  // CSS-Variable am Canvas-Root gesetzt; Elemente ohne eigene Font erben sie.
  fontFamily: string | null;
  setFontFamily: (family: string | null) => void;
  // Code-Editor (Framer „Edit Code"): ersetzt die Canvas-Mitte durch einen
  // vollwertigen Editor (Breadcrumb + Zeilennummern + Highlighting). `onSave`
  // persistiert den Quelltext zurück in die Node-Prop.
  openCodeEditor: (opts: { file: string; source: string; onSave: (src: string) => void }) => void;
};

const Ctx = createContext<FrameState | null>(null);

export function FrameProvider({
  value,
  children,
}: {
  value: FrameState;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Frame-Zustand lesen/schreiben. null außerhalb des Providers. */
export function useFrame(): FrameState | null {
  return useContext(Ctx);
}

export const FRAME_MIN = 280;
export const FRAME_MAX = 2560;
