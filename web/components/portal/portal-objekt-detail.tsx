"use client";

// Eigentümer-Portal · Objektbereich, Detail (pm_property_area, read-only).
//
// WARUM EINE EIGENE ANSICHT UND NICHT `components/objekte/property-overview.tsx`
// (bzw. die übrigen `components/objekte/*-form.tsx`):
// Der PM-Objektbereich IST der Editor. `property-overview.tsx` und die Formulare
// darunter halten Eingabefelder, Ausstattungs-Auswahl, Foto-Verwaltung und rufen
// die Schreib-Actions aus `lib/properties.ts` (`updateProperty`, Fotos,
// Veröffentlichen) direkt auf. Diese Komponenten mit ausgeblendeten Knöpfen zu
// verwenden wäre ein verstecktes Formular, kein Schutz (Wurzel 3) — der
// Schreibpfad läge weiterhin im Bundle und wäre über eine Server-Action
// erreichbar. Der Eigentümer ist §4.2 read-only, also gibt es hier gar keinen.
//
// WIEDERVERWENDET wird stattdessen genau das, was rein lesend ist:
//  * `useAmenityLabels` / `useRoomAmenityLabels` (lib/use-amenity-labels.ts) —
//    Slug → übersetztes Label, keine Auswahl, kein Schreiben. Ohne sie stünde im
//    Portal der rohe Slug („nd_parking_included").
//  * der i18n-Namensraum `objects.meta` für Objekttyp und Status.
//  * `countryName` aus @nextdays/ui/countries für den Ländernamen.
//
// KEIN GELD und KEIN VERTRIEB: weder Preise/Raten/Gebühren noch Kanal- oder
// Marktplatz-Zustand. Das ist Sache des Betriebs (§4.3).
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { PortalRealtime } from "@/components/portal/portal-realtime";
import { PortalBilderRaster } from "@/components/portal/portal-bilder-raster";
import { Card, CardContent } from "@nextdays/ui/card";
import { countryName } from "@nextdays/ui/countries";
import {
  useAmenityLabels,
  useRoomAmenityLabels,
} from "@/lib/use-amenity-labels";
import type { PortalImage, PortalPropertyDetail } from "@/lib/portal";

/** Eine Stammdaten-Zeile. Ein leerer Wert wird als „—" gezeigt und nicht
 *  weggelassen: „nicht erfasst" ist eine Aussage, ein fehlendes Feld nicht. */
function Feld({ label, wert }: { label: string; wert: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{wert && wert.trim() !== "" ? wert : "—"}</dd>
    </div>
  );
}

function Abschnitt({
  titel,
  icon,
  children,
}: {
  titel: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 py-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-extrabold">
          <Icon icon={icon} className="size-5 text-muted-foreground" />
          {titel}
        </h2>
        {children}
      </CardContent>
    </Card>
  );
}

