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
import { Palette } from "./palette";
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
  initialBlocks,
}: {
  page: Page;
  initialBlocks: Block[];
}) {
  return (
    <Editor resolver={RESOLVER}>
      <EditorShell page={page} initialBlocks={initialBlocks} />
    </Editor>
  );
}

function EditorShell({
  page,
  initialBlocks,
}: {
  page: Page;
  initialBlocks: Block[];
}) {
  const { query, actions } = useEditor();
  const [device, setDevice] = useState<Device>("desktop");
  const [zoom, setZoom] = useState(1);
  const [saving, setSaving] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Blöcke nach dem Mount einzeln in den (von Craft erzeugten) ROOT-Canvas laden.
  // parseSerializedNode().toNode() löst jeden resolvedName gegen den laufenden
  // Resolver auf und hängt den Knoten an ROOT — robuster als ein selbst gebautes
  // ROOT-JSON via deserialize (das beim ROOT-Typ scheiterte).
  const loadBlocks = (blocks: Block[]) => {
    blocks.forEach((_, i) => {
      const sn = blocksToSerializedNodes(blocks)[i];
      const node = query.parseSerializedNode(sn).toNode();
      actions.add(node, ROOT_NODE, i);
    });
  };

  useEffect(() => {
    if (initialBlocks.length > 0) loadBlocks(initialBlocks);
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

  return (
    <div className="flex flex-1 flex-col">
      {/* Kopfzeile */}
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Link href="/website">
            <Button variant="ghost" size="icon">
              <Icon icon="ph:arrow-left" className="size-4" />
            </Button>
          </Link>
          <div>
            <p className="text-sm font-semibold">{page.title}</p>
            <p className="text-xs text-muted-foreground">
              /{page.slug} · {page.is_published ? "veröffentlicht" : "Entwurf"}
            </p>
          </div>
        </div>

        {/* Device-Umschalter */}
        <div className="flex items-center gap-1 rounded-full border border-border p-1">
          {(["desktop", "tablet", "mobile"] as Device[]).map((d) => (
            <button
              key={d}
              type="button"
              aria-label={d}
              onClick={() => setDevice(d)}
              className={
                "flex size-8 items-center justify-center rounded-full transition " +
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

        {/* Zoom + Speichern */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-full border border-border px-1">
            <button type="button" aria-label="kleiner" onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.1).toFixed(2)))} className="flex size-7 items-center justify-center rounded-full hover:bg-secondary">
              <Icon icon="ph:minus" className="size-3.5" />
            </button>
            <span className="w-10 text-center text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
            <button type="button" aria-label="größer" onClick={() => setZoom((z) => Math.min(1.5, +(z + 0.1).toFixed(2)))} className="flex size-7 items-center justify-center rounded-full hover:bg-secondary">
              <Icon icon="ph:plus" className="size-3.5" />
            </button>
          </div>
          <Button onClick={save} disabled={saving} size="sm">
            {saving ? "Speichern …" : "Speichern"}
          </Button>
        </div>
      </header>

      {/* 3 Spalten: Palette · Canvas · Eigenschaften */}
      <div className="grid flex-1 grid-cols-[14rem_1fr_18rem] overflow-hidden">
        <aside className="overflow-y-auto border-r border-border">
          <Palette />
        </aside>

        {/* Canvas-Bühne (grauer Hintergrund, Device-Frame, Zoom) */}
        <div
          ref={scrollRef}
          className="relative overflow-auto bg-[oklch(0.96_0_0)] p-8"
        >
          <SelectionOverlay scrollRef={scrollRef} />
          <div
            className="mx-auto bg-background shadow-2xl shadow-black/10 ring-1 ring-border transition-[width] duration-200"
            style={{
              width: DEVICE_WIDTH[device],
              maxWidth: "100%",
              transform: `scale(${zoom})`,
              transformOrigin: "top center",
            }}
          >
            {/* Craft erzeugt den ROOT-Canvas selbst; die Blöcke werden nach dem
                Mount per actions.deserialize geladen (löst resolvedNames gegen
                den laufenden Resolver auf). */}
            <Frame>
              <Element is={Canvas} canvas />
            </Frame>
          </div>
        </div>

        <aside className="overflow-y-auto border-l border-border">
          <PropertiesPanel />
        </aside>
      </div>
    </div>
  );
}
