"use client";

// Frame-Inspektor (Frame gewählt): der volle Framer-Inspektor — Align,
// Wechselwirkungen, Link, Position (Pins), Größe, Layout, Auswirkungen,
// Overlays, Cursor, Stile (mit ⊕-Variablen-Bindung), Scrollabschnitt,
// Zugänglichkeit, Codeüberschreibungen.
import { useEditor } from "@craftjs/core";
import { Icon } from "@iconify/react";
import { useRef, useState } from "react";

import { Label } from "@/components/ui/label";
import { anyFontStack } from "@/lib/website-fonts";

import { FontPicker } from "../font-picker";
import { useFrame } from "../frame-context";
import { useVariables } from "../variables-context";
import { CODE_TEMPLATE, parseOverrides } from "./code-overrides";
import { EffectsSection } from "./effects";
import { LayoutSection } from "./layout-section";
import { AlignBar, type AlignKind, PinCross } from "./position";
import {
  AddStilePopover,
  BORDER_DEFAULT,
  type BorderVal,
  BorderPopup,
  FillControl,
  ShadowsRow,
  type StilId,
  ZusatzStilRow,
} from "./stile";
import {
  AddBtn,
  AddInlineBtn,
  AnchoredPopover,
  CornerBox,
  FIELD_BOX,
  FIELD_H,
  FIELD_INPUT,
  InspectorTabs,
  NumStepper,
  Padlock,
  PlusBtn,
  RadiusModeBtn,
  RangeSlider,
  RemoveInlineBtn,
  Row,
  Section,
  Select,
  TextField,
  VarBadge,
} from "./ui";
import {
  ConditionalValueDialog,
  type PropBinding,
  VarActionPopover,
  type VarCondition,
  VarChip,
  varIcon,
  VariablesEditor,
} from "./variables-ui";

