"use client";

// Layout-Sektion (Framer Auto-Layout: Stack/Grid) und Filter-Sektion
// (Blur/Helligkeit/… als Zusatz-Stil einbettbar via headless).
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { useVariables } from "../variables-context";
import {
  CornerBox,
  FIELD_BOX,
  FIELD_H,
  IconSeg,
  type InspProps,
  MinusBtn,
  NumStepper,
  RadiusModeBtn,
  RangeSlider,
  Row,
  Section,
  Select,
} from "./ui";
import { VarActionPopover } from "./variables-ui";

// Layout-Sektion (Framer): Typ Stack/Grid · Richtung (↔/↕) · Verteilen · Ausrichten
// (3 Icons) · Wickeln · Lücke (Feld+Slider) · Polsterung (Feld+Modus). Jede Zeile
// außer Typ/Wickeln hat ein ⊕-Bind-Badge.
export function LayoutSection({ props, set }: InspProps) {
  const t = useTranslations("website");
  const mode = (props.layoutMode as string | undefined) ?? "none";
  const s = (k: string, d: string) => (typeof props[k] === "string" ? (props[k] as string) : d);
  const nn = (k: string, d: number) => (typeof props[k] === "number" ? (props[k] as number) : d);
  // Polsterung-Modus: alle Seiten gleich (ein Feld) oder einzeln (T·R·B·L).
  const padPerSide = (props.padPerSide as boolean | undefined) ?? false;
  const dir = s("stackDirection", "column");
  const align = s("stackAlign", "start");
  const wrap = (props.stackWrap as boolean | undefined) ?? false;

  // Variablen-Bindung für Layout-Felder (Framer: ⊕ an Richtung/Verteilen/
  // Ausrichten/Lücke/Polsterung/Spalten/Zeilen). Die Bindung lebt in einer
  // <feld>Var-Prop; das Rendering im FrameNode löst sie auf. `useLayoutVarBind`
  // liefert Menü-State + Callbacks pro Feld.
  const vars = useVariables();
  const [openBind, setOpenBind] = useState<string | null>(null); // welches Feld-Menü offen
  const rowRefsMap = useRef<Map<string, React.RefObject<HTMLDivElement | null>>>(new Map());
  const bindRow = (key: string) => {
    let r = rowRefsMap.current.get(key);
    if (!r) { r = { current: null }; rowRefsMap.current.set(key, r); }
    return r;
  };
  // Für ein numerisches Layout-Feld eine Variable erstellen/binden/lösen.
  const numVar = (varKey: string, current: number, unit: string) => ({
    id: (s(varKey, "") || null) as string | null,
    bound: vars?.get(s(varKey, "") || null) ?? null,
    create: () => {
      if (!vars) return;
      const v = vars.create({ name: varKey, defaultValue: current, min: 0, max: 200, step: 1, unit, queryParam: varKey });
      set((p) => { p[varKey] = v.id; });
      setOpenBind(null);
    },
    bind: (id: string) => { set((p) => { p[varKey] = id; }); setOpenBind(null); },
    unbind: () => set((p) => { p[varKey] = null; }),
  });
  // Für ein Enum/boolean-Layout-Feld (Richtung/Verteilen/Ausrichten) binden.
  const enumVar = (varKey: string) => ({
    id: (s(varKey, "") || null) as string | null,
    bound: vars?.get(s(varKey, "") || null) ?? null,
    create: () => {
      if (!vars) return;
      const v = vars.create({ name: varKey, kind: "boolean", queryParam: varKey });
      set((p) => { p[varKey] = v.id; });
      setOpenBind(null);
    },
    bind: (id: string) => { set((p) => { p[varKey] = id; }); setOpenBind(null); },
    unbind: () => set((p) => { p[varKey] = null; }),
  });

  // Bind-Popover für ein Feld rendern (gemeinsame Kaskade wie im FrameInspektor).
  const bindPopover = (key: string, api: { create: () => void; bind: (id: string) => void }, kindFilter?: "number" | "boolean") =>
    openBind === key ? (
      <VarActionPopover
        anchorRef={bindRow(key)}
        existing={(vars?.variables ?? []).filter((v) => (kindFilter ? v.kind === kindFilter : true))}
        onCreate={api.create}
        onBind={(id) => api.bind(id)}
        onClose={() => setOpenBind(null)}
      />
    ) : null;

  return (
    <Section title="Layout" action={<MinusBtn />}>
      <Row label="Typ">
        <div className={`flex ${FIELD_H} flex-1 overflow-hidden rounded-md border border-border`}>
          <button type="button" onClick={() => set((p) => { p.layoutMode = "stack"; })}
            className={"flex-1 text-xs transition " + (mode !== "grid" ? "bg-background font-medium text-primary shadow-sm" : "text-muted-foreground hover:bg-secondary")}>Stack</button>
          <button type="button" onClick={() => set((p) => { p.layoutMode = "grid"; })}
            className={"flex-1 border-l border-border text-xs transition " + (mode === "grid" ? "bg-background font-medium text-primary shadow-sm" : "text-muted-foreground hover:bg-secondary")}>Grid</button>
        </div>
      </Row>
      {mode !== "grid" ? (
        <>
          <div ref={bindRow("dir")} className="relative">
            <Row label="Richtung" bound={!!enumVar("stackDirectionVar").bound} onVarClick={() => setOpenBind((k) => (k === "dir" ? null : "dir"))}>
              <div className={`flex ${FIELD_H} flex-1 overflow-hidden rounded-md border border-border`}>
                <IconSeg first active={dir === "row"} onClick={() => set((p) => { p.stackDirection = "row"; })} icon="ph:arrows-horizontal" label="Horizontal" />
                <IconSeg active={dir === "column"} onClick={() => set((p) => { p.stackDirection = "column"; })} icon="ph:arrows-vertical" label="Vertikal" />
              </div>
            </Row>
            {bindPopover("dir", enumVar("stackDirectionVar"), "boolean")}
          </div>
          <div ref={bindRow("dist")} className="relative">
            <Row label="Verteilen" bound={!!enumVar("stackDistributeVar").bound} onVarClick={() => setOpenBind((k) => (k === "dist" ? null : "dist"))}>
              <Select value={s("stackDistribute", "start")} onChange={(v) => set((p) => { p.stackDistribute = v; })}>
                <option value="start">Start</option>
                <option value="center">Center</option>
                <option value="end">End</option>
                <option value="space-between">{t("editor.spaceBetween")}</option>
                <option value="space-around">{t("editor.spaceAround")}</option>
                <option value="space-evenly">{t("editor.spaceEvenly")}</option>
              </Select>
            </Row>
            {bindPopover("dist", enumVar("stackDistributeVar"))}
          </div>
          <div ref={bindRow("align")} className="relative">
            <Row label="Ausrichten" bound={!!enumVar("stackAlignVar").bound} onVarClick={() => setOpenBind((k) => (k === "align" ? null : "align"))}>
              <div className={`flex ${FIELD_H} flex-1 overflow-hidden rounded-md border border-border`}>
                <IconSeg first active={align === "start"} onClick={() => set((p) => { p.stackAlign = "start"; })} icon={dir === "row" ? "ph:align-top" : "ph:align-left"} label="Start" />
                <IconSeg active={align === "center"} onClick={() => set((p) => { p.stackAlign = "center"; })} icon={dir === "row" ? "ph:align-center-vertical" : "ph:align-center-horizontal"} label="Center" />
                <IconSeg active={align === "end"} onClick={() => set((p) => { p.stackAlign = "end"; })} icon={dir === "row" ? "ph:align-bottom" : "ph:align-right"} label="End" />
              </div>
            </Row>
            {bindPopover("align", enumVar("stackAlignVar"))}
          </div>
          <Row label="Wickeln">
            <div className={`flex ${FIELD_H} flex-1 overflow-hidden rounded-md border border-border`}>
              <button type="button" onClick={() => set((p) => { p.stackWrap = true; })} className={"flex-1 text-xs transition " + (wrap ? "bg-background font-medium text-primary shadow-sm" : "text-muted-foreground hover:bg-secondary")}>Yes</button>
              <button type="button" onClick={() => set((p) => { p.stackWrap = false; })} className={"flex-1 border-l border-border text-xs transition " + (!wrap ? "bg-background font-medium text-primary shadow-sm" : "text-muted-foreground hover:bg-secondary")}>No</button>
            </div>
          </Row>
          <div ref={bindRow("gap")} className="relative">
            <Row label={t("editor.gap")} bound={!!numVar("stackGapVar", nn("stackGap", 0), "px").bound} onVarClick={() => setOpenBind((k) => (k === "gap" ? null : "gap"))}>
              <div className="w-16 shrink-0"><NumStepper value={nn("stackGap", 0)} onChange={(v) => set((p) => { p.stackGap = Math.max(0, v); })} /></div>
              <RangeSlider value={nn("stackGap", 0)} min={0} max={100} step={1} onChange={(v) => set((p) => { p.stackGap = v; })} />
            </Row>
            {bindPopover("gap", numVar("stackGapVar", nn("stackGap", 0), "px"), "number")}
          </div>
        </>
      ) : (
        <>
          <div ref={bindRow("cols")} className="relative">
            <Row label="Spalten" bound={!!numVar("gridColumnsVar", nn("gridColumns", 2), "none").bound} onVarClick={() => setOpenBind((k) => (k === "cols" ? null : "cols"))}>
              <NumStepper value={nn("gridColumns", 2)} onChange={(v) => set((p) => { p.gridColumns = Math.max(1, v); })} />
            </Row>
            {bindPopover("cols", numVar("gridColumnsVar", nn("gridColumns", 2), "none"), "number")}
          </div>
          <div ref={bindRow("rows")} className="relative">
            <Row label="Zeilen" bound={!!numVar("gridRowsVar", nn("gridRows", 0), "none").bound} onVarClick={() => setOpenBind((k) => (k === "rows" ? null : "rows"))}>
              <NumStepper value={nn("gridRows", 0)} onChange={(v) => set((p) => { p.gridRows = Math.max(0, v); })} />
            </Row>
            {bindPopover("rows", numVar("gridRowsVar", nn("gridRows", 0), "none"), "number")}
          </div>
          <div ref={bindRow("ggap")} className="relative">
            <Row label={t("editor.gap")} bound={!!numVar("gridGapVar", nn("gridGap", 0), "px").bound} onVarClick={() => setOpenBind((k) => (k === "ggap" ? null : "ggap"))}>
              <div className="w-16 shrink-0"><NumStepper value={nn("gridGap", 0)} onChange={(v) => set((p) => { p.gridGap = Math.max(0, v); })} /></div>
              <RangeSlider value={nn("gridGap", 0)} min={0} max={100} step={1} onChange={(v) => set((p) => { p.gridGap = v; })} />
            </Row>
            {bindPopover("ggap", numVar("gridGapVar", nn("gridGap", 0), "px"), "number")}
          </div>
        </>
      )}
      {/* Polsterung: ein Feld (alle Seiten) + Modus-Buttons; „einzeln" → T·R·B·L. */}
      <div ref={bindRow("pad")} className="relative">
        <Row label="Polsterung" bound={!!numVar("padVar", nn("padTop", 0), "px").bound} onVarClick={() => setOpenBind((k) => (k === "pad" ? null : "pad"))}>
          {padPerSide ? (
            <div className={`flex ${FIELD_H} min-w-0 flex-1 items-center ${FIELD_BOX} opacity-50`}><span className="px-2 text-xs text-muted-foreground">Mixed</span></div>
          ) : (
            <NumStepper value={nn("padTop", 0)} onChange={(v) => set((p) => { p.padTop = v; p.padRight = v; p.padBottom = v; p.padLeft = v; })} />
          )}
          <div className="flex shrink-0 items-center gap-1">
            <RadiusModeBtn label={t("editor.allSides")} active={!padPerSide} icon="ph:square" onClick={() => set((p) => { p.padPerSide = false; })} />
            <RadiusModeBtn label={t("editor.sidesSeparate")} active={padPerSide} icon="ph:frame-corners" onClick={() => set((p) => { p.padPerSide = true; })} />
          </div>
        </Row>
        {bindPopover("pad", numVar("padVar", nn("padTop", 0), "px"), "number")}
      </div>
      {padPerSide ? (
        <div className="grid grid-cols-4 gap-1.5">
          <CornerBox value={nn("padTop", 0)} label="T" onChange={(v) => set((p) => { p.padTop = v; })} />
          <CornerBox value={nn("padRight", 0)} label="R" onChange={(v) => set((p) => { p.padRight = v; })} />
          <CornerBox value={nn("padBottom", 0)} label="B" onChange={(v) => set((p) => { p.padBottom = v; })} />
          <CornerBox value={nn("padLeft", 0)} label="L" onChange={(v) => set((p) => { p.padLeft = v; })} />
        </div>
      ) : null}
    </Section>
  );
}

