"use client";

// „Lage" (Airbnb „Location") — vollständige Sektion. Links die Karte + eine Liste
// von Unterpunkten (Adresse, Genaue Lage, Location features, Umgebung, Anfahrt,
// Aussicht); ein Klick öffnet rechts die passende Detail-Sidebar (gleiches Overlay-
// Muster wie Preise/Schlafen).
//
// Adresse + lat/lng schreiben in die Top-Level-Property-Spalten (street/…/lat/lng);
// die Zusätze (preciseLocation/features/views/neighborhood/gettingAround) liegen in
// type_attributes.location. Der Editor merged type_attributes (Wurzel 1).
//
// Karte über @vis.gl/react-google-maps (Key aus NEXT_PUBLIC_GOOGLE_MAPS_API_KEY).
// Adresseingabe per Google-Places-Autocomplete (strukturiert, kein Regex-Raten).
import { Icon } from "@iconify/react";
import { APIProvider, Map, Marker } from "@vis.gl/react-google-maps";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useState } from "react";

import type { Property } from "@/lib/properties";

import { AdressSuche, type PlacesAddress } from "./adress-suche";
import { LOCATION_FEATURES, SCENIC_VIEWS } from "./lage-katalog";

type Detail = "adresse" | "sharing" | "features" | "neighborhood" | "gettingAround" | "views";
type LocationAttr = NonNullable<Property["type_attributes"]["location"]>;

