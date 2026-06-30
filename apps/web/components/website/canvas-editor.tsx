"use client";

// Visueller Block-Editor einer Seite: Palette (links) | Block-Liste/Canvas (Mitte)
// | Inspector (rechts). Blöcke per Drag ODER Hoch/Runter-Pfeilen ordnen (HTML5-
// Muster wie photos-manager), auswählen → im Inspector bearbeiten, löschen.
// Inhalte werden debounced gespeichert; optimistisches Update mit Rollback.
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  type Block,
  type BlockType,
  type Page,
  addBlock,
  createDraftToken,
  removeBlock,
  reorderBlocks,
  updateBlock,
} from "@/lib/site-pages";

import { BLOCK_CATALOG, BLOCK_META } from "./block-catalog";
import { BlockInspector } from "./block-inspector";

// builder-Origin für die Live-Vorschau (Draft-iframe). Lokal Default 3200.
const BUILDER_URL =
  process.env.NEXT_PUBLIC_BUILDER_URL ?? "http://localhost:3200";

export function CanvasEditor({
  page,
  initialBlocks,
}: {
  page: Page;
  initialBlocks: Block[];
}) {
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialBlocks[0]?.id ?? null,
  );
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [draftToken, setDraftToken] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0); // erzwingt iframe-Reload
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const selected = blocks.find((b) => b.id === selectedId) ?? null;

  // Draft-Token einmal laden (für die Live-Vorschau im iframe).
  useEffect(() => {
    let active = true;
    void createDraftToken(page.id).then((res) => {
      if (active && res.ok) setDraftToken(res.data.token);
    });
    return () => {
      active = false;
    };
  }, [page.id]);

  // postMessage-Brücke: Klick im Canvas-iframe → Block selektieren.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== BUILDER_URL) return; // nur der builder-Origin
      const data = e.data as { source?: string; type?: string; index?: number };
      if (data?.source !== "builder-canvas") return;
      if (data.type === "ready") return;
      if (data.type === "select" && typeof data.index === "number") {
        const b = blocks[data.index];
        if (b) setSelectedId(b.id);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [blocks]);

  // Editor stellt sich dem iframe vor (setzt den Ziel-Origin in der Bridge).
  function onIframeLoad() {
    iframeRef.current?.contentWindow?.postMessage(
      { source: "builder-editor", type: "hello" },
      BUILDER_URL,
    );
  }

  // iframe neu laden, sobald sich Blöcke geändert haben (nach dem Speichern).
  function refreshPreview() {
    setPreviewKey((k) => k + 1);
  }

  async function persistOrder(next: Block[]) {
    const prev = blocks;
    setBlocks(next);
    const res = await reorderBlocks(
      page.id,
      next.map((b) => b.id),
    );
    if (res.ok) {
      setBlocks(res.data.items);
      refreshPreview();
    } else {
      setBlocks(prev);
      toast.error(res.error);
    }
  }

  function move(id: string, dir: -1 | 1) {
    const from = blocks.findIndex((b) => b.id === id);
    const to = from + dir;
    if (from === -1 || to < 0 || to >= blocks.length) return;
    const next = [...blocks];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    void persistOrder(next);
  }

  function onDropReorder(targetId: string) {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      setOverId(null);
      return;
    }
    const from = blocks.findIndex((b) => b.id === dragId);
    const to = blocks.findIndex((b) => b.id === targetId);
    setDragId(null);
    setOverId(null);
    if (from === -1 || to === -1) return;
    const next = [...blocks];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    void persistOrder(next);
  }

  async function onAdd(type: BlockType) {
    const meta = BLOCK_META[type];
    const res = await addBlock(page.id, type, meta.defaultContent);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setBlocks((prev) => [...prev, res.data]);
    setSelectedId(res.data.id);
    refreshPreview();
  }

  async function onDelete(id: string) {
    const prev = blocks;
    setBlocks((b) => b.filter((x) => x.id !== id));
    if (selectedId === id) setSelectedId(null);
    const res = await removeBlock(id);
    if (!res.ok) {
      setBlocks(prev);
      toast.error(res.error);
    } else {
      refreshPreview();
    }
  }

  // Debounced Speichern der Inhalte/Settings eines Blocks.
  function onInspectorChange(
    id: string,
    patch: { content?: Record<string, unknown>; settings?: Record<string, unknown> },
  ) {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    );
    clearTimeout(saveTimers.current[id]);
    saveTimers.current[id] = setTimeout(async () => {
      const res = await updateBlock(id, patch);
      if (!res.ok) toast.error(res.error);
      else refreshPreview();
    }, 600);
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* Kopfzeile */}
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Link href="/website">
            <Button variant="ghost" size="sm">
              <Icon icon="ph:arrow-left" className="size-4" />
            </Button>
          </Link>
          <div>
            <p className="font-display font-bold">{page.title}</p>
            <p className="text-xs text-muted-foreground">
              /{page.slug} · {page.is_published ? "veröffentlicht" : "Entwurf"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-[13rem_13rem_1fr_18rem] overflow-hidden">
        {/* Palette */}
        <aside className="overflow-y-auto border-r border-border p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Blöcke einfügen
          </p>
          <div className="flex flex-col gap-1">
            {BLOCK_CATALOG.map((b) => (
              <button
                key={b.type}
                type="button"
                onClick={() => onAdd(b.type)}
                className={
                  "flex items-center gap-2 rounded-(--radius) px-3 py-2 text-left text-sm hover:bg-secondary/60 " +
                  (b.booking ? "text-emerald-700" : "")
                }
              >
                <Icon icon={b.icon} className="size-4" />
                {b.label}
                {b.booking ? (
                  <span className="ml-auto rounded-full bg-emerald-100 px-1.5 text-[0.625rem] font-medium text-emerald-700">
                    Buchung
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </aside>

        {/* Ebenen: Block-Reihenfolge per Drag ODER Pfeilen */}
        <aside className="overflow-y-auto border-r border-border p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Ebenen
          </p>
          {blocks.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Noch keine Blöcke.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {blocks.map((block) => (
                <li
                  key={block.id}
                  draggable
                  onDragStart={() => setDragId(block.id)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setOverId(block.id);
                  }}
                  onDrop={() => onDropReorder(block.id)}
                  onDragEnd={() => {
                    setDragId(null);
                    setOverId(null);
                  }}
                  onClick={() => setSelectedId(block.id)}
                  className={
                    "flex cursor-pointer items-center gap-1.5 rounded-(--radius) border px-2 py-2 text-sm " +
                    (selectedId === block.id
                      ? "border-primary bg-secondary/50"
                      : "border-transparent hover:bg-secondary/40") +
                    (overId === block.id ? " ring-2 ring-primary/40" : "") +
                    (dragId === block.id ? " opacity-50" : "")
                  }
                >
                  <Icon
                    icon={BLOCK_META[block.type].icon}
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                  <span className="truncate">{BLOCK_META[block.type].label}</span>
                  <span className="ml-auto flex shrink-0 items-center">
                    <button
                      type="button"
                      aria-label="nach oben"
                      onClick={(e) => {
                        e.stopPropagation();
                        move(block.id, -1);
                      }}
                      className="rounded-full p-0.5 hover:bg-secondary"
                    >
                      <Icon icon="ph:caret-up" className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="nach unten"
                      onClick={(e) => {
                        e.stopPropagation();
                        move(block.id, 1);
                      }}
                      className="rounded-full p-0.5 hover:bg-secondary"
                    >
                      <Icon icon="ph:caret-down" className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="löschen"
                      onClick={(e) => {
                        e.stopPropagation();
                        void onDelete(block.id);
                      }}
                      className="rounded-full p-0.5 hover:bg-secondary"
                    >
                      <Icon icon="ph:trash" className="size-3.5" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* Live-Canvas: echter builder-Render im iframe (Draft-Token) */}
        <main className="overflow-hidden bg-secondary/20">
          {draftToken ? (
            <iframe
              key={previewKey}
              ref={iframeRef}
              onLoad={onIframeLoad}
              title="Live-Vorschau"
              src={`${BUILDER_URL}/render/${page.id}?token=${encodeURIComponent(draftToken)}`}
              className="size-full border-0"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Vorschau wird geladen …
            </div>
          )}
        </main>

        {/* Inspector */}
        <aside className="overflow-y-auto border-l border-border">
          {selected ? (
            <BlockInspector
              key={selected.id}
              block={selected}
              onChange={(patch) => onInspectorChange(selected.id, patch)}
            />
          ) : (
            <p className="p-4 text-sm text-muted-foreground">
              Wählen Sie links einen Block, um ihn zu bearbeiten.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
