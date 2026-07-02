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
  FrameNode,
  GalleryNode,
  GridNode,
  HeroNode,
  ImageNode,
  MasonryNode,
  PropertiesGridNode,
  SearchNode,
  SpacerNode,
  StackNode,
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
  // Generisch: ein React-Element direkt einfügen (fürs Auswahl-Menü).
  insertElement: (el: ReactElement, label: string) => void;
  // Frame mit expliziter Geometrie erstellen (nach dem Aufziehen im Fadenkreuz).
  createFrameAt: (x: number, y: number, w: number, h: number) => void;
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

  function insertElement(el: ReactElement, label: string) {
    try {
      const tree = query.parseReactElement(el).toNodeTree();
      const count = query.node(ROOT_NODE).get().data.nodes.length;
      actions.addNodeTree(tree, ROOT_NODE, count);
      actions.selectNode(tree.rootNodeId);
      requestAnimationFrame(() => {
        query.node(tree.rootNodeId).get().dom?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      onClose();
    } catch (e) {
      toast.error(`„${label}" konnte nicht eingefügt werden.`);
      // eslint-disable-next-line no-console
      console.error(e);
    }
  }

  const insert = (b: Baustein) => insertElement(b.element(), b.label);

  function createFrameAt(x: number, y: number, w: number, h: number) {
    insertElement(
      <Element is={FrameNode} canvas x={Math.round(x)} y={Math.round(y)} w={Math.round(w)} h={Math.round(h)} />,
      "Frame",
    );
  }

  return (
    <Ctx.Provider value={{ aktiv, setAktiv, q, setQ, insert, insertElement, createFrameAt }}>
      {children}
    </Ctx.Provider>
  );
}

export function useInsert() {
  return useContext(Ctx);
}

// Auswahl-/Insert-Menü als Popover — 1:1 nach Framers „Layout"-Dropdown:
// Frame · Stack · Grid · Masonry — Image · Video, mit exakt Framers Icons
// (Inline-SVG aus dem Original-DOM) und Shortcuts. Die Primitive werden auf
// unsere einfügbaren Blöcke abgebildet; Label/Icon/Shortcut bleiben Framer.
type MenuIcon = () => ReactElement;

const FrameIcon: MenuIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20">
    <path d="M 2.5 5.5 C 2.5 3.843 3.843 2.5 5.5 2.5 L 14.5 2.5 C 16.157 2.5 17.5 3.843 17.5 5.5 L 17.5 14.5 C 17.5 16.157 16.157 17.5 14.5 17.5 L 5.5 17.5 C 3.843 17.5 2.5 16.157 2.5 14.5 Z" fill="rgba(136,136,136,0.2)" />
    <path d="M 7.5 3 L 6 3 C 4.343 3 3 4.343 3 6 L 3 7.5" fill="transparent" strokeWidth="2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M 12.5 3 L 14 3 C 15.657 3 17 4.343 17 6 L 17 7.5" fill="transparent" strokeWidth="2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M 12.5 17 L 14 17 C 15.657 17 17 15.657 17 14 L 17 12.5" fill="transparent" strokeWidth="2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M 7.5 17 L 6 17 C 4.343 17 3 15.657 3 14 L 3 12.5" fill="transparent" strokeWidth="2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const StackIcon: MenuIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20">
    <path d="M 3 6 C 3 4.343 4.343 3 6 3 L 14 3 C 15.657 3 17 4.343 17 6 L 17 14 C 17 15.657 15.657 17 14 17 L 6 17 C 4.343 17 3 15.657 3 14 Z" fill="rgba(136,136,136,0.2)" strokeWidth="2" stroke="currentColor" />
    <path d="M 10 4 L 10 16" fill="rgba(136,136,136,0.2)" strokeWidth="2" stroke="currentColor" />
  </svg>
);
const GridIcon: MenuIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20">
    <path d="M 3 6 C 3 4.343 4.343 3 6 3 L 14 3 C 15.657 3 17 4.343 17 6 L 17 14 C 17 15.657 15.657 17 14 17 L 6 17 C 4.343 17 3 15.657 3 14 Z" fill="rgba(136,136,136,0.2)" strokeWidth="2" stroke="currentColor" />
    <path d="M 4 10 L 16 10" fill="rgba(136,136,136,0.2)" strokeWidth="2" stroke="currentColor" />
    <path d="M 10 4 L 10 16" fill="rgba(136,136,136,0.2)" strokeWidth="2" stroke="currentColor" />
  </svg>
);
const MasonryIcon: MenuIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20">
    <path d="M 3 6 C 3 4.343 4.343 3 6 3 L 14 3 C 15.657 3 17 4.343 17 6 L 17 14 C 17 15.657 15.657 17 14 17 L 6 17 C 4.343 17 3 15.657 3 14 Z" fill="rgba(136,136,136,0.2)" strokeWidth="2" stroke="currentColor" />
    <path d="M 4 10 L 16 10" fill="rgba(136,136,136,0.2)" strokeWidth="2" stroke="currentColor" />
    <path d="M 8 4 L 8 9" fill="rgba(136,136,136,0.2)" strokeWidth="2" stroke="currentColor" />
    <path d="M 12 11 L 12 16" fill="rgba(136,136,136,0.2)" strokeWidth="2" stroke="currentColor" />
  </svg>
);
const ImageIcon: MenuIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none">
    <path d="M3 6a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3Z" fill="transparent" stroke="currentColor" strokeWidth="2" />
    <path d="M3 13c3.402-4.859 10.598-4.859 14 0v1a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="2" />
  </svg>
);
const VideoIcon: MenuIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20">
    <path d="M 4.5 4.304 C 4.5 3.519 5.364 3.04 6.03 3.456 L 15.143 9.152 C 15.77 9.544 15.77 10.456 15.143 10.848 L 6.03 16.544 C 5.364 16.96 4.5 16.481 4.5 15.696 Z" fill="rgba(136,136,136,0.2)" strokeWidth="2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const INSERT_MENU: {
  label: string;
  Icon: MenuIcon;
  shortcut: string;
  element: () => ReactElement;
  trenner?: boolean;
}[] = [
  // Layout-Primitive = echte Container (canvas), leer beim Einfügen.
  { label: "Frame", Icon: FrameIcon, shortcut: "F", element: () => <Element is={FrameNode} canvas /> },
  { label: "Stack", Icon: StackIcon, shortcut: "S", element: () => <Element is={StackNode} canvas /> },
  { label: "Grid", Icon: GridIcon, shortcut: "⇧G", element: () => <Element is={GridNode} canvas /> },
  { label: "Masonry", Icon: MasonryIcon, shortcut: "⇧M", element: () => <Element is={MasonryNode} canvas /> },
  // Medien = Blatt-Blöcke.
  { label: "Image", Icon: ImageIcon, shortcut: "⇧I", element: () => <Element is={ImageNode} canvas={false} />, trenner: true },
  { label: "Video", Icon: VideoIcon, shortcut: "⇧V", element: () => <Element is={ImageNode} canvas={false} /> },
];

