// Objekte-Übersicht (Rentals): Liste aller Objekte des Tenants.
// Server Component — lädt über die Server-Action, rendert Karten + Anlage-Button.
import Link from "next/link";

import { NewPropertyButton } from "@/components/objekte/new-property-button";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { Card } from "@/components/ui/card";
import { Icon } from "@iconify/react";
import { getMe } from "@/lib/auth";
import { STATUS_LABELS, TYPE_LABELS } from "@/lib/property-meta";
import { listProperties } from "@/lib/properties";

export default async function ObjektePage() {
  // Betriebsart mitladen: Hotel spricht von „Zimmern" und bekommt die
  // Zimmertypen-Liste in der Anlage (0090/0098).
  const [res, me] = await Promise.all([listProperties(), getMe()]);
  const accommodationType = me?.accommodation_type ?? null;
  const isHotel = accommodationType === "hotel";

  return (
    <div className="flex flex-col gap-6">
      <RealtimeRefresh tables={["properties"]} />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-extrabold">
            {isHotel ? "Zimmer" : "Objekte"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isHotel ? "Verwalte deine Zimmer." : "Verwalte deine Unterkünfte."}
          </p>
        </div>
        <NewPropertyButton accommodationType={accommodationType} />
      </div>

      {!res.ok ? (
        <Card className="p-5 text-sm text-destructive">
          Objekte konnten nicht geladen werden. Ist das Backend erreichbar?
        </Card>
      ) : res.data.items.length === 0 ? (
        <EmptyState accommodationType={accommodationType} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {res.data.items.map((p) => (
            <Link key={p.id} href={`/objekte/${p.id}`}>
              <Card className="overflow-hidden transition-shadow hover:shadow-md">
                {/* Titelbild oder Platzhalter */}
                <div className="relative flex h-40 items-center justify-center bg-secondary">
                  {p.photos[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.photos[0]}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Icon
                      icon="ph:house-line"
                      className="size-10 text-muted-foreground"
                    />
                  )}
                  <span className="absolute right-2 top-2 rounded-full bg-background/90 px-2 py-0.5 text-xs font-medium">
                    {STATUS_LABELS[p.status]}
                  </span>
                </div>
                <div className="flex flex-col gap-1 p-4">
                  <span className="truncate font-semibold">{p.title}</span>
                  <span className="text-sm text-muted-foreground">
                    {TYPE_LABELS[p.property_type]} · {p.max_guests} Gäste
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {[p.postal_code, p.city].filter(Boolean).join(" ") || "—"}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({
  accommodationType,
}: {
  accommodationType: "vacation_rental" | "hotel" | null;
}) {
  const isHotel = accommodationType === "hotel";
  return (
    <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-secondary">
        <Icon
          icon={isHotel ? "ph:bed" : "ph:house-line"}
          className="size-7 text-muted-foreground"
        />
      </span>
      <div>
        <p className="font-display text-lg font-extrabold">
          {isHotel ? "Noch keine Zimmer" : "Noch keine Objekte"}
        </p>
        <p className="text-sm text-muted-foreground">
          {isHotel
            ? "Lege dein erstes Zimmer an, um loszulegen."
            : "Lege dein erstes Objekt an, um loszulegen."}
        </p>
      </div>
      <NewPropertyButton accommodationType={accommodationType} />
    </Card>
  );
}
