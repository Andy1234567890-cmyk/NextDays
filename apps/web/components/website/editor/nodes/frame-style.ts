// Reine Style-Berechnung des Frames: CSS aus den Frame-Props (Fill/Gradient/
// Filter/Layout/Transform/Schatten) und die Ableitung der Framer-Motion-Props
// aus der Effekt-Liste. Kein JSX, keine Hooks.
import type * as React from "react";

import { anyFontStack } from "@/lib/website-fonts";

import type { FrameEffect, FrameProps } from "./frame-types";

// Frame-Körper-Style aus den Props (Basis + optionale Zusatz-Stile). Overflow-
// „clip" → CSS „hidden". Einzel-Ecken-Radien überschreiben radius, sobald gesetzt.
// CSS-Gradient-String aus dem Gradient-Prop bauen (Framer: linear/radial/conic).
export function gradientCss(g: NonNullable<FrameProps["gradient"]>): string {
  const stops = [...g.stops].sort((a, b) => a.pos - b.pos).map((s) => `${s.color} ${s.pos}%`).join(", ");
  if (g.kind === "radial") return `radial-gradient(circle, ${stops})`;
  if (g.kind === "conic") return `conic-gradient(from ${g.angle}deg, ${stops})`;
  return `linear-gradient(${g.angle}deg, ${stops})`;
}

// CSS-filter-String aus den einzelnen Filter-Werten (nur gesetzte anwenden).
export function filtersCss(f: NonNullable<FrameProps["filters"]>): string {
  const parts: string[] = [];
  if (f.blur) parts.push(`blur(${f.blur}px)`);
  if (f.brightness != null && f.brightness !== 100) parts.push(`brightness(${f.brightness}%)`);
  if (f.contrast != null && f.contrast !== 100) parts.push(`contrast(${f.contrast}%)`);
  if (f.saturate != null && f.saturate !== 100) parts.push(`saturate(${f.saturate}%)`);
  if (f.hueRotate) parts.push(`hue-rotate(${f.hueRotate}deg)`);
  if (f.invert) parts.push(`invert(${f.invert}%)`);
  if (f.grayscale) parts.push(`grayscale(${f.grayscale}%)`);
  if (f.sepia) parts.push(`sepia(${f.sepia}%)`);
  return parts.join(" ");
}

// --- Auswirkungen → Framer-Motion-Props -------------------------------------
// Das Ziel-Delta eines Effekts als motion-Target (nur gesetzte Achsen).
export function effectTarget(e: FrameEffect): Record<string, number | string> {
  const t: Record<string, number | string> = {};
  if (e.scale != null) t.scale = e.scale;
  if (e.opacity != null) t.opacity = e.opacity;
  if (e.x != null) t.x = e.x;
  if (e.y != null) t.y = e.y;
  if (e.rotate != null) t.rotate = e.rotate;
  if (e.blur != null) t.filter = `blur(${e.blur}px)`;
  return t;
}

// Transition eines Effekts (Tween/Spring) als motion-Transition.
export function effectTransition(e: FrameEffect): Record<string, number | string> {
  if (e.transitionType === "spring") {
    const tr: Record<string, number | string> = { type: "spring" };
    if (e.stiffness != null) tr.stiffness = e.stiffness;
    if (e.damping != null) tr.damping = e.damping;
    if (e.mass != null) tr.mass = e.mass;
    if (e.delay != null) tr.delay = e.delay;
    return tr;
  }
  const tr: Record<string, number | string> = { type: "tween" };
  tr.duration = e.duration ?? 0.3;
  if (e.ease) tr.ease = e.ease;
  if (e.delay != null) tr.delay = e.delay;
  return tr;
}