// Filter-Sektion (Framer): Blur/Brightness/Contrast/Saturate/Hue/Invert/Grayscale/Sepia.
// `headless` = nur die Zeilen (ohne <Section>-Wrapper), für die Einbettung als
// Zusatz-Stil im Stile-⊕-Katalog (Framer hat kein eigenes „Filter"-Panel).
export function FiltersSection({ props, set, headless }: InspProps & { headless?: boolean }) {
  const f = (props.filters as Record<string, number> | undefined) ?? {};
  const patch = (k: string, v: number) =>
    set((p) => {
      const cur = { ...((p.filters as Record<string, number> | undefined) ?? {}) };
      cur[k] = v;
      p.filters = cur;
    });
  const rows: { key: string; label: string; min: number; max: number; def: number }[] = [
    { key: "blur", label: "Blur", min: 0, max: 50, def: 0 },
    { key: "brightness", label: "Helligkeit", min: 0, max: 200, def: 100 },
    { key: "contrast", label: "Kontrast", min: 0, max: 200, def: 100 },
    { key: "saturate", label: "Sättigung", min: 0, max: 200, def: 100 },
    { key: "hueRotate", label: "Farbton", min: 0, max: 360, def: 0 },
    { key: "invert", label: "Invertieren", min: 0, max: 100, def: 0 },
    { key: "grayscale", label: "Graustufen", min: 0, max: 100, def: 0 },
    { key: "sepia", label: "Sepia", min: 0, max: 100, def: 0 },
  ];
  const body = (
    <>
      {rows.map((r) => (
        <Row key={r.key} label={r.label}>
          <RangeSlider value={f[r.key] ?? r.def} min={r.min} max={r.max} step={1} onChange={(v) => patch(r.key, v)} />
          <span className="w-8 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{Math.round(f[r.key] ?? r.def)}</span>
        </Row>
      ))}
      <Row label="Backdrop">
        <RangeSlider value={(props.backdropBlur as number) ?? 0} min={0} max={40} step={1} onChange={(v) => set((p) => { p.backdropBlur = v; })} />
        <span className="w-8 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{Math.round((props.backdropBlur as number) ?? 0)}</span>
      </Row>
    </>
  );
  if (headless) return body;
  return <Section title="Filter">{body}</Section>;
}
