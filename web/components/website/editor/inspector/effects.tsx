"use client";

// Auswirkungen (Framer „Effects" via Framer Motion): Effekt-Liste + Popup
// (Auslöser · Zielzustand · Übergang Tween/Spring).
import { Icon } from "@iconify/react";
import { useRef, useState } from "react";

import {
  AddInlineBtn,
  AnchoredPopover,
  FIELD_H,
  type InspProps,
  NumStepper,
  Row,
  Section,
  Select,
} from "./ui";

// --- Auswirkungen (Framer „Effects" / Interactions via Framer Motion) --------
// Ein Effekt-Eintrag (lokale Spiegelung von FrameEffect aus nodes.tsx, um
// Import-Zyklen zu vermeiden — wie FrameShadow).
export type FrameEffect = {
  id: string;
  trigger: "hover" | "press" | "appear" | "scroll" | "parallax";
  scale?: number;
  opacity?: number;
  x?: number;
  y?: number;
  rotate?: number;
  blur?: number;
  parallaxDistance?: number;
  transitionType?: "tween" | "spring";
  duration?: number;
  delay?: number;
  ease?: "linear" | "easeIn" | "easeOut" | "easeInOut";
  stiffness?: number;
  damping?: number;
  mass?: number;
};

export const EFFECT_TRIGGERS: { id: FrameEffect["trigger"]; label: string; icon: string; hint: string }[] = [
  { id: "hover", label: "Hover", icon: "ph:cursor", hint: "Zeiger darüber" },
  { id: "press", label: "Drücken", icon: "ph:hand-tap", hint: "Beim Klicken" },
  { id: "appear", label: "Erscheinen", icon: "ph:sparkle", hint: "Beim Laden" },
  { id: "scroll", label: "Beim Scrollen", icon: "ph:arrow-line-down", hint: "In Sicht" },
  { id: "parallax", label: "Parallaxe", icon: "ph:stack", hint: "Scroll-Tiefe" },
];

// Kurzbeschreibung eines Effekts für die Listenzeile (z. B. „Skalieren 1.1").
export function effectSummary(e: FrameEffect): string {
  const parts: string[] = [];
  if (e.scale != null) parts.push(`Skal. ${e.scale}`);
  if (e.opacity != null) parts.push(`Deck. ${e.opacity}`);
  if (e.x != null) parts.push(`X ${e.x}`);
  if (e.y != null) parts.push(`Y ${e.y}`);
  if (e.rotate != null) parts.push(`${e.rotate}°`);
  if (e.blur != null) parts.push(`Blur ${e.blur}`);
  if (e.trigger === "parallax" && e.parallaxDistance != null) parts.push(`± ${e.parallaxDistance}px`);
  return parts.join(" · ") || "—";
}

