"use client";

// FrameNode: das frei positionierbare Framer-Objekt auf der Canvas — Body als
// motion.div (Auswirkungen/Overrides wirken real), Auswahl-Chrome mit 8 Zieh-
// griffen, Radius-Griffen und Abstands-Indikatoren.
import { useNode } from "@craftjs/core";
import { useTranslations } from "next-intl";
import { motion, useScroll, useTransform } from "motion/react";
import { useLayoutEffect, useRef, useState } from "react";

import { ensureGoogleFontLoaded } from "@/lib/website-fonts";

import { useZoom } from "../use-camera";
import {
  resolveConditionalBinding,
  resolveVarBool,
  resolveVarValue,
  useVariables,
} from "../variables-context";
import { frameBodyStyle, motionPropsFor } from "./frame-style";
import { FRAME_DEFAULTS, type FrameProps } from "./frame-types";
import { LeerHinweis } from "./shared";

export type Handle = { hx: -1 | 0 | 1; hy: -1 | 0 | 1; cursor: string };

export const FRAME_HANDLES: Handle[] = [
  { hx: -1, hy: -1, cursor: "nwse-resize" },
  { hx: 0, hy: -1, cursor: "ns-resize" },
  { hx: 1, hy: -1, cursor: "nesw-resize" },
  { hx: -1, hy: 0, cursor: "ew-resize" },
  { hx: 1, hy: 0, cursor: "ew-resize" },
  { hx: -1, hy: 1, cursor: "nesw-resize" },
  { hx: 0, hy: 1, cursor: "ns-resize" },
  { hx: 1, hy: 1, cursor: "nwse-resize" },
];

// Abstands-Indikatoren zu den Eltern-Rändern (wie Framer): vier gestrichelte
// Linien vom Frame-Rand nach außen bis zur Elternkante, je mit px-Wert-Pille.
// Koordinaten relativ zum Frame (0,0 = obere linke Frame-Ecke). Linienstärke
// und Pillen gegen den Zoom normalisiert, damit sie stets gleich groß bleiben.
export function DistanceGuides({
  zoom,
  w,
  h,
  left,
  top,
  right,
  bottom,
}: {
  zoom: number;
  w: number;
  h: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
}) {
  const thick = 1 / zoom;
  const label =
    "pointer-events-none absolute rounded bg-[#0099ff] px-1 py-px text-[0.625rem] font-medium leading-none text-white";
  const line = "pointer-events-none absolute";
  // gestrichelte Linie via repeating-linear-gradient (dünn, tint).
  const dash = (horizontal: boolean) => ({
    backgroundImage: `repeating-linear-gradient(${horizontal ? "90deg" : "0deg"}, #0099ff 0, #0099ff ${3 / zoom}px, transparent ${3 / zoom}px, transparent ${6 / zoom}px)`,
  });
  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      {/* LINKS: von Frame-Kante (x=0) nach links, Länge = left */}
      {left > 0 ? (
        <>
          <span className={line} style={{ top: h / 2, left: -left, width: left, height: thick, ...dash(true) }} />
          <span className={label} style={{ top: h / 2, left: -left / 2, transform: `translate(-50%,-50%) scale(${1 / zoom})` }}>{left}</span>
        </>
      ) : null}
      {/* RECHTS: von Frame-Kante (x=w) nach rechts, Länge = right */}
      {right > 0 ? (
        <>
          <span className={line} style={{ top: h / 2, left: w, width: right, height: thick, ...dash(true) }} />
          <span className={label} style={{ top: h / 2, left: w + right / 2, transform: `translate(-50%,-50%) scale(${1 / zoom})` }}>{right}</span>
        </>
      ) : null}
      {/* OBEN: von Frame-Kante (y=0) nach oben, Länge = top */}
      {top > 0 ? (
        <>
          <span className={line} style={{ left: w / 2, top: -top, height: top, width: thick, ...dash(false) }} />
          <span className={label} style={{ left: w / 2, top: -top / 2, transform: `translate(-50%,-50%) scale(${1 / zoom})` }}>{top}</span>
        </>
      ) : null}
      {/* UNTEN: von Frame-Kante (y=h) nach unten, Länge = bottom */}
      {bottom > 0 ? (
        <>
          <span className={line} style={{ left: w / 2, top: h, height: bottom, width: thick, ...dash(false) }} />
          <span className={label} style={{ left: w / 2, top: h + bottom / 2, transform: `translate(-50%,-50%) scale(${1 / zoom})` }}>{bottom}</span>
        </>
      ) : null}
    </div>
  );
}

