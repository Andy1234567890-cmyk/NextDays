"use client";

// Variablen-UI (Framer „Page Variables"): Bind-Chip, Aktions-Kaskade (⊕ →
// Set Variable → Variable → Bedingung), Conditional-Value-Dialog und der
// große Variablen-Editor.
import { Icon } from "@iconify/react";
import { useState } from "react";

import type { PageVariable } from "../variables-context";
import {
  AnchoredPopover,
  FIELD_BOX,
  FIELD_H,
  FIELD_INPUT,
  NumBox,
  Row,
  Select,
  Stepper,
  TextField,
} from "./ui";

// Blauer Variablen-Chip (ersetzt die statische Eingabe, sobald gebunden):
// „# Name ×". Klick auf den Chip öffnet den Variablen-Editor; „×" löst die
// Bindung.
// Typ-Icon einer Variable (Framer): Auge für boolean, „#" für Zahl.
export function varIcon(kind: PageVariable["kind"] | undefined): string {
  return kind === "boolean" ? "ph:eye" : "ph:hash";
}

export function VarChip({
  name,
  icon = "ph:hash",
  onOpen,
  onUnbind,
}: {
  name: string;
  icon?: string;
  onOpen: () => void;
  onUnbind: () => void;
}) {
  // Framer-Look: Typ-Icon in einem abgesetzten, dunkleren Kästchen links, Name
  // in normalem Gewicht, „×" rechts. Kompakt auf FIELD_H.
  return (
    <div className={`flex ${FIELD_H} min-w-0 flex-1 items-center gap-1.5 overflow-hidden rounded-md bg-primary pr-1.5 text-primary-foreground`}>
      <span className="flex h-full w-6 shrink-0 items-center justify-center bg-black/15">
        <Icon icon={icon} className="size-3" />
      </span>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 truncate text-left text-xs">
        {name}
      </button>
      <button type="button" aria-label="Variable lösen" onClick={onUnbind} className="flex size-4 shrink-0 items-center justify-center rounded opacity-80 hover:bg-black/15 hover:opacity-100">
        <Icon icon="ph:x" className="size-3" />
      </button>
    </div>
  );
}

// Bedingungen/Transforms der dritten Kaskadenstufe (Framer „Set Variable“ →
// Variable → Bedingung). Die einfachen Fälle wirken echt bei der Auflösung
// (siehe resolveVarBool/Value); komplexere sind vorerst reine Auswahl.
export type VarCondition =
  | "is_set"
  | "isnt_set"
  | "equals"
  | "doesnt_equal"
  | "greater_than"
  | "less_than"
  | "less_or_equal"
  | "greater_or_equal"
  | "is_even"
  | "is_odd"
  | "as_plain_text"
  | "format_number";

export const VAR_CONDITIONS: { id: VarCondition; label: string }[] = [
  { id: "is_set", label: "Is Set" },
  { id: "isnt_set", label: "Isn't Set" },
  { id: "equals", label: "Equals" },
  { id: "doesnt_equal", label: "Doesn't Equal" },
  { id: "greater_than", label: "Greater Than" },
  { id: "less_than", label: "Less Than" },
  { id: "less_or_equal", label: "Less Than or Equal" },
  { id: "greater_or_equal", label: "Greater Than or Equal" },
  { id: "is_even", label: "Is Even" },
  { id: "is_odd", label: "Is Odd" },
  { id: "as_plain_text", label: "As Plain Text" },
  { id: "format_number", label: "Format Number" },
];

