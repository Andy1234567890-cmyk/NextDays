"use client";

// Gemeinsame Inspektor-Bausteine (Framer-Stil): Sektionen, Zeilen, Zahlen-/
// Textfelder, Stepper, Slider, Popover-Hüllen und Header-Buttons. Reine UI-
// Primitive ohne Editor-Zustand — von allen Inspektor-Dateien importiert.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { Label } from "@nextdays/ui/label";

// --- Layout-Bausteine des Inspektors ----------------------------------------
// Sektion wie Framer: kleiner Titel links, rechts ein Icon-Button (Plus wenn
// leer/hinzufügbar, Minus wenn befüllt). Ohne `action` kein Button.
export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-b border-border px-3 py-3">
      <div className={"flex items-center justify-between" + (children ? " mb-3" : "")}>
        <span className="text-[0.8125rem] font-semibold">{title}</span>
        {action}
      </div>
      {children ? <div className="flex flex-col gap-2.5">{children}</div> : null}
    </div>
  );
}

// rgba-String aus Hex + Alpha-Prozent bauen (Framer-Farbfeld: Hex + %).
export function rgbaFrom(hex: string, alphaPct: number): string {
  const h = hexOnly(hex).replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${Math.round(alphaPct) / 100})`;
}

// Alpha-Prozent aus einem Farbwert lesen (rgba → %, sonst 100).
export function alphaPctOf(c: string): number {
  const m = c.match(/rgba?\([^)]*,\s*([0-9.]+)\s*\)/);
  return m ? Math.round(Number(m[1]) * 100) : 100;
}

// Farbwert auf einen `#rrggbb`-Hex für <input type=color> reduzieren (ignoriert
// Alpha/rgba — der Picker kann nur Hex; der volle Wert bleibt in der Prop).
export function hexOnly(c: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(c)) return c;
  const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) {
    const h = (x: string) => Number(x).toString(16).padStart(2, "0");
    return `#${h(m[1])}${h(m[2])}${h(m[3])}`;
  }
  return "#000000";
}

// ── Einheitliches Feld-System (Framer-kompakt) ──────────────────────────────
// ALLE Inspektor-Felder teilen exakt dieselbe Höhe, Schrift und Chrome. Nie die
// globale (hohe) NativeSelect im Inspektor verwenden — hier gilt FIELD_H.
export const FIELD_H = "h-7"; // 1.75rem — kompakte Framer-Feldhöhe

export const FIELD_BOX =
  "flex items-center rounded-md border border-border bg-background text-xs";

export const FIELD_INPUT = "w-full min-w-0 bg-transparent px-2 text-xs outline-none";

// Zeile: fixe Label-Spalte links, Feld-Spalte rechts (Grid → alle bündig).
// Feste Label-Spaltenbreite (Framer): breit genug für „Opazität"/„Überlauf"
// /„Sichtbar" ohne Abschneiden. Zentral, damit ALLE Zeilen bündig bleiben.
export const LABEL_COL = "grid-cols-[4.5rem_1fr]";

// `wide` = breitere Label-Spalte für Formulare mit langen Labels (z. B. der
// Variablen-Editor: „Description"/„Query Param" dürfen nicht abgeschnitten sein).
export function Row({
  label,
  wide,
  align = "center",
  onVarClick,
  bound,
  children,
}: {
  label: string;
  wide?: boolean;
  align?: "center" | "start";
  // Optional: ⊕-Badge links (Framer „an Variable binden"). Wenn gesetzt, wechselt
  // die Zeile auf das 3-Spalten-Layout wie Opazität/Sichtbar (Badge · Label · Wert).
  onVarClick?: () => void;
  bound?: boolean;
  children: React.ReactNode;
}) {
  if (onVarClick) {
    return (
      <div className={`grid grid-cols-[0.875rem_3.625rem_1fr] items-center gap-x-1.5 ${align === "start" ? "items-start" : "items-center"}`}>
        <VarBadge bound={!!bound} onClick={onVarClick} />
        <Label className={"truncate text-xs " + (bound ? "text-primary" : "text-muted-foreground")}>{label}</Label>
        <div className="flex min-w-0 items-center gap-1.5">{children}</div>
      </div>
    );
  }
  return (
    <div className={`grid ${wide ? "grid-cols-[6.5rem_1fr]" : LABEL_COL} gap-2 ${align === "start" ? "items-start" : "items-center"}`}>
      <Label className={"truncate text-xs text-muted-foreground " + (align === "start" ? "pt-1.5" : "")}>{label}</Label>
      <div className="flex min-w-0 items-center gap-1.5">{children}</div>
    </div>
  );
}