// Auswirkungen-Sektion (Framer): Liste stapelbarer Effekte, jede Zeile öffnet
// ein Popup (Trigger + Ziel-Delta + Transition). „+" fügt einen Hover-Effekt
// hinzu und öffnet ihn direkt (wie Framers leerer „+"-Zustand).
export function EffectsSection({ props, set }: InspProps) {
  const effects = (props.effects as FrameEffect[] | undefined) ?? [];
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const rowRefsMap = useRef<Map<number, React.RefObject<HTMLDivElement | null>>>(new Map());
  const rowRef = (i: number) => {
    let r = rowRefsMap.current.get(i);
    if (!r) { r = { current: null }; rowRefsMap.current.set(i, r); }
    return r;
  };
  const patch = (i: number, mut: (e: FrameEffect) => void) =>
    set((p) => {
      const arr = [...((p.effects as FrameEffect[] | undefined) ?? [])];
      const cur = { ...arr[i] };
      mut(cur);
      arr[i] = cur;
      p.effects = arr;
    });
  // Neuer Effekt: eindeutige ID aus Länge + vorhandenen IDs (kein Date/Random).
  const nextId = () => {
    const used = new Set(effects.map((e) => e.id));
    let i = effects.length;
    while (used.has(`fx${i}`)) i += 1;
    return `fx${i}`;
  };
  const add = () => {
    set((p) => {
      const arr = [...((p.effects as FrameEffect[] | undefined) ?? [])];
      arr.push({ id: nextId(), trigger: "hover", scale: 1.05, transitionType: "spring", stiffness: 300, damping: 20, mass: 1 });
      p.effects = arr;
    });
    setOpenIdx(effects.length);
  };
  const remove = (i: number) =>
    set((p) => {
      const arr = [...((p.effects as FrameEffect[] | undefined) ?? [])];
      arr.splice(i, 1);
      p.effects = arr;
    });
  return (
    <Section title="Auswirkungen" action={<AddInlineBtn onClick={add} />}>
      {effects.map((fx, i) => {
        const trig = EFFECT_TRIGGERS.find((t) => t.id === fx.trigger);
        return (
          <div key={fx.id} ref={rowRef(i)} className="relative">
            <Row label={i === 0 ? "Effekt" : ""}>
              <button type="button" onClick={() => setOpenIdx(openIdx === i ? null : i)} className={`flex ${FIELD_H} min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-background px-2 text-left text-xs`}>
                <Icon icon={trig?.icon ?? "ph:sparkle"} className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="shrink-0 font-medium">{trig?.label ?? fx.trigger}</span>
                <span className="truncate text-muted-foreground">{effectSummary(fx)}</span>
              </button>
              <button type="button" onClick={() => remove(i)} className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground" aria-label="Effekt entfernen"><Icon icon="ph:x" className="size-3.5" /></button>
            </Row>
            {openIdx === i ? (
              <EffectPopup anchorRef={rowRef(i)} effect={fx} onChange={(mut) => patch(i, mut)} onClose={() => setOpenIdx(null)} />
            ) : null}
          </div>
        );
      })}
      {effects.length === 0 ? (
        <Row label="Effekt">
          <button type="button" onClick={add} className={`flex ${FIELD_H} min-w-0 flex-1 items-center gap-2 rounded-md border border-dashed border-border bg-background px-2 text-left text-xs text-muted-foreground transition hover:bg-secondary`}>
            <Icon icon="ph:plus" className="size-3.5 shrink-0" />
            Effekt hinzufügen …
          </button>
        </Row>
      ) : null}
    </Section>
  );
}

