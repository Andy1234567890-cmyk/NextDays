"use client";

// Ebenen-Baum des Page-Builders (Framer-Stil) — Werkstatt-Nachbau.
// Im Produkt rendert @craftjs/layers den echten Node-Baum; hier ist der Baum
// props-getrieben (LayerNode[]), damit er ohne Editor-Kontext läuft.
// Jede Zeile: Einrückung nach Tiefe · Auf/Zuklapp-Caret · Typ-Icon · Name.
import { Icon } from "@iconify/react";
import { useState } from "react";

export type LayerNode = {
  id: string;
  /** Anzeigename = Node-Typ des Editors (Seite, Frame, Hero, Text, …). */
  name: string;
  children?: LayerNode[];
};

// Node-Typ → Icon (identisch zum echten Editor).
const ICON_BY_NAME: Record<string, string> = {
  Seite: "ph:browsers",
  Frame: "ph:selection",
  Stack: "ph:rows",
  Grid: "ph:grid-four",
  Masonry: "ph:squares-four",
  Hero: "ph:image-square",
  Text: "ph:text-t",
  Bild: "ph:image",
  Galerie: "ph:images",
  Button: "ph:cursor-click",
  Kontakt: "ph:envelope",
  Abstand: "ph:arrows-out-line-vertical",
  Suche: "ph:magnifying-glass",
  "Objekt-Grid": "ph:grid-four",
};

// Eigenständige Zeilen-Komponente (nicht im Parent definiert), damit React bei
// jedem Toggle/Select nicht den kompletten Teilbaum unmountet.
function Row({
  node,
  depth,
  collapsed,
  selectedId,
  onToggle,
  onSelect,
}: {
  node: LayerNode;
  depth: number;
  collapsed: Set<string>;
  selectedId?: string | null;
  onToggle: (id: string) => void;
  onSelect?: (id: string) => void;
}) {
  const hasChildren = !!node.children?.length;
  const open = !collapsed.has(node.id);
  const selected = node.id === selectedId;
  const isRoot = depth === 0;
  const icon = ICON_BY_NAME[node.name] ?? "ph:square";

  return (
    <div>
      <div
        role="treeitem"
        aria-selected={selected}
        className={
          "group/layer flex h-8 cursor-pointer items-center gap-1 rounded-md pr-2 text-sm transition " +
          (selected
            ? "bg-primary text-primary-foreground"
            : "text-foreground hover:bg-secondary/70")
        }
        style={{ paddingLeft: `${depth * 0.875 + 0.25}rem` }}
        onClick={() => onSelect?.(node.id)}
      >
        {hasChildren ? (
          <button
            type="button"
            aria-label={open ? "einklappen" : "ausklappen"}
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.id);
            }}
            className="flex size-4 shrink-0 items-center justify-center opacity-70 hover:opacity-100"
          >
            <Icon icon={open ? "ph:caret-down" : "ph:caret-right"} className="size-3" />
          </button>
        ) : (
          <span className="size-4 shrink-0" />
        )}

        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <Icon
            icon={icon}
            className={
              "size-3.5 shrink-0 " +
              (selected
                ? "text-primary-foreground"
                : isRoot
                  ? "text-primary"
                  : "text-muted-foreground")
            }
          />
          <span className={"truncate " + (isRoot ? "font-medium" : "")}>{node.name}</span>
          {isRoot ? (
            <span
              className={
                "ml-auto text-[0.625rem] " +
                (selected ? "text-primary-foreground/70" : "text-muted-foreground")
              }
            >
              Primary
            </span>
          ) : null}
        </div>
      </div>

      {open && hasChildren ? (
        <div>
          {node.children!.map((c) => (
            <Row
              key={c.id}
              node={c}
              depth={depth + 1}
              collapsed={collapsed}
              selectedId={selectedId}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function LayerTree({
  nodes,
  selectedId,
  onSelect,
}: {
  nodes: LayerNode[];
  /** Selektierte Ebene (blau hervorgehoben). */
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  // Zugeklappte IDs statt aufgeklappter: neue/geänderte Nodes aus den Props
  // sind damit automatisch aufgeklappt (Standard: alles offen; im Produkt
  // expandiert expandRootOnLoad nur die Wurzel).
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  function toggle(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div role="tree" className="px-2 py-1">
      {nodes.map((n) => (
        <Row
          key={n.id}
          node={n}
          depth={0}
          collapsed={collapsed}
          selectedId={selectedId}
          onToggle={toggle}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
