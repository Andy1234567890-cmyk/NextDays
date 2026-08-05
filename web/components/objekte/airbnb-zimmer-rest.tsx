"use client";

// Was nach dem Minus bei Airbnb ÜBRIG bleibt — und der Weg, es dort loszuwerden.
//
// WARUM ES DAS GIBT: Airbnb hat keinen Löschweg für Räume. Gemessen am
// 05.08.2026 in sechzehn Formen, über Channex UND direkt gegen api.airbnb.com:
// `v2/listing_rooms` kennt ausschliesslich GET und POST, jede andere Methode
// und jeder andere Pfad antwortet `route_not_found`. Der Raum-Datensatz hat
// ausserdem kein Status-Feld, über das man ihn abschalten könnte (nur id,
// listing_id, room_type, is_private, beds, accessibility_features).
//
// Bei uns löscht das Minus also sofort — bei Airbnb bleibt das Zimmer stehen.
// Genau DAS steht hier, konkret mit Namen statt als pauschaler Warnsatz, plus
// Direktlink in die Fototour. Booking.com kennt das Konzept nicht.

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { ChannelLogo } from "@/components/channel-logo";
import {
  type AirbnbRestZimmer,
  type AirbnbZimmerRest,
  getAirbnbZimmerRest,
} from "@/lib/airbnb-zimmer";
import type { PropertyRoom } from "@/lib/properties";

/** Der Zimmername: unser übersetzter Slug, sonst Airbnbs Rohwert. */
function zimmerName(
  rest: AirbnbRestZimmer,
  tz: (key: string) => string,
  tzHas: (key: string) => boolean,
): string {
  if (rest.slug && tzHas(rest.slug)) return tz(rest.slug);
  return rest.airbnb_art.replace(/_/g, " ");
}

export function AirbnbZimmerRestHinweis({
  propertyId,
  zimmer,
}: {
  propertyId: string;
  /** Löst das Nachladen aus: nach jedem Plus/Minus ändert sich diese Liste. */
  zimmer: PropertyRoom[];
}) {
  const t = useTranslations("objects.airbnbZimmer");
  const tz = useTranslations("zimmer");
  const [stand, setStand] = useState<AirbnbZimmerRest | null>(null);
  const anzahl = zimmer.length;

  const laden = useCallback(async () => {
    const res = await getAirbnbZimmerRest(propertyId);
    if (res.ok) setStand(res.data);
    // Ein Fehler bleibt still: der Hinweis ist Zusatzinformation und darf den
    // Zimmer-Editor nicht mit einer Fehlerbox zustellen.
  }, [propertyId]);

  useEffect(() => {
    // `anzahl` in den Abhängigkeiten: nach jedem Plus/Minus neu fragen, sonst
    // zeigt der Hinweis den Stand von vor der Änderung.
    void laden();
  }, [laden, anzahl]);

  // Nicht verbunden oder Stand unbekannt → nichts behaupten (Wurzel 4).
  if (!stand?.verbunden || !stand.stand_bekannt) return null;

  if (stand.rest.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-(--radius) bg-secondary px-3 py-2 text-xs text-muted-foreground">
        <ChannelLogo source="airbnb" className="size-4 shrink-0" />
        {t("gleichstand")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-(--radius) border border-destructive/40 bg-destructive/5 p-3">
      <p className="flex items-start gap-2 text-xs">
        <ChannelLogo source="airbnb" className="mt-0.5 size-4 shrink-0" />
        <span>
          {t("restHinweis", {
            zimmer: stand.rest
              .map((r) => zimmerName(r, tz, tz.has))
              .join(", "),
          })}
        </span>
      </p>
      {stand.extranet_url ? (
        <a
          href={stand.extranet_url}
          target="_blank"
          rel="noreferrer noopener"
          className="flex items-center gap-1.5 self-start text-xs font-medium underline underline-offset-2"
        >
          {t("beiAirbnbEntfernen")}
          <Icon icon="ph:arrow-square-out" className="size-3.5" />
        </a>
      ) : null}
    </div>
  );
}