// Popover mit den Variablen-Aktionen (Bild 2): Create Variable / Set Variable /
// Add Transform. „Set Variable" ist eine 2-stufige Kaskade: erst Variable wählen,
// dann eine Bedingung/Transform (wie Framer). Auswahl bindet die Variable echt.
export function VarActionPopover({
  anchorRef,
  existing,
  onCreate,
  onBind,
  onClose,
}: {
  anchorRef: React.RefObject<HTMLElement | null>;
  existing: PageVariable[];
  onCreate: () => void;
  onBind: (id: string, condition?: VarCondition) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  // Kaskaden-Stufe: null = Hauptmenü, "set" = Variablenliste, sonst = Bedingungs-
  // liste für die zuvor gewählte Variable.
  const [stage, setStage] = useState<"root" | "set">("root");
  const [pickedVar, setPickedVar] = useState<PageVariable | null>(null);
  const suche = q.trim().toLowerCase();
  const list = suche ? existing.filter((v) => v.name.toLowerCase().includes(suche)) : existing;
  const condList = suche
    ? VAR_CONDITIONS.filter((c) => c.label.toLowerCase().includes(suche))
    : VAR_CONDITIONS;
  return (
    <AnchoredPopover anchorRef={anchorRef} onClose={onClose} width={224} placement="below">
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xl shadow-black/10">
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
        {pickedVar ? (
          // Stufe 3: Bedingung/Transform für die gewählte Variable.
          <div className="p-1">
            <button type="button" onClick={() => setPickedVar(null)} className="mb-1 flex w-full items-center gap-1.5 rounded-lg px-2 py-1 text-left text-[0.6875rem] text-muted-foreground transition hover:bg-secondary">
              <Icon icon="ph:caret-left" className="size-3" />
              <span className="truncate">{pickedVar.name}</span>
            </button>
            <div className="max-h-64 overflow-y-auto">
              {condList.map((c) => (
                <button key={c.id} type="button" onClick={() => onBind(pickedVar.id, c.id)} className="flex w-full items-center rounded-lg px-2 py-1.5 text-left text-xs transition hover:bg-secondary">
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        ) : stage === "set" ? (
          // Stufe 2: Variablenliste. Klick öffnet die Bedingungsstufe.
          <div className="p-1">
            <button type="button" onClick={() => setStage("root")} className="mb-1 flex w-full items-center gap-1.5 rounded-lg px-2 py-1 text-left text-[0.6875rem] text-muted-foreground transition hover:bg-secondary">
              <Icon icon="ph:caret-left" className="size-3" />
              Zurück
            </button>
            {list.length ? (
              list.map((v) => (
                <button key={v.id} type="button" onClick={() => setPickedVar(v)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition hover:bg-secondary">
                  <Icon icon={varIcon(v.kind)} className="size-3.5 text-primary" />
                  <span className="flex-1 truncate">{v.name}</span>
                  <Icon icon="ph:caret-right" className="size-3 text-muted-foreground/60" />
                </button>
              ))
            ) : (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">Keine Variablen</p>
            )}
          </div>
        ) : (
          // Stufe 1: Hauptmenü.
          <div className="p-1">
            <button type="button" onClick={onCreate} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition hover:bg-secondary">
              Create Variable
            </button>
            <button type="button" onClick={() => setStage("set")} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition hover:bg-secondary">
              <span className="flex-1">Set Variable</span>
              <Icon icon="ph:caret-right" className="size-3 text-muted-foreground/60" />
            </button>
            <button type="button" className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-muted-foreground transition hover:bg-secondary" title="Bald verfügbar">
              <span className="flex-1">Add Transform</span>
              <Icon icon="ph:caret-right" className="size-3 text-muted-foreground/60" />
            </button>
          </div>
        )}
      </div>
    </AnchoredPopover>
  );
}

// Struktur einer Property-Bindung an eine Variable mit Bedingung (Framer
// „Conditional Value"). Wird als JSON in der Node-Prop `<prop>Binding` abgelegt.
export type PropBinding = {
  variableId: string;
  condition: VarCondition;
  compareValue?: string; // nur bei binären Ops (equals/greaterThan/…)
  ifYes: string; // Wert wenn Bedingung true / „Dann“
  ifNo: string; // Wert wenn Bedingung false / „Wenn Nein“
  fallback: string; // greift wenn Variable ungesetzt / „Zurückgreifen“
};

// Bedingungen, die einen Vergleichswert brauchen (Eingabefeld zeigen).
export const NEEDS_COMPARE: VarCondition[] = [
  "equals", "doesnt_equal", "greater_than", "less_than", "less_or_equal", "greater_or_equal",
];

// Der Conditional-Value-Dialog (Framer „Overflow"-Popup): Variable · Bedingung ·
// Dann/Wenn ja · Wenn Nein · Zurückgreifen. `valueOptions` liefert die
// Property-eigenen Auswahlwerte (z. B. clip/visible/hidden/scroll bei Überlauf).
export function ConditionalValueDialog({
  anchorRef,
  title,
  variable,
  valueOptions,
  binding,
  onChange,
  onClose,
}: {
  anchorRef: React.RefObject<HTMLElement | null>;
  title: string;
  variable: PageVariable;
  valueOptions: { value: string; label: string }[];
  binding: PropBinding;
  onChange: (b: PropBinding) => void;
  onClose: () => void;
}) {
  const set = (patch: Partial<PropBinding>) => onChange({ ...binding, ...patch });
  const ValueSelect = ({ value, onPick }: { value: string; onPick: (v: string) => void }) => (
    <Select value={value} onChange={onPick}>
      {valueOptions.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </Select>
  );
  const needsCompare = NEEDS_COMPARE.includes(binding.condition);
  return (
    <AnchoredPopover anchorRef={anchorRef} onClose={onClose} width={380} placement="center">
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-black/20">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-[0.8125rem] font-semibold">{title}</span>
          <button type="button" aria-label="schließen" onClick={onClose} className="flex size-5 items-center justify-center rounded text-muted-foreground transition hover:bg-secondary hover:text-foreground">
            <Icon icon="ph:x" className="size-3.5" />
          </button>
        </div>
        <div className="flex flex-col gap-3 p-4">
          {/* Variable-Chip + Bedingung */}
          <Row label="Variable">
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <span className="flex h-7 min-w-0 flex-1 items-center gap-1.5 overflow-hidden rounded-md bg-primary px-2 text-primary-foreground">
                <Icon icon={varIcon(variable.kind)} className="size-3.5 shrink-0" />
                <span className="truncate text-xs">{variable.name}</span>
              </span>
            </div>
          </Row>
          <Row label="Bedingung">
            <Select value={binding.condition} onChange={(v) => set({ condition: v as VarCondition })}>
              {VAR_CONDITIONS.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </Select>
          </Row>
          {needsCompare ? (
            <Row label="Wert">
              <div className={`${FIELD_BOX} ${FIELD_H} min-w-0 flex-1`}>
                <input value={binding.compareValue ?? ""} onChange={(e) => set({ compareValue: e.target.value })} placeholder="Vergleichswert" className={FIELD_INPUT} />
              </div>
            </Row>
          ) : null}
          <div className="my-1 h-px bg-border" />
          {/* Ergebnis-Branches */}
          <Row label="Dann"><ValueSelect value={binding.ifYes} onPick={(v) => set({ ifYes: v })} /></Row>
          <Row label="Wenn Nein"><ValueSelect value={binding.ifNo} onPick={(v) => set({ ifNo: v })} /></Row>
          <div className="my-1 h-px bg-border" />
          <Row label="Zurückgreifen"><ValueSelect value={binding.fallback} onPick={(v) => set({ fallback: v })} /></Row>
        </div>
      </div>
    </AnchoredPopover>
  );
}

// Der große Variablen-Editor (Bild 1): „Home Page Variables" mit Liste links
// und Detail-Formular rechts (Name/Description/Optional/Default/Min/Max/Step/
// Unit/Query Param). Änderungen wirken live (Default → gebundene Opazität).
export function VariablesEditor({
  anchorRef,
  variables,
  selectedId,
  onUpdate,
  onClose,
}: {
  anchorRef: React.RefObject<HTMLElement | null>;
  variables: PageVariable[];
  selectedId: string;
  onUpdate: (id: string, patch: Partial<PageVariable>) => void;
  onClose: () => void;
}) {
  const [selId, setSelId] = useState(selectedId);
  const sel = variables.find((v) => v.id === selId) ?? variables.find((v) => v.id === selectedId);
  if (!sel) return null;
  const patch = (p: Partial<PageVariable>) => onUpdate(sel.id, p);
  return (
    <AnchoredPopover anchorRef={anchorRef} onClose={onClose} width={620} placement="center">
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-black/20">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-[0.8125rem] font-semibold">Home Page Variables</span>
          <button type="button" aria-label="schließen" onClick={onClose} className="flex size-5 items-center justify-center rounded text-muted-foreground transition hover:bg-secondary hover:text-foreground">
            <Icon icon="ph:x" className="size-3.5" />
          </button>
        </div>
        <div className="flex">
          {/* Liste */}
          <div className="w-56 shrink-0 border-r border-border p-2">
            {variables.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setSelId(v.id)}
                className={
                  "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs transition " +
                  (v.id === sel.id ? "bg-secondary font-medium" : "hover:bg-secondary/60")
                }
              >
                <span className={"flex size-5 items-center justify-center rounded " + (v.id === sel.id ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}>
                  <Icon icon={varIcon(v.kind)} className="size-3" />
                </span>
                <span className="flex-1 truncate">{v.name}</span>
                <Icon icon="ph:dots-six-vertical" className="size-3.5 shrink-0 text-muted-foreground/50" />
              </button>
            ))}
          </div>
          {/* Detail-Formular */}
          <div className="flex-1 p-4">
            <div className="flex flex-col gap-3">
              <Row wide label="Name">
                <TextField value={sel.name} onChange={(val) => patch({ name: val })} />
              </Row>
              <Row wide align="start" label="Description">
                <div className={`flex min-h-[3.5rem] min-w-0 flex-1 rounded-md border border-border bg-background`}>
                  <textarea
                    value={sel.description}
                    onChange={(e) => patch({ description: e.target.value })}
                    className="w-full resize-none bg-transparent p-2 text-xs outline-none"
                  />
                </div>
              </Row>
              <Row wide label="Optional">
                <div className={`flex ${FIELD_H} flex-1 overflow-hidden rounded-md border border-border`}>
                  <button type="button" onClick={() => patch({ optional: true })}
                    className={"flex-1 text-xs transition " + (sel.optional ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary")}>Yes</button>
                  <button type="button" onClick={() => patch({ optional: false })}
                    className={"flex-1 border-l border-border text-xs transition " + (!sel.optional ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary")}>No</button>
                </div>
              </Row>
              {sel.kind === "boolean" ? (
                /* Boolesche Variable (Sichtbar): Default = Yes/No, kein
                   Min/Max/Step/Unit (wie Framer). */
                <Row wide label="Default">
                  <div className={`flex ${FIELD_H} flex-1 overflow-hidden rounded-md border border-border`}>
                    <button type="button" onClick={() => patch({ defaultBool: true })}
                      className={"flex-1 text-xs transition " + (sel.defaultBool ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary")}>Yes</button>
                    <button type="button" onClick={() => patch({ defaultBool: false })}
                      className={"flex-1 border-l border-border text-xs transition " + (!sel.defaultBool ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary")}>No</button>
                  </div>
                </Row>
              ) : (
                <>
                  <Row wide label="Default">
                    <NumBox value={sel.defaultValue} onChange={(v) => { const nn = Number(v); if (!Number.isNaN(nn)) patch({ defaultValue: nn }); }} />
                    <input
                      type="range"
                      min={sel.min ?? 0}
                      max={sel.max ?? 1}
                      step={sel.step || 0.01}
                      value={sel.defaultValue}
                      onChange={(e) => patch({ defaultValue: Number(e.target.value) })}
                      className="framer-range h-7 flex-1 appearance-none bg-transparent"
                      style={{ ["--pct" as string]: `${(((sel.defaultValue - (sel.min ?? 0)) / (((sel.max ?? 1) - (sel.min ?? 0)) || 1)) * 100)}%` }}
                    />
                  </Row>
                  <Row wide label="Min">
                    <NumBox value={sel.min ?? 0} onChange={(v) => patch({ min: v === "" ? null : Number(v) })} />
                    <button type="button" onClick={() => patch({ min: null })} className={`flex ${FIELD_H} shrink-0 items-center rounded-md border border-border px-3 text-xs text-muted-foreground transition hover:text-foreground`}>Clear</button>
                  </Row>
                  <Row wide label="Max">
                    <NumBox value={sel.max ?? 1} onChange={(v) => patch({ max: v === "" ? null : Number(v) })} />
                    <button type="button" onClick={() => patch({ max: null })} className={`flex ${FIELD_H} shrink-0 items-center rounded-md border border-border px-3 text-xs text-muted-foreground transition hover:text-foreground`}>Clear</button>
                  </Row>
                  <Row wide label="Step">
                    <Stepper value={sel.step} onChange={(n) => patch({ step: n > 0 ? n : sel.step })} />
                  </Row>
                  <Row wide label="Unit">
                    <Select value={sel.unit} onChange={(v) => patch({ unit: v })}>
                      <option value="none">None</option>
                      <option value="px">px</option>
                      <option value="%">%</option>
                      <option value="rem">rem</option>
                    </Select>
                  </Row>
                </>
              )}
              <Row wide label="Query Param">
                <TextField value={sel.queryParam} placeholder="opacity" onChange={(val) => patch({ queryParam: val })} />
              </Row>
            </div>
          </div>
        </div>
      </div>
    </AnchoredPopover>
  );
}