export function PortalObjektDetail({
  property,
  error,
  zeigtBilder,
  bilder,
  bilderError,
}: {
  property: PortalPropertyDetail | null;
  /** Ladefehler ODER 404 (fremdes/unbekanntes Objekt). Beides bekommt eine
   *  eigene Fläche — leer gerendert sähe aus wie „Objekt ohne Inhalt". */
  error: string | null;
  /** Ergebnis der Rechteprüfung `pm_view_property_images` (aus /auth/me).
   *  false = der Bilder-Abschnitt wird gar nicht erst gerendert. Das ist
   *  Kosmetik — der Endpunkt prüft dasselbe Recht selbst. */
  zeigtBilder: boolean;
  bilder: PortalImage[];
  bilderError: string | null;
}) {
  const t = useTranslations("portal");
  const tMeta = useTranslations("objects.meta");
  const locale = useLocale();
  const router = useRouter();
  const { amenityLabel } = useAmenityLabels();
  const { roomAmenityLabel } = useRoomAmenityLabels();
  const aktualisieren = useCallback(() => router.refresh(), [router]);

  // Sprachliche Zahlformatierung — reine Anzeige, keine Rechnung.
  const [zahl] = useState(() => new Intl.NumberFormat(locale));

  const zurueck = (
    <Link
      href="/portal/objekte"
      className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <Icon icon="ph:arrow-left" className="size-4" />
      {t("propertyArea.back")}
    </Link>
  );

  if (!property) {
    return (
      <div className="flex flex-col gap-6">
        {zurueck}
        <div className="rounded-(--radius) border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error ?? t("propertyArea.notFound")}
        </div>
      </div>
    );
  }

  const adresse: string[] = [
    [property.street, property.house_number].filter(Boolean).join(" "),
    [property.postal_code, property.city].filter(Boolean).join(" "),
    property.country ? countryName(property.country) : "",
  ]
    .map((zeile) => zeile.trim())
    .filter((zeile) => zeile.length > 0);

  const groesse =
    property.size_value !== null
      ? `${zahl.format(property.size_value)}${property.size_unit ? ` ${property.size_unit}` : ""}`
      : null;

  return (
    <div className="flex flex-col gap-6">
      <PortalRealtime quellen={["properties"]} onChange={aktualisieren} />

      {zurueck}

      <header className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-extrabold">
          {property.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("propertyArea.readOnlyHint")}
        </p>
      </header>

      {error && (
        <div className="rounded-(--radius) border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Abschnitt titel={t("propertyArea.sections.basics")} icon="ph:info">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Feld
            label={t("propertyArea.fields.type")}
            wert={
              property.property_type && tMeta.has(`type.${property.property_type}`)
                ? tMeta(`type.${property.property_type}`)
                : property.property_type
            }
          />
          {/* `status` und `max_guests` sind serverseitig nullable. Fehlen sie,
              steht „—" — nicht „Entwurf" und nicht „0 Gäste": beides wäre eine
              plausibel aussehende Falschaussage (Wurzel 4). */}
          <Feld
            label={t("propertyArea.fields.status")}
            wert={
              property.status === null
                ? null
                : tMeta.has(`status.${property.status}`)
                  ? tMeta(`status.${property.status}`)
                  : property.status
            }
          />
          <Feld
            label={t("propertyArea.fields.maxGuests")}
            wert={
              property.max_guests === null
                ? null
                : zahl.format(property.max_guests)
            }
          />
          <Feld
            label={t("propertyArea.fields.units")}
            wert={zahl.format(property.units_total)}
          />
          {/* Zimmeranzahl-Bucket — nur Hotels/Betriebe tragen ihn. */}
          <Feld
            label={t("propertyArea.fields.totalRooms")}
            wert={property.total_rooms}
          />
          <Feld label={t("propertyArea.fields.size")} wert={groesse} />
          <Feld
            label={t("propertyArea.fields.yearBuilt")}
            wert={property.year_built === null ? null : String(property.year_built)}
          />
          <Feld
            label={t("propertyArea.fields.floors")}
            wert={
              property.floors_total === null
                ? null
                : zahl.format(property.floors_total)
            }
          />
          <Feld
            label={t("propertyArea.fields.floorNumber")}
            wert={
              property.floor_number === null
                ? null
                : zahl.format(property.floor_number)
            }
          />
          <Feld
            label={t("propertyArea.fields.timezone")}
            wert={property.timezone}
          />
          <Feld
            label={t("propertyArea.fields.bfeNumber")}
            wert={property.bfe_number}
          />
        </dl>
      </Abschnitt>

      <Abschnitt titel={t("propertyArea.sections.address")} icon="ph:map-pin">
        {adresse.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("propertyArea.noAddress")}
          </p>
        ) : (
          <address className="text-sm not-italic">
            {adresse.map((zeile) => (
              <span key={zeile} className="block">
                {zeile}
              </span>
            ))}
          </address>
        )}
      </Abschnitt>

      <Abschnitt
        titel={t("propertyArea.sections.description")}
        icon="ph:text-align-left"
      >
        {property.description && property.description.trim() !== "" ? (
          <p className="whitespace-pre-line text-sm leading-relaxed">
            {property.description}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("propertyArea.noDescription")}
          </p>
        )}
      </Abschnitt>

      <Abschnitt titel={t("propertyArea.sections.amenities")} icon="ph:sparkle">
        {property.amenities.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("propertyArea.noAmenities")}
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {property.amenities.map((slug) => (
              <li
                key={slug}
                className="rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground"
              >
                {amenityLabel(slug)}
              </li>
            ))}
          </ul>
        )}
      </Abschnitt>

      {/* Zimmer-Ausstattung ist ein EIGENER Katalog (0243) mit eigenen Slugs —
          nie mit der Objekt-Ausstattung in eine Liste mischen. */}
      {property.room_amenities.length > 0 && (
        <Abschnitt
          titel={t("propertyArea.sections.roomAmenities")}
          icon="ph:bed"
        >
          <ul className="flex flex-wrap gap-2">
            {property.room_amenities.map((slug) => (
              <li
                key={slug}
                className="rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground"
              >
                {roomAmenityLabel(slug)}
              </li>
            ))}
          </ul>
        </Abschnitt>
      )}

      {/* Bilder NUR mit pm_view_property_images. Ohne das Recht existiert der
          Abschnitt nicht — er wird nicht leer gerendert und nicht per CSS
          versteckt. */}
      {zeigtBilder && (
        <Abschnitt titel={t("propertyArea.sections.images")} icon="ph:images">
          {bilderError ? (
            <div className="rounded-(--radius) border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {bilderError}
            </div>
          ) : bilder.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("propertyArea.noImages")}
            </p>
          ) : (
            <PortalBilderRaster bilder={bilder} titel={property.title} />
          )}
        </Abschnitt>
      )}
    </div>
  );
}