// Eingabefeld mit optionalem Einheiten-/Achsen-Kürzel rechts (grau, wie Framer).
// WICHTIG: lokaler Entwurf beim Tippen — committet erst bei Blur/Enter. Sonst
// würde ein per-Tastendruck-Clamp (z.B. Breite min 280) freie Eingaben zerstören
// (Tippen von „300" → „3" → geklemmt auf 280). Externe Wertänderungen werden
// übernommen, solange das Feld NICHT fokussiert ist.
export function NumBox({
  value,
  unit,
  axis,
  onChange,
  disabled,
}: {
  value: number | string;
  unit?: string;
  axis?: string;
  onChange?: (v: string) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(value);
  const commit = () => {
    if (draft !== null && onChange) onChange(draft);
    setDraft(null);
  };
  return (
    <div className={`${FIELD_BOX} ${FIELD_H} min-w-0 flex-1 ${disabled ? "opacity-60" : ""}`}>
      <input
        value={shown}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.currentTarget.blur(); }
          if (e.key === "Escape") { setDraft(null); e.currentTarget.blur(); }
        }}
        className={FIELD_INPUT}
      />
      {unit || axis ? (
        <span className="pr-2 text-[0.625rem] uppercase text-muted-foreground">{unit ?? axis}</span>
      ) : null}
    </div>
  );
}