export function LagePanel({
  property,
  onSpeichere,
  onDetailOffen,
}: {
  property: Property;
  // Generischer Property-Patch (Adresse + type_attributes). true bei Erfolg.
  onSpeichere: (fields: Partial<Property>) => Promise<boolean>;
  // Meldet dem Editor, ob eine Detail-Sidebar offen ist (linke Liste ausblenden).
  onDetailOffen?: (offen: boolean) => void;
}) {
  const t = useTranslations("objektEditor");
  const reduziert = useReducedMotion();
  const [detail, setDetailState] = useState<Detail | null>(null);
  function setDetail(d: Detail | null) {
    setDetailState(d);
    onDetailOffen?.(d != null);
  }

  const loc = property.type_attributes?.location ?? {};
  const adresse =
    [property.street, property.house_number].filter(Boolean).join(" ") +
    (property.city
      ? `, ${[property.postal_code, property.city].filter(Boolean).join(" ")}`
      : "");
  const hatKoords = property.lat != null && property.lng != null;

  // type_attributes.location gemergt patchen (Wurzel 1: andere Zweige erhalten).
  async function speichereLoc(teil: Partial<LocationAttr>) {
    const bisher = property.type_attributes ?? {};
    return onSpeichere({
      type_attributes: { ...bisher, location: { ...(bisher.location ?? {}), ...teil } },
    });
  }

  return (
    // Inline-Layout: links die Karten (flex-1), rechts die Detail-Sidebar als
    // eigene Spalte, die per Breiten-Animation ausfährt (kein Overlay).
    <div className="flex h-full min-h-0">
      <section className="min-w-0 flex-1 overflow-y-auto px-8 py-8 lg:py-12">
        <div className="mx-auto max-w-2xl">
        <h2 className="font-sans text-[2rem] font-bold tracking-tight">{t("secLage")}</h2>

        {/* Karte (echte Lage, sofern Koordinaten da) */}
        <div className="mt-6 h-64 overflow-hidden rounded-2xl border border-border">
          {hatKoords ? (
            <LageKarte lat={property.lat as number} lng={property.lng as number} />
          ) : (
            <div className="flex size-full items-center justify-center bg-muted text-muted-foreground">
              <Icon icon="ph:map-pin" className="size-10" />
            </div>
          )}
        </div>

        <div className="mt-6 divide-y divide-border rounded-2xl border border-border">
          <ZeileButton
            titel={t("lageAdresse")}
            wert={adresse || t("hinzufuegen")}
            fehlt={!adresse}
            onClick={() => setDetail("adresse")}
          />
          <ZeileButton
            titel={t("lageSharing")}
            wert={loc.preciseLocation ? t("lageSharingGenau") : t("lageSharingUngefaehr")}
            onClick={() => setDetail("sharing")}
          />
          <ZeileButton
            titel={t("lageFeatures")}
            wert={
              loc.features?.length
                ? t("lageAnzahlGewaehlt", { n: loc.features.length })
                : t("hinzufuegen")
            }
            fehlt={!loc.features?.length}
            onClick={() => setDetail("features")}
          />
          <ZeileButton
            titel={t("lageNeighborhood")}
            wert={loc.neighborhood || t("hinzufuegen")}
            fehlt={!loc.neighborhood}
            onClick={() => setDetail("neighborhood")}
          />
          <ZeileButton
            titel={t("lageGettingAround")}
            wert={loc.gettingAround || t("hinzufuegen")}
            fehlt={!loc.gettingAround}
            onClick={() => setDetail("gettingAround")}
          />
          <ZeileButton
            titel={t("lageViews")}
            wert={
              loc.views?.length
                ? t("lageAnzahlGewaehlt", { n: loc.views.length })
                : t("hinzufuegen")
            }
            fehlt={!loc.views?.length}
            onClick={() => setDetail("views")}
          />
        </div>
        </div>
      </section>

      {/* Detail-Sidebar als INLINE-Spalte (kein Overlay): fährt per Breiten-
          Animation aus und schiebt die Karten daneben zusammen. */}
      <AnimatePresence initial={false}>
        {detail != null && (
          <motion.aside
            key="lage-sidebar"
            className="shrink-0 overflow-hidden border-l border-border"
            initial={reduziert ? false : { width: 0, opacity: 0 }}
            animate={{ width: "32rem", opacity: 1 }}
            exit={reduziert ? { opacity: 0 } : { width: 0, opacity: 0 }}
            transition={
              reduziert ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 30 }
            }
          >
            <div className="h-full w-[32rem]">
            {detail === "adresse" && (
              <AdresseSidebar
                property={property}
                onSpeichere={onSpeichere}
                onZurueck={() => setDetail(null)}
              />
            )}
            {detail === "sharing" && (
              <SharingSidebar
                precise={loc.preciseLocation === true}
                onSpeichere={(v) => speichereLoc({ preciseLocation: v })}
                onZurueck={() => setDetail(null)}
              />
            )}
            {detail === "features" && (
              <AuswahlSidebar
                titel={t("lageFeatures")}
                hint={t("lageFeaturesHint")}
                katalog={LOCATION_FEATURES}
                gewaehlt={loc.features ?? []}
                onSpeichere={(neu) => speichereLoc({ features: neu })}
                onZurueck={() => setDetail(null)}
                labelPrefix="lageFeature"
              />
            )}
            {detail === "neighborhood" && (
              <TextSidebar
                titel={t("lageNeighborhood")}
                hint={t("lageNeighborhoodHint")}
                wert={loc.neighborhood ?? ""}
                onSpeichere={(v) => speichereLoc({ neighborhood: v })}
                onZurueck={() => setDetail(null)}
              />
            )}
            {detail === "gettingAround" && (
              <TextSidebar
                titel={t("lageGettingAround")}
                hint={t("lageGettingAroundHint")}
                wert={loc.gettingAround ?? ""}
                onSpeichere={(v) => speichereLoc({ gettingAround: v })}
                onZurueck={() => setDetail(null)}
              />
            )}
            {detail === "views" && (
              <AuswahlSidebar
                titel={t("lageViews")}
                hint={t("lageViewsHint")}
                katalog={SCENIC_VIEWS}
                gewaehlt={loc.views ?? []}
                onSpeichere={(neu) => speichereLoc({ views: neu })}
                onZurueck={() => setDetail(null)}
                labelPrefix="lageView"
              />
            )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Karte                                                              */
/* ------------------------------------------------------------------ */

function LageKarte({ lat, lng }: { lat: number; lng: number }) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return (
      <div className="flex size-full items-center justify-center bg-muted text-muted-foreground">
        <Icon icon="ph:map-pin" className="size-10" />
      </div>
    );
  }
  return (
    <APIProvider apiKey={apiKey}>
      {/* Klassischer Marker (nicht AdvancedMarker): funktioniert OHNE im Google-
          Cloud-Projekt registrierte Vektor-mapId — genau das Muster aus web/
          location-form.tsx. AdvancedMarker bräuchte eine echte mapId, sonst
          bleibt die Karte leer. */}
      <Map
        center={{ lat, lng }}
        defaultZoom={14}
        gestureHandling="cooperative"
        disableDefaultUI
        className="size-full"
      >
        <Marker position={{ lat, lng }} />
      </Map>
    </APIProvider>
  );
}

/* ------------------------------------------------------------------ */
/* Sidebars                                                           */
/* ------------------------------------------------------------------ */

// Adresse: Places-Autocomplete auf dem Straße-Feld + strukturierte Felder.
function AdresseSidebar({
  property,
  onSpeichere,
  onZurueck,
}: {
  property: Property;
  onSpeichere: (fields: Partial<Property>) => Promise<boolean>;
  onZurueck: () => void;
}) {
  const t = useTranslations("objektEditor");
  const [street, setStreet] = useState(property.street ?? "");
  const [houseNumber, setHouseNumber] = useState(property.house_number ?? "");
  const [postal, setPostal] = useState(property.postal_code ?? "");
  const [city, setCity] = useState(property.city ?? "");
  const [country, setCountry] = useState(property.country ?? "");
  const [lat, setLat] = useState<number | null>(property.lat);
  const [lng, setLng] = useState<number | null>(property.lng);
  const [speichert, setSpeichert] = useState(false);

  // Places-Auswahl befüllt ALLE Felder strukturiert (inkl. lat/lng).
  function gewaehlt(a: PlacesAddress) {
    setStreet(a.street);
    setHouseNumber(a.houseNumber);
    setPostal(a.postalCode);
    setCity(a.city);
    setCountry(a.country);
    setLat(a.lat);
    setLng(a.lng);
  }

  async function speichern() {
    setSpeichert(true);
    const ok = await onSpeichere({
      street: street || null,
      house_number: houseNumber || null,
      postal_code: postal || null,
      city: city || null,
      country: country || null,
      lat,
      lng,
    });
    setSpeichert(false);
    if (ok) onZurueck();
  }

  return (
    <SidebarRahmen titel={t("lageAdresse")} onZurueck={onZurueck}>
      <div className="space-y-4">
        <Feld label={t("lageStrasse")}>
          <AdressSuche
            value={street}
            onChange={setStreet}
            onPick={gewaehlt}
            placeholder={t("lageStrassePlatzhalter")}
          />
        </Feld>
        <Feld label={t("lageHausnummer")}>
          <input
            value={houseNumber}
            onChange={(e) => setHouseNumber(e.target.value)}
            className="w-full rounded-xl border border-border bg-transparent px-3 py-2.5 outline-none focus-visible:border-foreground"
          />
        </Feld>
        <div className="grid grid-cols-2 gap-4">
          <Feld label={t("lagePlz")}>
            <input
              value={postal}
              onChange={(e) => setPostal(e.target.value)}
              className="w-full rounded-xl border border-border bg-transparent px-3 py-2.5 outline-none focus-visible:border-foreground"
            />
          </Feld>
          <Feld label={t("lageStadt")}>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full rounded-xl border border-border bg-transparent px-3 py-2.5 outline-none focus-visible:border-foreground"
            />
          </Feld>
        </div>
        <Feld label={t("lageLand")}>
          <input
            value={country}
            onChange={(e) => setCountry(e.target.value.toUpperCase())}
            maxLength={2}
            placeholder="DE"
            className="w-24 rounded-xl border border-border bg-transparent px-3 py-2.5 uppercase outline-none focus-visible:border-foreground"
          />
        </Feld>
      </div>

      <div className="mt-8 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onZurueck}
          className="text-sm font-semibold underline-offset-4 hover:underline"
        >
          {t("stornieren")}
        </button>
        <button
          type="button"
          onClick={speichern}
          disabled={speichert}
          className="rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {speichert ? t("speichert") : t("speichern")}
        </button>
      </div>
    </SidebarRahmen>
  );
}

// Location sharing: Toggle „genaue Lage zeigen".
function SharingSidebar({
  precise,
  onSpeichere,
  onZurueck,
}: {
  precise: boolean;
  onSpeichere: (v: boolean) => Promise<boolean>;
  onZurueck: () => void;
}) {
  const t = useTranslations("objektEditor");
  return (
    <SidebarRahmen titel={t("lageSharing")} onZurueck={onZurueck}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-semibold">{t("lageSharingToggle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("lageSharingText")}</p>
        </div>
        <Toggle an={precise} onChange={(v) => void onSpeichere(v)} />
      </div>
    </SidebarRahmen>
  );
}

// Mehrfachauswahl (Location features / Scenic views) als Toggle-Liste.
function AuswahlSidebar({
  titel,
  hint,
  katalog,
  gewaehlt,
  onSpeichere,
  onZurueck,
  labelPrefix,
}: {
  titel: string;
  hint: string;
  katalog: { slug: string; icon: string }[];
  gewaehlt: string[];
  onSpeichere: (neu: string[]) => Promise<boolean>;
  onZurueck: () => void;
  // i18n-Key-Präfix: `${labelPrefix}_${slug}` (z. B. lageFeature_beach_access).
  labelPrefix: string;
}) {
  const t = useTranslations("objektEditor");
  const [lokal, setLokal] = useState<string[]>(gewaehlt);
  const [speichert, setSpeichert] = useState(false);

  function toggle(slug: string) {
    setLokal((v) => (v.includes(slug) ? v.filter((x) => x !== slug) : [...v, slug]));
  }

  async function speichern() {
    setSpeichert(true);
    const ok = await onSpeichere(lokal);
    setSpeichert(false);
    if (ok) onZurueck();
  }

  return (
    <SidebarRahmen titel={titel} onZurueck={onZurueck}>
      <p className="mb-4 text-sm text-muted-foreground">{hint}</p>
      <div className="divide-y divide-border">
        {katalog.map((e) => (
          <div key={e.slug} className="flex items-center gap-4 py-4">
            <Icon icon={e.icon} className="size-6 shrink-0 text-foreground" />
            <span className="min-w-0 flex-1">{t(`${labelPrefix}_${e.slug}`)}</span>
            <Toggle an={lokal.includes(e.slug)} onChange={() => toggle(e.slug)} />
          </div>
        ))}
      </div>
      <div className="mt-8 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onZurueck}
          className="text-sm font-semibold underline-offset-4 hover:underline"
        >
          {t("stornieren")}
        </button>
        <button
          type="button"
          onClick={speichern}
          disabled={speichert}
          className="rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {speichert ? t("speichert") : t("speichern")}
        </button>
      </div>
    </SidebarRahmen>
  );
}

// Freitext (Neighborhood / Getting around).
function TextSidebar({
  titel,
  hint,
  wert,
  onSpeichere,
  onZurueck,
}: {
  titel: string;
  hint: string;
  wert: string;
  onSpeichere: (v: string) => Promise<boolean>;
  onZurueck: () => void;
}) {
  const t = useTranslations("objektEditor");
  const [lokal, setLokal] = useState(wert);
  const [speichert, setSpeichert] = useState(false);

  async function speichern() {
    setSpeichert(true);
    const ok = await onSpeichere(lokal.trim());
    setSpeichert(false);
    if (ok) onZurueck();
  }

  return (
    <SidebarRahmen titel={titel} onZurueck={onZurueck}>
      <p className="mb-4 text-sm text-muted-foreground">{hint}</p>
      <textarea
        value={lokal}
        onChange={(e) => setLokal(e.target.value)}
        rows={8}
        maxLength={500}
        className="w-full resize-none rounded-2xl border border-border bg-transparent p-4 outline-none focus-visible:border-foreground"
      />
      <p className="mt-2 text-right text-xs text-muted-foreground">
        {t("zeichenVerbleibend", { n: 500 - lokal.length, max: 500 })}
      </p>
      <div className="mt-6 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onZurueck}
          className="text-sm font-semibold underline-offset-4 hover:underline"
        >
          {t("stornieren")}
        </button>
        <button
          type="button"
          onClick={speichern}
          disabled={speichert}
          className="rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {speichert ? t("speichert") : t("speichern")}
        </button>
      </div>
    </SidebarRahmen>
  );
}

/* ------------------------------------------------------------------ */
/* Bausteine                                                          */
/* ------------------------------------------------------------------ */

function SidebarRahmen({
  titel,
  onZurueck,
  children,
}: {
  titel: string;
  onZurueck: () => void;
  children: React.ReactNode;
}) {
  const t = useTranslations("objektEditor");
  return (
    <div className="flex h-full flex-col overflow-y-auto px-8 pt-8 lg:px-10 lg:pt-10">
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={onZurueck}
          aria-label={t("schliessen")}
          className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-muted"
        >
          <Icon icon="ph:x" className="size-5" />
        </button>
      </div>
      <h2 className="font-sans text-[1.75rem] font-bold tracking-tight">{titel}</h2>
      <div className="mt-6 pb-8">{children}</div>
    </div>
  );
}

function ZeileButton({
  titel,
  wert,
  fehlt,
  onClick,
}: {
  titel: string;
  wert: string;
  fehlt?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-4 p-5 text-left outline-none transition-colors first:rounded-t-2xl last:rounded-b-2xl hover:bg-muted/40"
    >
      <div className="min-w-0">
        <p className="font-semibold">{titel}</p>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">{wert}</p>
      </div>
      <Icon icon="ph:caret-right" className="size-5 shrink-0 text-muted-foreground" />
    </button>
  );
}

function Feld({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Toggle({ an, onChange }: { an: boolean; onChange: (an: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={an}
      onClick={() => onChange(!an)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
        an ? "bg-foreground" : "bg-muted-foreground/30"
      }`}
    >
      <span
        className={`inline-block size-5 rounded-full bg-background shadow transition-transform ${
          an ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}