// --- FRAME-Inspektor (Frame gewählt) ----------------------------------------
// Vollständig wie Framer: bearbeitet die echten Frame-Props (x/y/w/h/fill/…)
// live über setProp. Jede Änderung wirkt sofort auf das Objekt der Canvas.
export function FrameInspektor({ id }: { id: string }) {
  const { props, dom, actions } = useEditor((state) => ({
    props: (state.nodes[id]?.data.props ?? {}) as Record<string, unknown>,
    dom: state.nodes[id]?.dom ?? null,
  }));
  const set = (mut: (p: Record<string, unknown>) => void) => actions.setProp(id, mut);
  const n = (k: string, d: number) => (typeof props[k] === "number" ? (props[k] as number) : d);
  const s = (k: string, d: string) => (typeof props[k] === "string" ? (props[k] as string) : d);
  const b = (k: string, d: boolean) => (typeof props[k] === "boolean" ? (props[k] as boolean) : d);
  const [locked, setLocked] = useState(false);
  const [minMaxOpen, setMinMaxOpen] = useState(false);
  const [stilMenu, setStilMenu] = useState(false);
  const [borderPopup, setBorderPopup] = useState(false);
  const [fontPickerOpen, setFontPickerOpen] = useState(false);
  const fontRowRef = useRef<HTMLDivElement>(null);
  // Codeüberschreibungen: „Neue Datei …" → Namenszeile einblenden; „Edit Code"
  // öffnet den Code-Editor über den Frame-Context in der Canvas-Mitte.
  const [newCodeFile, setNewCodeFile] = useState(false);
  const [codeFileName, setCodeFileName] = useState("");
  const frame = useFrame();
  const borderAnchorRef = useRef<HTMLDivElement>(null);

  // Aktive Zusatz-Stile (aus dem „+“-Popover) — persistiert in den Frame-Props.
  const stilePanel = new Set((Array.isArray(props.stilePanel) ? props.stilePanel : []) as StilId[]);
  const toggleStil = (sid: StilId) =>
    set((p) => {
      const cur = new Set((Array.isArray(p.stilePanel) ? p.stilePanel : []) as StilId[]);
      if (cur.has(sid)) cur.delete(sid);
      else cur.add(sid);
      p.stilePanel = [...cur];
    });

  // Radius-Modus aus den Props (konsistent zum Rendering im FrameNode).
  const radiusPerCorner = s("radiusMode", "all") === "corners";
  const setRadiusPerCorner = (on: boolean) =>
    set((p) => { p.radiusMode = on ? "corners" : "all"; });

  // Grenze (Border) aus den Props lesen; `openBorder` legt eine Standard-Grenze
  // an, sobald der Nutzer die leere Zeile antippt.
  const border = (props.border as BorderVal | undefined) ?? undefined;
  const openBorder = () => set((p) => { if (!p.border) p.border = { ...BORDER_DEFAULT }; });

  // Variablen-Bindung der Opazität (Framer). `opacityVar` = ID oder null/none.
  const vars = useVariables();
  const opacityVarId = s("opacityVar", "") || null;
  const boundVar = vars?.get(opacityVarId) ?? null;
  const [varMenu, setVarMenu] = useState(false);       // Aktions-Popover (⊕)
  const [varEditor, setVarEditor] = useState(false);   // großer Editor (Chip)
  const opacityRowRef = useRef<HTMLDivElement>(null);

  // ⊕-Bindung für Radius und Drehen (Framer: auch diese Zeilen haben ein ⊕).
  const radiusVarId = s("radiusVar", "") || null;
  const boundRadiusVar = vars?.get(radiusVarId) ?? null;
  const [radiusVarMenu, setRadiusVarMenu] = useState(false);
  const radiusRowRef = useRef<HTMLDivElement>(null);
  const createRadiusVar = () => {
    if (!vars) return;
    const v = vars.create({ name: "Radius", defaultValue: n("radius", 0), min: 0, max: 200, step: 1, unit: "px", queryParam: "radius" });
    set((p) => { p.radiusVar = v.id; });
    setRadiusVarMenu(false);
  };
  const bindRadiusVar = (id: string) => { set((p) => { p.radiusVar = id; }); setRadiusVarMenu(false); };
  const unbindRadiusVar = () => { set((p) => { p.radiusVar = null; }); };

  const rotateVarId = s("rotateVar", "") || null;
  const boundRotateVar = vars?.get(rotateVarId) ?? null;
  const [rotateVarMenu, setRotateVarMenu] = useState(false);
  const rotateRowRef = useRef<HTMLDivElement>(null);
  const createRotateVar = () => {
    if (!vars) return;
    const v = vars.create({ name: "Rotation", defaultValue: n("rotate", 0), min: -360, max: 360, step: 1, unit: "deg", queryParam: "rotation" });
    set((p) => { p.rotateVar = v.id; });
    setRotateVarMenu(false);
  };
  const bindRotateVar = (id: string) => { set((p) => { p.rotateVar = id; }); setRotateVarMenu(false); };
  const unbindRotateVar = () => { set((p) => { p.rotateVar = null; }); };

  // Neue Variable aus dem aktuellen Opazitätswert anlegen und binden.
  const createOpacityVar = () => {
    if (!vars) return;
    const v = vars.create({
      name: "Opacity",
      defaultValue: n("opacity", 1),
      min: 0,
      max: 1,
      step: 0.01,
      unit: "none",
      queryParam: "opacity",
    });
    set((p) => { p.opacityVar = v.id; });
    setVarMenu(false);
    setVarEditor(true);
  };
  const bindOpacityVar = (id: string, condition?: VarCondition) => {
    set((p) => { p.opacityVar = id; if (condition) p.opacityVarCond = condition; });
    setVarMenu(false);
  };
  const unbindOpacityVar = () => { set((p) => { p.opacityVar = null; p.opacityVarCond = null; }); setVarEditor(false); };

  // Variablen-Bindung der Sichtbarkeit (boolesch, Framer). `visibleVar` = ID/null.
  const visibleVarId = s("visibleVar", "") || null;
  const boundVisVar = vars?.get(visibleVarId) ?? null;
  const [visVarMenu, setVisVarMenu] = useState(false);
  const [visVarEditor, setVisVarEditor] = useState(false);
  const visibleRowRef = useRef<HTMLDivElement>(null);
  const createVisibleVar = () => {
    if (!vars) return;
    const v = vars.create({
      name: "Visible",
      kind: "boolean",
      defaultBool: b("visible", true),
      queryParam: "visible",
    });
    set((p) => { p.visibleVar = v.id; });
    setVisVarMenu(false);
    setVisVarEditor(true);
  };
  const bindVisibleVar = (id: string, condition?: VarCondition) => {
    set((p) => { p.visibleVar = id; if (condition) p.visibleVarCond = condition; });
    setVisVarMenu(false);
  };
  const unbindVisibleVar = () => { set((p) => { p.visibleVar = null; p.visibleVarCond = null; }); setVisVarEditor(false); };

  // Variablen-Bindung für Füllen (Farbe) und Überlauf (Framer: ⊕ an jeder Stil-
  // Zeile). Wie Opazität/Sichtbar: ⊕ öffnet die Kaskade, Auswahl bindet echt.
  const fillVarId = s("fillVar", "") || null;
  const boundFillVar = vars?.get(fillVarId) ?? null;
  const [fillVarMenu, setFillVarMenu] = useState(false);
  const [fillVarEditor, setFillVarEditor] = useState(false);
  const fillRowRef = useRef<HTMLDivElement>(null);
  const createFillVar = () => {
    if (!vars) return;
    const v = vars.create({ name: "Fill", kind: "boolean", queryParam: "fill" });
    set((p) => { p.fillVar = v.id; });
    setFillVarMenu(false);
    setFillVarEditor(true);
  };
  const bindFillVar = (id: string, condition?: VarCondition) => {
    set((p) => { p.fillVar = id; if (condition) p.fillVarCond = condition; });
    setFillVarMenu(false);
  };
  const unbindFillVar = () => { set((p) => { p.fillVar = null; p.fillVarCond = null; }); setFillVarEditor(false); };

  const overflowVarId = s("overflowVar", "") || null;
  const boundOverflowVar = vars?.get(overflowVarId) ?? null;
  const [overflowVarMenu, setOverflowVarMenu] = useState(false);
  const [overflowVarEditor, setOverflowVarEditor] = useState(false);
  const [overflowCondDialog, setOverflowCondDialog] = useState(false);
  const overflowRowRef = useRef<HTMLDivElement>(null);
  // Aktuelles Conditional-Binding der Überlauf-Property (JSON in der Prop).
  const overflowBinding = (props.overflowBinding as PropBinding | undefined) ?? null;
  const createOverflowVar = () => {
    if (!vars) return;
    const v = vars.create({ name: "Overflow", kind: "boolean", queryParam: "overflow" });
    set((p) => { p.overflowVar = v.id; });
    setOverflowVarMenu(false);
    setOverflowVarEditor(true);
  };
  const bindOverflowVar = (id: string, condition?: VarCondition) => {
    // Bindung als vollständiges Conditional-Objekt anlegen und den Dialog öffnen.
    const initial: PropBinding = {
      variableId: id,
      condition: condition ?? "is_set",
      ifYes: "hidden",
      ifNo: "visible",
      fallback: s("overflow", "clip"),
    };
    set((p) => { p.overflowVar = id; p.overflowBinding = initial; });
    setOverflowVarMenu(false);
    setOverflowCondDialog(true);
  };
  const unbindOverflowVar = () => { set((p) => { p.overflowVar = null; p.overflowBinding = undefined; }); setOverflowVarEditor(false); setOverflowCondDialog(false); };

  const x = n("x", 0), y = n("y", 0), w = n("w", 0), h = n("h", 0);
  const defaultPins = { t: true, l: true, r: false, b: false };
  const pins = (props.pins as typeof defaultPins) ?? defaultPins;

  // Seitenmaße für R/B-Pins: der DEVICE-FRAME (.group/frame) ist die echte
  // Seitenfläche (konsistent zu den Abstands-Indikatoren im FrameNode).
  const pageEl = (dom?.closest(".group\\/frame") as HTMLElement | null) ?? dom?.parentElement ?? null;
  const parentW = pageEl ? pageEl.offsetWidth : 0;
  const parentH = pageEl ? pageEl.offsetHeight : 0;

  // R/B als Abstand zur jeweiligen Elternkante.
  const right = parentW ? Math.round(parentW - (x + w)) : Math.round(x + w);
  const bottom = parentH ? Math.round(parentH - (y + h)) : Math.round(y + h);

  // Pin umschalten. Zwei gegenüberliegende Pins → Frame dehnt sich zwischen
  // ihnen (Größe folgt); genau eine Kante → nur Verankerung.
  const togglePin = (k: "t" | "l" | "r" | "b") =>
    set((p) => {
      const cur = (p.pins as typeof defaultPins) ?? defaultPins;
      p.pins = { ...cur, [k]: !cur[k] };
    });

  // Werte je Kante bearbeiten — konsistent zu „Kante fix, Frame dehnt sich":
  const editTop = (v: number) => set((p) => {
    if (pins.b && parentH) { p.h = Math.max(20, parentH - bottom - v); } // T+B → dehnen
    else if (pins.b) { /* ohne Elternhöhe nur y */ }
    p.y = v;
  });
  const editLeft = (v: number) => set((p) => {
    if (pins.r && parentW) { p.w = Math.max(20, parentW - right - v); }  // L+R → dehnen
    p.x = v;
  });
  const editRight = (v: number) => set((p) => {
    if (!parentW) return;
    if (pins.l) { p.w = Math.max(20, parentW - v - x); }                 // L+R → dehnen
    else { p.x = parentW - v - w; }                                     // nur R → verschieben
  });
  const editBottom = (v: number) => set((p) => {
    if (!parentH) return;
    if (pins.t) { p.h = Math.max(20, parentH - v - y); }                 // T+B → dehnen
    else { p.y = parentH - v - h; }                                     // nur B → verschieben
  });

  // Frame im Device-Frame ausrichten (Framer-Align-Leiste): setzt x/y anhand der
  // Elternmaße. Center rundet auf ganze Pixel.
  const alignFrame = (k: AlignKind) => set((p) => {
    if (k === "left") p.x = 0;
    else if (k === "right") { if (parentW) p.x = parentW - w; }
    else if (k === "hcenter") { if (parentW) p.x = Math.round((parentW - w) / 2); }
    else if (k === "top") p.y = 0;
    else if (k === "bottom") { if (parentH) p.y = parentH - h; }
    else if (k === "vcenter") { if (parentH) p.y = Math.round((parentH - h) / 2); }
  });

  return (
    <div className="flex flex-col">
      <InspectorTabs />
      <AlignBar onAlign={alignFrame} />

      <Section title="Wechselwirkungen" action={<PlusBtn />} />

      <Section title="Link" action={<PlusBtn />}>
        <Row label="Link zu">
          <TextField value={s("href", "")} placeholder="Seite oder URL …" onChange={(v) => set((p) => { p.href = v; })} />
        </Row>
      </Section>

      <Section title="Position">
        {/* Pin-Kreuz wie Framer: jede AKTIVE (gepinnte) Kante ist editierbar. */}
        <PinCross
          top={y}
          left={x}
          right={right}
          bottom={bottom}
          pins={pins}
          onTogglePin={togglePin}
          onTop={editTop}
          onLeft={editLeft}
          onRight={editRight}
          onBottom={editBottom}
        />
        <Row label="Typ">
          <Select value={s("positionType", "absolute")} onChange={(v) => set((p) => { p.positionType = v; })}>
            <option value="absolute">Absolute</option>
            <option value="relative" disabled>Relative</option>
            <option value="fixed">Fixed</option>
            <option value="sticky" disabled>Sticky</option>
          </Select>
        </Row>
      </Section>

      <Section title="Größe" action={<PlusBtn />}>
        <Row label="Breite">
          <Padlock locked={locked} onToggle={() => setLocked((v) => !v)} />
          <NumStepper value={w} disabled={s("widthMode", "fixed") !== "fixed" && s("widthMode", "fixed") !== "relative"} onChange={(nv) => set((p) => {
            const nw = Math.max(20, nv);
            if (locked && w) p.h = Math.round((nw / w) * h);
            p.w = nw;
          })} />
          <Select value={s("widthMode", "fixed")} onChange={(v) => set((p) => { p.widthMode = v; })}>
            <option value="fixed">Fixed</option>
            <option value="relative">Relative</option>
            <option value="fill">Fill</option>
            <option value="fit">Fit Content</option>
          </Select>
        </Row>
        <Row label="Höhe">
          <span className="w-5 shrink-0" aria-hidden />
          <NumStepper value={h} disabled={s("heightMode", "fixed") !== "fixed" && s("heightMode", "fixed") !== "relative"} onChange={(nv) => set((p) => {
            const nh = Math.max(20, nv);
            if (locked && h) p.w = Math.round((nh / h) * w);
            p.h = nh;
          })} />
          <Select value={s("heightMode", "fixed")} onChange={(v) => set((p) => { p.heightMode = v; })}>
            <option value="fixed">Fixed</option>
            <option value="relative">Relative</option>
            <option value="fill">Fill</option>
            <option value="fit">Fit Content</option>
            <option value="viewport">Viewport</option>
          </Select>
        </Row>
        <Row label="Min Max">
          <button
            type="button"
            onClick={() => setMinMaxOpen((v) => !v)}
            className={`flex ${FIELD_H} min-w-0 flex-1 items-center gap-1.5 rounded-md border border-border bg-background px-2 text-left text-xs text-muted-foreground transition hover:bg-secondary`}
          >
            <Icon icon="ph:arrows-in-line-horizontal" className="size-3.5 shrink-0" />
            Hinzufügen …
          </button>
        </Row>
        {minMaxOpen ? (
          <>
            <Row label="Min B"><NumStepper value={n("minW", 0)} onChange={(v) => set((p) => { p.minW = Math.max(0, v); })} /></Row>
            <Row label="Max B"><NumStepper value={n("maxW", 0)} onChange={(v) => set((p) => { p.maxW = Math.max(0, v); })} /></Row>
            <Row label="Min H"><NumStepper value={n("minH", 0)} onChange={(v) => set((p) => { p.minH = Math.max(0, v); })} /></Row>
            <Row label="Max H"><NumStepper value={n("maxH", 0)} onChange={(v) => set((p) => { p.maxH = Math.max(0, v); })} /></Row>
          </>
        ) : null}
      </Section>

      {/* Layout (Stack/Grid) — Framer-Reihenfolge: direkt nach „Größe". */}
      <LayoutSection props={props} set={set} />

      <EffectsSection props={props} set={set} />
      <Section title="Overlays" action={<PlusBtn />} />
      <Section title="Cursor" action={<PlusBtn />} />

      <Section
        title="Stile"
        action={
          <div className="relative">
            <AddBtn active={stilMenu} onClick={() => setStilMenu((v) => !v)} />
            {stilMenu ? (
              <AddStilePopover
                active={stilePanel}
                onToggle={toggleStil}
                onClose={() => setStilMenu(false)}
              />
            ) : null}
          </div>
        }
      >
        {/* Opazität mit Variablen-Andockung (Framer): ⊕-Badge links vor dem
            Label (negativ versetzt, klaut keine Textbreite), Label vollständig
            lesbar; gebunden → blauer Chip statt Slider. Gleiche Label-Spalte wie
            alle anderen Zeilen → bündig. */}
        <div ref={opacityRowRef} className="relative grid grid-cols-[0.875rem_3.625rem_1fr] items-center gap-x-1.5">
          {/* Spalte 1: ⊕-Badge (eigene schmale Spalte, klaut keinen Label-Platz).
              Spalte 2: Label „Opazität" (voll lesbar). Spalte 3: Wert/Slider. */}
          <VarBadge bound={!!boundVar} onClick={() => (boundVar ? setVarEditor(true) : setVarMenu((v) => !v))} />
          <Label className={"truncate text-xs " + (boundVar ? "text-primary" : "text-muted-foreground")}>Opazität</Label>
          <div className="flex min-w-0 items-center gap-2">
            {boundVar ? (
              <VarChip name={boundVar.name} onOpen={() => setVarEditor(true)} onUnbind={unbindOpacityVar} />
            ) : (
              <>
                <RangeSlider
                  value={n("opacity", 1)}
                  min={0}
                  max={1}
                  step={0.01}
                  onChange={(v) => set((p) => { p.opacity = v; })}
                />
                <span className="w-4 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{n("opacity", 1)}</span>
              </>
            )}
          </div>
          {varMenu ? (
            <VarActionPopover
              anchorRef={opacityRowRef}
              existing={(vars?.variables ?? []).filter((v) => v.kind === "number")}
              onCreate={createOpacityVar}
              onBind={bindOpacityVar}
              onClose={() => setVarMenu(false)}
            />
          ) : null}
          {varEditor && boundVar ? (
            <VariablesEditor
              anchorRef={opacityRowRef}
              variables={vars?.variables ?? []}
              selectedId={boundVar.id}
              onUpdate={(id, p) => vars?.update(id, p)}
              onClose={() => setVarEditor(false)}
            />
          ) : null}
        </div>
        {/* Sichtbar mit Variablen-Andockung (Framer, boolesch): ⊕ · Label ·
            Yes/No-Toggle oder blauer Chip (Augen-Icon) bei Bindung. */}
        <div ref={visibleRowRef} className="relative grid grid-cols-[0.875rem_3.625rem_1fr] items-center gap-x-1.5">
          <VarBadge bound={!!boundVisVar} onClick={() => (boundVisVar ? setVisVarEditor(true) : setVisVarMenu((v) => !v))} />
          <Label className={"truncate text-xs " + (boundVisVar ? "text-primary" : "text-muted-foreground")}>Sichtbar</Label>
          <div className="flex min-w-0 items-center gap-1.5">
            {boundVisVar ? (
              <VarChip name={boundVisVar.name} icon={varIcon(boundVisVar.kind)} onOpen={() => setVisVarEditor(true)} onUnbind={unbindVisibleVar} />
            ) : (
              <div className={`flex ${FIELD_H} flex-1 overflow-hidden rounded-md border border-border`}>
                <button type="button" onClick={() => set((p) => { p.visible = true; })}
                  className={"flex-1 text-xs transition " + (b("visible", true) ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary")}>Ja</button>
                <button type="button" onClick={() => set((p) => { p.visible = false; })}
                  className={"flex-1 border-l border-border text-xs transition " + (!b("visible", true) ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary")}>Nein</button>
              </div>
            )}
          </div>
          {visVarMenu ? (
            <VarActionPopover
              anchorRef={visibleRowRef}
              existing={(vars?.variables ?? []).filter((v) => v.kind === "boolean")}
              onCreate={createVisibleVar}
              onBind={bindVisibleVar}
              onClose={() => setVisVarMenu(false)}
            />
          ) : null}
          {visVarEditor && boundVisVar ? (
            <VariablesEditor
              anchorRef={visibleRowRef}
              variables={vars?.variables ?? []}
              selectedId={boundVisVar.id}
              onUpdate={(id, p) => vars?.update(id, p)}
              onClose={() => setVisVarEditor(false)}
            />
          ) : null}
        </div>
        <div ref={fillRowRef} className="relative">
          <Row
            label="Füllen"
            bound={!!boundFillVar}
            onVarClick={() => (boundFillVar ? setFillVarEditor(true) : setFillVarMenu((v) => !v))}
          >
            {boundFillVar ? (
              <VarChip name={boundFillVar.name} icon={varIcon(boundFillVar.kind)} onOpen={() => setFillVarEditor(true)} onUnbind={unbindFillVar} />
            ) : (
              <FillControl props={props} set={set} />
            )}
          </Row>
          {fillVarMenu ? (
            <VarActionPopover
              anchorRef={fillRowRef}
              existing={vars?.variables ?? []}
              onCreate={createFillVar}
              onBind={bindFillVar}
              onClose={() => setFillVarMenu(false)}
            />
          ) : null}
          {fillVarEditor && boundFillVar ? (
            <VariablesEditor anchorRef={fillRowRef} variables={vars?.variables ?? []} selectedId={boundFillVar.id} onUpdate={(id, p) => vars?.update(id, p)} onClose={() => setFillVarEditor(false)} />
          ) : null}
        </div>
        <div ref={overflowRowRef} className="relative">
          <Row
            label="Überlauf"
            bound={!!boundOverflowVar}
            onVarClick={() => (boundOverflowVar ? setOverflowCondDialog(true) : setOverflowVarMenu((v) => !v))}
          >
            {boundOverflowVar ? (
              // Gebunden → Chip öffnet den Conditional-Value-Dialog (Framer „Overflow"-Popup).
              <VarChip name={boundOverflowVar.name} icon={varIcon(boundOverflowVar.kind)} onOpen={() => setOverflowCondDialog(true)} onUnbind={unbindOverflowVar} />
            ) : (
              <Select value={s("overflow", "clip")} onChange={(v) => set((p) => { p.overflow = v; })}>
                <option value="clip">Clip</option>
                <option value="visible">Visible</option>
                <option value="hidden">Hidden</option>
                <option value="auto">Scroll</option>
              </Select>
            )}
          </Row>
          {overflowVarMenu ? (
            <VarActionPopover
              anchorRef={overflowRowRef}
              existing={vars?.variables ?? []}
              onCreate={createOverflowVar}
              onBind={bindOverflowVar}
              onClose={() => setOverflowVarMenu(false)}
            />
          ) : null}
          {overflowCondDialog && boundOverflowVar && overflowBinding ? (
            <ConditionalValueDialog
              anchorRef={overflowRowRef}
              title="Overflow"
              variable={boundOverflowVar}
              valueOptions={[
                { value: "clip", label: "Clip" },
                { value: "visible", label: "Visible" },
                { value: "hidden", label: "Hidden" },
                { value: "auto", label: "Scroll" },
              ]}
              binding={overflowBinding}
              onChange={(bnd) => set((p) => { p.overflowBinding = bnd; })}
              onClose={() => setOverflowCondDialog(false)}
            />
          ) : null}
        </div>
        {/* Schrift je Element (Framer: Typografie-Override). Öffnet den Google-
            Fonts-Picker; leerer Wert = erbt die globale Seiten-Schrift. */}
        <div ref={fontRowRef} className="relative">
          <Row label="Schrift">
            <button
              type="button"
              onClick={() => setFontPickerOpen((v) => !v)}
              className={`flex ${FIELD_H} min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-background px-2 text-left text-xs`}
            >
              <Icon icon="ph:text-aa" className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate" style={s("fontFamily", "") ? { fontFamily: anyFontStack(s("fontFamily", "")) ?? undefined } : undefined}>
                {s("fontFamily", "") || "Erben"}
              </span>
              {s("fontFamily", "") ? (
                <button type="button" onClick={(e) => { e.stopPropagation(); set((p) => { p.fontFamily = null; }); }} className="ml-auto flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-secondary" aria-label="Schrift zurücksetzen"><Icon icon="ph:x" className="size-3" /></button>
              ) : (
                <Icon icon="ph:caret-down" className="ml-auto size-3 shrink-0 text-muted-foreground" />
              )}
            </button>
          </Row>
          {fontPickerOpen ? (
            <AnchoredPopover anchorRef={fontRowRef} onClose={() => setFontPickerOpen(false)} width={256} placement="left">
              <FontPicker
                value={s("fontFamily", "") || null}
                onChange={(fam) => set((p) => { p.fontFamily = fam; })}
                onClose={() => setFontPickerOpen(false)}
              />
            </AnchoredPopover>
          ) : null}
        </div>
        {/* Radius: im „alle Ecken"-Modus ein Wertfeld links; im „einzeln"-Modus
            ist das Wertfeld leer/inaktiv. Rechts IMMER die zwei Modus-Buttons
            (aktiv = blau umrandet, gefülltes Icon) — exakt wie Framer. */}
        <div ref={radiusRowRef} className="relative">
          <Row
            label="Radius"
            bound={!!boundRadiusVar}
            onVarClick={() => (boundRadiusVar ? unbindRadiusVar() : setRadiusVarMenu((v) => !v))}
          >
            {boundRadiusVar ? (
              <VarChip name={boundRadiusVar.name} icon={varIcon(boundRadiusVar.kind)} onOpen={() => undefined} onUnbind={unbindRadiusVar} />
            ) : (
              <>
                {radiusPerCorner ? (
                  <div className={`flex ${FIELD_H} min-w-0 flex-1 items-center ${FIELD_BOX} opacity-50`}>
                    <span className="px-2 text-xs text-muted-foreground">Mixed</span>
                  </div>
                ) : (
                  <NumStepper value={n("radius", 0)} onChange={(nv) => set((p) => { p.radius = Math.max(0, nv); })} />
                )}
                <div className="flex shrink-0 items-center gap-1">
                  <RadiusModeBtn label="Alle Ecken" active={!radiusPerCorner} icon="ph:square" onClick={() => setRadiusPerCorner(false)} />
                  <RadiusModeBtn label="Ecken einzeln" active={radiusPerCorner} icon="ph:frame-corners" onClick={() => setRadiusPerCorner(true)} />
                </div>
              </>
            )}
          </Row>
          {radiusVarMenu ? (
            <VarActionPopover anchorRef={radiusRowRef} existing={(vars?.variables ?? []).filter((v) => v.kind === "number")} onCreate={createRadiusVar} onBind={bindRadiusVar} onClose={() => setRadiusVarMenu(false)} />
          ) : null}
        </div>
        {/* Vier Einzel-Ecken-Radien, nur im „einzeln"-Modus (Bild 1). Eigene
            vollbreite Zeile OHNE Label-Gutter → vier schmale Felder nebeneinander. */}
        {radiusPerCorner && !boundRadiusVar ? (
          <div className="grid grid-cols-4 gap-1.5">
            <CornerBox value={n("radiusTL", n("radius", 0))} label="TL" onChange={(nv) => set((p) => { p.radiusTL = nv; })} />
            <CornerBox value={n("radiusTR", n("radius", 0))} label="TR" onChange={(nv) => set((p) => { p.radiusTR = nv; })} />
            <CornerBox value={n("radiusBR", n("radius", 0))} label="BR" onChange={(nv) => set((p) => { p.radiusBR = nv; })} />
            <CornerBox value={n("radiusBL", n("radius", 0))} label="BL" onChange={(nv) => set((p) => { p.radiusBL = nv; })} />
          </div>
        ) : null}
        {/* Drehen — wie Framer als Stile-Zeile mit ⊕, °-Feld + Slider (nicht nur
            in der Transformiert-Sektion). */}
        <div ref={rotateRowRef} className="relative">
          <Row
            label="Drehen"
            bound={!!boundRotateVar}
            onVarClick={() => (boundRotateVar ? unbindRotateVar() : setRotateVarMenu((v) => !v))}
          >
            {boundRotateVar ? (
              <VarChip name={boundRotateVar.name} icon={varIcon(boundRotateVar.kind)} onOpen={() => undefined} onUnbind={unbindRotateVar} />
            ) : (
              <>
                <div className={`${FIELD_BOX} ${FIELD_H} w-16 shrink-0`}>
                  <input type="number" value={n("rotate", 0)} onChange={(e) => set((p) => { p.rotate = Number(e.target.value); })} className={FIELD_INPUT} />
                  <span className="pr-2 text-[0.625rem] text-muted-foreground">°</span>
                </div>
                <RangeSlider value={n("rotate", 0)} min={-180} max={180} step={1} onChange={(v) => set((p) => { p.rotate = v; })} />
              </>
            )}
          </Row>
          {rotateVarMenu ? (
            <VarActionPopover anchorRef={rotateRowRef} existing={(vars?.variables ?? []).filter((v) => v.kind === "number")} onCreate={createRotateVar} onBind={bindRotateVar} onClose={() => setRotateVarMenu(false)} />
          ) : null}
        </div>
        <Row label="Grenze">
          <div ref={borderAnchorRef} className="relative flex min-w-0 flex-1 items-center gap-1.5">
            {border ? (
              // Grenze gesetzt → Swatch + Stil-Wert, „×“ entfernt sie.
              <button
                type="button"
                onClick={() => setBorderPopup((v) => !v)}
                className={`flex ${FIELD_H} min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-background px-2 text-left text-xs`}
              >
                <span className="size-3.5 shrink-0 rounded" style={{ backgroundColor: border.color, boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.1)" }} />
                <span className="flex-1 capitalize">{border.style}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => { openBorder(); setBorderPopup(true); }}
                className={`flex ${FIELD_H} min-w-0 flex-1 items-center rounded-md border border-border bg-background px-2 text-left text-xs text-muted-foreground`}
              >
                Add...
              </button>
            )}
            {border ? (
              <button
                type="button"
                aria-label="Grenze entfernen"
                onClick={() => { set((p) => { p.border = undefined; }); setBorderPopup(false); }}
                className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              >
                <Icon icon="ph:x" className="size-3.5" />
              </button>
            ) : null}
            {borderPopup ? (
              <BorderPopup
                anchorRef={borderAnchorRef}
                border={border ?? BORDER_DEFAULT}
                onChange={(mut) => set((p) => { const cur = (p.border as BorderVal | undefined) ?? { ...BORDER_DEFAULT }; mut(cur); p.border = cur; })}
                onClose={() => setBorderPopup(false)}
              />
            ) : null}
          </div>
        </Row>
        <ShadowsRow props={props} set={set} />

        {/* Zusatz-Stile aus dem „+“-Popover (Bild 2). Jeder aktivierte Eintrag
            erscheint als eigene Zeile mit passendem Control. */}
        {[...stilePanel].map((sid) => (
          <ZusatzStilRow key={sid} id={sid} props={props} set={set} onRemove={() => toggleStil(sid)} />
        ))}
      </Section>

      {/* Filter + Transform sind KEINE eigenen Sektionen (wie Framer) — sie
          werden über das ⊕ neben „Stile" als Zusatz-Stile hinzugefügt und
          erscheinen dann als Zeilen INNERHALB der Stile-Sektion. */}

      {/* Scrollabschnitt (Framer „Scroll Section"): ⊕ aktiviert → Name (wird
          zum #-Anker am Frame) + Offset Y; − deaktiviert wieder. */}
      {b("scrollSection", false) ? (
        <Section title="Scrollabschnitt" action={<RemoveInlineBtn onClick={() => set((p) => { p.scrollSection = false; })} />}>
          <Row label="Name">
            <div className={`${FIELD_BOX} ${FIELD_H} flex min-w-0 flex-1 items-center`}>
              <span className="pl-2 text-xs text-muted-foreground">#</span>
              <input
                value={s("scrollSectionName", "")}
                placeholder="name"
                onChange={(e) => set((p) => { p.scrollSectionName = e.target.value.replace(/\s+/g, "-").toLowerCase(); })}
                className={FIELD_INPUT}
              />
            </div>
          </Row>
          <Row label="Offset Y">
            <NumStepper value={n("scrollSectionOffsetY", 0)} onChange={(v) => set((p) => { p.scrollSectionOffsetY = v; })} />
          </Row>
        </Section>
      ) : (
        <Section title="Scrollabschnitt" action={<AddInlineBtn onClick={() => set((p) => { p.scrollSection = true; })} />} />
      )}

      {/* Zugänglichkeit (Framer): Google Bot — Skip (data-nosnippet) wird real
          als Attribut am Frame gerendert. */}
      <Section title="Zugänglichkeit" action={<PlusBtn />}>
        <Row label="Google Bot">
          <Select value={s("googleBot", "none")} onChange={(v) => set((p) => { p.googleBot = v; })}>
            <option value="no-snippet">Skip (data-nosnippet)</option>
            <option value="none">Include (default)</option>
          </Select>
        </Row>
      </Section>

      {/* Codeüberschreibungen (Framer „Code Overrides"): Datei wählen/anlegen
          (neue Datei = Beispiel-Template), Override-Funktion wählen (aus den
          Exporten geparst), „Edit Code" öffnet den Code-Editor in der Mitte. */}
      <Section title="Codeüberschreibungen" action={<PlusBtn />}>
        <Row label="Datei">
          <Select
            value={s("codeOverrideFile", "") || ""}
            onChange={(v) => {
              if (v === "__new__") { setNewCodeFile(true); return; }
              set((p) => { p.codeOverrideFile = v || null; });
            }}
          >
            {s("codeOverrideFile", "") ? (
              <option value={s("codeOverrideFile", "")}>{s("codeOverrideFile", "")}</option>
            ) : (
              <option value="" disabled>Auswählen …</option>
            )}
            <hr />
            <option value="__new__">Neue Datei …</option>
          </Select>
        </Row>
        {newCodeFile ? (
          <Row label="Name">
            <TextField value={codeFileName} placeholder="Overrides.tsx" onChange={setCodeFileName} />
            <button
              type="button"
              aria-label="Datei anlegen"
              onClick={() => {
                const name = codeFileName.trim();
                if (!name) return;
                set((p) => {
                  p.codeOverrideFile = name;
                  // Neue Datei startet mit dem Beispiel-Template (wie Framer).
                  if (!p.codeOverrideSource) p.codeOverrideSource = CODE_TEMPLATE;
                });
                setNewCodeFile(false);
                setCodeFileName("");
              }}
              className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            >
              <Icon icon="ph:check" className="size-3.5" />
            </button>
          </Row>
        ) : null}
        {s("codeOverrideFile", "") ? (
          <>
            <Row label="Überschreiben">
              <Select value={s("codeOverride", "") || ""} onChange={(v) => set((p) => { p.codeOverride = v || null; })}>
                <option value="" disabled>Select…</option>
                <hr />
                {parseOverrides(s("codeOverrideSource", "")).map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </Select>
            </Row>
            <button
              type="button"
              onClick={() =>
                frame?.openCodeEditor({
                  file: s("codeOverrideFile", ""),
                  source: s("codeOverrideSource", ""),
                  onSave: (src) => set((p) => { p.codeOverrideSource = src; }),
                })
              }
              className={`flex ${FIELD_H} w-full items-center justify-center rounded-md bg-secondary text-xs font-medium transition hover:bg-secondary/70`}
            >
              Edit Code
            </button>
          </>
        ) : null}
      </Section>
    </div>
  );
}
