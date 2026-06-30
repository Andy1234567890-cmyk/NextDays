"use client";

// Auswahl-/Hover-Overlay auf der Canvas (wie Figma/Framer): zeichnet einen
// Rahmen um den selektierten Block + eine schwebende Toolbar (hoch/runter/
// duplizieren/löschen). Absolute Schicht über der Canvas, folgt dem DOM-Rechteck
// des aktiven Nodes (ResizeObserver + scroll/resize).
import { useEditor } from "@craftjs/core";
import type { NodeTree } from "@craftjs/core";
import { getRandomId } from "@craftjs/utils";
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useState } from "react";

type Rect = { top: number; left: number; width: number; height: number };

export function SelectionOverlay({
  scrollRef,
}: {
  scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { selectedId, hoveredId, dom, hoveredDom, displayName, actions, query, canMoveUp, canMoveDown } =
    useEditor((state) => {
      const selected = state.events.selected.values().next().value as string | undefined;
      const hovered = state.events.hovered.values().next().value as string | undefined;
      const id = selected ?? null;
      let up = false;
      let down = false;
      if (id && id !== "ROOT") {
        const node = state.nodes[id];
        const parent = node?.data.parent ? state.nodes[node.data.parent] : null;
        if (parent) {
          const idx = parent.data.nodes.indexOf(id);
          up = idx > 0;
          down = idx < parent.data.nodes.length - 1;
        }
      }
      return {
        selectedId: id,
        hoveredId: hovered ?? null,
        dom: id ? state.nodes[id]?.dom ?? null : null,
        hoveredDom: hovered ? state.nodes[hovered]?.dom ?? null : null,
        displayName: id ? state.nodes[id]?.data.displayName ?? "" : "",
        canMoveUp: up,
        canMoveDown: down,
      };
    });

  const [selRect, setSelRect] = useState<Rect | null>(null);
  const [hovRect, setHovRect] = useState<Rect | null>(null);

  const measure = useCallback(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const base = scroller.getBoundingClientRect();
    const rel = (el: HTMLElement | null): Rect | null => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        top: r.top - base.top + scroller.scrollTop,
        left: r.left - base.left + scroller.scrollLeft,
        width: r.width,
        height: r.height,
      };
    };
    setSelRect(rel(dom));
    setHovRect(hoveredId && hoveredId !== selectedId ? rel(hoveredDom) : null);
  }, [dom, hoveredDom, hoveredId, selectedId, scrollRef]);

  useEffect(() => {
    measure();
    const scroller = scrollRef.current;
    if (!scroller) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(scroller);
    if (dom) ro.observe(dom);
    scroller.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      scroller.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [dom, measure, scrollRef]);

  function move(dir: -1 | 1) {
    if (!selectedId || selectedId === "ROOT") return;
    const node = query.node(selectedId).get();
    const parentId = node.data.parent;
    if (!parentId) return;
    const parent = query.node(parentId).get();
    const idx = parent.data.nodes.indexOf(selectedId);
    const target = idx + dir;
    if (target < 0 || target >= parent.data.nodes.length) return;
    actions.move(selectedId, parentId, dir === 1 ? target + 1 : target);
  }

  function duplicate() {
    if (!selectedId || selectedId === "ROOT") return;
    const parentId = query.node(selectedId).get().data.parent;
    if (!parentId) return;
    const parent = query.node(parentId).get();
    const idx = parent.data.nodes.indexOf(selectedId);
    const tree = query.node(selectedId).toNodeTree();
    const fresh = cloneTree(tree);
    actions.addNodeTree(fresh, parentId, idx + 1);
  }

  function remove() {
    if (!selectedId || selectedId === "ROOT") return;
    actions.delete(selectedId);
  }

  return (
    <>
      {hovRect ? (
        <div
          className="pointer-events-none absolute z-20 rounded-[0.25rem] ring-2 ring-primary/30"
          style={{ top: hovRect.top, left: hovRect.left, width: hovRect.width, height: hovRect.height }}
        />
      ) : null}

      {selRect && selectedId && selectedId !== "ROOT" ? (
        <div
          className="pointer-events-none absolute z-30 rounded-[0.25rem] ring-2 ring-primary"
          style={{ top: selRect.top, left: selRect.left, width: selRect.width, height: selRect.height }}
        >
          <div className="pointer-events-auto absolute -top-9 left-0 flex items-center gap-0.5 rounded-full bg-primary px-1 py-1 text-primary-foreground shadow-lg">
            <span className="px-2 text-xs font-medium">{displayName}</span>
            <ToolbarButton label="nach oben" icon="ph:arrow-up" disabled={!canMoveUp} onClick={() => move(-1)} />
            <ToolbarButton label="nach unten" icon="ph:arrow-down" disabled={!canMoveDown} onClick={() => move(1)} />
            <ToolbarButton label="duplizieren" icon="ph:copy" onClick={duplicate} />
            <ToolbarButton label="löschen" icon="ph:trash" onClick={remove} />
          </div>
        </div>
      ) : null}
    </>
  );
}

function ToolbarButton({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-7 items-center justify-center rounded-full transition hover:bg-white/20 disabled:opacity-40"
    >
      <Icon icon={icon} className="size-4" />
    </button>
  );
}

// Craft-NodeTree mit frischen IDs klonen (für Duplizieren) — ID-Remap über alle
// Knoten, Parent/Children-Verweise umschreiben. Nutzt Crafts getRandomId.
function cloneTree(tree: NodeTree): NodeTree {
  const remap: Record<string, string> = {};
  for (const oldId of Object.keys(tree.nodes)) remap[oldId] = getRandomId();
  const nodes: NodeTree["nodes"] = {};
  for (const oldId of Object.keys(tree.nodes)) {
    const newId = remap[oldId];
    const src = tree.nodes[oldId];
    nodes[newId] = {
      ...src,
      id: newId,
      data: {
        ...src.data,
        parent: src.data.parent ? remap[src.data.parent] ?? src.data.parent : null,
        nodes: (src.data.nodes ?? []).map((n) => remap[n] ?? n),
        linkedNodes: Object.fromEntries(
          Object.entries(src.data.linkedNodes ?? {}).map(([k, v]) => [k, remap[v] ?? v]),
        ),
      },
    };
  }
  return { rootNodeId: remap[tree.rootNodeId], nodes };
}
