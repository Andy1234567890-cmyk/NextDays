"use client";

// Linke Sub-Navigation der PM-Objektfläche (Lodgify „Unterkünfte" → Objekt):
// Objektkopf oben + die sechs Reiter Kalender / Statistiken / Bilder / Warnungen
// / Gastmodul / Gästemappe. Jeder Reiter führt per Klick auf die zugehörige
// Objekt-Unterseite. Vorlage: components/objekte/property-subnav.tsx.
import { Icon } from "@iconify/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { STATUS_LABELS } from "@/lib/property-meta";
import type { PropertyStatus } from "@/lib/properties";

const ITEMS: { slug: string; title: string; icon: string }[] = [
  { slug: "kalender", title: "Kalender", icon: "ph:calendar-blank" },
  { slug: "statistiken", title: "Statistiken", icon: "ph:chart-bar" },
  { slug: "bilder", title: "Bilder", icon: "ph:image" },
  { slug: "warnungen", title: "Warnungen", icon: "ph:warning" },
  { slug: "gastmodul", title: "Gastmodul", icon: "ph:identification-card" },
  { slug: "gaestemappe", title: "Gästemappe", icon: "ph:book-open" },
];

export function PropertyPmSubnav({
  id,
  title,
  photo,
  status,
}: {
  id: string;
  title: string;
  photo: string | null;
  status: PropertyStatus;
}) {
  const pathname = usePathname();
  const base = `/reservierungen/unterkuenfte/${id}`;

  return (
    <aside className="flex flex-col gap-4">
      {/* Objektkopf */}
      <div className="flex items-center gap-3 rounded-(--radius) border p-2.5">
        <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-(--radius) bg-secondary">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className="size-full object-cover" />
          ) : (
            <Icon icon="ph:house-line" className="size-5 text-muted-foreground" />
          )}
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold">{title}</span>
          <span className="text-xs text-muted-foreground">
            {STATUS_LABELS[status]}
          </span>
        </div>
      </div>

      {/* Reiter */}
      <nav className="flex flex-col gap-1">
        {ITEMS.map((it) => {
          const href = `${base}/${it.slug}`;
          const active = pathname === href;
          return (
            <Link
              key={it.slug}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2.5 rounded-(--radius) px-3 py-2 text-sm ${
                active
                  ? "bg-secondary font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              }`}
            >
              <Icon icon={it.icon} className="size-4 shrink-0" />
              <span className="truncate">{it.title}</span>
            </Link>
          );
        })}
      </nav>

      {/* Zurück zur Objektliste */}
      <Link
        href="/reservierungen/unterkuenfte"
        className="flex items-center gap-1.5 px-3 text-xs text-muted-foreground hover:text-foreground hover:underline"
      >
        <Icon icon="ph:arrow-left" className="size-3.5" />
        Alle Unterkünfte
      </Link>
    </aside>
  );
}
