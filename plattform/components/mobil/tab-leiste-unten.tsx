// Fixe untere Tab-Leiste (nur < md). Der Marktplatz hatte mobil KEINE
// Navigation: die Kategorie-Tabs sind `hidden md:block`, „für Gastgeber" ist
// `hidden sm:block`, und der einzige Weg in Buchungen/Nachrichten/Merkzettel
// war das Konto-Dropdown in der Kopfzeile.
//
// Angemeldet fünf Ziele, abgemeldet drei (Suchen · Merkzettel · Anmelden) —
// dieselbe Staffelung wie beim Vorbild. Die Rolle entscheidet der Server
// (`tab-leiste-mobil.tsx`), nicht der Client: eine clientseitig geratene
// Anmeldung zeigt sonst Ziele, die dann auf /anmelden umleiten.
"use client";

import { Icon } from "@iconify/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

type Ziel = { href: string; icon: string; key: string; badge?: number };

export function TabLeisteUnten({
  eingeloggt,
  unread = 0,
}: {
  eingeloggt: boolean;
  unread?: number;
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  const ziele: Ziel[] = eingeloggt
    ? [
        { href: "/", icon: "ph:magnifying-glass", key: "suchen" },
        { href: "/merkzettel", icon: "ph:heart", key: "merkzettel" },
        { href: "/buchungen", icon: "ph:calendar-check", key: "buchungen" },
        {
          href: "/nachrichten",
          icon: "ph:chat-circle",
          key: "nachrichten",
          badge: unread,
        },
        { href: "/konto", icon: "ph:user-circle", key: "konto" },
      ]
    : [
        { href: "/", icon: "ph:magnifying-glass", key: "suchen" },
        { href: "/merkzettel", icon: "ph:heart", key: "merkzettel" },
        { href: "/anmelden", icon: "ph:user-circle", key: "anmelden" },
      ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background md:hidden"
      style={{ paddingBottom: "var(--safe-b)" }}
      aria-label={t("suchen")}
    >
      <ul className="flex items-stretch">
        {ziele.map((z) => {
          const aktiv =
            z.href === "/"
              ? pathname === "/"
              : pathname === z.href || pathname.startsWith(`${z.href}/`);
          return (
            <li key={z.href} className="flex-1">
              <Link
                href={z.href}
                aria-current={aktiv ? "page" : undefined}
                className={
                  "relative flex h-16 flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium transition-colors " +
                  (aktiv
                    ? "text-accent"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                <span className="relative flex">
                  <Icon icon={z.icon} className="size-6" />
                  {z.badge && z.badge > 0 ? (
                    <span className="absolute -right-2 -top-1 flex min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[0.5625rem] font-bold text-accent-foreground">
                      {z.badge > 9 ? "9+" : z.badge}
                    </span>
                  ) : null}
                </span>
                {t(z.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