// Effekt-Popup (Framer): Trigger (Hover/Drücken/Erscheinen/Scrollen/Parallaxe) ·
// Ziel-Delta (Skalieren/Deckkraft/X/Y/Drehen/Blur) · Transition (Tween/Spring).
export function EffectPopup({
  anchorRef,
  effect,
  onChange,
  onClose,
}: {
  anchorRef: React.RefObject<HTMLElement | null>;
  effect: FrameEffect;
  onChange: (mut: (e: FrameEffect) => void) => void;
  onClose: () => void;
}) {
  // Delta-Zeile: Toggle (aktiv/inaktiv) + NumStepper. Inaktiv = Feld undefined
  // (Achse wirkt nicht), aktiv = konkreter Wert.
  const DeltaRow = ({ label, field, step = 1, unit, defaultVal }: { label: string; field: keyof FrameEffect; step?: number; unit?: string; defaultVal: number }) => {
    const active = effect[field] != null;
    const val = (effect[field] as number | undefined) ?? defaultVal;
    return (
      <Row label={label}>
        <button type="button" onClick={() => onChange((e) => { if (active) delete e[field]; else (e[field] as number) = defaultVal; })}
          className={"flex size-5 shrink-0 items-center justify-center rounded border transition " + (active ? "border-primary bg-primary text-primary-foreground" : "border-border text-transparent hover:bg-secondary")}
          aria-label={active ? `${label} deaktivieren` : `${label} aktivieren`}>
          <Icon icon="ph:check" className="size-3" />
        </button>
        <div className={`min-w-0 flex-1 ${active ? "" : "pointer-events-none opacity-40"}`}>
          <NumStepper value={val} step={step} unit={unit} onChange={(v) => onChange((e) => { (e[field] as number) = v; })} />
        </div>
      </Row>
    );
  };
  const isSpring = effect.transitionType === "spring";
  return (
    <AnchoredPopover anchorRef={anchorRef} onClose={onClose} width={320} placement="left">
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-black/20">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-[0.8125rem] font-semibold">Effekt</span>
          <button type="button" aria-label="schließen" onClick={onClose} className="flex size-5 items-center justify-center rounded text-muted-foreground transition hover:bg-secondary hover:text-foreground"><Icon icon="ph:x" className="size-3.5" /></button>
        </div>
        <div className="flex flex-col gap-3 p-4">
          {/* Trigger-Auswahl (5 Icon-Segmente) */}
          <Row label="Auslöser">
            <div className={`flex ${FIELD_H} flex-1 overflow-hidden rounded-md border border-border`}>
              {EFFECT_TRIGGERS.map((t, i) => (
                <button key={t.id} type="button" title={`${t.label} — ${t.hint}`} onClick={() => onChange((e) => { e.trigger = t.id; })}
                  className={"flex flex-1 items-center justify-center transition " + (effect.trigger === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary") + (i > 0 ? " border-l border-border" : "")}>
                  <Icon icon={t.icon} className="size-3.5" />
                </button>
              ))}
            </div>
          </Row>

          {effect.trigger === "parallax" ? (
            // Parallaxe: nur die Verschiebungsdistanz (kein Delta-Zustand).
            <Row label="Distanz">
              <NumStepper value={effect.parallaxDistance ?? 60} unit="px" onChange={(v) => onChange((e) => { e.parallaxDistance = v; })} />
            </Row>
          ) : (
            <>
              <div className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">Zielzustand</div>
              <DeltaRow label="Skalieren" field="scale" step={0.05} defaultVal={1.05} />
              <DeltaRow label="Deckkraft" field="opacity" step={0.05} defaultVal={0} />
              <DeltaRow label="X" field="x" unit="px" defaultVal={0} />
              <DeltaRow label="Y" field="y" unit="px" defaultVal={20} />
              <DeltaRow label="Drehen" field="rotate" unit="°" defaultVal={0} />
              <DeltaRow label="Weichzeichnen" field="blur" unit="px" defaultVal={0} />
            </>
          )}

          {/* Transition */}
          <div className="mt-1 border-t border-border pt-3 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">Übergang</div>
          <Row label="Typ">
            <div className={`flex ${FIELD_H} flex-1 overflow-hidden rounded-md border border-border`}>
              <button type="button" onClick={() => onChange((e) => { e.transitionType = "tween"; })} className={"flex-1 text-xs transition " + (!isSpring ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary")}>Tween</button>
              <button type="button" onClick={() => onChange((e) => { e.transitionType = "spring"; })} className={"flex-1 border-l border-border text-xs transition " + (isSpring ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary")}>Spring</button>
            </div>
          </Row>
          {isSpring ? (
            <>
              <Row label="Steifigkeit"><NumStepper value={effect.stiffness ?? 300} onChange={(v) => onChange((e) => { e.stiffness = Math.max(1, v); })} /></Row>
              <Row label="Dämpfung"><NumStepper value={effect.damping ?? 20} onChange={(v) => onChange((e) => { e.damping = Math.max(0, v); })} /></Row>
              <Row label="Masse"><NumStepper value={effect.mass ?? 1} step={0.1} onChange={(v) => onChange((e) => { e.mass = Math.max(0.1, v); })} /></Row>
            </>
          ) : (
            <>
              <Row label="Dauer"><NumStepper value={effect.duration ?? 0.3} step={0.05} unit="s" onChange={(v) => onChange((e) => { e.duration = Math.max(0, v); })} /></Row>
              <Row label="Beschleunigung">
                <Select value={effect.ease ?? "easeInOut"} onChange={(v) => onChange((e) => { e.ease = v as FrameEffect["ease"]; })}>
                  <option value="linear">Linear</option>
                  <option value="easeIn">Ease In</option>
                  <option value="easeOut">Ease Out</option>
                  <option value="easeInOut">Ease In-Out</option>
                </Select>
              </Row>
            </>
          )}
          <Row label="Verzögerung"><NumStepper value={effect.delay ?? 0} step={0.05} unit="s" onChange={(v) => onChange((e) => { e.delay = Math.max(0, v); })} /></Row>
        </div>
      </div>
    </AnchoredPopover>
  );
}
