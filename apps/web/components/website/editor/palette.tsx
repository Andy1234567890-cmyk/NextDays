"use client";

// Block-Palette (links): jeder Eintrag ist per Drag auf die Canvas ziehbar
// (Craft `create`-Connector) ODER per Klick ans Ende anfügbar. Buchungs-Blöcke
// grün hervorgehoben — der Vorsprung ggü. reinen Website-Buildern.
import { Element, useEditor } from "@craftjs/core";
import { Icon } from "@iconify/react";
import type { ReactElement } from "react";

import {
  ButtonNode,
  ContactNode,
  GalleryNode,
  HeroNode,
  ImageNode,
  PropertiesGridNode,
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
];

export function Palette() {
  const { connectors } = useEditor();

  return (
    <div className="flex flex-col gap-1 p-3">
      <p className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Blöcke
      </p>
      {ITEMS.map((item) => (
        <button
          key={item.label}
          type="button"
          ref={(r) => {
            if (r) connectors.create(r, item.element);
          }}
          className={
            "flex cursor-grab items-center gap-2.5 rounded-(--radius) border border-transparent px-3 py-2.5 text-left text-sm transition active:cursor-grabbing hover:border-border hover:bg-secondary/60 " +
            (item.booking ? "text-emerald-700" : "")
          }
        >
          <span className="flex size-7 items-center justify-center rounded-md bg-secondary">
            <Icon icon={item.icon} className="size-4" />
          </span>
          <span className="font-medium">{item.label}</span>
          {item.booking ? (
            <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[0.625rem] font-semibold text-emerald-700">
              Buchung
            </span>
          ) : (
            <Icon icon="ph:dots-six-vertical" className="ml-auto size-4 text-muted-foreground/50" />
          )}
        </button>
      ))}
    </div>
  );
}
