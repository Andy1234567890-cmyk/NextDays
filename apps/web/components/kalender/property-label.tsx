"use client";

// Objektspalte des Kalenders (links). Bleibt beim horizontalen Scrollen
// FIXIERT vorne sichtbar (sticky left-0). Zeigt je nach Ansicht-Optionen
// Foto, internen Namen, Adresse, Stadt und ID. Eigenständiges Element.
import { Icon } from "@iconify/react";
import Link from "next/link";

import { TYPE_LABELS } from "@/lib/property-meta";
import type { PropertyType } from "@/lib/properties";

export type LabelProp = {
  id: string;
  title: string;
  type: PropertyType;
  photo: string | null;
  address: string;
  city: string;
};

export function PropertyLabel({
  p,
  width,
  showPicture,
  showInternalName,
  showId,
}: {
  p: LabelProp;
  width: number; // rem
  showPicture: boolean;
  showInternalName: boolean;
  showId: boolean;
}) {
  return (
    <Link
      href={`/objekte/${p.id}`}
      className="sticky left-0 z-10 flex shrink-0 items-center gap-3 border-r bg-card px-3 py-3 hover:bg-muted/50"
      style={{ width: `${width}rem` }}
    >
      {showPicture && (
        <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-(--radius) bg-secondary">
          {p.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.photo} alt="" className="size-full object-cover" />
          ) : (
            <Icon icon="ph:house-line" className="size-5 text-muted-foreground" />
          )}
        </span>
      )}
      <div className="flex min-w-0 flex-col leading-tight">
        {showInternalName && (
          <span className="truncate text-sm font-semibold">{p.title}</span>
        )}
        <span className="truncate text-xs text-muted-foreground">
          {p.address || TYPE_LABELS[p.type]}
        </span>
        {p.city && (
          <span className="truncate text-xs text-muted-foreground">{p.city}</span>
        )}
        {showId && (
          <span className="truncate text-[0.65rem] text-muted-foreground/70">
            ID {p.id.slice(0, 8)}
          </span>
        )}
      </div>
    </Link>
  );
}
