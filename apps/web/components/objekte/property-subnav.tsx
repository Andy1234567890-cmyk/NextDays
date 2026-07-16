"use client";

// Untermenü der Objekt-Detailseite: Objekt-Wähler oben +
// zwei Gruppen „Objektdetails" und „Reservierung". Aktiver Punkt hervorgehoben.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { STATUS_LABELS } from "@/lib/property-meta";
import type { PropertyStatus } from "@/lib/properties";

type SubnavItem = { slug: string; titleKey: string; icon: string; hotelOnly?: boolean };

const GROUPS: { labelKey: string; items: SubnavItem[] }[] = [
  {
    labelKey: "groupObjectDetails",
    items: [
      { slug: "", titleKey: "itemOverview", icon: "ph:house" },
      { slug: "fotos", titleKey: "itemPhotos", icon: "ph:image" },
      { slug: "standort", titleKey: "itemLocation", icon: "ph:map-pin" },
      { slug: "kontakt", titleKey: "itemContact", icon: "ph:address-book" },
      { slug: "kartei", titleKey: "itemFile", icon: "ph:clipboard-text" },
      { slug: "nachrichten", titleKey: "itemMessagesPlaceholder", icon: "ph:chat-text" },
      { slug: "compliance", titleKey: "itemCompliance", icon: "ph:seal-check" },
    ],
  },
  {
    labelKey: "groupReservation",
    items: [
      // Nur im Hotel-Modus: Zimmerkategorien (room_types) + je Kategorie eigene
      // Rate-Plans. currency-neutrales Icon (kein €-Symbol — Hotel kann USD sein).
      { slug: "zimmerkategorien", titleKey: "itemRoomCategories", icon: "ph:bed", hotelOnly: true },
      { slug: "preise", titleKey: "itemPrices", icon: "ph:tag" },
      { slug: "zusatzleistungen", titleKey: "itemAddons", icon: "ph:plus-circle" },
      { slug: "verfuegbarkeit", titleKey: "itemAvailability", icon: "ph:calendar-blank" },
      { slug: "richtlinien", titleKey: "itemPolicies", icon: "ph:file-text" },
      { slug: "saisonpreise", titleKey: "itemSeasonalPrices", icon: "ph:sun" },
    ],
  },
];

export function PropertySubnav({
  id,
  title,
  photo,
  status,
  isHotel = false,
}: {
  id: string;
  title: string;
  photo: string | null;
  status: PropertyStatus;
  isHotel?: boolean;
}) {
  const t = useTranslations("objects");
  const pathname = usePathname();
  const base = `/objekte/${id}`;

  const isActive = (slug: string) => {
    const href = slug ? `${base}/${slug}` : base;
    return pathname === href;
  };

  return (
    <aside className="flex flex-col gap-4">
      {/* Objekt-Wähler-Kopf */}
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

      {/* Gruppen */}
      {GROUPS.map((g) => (
        <div key={g.labelKey} className="flex flex-col gap-1">
          <span className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t(`propertySubnav.${g.labelKey}`)}
          </span>
          {g.items
            .filter((it) => !it.hotelOnly || isHotel)
            .map((it) => {
            const href = it.slug ? `${base}/${it.slug}` : base;
            const active = isActive(it.slug);
            return (
              <Link
                key={it.slug || "overview"}
                href={href}
                className={`flex items-center gap-2.5 rounded-(--radius) px-3 py-2 text-sm ${active
                    ? "bg-secondary font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  }`}
              >
                <Icon icon={it.icon} className="size-4 shrink-0" />
                <span className="truncate">{t(`propertySubnav.${it.titleKey}`)}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </aside>
  );
}
