"use client";

// Linkes Panel im Framer-Stil: Tabs Pages / Layers / Assets.
//  • Pages: Seitenliste (aktive Seite markiert) + Block-Palette zum Einfügen.
//  • Layers: der Craft-Node-Baum der aktiven Seite (@craftjs/layers).
//  • Assets: Block-Palette als Bausteine (Drag/Klick).
import { Layers } from "@craftjs/layers";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useState } from "react";

import type { Page } from "@/lib/site-pages";

import { Palette } from "./palette";

type Tab = "pages" | "layers" | "assets";

export function LeftPanel({
  page,
  pages,
}: {
  page: Page;
  pages: Page[];
}) {
  const [tab, setTab] = useState<Tab>("pages");
  const [q, setQ] = useState("");

  const sichtbar = pages.filter((p) =>
    p.title.toLowerCase().includes(q.trim().toLowerCase()),
  );

  return (
    <div className="flex h-full flex-col">
      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border px-2 py-2">
        {(
          [
            { id: "pages" as Tab, label: "Seiten" },
            { id: "layers" as Tab, label: "Ebenen" },
            { id: "assets" as Tab, label: "Blöcke" },
          ]
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={
              "rounded-md px-2.5 py-1 text-xs font-medium transition " +
              (tab === t.id
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-secondary/60")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Suche */}
      <div className="border-b border-border p-2">
        <div className="flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5">
          <Icon icon="ph:magnifying-glass" className="size-3.5 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Suchen …"
            className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === "pages" ? (
          <>
            <Section title="Seiten">
              <ul className="flex flex-col gap-0.5">
                {sichtbar.map((p) => {
                  const active = p.id === page.id;
                  return (
                    <li key={p.id}>
                      <Link
                        href={`/website/${p.id}`}
                        className={
                          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition " +
                          (active
                            ? "bg-secondary font-medium text-foreground"
                            : "text-muted-foreground hover:bg-secondary/60")
                        }
                      >
                        <Icon
                          icon={p.is_home ? "ph:house" : "ph:file"}
                          className="size-4 shrink-0"
                        />
                        <span className="truncate">{p.title}</span>
                        {!p.is_published ? (
                          <span className="ml-auto text-[0.625rem] text-muted-foreground">
                            Entwurf
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Section>
            <Section title="Blöcke einfügen">
              <Palette />
            </Section>
          </>
        ) : null}

        {tab === "layers" ? (
          <div className="p-2 text-sm">
            <Layers expandRootOnLoad />
          </div>
        ) : null}

        {tab === "assets" ? (
          <Section title="Bausteine">
            <Palette />
          </Section>
        ) : null}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-border p-3">
      <p className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  );
}
