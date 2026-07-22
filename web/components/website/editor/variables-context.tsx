"use client";

// Seiten-Variablen (Framer „Page Variables"): eine Registry pro Seite. Eine
// Variable kann an eine Node-Prop gebunden werden (z. B. Frame-Opazität). Die
// BINDUNG (welche Prop → welche Variable) lebt in der Node-Prop selbst
// (z. B. `opacityVar: "<id>"`), damit sie beim Speichern automatisch mitläuft;
// die DEFINITION (Default/Min/Max/…) lebt hier im Registry. Der aktuelle Wert
// einer Variable = ihr `defaultValue` (bis Query-Param/Interaktion ihn ändert).
import { createContext, useContext } from "react";

export type PageVariable = {
  id: string;
  name: string;
  description: string;
  optional: boolean;
  // Variablen-Typ: "number" (Opazität/Radius, mit Min/Max/Step/Slider) oder
  // "boolean" (Sichtbar, Yes/No). Bestimmt Editor-Formular und Chip-Icon.
  kind: "number" | "boolean";
  // numerischer Default (kind === "number").
  defaultValue: number;
  min: number | null;
  max: number | null;
  step: number;
  unit: string; // "none" | "px" | "%" | …
  // boolescher Default (kind === "boolean").
  defaultBool: boolean;
  queryParam: string;
};

export type VariablesState = {
  variables: PageVariable[];
  // Neue Variable anlegen (mit sinnvollen Defaults, an einen Kontext angelehnt)
  // → gibt die erzeugte Variable zurück (Aufrufer bindet sie an die Prop).
  create: (init: Partial<PageVariable>) => PageVariable;
  update: (id: string, patch: Partial<PageVariable>) => void;
  remove: (id: string) => void;
  get: (id: string | null | undefined) => PageVariable | undefined;
};

const Ctx = createContext<VariablesState | null>(null);

export function VariablesProvider({
  value,
  children,
}: {
  value: VariablesState;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useVariables(): VariablesState | null {
  return useContext(Ctx);
}

// Aktuellen Wert einer gebundenen Variable auflösen (oder Fallback). Genutzt vom
// FrameNode, um den gebundenen Opazitätswert zu rendern.
export function resolveVarValue(
  vars: PageVariable[] | undefined,
  varId: string | null | undefined,
  fallback: number,
): number {
  if (!varId || !vars) return fallback;
  const v = vars.find((x) => x.id === varId);
  return v ? v.defaultValue : fallback;
}

// Booleschen Wert einer gebundenen Variable auflösen (z. B. Sichtbar).
export function resolveVarBool(
  vars: PageVariable[] | undefined,
  varId: string | null | undefined,
  fallback: boolean,
): boolean {
  if (!varId || !vars) return fallback;
  const v = vars.find((x) => x.id === varId);
  return v ? v.defaultBool : fallback;
}

// Conditional-Binding (Framer „Conditional Value"): wertet Variable + Bedingung
// aus und liefert den resultierenden Property-Wert (ifYes/ifNo/fallback). Nutzt
// den Variablen-Default als aktuellen Wert (Query-Param/Interaktion später).
export type ConditionalBinding = {
  variableId: string;
  condition: string;
  compareValue?: string;
  ifYes: string;
  ifNo: string;
  fallback: string;
};

export function resolveConditionalBinding(
  b: ConditionalBinding | undefined,
  vars: PageVariable[] | undefined,
): string | undefined {
  if (!b) return undefined;
  const v = vars?.find((x) => x.id === b.variableId);
  if (!v) return b.fallback;
  const num = v.defaultValue;
  const bool = v.defaultBool;
  const cmp = b.compareValue;
  const isSet = v.kind === "boolean" ? true : num != null;
  let cond = false;
  switch (b.condition) {
    case "is_set": cond = isSet; break;
    case "isnt_set": cond = !isSet; break;
    case "equals": cond = String(v.kind === "boolean" ? bool : num) === cmp; break;
    case "doesnt_equal": cond = String(v.kind === "boolean" ? bool : num) !== cmp; break;
    case "greater_than": cond = num > Number(cmp); break;
    case "less_than": cond = num < Number(cmp); break;
    case "greater_or_equal": cond = num >= Number(cmp); break;
    case "less_or_equal": cond = num <= Number(cmp); break;
    case "is_even": cond = Number.isInteger(num) && num % 2 === 0; break;
    case "is_odd": cond = Number.isInteger(num) && Math.abs(num % 2) === 1; break;
    default: cond = v.kind === "boolean" ? bool : isSet;
  }
  return cond ? b.ifYes : b.ifNo;
}
