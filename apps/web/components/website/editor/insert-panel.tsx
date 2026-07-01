"use client";

// Insert-Modus (wie in Framer): KEIN Popup — beim Klick auf „+" WECHSELT das
// linke Panel in diesen Modus. Links Kategorien (Elements/CMS-artig), rechts
// daneben ein großes Kachel-Grid der Bausteine. Klick auf eine Kachel fügt den
// Block ein. Die beiden Spalten ersetzen Sidebar + Canvas, solange offen.
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
  gruppe: "elements" | "cms";
  bausteine: Baustein[];
};

const KATEGORIEN: Kategorie[] = [
  {
    id: "layout",
    label: "Layout",
    icon: "ph:layout",
    gruppe: "elements",
    bausteine: [
      { label: "Hero", icon: "ph:image-square", element: () => <Element is={HeroNode} canvas={false} /> },
      { label: "Abstand", icon: "ph:arrows-out-line-vertical", element: () => <Element is={SpacerNode} canvas={false} /> },
    ],
  },
  {
    id: "inhalt",
    label: "Inhalt",
    icon: "ph:text-aa",
    gruppe: "elements",
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
    gruppe: "elements",
    bausteine: [
      { label: "Bild", icon: "ph:image", element: () => <Element is={ImageNode} canvas={false} /> },
      { label: "Galerie", icon: "ph:images", element: () => <Element is={GalleryNode} canvas={false} /> },
    ],
  },
  {
    id: "buchung",
    label: "Buchung",
    icon: "ph:calendar-check",
    gruppe: "cms",
    bausteine: [
      { label: "Suche", icon: "ph:magnifying-glass", booking: true, element: () => <Element is={SearchNode} canvas={false} /> },
      { label: "Objekt-Grid", icon: "ph:grid-four", booking: true, element: () => <Element is={PropertiesGridNode} canvas={false} /> },
    ],
  },
];

// Gemeinsamer Insert-State (Kategorie + Suche) über einen Context geteilt, damit
// die beiden Modus-Spalten (categories / grid) denselben Zustand nutzen — sie
// werden im Editor getrennt gerendert (Sidebar-Spalte vs. Canvas-Overlay).
import { createContext, useContext } from "react";

type InsertCtx = {
  aktiv: string;
  setAktiv: (id: string) => void;
  q: string;
  setQ: (v: string) => void;
  insert: (b: Baustein) => void;
};
const Ctx = createContext<InsertCtx | null>(null);

export function InsertModeProvider({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { query, actions } = useEditor();
  const [aktiv, setAktiv] = useState(KATEGORIEN[0].id);
  const [q, setQ] = useState("");

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
    <Ctx.Provider value={{ aktiv, setAktiv, q, setQ, insert }}>
      {children}
    </Ctx.Provider>
  );
}

export function InsertMode({
  onClose,
  variant,
}: {
  onClose: () => void;
  variant: "categories" | "grid";
}) {
  const ctx = useContext(Ctx);
  if (!ctx) return null;
  const { aktiv, setAktiv, q, setQ, insert } = ctx;
  void onClose;

  const kategorie = KATEGORIEN.find((k) => k.id === aktiv) ?? KATEGORIEN[0];
  const suche = q.trim().toLowerCase();
  const bausteine = suche
    ? KATEGORIEN.flatMap((k) => k.bausteine).filter((b) =>
        b.label.toLowerCase().includes(suche),
      )
    : kategorie.bausteine;

  if (variant === "categories") {
    const elements = KATEGORIEN.filter((k) => k.gruppe === "elements");
    const cms = KATEGORIEN.filter((k) => k.gruppe === "cms");
    return (
      <div className="flex h-full flex-col overflow-y-auto">
        <div className="p-3">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
            <Icon icon="ph:magnifying-glass" className="size-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>
        <Gruppe title="Elements" items={elements} aktiv={aktiv} suche={!!suche} onPick={setAktiv} />
        <Gruppe title="CMS" items={cms} aktiv={aktiv} suche={!!suche} onPick={setAktiv} />
      </div>
    );
  }

  // variant === "grid" — kompakte, kleine Kacheln (wie Framer), scrollbares Raster
  return (
    <div className="h-full overflow-y-auto p-3">
      <div className="grid grid-cols-2 gap-2.5">
        {bausteine.map((b) => (
          <button
            key={b.label}
            type="button"
            onClick={() => insert(b)}
            className="group flex h-[7.5rem] flex-col items-center justify-center gap-2.5 rounded-xl bg-secondary/60 transition hover:bg-secondary hover:ring-2 hover:ring-primary/30"
          >
            <Icon
              icon={b.icon}
              className={"size-7 " + (b.booking ? "text-emerald-600" : "text-foreground/70")}
            />
            <span className="flex items-center gap-1 text-xs font-medium">
              {b.label}
              {b.booking ? (
                <span className="rounded-full bg-emerald-100 px-1 py-0.5 text-[0.5rem] font-semibold text-emerald-700">
                  Buchung
                </span>
              ) : null}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Gruppe({
  title,
  items,
  aktiv,
  suche,
  onPick,
}: {
  title: string;
  items: Kategorie[];
  aktiv: string;
  suche: boolean;
  onPick: (id: string) => void;
}) {
  return (
    <div className="px-2 pb-2">
      <p className="px-2 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div className="flex flex-col gap-0.5">
        {items.map((k) => (
          <button
            key={k.id}
            type="button"
            onClick={() => onPick(k.id)}
            className={
              "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition " +
              (aktiv === k.id && !suche
                ? "bg-secondary font-medium text-foreground"
                : "text-foreground hover:bg-secondary/60")
            }
          >
            <Icon icon={k.icon} className="size-4 text-muted-foreground" />
            {k.label}
            <Icon icon="ph:caret-right" className="ml-auto size-3.5 text-muted-foreground/50" />
          </button>
        ))}
      </div>
    </div>
  );
}
