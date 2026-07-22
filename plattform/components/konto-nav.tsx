// Seitennavigation der geschützten Gast-Bereiche (Konto, Buchungen, Nachrichten,
// Merkzettel, Bewertungen). Markiert den aktiven Bereich anhand des Pfads und
// zeigt ein Unread-Badge bei Nachrichten (Zahl kommt serverseitig als Prop).
"use client";

import { Icon } from "@iconify/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/konto", icon: "ph:squares-four", label: "Übersicht" },
  { href: "/buchungen", icon: "ph:calendar-check", label: "Meine Buchungen" },
  { href: "/nachrichten", icon: "ph:chat-circle", label: "Nachrichten" },
  { href: "/merkzettel", icon: "ph:heart", label: "Merkzettel" },
  { href: "/bewertungen", icon: "ph:star", label: "Bewertungen" },
];

export function KontoNav({ unread = 0 }: { unread?: number }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
      {LINKS.map((l) => {
        const aktiv = pathname === l.href || pathname.startsWith(`${l.href}/`);
        const zeigeBadge = l.href === "/nachrichten" && unread > 0;
        return (
          <Link
            key={l.href}
            href={l.href}
            className={
              "flex shrink-0 items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition-colors " +
              (aktiv
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground")
            }
          >
            <span className="relative flex">
              <Icon icon={l.icon} className="size-5" />
            </span>
            <span className="flex-1">{l.label}</span>
            {zeigeBadge && (
              <span
                className={
                  "flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[0.65rem] font-bold " +
                  (aktiv
                    ? "bg-primary-foreground text-primary"
                    : "bg-accent text-accent-foreground")
                }
              >
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