// Frame-Körper mit angewandten Auswirkungen (Framer Motion). Getrennt vom
// FrameNode, damit die Motion-Hooks (Parallax) stabil laufen. Rendert den
// sichtbaren Körper als motion.div; Trigger-Effekte kommen aus motionPropsFor,
// Parallax bindet die Scroll-Position an einen y-Offset.
export function FrameBody({ p, children }: { p: FrameProps; children: React.ReactNode }) {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const parallax = p.effects?.find((e) => e.trigger === "parallax");
  const dist = parallax?.parallaxDistance ?? 0;
  // Scroll-Fortschritt des Körpers relativ zum Viewport → y-Verschiebung.
  const { scrollYProgress } = useScroll({
    target: bodyRef,
    offset: ["start end", "end start"],
  });
  const parallaxY = useTransform(scrollYProgress, [0, 1], [dist, -dist]);
  const mp = motionPropsFor(p.effects?.filter((e) => e.trigger !== "parallax"));
  // Code-Overrides (Framer-Template): die Beispiel-Overrides wirken real.
  // withRandomColor: eine Zufallsfarbe pro Mount (wie Framers Beispiel).
  const [randomFill] = useState(() => `hsl(${Math.round(Math.random() * 360)}, 80%, 60%)`);
  if (p.codeOverride === "withHover") mp.whileHover = { ...mp.whileHover, scale: 1.05 };
  if (p.codeOverride === "withRotate") {
    mp.animate = { ...mp.animate, rotate: 90 };
    mp.transition = { ...mp.transition, duration: 2 };
  }
  const overrideStyle = p.codeOverride === "withRandomColor" ? { background: randomFill } : null;
  return (
    <motion.div
      ref={bodyRef}
      // Scrollabschnitt: der Name wird zum #-Anker (id) des Frames; Google Bot
      // „Skip" setzt data-nosnippet (Framer „Accessibility" → Google Bot).
      id={p.scrollSection && p.scrollSectionName ? p.scrollSectionName : undefined}
      {...(p.googleBot === "no-snippet" ? { "data-nosnippet": "" } : {})}
      style={{ ...frameBodyStyle(p), ...overrideStyle, ...(parallax ? { y: parallaxY } : {}) }}
      whileHover={mp.whileHover}
      whileTap={mp.whileTap}
      initial={mp.initial}
      animate={mp.animate}
      whileInView={mp.whileInView}
      viewport={mp.viewport}
      transition={mp.transition}
    >
      {children}
    </motion.div>
  );
}

