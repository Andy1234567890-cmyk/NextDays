"use client";

// Airbnb-Zuordnung Foto ↔ Zimmer, als Zusatz im „…"-Menü jeder Foto-Karte.
//
// WARUM ES DAS NUR HIER GIBT: Airbnb zeigt Gästen die „Photo tour" NUR, wenn
// jedes Zimmer ein Foto hat — fehlt eines, ist die ganze Tour weg. Booking.com
// kennt dieses Konzept nicht, und der Booking-Connect kommt noch. Deshalb hängt
// die Auswahl am Airbnb-Logo und erscheint ausschliesslich bei Objekten, die
// dort haengen.
//
// KEINE eigene Tabelle/Sektion auf der Seite: die Zuordnung gehoert an das Foto,
// nicht in eine zweite Liste derselben Fotos.

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { ChannelLogo } from "@/components/channel-logo";
import {
  type AirbnbFotoRaeume,
  type AirbnbRaum,
  getAirbnbFotoRaeume,
  setAirbnbFotoRaum,
} from "@/lib/airbnb-fotos";
import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@nextdays/ui/dropdown-menu";

/** Der Raum-Name: unser uebersetzter Slug, sonst Airbnbs Rohwert. */
function raumName(
  raum: AirbnbRaum,
  tz: (key: string) => string,
  tzHas: (key: string) => boolean,
): string {
  if (raum.slug && tzHas(raum.slug)) return tz(raum.slug);
  // Kein Slug (z. B. `exterior`, `garden`): Airbnbs Rohwert lesbar machen,
  // statt den Raum namenlos zu lassen — er zaehlt fuer die Fototour trotzdem.
  return raum.airbnb_art.replace(/_/g, " ");
}

export type AirbnbFotoStand = {
  /** Raum-ID je eigener Foto-ID; fehlt der Eintrag, kennt Airbnb das Foto nicht. */
  raumJeFoto: Map<string, string | null>;
  raeume: AirbnbRaum[];
  /** `null` löst das Foto vom Zimmer (das Foto selbst bleibt bestehen). */
  umhaengen: (photoId: string, roomId: string | null) => Promise<void>;
};

/** Laedt den Airbnb-Stand einmal fuer die ganze Seite. null = kein Airbnb. */
export function useAirbnbFotoRaeume(propertyId: string): AirbnbFotoStand | null {
  const t = useTranslations("objects.airbnbFotos");
  const [stand, setStand] = useState<AirbnbFotoRaeume | null>(null);

  const laden = useCallback(async () => {
    const res = await getAirbnbFotoRaeume(propertyId);
    if (res.ok) setStand(res.data);
    // Ein Fehler bleibt still: die Zuordnung ist Zusatzinformation, sie darf die
    // Fotos-Seite nicht mit einer Fehlerbox zustellen. Der Nutzer sieht dann
    // schlicht keinen Airbnb-Eintrag im Menue.
  }, [propertyId]);

  useEffect(() => {
    void laden();
  }, [laden]);

  const umhaengen = useCallback(
    async (photoId: string, roomId: string | null) => {
      const res = await setAirbnbFotoRaum(propertyId, photoId, roomId);
      if (res.ok) {
        toast.success(roomId ? t("umgehaengt") : t("geloest"));
        void laden();
      } else {
        toast.error(res.error);
      }
    },
    [propertyId, laden, t],
  );

  // `stand_bekannt: false` heisst „Airbnb war nicht lesbar" — dann KEINE
  // Auswahl anbieten, sonst schriebe der Nutzer gegen einen unbekannten Stand.
  if (!stand?.verbunden || !stand.stand_bekannt || stand.raeume.length === 0) {
    return null;
  }
  return {
    raumJeFoto: new Map(
      stand.fotos.map((f) => [f.property_photo_id, f.airbnb_room_id]),
    ),
    raeume: stand.raeume,
    umhaengen,
  };
}

/** Der Airbnb-Zweig im „…"-Menue eines Fotos. */
export function AirbnbRaumMenue({
  photoId,
  stand,
}: {
  photoId: string;
  stand: AirbnbFotoStand;
}) {
  const t = useTranslations("objects.airbnbFotos");
  const tz = useTranslations("zimmer");
  // Kein Eintrag = Airbnb kennt dieses Foto nicht (nur bei uns hochgeladen);
  // dann gibt es nichts umzuhaengen.
  if (!stand.raumJeFoto.has(photoId)) return null;
  const aktuell = stand.raumJeFoto.get(photoId) ?? "";

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <ChannelLogo source="airbnb" className="size-4" />
        {t("menue")}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuRadioGroup
          value={aktuell}
          onValueChange={(id) => void stand.umhaengen(photoId, id || null)}
        >
          {/* „Ohne Zimmer" ist ein gueltiger Airbnb-Zustand (Aussenbild) UND
              waehlbar: das Foto haengt danach am Listing statt an einem Raum.
              Der leere Wert wird im Handler zu `null` — der Schreibweg dafuer
              ist ein anderer Payload, siehe lib/airbnb-fotos.ts. */}
          <DropdownMenuRadioItem value="">
            {t("ohneRaum")}
          </DropdownMenuRadioItem>
          {stand.raeume.map((r) => (
            <DropdownMenuRadioItem key={r.id} value={r.id}>
              {raumName(r, tz, tz.has)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
