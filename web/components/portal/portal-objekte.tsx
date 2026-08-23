"use client";

// Eigentümer-Portal · Objektbereich, Liste (pm_property_area, read-only).
//
// WARUM EINE EIGENE ANSICHT UND NICHT `components/objekte/objects-list.tsx`:
// Die PM-Liste ist eine Arbeitsfläche des Betriebs. Sie trägt Anlegen,
// Duplizieren, Löschen, Veröffentlichen und den Sprung in den Objekt-Editor mit
// sich — Schreiben also nicht als Beiwerk, sondern als Zweck. Diese Knöpfe
// auszublenden wäre kein Schutz (Wurzel 3): das Formular bliebe im Bundle, die
// Server-Actions blieben aufrufbar, und die nächste Erweiterung der PM-Liste
// landete ungefragt im Eigentümer-Portal. Sie zeigt außerdem Kanal- und
// Vertriebszustand (§4.3, geht den Eigentümer nichts an). Deshalb hier eine
// eigene, lesende Kachelliste, die NUR Titel, Ort und Bild rendert.
//
// Verlinkt wird ausschließlich nach `/portal/objekte/[id]` — kein Tiefen-Link
// in eine `(app)`-Route.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { PortalRealtime } from "@/components/portal/portal-realtime";
import { Card, CardContent } from "@nextdays/ui/card";
import type { PortalProperty } from "@/lib/portal";

export function PortalObjekte({
  properties,
  error,
}: {
  properties: PortalProperty[];
  /** „konnte nicht laden" ist NICHT „keine Objekte" (Wurzel 4/5): der Fehler
   *  bekommt eine eigene Fläche und verdrängt den Leer-Hinweis. */
  error: string | null;
}) {
  const t = useTranslations("portal");
  const router = useRouter();
  const aktualisieren = useCallback(() => router.refresh(), [router]);

  return (
    <div className="flex flex-col gap-6">
      {/* Titel, Ort und Bild kommen aus `properties` — die einzige Tabelle, die
          diese Fläche speist und die als Realtime-Quelle geprüft ist. */}
      <PortalRealtime quellen={["properties"]} onChange={aktualisieren} />

      <header className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-extrabold">
          {t("propertyArea.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("propertyArea.subtitle")}
        </p>
      </header>

      {error ? (
        <div className="rounded-(--radius) border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : properties.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
              <Icon icon="ph:house-line" className="size-6" />
            </span>
            <p className="text-sm text-muted-foreground">
              {t("propertyArea.empty")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {properties.map((p) => (
            <li key={p.id}>
              <Link
                href={`/portal/objekte/${encodeURIComponent(p.id)}`}
                className="block h-full rounded-(--radius) transition-colors hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Card className="h-full overflow-hidden">
                  {/* Objektfoto: <img>, weil die URL aus dem Storage kommt und
                      keine feste Domänenliste hat (wie in der Übersicht). */}
                  {p.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.photo}
                      alt=""
                      className="h-36 w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-36 w-full items-center justify-center bg-secondary text-muted-foreground">
                      <Icon icon="ph:house-line" className="size-8" />
                    </span>
                  )}
                  <CardContent className="flex flex-col gap-1 py-4">
                    <span className="truncate text-sm font-medium">
                      {p.title}
                    </span>
                    {p.city && (
                      <span className="truncate text-xs text-muted-foreground">
                        {p.city}
                      </span>
                    )}
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
