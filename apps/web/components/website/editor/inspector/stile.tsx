"use client";

// Stile-Bausteine: Zusatz-Stile-Katalog (⊕ neben „Stile"), Border-/Shadow-
// Popups, Fill-Control (Farbe/Verlauf/Bild) — 1:1 nach Framer.
import { Icon } from "@iconify/react";
import { useRef, useState } from "react";

import { FiltersSection } from "./layout-section";
import {
  AddInlineBtn,
  alphaPctOf,
  AnchoredPopover,
  CornerBox,
  FIELD_BOX,
  FIELD_H,
  FIELD_INPUT,
  hexOnly,
  type InspProps,
  NumStepper,
  Popover,
  RadiusModeBtn,
  rgbaFrom,
  Row,
  Select,
  Swatch,
  TextField,
} from "./ui";

// Ein Schatten-Layer (Framer „Shadow": Typ Box/Realistic, Position Outside/Inside,
// Farbe mit Alpha, X/Y/Verwischen(Blur)/Verbreiten(Spread)).
export type FrameShadow = { inner?: boolean; realistic?: boolean; x: number; y: number; blur: number; spread: number; color: string; alpha?: number };

// ── „Stil hinzufügen"-Popover (Framer „+" neben Stile) ──────────────────────
// Klick auf das „+" öffnet die Type-to-search-Liste (Bild 2). Ausgewählte
// Einträge werden im Stile-Abschnitt als zusätzliche Zeilen aktiviert. Der
// Katalog ist 1:1 aus Framers Original-DOM. `active` = bereits sichtbare Stile
// (dann Häkchen + gemutet), Auswahl togglet den Eintrag.
export type StilId =
  | "blending"
  | "draggable"
  | "filters"
  | "imageRendering"
  | "mask"
  | "overflow"
  | "overflowX"
  | "overflowY"
  | "pointerEvents"
  | "scrollbars"
  | "selection"
  | "squircle"
  | "tapColor"
  | "transform"
  | "userSelect"
  | "zIndex";

export const STIL_KATALOG: { id: StilId; label: string; hasChildren?: boolean }[] = [
  { id: "blending", label: "Blending" },
  { id: "draggable", label: "Draggable" },
  { id: "filters", label: "Filters", hasChildren: true },
  { id: "imageRendering", label: "Image Rendering" },
  { id: "mask", label: "Mask" },
  { id: "overflow", label: "Overflow" },
  { id: "overflowX", label: "Overflow X" },
  { id: "overflowY", label: "Overflow Y" },
  { id: "pointerEvents", label: "Pointer Events" },
  { id: "scrollbars", label: "Scrollbars" },
  { id: "selection", label: "Selection" },
  { id: "squircle", label: "Squircle" },
  { id: "tapColor", label: "Tap Color" },
  { id: "transform", label: "Transform", hasChildren: true },
  { id: "userSelect", label: "User Select" },
  { id: "zIndex", label: "Z Index" },
];

