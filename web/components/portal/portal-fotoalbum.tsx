"use client";

// Eigentümer-Portal · Fotoalbum (pm_photo_album, read-only).
//
// WARUM EINE EIGENE ANSICHT UND NICHT `components/media/…` bzw.
// `components/objekte/photos-manager.tsx`: die Mediathek des Betriebs verwaltet
// Dateien (Hochladen, Umbenennen, Löschen) und zeigt den Bestand ALLER Objekte
// des Mandanten. Beides ist hier falsch — der Eigentümer schreibt nichts
// (Wurzel 3) und sieht nur seine zugeordneten Objekte. Das Raster samt Lightbox
// teilt sich diese Fläche mit dem Objektbereich
// (`components/portal/portal-bilder-raster.tsx`).
//
// Die GRUPPIERUNG je Objekt kommt vom Server; die UI ordnet kein Bild selbst
// einem Objekt zu.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { PortalBilderRaster } from "@/components/portal/portal-bilder-raster";
import { PortalRealtime } from "@/components/portal/portal-realtime";
import { Card, CardContent } from "@nextdays/ui/card";
import type { PortalAlbumGroup } from "@/lib/portal";

export function PortalFotoalbum({
  groups,
  error,
}: {
  groups: PortalAlbumGroup[];
  /** „konnte nicht laden" ≠ „keine Bilder" (Wurzel 4/5). */
  error: string | null;
}) {
  const t = useTranslations("portal");
  const router = useRouter();
  const aktualisieren = useCallback(() => router.refresh(), [router]);

  const gefuellt = groups.filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col gap-6">
      {/* `properties` ist die einzige geprüfte Realtime-Quelle dieser Fläche.
          `property_photos` wird BEWUSST nicht abonniert: die Tabelle steht
          nicht in der geprüften Quellenliste (portal-realtime.tsx), ein Abo
          darauf wäre eine stumme Attrappe (Wurzel 5). */}
      <PortalRealtime quellen={["properties"]} onChange={aktualisieren} />

      <header className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-extrabold">
          {t("photoAlbum.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("photoAlbum.subtitle")}
        </p>
      </header>

      {error ? (
        <div className="rounded-(--radius) border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : gefuellt.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
              <Icon icon="ph:images" className="size-6" />
            </span>
            <p className="text-sm text-muted-foreground">
              {t("photoAlbum.empty")}
            </p>
          </CardContent>
        </Card>
      ) : (
        gefuellt.map((gruppe) => (
          <section key={gruppe.property_id} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="font-display text-xl font-extrabold">
                {gruppe.title}
              </h2>
              {gruppe.city && (
                <span className="text-sm text-muted-foreground">
                  {gruppe.city}
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                {/* Die Zahl kommt vom Server (`total` der Gruppe), nicht aus
                    `items.length`: die Oberfläche zählt die Bilder nicht selbst
                    nach — sonst gäbe es zwei Wahrheiten, sobald der Server
                    einmal begrenzt liefert. */}
                {t("photoAlbum.imageCount", { count: gruppe.total })}
              </span>
            </div>
            <PortalBilderRaster bilder={gruppe.items} titel={gruppe.title} />
          </section>
        ))
      )}
    </div>
  );
}
