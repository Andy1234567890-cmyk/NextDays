"use client";

// Insert-Panel (öffnet über den „+"-Button in der Toolbar, wie in Framer):
// links Kategorien, rechts ein großes Kachel-Grid der Bausteine. Klick auf eine
// Kachel fügt den Block ans Ende der Seite ein (und schließt das Panel).
import { Element, useEditor } from "@craftjs/core";
import { ROOT_NODE } from "@craftjs/utils";
import { Icon } from "@iconify/react";
import type { ReactElement } from "react";
import { useState } from "react";
import { toast } from "sonner";

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

type Baustein = {
  label: string;
  icon: string;
  booking?: boolean;
  element: () => ReactElement;
};

type Kategorie = {
  id: string;
  label: string;
  icon: string;
  bausteine: Baustein[];
};

const KATEGORIEN: Kategorie[] = [
  {
    id: "layout",
    label: "Layout",
    icon: "ph:layout",
    bausteine: [
      { label: "Hero", icon: "ph:image-square", element: () => <Element is={HeroNode} canvas={false} /> },
      { label: "Abstand", icon: "ph:arrows-out-line-vertical", element: () => <Element is={SpacerNode} canvas={false} /> },
    ],
  },
  {
    id: "inhalt",
    label: "Inhalt",
    icon: "ph:text-aa",
    bausteine: [
      { label: "Text", icon: "ph:text-aa", element: () => <Element is={TextNode} canvas={false} /> },
      { label: "Button", icon: "ph:cursor-click", element: () => <Element is={ButtonNode} canvas={false} /> },
      { label: "Kontakt", icon: "ph:envelope", element: () => <Element is={ContactNode} canvas={false} /> },
    ],
  },
  {
    id: "medien",
    label: "Medien",
    icon: "ph:image",
    bausteine: [
      { label: "Bild", icon: "ph:image", element: () => <Element is={ImageNode} canvas={false} /> },
      { label: "Galerie", icon: "ph:images", element: () => <Element is={GalleryNode} canvas={false} /> },
    ],
  },
  {
    id: "buchung",
    label: "Buchung",
    icon: "ph:calendar-check",
    bausteine: [
      { label: "Suche", icon: "ph:magnifying-glass", booking: true, element: () => <Element is={SearchNode} canvas={false} /> },
      { label: "Objekt-Grid", icon: "ph:grid-four", booking: true, element: () => <Element is={PropertiesGridNode} canvas={false} /> },
    ],
  },
];

export function InsertPanel({ onClose }: { onClose: () => void }) {
  const { query, actions } = useEditor();
  const [aktiv, setAktiv] = useState(KATEGORIEN[0].id);
  const [q, setQ] = useState("");

  const kategorie = KATEGORIEN.find((k) => k.id === aktiv) ?? KATEGORIEN[0];
  const suche = q.trim().toLowerCase();
  const bausteine = suche
    ? KATEGORIEN.flatMap((k) => k.bausteine).filter((b) =>
        b.label.toLowerCase().includes(suche),
      )
    : kategorie.bausteine;

  function insert(b: Baustein) {
    try {
      const tree = query.parseReactElement(b.element()).toNodeTree();
      const count = query.node(ROOT_NODE).get().data.nodes.length;
      actions.addNodeTree(tree, ROOT_NODE, count);
      actions.selectNode(tree.rootNodeId);
      requestAnimationFrame(() => {
        query.node(tree.rootNodeId).get().dom?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      onClose();
    } catch (e) {
      toast.error(`„${b.label}" konnte nicht eingefügt werden.`);
      // eslint-disable-next-line no-console
      console.error(e);
    }
  }

  return (
    <>
      {/* Klick außerhalb schließt */}
      <button
        type="button"
        aria-label="schließen"
        onClick={onClose}
        className="fixed inset-0 z-40 cursor-default"
      />
      <div className="absolute left-2 top-12 z-50 flex h-[32rem] w-[34rem] overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        {/* Kategorien-Spalte */}
        <div className="flex w-44 shrink-0 flex-col border-r border-border p-2">
          <div className="mb-2 flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5">
            <Icon icon="ph:magnifying-glass" className="size-3.5 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Suchen …"
              className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            />
          </div>
          <p className="mb-1 px-2 text-[0.625rem] font-semibold uppercase tracking-wide text-muted-foreground">
            Bausteine
          </p>
          {KATEGORIEN.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => {
                setAktiv(k.id);
                setQ("");
              }}
              className={
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition " +
                (aktiv === k.id && !suche
                  ? "bg-secondary font-medium text-foreground"
                  : "text-muted-foreground hover:bg-secondary/60")
              }
            >
              <Icon icon={k.icon} className="size-4" />
              {k.label}
              <Icon icon="ph:caret-right" className="ml-auto size-3 opacity-50" />
            </button>
          ))}
        </div>

        {/* Kachel-Grid */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-2 gap-3">
            {bausteine.map((b) => (
              <button
                key={b.label}
                type="button"
                onClick={() => insert(b)}
                className="group flex aspect-[4/3] flex-col items-center justify-center gap-3 rounded-xl bg-secondary/50 transition hover:bg-secondary hover:ring-2 hover:ring-primary/30"
              >
                <Icon
                  icon={b.icon}
                  className={"size-8 " + (b.booking ? "text-emerald-600" : "text-foreground/70")}
                />
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  {b.label}
                  {b.booking ? (
                    <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[0.5625rem] font-semibold text-emerald-700">
                      Buchung
                    </span>
                  ) : null}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
