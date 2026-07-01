"use client";

// Visueller Canvas-Editor (Figma-/Framer-Prinzip, KEIN iframe):
// Blöcke werden direkt im Dashboard gerendert, sind auf der Fläche anklickbar,
// per Drag aus der Palette positionierbar und Text wird inline editiert.
// Links Palette · Mitte Canvas (Device-Frame + Zoom + Auswahl-Overlay) · rechts
// Eigenschaften. Speichern synchronisiert den Craft-Baum zurück in site_blocks.
import { Editor, Element, Frame, useEditor } from "@craftjs/core";
import { ROOT_NODE } from "@craftjs/utils";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { Block, Page } from "@/lib/site-pages";
import { syncBlocks } from "@/lib/site-pages";

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
import { InsertMode, InsertModeProvider } from "./insert-panel";
import { LeftPanel } from "./left-panel";
import { RenderNode } from "./render-node";
import { PropertiesPanel } from "./properties-panel";
import { SelectionOverlay } from "./selection-overlay";
import { blocksToSerializedNodes, craftJsonToBlocks } from "./serialize";

type Device = "desktop" | "tablet" | "mobile";
const DEVICE_WIDTH: Record<Device, string> = {
  desktop: "100%",
  tablet: "48rem",
  mobile: "23.5rem",
};

// ROOT-Canvas: nimmt die Blöcke als Kinder auf (Drop-Ziel der Palette).
function Canvas({ children }: { children?: React.ReactNode }) {
  return <div className="min-h-[60vh] w-full">{children}</div>;
}
Canvas.craft = {
  displayName: "Seite",
  rules: { canMoveIn: () => true },
};

const RESOLVER = {
  Canvas,
  HeroNode,
  TextNode,
  ImageNode,
  GalleryNode,
  ButtonNode,
  SpacerNode,
  ContactNode,
  SearchNode,
  PropertiesGridNode,
};

export function CanvasEditor({
  page,
  pages,
  initialBlocks,
}: {
  page: Page;
  pages: Page[];
  initialBlocks: Block[];
}) {
  return (
    <Editor resolver={RESOLVER} onRender={RenderNode}>
      <EditorShell page={page} pages={pages} initialBlocks={initialBlocks} />
    </Editor>
  );
}

