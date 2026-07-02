// Frame-Datenmodell: Props (inkl. Fill/Filter/Layout/Sizing/Transform/
// Effects/Var-Bindungen), Effekt-Typ und Defaults. Reine Typen/Konstanten —
// keine React-Abhängigkeit.

// ── FRAME — frei absolut positioniertes Objekt (echter Page-Builder, Framer) ──
// Eigene Koordinaten x/y (relativ zur Seite), Größe w/h, voller Style. Auf der
// Canvas per Drag verschiebbar und an 8 Griffen skalierbar; der Inspektor rechts
// bearbeitet exakt diese Props (bidirektional).
export type FramePins = { t: boolean; l: boolean; r: boolean; b: boolean };

export type FrameProps = {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  radius: number;
  opacity: number;
  visible: boolean;
  overflow: "clip" | "visible" | "hidden" | "auto";
  positionType: "absolute" | "relative" | "fixed" | "sticky";
  // Constraint-Pins: welche Kanten sind verankert. Zwei gegenüberliegende Pins
  // dehnen den Frame zwischen ihnen (Größe folgt), eine Kante verankert nur.
  pins: FramePins;
  // Bindung an eine Seiten-Variable (Framer): wenn gesetzt, kommt der Wert aus
  // der Variable statt aus dem statischen Prop. IDs zeigen in die Registry.
  opacityVar?: string | null;
  visibleVar?: string | null;
  fillVar?: string | null;
  overflowVar?: string | null;
  radiusVar?: string | null;
  rotateVar?: string | null;
  // Optionale Bedingung/Transform der Bindung (Framer „Set Variable“ →
  // Bedingung: is_set/equals/greater_than/…). Reine String-Kennung.
  opacityVarCond?: string | null;
  visibleVarCond?: string | null;
  fillVarCond?: string | null;
  overflowVarCond?: string | null;
  // Vollständiges Conditional-Binding (Framer): Variable + Bedingung +
  // Dann/Wenn-Nein/Fallback. Überschreibt den statischen Wert, wenn gesetzt.
  overflowBinding?: {
    variableId: string;
    condition: string;
    compareValue?: string;
    ifYes: string;
    ifNo: string;
    fallback: string;
  };
  // --- optionale Zusatz-Stile (aus dem „+“-Popover im Inspektor) ---
  // Aktive Panel-Einträge (welche Zusatz-Zeilen der Inspektor zeigt).
  stilePanel?: string[];
  // Radius-Modus: „all" = ein radius für alle, „corners" = Einzel-Ecken.
  radiusMode?: "all" | "corners";
  // Einzel-Ecken-Radien (nur wirksam bei radiusMode === "corners").
  radiusTL?: number;
  radiusTR?: number;
  radiusBR?: number;
  radiusBL?: number;
  // --- Grenze (Border) ---
  // border === undefined → keine Grenze (Zeile zeigt „Add…"). Sobald gesetzt,
  // rendert der Frame den Rahmen und die Zeile zeigt Swatch + Stil.
  border?: {
    color: string;
    style: "solid" | "dashed" | "dotted";
    mode: "all" | "sides";
    width: number; // bei mode „all"
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
  // Overflow je Achse, Stapelindex, Blend, Interaktion.
  overflowX?: "visible" | "hidden" | "clip" | "auto";
  overflowY?: "visible" | "hidden" | "clip" | "auto";
  zIndex?: number;
  mixBlendMode?: string;
  pointerEvents?: "auto" | "none";
  userSelect?: "auto" | "none" | "text";
  imageRendering?: "auto" | "pixelated" | "crisp-edges";
  filter?: string;
  mask?: string;
  // --- Fill-Typ: Farbe (fill) ODER Verlauf (gradient) ODER Bild (fillImage) ---
  fillType?: "color" | "gradient" | "image";
  gradient?: {
    kind: "linear" | "radial" | "conic";
    angle: number; // Grad (linear/conic)
    stops: { color: string; pos: number }[]; // pos 0–100
  };
  fillImage?: string; // URL
  fillImageFit?: "cover" | "contain" | "fill" | "tile";
  // --- Filter-Werte (statt rohem filter-String) ---
  filters?: {
    blur?: number; // px
    brightness?: number; // % (100 = neutral)
    contrast?: number;
    saturate?: number;
    hueRotate?: number; // deg
    invert?: number; // %
    grayscale?: number;
    sepia?: number;
  };
  backdropBlur?: number; // px (Glassmorphism)
  // --- Schatten (mehrere Layer) ---
  shadows?: {
    inner?: boolean;
    x: number;
    y: number;
    blur: number;
    spread: number;
    color: string;
  }[];
  // --- Transform ---
  rotate?: number; // deg
  scale?: number;
  skewX?: number;
  skewY?: number;
  // --- Layout (Stack/Grid) ---
  layoutMode?: "none" | "stack" | "grid";
  stackDirection?: "row" | "column";
  stackDistribute?: "start" | "center" | "end" | "space-between" | "space-around" | "space-evenly";
  stackAlign?: "start" | "center" | "end" | "stretch";
  stackGap?: number;
  stackWrap?: boolean;
  padTop?: number;
  padRight?: number;
  padBottom?: number;
  padLeft?: number;
  gridColumns?: number;
  gridRows?: number;
  gridGap?: number;
  padPerSide?: boolean;
  // --- Sizing-Modi (W/H unabhängig) ---
  widthMode?: "fixed" | "relative" | "fill" | "fit" | "viewport";
  heightMode?: "fixed" | "relative" | "fill" | "fit" | "viewport";
  minW?: number;
  maxW?: number;
  minH?: number;
  maxH?: number;
  aspectLock?: boolean;
  // --- Squircle / Smooth Corners ---
  squircle?: boolean;
  // --- Typografie (Framer: Schrift je Element, überschreibt die globale) ---
  fontFamily?: string | null;
  // --- Scrollabschnitt (Framer „Scroll Section": #-Anker + Scroll-Offset) ---
  scrollSection?: boolean;
  scrollSectionName?: string;
  scrollSectionOffsetY?: number;
  // --- Zugänglichkeit (Framer): Google Bot Skip/Include (data-nosnippet) ---
  googleBot?: "no-snippet" | "none";
  // --- Codeüberschreibungen (Framer „Code Overrides") ---
  codeOverrideFile?: string | null;   // gewählte Datei
  codeOverride?: string | null;       // gewählte Override-Funktion (Export)
  codeOverrideSource?: string;        // Quelltext der Datei (Edit Code)
  // --- Transform-Menü (Framer: Scale/Skew/Rotate/Depth/Perspective/Origin/
  //     Backface/Preserve 3D — welche Zeilen aktiv sind + ihre Werte) ---
  transformRows?: string[];
  depth?: number;        // translateZ (px)
  perspective?: number;  // px
  originX?: number;      // transform-origin X (%)
  originY?: number;      // transform-origin Y (%)
  backface?: "visible" | "hidden";
  preserve3d?: boolean;
  // --- Layout-Variablenbindung (Framer: ⊕ an Layout-Feldern) ---
  stackDirectionVar?: string | null;
  stackDistributeVar?: string | null;
  stackAlignVar?: string | null;
  stackGapVar?: string | null;
  gridColumnsVar?: string | null;
  gridRowsVar?: string | null;
  gridGapVar?: string | null;
  padVar?: string | null;
  // --- Auswirkungen (Framer „Effects" / Interactions via Framer Motion) ---
  // Eine Liste stapelbarer Effekte. Jeder Effekt hat einen Trigger (wann er
  // greift) + ein Ziel-Delta (Scale/Opacity/Offset/Rotation) + eine Transition
  // (Tween/Spring). Der FrameNode-Body wird zu motion.div und wendet sie an.
  effects?: FrameEffect[];
};

// Ein einzelner Effekt = Trigger + Delta + Transition (Framer „Effect").
export type FrameEffect = {
  id: string;
  // Trigger: wann der Effekt aktiv ist.
  //  hover  → whileHover (Zeiger über dem Element)
  //  press  → whileTap (gedrückt)
  //  appear → initial→animate beim Einblenden (Mount)
  //  scroll → whileInView beim Scrollen in den Viewport
  //  parallax → kontinuierliche Scroll-Verschiebung (useScroll/useTransform)
  trigger: "hover" | "press" | "appear" | "scroll" | "parallax";
  // Ziel-Delta (relativ zum Ruhezustand). Nur gesetzte Felder wirken.
  scale?: number;      // 1 = keine Änderung
  opacity?: number;    // 0–1
  x?: number;          // px Versatz
  y?: number;          // px Versatz
  rotate?: number;     // deg
  blur?: number;       // px (filter blur im Zielzustand)
  // Parallax: Verschiebungs-Distanz über die Scroll-Strecke (px, y-Achse).
  parallaxDistance?: number;
  // Transition.
  transitionType?: "tween" | "spring";
  duration?: number;   // s (tween)
  delay?: number;      // s
  ease?: "linear" | "easeIn" | "easeOut" | "easeInOut";
  stiffness?: number;  // spring
  damping?: number;    // spring
  mass?: number;       // spring
};

export const FRAME_DEFAULTS: FrameProps = {
  x: 40,
  y: 40,
  w: 400,
  h: 300,
  pins: { t: true, l: true, r: false, b: false },
  fill: "#BBDDFF",
  radius: 0,
  opacity: 1,
  visible: true,
  overflow: "clip",
  positionType: "absolute",
};
