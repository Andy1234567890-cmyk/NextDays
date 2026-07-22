"use client";

// Objekte-Übersicht des Gastgebers (Karten-Grid). Realtime auf properties →
// Änderungen (Publish, Status, neues Objekt) erscheinen ohne Reload. Schlanker
// Host-Stil, keine Agentur-Filterleiste.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Card } from "@nextdays/ui/card";

import type { Property, PropertyStatus } from "@/lib/properties";
import { useRealtime } from "@/lib/use-realtime";

const STATUS_STYLE: Record<PropertyStatus, string> = {
  active: "bg-emerald-100 text-emerald-800",
  draft: "bg-amber-100 text-amber-800",
  inactive: "bg-neutral-200 text-neutral-700",
};

export function ObjekteListe({ items }: { items: Property[] }) {
  const t = useTranslations("objekte");
  const router = useRouter();

  // Realtime: jede properties-Änderung des Tenants → Server-Reload (frische,
  // gescopte Liste). Muster wie web (kein Polling).
  useRealtime({ table: "properties", onChange: () => router.refresh() });

  if (items.length === 0) {
    return (
      <Card className="p-10 text-center">
        <p className="text-sm text-muted-foreground">{t("leer")}</p>
        <Link
          href="/objekt-einstellen"
          className="mt-4 inline-flex rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background"
        >
          {t("neu")}
        </Link>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((p) => (
        <Link key={p.id} href={`/objekte/${p.id}`}>
          <Card className="overflow-hidden transition-shadow hover:shadow-md">
            <div className="relative aspect-[4/3] bg-muted">
              {p.photos[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.photos[0]}
                  alt={p.title}
                  className="h-full w-full object-cover"
                  // Tote Foto-URL → Bild ausblenden, Platzhalter-Hintergrund bleibt.
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <Icon icon="solar:gallery-bold-duotone" className="size-10" />
                </div>
              )}
            </div>
            <div className="p-4">
              <div className="mb-1 flex items-center justify-between gap-2">
                <h3 className="truncate font-medium">{p.title}</h3>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[p.status]}`}
                >
                  {t(`status.${p.status}`)}
                </span>
              </div>
              <p className="truncate text-sm text-muted-foreground">
                {[p.city, p.country].filter(Boolean).join(", ") || "—"}
              </p>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
