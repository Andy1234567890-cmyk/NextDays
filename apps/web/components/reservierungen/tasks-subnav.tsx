"use client";

// Sub-Navigation des Aufgaben-Moduls (.. /tasks): eigene linke Sidebar mit
// Überschrift „AUFGABEN" und 7 Reitern. Erscheint anstelle der globalen PM-Nav,
// sobald man im Aufgaben-Bereich ist (Ausnahme in pm-module-shell.tsx). Aktiver
// Reiter grau hinterlegt (wie Objekt-Sub-Nav).
import { Icon } from "@iconify/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const BASE = "/reservierungen/aufgaben";

const TABS: { slug: string; title: string }[] = [
  { slug: "", title: "Kalender" },
  { slug: "meine", title: "Meine Aufgaben" },
  { slug: "team", title: "Teamaufgaben" },
  { slug: "inspektion", title: "Inspektion" },
  { slug: "vorlagen", title: "Aufgabenvorlagen" },
  { slug: "planmaessig", title: "Planmäßige Aufgaben" },
  { slug: "regelmaessig", title: "Regelmäßige Aufgaben" },
];

export function TasksSubnav() {
  const pathname = usePathname();

  const isActive = (slug: string) => {
    const href = slug ? `${BASE}/${slug}` : BASE;
    return slug ? pathname.startsWith(href) : pathname === BASE;
  };

  return (
    <aside className="flex flex-col gap-1">
      <Link
        href="/reservierungen"
        className="mb-1 flex items-center gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
      >
        <Icon icon="ph:arrow-left" className="size-3.5" />
        PM-Modul
      </Link>
      <span className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Aufgaben
      </span>
      {TABS.map((tab) => {
        const active = isActive(tab.slug);
        return (
          <Link
            key={tab.slug || "kalender"}
            href={tab.slug ? `${BASE}/${tab.slug}` : BASE}
            className={`rounded-(--radius) px-3 py-2 text-sm transition-colors ${active
                ? "bg-secondary font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              }`}
          >
            {tab.title}
          </Link>
        );
      })}
    </aside>
  );
}