// Labels, die im Zeichenmodus (Fadenkreuz aufziehen) erstellt werden statt
// sofort eingefügt — der „Frame" ist das freie Objekt.
const DRAWABLE = new Set(["Frame"]);

export function InsertMenu({
  onClose,
  onDraw,
}: {
  onClose: () => void;
  // Zeichenmodus für aufziehbare Primitive (Frame): der Editor übernimmt das
  // Aufziehen und erstellt das Objekt beim Loslassen.
  onDraw?: (label: string) => void;
}) {
  const ctx = useContext(Ctx);
  if (!ctx) return null;
  return (
    <div
      role="menu"
      className="w-52 overflow-hidden rounded-xl border border-border bg-card p-1 shadow-xl shadow-black/10"
    >
      {INSERT_MENU.map((it) => (
        <div key={it.label}>
          {it.trenner ? <div className="my-1 h-px bg-border" /> : null}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              if (onDraw && DRAWABLE.has(it.label)) {
                onDraw(it.label);
              } else {
                ctx.insertElement(it.element(), it.label);
              }
              onClose();
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition hover:bg-secondary"
          >
            <span className="flex size-5 items-center justify-center text-foreground/80">
              <it.Icon />
            </span>
            <span className="flex-1">{it.label}</span>
            <span className="text-xs tracking-widest text-muted-foreground">{it.shortcut}</span>
          </button>
        </div>
      ))}
    </div>
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