// Aus der Effekt-Liste die motion.div-Props ableiten (whileHover/whileTap/
// initial+animate/whileInView). Parallax wird separat gerendert (Hook).
export type MotionEffectProps = {
  whileHover?: Record<string, number | string>;
  whileTap?: Record<string, number | string>;
  initial?: Record<string, number | string>;
  animate?: Record<string, number | string>;
  whileInView?: Record<string, number | string>;
  viewport?: { once: boolean; amount: number };
  transition?: Record<string, number | string>;
};

export function motionPropsFor(effects: FrameEffect[] | undefined): MotionEffectProps {
  if (!effects?.length) return {};
  const mp: MotionEffectProps = {};
  // Eine gemeinsame Transition (die des zuletzt gesetzten Effekts gewinnt bei
  // Konflikt — in der Praxis genügt eine pro Frame, wie in Framer).
  for (const e of effects) {
    if (e.trigger === "hover") mp.whileHover = { ...mp.whileHover, ...effectTarget(e) };
    else if (e.trigger === "press") mp.whileTap = { ...mp.whileTap, ...effectTarget(e) };
    else if (e.trigger === "appear") {
      // initial = Ziel-Delta (Startzustand), animate = Ruhezustand (neutral).
      mp.initial = { ...mp.initial, ...effectTarget(e) };
      mp.animate = { ...mp.animate, ...neutralOf(effectTarget(e)) };
    } else if (e.trigger === "scroll") {
      mp.initial = { ...mp.initial, ...effectTarget(e) };
      mp.whileInView = { ...mp.whileInView, ...neutralOf(effectTarget(e)) };
      mp.viewport = { once: true, amount: 0.3 };
    }
    mp.transition = effectTransition(e);
  }
  return mp;
}

// Neutraler Zielzustand (Ruhelage) zu einem Delta: Scale→1, Opacity→1,
// Offset/Rotate→0, Blur→0. So animiert appear/scroll VOM Delta ZUM Ruhezustand.
export function neutralOf(t: Record<string, number | string>): Record<string, number | string> {
  const n: Record<string, number | string> = {};
  for (const k of Object.keys(t)) {
    if (k === "scale" || k === "opacity") n[k] = 1;
    else if (k === "filter") n[k] = "blur(0px)";
    else n[k] = 0;
  }
  return n;
}

