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
  // Am Objekt eingestellte Personenkapazität → Badge hinter dem Namen.
  maxGuests: number;
  // Dynamic Pricing für dieses Objekt aktiv → Blitz-Badge an der Zeile.
  dynamicEnabled?: boolean;
};

export function PropertyLabel({
  p,
  width,
  showPicture,
  showInternalName,
  showId,
  isHotel,
}: {
  p: LabelProp;
  width: number; // rem
  showPicture: boolean;
  showInternalName: boolean;
  showId: boolean;
  // Hotel: hinter dem Zimmer den Zimmertyp (EZ/DZ/Suite) zeigen, KEINE Stadt.
  // Ferienvermietung: wie bisher Adresse/Typ + Stadt (Ferienobjekte sind über
  // ihren Ort auffindbar, Hotelzimmer stehen alle am selben Ort → redundant).
  isHotel: boolean;
}) {
  return (
    <Link
      href={`/objekte/${p.id}`}
      className="sticky left-0 z-10 flex shrink-0 items-center gap-3 border-r bg-card px-3 py-2 hover:bg-muted"
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
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold">{p.title}</span>
            {/* Am Objekt eingestellte Personenkapazität (nicht die Belegung). */}
            <span
              title="Für dieses Objekt eingestellte Personenzahl"
              className="flex shrink-0 items-center gap-0.5 rounded-full bg-secondary px-1.5 py-0.5 text-[0.65rem] font-semibold text-muted-foreground tabular-nums"
            >
              <Icon icon="ph:user" className="size-2.5" />
              {p.maxGuests}
            </span>
            {p.dynamicEnabled && (
              <span
                title="Dynamic Pricing aktiv — die Tagespreise werden automatisch berechnet."
                className="flex shrink-0 items-center gap-0.5 rounded-full bg-accent/15 px-1.5 py-0.5 text-[0.6rem] font-semibold text-accent"
              >
                <Icon icon="ph:lightning-fill" className="size-2.5" />
                Dynamic
              </span>
            )}
          </span>
        )}
        <span className="truncate text-xs text-muted-foreground">
          {isHotel ? TYPE_LABELS[p.type] : p.address || TYPE_LABELS[p.type]}
        </span>
        {!isHotel && p.city && (
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
