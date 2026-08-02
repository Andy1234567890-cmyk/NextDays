"use client";

// Block-Palette (im linken Panel unter der Seitenliste). Zwei Wege:
//  • KLICK: fügt den Block sofort ans Ende der Seite an, selektiert ihn und
//    scrollt hin (Hauptweg — funktioniert immer).
//  • DRAG: per Craft `create`-Connector auf die Canvas ziehen (Bonus).
// Buchungs-Blöcke grün hervorgehoben — der Vorsprung ggü. reinen Buildern.
import { Element, useEditor } from "@craftjs/core";
import { ROOT_NODE } from "@craftjs/utils";
import { Icon } from "@iconify/react";
import type { ReactElement } from "react";
import { toast } from "sonner";

import {
  ButtonNode,
  ContactNode,
  GalleryNode,
  HeroNode,
  ImageNode,
  PropertiesGridNode,
  ReviewsNode,
  SearchNode,
  SpacerNode,
  TextNode,
} from "./nodes";

type PaletteItem = {
  label: string;
  icon: string;
  booking?: boolean;
  element: ReactElement;
};

const ITEMS: PaletteItem[] = [
  { label: "Hero", icon: "ph:image-square", element: <Element is={HeroNode} canvas={false} /> },
  { label: "Text", icon: "ph:text-aa", element: <Element is={TextNode} canvas={false} /> },
  { label: "Bild", icon: "ph:image", element: <Element is={ImageNode} canvas={false} /> },
  { label: "Galerie", icon: "ph:images", element: <Element is={GalleryNode} canvas={false} /> },
  { label: "Button", icon: "ph:cursor-click", element: <Element is={ButtonNode} canvas={false} /> },
  { label: "Abstand", icon: "ph:arrows-out-line-vertical", element: <Element is={SpacerNode} canvas={false} /> },
  { label: "Kontakt", icon: "ph:envelope", element: <Element is={ContactNode} canvas={false} /> },
  { label: "Suche", icon: "ph:magnifying-glass", booking: true, element: <Element is={SearchNode} canvas={false} /> },
  { label: "Objekt-Grid", icon: "ph:grid-four", booking: true, element: <Element is={PropertiesGridNode} canvas={false} /> },
  { label: "Bewertungen", icon: "ph:star", booking: true, element: <Element is={ReviewsNode} canvas={false} /> },
];

export function Palette() {
  const { connectors, query, actions } = useEditor();

  // Klick-Insert: Element → NodeTree → ans Ende von ROOT anhängen + selektieren.
  function insert(element: ReactElement, label: string) {
    try {
      const tree = query.parseReactElement(element).toNodeTree();
      const count = query.node(ROOT_NODE).get().data.nodes.length;
      actions.addNodeTree(tree, ROOT_NODE, count);
      actions.selectNode(tree.rootNodeId);
      requestAnimationFrame(() => {
        query.node(tree.rootNodeId).get().dom?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    } catch (e) {
      toast.error(`„${label}" konnte nicht eingefügt werden.`);
      // eslint-disable-next-line no-console
      console.error(e);
    }
  }

  return (
    <div className="grid grid-cols-2 gap-1.5">
      {ITEMS.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={() => insert(item.element, item.label)}
          ref={(r) => {
            if (r) connectors.create(r, item.element);
          }}
          className={
            "group flex flex-col items-start gap-2 rounded-lg border border-border bg-card p-2.5 text-left text-xs transition hover:border-primary/40 hover:bg-secondary/50 active:scale-[0.98] " +
            (item.booking ? "text-emerald-700" : "")
          }
        >
          <span className="pointer-events-none flex size-7 items-center justify-center rounded-md bg-secondary">
            <Icon icon={item.icon} className="size-4" />
          </span>
          <span className="pointer-events-none flex w-full items-center justify-between font-medium">
            {item.label}
            {item.booking ? (
              <span className="pointer-events-none rounded-full bg-emerald-100 px-1.5 py-0.5 text-[0.5625rem] font-semibold text-emerald-700">
                Buchung
              </span>
            ) : null}
          </span>
        </button>
      ))}
    </div>
  );
}