export function AddStilePopover({
  active,
  onToggle,
  onClose,
}: {
  active: Set<StilId>;
  onToggle: (id: StilId) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const suche = q.trim().toLowerCase();
  const items = suche
    ? STIL_KATALOG.filter((s) => s.label.toLowerCase().includes(suche))
    : STIL_KATALOG;
  return (
    <Popover onClose={onClose}>
      <div className="w-52 overflow-hidden rounded-xl border border-border bg-card shadow-xl shadow-black/10">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Icon icon="ph:magnifying-glass" className="size-3.5 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Type to search..."
            className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-72 overflow-y-auto p-1">
          {items.map((s) => {
            const on = active.has(s.id);
            return (
              <button
                key={s.id}
                type="button"
                role="menuitemcheckbox"
                aria-checked={on}
                onClick={() => onToggle(s.id)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition hover:bg-secondary"
              >
                <span className="flex w-3.5 shrink-0 justify-center text-primary">
                  {on ? <Icon icon="ph:check" className="size-3.5" /> : null}
                </span>
                <span className={"flex-1 " + (on ? "text-muted-foreground" : "text-foreground")}>{s.label}</span>
                {s.hasChildren ? <Icon icon="ph:caret-right" className="size-3 text-muted-foreground/60" /> : null}
              </button>
            );
          })}
          {items.length === 0 ? (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">Keine Treffer</p>
          ) : null}
        </div>
      </div>
    </Popover>
  );
}

// Eine Zeile pro aktiviertem Zusatz-Stil (aus dem „+“-Popover). Schreibt echte
// Frame-Props (overflowX/overflowY/zIndex/pointerEvents/…). Der kleine „×“ rechts
// entfernt die Zeile wieder (togglet den Stil im Panel aus).
export function ZusatzStilRow({
  id,
  props,
  set,
  onRemove,
}: {
  id: StilId;
  props: Record<string, unknown>;
  set: (mut: (p: Record<string, unknown>) => void) => void;
  onRemove: () => void;
}) {
  const s = (k: string, d: string) => (typeof props[k] === "string" ? (props[k] as string) : d);
  const n = (k: string, d: number) => (typeof props[k] === "number" ? (props[k] as number) : d);
  const bb = (k: string, d: boolean) => (typeof props[k] === "boolean" ? (props[k] as boolean) : d);
  // Transform-Menü (Framer): „+" öffnet die Zeilen-Auswahl (Scale/Skew/…).
  const [tfMenu, setTfMenu] = useState(false);
  const tfMenuRef = useRef<HTMLDivElement>(null);

  // Mehrzeilige Zusatz-Stile (Filter/Transform): eigene Sub-Sektion mit
  // Titel-Zeile + Entfernen-× (wie Framers ⊕-hinzugefügte Blöcke).
  if (id === "filters") {
    return (
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-foreground">Filter</span>
          <button type="button" aria-label="Filter entfernen" onClick={onRemove} className="flex size-5 items-center justify-center rounded text-muted-foreground transition hover:bg-secondary hover:text-foreground"><Icon icon="ph:x" className="size-3" /></button>
        </div>
        <FiltersSection props={props} set={set} headless />
      </div>
    );
  }
  if (id === "transform") {
    // Aktive Transform-Zeilen (Framer-Menü: Scale/Skew/Rotate/Depth/Perspective/
    // Origin/Backface/Preserve 3D). Default wie Framer: Scale + Skew.
    const active = new Set((Array.isArray(props.transformRows) ? props.transformRows : ["scale", "skew"]) as string[]);
    const toggleRow = (row: string) =>
      set((p) => {
        const cur = new Set((Array.isArray(p.transformRows) ? p.transformRows : ["scale", "skew"]) as string[]);
        if (cur.has(row)) cur.delete(row);
        else cur.add(row);
        p.transformRows = [...cur];
      });
    const MENU: { id: string; label: string }[] = [
      { id: "scale", label: "Scale" },
      { id: "skew", label: "Skew" },
      { id: "rotate", label: "Rotate" },
      { id: "depth", label: "Depth" },
      { id: "perspective", label: "Perspective" },
      { id: "origin", label: "Origin" },
      { id: "backface", label: "Backface" },
      { id: "preserve3d", label: "Preserve 3D" },
    ];
    return (
      <div className="flex flex-col gap-2.5">
        <div ref={tfMenuRef} className="relative flex items-center justify-between">
          <span className="text-xs font-medium text-foreground">Transform</span>
          <div className="flex items-center gap-1">
            <AddInlineBtn onClick={() => setTfMenu((v) => !v)} />
            <button type="button" aria-label="Transform entfernen" onClick={onRemove} className="flex size-5 items-center justify-center rounded text-muted-foreground transition hover:bg-secondary hover:text-foreground"><Icon icon="ph:x" className="size-3" /></button>
          </div>
          {tfMenu ? (
            <AnchoredPopover anchorRef={tfMenuRef} onClose={() => setTfMenu(false)} width={180} placement="left">
              <div className="overflow-hidden rounded-xl border border-border bg-card p-1 shadow-xl shadow-black/10">
                {MENU.map((m) => (
                  <button key={m.id} type="button" role="menuitemcheckbox" aria-checked={active.has(m.id)}
                    onClick={() => toggleRow(m.id)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition hover:bg-secondary">
                    <span className="flex w-3.5 shrink-0 justify-center text-primary">
                      {active.has(m.id) ? <Icon icon="ph:check" className="size-3.5" /> : null}
                    </span>
                    <span className={active.has(m.id) ? "text-muted-foreground" : "text-foreground"}>{m.label}</span>
                  </button>
                ))}
              </div>
            </AnchoredPopover>
          ) : null}
        </div>
        {active.has("scale") ? (
          <Row label="Skalieren"><NumStepper value={n("scale", 1)} step={0.1} onChange={(v) => set((p) => { p.scale = v; })} /></Row>
        ) : null}
        {active.has("skew") ? (
          <>
            <Row label="Neigen X"><NumStepper value={n("skewX", 0)} onChange={(v) => set((p) => { p.skewX = v; })} /></Row>
            <Row label="Neigen Y"><NumStepper value={n("skewY", 0)} onChange={(v) => set((p) => { p.skewY = v; })} /></Row>
          </>
        ) : null}
        {active.has("rotate") ? (
          <Row label="Drehen"><NumStepper value={n("rotate", 0)} unit="°" onChange={(v) => set((p) => { p.rotate = v; })} /></Row>
        ) : null}
        {active.has("depth") ? (
          <Row label="Tiefe"><NumStepper value={n("depth", 0)} unit="px" onChange={(v) => set((p) => { p.depth = v; })} /></Row>
        ) : null}
        {active.has("perspective") ? (
          <Row label="Perspektive"><NumStepper value={n("perspective", 0)} unit="px" onChange={(v) => set((p) => { p.perspective = Math.max(0, v); })} /></Row>
        ) : null}
        {active.has("origin") ? (
          <Row label="Ursprung">
            <NumStepper value={n("originX", 50)} axis="X" unit="%" onChange={(v) => set((p) => { p.originX = v; })} />
            <NumStepper value={n("originY", 50)} axis="Y" unit="%" onChange={(v) => set((p) => { p.originY = v; })} />
          </Row>
        ) : null}
        {active.has("backface") ? (
          <Row label="Backface">
            <Select value={s("backface", "visible")} onChange={(v) => set((p) => { p.backface = v; })}>
              <option value="visible">Visible</option>
              <option value="hidden">Hidden</option>
            </Select>
          </Row>
        ) : null}
        {active.has("preserve3d") ? (
          <Row label="Preserve 3D">
            <div className={`flex ${FIELD_H} flex-1 overflow-hidden rounded-md border border-border`}>
              <button type="button" onClick={() => set((p) => { p.preserve3d = true; })}
                className={"flex-1 text-xs transition " + (bb("preserve3d", false) ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary")}>Ja</button>
              <button type="button" onClick={() => set((p) => { p.preserve3d = false; })}
                className={"flex-1 border-l border-border text-xs transition " + (!bb("preserve3d", false) ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary")}>Nein</button>
            </div>
          </Row>
        ) : null}
      </div>
    );
  }

  const overflowOpts = (
    <>
      <option value="visible">Visible</option>
      <option value="hidden">Hidden</option>
      <option value="clip">Clip</option>
      <option value="auto">Scroll</option>
    </>
  );

  let label = id as string;
  let control: React.ReactNode = null;
  switch (id) {
    case "overflowX":
      label = "Überlauf X";
      control = <Select value={s("overflowX", "visible")} onChange={(v) => set((p) => { p.overflowX = v; })}>{overflowOpts}</Select>;
      break;
    case "overflowY":
      label = "Überlauf Y";
      control = <Select value={s("overflowY", "visible")} onChange={(v) => set((p) => { p.overflowY = v; })}>{overflowOpts}</Select>;
      break;
    case "zIndex":
      label = "Z Index";
      control = <NumStepper value={n("zIndex", 0)} onChange={(nv) => set((p) => { p.zIndex = nv; })} />;
      break;
    case "blending":
      label = "Blending";
      control = (
        <Select value={s("mixBlendMode", "normal")} onChange={(v) => set((p) => { p.mixBlendMode = v; })}>
          <option value="normal">Normal</option>
          <option value="multiply">Multiply</option>
          <option value="screen">Screen</option>
          <option value="overlay">Overlay</option>
          <option value="darken">Darken</option>
          <option value="lighten">Lighten</option>
          <option value="difference">Difference</option>
        </Select>
      );
      break;
    case "pointerEvents":
      label = "Pointer Events";
      control = (
        <Select value={s("pointerEvents", "auto")} onChange={(v) => set((p) => { p.pointerEvents = v; })}>
          <option value="auto">Auto</option>
          <option value="none">None</option>
        </Select>
      );
      break;
    case "userSelect":
      label = "User Select";
      control = (
        <Select value={s("userSelect", "auto")} onChange={(v) => set((p) => { p.userSelect = v; })}>
          <option value="auto">Auto</option>
          <option value="none">None</option>
          <option value="text">Text</option>
        </Select>
      );
      break;
    case "imageRendering":
      label = "Image Rendering";
      control = (
        <Select value={s("imageRendering", "auto")} onChange={(v) => set((p) => { p.imageRendering = v; })}>
          <option value="auto">Auto</option>
          <option value="pixelated">Pixelated</option>
          <option value="crisp-edges">Crisp Edges</option>
        </Select>
      );
      break;
    case "scrollbars":
      label = "Scrollbars";
      control = (
        <Select value={s("scrollbars", "default")} onChange={(v) => set((p) => { p.scrollbars = v; })}>
          <option value="default">Standard</option>
          <option value="hidden">Verborgen</option>
        </Select>
      );
      break;
    case "tapColor":
      label = "Tap Color";
      control = <Swatch color={s("tapColor", "#00000000")} onColor={(hex) => set((p) => { p.tapColor = hex; })} />;
      break;
    case "selection":
      label = "Selection";
      control = <Swatch color={s("selectionColor", "#3B82F6")} onColor={(hex) => set((p) => { p.selectionColor = hex; })} />;
      break;
    case "squircle":
      label = "Squircle";
      control = (
        <div className={`flex ${FIELD_H} flex-1 overflow-hidden rounded-md border border-border`}>
          <button type="button" onClick={() => set((p) => { p.squircle = true; })}
            className={"flex-1 text-xs transition " + (bb("squircle", false) ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary")}>Ja</button>
          <button type="button" onClick={() => set((p) => { p.squircle = false; })}
            className={"flex-1 border-l border-border text-xs transition " + (!bb("squircle", false) ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary")}>Nein</button>
        </div>
      );
      break;
    case "draggable":
      label = "Draggable";
      control = (
        <div className={`flex ${FIELD_H} flex-1 overflow-hidden rounded-md border border-border`}>
          <button type="button" onClick={() => set((p) => { p.draggable = true; })}
            className={"flex-1 text-xs transition " + (bb("draggable", false) ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary")}>Ja</button>
          <button type="button" onClick={() => set((p) => { p.draggable = false; })}
            className={"flex-1 border-l border-border text-xs transition " + (!bb("draggable", false) ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary")}>Nein</button>
        </div>
      );
      break;
    case "mask":
      label = "Mask";
      control = <TextField value={s("mask", "")} placeholder="url(#…) / linear-gradient(…)" onChange={(v) => set((p) => { p.mask = v; })} />;
      break;
    default:
      control = <TextField value="" placeholder="Add..." onChange={() => undefined} />;
  }

  return (
    <Row label={label}>
      {control}
      <button
        type="button"
        aria-label={`${label} entfernen`}
        onClick={onRemove}
        className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground transition hover:bg-secondary hover:text-foreground"
      >
        <Icon icon="ph:x" className="size-3" />
      </button>
    </Row>
  );
}

// ── Grenze (Border) — Wert + Popup (Bild) ───────────────────────────────────
export type BorderVal = {
  color: string;
  style: "solid" | "dashed" | "dotted";
  mode: "all" | "sides";
  width: number;
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
};

export const BORDER_DEFAULT: BorderVal = { color: "#222222", style: "solid", mode: "all", width: 1 };

// Border-Popup: Titelzeile „Border ×“, Farbe (Swatch+Hex), Breite (Wert + zwei
// Modus-Buttons wie beim Radius) mit 4er-Zeile T·R·B·L, Stil (Select). Öffnet
// links neben dem Inspektor (align „left“ zeigt es nach innen, wie im Bild).
export function BorderPopup({
  anchorRef,
  border,
  onChange,
  onClose,
}: {
  anchorRef: React.RefObject<HTMLElement | null>;
  border: BorderVal;
  onChange: (mut: (b: BorderVal) => void) => void;
  onClose: () => void;
}) {
  const perSide = border.mode === "sides";
  return (
    <AnchoredPopover anchorRef={anchorRef} onClose={onClose} width={288}>
      <div className="rounded-xl border border-border bg-card p-3 shadow-xl shadow-black/10">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[0.8125rem] font-semibold">Border</span>
          <button type="button" aria-label="schließen" onClick={onClose} className="flex size-5 items-center justify-center rounded text-muted-foreground transition hover:bg-secondary hover:text-foreground">
            <Icon icon="ph:x" className="size-3.5" />
          </button>
        </div>
        <div className="flex flex-col gap-2.5">
          <Row label="Farbe">
            <Swatch color={border.color} onColor={(hex) => onChange((b) => { b.color = hex; })} />
          </Row>
          <Row label="Breite">
            {perSide ? (
              <div className={`flex ${FIELD_H} min-w-0 flex-1 items-center ${FIELD_BOX} opacity-50`}>
                <span className="px-2 text-xs text-muted-foreground">Mixed</span>
              </div>
            ) : (
              <NumStepper value={border.width} onChange={(nv) => onChange((b) => { b.width = Math.max(0, nv); })} />
            )}
            <div className="flex shrink-0 items-center gap-1">
              <RadiusModeBtn label="Alle Seiten" active={!perSide} icon="ph:square" onClick={() => onChange((b) => { b.mode = "all"; })} />
              <RadiusModeBtn label="Seiten einzeln" active={perSide} icon="ph:frame-corners" onClick={() => onChange((b) => { b.mode = "sides"; })} />
            </div>
          </Row>
          {perSide ? (
            <div className="grid grid-cols-4 gap-1.5">
              <CornerBox value={border.top ?? border.width} label="T" onChange={(nv) => onChange((b) => { b.top = nv; })} />
              <CornerBox value={border.right ?? border.width} label="R" onChange={(nv) => onChange((b) => { b.right = nv; })} />
              <CornerBox value={border.bottom ?? border.width} label="B" onChange={(nv) => onChange((b) => { b.bottom = nv; })} />
              <CornerBox value={border.left ?? border.width} label="L" onChange={(nv) => onChange((b) => { b.left = nv; })} />
            </div>
          ) : null}
          <Row label="Stil">
            <Select value={border.style} onChange={(v) => onChange((b) => { b.style = v as BorderVal["style"]; })}>
              <option value="solid">Solid</option>
              <option value="dashed">Dashed</option>
              <option value="dotted">Dotted</option>
            </Select>
          </Row>
        </div>
      </div>
    </AnchoredPopover>
  );
}

// Schatten-Editor (Framer „Shadow"): Inspektor-Zeilen zeigen Swatch + „X, Y, Blur"
// + ×; darunter „Add…". Jede Zeile öffnet ein Popup (Typ/Position/Farbe/X/Y/
// Verwischen/Verbreiten) — 1:1 wie Framer.
export function ShadowsRow({ props, set }: InspProps) {
  const shadows = (props.shadows as FrameShadow[] | undefined) ?? [];
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  // Stabile RefObjects pro Zeile (nicht bei jedem Render neu erzeugen, sonst
  // liest der Popover die Anker-Ref beim Öffnen als null).
  const rowRefsMap = useRef<Map<number, React.RefObject<HTMLDivElement | null>>>(new Map());
  const rowRef = (i: number) => {
    let r = rowRefsMap.current.get(i);
    if (!r) { r = { current: null }; rowRefsMap.current.set(i, r); }
    return r;
  };
  const patch = (i: number, mut: (s: FrameShadow) => void) =>
    set((p) => {
      const arr = [...((p.shadows as FrameShadow[] | undefined) ?? [])];
      const cur = { ...arr[i] };
      mut(cur);
      arr[i] = cur;
      p.shadows = arr;
    });
  const add = () => {
    set((p) => {
      const arr = [...((p.shadows as FrameShadow[] | undefined) ?? [])];
      arr.push({ x: 0, y: 1, blur: 2, spread: 0, color: "rgba(0,0,0,0.25)", inner: false, realistic: false });
      p.shadows = arr;
    });
    setOpenIdx(shadows.length); // neue Zeile direkt öffnen
  };
  const remove = (i: number) =>
    set((p) => {
      const arr = [...((p.shadows as FrameShadow[] | undefined) ?? [])];
      arr.splice(i, 1);
      p.shadows = arr;
    });
  return (
    <>
      {shadows.map((sh, i) => (
        <div key={i} ref={rowRef(i)} className="relative">
          <Row label={i === 0 ? "Schatten" : ""}>
            <button type="button" onClick={() => setOpenIdx(openIdx === i ? null : i)} className={`flex ${FIELD_H} min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-background px-2 text-left text-xs`}>
              <span className="size-3.5 shrink-0 rounded" style={{ backgroundColor: sh.color, boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.1)" }} />
              <span className="truncate tabular-nums">{sh.x}, {sh.y}, {sh.blur}</span>
            </button>
            <button type="button" onClick={() => remove(i)} className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground" aria-label="Schatten entfernen"><Icon icon="ph:x" className="size-3.5" /></button>
          </Row>
          {openIdx === i ? (
            <ShadowPopup anchorRef={rowRef(i)} shadow={sh} onChange={(mut) => patch(i, mut)} onClose={() => setOpenIdx(null)} />
          ) : null}
        </div>
      ))}
      <Row label={shadows.length === 0 ? "Schatten" : ""}>
        <button type="button" onClick={add} className={`flex ${FIELD_H} min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-background px-2 text-left text-xs text-muted-foreground transition hover:bg-secondary`}>
          <span className="size-3.5 shrink-0 rounded border border-border bg-secondary" />
          Add…
        </button>
      </Row>
    </>
  );
}

// Schatten-Popup (Framer „Shadow"): Typ Box/Realistic · Position Outside/Inside ·
// Farbe (Swatch+Hex+Alpha%) · X/Y/Verwischen/Verbreiten je Zeile mit −/+ Steppern.
export function ShadowPopup({
  anchorRef,
  shadow,
  onChange,
  onClose,
}: {
  anchorRef: React.RefObject<HTMLElement | null>;
  shadow: FrameShadow;
  onChange: (mut: (s: FrameShadow) => void) => void;
  onClose: () => void;
}) {
  const alpha = shadow.alpha ?? alphaPctOf(shadow.color);
  const setColor = (hex: string, a: number) => onChange((s) => { s.color = rgbaFrom(hex, a); s.alpha = a; });
  const StepRow = ({ label, value, onSet }: { label: string; value: number; onSet: (v: number) => void }) => (
    <Row label={label}>
      <div className={`${FIELD_BOX} ${FIELD_H} min-w-0 flex-1`}>
        <input type="number" value={value} onChange={(e) => onSet(Number(e.target.value))} className={FIELD_INPUT} />
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button type="button" onClick={() => onSet(value - 1)} className="flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground transition hover:bg-secondary" aria-label="weniger"><Icon icon="ph:minus" className="size-3" /></button>
        <button type="button" onClick={() => onSet(value + 1)} className="flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground transition hover:bg-secondary" aria-label="mehr"><Icon icon="ph:plus" className="size-3" /></button>
      </div>
    </Row>
  );
  return (
    <AnchoredPopover anchorRef={anchorRef} onClose={onClose} width={300} placement="left">
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-black/20">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-[0.8125rem] font-semibold">Shadow</span>
          <button type="button" aria-label="schließen" onClick={onClose} className="flex size-5 items-center justify-center rounded text-muted-foreground transition hover:bg-secondary hover:text-foreground"><Icon icon="ph:x" className="size-3.5" /></button>
        </div>
        <div className="flex flex-col gap-3 p-4">
          <Row label="Typ">
            <div className={`flex ${FIELD_H} flex-1 overflow-hidden rounded-md border border-border`}>
              <button type="button" onClick={() => onChange((s) => { s.realistic = false; })} className={"flex-1 text-xs transition " + (!shadow.realistic ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary")}>Box</button>
              <button type="button" onClick={() => onChange((s) => { s.realistic = true; })} className={"flex-1 border-l border-border text-xs transition " + (shadow.realistic ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary")}>Realistic</button>
            </div>
          </Row>
          <Row label="Position">
            <div className={`flex ${FIELD_H} flex-1 overflow-hidden rounded-md border border-border`}>
              <button type="button" onClick={() => onChange((s) => { s.inner = false; })} className={"flex-1 text-xs transition " + (!shadow.inner ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary")}>Outside</button>
              <button type="button" onClick={() => onChange((s) => { s.inner = true; })} className={"flex-1 border-l border-border text-xs transition " + (shadow.inner ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary")}>Inside</button>
            </div>
          </Row>
          <Row label="Farbe">
            <div className={`flex ${FIELD_H} min-w-0 flex-1 items-center gap-2 rounded-md border border-border px-2`}>
              <input type="color" value={hexOnly(shadow.color)} onChange={(e) => setColor(e.target.value, alpha)} className="size-4 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0" aria-label="Schattenfarbe" />
              <input value={hexOnly(shadow.color).replace("#", "").toUpperCase()} onChange={(e) => setColor("#" + e.target.value, alpha)} className="min-w-0 flex-1 bg-transparent text-xs uppercase outline-none" />
              <input type="number" value={alpha} min={0} max={100} onChange={(e) => setColor(hexOnly(shadow.color), Number(e.target.value))} className="w-9 bg-transparent text-right text-xs tabular-nums text-muted-foreground outline-none" />
              <span className="text-xs text-muted-foreground">%</span>
            </div>
          </Row>
          <StepRow label="X" value={shadow.x} onSet={(v) => onChange((s) => { s.x = v; })} />
          <StepRow label="Y" value={shadow.y} onSet={(v) => onChange((s) => { s.y = v; })} />
          <StepRow label="Verwischen" value={shadow.blur} onSet={(v) => onChange((s) => { s.blur = Math.max(0, v); })} />
          <StepRow label="Verbreiten" value={shadow.spread} onSet={(v) => onChange((s) => { s.spread = v; })} />
        </div>
      </div>
    </AnchoredPopover>
  );
}

// Fill-Control (Framer): Fill-Typ Farbe / Verlauf / Bild. Bei „Verlauf" ein
// Popup mit Kind (linear/radial/conic), Winkel und mehreren Farbstops.
export type FrameGradient = { kind: "linear" | "radial" | "conic"; angle: number; stops: { color: string; pos: number }[] };

export function FillControl({ props, set }: InspProps) {
  const [gradOpen, setGradOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  const fillType = (props.fillType as string | undefined) ?? "color";
  const fill = (props.fill as string | undefined) ?? "#ffffff";
  const grad = (props.gradient as FrameGradient | undefined) ?? { kind: "linear", angle: 90, stops: [{ color: "#3b82f6", pos: 0 }, { color: "#8b5cf6", pos: 100 }] };
  const patchGrad = (mut: (g: FrameGradient) => void) =>
    set((p) => {
      const cur: FrameGradient = { ...((p.gradient as FrameGradient | undefined) ?? grad), stops: [...(((p.gradient as FrameGradient | undefined) ?? grad).stops.map((s) => ({ ...s })))] };
      mut(cur);
      p.gradient = cur;
      p.fillType = "gradient";
    });
  const preview =
    fillType === "gradient"
      ? `${grad.kind === "radial" ? "radial-gradient(circle," : grad.kind === "conic" ? `conic-gradient(from ${grad.angle}deg,` : `linear-gradient(${grad.angle}deg,`} ${[...grad.stops].sort((a, b) => a.pos - b.pos).map((s) => `${s.color} ${s.pos}%`).join(",")})`
      : fill;
  return (
    <div ref={anchor} className="flex min-w-0 flex-1 items-center gap-1.5">
      {/* Typ-Umschalter Farbe/Verlauf/Bild */}
      <div className={`flex ${FIELD_H} shrink-0 overflow-hidden rounded-md border border-border`}>
        {(["color", "gradient", "image"] as const).map((t, i) => (
          <button key={t} type="button" onClick={() => set((p) => { p.fillType = t; })}
            title={t === "color" ? "Farbe" : t === "gradient" ? "Verlauf" : "Bild"}
            className={"flex size-6 items-center justify-center transition " + (fillType === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary") + (i > 0 ? " border-l border-border" : "")}>
            <Icon icon={t === "color" ? "ph:drop" : t === "gradient" ? "ph:gradient" : "ph:image"} className="size-3.5" />
          </button>
        ))}
      </div>
      {fillType === "color" ? (
        <Swatch color={fill} onColor={(hex) => set((p) => { p.fill = hex; })} />
      ) : fillType === "gradient" ? (
        <button type="button" onClick={() => setGradOpen((v) => !v)} className={`flex ${FIELD_H} min-w-0 flex-1 items-center gap-2 rounded-md border border-border px-2 text-left text-xs`}>
          <span className="size-3.5 shrink-0 rounded" style={{ background: preview, boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.1)" }} />
          <span className="truncate capitalize text-muted-foreground">{grad.kind}</span>
        </button>
      ) : (
        <div className={`${FIELD_BOX} ${FIELD_H} min-w-0 flex-1`}>
          <input value={(props.fillImage as string) ?? ""} onChange={(e) => set((p) => { p.fillImage = e.target.value; })} placeholder="Bild-URL" className={FIELD_INPUT} />
        </div>
      )}
      {gradOpen && fillType === "gradient" ? (
        <AnchoredPopover anchorRef={anchor} onClose={() => setGradOpen(false)} width={240} placement="left">
          <div className="overflow-hidden rounded-xl border border-border bg-card p-3 shadow-xl shadow-black/10">
            <div className="mb-2 h-6 w-full rounded" style={{ background: preview }} />
            <Row label="Typ">
              <Select value={grad.kind} onChange={(v) => patchGrad((g) => { g.kind = v as FrameGradient["kind"]; })}>
                <option value="linear">Linear</option>
                <option value="radial">Radial</option>
                <option value="conic">Conic</option>
              </Select>
            </Row>
            {grad.kind !== "radial" ? (
              <Row label="Winkel"><NumStepper value={grad.angle} onChange={(v) => patchGrad((g) => { g.angle = v; })} /></Row>
            ) : null}
            <div className="mt-2 flex flex-col gap-1.5">
              {grad.stops.map((st, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <input type="color" value={hexOnly(st.color)} onChange={(e) => patchGrad((g) => { g.stops[i].color = e.target.value; })} className="h-6 w-8 shrink-0 cursor-pointer rounded border border-border bg-transparent" aria-label="Stop-Farbe" />
                  <div className={`${FIELD_BOX} ${FIELD_H} flex-1`}>
                    <input type="number" value={st.pos} min={0} max={100} onChange={(e) => patchGrad((g) => { g.stops[i].pos = Math.max(0, Math.min(100, Number(e.target.value))); })} className={FIELD_INPUT} />
                    <span className="pr-2 text-[0.625rem] text-muted-foreground">%</span>
                  </div>
                  {grad.stops.length > 2 ? (
                    <button type="button" onClick={() => patchGrad((g) => { g.stops.splice(i, 1); })} className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-secondary" aria-label="Stop entfernen"><Icon icon="ph:x" className="size-3" /></button>
                  ) : null}
                </div>
              ))}
              <button type="button" onClick={() => patchGrad((g) => { g.stops.push({ color: "#ffffff", pos: 50 }); })} className="mt-1 flex items-center justify-center gap-1 rounded-lg border border-dashed border-border py-1 text-[0.6875rem] text-muted-foreground transition hover:bg-secondary"><Icon icon="ph:plus" className="size-3" />Farbstopp</button>
            </div>
          </div>
        </AnchoredPopover>
      ) : null}
    </div>
  );
}
