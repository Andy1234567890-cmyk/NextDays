"use client";

// Untermenü der Objekt-Detailseite: Objekt-Wähler oben +
// zwei Gruppen „Objektdetails" und „Reservierung". Aktiver Punkt hervorgehoben.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";

import { usePropertyLabels } from "@/lib/use-property-labels";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { PropertySwitcher } from "@/components/objekte/property-switcher";

import type { PropertyStatus } from "@/lib/properties";

type SubnavItem = {
  slug: string;
  titleKey: string;
  icon: string;
  /** Capability, ohne die dieser Punkt gar nicht erst verlinkt wird. Ohne
   *  Angabe ist der Punkt fuer jeden sichtbar, der das Objekt sehen darf. */
  capability?: string;
};

const GROUPS: { labelKey: string; items: SubnavItem[] }[] = [
  {
    labelKey: "groupObjectDetails",
    items: [
      { slug: "", titleKey: "itemOverview", icon: "ph:house" },
      { slug: "fotos", titleKey: "itemPhotos", icon: "ph:image" },
      { slug: "standort", titleKey: "itemLocation", icon: "ph:map-pin" },
      { slug: "kontakt", titleKey: "itemContact", icon: "ph:address-book" },
      {
        slug: "kartei",
        titleKey: "itemFile",
        icon: "ph:clipboard-text",
        // Die Objektkartei verlangt seit einem frischen Fix MANAGE_PROPERTIES
        // (frueher VIEW_CALENDAR — das trug auch die owner-Rolle, die die
        // Tuercodes und Zugangsdaten darin nicht sehen darf). Ohne dieses Gate
        // fuehrte der Menuepunkt fuer staff/cleaner/owner sichtbar ins Leere:
        // Klick → 403-Fehlerkasten. Ein Link, den der Server ohnehin abweist,
        // wird gar nicht erst gezeigt.
        capability: "manage_properties",
      },
      { slug: "nachrichten", titleKey: "itemMessagesPlaceholder", icon: "ph:chat-text" },
      { slug: "compliance", titleKey: "itemCompliance", icon: "ph:seal-check" },
    ],
  },
  {
    labelKey: "groupReservation",
    items: [
      { slug: "preise", titleKey: "itemPrices", icon: "ph:tag" },
      { slug: "zusatzleistungen", titleKey: "itemAddons", icon: "ph:plus-circle" },
      { slug: "verfuegbarkeit", titleKey: "itemAvailability", icon: "ph:calendar-blank" },
      { slug: "kanaele", titleKey: "itemChannels", icon: "ph:broadcast" },
      { slug: "richtlinien", titleKey: "itemPolicies", icon: "ph:file-text" },
      { slug: "saisonpreise", titleKey: "itemSeasonalPrices", icon: "ph:sun" },
    ],
  },
  {
    // Eigene Gruppe wie bei Lodgify: die technische Zuordnung zu den Portalen
    // ist etwas anderes als die Sichtbarkeit im Tab „Kanäle".
    labelKey: "groupChannels",
    items: [
      { slug: "synchronisierung", titleKey: "itemSync", icon: "ph:arrows-clockwise" },
    ],
  },
];

type SwitcherEintrag = {
  id: string;
  title: string;
  photo: string | null;
  status: PropertyStatus;
};

export function PropertySubnav({
  id,
  title,
  photo,
  status,
  properties,
  addresses,
  capabilities,
}: {
  id: string;
  title: string;
  photo: string | null;
  status: PropertyStatus;
  // Faehigkeiten des angemeldeten Nutzers. Punkte mit `capability` erscheinen
  // nur, wenn sie darin stehen. Fehlt die Liste (getMe nicht ladbar), bleiben
  // gesicherte Punkte AUS — fail-closed (Wurzel 6): lieber ein Punkt zu wenig
  // als einer, der in einen 403 fuehrt.
  capabilities?: readonly string[];
  // Alle Objekte des Betriebs für den Umschalter. Leer/fehlend = der Kopf
  // bleibt eine reine Anzeige (z. B. wenn die Liste nicht geladen werden
  // konnte) — statt einen Umschalter zu zeigen, der nichts zu wechseln hat.
  properties?: SwitcherEintrag[];
  addresses?: Record<string, string>;
}) {
  const t = useTranslations("objects");
  const { statusLabel } = usePropertyLabels();
  const pathname = usePathname();
  const base = `/objekte/${id}`;

  const isActive = (slug: string) => {
    const href = slug ? `${base}/${slug}` : base;
    return pathname === href;
  };

  return (
    <aside className="flex flex-col gap-4">
      {/* Objekt-Wähler: mit mehr als einem Objekt ein echter Umschalter, der
          den aktuellen Unterpunkt beibehält. Mit nur einem Objekt gibt es
          nichts zu wechseln — dann bleibt es die reine Anzeige. */}
      {properties && properties.length > 1 ? (
        <PropertySwitcher
          current={{ id, title, photo, status }}
          properties={properties}
          addresses={addresses ?? {}}
        />
      ) : (
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
      )}

      {/* Gruppen */}
      {GROUPS.map((g) => (
        <div key={g.labelKey} className="flex flex-col gap-1">
          <span className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t(`propertySubnav.${g.labelKey}`)}
          </span>
          {g.items
            .filter(
              (it) => !it.capability || (capabilities ?? []).includes(it.capability),
            )
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
