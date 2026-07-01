"use client";

// Linkes Panel im Framer-Stil: Tabs Pages / Layers / Assets.
//  • Pages: Abschnitte „Design" (globale Einstellungen) + „Pages" (Seitenliste),
//    beide mit „+". KEINE Block-Palette hier — Blöcke kommen übers „+"-Menü oben.
//  • Layers: der Craft-Node-Baum der aktiven Seite (@craftjs/layers).
//  • Assets: Bausteine (Palette) als Kachel-Katalog.
import { Layers } from "@craftjs/layers";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import type { Page } from "@/lib/site-pages";
import { createPage } from "@/lib/site-pages";

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
  const [pending, start] = useTransition();
  const router = useRouter();

  const sichtbar = pages.filter((p) =>
    p.title.toLowerCase().includes(q.trim().toLowerCase()),
  );

  function neueSeite() {
    start(async () => {
      const titel = "Neue Seite";
      const res = await createPage(titel);
      if (res.ok) {
        router.push(`/website/${res.data.id}`);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="flex h-full flex-col">
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
            {/* Design-Abschnitt (globale Einstellungen) */}
            <SectionHeader
              title="Design"
              onAdd={() => router.push("/konto")}
            />
            {/* Pages-Abschnitt */}
            <SectionHeader
              title="Pages"
              onAdd={neueSeite}
              adding={pending}
            />
            <ul className="flex flex-col gap-0.5 px-2 pb-3">
              {sichtbar.map((p) => {
                const active = p.id === page.id;
                return (
                  <li key={p.id}>
                    <Link
                      href={`/website/${p.id}`}
                      className={
                        "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition " +
                        (active
                          ? "bg-secondary font-medium text-foreground"
                          : "text-foreground hover:bg-secondary/60")
                      }
                    >
                      <Icon
                        icon={p.is_home ? "ph:house" : "ph:file"}
                        className="size-4 shrink-0 text-muted-foreground"
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
          </>
        ) : null}

        {tab === "layers" ? (
          <div className="p-2 text-sm">
            <Layers expandRootOnLoad />
          </div>
        ) : null}

        {tab === "assets" ? (
          <div className="p-3">
            <p className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
              Bausteine
            </p>
            <Palette />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  onAdd,
  adding,
}: {
  title: string;
  onAdd: () => void;
  adding?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-sm font-semibold">{title}</span>
      <button
        type="button"
        aria-label={`${title} hinzufügen`}
        onClick={onAdd}
        disabled={adding}
        className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-50"
      >
        <Icon icon={adding ? "ph:circle-notch" : "ph:plus"} className={"size-4 " + (adding ? "animate-spin" : "")} />
      </button>
    </div>
  );
}