function EditorShell({
  page,
  pages,
  initialBlocks,
}: {
  page: Page;
  pages: Page[];
  initialBlocks: Block[];
}) {
  const { query, actions } = useEditor();
  const [device, setDevice] = useState<Device>("desktop");
  const [zoom, setZoom] = useState(1);
  const [saving, setSaving] = useState(false);
  const [insertOpen, setInsertOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Blöcke in den (von Craft erzeugten) ROOT-Canvas laden.
  // parseSerializedNode().toNode() löst jeden resolvedName gegen den laufenden
  // Resolver auf und hängt den Knoten an ROOT.
  const loadBlocks = (blocks: Block[]) => {
    const serialized = blocksToSerializedNodes(blocks);
    serialized.forEach((sn, i) => {
      const node = query.parseSerializedNode(sn).toNode();
      actions.add(node, ROOT_NODE, i);
    });
  };

  // Erst laden, wenn der ROOT-Canvas wirklich existiert (Frame gemountet). Beim
  // ersten Effect-Lauf ist ROOT sonst noch nicht da → Blöcke gingen verloren
  // (Symptom: leere Canvas trotz vorhandener Blöcke).
  const loadedRef = useRef(false);
  useEffect(() => {
    if (loadedRef.current || initialBlocks.length === 0) return;
    let tries = 0;
    const tryLoad = () => {
      tries += 1;
      const rootExists = !!query.getNodes()[ROOT_NODE];
      if (rootExists) {
        loadedRef.current = true;
        loadBlocks(initialBlocks);
      } else if (tries < 30) {
        requestAnimationFrame(tryLoad);
      }
    };
    requestAnimationFrame(tryLoad);
    // nur beim ersten Mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    setSaving(true);
    try {
      const json = query.serialize();
      const blocks = craftJsonToBlocks(json);
      const res = await syncBlocks(page.id, blocks);
      if (res.ok) {
        // Frische DB-IDs zurückspielen, damit erneutes Speichern sauber diff't:
        // ROOT-Kinder entfernen, dann mit den echten IDs neu laden.
        const rootChildren = [...query.node(ROOT_NODE).get().data.nodes];
        rootChildren.forEach((id) => actions.delete(id));
        loadBlocks(res.data.items);
        toast.success("Gespeichert");
      } else {
        toast.error(res.error);
      }
    } finally {
      setSaving(false);
    }
  }

  const deviceLabel: Record<Device, string> = { desktop: "Desktop", tablet: "Tablet", mobile: "Mobil" };
  const devicePx: Record<Device, number> = { desktop: 1200, tablet: 768, mobile: 390 };

  return (
    <div className="relative flex h-full flex-1 flex-col bg-background">
      {/* Obere Toolbar (Framer-Stil) */}
      <header className="flex h-12 items-center justify-between gap-3 border-b border-border px-3">
        <div className="flex items-center gap-2">
          <Link href="/website">
            <Button variant="ghost" size="icon" className="size-8">
              <Icon icon="ph:arrow-left" className="size-4" />
            </Button>
          </Link>
          <span className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium">
            <Icon icon="ph:browser" className="size-3.5 text-primary" />
            Canvas
            <Icon icon="ph:caret-down" className="size-3 text-muted-foreground" />
          </span>
          {/* Werkzeuge — „+" öffnet das Insert-Panel */}
          <div className="ml-1 flex items-center gap-0.5">
            <button
              type="button"
              aria-label="Block hinzufügen"
              title="Block hinzufügen"
              onClick={() => setInsertOpen((v) => !v)}
              className={
                "flex size-8 items-center justify-center rounded-md transition " +
                (insertOpen
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground")
              }
            >
              <Icon icon="ph:plus" className="size-4" />
            </button>
            <ToolBtn icon="ph:selection" label="Auswahl" />
            <ToolBtn icon="ph:text-t" label="Text" />
          </div>
        </div>

        {/* Titel mittig */}
        <div className="flex flex-col items-center">
          <span className="text-sm font-semibold">{page.title}</span>
          <span className="text-[0.625rem] text-muted-foreground">
            /{page.slug || ""} · {page.is_published ? "veröffentlicht" : "Entwurf"}
          </span>
        </div>

        {/* Rechts: Device + Veröffentlichen */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
            {(["desktop", "tablet", "mobile"] as Device[]).map((d) => (
              <button
                key={d}
                type="button"
                aria-label={d}
                onClick={() => setDevice(d)}
                className={
                  "flex size-7 items-center justify-center rounded transition " +
                  (device === d ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60")
                }
              >
                <Icon
                  icon={d === "desktop" ? "ph:desktop" : d === "tablet" ? "ph:device-tablet" : "ph:device-mobile"}
                  className="size-4"
                />
              </button>
            ))}
          </div>
          <Button onClick={save} disabled={saving} size="sm" className="h-8">
            {saving ? "Speichern …" : "Veröffentlichen"}
          </Button>
        </div>
      </header>

      {/* 3 Spalten: LeftPanel · Canvas · Inspektor.
          Im Insert-Modus WECHSELT die Sidebar zu den Insert-Kategorien und das
          Kachel-Grid legt sich als Overlay über die Canvas. Der Craft-Frame
          bleibt IMMER gemountet (nie display:none), damit keine Blöcke verloren
          gehen. */}
      <InsertModeProvider onClose={() => setInsertOpen(false)}>
      <div className="grid min-h-0 flex-1 grid-cols-[15rem_1fr_17rem]">
        {/* Spalte 1: Sidebar ODER Insert-Kategorien */}
        <aside className="min-h-0 overflow-hidden border-r border-border">
          {insertOpen ? (
            <InsertMode onClose={() => setInsertOpen(false)} variant="categories" />
          ) : (
            <LeftPanel page={page} pages={pages} />
          )}
        </aside>

        {/* Canvas-Bühne: freie Fläche + sichtbarer Device-Frame (bleibt gemountet) */}
        <div
          ref={scrollRef}
          className="relative min-h-0 overflow-auto bg-[oklch(0.94_0.004_260)]"
        >
          {/* Insert-Kachel-Grid: schmale Spalte am linken Rand der Canvas
              (wie Framer) — die Canvas bleibt rechts daneben sichtbar. */}
          {insertOpen ? (
            <div className="absolute inset-y-0 left-0 z-30 w-[22rem] overflow-y-auto border-r border-border bg-background">
              <InsertMode onClose={() => setInsertOpen(false)} variant="grid" />
            </div>
          ) : null}
          <SelectionOverlay scrollRef={scrollRef} />
          <div className="flex min-h-full w-full justify-center p-12">
            <div
              style={{
                width: DEVICE_WIDTH[device],
                maxWidth: "100%",
                transform: `scale(${zoom})`,
                transformOrigin: "top center",
              }}
            >
              {/* Device-Frame-Label (wie Framer „Desktop 1200") */}
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-primary">
                <Icon icon="ph:play-circle" className="size-4" />
                {deviceLabel[device]}
                <span className="text-muted-foreground">{devicePx[device]}</span>
              </div>
              <div className="min-h-[40rem] bg-background shadow-xl shadow-black/10 ring-1 ring-primary/30">
                <Frame>
                  <Element is={Canvas} canvas />
                </Frame>
              </div>
            </div>
          </div>

          {/* Untere schwebende Leiste (Zeiger/Hand/Zoom) */}
          <div className="pointer-events-none sticky bottom-4 flex justify-center">
            <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-border bg-card px-2 py-1.5 shadow-lg">
              <ToolBtn icon="ph:cursor" label="Zeiger" />
              <ToolBtn icon="ph:hand" label="Hand" />
              <span className="mx-1 h-4 w-px bg-border" />
              <button type="button" aria-label="kleiner" onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.1).toFixed(2)))} className="flex size-7 items-center justify-center rounded-full hover:bg-secondary">
                <Icon icon="ph:minus" className="size-3.5" />
              </button>
              <span className="w-11 text-center text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
              <button type="button" aria-label="größer" onClick={() => setZoom((z) => Math.min(1.5, +(z + 0.1).toFixed(2)))} className="flex size-7 items-center justify-center rounded-full hover:bg-secondary">
                <Icon icon="ph:plus" className="size-3.5" />
              </button>
            </div>
          </div>
        </div>

        <aside className="min-h-0 overflow-y-auto border-l border-border">
          <PropertiesPanel />
        </aside>
      </div>
      </InsertModeProvider>
    </div>
  );
}

function ToolBtn({ icon, label }: { icon: string; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground"
    >
      <Icon icon={icon} className="size-4" />
    </button>
  );
}