// Numerisches Feld mit Hoch/Runter-Steppern (wie Framer): eingebaute Caret-
// Pfeile rechts, Pfeiltasten ↑/↓ (+Shift = 10er-Schritte) und Scrub per Ziehen
// am Achsen-Kürzel. Der ganze Bau ist auf FIELD_H normalisiert.
export function NumStepper({
  value,
  axis,
  unit,
  step = 1,
  disabled,
  onChange,
}: {
  value: number;
  axis?: string;
  unit?: string;
  step?: number;
  disabled?: boolean;
  onChange?: (v: number) => void;
}) {
  const t = useTranslations("website");
  // Nachkommastellen an die Schrittweite koppeln (step<1 → Dezimalwerte erhalten).
  const round = (v: number) => (step < 1 ? Math.round(v / step) * step : Math.round(v));
  const commit = (v: number) => onChange?.(round(v));
  const bump = (dir: 1 | -1, big = false) => commit(value + dir * step * (big ? 10 : 1));

  // Scrub: am Kürzel ziehen ändert den Wert (1px = 1 Schritt).
  function startScrub(e: React.MouseEvent) {
    if (disabled) return;
    e.preventDefault();
    const sx = e.clientX;
    const start = value;
    const onMove = (ev: MouseEvent) => commit(start + (ev.clientX - sx) * step);
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  return (
    <div className={`${FIELD_BOX} ${FIELD_H} min-w-0 flex-1 ${disabled ? "opacity-60" : ""}`}>
      <input
        value={value}
        disabled={disabled}
        onChange={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) commit(n); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") { e.preventDefault(); bump(1, e.shiftKey); }
          if (e.key === "ArrowDown") { e.preventDefault(); bump(-1, e.shiftKey); }
        }}
        className={FIELD_INPUT}
      />
      {axis || unit ? (
        <span
          onMouseDown={startScrub}
          title={t("editor.dragToChange")}
          className="cursor-ew-resize select-none pr-1 text-[0.625rem] uppercase text-muted-foreground"
        >
          {axis ?? unit}
        </span>
      ) : null}
      {/* Caret-Stepper (wie Framer) */}
      {!disabled ? (
        <div className="flex h-full flex-col border-l border-border">
          <button type="button" aria-label={t("editor.increase")} onClick={() => bump(1)} className="flex flex-1 w-5 items-center justify-center text-muted-foreground hover:text-foreground">
            <Icon icon="ph:caret-up" className="size-2.5" />
          </button>
          <button type="button" aria-label="verringern" onClick={() => bump(-1)} className="flex flex-1 w-5 items-center justify-center border-t border-border text-muted-foreground hover:text-foreground">
            <Icon icon="ph:caret-down" className="size-2.5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

// Schmales Ecken-Radius-Feld (Framer): nur Zahl, kleines graues Label DARUNTER
// (TL/TR/BR/BL). Kein Achsen-Kürzel im Feld, kein Stepper — vier passen so
// nebeneinander in die Feldspalte. Verstellen per ↑/↓ (Shift = 10).
export function CornerBox({
  value,
  label,
  onChange,
}: {
  value: number;
  label: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
      <div className={`flex ${FIELD_H} w-full min-w-0 items-center ${FIELD_BOX}`}>
        <input
          value={value}
          onChange={(e) => { const nn = Number(e.target.value); if (!Number.isNaN(nn)) onChange(Math.max(0, nn)); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp") { e.preventDefault(); onChange(Math.max(0, value + (e.shiftKey ? 10 : 1))); }
            if (e.key === "ArrowDown") { e.preventDefault(); onChange(Math.max(0, value - (e.shiftKey ? 10 : 1))); }
          }}
          className="w-full min-w-0 bg-transparent px-1.5 text-center text-xs outline-none"
        />
      </div>
      <span className="text-[0.5625rem] uppercase tracking-wide text-muted-foreground">{label}</span>
    </div>
  );
}

// Kompaktes Textfeld auf FIELD_H (URLs, Add-Platzhalter …).
export function TextField({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className={`${FIELD_BOX} ${FIELD_H} min-w-0 flex-1`}>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`${FIELD_INPUT} placeholder:text-muted-foreground`}
      />
    </div>
  );
}

// Kompaktes Select auf FIELD_H (statt der hohen globalen NativeSelect).
export function Select({
  value,
  onChange,
  children,
  defaultValue,
}: {
  value?: string;
  defaultValue?: string;
  onChange?: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className={`${FIELD_BOX} ${FIELD_H} relative min-w-0 flex-1`}>
      <select
        value={value}
        defaultValue={defaultValue}
        onChange={(e) => onChange?.(e.target.value)}
        className={`${FIELD_INPUT} h-full appearance-none pr-6`}
      >
        {children}
      </select>
      <Icon
        icon="ph:caret-down"
        className="pointer-events-none absolute right-1.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}

// Größen-Feld: Wert-Eingabe + Modus-Dropdown nebeneinander, beide FIELD_H,
// gleich breit (wie Framer „959 | Fixed").
export function SizeField({
  value,
  mode,
  modes,
  onValue,
  onMode,
}: {
  value: number | string;
  mode: string;
  modes: { value: string; label: string }[];
  onValue?: (v: string) => void;
  onMode?: (v: string) => void;
}) {
  return (
    <>
      <NumBox value={value} onChange={onValue} />
      <Select value={mode} onChange={onMode}>
        {modes.map((m) => (
          <option key={m.value} value={m.value}>{m.label}</option>
        ))}
      </Select>
    </>
  );
}

// Padlock (Lock-Aspect-Ratio) — schmal, stiehlt keine Feldbreite.
export function Padlock({ locked, onToggle }: { locked: boolean; onToggle: () => void }) {
  const t = useTranslations("website");
  return (
    <button
      type="button"
      onClick={onToggle}
      title={t("editor.lockAspect")}
      aria-label={t("editor.lockAspect")}
      aria-pressed={locked}
      className={
        `flex ${FIELD_H} w-5 shrink-0 items-center justify-center rounded transition ` +
        (locked ? "text-primary" : "text-muted-foreground hover:text-foreground")
      }
    >
      <Icon icon={locked ? "ph:lock-simple" : "ph:lock-simple-open"} className="size-3.5" />
    </button>
  );
}

// Zahl-Stepper (Framer „Base 16 PX" mit −/+), auf FIELD_H.
export function Stepper({
  value,
  unit,
  onChange,
}: {
  value: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  const t = useTranslations("website");
  return (
    <div className={`${FIELD_BOX} ${FIELD_H} min-w-0 flex-1`}>
      <input
        value={value}
        onChange={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) onChange(n); }}
        className={FIELD_INPUT}
      />
      {unit ? <span className="pr-1.5 text-[0.625rem] uppercase text-muted-foreground">{unit}</span> : null}
      <div className="flex h-full items-center border-l border-border">
        <button type="button" aria-label="kleiner" onClick={() => onChange(value - 1)} className="flex h-full w-6 items-center justify-center text-muted-foreground hover:text-foreground">
          <Icon icon="ph:minus" className="size-3" />
        </button>
        <button type="button" aria-label={t("editor.zoomIn")} onClick={() => onChange(value + 1)} className="flex h-full w-6 items-center justify-center border-l border-border text-muted-foreground hover:text-foreground">
          <Icon icon="ph:plus" className="size-3" />
        </button>
      </div>
    </div>
  );
}

// Farb-Swatch-Zeile (Framer „Füllen FFFFFF", „Farben AAAAAA 100%"), auf FIELD_H.
export function Swatch({
  color,
  opacity,
  onColor,
  onRemove,
}: {
  color: string;
  opacity?: number;
  onColor?: (hex: string) => void;
  onRemove?: () => void;
}) {
  const hex = color.replace("#", "").toUpperCase();
  return (
    <div className={`${FIELD_BOX} ${FIELD_H} min-w-0 flex-1 gap-2 px-2`}>
      <label className="relative size-3.5 shrink-0 cursor-pointer overflow-hidden rounded" style={{ boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.1)" }}>
        <span className="absolute inset-0" style={{ backgroundColor: color || "#ffffff" }} />
        <input
          type="color"
          value={color || "#ffffff"}
          onChange={(e) => onColor?.(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
      <span className="uppercase tracking-wide">{hex || "—"}</span>
      {typeof opacity === "number" ? (
        <span className="text-[0.6875rem] text-muted-foreground">{opacity}%</span>
      ) : null}
      {onRemove ? (
        <button type="button" aria-label="entfernen" onClick={onRemove} className="ml-auto pr-0.5 text-muted-foreground hover:text-foreground">
          <Icon icon="ph:x" className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

// Popover-Hülle: absolut positioniert unter dem Auslöser, schließt bei
// Außenklick / Escape (Framer-Verhalten).
export function Popover({
  onClose,
  children,
  align = "right",
}: {
  onClose: () => void;
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // Nächster Tick, damit der öffnende Klick nicht sofort wieder schließt.
    const t = window.setTimeout(() => window.addEventListener("mousedown", onDown), 0);
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  return (
    <div
      ref={ref}
      className={`absolute top-6 z-50 ${align === "right" ? "right-0" : "left-0"}`}
    >
      {children}
    </div>
  );
}

// Wie Popover, aber `position: fixed` und links vom Anker ausgerichtet — so wird
// es NICHT vom overflow-scrollenden Inspektor beschnitten und schwebt frei
// neben dem Panel (Framer-Verhalten beim Border-/Effekt-Popup). `anchor` ist das
// Auslöser-Element (die Zeile), an dessen linker Kante das Popup andockt.
export function AnchoredPopover({
  anchorRef,
  onClose,
  width = 288,
  placement = "left",
  children,
}: {
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  width?: number;
  // "left" = links vom Anker (Border/Editor), "below" = unter dem Anker (Menüs),
  // "center" = mittig im Fenster (Modal-Stil, für den Variablen-Editor).
  placement?: "left" | "below" | "center";
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    let raf = 0;
    // Gibt true zurück, wenn platziert wurde; false, wenn der Anker (noch) fehlt.
    const place = (): boolean => {
      // Mittig: braucht keinen Anker — im Fenster zentrieren (nach der Höhe des
      // gerenderten Inhalts, mit Fallback), damit es nie am Rand klemmt.
      if (placement === "center") {
        const h = ref.current?.offsetHeight ?? 520;
        setPos({
          left: Math.round((window.innerWidth - width) / 2),
          top: Math.max(8, Math.round((window.innerHeight - h) / 2)),
        });
        return true;
      }
      const anchor = anchorRef.current;
      if (!anchor) return false;
      const r = anchor.getBoundingClientRect();
      const gap = 12;
      if (placement === "below") {
        const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
        const top = Math.min(r.bottom + 4, window.innerHeight - 8 - 120);
        setPos({ left, top: Math.max(8, top) });
        return true;
      }
      // Links vom Anker; wenn dort kein Platz, rechts daneben ausweichen.
      let left = r.left - width - gap;
      if (left < 8) left = Math.min(window.innerWidth - width - 8, r.right + gap);
      // Vertikal so klemmen, dass der ganze Popover sichtbar bleibt (nicht unten
      // vom Dock/Rand überdeckt). Höhe = gemessen, aber mit großzügiger Mindest-
      // annahme (der Font-Picker ist bis 26rem/≈416px hoch und lädt async nach,
      // sodass offsetHeight anfangs zu klein sein kann). So weicht ein hoher
      // Popover sofort nach oben aus, statt erst nach dem Nachladen.
      const measured = ref.current?.offsetHeight ?? 0;
      const h = Math.min(Math.max(measured, 420), window.innerHeight - 16);
      const maxTop = window.innerHeight - 8 - h;
      const top = Math.min(r.top, maxTop);
      setPos({ left: Math.max(8, left), top: Math.max(8, top) });
      return true;
    };
    // Anker kann beim ersten Mount noch fehlen (Zeile gerade erst hinzugefügt) —
    // dann im nächsten Frame erneut versuchen (bis zu einigen rAFs), statt still
    // aufzugeben (sonst öffnet das Popup nie).
    let tries = 0;
    const tryPlace = () => {
      if (place() || tries > 10) return;
      tries += 1;
      raf = window.requestAnimationFrame(tryPlace);
    };
    tryPlace();
    // Nach dem Paint erneut messen: jetzt kennt ref.current seine echte Höhe,
    // sodass „center" exakt mittig sitzt UND „left" (hohe Popover wie der Font-
    // Picker) nach oben ausweicht, statt unten vom Dock/Rand überdeckt zu werden.
    raf = window.requestAnimationFrame(() => place());
    const onReflow = () => place();
    window.addEventListener("resize", onReflow);
    window.addEventListener("scroll", onReflow, true);
    // Wenn der Popover-Inhalt seine Höhe ändert (z. B. der Font-Katalog lädt
    // asynchron nach und der Picker wächst), neu positionieren — sonst ragt er
    // unten aus dem Fenster (Dock/Rand überdeckt).
    let ro: ResizeObserver | null = null;
    if (ref.current && typeof ResizeObserver !== "undefined") {
      // Nach dem Frame neu positionieren, damit die finale Layout-Höhe gelesen
      // wird (nicht die Zwischenhöhe während des Wachstums).
      ro = new ResizeObserver(() => window.requestAnimationFrame(() => place()));
      ro.observe(ref.current);
    }
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onReflow, true);
    };
  }, [anchorRef, width, placement]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const anchor = anchorRef.current;
      if (ref.current && !ref.current.contains(e.target as Node) && anchor && !anchor.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const t = window.setTimeout(() => window.addEventListener("mousedown", onDown), 0);
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, anchorRef]);

  if (!pos) return null;
  return (
    <div ref={ref} style={{ position: "fixed", left: pos.left, top: pos.top, width, zIndex: 60 }}>
      {children}
    </div>
  );
}

// Radius-Modus-Umschalter (Framer): aktiv = blau umrandet + primary-Farbe,
// inaktiv = graue Border, gemutetes Icon.
export function RadiusModeBtn({
  label,
  active,
  icon,
  onClick,
}: {
  label: string;
  active: boolean;
  icon: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={
        `flex ${FIELD_H} w-7 items-center justify-center rounded-md border transition ` +
        (active
          ? "border-primary text-primary"
          : "border-border text-muted-foreground hover:text-foreground")
      }
    >
      <Icon icon={icon} className="size-3.5" />
    </button>
  );
}

// Slider im Framer-Stil: dünne Spur (gefüllt bis zum Wert), kleiner runder
// weißer Knopf mit feinem Rand. Kein fetter Default-Thumb. Der gefüllte Anteil
// kommt aus einem Gradient auf der Spur (Prozent aus value/min/max).
export function RangeSlider({
  value,
  min = 0,
  max = 1,
  step = 0.01,
  onChange,
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="framer-range h-7 min-w-0 flex-1 cursor-pointer appearance-none bg-transparent"
      style={{
        // Spur als Hintergrund, gefüllt bis pct (primary), Rest secondary.
        ["--pct" as string]: `${pct}%`,
      }}
    />
  );
}

// ── Variablen an einer Eigenschaft (Framer) ─────────────────────────────────
// Kleines ⊕-Badge links vom Property-Label. Klick öffnet ein Popover mit
// „Create Variable / Set Variable / Add Transform". Bei gebundener Variable
// wird das Label blau.
export function VarBadge({ bound, onClick }: { bound: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Variable"
      onClick={onClick}
      className={
        "flex size-4 shrink-0 items-center justify-center rounded-full transition " +
        (bound ? "text-primary" : "text-muted-foreground/70 hover:text-foreground")
      }
    >
      <Icon icon="ph:plus-circle" className="size-3.5" />
    </button>
  );
}

// Section-Header mit „+“, das ein Popover öffnet (statt bloßem Icon-Button).
export function AddBtn({ onClick, active }: { onClick: () => void; active?: boolean }) {
  const t = useTranslations("website");
  return (
    <button
      type="button"
      aria-label={t("editor.addStyle")}
      aria-expanded={active}
      onClick={onClick}
      className={
        "flex size-5 items-center justify-center rounded transition hover:bg-secondary hover:text-foreground " +
        (active ? "bg-secondary text-foreground" : "text-muted-foreground")
      }
    >
      <Icon icon="ph:plus" className="size-3.5" />
    </button>
  );
}

// --- Tabs-Kopf --------------------------------------------------------------
export function InspectorTabs() {
  return (
    <div className="flex items-center justify-center gap-6 border-b border-border py-3">
      <span className="text-sm font-medium text-muted-foreground">Agent</span>
      <span className="border-b-2 border-foreground pb-0.5 text-sm font-semibold">Style</span>
    </div>
  );
}

// Breiten-Modi wie Framer (Relative/Fill/Fit sind für den Root-Frame gesperrt).
export const WIDTH_MODES = [
  { value: "fixed", label: "Fixed" },
  { value: "relative", label: "Relative" },
  { value: "fill", label: "Fill" },
  { value: "fit", label: "Fit" },
];

export const HEIGHT_MODES = [
  { value: "fixed", label: "Fixed" },
  { value: "auto", label: "Fit" },
];

// Gemeinsamer Typ für die Inspektor-Helper (props lesen, set schreiben).
export type InspProps = {
  props: Record<string, unknown>;
  set: (mut: (p: Record<string, unknown>) => void) => void;
};

// Layout-Sektion (Framer Auto-Layout): None / Stack / Grid + zugehörige Optionen.
// Icon-Segment-Button (Framer: aktiv = weiße Fläche + blaues Icon).
export function IconSeg({ active, onClick, icon, label, first }: { active: boolean; onClick: () => void; icon: string; label: string; first?: boolean }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick}
      className={"flex flex-1 items-center justify-center transition " + (active ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:bg-secondary") + (first ? "" : " border-l border-border")}>
      <Icon icon={icon} className="size-4" />
    </button>
  );
}

export function PlusBtn() {
  const t = useTranslations("website");
  return (
    <button
      type="button"
      aria-label={t("editor.add")}
      className="flex size-5 items-center justify-center rounded text-muted-foreground transition hover:bg-secondary hover:text-foreground"
    >
      <Icon icon="ph:plus" className="size-3.5" />
    </button>
  );
}

// Wie PlusBtn, aber mit echter Aktion (z. B. „+" in der Auswirkungen-Sektion).
export function AddInlineBtn({ onClick }: { onClick: () => void }) {
  const t = useTranslations("website");
  return (
    <button
      type="button"
      aria-label={t("editor.add")}
      onClick={onClick}
      className="flex size-5 items-center justify-center rounded text-muted-foreground transition hover:bg-secondary hover:text-foreground"
    >
      <Icon icon="ph:plus" className="size-3.5" />
    </button>
  );
}

// Minus mit echter Aktion: deaktiviert eine per ⊕ aktivierte Sektion (Framer:
// aktiver Scrollabschnitt zeigt − statt +).
export function RemoveInlineBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="entfernen"
      onClick={onClick}
      className="flex size-5 items-center justify-center rounded text-muted-foreground transition hover:bg-secondary hover:text-foreground"
    >
      <Icon icon="ph:minus" className="size-3.5" />
    </button>
  );
}

// Section-Header-Button für befüllte Sektionen (Framer: Minus zum Einklappen).
export function MinusBtn() {
  return (
    <button
      type="button"
      aria-label="einklappen"
      className="flex size-5 items-center justify-center rounded text-muted-foreground transition hover:bg-secondary hover:text-foreground"
    >
      <Icon icon="ph:minus" className="size-3.5" />
    </button>
  );
}
