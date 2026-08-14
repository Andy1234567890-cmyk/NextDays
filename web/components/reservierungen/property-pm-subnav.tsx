"use client";

// Linke Sub-Navigation der PM-Objektfläche (.. „Unterkünfte" → Objekt):
// Objektkopf oben + die sechs Reiter Kalender / Statistiken / Bilder / Warnungen
// / Gastmodul / Gästemappe. Jeder Reiter führt per Klick auf die zugehörige
// Objekt-Unterseite. Vorlage: components/objekte/property-subnav.tsx.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";

import { usePropertyLabels } from "@/lib/use-property-labels";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { PropertyStatus } from "@/lib/properties";

const ITEMS: { slug: string; titleKey: string; icon: string }[] = [
  { slug: "kalender", titleKey: "tabs.calendar", icon: "ph:calendar-blank" },
  { slug: "statistiken", titleKey: "tabs.statistics", icon: "ph:chart-bar" },
  { slug: "bilder", titleKey: "tabs.photos", icon: "ph:image" },
  { slug: "warnungen", titleKey: "tabs.warnings", icon: "ph:warning" },
  // „Gastmodul" entfiel am 14.08.2026: Kontakt, WLAN, Self-Check-in und Türcode
  // stehen jetzt in der Objektkartei, Stufe „Zugang & Technik"
  // (/objekte/[id]/kartei). Sie lagen vorher in einem anderen Hauptmenü als der
  // Türzugangs-Text (/objekte/[id]/nachrichten) — wer den dort pflegte, ahnte
  // nicht, dass `{{door_code}}`/`{{wifi_ssid}}` woanders wohnen, und Vorlagen
  // mit diesen Platzhaltern wurden nie gesendet.
  { slug: "gaestemappe", titleKey: "tabs.guestGuide", icon: "ph:book-open" },
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
  const t = useTranslations("reservations");
  const { statusLabel } = usePropertyLabels();
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
            {statusLabel(status)}
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
              className={`flex items-center gap-2.5 rounded-(--radius) px-3 py-2 text-sm ${active
                  ? "bg-secondary font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`}
            >
              <Icon icon={it.icon} className="size-4 shrink-0" />
              <span className="truncate">{t(`propertyPmSubnav.${it.titleKey}`)}</span>
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
        {t("propertyPmSubnav.allProperties")}
      </Link>
    </aside>
  );
}
