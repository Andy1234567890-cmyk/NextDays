"use client";

// Linkes Panel des Page-Builders (Framer-Stil) — Werkstatt-Nachbau.
// Tabs Pages / Layers / Assets:
//  • Pages: Abschnitte „Design" + „Pages" (Seitenliste mit Home-/Entwurf-
//    Kennzeichnung), beide mit „+".
//  • Layers: der Ebenen-Baum der aktiven Seite (hier props-getrieben).
//  • Assets: Baustein-Katalog als Kachel-Grid.
import { Icon } from "@iconify/react";
import { useState } from "react";

import { KATEGORIEN } from "./insert-panel";
import { LayerTree, type LayerNode } from "./layer-tree";

export type PageEntry = {
  id: string;
  title: string;
  isHome?: boolean;
  published?: boolean;
};

type Tab = "pages" | "layers" | "assets";

export function PagesPanel({
  pages,
  activeId,
  layers,
  onOpenPage,
  onAddPage,
  onInsert,
}: {
  pages: PageEntry[];
  /** Aktive (im Editor geöffnete) Seite. */
  activeId?: string;
  /** Ebenen-Baum der aktiven Seite für den Layers-Tab. */
  layers?: LayerNode[];
  onOpenPage?: (id: string) => void;
  onAddPage?: () => void;
  /** Klick auf eine Baustein-Kachel im Assets-Tab. */
  onInsert?: (label: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("pages");
  const [q, setQ] = useState("");
  const [selectedLayer, setSelectedLayer] = useState<string | null>(null);

  const active = pages.find((p) => p.id === activeId);
  const sichtbar = pages.filter((p) =>
    p.title.toLowerCase().includes(q.trim().toLowerCase()),
  );

  return (
    <div className="flex h-120 w-72 flex-col overflow-hidden rounded-xl border border-border bg-card">
      {/* Tabs */}
      <div className="flex items-center gap-4 px-4 pt-3">
        {(
          [
            { id: "pages" as Tab, label: "Pages" },
            { id: "layers" as Tab, label: "Layers" },
            { id: "assets" as Tab, label: "Assets" },
          ]
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={
              "border-b-2 pb-2 text-sm font-medium transition " +
              (tab === t.id
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground")
            }
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="border-b border-border" />

      {/* Seiten-Umschalter (nur im Layers-Tab, wie Framer „Home ▾") */}
      {tab === "layers" && active ? (
        <>
          <button
            type="button"
            className="mx-3 mt-3 flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm transition hover:bg-secondary/60"
          >
            <Icon
              icon={active.isHome ? "ph:house" : "ph:file"}
              className="size-4 text-muted-foreground"
            />
            <span className="truncate">{active.title}</span>
            <Icon icon="ph:caret-down" className="ml-auto size-3.5 text-muted-foreground" />
          </button>
          <div className="mx-3 mt-2 border-b border-border" />
        </>
      ) : null}

      {/* Suche */}
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

      <div className="flex-1 overflow-y-auto">
        {tab === "pages" ? (
          <>
            {/* „Design +" führt im Produkt zu den globalen Einstellungen (/konto);
                im Nachbau bewusst ohne Aktion. */}
            <SectionHeader title="Design" />
            <SectionHeader title="Pages" onAdd={onAddPage} />
            <ul className="flex flex-col gap-0.5 px-2 pb-3">
              {sichtbar.map((p) => {
                const isActive = p.id === activeId;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => onOpenPage?.(p.id)}
                      className={
                        "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition " +
                        (isActive
                          ? "bg-secondary font-medium text-foreground"
                          : "text-foreground hover:bg-secondary/60")
                      }
                    >
                      <Icon
                        icon={p.isHome ? "ph:house" : "ph:file"}
                        className="size-4 shrink-0 text-muted-foreground"
                      />
                      <span className="truncate">{p.title}</span>
                      {!p.published ? (
                        <span className="ml-auto text-[0.625rem] text-muted-foreground">
                          Entwurf
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        ) : null}

        {tab === "layers" ? (
          layers?.length ? (
            <LayerTree nodes={layers} selectedId={selectedLayer} onSelect={setSelectedLayer} />
          ) : (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Keine Ebenen</p>
          )
        ) : null}

        {tab === "assets" ? (
          <div className="p-3">
            <p className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
              Bausteine
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {KATEGORIEN.flatMap((k) => k.bausteine).map((b) => (
                <button
                  key={b.label}
                  type="button"
                  onClick={() => onInsert?.(b.label)}
                  className="flex h-20 flex-col items-center justify-center gap-1.5 rounded-xl bg-secondary/60 transition hover:bg-secondary hover:ring-2 hover:ring-primary/30"
                >
                  <Icon
                    icon={b.icon}
                    className={"size-5 " + (b.booking ? "text-emerald-600" : "text-foreground/70")}
                  />
                  <span className="text-xs font-medium">{b.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SectionHeader({ title, onAdd }: { title: string; onAdd?: () => void }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-sm font-semibold">{title}</span>
      <button
        type="button"
        aria-label={`${title} hinzufügen`}
        onClick={onAdd}
        className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground"
      >
        <Icon icon="ph:plus" className="size-4" />
      </button>
    </div>
  );
}
