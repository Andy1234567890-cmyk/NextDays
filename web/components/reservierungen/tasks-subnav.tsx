"use client";

// Sub-Navigation des Aufgaben-Moduls (.. /tasks): eigene linke Sidebar mit
// Überschrift „AUFGABEN" und 8 Reitern. Aktiver Reiter grau hinterlegt (wie
// Objekt-Sub-Nav).
import { Icon } from "@iconify/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

const BASE = "/reservierungen/aufgaben";

const TAB_SLUGS = [
  "",
  "meine",
  "team",
  "inspektion",
  "vertretungen",
  "vorlagen",
  "planmaessig",
  "regelmaessig",
] as const;

const TAB_KEYS: Record<(typeof TAB_SLUGS)[number], string> = {
  "": "tabs.kalender",
  meine: "tabs.meine",
  team: "tabs.team",
  inspektion: "tabs.inspektion",
  vertretungen: "tabs.vertretungen",
  vorlagen: "tabs.vorlagen",
  planmaessig: "tabs.planmaessig",
  regelmaessig: "tabs.regelmaessig",
};

export function TasksSubnav() {
  const pathname = usePathname();
  const t = useTranslations("reservations");

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
        {t("tasksSubnav.pmModul")}
      </Link>
      <span className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t("tasksSubnav.heading")}
      </span>
      {TAB_SLUGS.map((slug) => {
        const active = isActive(slug);
        return (
          <Link
            key={slug || "kalender"}
            href={slug ? `${BASE}/${slug}` : BASE}
            className={`rounded-(--radius) px-3 py-2 text-sm transition-colors ${active
                ? "bg-secondary font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              }`}
          >
            {t(`tasksSubnav.${TAB_KEYS[slug]}`)}
          </Link>
        );
      })}
    </aside>
  );
}