export function FrameNode(props: Partial<FrameProps> & { children?: React.ReactNode }) {
  const t = useTranslations("website");
  const {
    connectors: { connect },
    actions: { setProp },
    selected,
    hasChildren,
  } = useNode((node) => ({
    selected: node.events.selected,
    hasChildren: node.data.nodes.length > 0,
  }));
  const zoom = useZoom();
  const vars = useVariables();

  // Seiten-Maße verfolgen (für die Abstandsindikatoren zu den Rändern). Als
  // Bezug dient der DEVICE-FRAME (.group/frame) — die echte Seitenfläche —, NICHT
  // der unmittelbare Elternteil (der bei Auto-Höhe kollabiert). So passen sich
  // die Abstände beim Verlängern der Seite automatisch an.
  const selfRef = useRef<HTMLDivElement | null>(null);
  const [parentSize, setParentSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const self = selfRef.current;
    if (!self) return;
    const page = (self.closest(".group\\/frame") as HTMLElement | null) ?? self.parentElement;
    if (!page) return;
    const measure = () => setParentSize({ w: page.offsetWidth, h: page.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(page);
    // Auch den unmittelbaren Elternteil beobachten (Layout-Änderungen).
    if (self.parentElement) ro.observe(self.parentElement);
    return () => ro.disconnect();
  }, []);

  const p = { ...FRAME_DEFAULTS, ...props };
  // Gebundene Werte kommen aus der Seiten-Variable (Framer „Variable").
  if (props.opacityVar) {
    p.opacity = resolveVarValue(vars?.variables, props.opacityVar, p.opacity);
  }
  if (props.visibleVar) {
    p.visible = resolveVarBool(vars?.variables, props.visibleVar, p.visible);
  }
  // Conditional-Binding für Überlauf: löst Variable+Bedingung zum finalen Wert auf.
  if (props.overflowBinding) {
    const resolved = resolveConditionalBinding(props.overflowBinding, vars?.variables);
    if (resolved) p.overflow = resolved as FrameProps["overflow"];
  }
  if (props.radiusVar) p.radius = resolveVarValue(vars?.variables, props.radiusVar, p.radius);
  if (props.rotateVar) p.rotate = resolveVarValue(vars?.variables, props.rotateVar, p.rotate ?? 0);
  // Layout-Variablenbindung: numerische Felder (Lücke/Spalten/Zeilen/Polsterung)
  // aus number-Variablen; Enum-Felder (Richtung/Verteilen/Ausrichten) bleiben
  // an ihren Props, bis eine Option-Variable sie überschreibt (boolean → Umschalt).
  if (props.stackGapVar) p.stackGap = resolveVarValue(vars?.variables, props.stackGapVar, p.stackGap ?? 0);
  if (props.gridColumnsVar) p.gridColumns = resolveVarValue(vars?.variables, props.gridColumnsVar, p.gridColumns ?? 2);
  if (props.gridRowsVar) p.gridRows = resolveVarValue(vars?.variables, props.gridRowsVar, p.gridRows ?? 0);
  if (props.gridGapVar) p.gridGap = resolveVarValue(vars?.variables, props.gridGapVar, p.gridGap ?? 0);
  if (props.padVar) {
    const pv = resolveVarValue(vars?.variables, props.padVar, p.padTop ?? 0);
    p.padTop = pv; p.padRight = pv; p.padBottom = pv; p.padLeft = pv;
  }
  if (props.stackDirectionVar) p.stackDirection = resolveVarBool(vars?.variables, props.stackDirectionVar, p.stackDirection === "row") ? "row" : "column";
  // Element-Schrift zur Laufzeit laden (Google Fonts), damit sie sofort greift.
  if (p.fontFamily) ensureGoogleFontLoaded(p.fontFamily);
  // Hinweis: Das Ausgrauen bei „Sichtbar = Nein" macht zentral der RenderNode-
  // Wrapper (für ALLE Node-Typen) — hier NICHT zusätzlich, sonst doppelte Opazität.

  // Abstände zu den Eltern-Rändern (px).
  const distLeft = Math.round(p.x);
  const distTop = Math.round(p.y);
  const distRight = parentSize.w ? Math.round(parentSize.w - (p.x + p.w)) : 0;
  const distBottom = parentSize.h ? Math.round(parentSize.h - (p.y + p.h)) : 0;

  // Frame verschieben (Drag auf der Fläche, nicht auf einem Handle).
  function startMove(e: React.MouseEvent) {
    if (e.button !== 0) return;
    e.stopPropagation();
    const sx = e.clientX;
    const sy = e.clientY;
    const ox = p.x;
    const oy = p.y;
    const onMove = (ev: MouseEvent) => {
      setProp((s: FrameProps) => {
        s.x = Math.round(ox + (ev.clientX - sx) / zoom);
        s.y = Math.round(oy + (ev.clientY - sy) / zoom);
      });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  // An einem der 8 Griffe skalieren (Ecke = beide Achsen, Kante = eine).
  function startResize(e: React.MouseEvent, hx: -1 | 0 | 1, hy: -1 | 0 | 1) {
    e.stopPropagation();
    e.preventDefault();
    const sx = e.clientX;
    const sy = e.clientY;
    const o = { x: p.x, y: p.y, w: p.w, h: p.h };
    const onMove = (ev: MouseEvent) => {
      const dx = (ev.clientX - sx) / zoom;
      const dy = (ev.clientY - sy) / zoom;
      setProp((s: FrameProps) => {
        if (hx === 1) s.w = Math.max(20, Math.round(o.w + dx));
        if (hx === -1) { s.w = Math.max(20, Math.round(o.w - dx)); s.x = Math.round(o.x + (o.w - s.w)); }
        if (hy === 1) s.h = Math.max(20, Math.round(o.h + dy));
        if (hy === -1) { s.h = Math.max(20, Math.round(o.h - dy)); s.y = Math.round(o.y + (o.h - s.h)); }
      });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  // Eckenradius per Griff ziehen (wie Framer): der Griff sitzt innen an einer
  // Ecke; diagonales Ziehen nach INNEN vergrößert den Radius, nach außen
  // verkleinert ihn. Im „alle Ecken"-Modus wirkt es auf `radius`, im Einzel-
  // Modus auf die jeweilige Ecke. `cx/cy` = Richtung der Ecke (±1).
  function startRadius(e: React.MouseEvent, cx: -1 | 1, cy: -1 | 1) {
    e.stopPropagation();
    e.preventDefault();
    const sx = e.clientX;
    const sy = e.clientY;
    const perCorner = p.radiusMode === "corners";
    const cornerKey =
      cy === -1 ? (cx === -1 ? "radiusTL" : "radiusTR") : cx === -1 ? "radiusBL" : "radiusBR";
    const start = perCorner
      ? ((props as Record<string, number | undefined>)[cornerKey] ?? p.radius)
      : p.radius;
    // Max-Radius = halbe kürzere Seite.
    const maxR = Math.floor(Math.min(p.w, p.h) / 2);
    const onMove = (ev: MouseEvent) => {
      // Bewegung entlang der Diagonalen zur Frame-Mitte = mehr Radius. Beide
      // Achsen mitteln, in Frame-Koordinaten (durch Zoom teilen).
      const dxIn = ((ev.clientX - sx) / zoom) * cx * -1; // nach innen positiv
      const dyIn = ((ev.clientY - sy) / zoom) * cy * -1;
      const delta = (dxIn + dyIn) / 2;
      const next = Math.max(0, Math.min(maxR, Math.round(start + delta)));
      setProp((s: FrameProps) => {
        if (perCorner) {
          (s as unknown as Record<string, number>)[cornerKey] = next;
        } else {
          s.radius = next;
        }
      });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  return (
    <div
      ref={(r) => { selfRef.current = r; if (r) connect(r); }}
      onMouseDown={startMove}
      style={{
        position: "absolute",
        left: p.x,
        top: p.y,
        width: p.w,
        height: p.h,
        cursor: "move",
        ...(p.zIndex != null ? { zIndex: p.zIndex } : {}),
      }}
      className="group/fr"
    >
      {/* Sichtbarer Frame-Körper — hier greift der Überlauf-Clip. Getrennt vom
          Chrome, damit die Ziehgriffe NICHT weggeklippt werden. Als motion.div,
          damit die Auswirkungen (Hover/Press/Appear/Scroll/Parallax) greifen. */}
      <FrameBody p={p}>
        {hasChildren ? props.children : <LeerHinweis icon="ph:selection-plus" label="Frame" />}
      </FrameBody>

      {/* Auswahl-Chrome (Rahmen + 8 Ziehgriffe) — UNGEKLIPPT, über dem Körper.
          Nur wenn selektiert; gegen Zoom normalisiert (feste Pixelgröße). */}
      {selected ? (
        <>
          {/* Abstands-Indikatoren zu den Eltern-Rändern (wie Framer). */}
          <DistanceGuides
            zoom={zoom}
            w={p.w}
            h={p.h}
            left={distLeft}
            top={distTop}
            right={distRight}
            bottom={distBottom}
          />
          <span
            aria-hidden
            style={{ position: "absolute", inset: 0, borderWidth: 1.5 / zoom }}
            className="pointer-events-none z-40 border-[#0099ff]"
          />
          {FRAME_HANDLES.map((hd) => {
            const left = hd.hx === -1 ? 0 : hd.hx === 1 ? "100%" : "50%";
            const top = hd.hy === -1 ? 0 : hd.hy === 1 ? "100%" : "50%";
            const dot = 10 / zoom;
            const hit = 22 / zoom; // großzügige Trefferfläche (leicht greifbar)
            const bw = 2 / zoom;
            return (
              <span
                key={`${hd.hx}-${hd.hy}`}
                onMouseDown={(e) => startResize(e, hd.hx, hd.hy)}
                style={{
                  position: "absolute",
                  left,
                  top,
                  width: hit,
                  height: hit,
                  transform: "translate(-50%, -50%)",
                  cursor: hd.cursor,
                }}
                className="z-50 flex items-center justify-center"
              >
                <span
                  style={{ width: dot, height: dot, borderWidth: bw }}
                  className="rounded-[2px] border-[#0099ff] bg-white shadow-sm"
                />
              </span>
            );
          })}

          {/* Radius-Griffe (wie Framer): kleiner Kreis innen an jeder Ecke.
              Diagonales Ziehen nach innen rundet die Ecke ab. Der Griff sitzt um
              den aktuellen Radius von der Ecke versetzt (wandert mit) — mit einem
              Mindestabstand, damit er bei radius=0 greifbar in der Ecke bleibt. */}
          {([[-1, -1], [1, -1], [-1, 1], [1, 1]] as const).map(([cx, cy]) => {
            const perCorner = p.radiusMode === "corners";
            const cornerKey = cy === -1 ? (cx === -1 ? "radiusTL" : "radiusTR") : cx === -1 ? "radiusBL" : "radiusBR";
            const rVal = perCorner
              ? ((props as Record<string, number | undefined>)[cornerKey] ?? p.radius)
              : p.radius;
            const maxOff = Math.min(p.w, p.h) / 2;
            // Versatz von der Ecke nach innen = Radius, mind. 14px (greifbar).
            const off = Math.min(Math.max(rVal, 14 / zoom), maxOff);
            const ring = 9 / zoom;
            const bw = 1.5 / zoom;
            return (
              <span
                key={`r-${cx}-${cy}`}
                onMouseDown={(e) => startRadius(e, cx, cy)}
                title={t("editor.roundCorners")}
                style={{
                  position: "absolute",
                  left: cx === -1 ? off : undefined,
                  right: cx === 1 ? off : undefined,
                  top: cy === -1 ? off : undefined,
                  bottom: cy === 1 ? off : undefined,
                  width: 20 / zoom,
                  height: 20 / zoom,
                  transform: "translate(" + (cx === -1 ? "-50%" : "50%") + "," + (cy === -1 ? "-50%" : "50%") + ")",
                  cursor: "nwse-resize",
                }}
                className="z-50 flex items-center justify-center"
              >
                <span
                  style={{ width: ring, height: ring, borderWidth: bw }}
                  className="rounded-full border-[#0099ff] bg-white shadow-sm"
                />
              </span>
            );
          })}
        </>
      ) : null}
    </div>
  );
}
FrameNode.craft = {
  displayName: "Frame",
  props: FRAME_DEFAULTS,
  rules: { canMoveIn: () => true },
};
