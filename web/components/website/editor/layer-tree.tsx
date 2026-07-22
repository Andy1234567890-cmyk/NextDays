"use client";

// Framer-artiger Layer-Baum: ersetzt den Default-Renderer von @craftjs/layers.
// Jede Zeile: Einrückung nach Tiefe · Auf/Zuklapp-Caret · Typ-Icon · Name.
// Selektierte Zeile blau, Kinder eingerückt. Klick selektiert den Node.
import { useEditor } from "@craftjs/core";
import { Layers, useLayer } from "@craftjs/layers";
import { Icon } from "@iconify/react";

// Node-Typ → Icon (wie Framer: Frame/Stack/Grid/… eigene Symbole).
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

function FramerLayer({ children }: { children?: React.ReactNode }) {
  const {
    id,
    depth,
    expanded,
    children: childIds,
    connectors: { drag, layerHeader },
    actions: { toggleLayer },
  } = useLayer((layer) => ({ expanded: layer.expanded }));

  const { displayName, selected } = useEditor((state, query) => ({
    displayName:
      state.nodes[id]?.data.custom?.displayName ??
      state.nodes[id]?.data.displayName ??
      "",
    selected: query.getEvent("selected").first() === id,
  }));

  const hasChildren = childIds && childIds.length > 0;
  const isRoot = depth === 0;
  const icon = ICON_BY_NAME[displayName] ?? "ph:square";

  return (
    <div>
      <div
        ref={(r) => { if (r) drag(r); }}
        className={
          "group/layer flex h-8 items-center gap-1 rounded-md pr-2 text-sm transition " +
          (selected
            ? "bg-primary text-primary-foreground"
            : "text-foreground hover:bg-secondary/70")
        }
        style={{ paddingLeft: `${depth * 0.875 + 0.25}rem` }}
      >
        {/* Auf/Zuklapp-Caret (nur wenn Kinder) */}
        {hasChildren ? (
          <button
            type="button"
            aria-label={expanded ? "einklappen" : "ausklappen"}
            onMouseDown={(e) => { e.stopPropagation(); toggleLayer(); }}
            className="flex size-4 shrink-0 items-center justify-center opacity-70 hover:opacity-100"
          >
            <Icon icon={expanded ? "ph:caret-down" : "ph:caret-right"} className="size-3" />
          </button>
        ) : (
          <span className="size-4 shrink-0" />
        )}

        {/* Node-Header: Klick selektiert (Craft verdrahtet Selektion/Hover). */}
        <div
          ref={(r) => { if (r) layerHeader(r); }}
          className="flex min-w-0 flex-1 items-center gap-1.5"
        >
          <Icon
            icon={icon}
            className={
              "size-3.5 shrink-0 " +
              (selected ? "text-primary-foreground" : isRoot ? "text-primary" : "text-muted-foreground")
            }
          />
          <span className={"truncate " + (isRoot ? "font-medium" : "")}>{displayName}</span>
          {isRoot ? (
            <span className={"ml-auto text-[0.625rem] " + (selected ? "text-primary-foreground/70" : "text-muted-foreground")}>
              Primary
            </span>
          ) : null}
        </div>
      </div>

      {/* Kinder (eingerückt) */}
      {expanded && children ? <div>{children}</div> : null}
    </div>
  );
}

export function LayerTree() {
  return (
    <div className="px-2 py-1">
      <Layers expandRootOnLoad renderLayer={FramerLayer} />
    </div>
  );
}
