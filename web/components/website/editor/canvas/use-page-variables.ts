"use client";

// Seiten-Variablen (Framer „Page Variables") — Registry pro Seite. Bindungen
// stecken in den Node-Props; hier leben die Definitionen (Default/Min/Max/…).
import { useEditor } from "@craftjs/core";
import { useEffect, useState } from "react";

import type { PageVariable, VariablesState } from "../variables-context";

export function usePageVariables(): VariablesState {
  const { query, actions } = useEditor();
  const [pageVariables, setPageVariables] = useState<PageVariable[]>([]);

  // Gebundene Nodes mit den aktuellen Variablenwerten spiegeln — in einem
  // EFFECT (nach dem Render), NICHT im State-Updater. Craft.js rendert eine Node
  // nicht allein wegen einer Context-Änderung neu; ein setProp stößt sie an. Der
  // Wert wird nur geschrieben, wenn er wirklich abweicht (verhindert Endlos-Loop).
  useEffect(() => {
    if (!pageVariables.length) return;
    const byId = new Map(pageVariables.map((v) => [v.id, v]));
    const nodes = query.getNodes();
    Object.keys(nodes).forEach((nid) => {
      const props = nodes[nid]?.data.props as Record<string, unknown> | undefined;
      if (!props) return;
      // Opazität (numerisch).
      const opId = props.opacityVar as string | undefined;
      if (opId) {
        const v = byId.get(opId);
        if (v && props.opacity !== v.defaultValue) {
          actions.setProp(nid, (p: Record<string, unknown>) => { p.opacity = v.defaultValue; });
        }
      }
      // Sichtbar (boolesch).
      const visId = props.visibleVar as string | undefined;
      if (visId) {
        const v = byId.get(visId);
        if (v && props.visible !== v.defaultBool) {
          actions.setProp(nid, (p: Record<string, unknown>) => { p.visible = v.defaultBool; });
        }
      }
    });
  }, [pageVariables, query, actions]);

  const variablesApi: VariablesState = {
    variables: pageVariables,
    create: (init) => {
      const v: PageVariable = {
        id: (globalThis.crypto?.randomUUID?.() ?? `var-${pageVariables.length + 1}`),
        name: init.name ?? "Variable",
        description: init.description ?? "",
        optional: init.optional ?? false,
        kind: init.kind ?? "number",
        defaultValue: init.defaultValue ?? 1,
        min: init.min ?? null,
        max: init.max ?? null,
        step: init.step ?? 0.01,
        unit: init.unit ?? "none",
        defaultBool: init.defaultBool ?? true,
        queryParam: init.queryParam ?? (init.name ?? "variable").toLowerCase().replace(/\s+/g, "-"),
      };
      setPageVariables((prev) => [...prev, v]);
      return v;
    },
    update: (id, patch) =>
      setPageVariables((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v))),
    remove: (id) => setPageVariables((prev) => prev.filter((v) => v.id !== id)),
    get: (id) => pageVariables.find((v) => v.id === id),
  };

  return variablesApi;
}