export function frameBodyStyle(p: FrameProps): React.CSSProperties {
  const clip = (v?: string) => (v === "clip" ? "hidden" : v);
  const perCorner = p.radiusMode === "corners";
  // Fill: Farbe / Verlauf / Bild.
  let background: string = p.fill;
  if (p.fillType === "gradient" && p.gradient) background = gradientCss(p.gradient);
  else if (p.fillType === "image" && p.fillImage) {
    const size = p.fillImageFit === "tile" ? "auto" : p.fillImageFit === "contain" ? "contain" : p.fillImageFit === "fill" ? "100% 100%" : "cover";
    const repeat = p.fillImageFit === "tile" ? "repeat" : "no-repeat";
    background = `url("${p.fillImage}") center / ${size} ${repeat}`;
  }
  const style: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    background,
    opacity: p.opacity,
    borderRadius: perCorner
      ? `${p.radiusTL ?? p.radius}px ${p.radiusTR ?? p.radius}px ${p.radiusBR ?? p.radius}px ${p.radiusBL ?? p.radius}px`
      : p.radius,
    overflow: clip(p.overflow),
  };
  // Squircle (Smooth Corners) via CSS corner-shape (Chrome/Edge; sonst Radius-Fallback).
  if (p.squircle) (style as Record<string, unknown>).cornerShape = "superellipse(4)";
  // Schrift je Element (Framer): überschreibt die geerbte globale Font.
  if (p.fontFamily) { const st = anyFontStack(p.fontFamily); if (st) style.fontFamily = st; }
  // Layout: Stack (flex) oder Grid.
  if (p.layoutMode === "stack") {
    style.display = "flex";
    style.flexDirection = p.stackDirection ?? "column";
    style.justifyContent = p.stackDistribute ?? "start";
    style.alignItems = p.stackAlign === "stretch" ? "stretch" : (p.stackAlign ?? "start");
    if (p.stackGap != null) style.gap = p.stackGap;
    if (p.stackWrap) style.flexWrap = "wrap";
    style.position = "relative"; // Stack-Kinder im Fluss, nicht absolut
  } else if (p.layoutMode === "grid") {
    style.display = "grid";
    style.gridTemplateColumns = `repeat(${p.gridColumns ?? 2}, 1fr)`;
    if (p.gridRows) style.gridTemplateRows = `repeat(${p.gridRows}, 1fr)`;
    if (p.gridGap != null) style.gap = p.gridGap;
    style.position = "relative";
  }
  if (p.padTop != null || p.padRight != null || p.padBottom != null || p.padLeft != null) {
    style.padding = `${p.padTop ?? 0}px ${p.padRight ?? 0}px ${p.padBottom ?? 0}px ${p.padLeft ?? 0}px`;
  }
  // Zusatz-Stile nur setzen, wenn definiert (sonst CSS-Standard behalten).
  if (p.overflowX) style.overflowX = clip(p.overflowX) as React.CSSProperties["overflowX"];
  if (p.overflowY) style.overflowY = clip(p.overflowY) as React.CSSProperties["overflowY"];
  if (p.mixBlendMode) style.mixBlendMode = p.mixBlendMode as React.CSSProperties["mixBlendMode"];
  if (p.pointerEvents) style.pointerEvents = p.pointerEvents;
  if (p.userSelect) style.userSelect = p.userSelect;
  if (p.imageRendering) style.imageRendering = p.imageRendering as React.CSSProperties["imageRendering"];
  // Filter: entweder Einzelwerte (filters) oder roher String (filter, Fallback).
  const fStr = p.filters ? filtersCss(p.filters) : p.filter;
  if (fStr) style.filter = fStr;
  if (p.backdropBlur) (style as Record<string, unknown>).backdropFilter = `blur(${p.backdropBlur}px)`;
  if (p.mask) style.mask = p.mask;
  // Transform (Rotate/Scale/Skew + 3D: Depth/Perspective/Origin/Backface).
  const tf: string[] = [];
  if (p.rotate) tf.push(`rotate(${p.rotate}deg)`);
  if (p.scale != null && p.scale !== 1) tf.push(`scale(${p.scale})`);
  if (p.skewX) tf.push(`skewX(${p.skewX}deg)`);
  if (p.skewY) tf.push(`skewY(${p.skewY}deg)`);
  if (p.depth) tf.push(`translateZ(${p.depth}px)`);
  if (tf.length) style.transform = tf.join(" ");
  if (p.perspective) style.perspective = p.perspective;
  if (p.originX != null || p.originY != null) style.transformOrigin = `${p.originX ?? 50}% ${p.originY ?? 50}%`;
  if (p.backface) style.backfaceVisibility = p.backface;
  if (p.preserve3d) style.transformStyle = "preserve-3d";
  // Schatten (mehrere Layer) → box-shadow-Liste.
  if (p.shadows?.length) {
    style.boxShadow = p.shadows
      .map((s) => `${s.inner ? "inset " : ""}${s.x}px ${s.y}px ${s.blur}px ${s.spread}px ${s.color}`)
      .join(", ");
  }
  // Grenze (Border): einheitlich (mode „all") oder je Kante (mode „sides").
  if (p.border) {
    const bd = p.border;
    style.borderStyle = bd.style;
    style.borderColor = bd.color;
    if (bd.mode === "sides") {
      style.borderTopWidth = bd.top ?? 0;
      style.borderRightWidth = bd.right ?? 0;
      style.borderBottomWidth = bd.bottom ?? 0;
      style.borderLeftWidth = bd.left ?? 0;
    } else {
      style.borderWidth = bd.width;
    }
  }
  return style;
}
