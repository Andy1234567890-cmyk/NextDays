"use client";

// Tab-Umschalter im Buchungsdetail-Kopf (Lodgify: „Buchung {ref}" ↔ „Zeitleiste"
// oben rechts). Zwei Reiter: Übersicht (die Detailseite) und Zeitleiste (der
// komplette Ereignis-Flow als eigene Seite).
import { Icon } from "@iconify/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS: { slug: string; title: string; icon: string }[] = [
  { slug: "", title: "Übersicht", icon: "ph:receipt" },
  { slug: "zeitleiste", title: "Zeitleiste", icon: "ph:clock-clockwise" },
];

export function BookingDetailTabs({ reservationId }: { reservationId: string }) {
  const pathname = usePathname();
  const base = `/reservierungen/${reservationId}`;

  return (
    <nav className="inline-flex items-center gap-1 rounded-full border bg-secondary/40 p-1">
      {TABS.map((t) => {
        const href = t.slug ? `${base}/${t.slug}` : base;
        const active = t.slug
          ? pathname === href
          : pathname === base || pathname === `${base}/`;
        return (
          <Link
            key={t.slug || "overview"}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon icon={t.icon} className="size-4" />
            {t.title}
          </Link>
        );
      })}
    </nav>
  );
}
