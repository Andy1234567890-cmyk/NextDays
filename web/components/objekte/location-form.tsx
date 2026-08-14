"use client";

// Standort-Seite eines Objekts (wie Lodgify „Location"): vier Karten —
//  Adresse (Google-Karte + Places), Entfernungen (Verkehrsmittel), eigene Karte
//  (Bild) und Wegbeschreibung (mehrsprachig). Jede Karte öffnet einen
//  Slide-over-Editor. Basis-Adresse → eigene Spalten; Zusätze →
//  type_attributes.location. Speicherung per updateProperty().
import {
  AdvancedMarker,
  APIProvider,
  Map,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";

import { useEffect, useRef, useState } from "react";

import {
  EditorShell,
  Empty,
  Field,
  Footer,
  Hint,
  useSaver,
} from "@/components/objekte/editor-primitives";
import { LocalizedTextEditor } from "@/components/objekte/localized-text-editor";
import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { Checkbox } from "@nextdays/ui/checkbox";
import { Input } from "@nextdays/ui/input";
import { NativeSelect } from "@nextdays/ui/native-select";
import {
  type Distances,
  type LocationExtras,
  DISTANCE_FIELDS,
  hasAnyDistance,
  readLocationExtras,
} from "@/lib/location-meta";
import { hasAnyText } from "@/lib/policy-meta";
import {
  type Property,
  updateProperty,
  uploadPropertyImage,
} from "@/lib/properties";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

type Section = "address" | "distances" | "map" | "directions" | null;

export function LocationForm({ initial }: { initial: Property }) {
  const t = useTranslations("objects");
  const [p, setP] = useState<Property>(initial);
  const [section, setSection] = useState<Section>(null);
  const ex = readLocationExtras(p.type_attributes);

  const addressLine = [
    [p.street, p.house_number].filter(Boolean).join(" "),
    p.postal_code,
    ex.useCustomCity && ex.customCity ? ex.customCity : p.city,
    p.country,
  ]
    .filter(Boolean)
    .join(", ");

  // Speichert Property-Felder (Adresse) und/oder die location-Zusätze.
  async function save(
    patch: Partial<Property>,
    extras?: Partial<LocationExtras>,
  ): Promise<true | string> {
    const next = extras
      ? {
          ...patch,
          type_attributes: {
            ...p.type_attributes,
            location: { ...ex, ...extras },
          },
        }
      : patch;
    const res = await updateProperty(p.id, next);
    if (res.ok) {
      setP(res.data);
      setSection(null);
      return true;
    }
    return res.error;
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl font-extrabold">{t("locationForm.title")}</h1>

      <div className="flex flex-col gap-4">
        <SectionCard
          title={t("locationForm.addressCardTitle")}
          hint={t("locationForm.addressCardHint")}
          icon="ph:pencil-simple"
          onOpen={() => setSection("address")}
        >
          {addressLine ? (
            <p className="text-sm">{addressLine}</p>
          ) : (
            <Empty>{t("locationForm.noAddress")}</Empty>
          )}
        </SectionCard>

        <SectionCard
          title={t("locationForm.distancesCardTitle")}
          hint={t("locationForm.distancesCardHint")}
          onOpen={() => setSection("distances")}
        >
          {hasAnyDistance(ex.distances) ? (
            <DistancesPreview ex={ex} />
          ) : (
            <Empty>{t("locationForm.noDistances")}</Empty>
          )}
        </SectionCard>

        <SectionCard
          title={t("locationForm.customMapCardTitle")}
          hint={t("locationForm.customMapCardHint")}
          onOpen={() => setSection("map")}
        >
          {ex.customMapUrl ? (
            <Empty>{t("locationForm.customMapPresent")}</Empty>
          ) : (
            <Empty>{t("locationForm.customMapAbsent")}</Empty>
          )}
        </SectionCard>

        <SectionCard
          title={t("locationForm.directionsCardTitle")}
          hint={t("locationForm.directionsCardHint")}
          onOpen={() => setSection("directions")}
        >
          {hasAnyText(ex.directions) ? (
            <Empty>{t("locationForm.directionsPresent")}</Empty>
          ) : (
            <Empty>{t("locationForm.directionsAbsent")}</Empty>
          )}
        </SectionCard>
      </div>

      {section === "address" && (
        <AddressEditor p={p} ex={ex} onSave={save} onClose={() => setSection(null)} />
      )}
      {section === "distances" && (
        <DistancesEditor ex={ex} onSave={save} onClose={() => setSection(null)} />
      )}
      {section === "map" && (
        <CustomMapEditor
          p={p}
          ex={ex}
          onSave={save}
          onClose={() => setSection(null)}
        />
      )}
      {section === "directions" && (
        <DirectionsEditor ex={ex} onSave={save} onClose={() => setSection(null)} />
      )}
    </div>
  );
}

// --- Karten ----------------------------------------------------------------

function SectionCard({
  title,
  hint,
  icon = "ph:plus",
  onOpen,
  children,
}: {
  title: string;
  hint: string;
  icon?: string;
  onOpen: () => void;
  children: React.ReactNode;
}) {
  const t = useTranslations("objects");
  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="leading-tight">
          <p className="font-semibold">{title}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>
        </div>
        <Button
          variant="outline"
          size="icon"
          aria-label={t("locationForm.editAriaLabel", { title })}
          onClick={onOpen}
        >
          <Icon icon={icon} className="size-4" />
        </Button>
      </div>
      {children}
    </Card>
  );
}

function DistancesPreview({ ex }: { ex: LocationExtras }) {
  const u = ex.distances.unit;
  return (
    <div className="flex flex-wrap gap-2">
      {DISTANCE_FIELDS.filter(
        (f) => typeof ex.distances.values[f.key] === "number",
      ).map((f) => (
        <span
          key={f.key}
          className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-3 py-1.5 text-sm"
        >
          <Icon icon={f.icon} className="size-4" />
          {f.label}: {ex.distances.values[f.key]} {u}
        </span>
      ))}
    </div>
  );
}

// --- Adress-Editor ---------------------------------------------------------

type Addr = {
  street: string;
  house_number: string;
  postal_code: string;
  city: string;
  country: string;
  timezone: string;
  lat: number | null;
  lng: number | null;
  // Transport aus dem Picker in den separaten stateProvince-State.
  state_province?: string;
};

// IANA-Zeitzonen, die der Browser kennt. Kein eigener, gepflegter Katalog:
// `supportedValuesOf` liefert genau die Liste, gegen die auch die Datenbank
// prüft (0258). Ältere Browser ohne die Funktion bekommen eine leere Liste —
// dann bleibt das Feld leer statt eine geratene Zone anzubieten.
function zeitzonen(): string[] {
  const f = (
    Intl as unknown as { supportedValuesOf?: (k: string) => string[] }
  ).supportedValuesOf;
  return typeof f === "function" ? f("timeZone") : [];
}

function AddressEditor({
  p,
  ex,
  onSave,
  onClose,
}: {
  p: Property;
  ex: LocationExtras;
  onSave: (
    patch: Partial<Property>,
    extras?: Partial<LocationExtras>,
  ) => Promise<true | string>;
  onClose: () => void;
}) {
  const [a, setA] = useState<Addr>({
    street: p.street ?? "",
    house_number: p.house_number ?? "",
    postal_code: p.postal_code ?? "",
    city: p.city ?? "",
    country: p.country ?? "",
    timezone: p.timezone ?? "",
    lat: p.lat,
    lng: p.lng,
  });
  const [stateProvince, setStateProvince] = useState(ex.stateProvince);
  const [useCustomCity, setUseCustomCity] = useState(ex.useCustomCity);
  const [customCity, setCustomCity] = useState(ex.customCity);
  const [showPrecise, setShowPrecise] = useState(ex.showPreciseLocation);
  const { busy, error, run } = useSaver(onSave);
  const t = useTranslations("objects");

  function commit() {
    void run(
      {
        street: a.street,
        house_number: a.house_number,
        postal_code: a.postal_code,
        city: a.city,
        country: a.country,
        timezone: a.timezone || null,
        lat: a.lat,
        lng: a.lng,
      },
      { stateProvince, useCustomCity, customCity, showPreciseLocation: showPrecise },
    );
  }

  // Ohne Koordinaten: auf Dänemark/Nordeuropa zentrieren (statt Weltansicht).
  const center =
    a.lat != null && a.lng != null
      ? { lat: a.lat, lng: a.lng }
      : { lat: 56.0, lng: 10.0 };

  return (
    <EditorShell
      title={t("locationForm.addressCardTitle")}
      subtitle={t("locationForm.addressCardHint")}
      onClose={onClose}
      footer={<Footer busy={busy} error={error} onCancel={onClose} onSave={commit} />}
    >
      {!API_KEY ? (
        <p className="text-sm text-destructive">
          {t("locationForm.missingMapsKey")}
        </p>
      ) : (
        <APIProvider apiKey={API_KEY}>
          <Field label={t("locationForm.countryLabel")} required>
            <Input
              value={a.country}
              onChange={(e) => setA({ ...a, country: e.target.value })}
              placeholder={t("locationForm.countryPlaceholder")}
            />
          </Field>
          {/* Zeitzone bestimmt, wann Automationen mit Ortszeit auslösen.
              Ohne sie plant der Server für dieses Objekt keine — statt still
              auf UTC auszuweichen und Nachrichten um Stunden zu verschieben. */}
          <Field label={t("locationForm.timezoneLabel")}>
            <>
              <NativeSelect
                value={a.timezone}
                onChange={(e) => setA({ ...a, timezone: e.target.value })}
              >
                <option value="">{t("locationForm.timezoneNone")}</option>
                {zeitzonen().map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </NativeSelect>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("locationForm.timezoneHint")}
              </p>
            </>
          </Field>
          <div className="grid grid-cols-[1fr_6rem] gap-3">
            <Field label={t("locationForm.streetLabel")} required>
              <PlacesSearch
                value={a.street}
                onPick={(picked) => {
                  const { state_province, ...addr } = picked;
                  setA((prev) => ({ ...prev, ...addr }));
                  if (state_province) setStateProvince(state_province);
                }}
              />
            </Field>
            <Field label={t("locationForm.houseNumberLabel")}>
              <Input value={a.house_number} onChange={(e) => setA({ ...a, house_number: e.target.value })} />
            </Field>
          </div>
          <Field label={t("locationForm.postalCodeLabel")} required>
            <Input value={a.postal_code} onChange={(e) => setA({ ...a, postal_code: e.target.value })} />
          </Field>
          <Field label={t("locationForm.cityLabel")} required>
            <Input value={a.city} onChange={(e) => setA({ ...a, city: e.target.value })} />
          </Field>
          <Field label={t("locationForm.stateProvinceLabel")} required>
            <Input
              value={stateProvince}
              onChange={(e) => setStateProvince(e.target.value)}
              placeholder={t("locationForm.stateProvincePlaceholder")}
            />
          </Field>

          <label className="flex items-center gap-2.5 text-sm">
            <Checkbox
              checked={useCustomCity}
              onCheckedChange={(v) => setUseCustomCity(v === true)}
            />
            {t("locationForm.useCustomCityLabel")}
          </label>
          {useCustomCity && (
            <Field label={t("locationForm.customCityLabel")}>
              <Input value={customCity} onChange={(e) => setCustomCity(e.target.value)} />
            </Field>
          )}

          {/* Karte (großes Quadrat wie Lodgify). shrink-0 + feste Höhe, sonst
              staucht der Flex-Column-Container die Karte zum Streifen. */}
          <div className="h-80 w-full shrink-0 overflow-hidden rounded-(--radius) border">
            <div style={{ height: "100%", width: "100%" }}>
              <Map
                defaultCenter={center}
                defaultZoom={a.lat != null ? 15 : 6}
                gestureHandling="greedy"
                mapId="nextdays-location"
                style={{ width: "100%", height: "100%" }}
              >
                <Recenter lat={a.lat} lng={a.lng} />
                {/* AdvancedMarker statt des zum 21.02.2024 abgekündigten
                    `Marker` (v3.56). Braucht die `mapId` oben. */}
                {a.lat != null && a.lng != null && (
                  <AdvancedMarker position={{ lat: a.lat, lng: a.lng }} />
                )}
              </Map>
            </div>
          </div>
          <Hint>{t("locationForm.mapHint")}</Hint>

          {/* Standortgenauigkeit */}
          <div className="flex items-start justify-between gap-4 rounded-(--radius) border p-4">
            <div className="leading-tight">
              <p className="font-medium">{t("locationForm.showPreciseLocationLabel")}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {t("locationForm.showPreciseLocationHint")}
              </p>
            </div>
            <Checkbox
              checked={showPrecise}
              onCheckedChange={(v) => setShowPrecise(v === true)}
            />
          </div>
        </APIProvider>
      )}
    </EditorShell>
  );
}

function Recenter({ lat, lng }: { lat: number | null; lng: number | null }) {
  const map = useMap();
  useEffect(() => {
    if (map && lat != null && lng != null) {
      map.panTo({ lat, lng });
      map.setZoom(15);
    }
  }, [map, lat, lng]);
  return null;
}

function PlacesSearch({
  value,
  onPick,
}: {
  value: string;
  onPick: (p: Partial<Addr>) => void;
}) {
  const t = useTranslations("objects");
  const places = useMapsLibrary("places");
  const inputRef = useRef<HTMLInputElement>(null);
  const [ready, setReady] = useState(false);
  // onPick in einer Ref halten: der Parent gibt bei JEDEM Render eine neue
  // onPick-Funktion. Hinge der Effect an onPick, würde das Autocomplete ständig
  // neu erzeugt und der place_changed-Listener neu registriert — der alte
  // Listener hinge dann am toten Objekt, und die Auswahl befüllte NICHTS.
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  useEffect(() => {
    if (!places || !inputRef.current) return;
    const ac = new places.Autocomplete(inputRef.current, {
      fields: ["address_components", "geometry"],
      types: ["address"],
    });
    setReady(true);
    const listener = ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      const comps = place.address_components ?? [];
      const get = (type: string, short = false) => {
        const c = comps.find((x: (typeof comps)[number]) => x.types.includes(type));
        return c ? (short ? c.short_name : c.long_name) : "";
      };
      onPickRef.current({
        street: get("route"),
        house_number: get("street_number"),
        postal_code: get("postal_code"),
        city:
          get("locality") ||
          get("postal_town") ||
          get("sublocality") ||
          get("administrative_area_level_2"),
        country: get("country"),
        state_province: get("administrative_area_level_1"),
        lat: place.geometry?.location?.lat() ?? null,
        lng: place.geometry?.location?.lng() ?? null,
      });
    });
    return () => listener.remove();
  }, [places]);

  return (
    <Input
      ref={inputRef}
      defaultValue={value}
      placeholder={ready ? t("locationForm.placesSearchPlaceholder") : t("locationForm.loading")}
      disabled={!ready}
    />
  );
}

// --- Entfernungen-Editor ---------------------------------------------------

function DistancesEditor({
  ex,
  onSave,
  onClose,
}: {
  ex: LocationExtras;
  onSave: (
    patch: Partial<Property>,
    extras?: Partial<LocationExtras>,
  ) => Promise<true | string>;
  onClose: () => void;
}) {
  const [d, setD] = useState<Distances>(ex.distances);
  const { busy, error, run } = useSaver(onSave);
  const t = useTranslations("objects");

  function setValue(key: string, raw: string) {
    const num = raw === "" ? null : Number(raw);
    setD((prev) => ({
      ...prev,
      values: { ...prev.values, [key]: Number.isFinite(num as number) ? num : null },
    }));
  }

  return (
    <EditorShell
      title={t("locationForm.distancesCardTitle")}
      subtitle={t("locationForm.distancesCardHint")}
      onClose={onClose}
      footer={<Footer busy={busy} error={error} onCancel={onClose} onSave={() => run({}, { distances: d })} />}
    >
      {/* Einheit km/mi (Pill-Umschalter wie Lodgify). */}
      <div className="flex w-fit rounded-full bg-muted p-1">
        {(["km", "mi"] as const).map((u) => (
          <button
            key={u}
            type="button"
            onClick={() => setD({ ...d, unit: u })}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              d.unit === u ? "bg-foreground text-background" : "text-muted-foreground"
            }`}
          >
            {u === "km" ? t("locationForm.unitKilometers") : t("locationForm.unitMiles")}
          </button>
        ))}
      </div>

      <div className="flex flex-col divide-y rounded-(--radius) border">
        {DISTANCE_FIELDS.map((f) => (
          <div key={f.key} className="flex items-center gap-3 p-3">
            <Icon icon={f.icon} className="size-5 text-muted-foreground" />
            <span className="flex-1 text-sm">{f.label}</span>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={d.values[f.key as keyof typeof d.values] ?? ""}
                onChange={(e) => setValue(f.key, e.target.value)}
                placeholder="0.00"
                className="w-28 text-right"
              />
              <span className="w-6 text-sm text-muted-foreground">{d.unit}</span>
            </div>
          </div>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        {t("locationForm.distancesDecimalHint", { unit: d.unit })}
      </p>
    </EditorShell>
  );
}

// --- Eigene-Karte-Editor ---------------------------------------------------

function CustomMapEditor({
  p,
  ex,
  onSave,
  onClose,
}: {
  p: Property;
  ex: LocationExtras;
  onSave: (
    patch: Partial<Property>,
    extras?: Partial<LocationExtras>,
  ) => Promise<true | string>;
  onClose: () => void;
}) {
  const [url, setUrl] = useState(ex.customMapUrl);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { busy, error, run } = useSaver(onSave);
  const t = useTranslations("objects");

  async function upload(file: File) {
    setUploadErr(null);
    if (!file.type.startsWith("image/")) {
      setUploadErr(t("locationForm.imageFileRequired"));
      return;
    }
    setUploadBusy(true);
    const res = await uploadPropertyImage(p.id, file, "custom-map");
    setUploadBusy(false);
    if (res.ok) setUrl(res.data.url);
    else setUploadErr(res.error);
  }

  return (
    <EditorShell
      title={t("locationForm.customMapCardTitle")}
      subtitle={t("locationForm.customMapCardHint")}
      onClose={onClose}
      footer={<Footer busy={busy} error={error} onCancel={onClose} onSave={() => run({}, { customMapUrl: url })} />}
    >
      {url ? (
        <div className="flex flex-col gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={t("locationForm.customMapImageAlt")} className="w-full rounded-(--radius) border object-cover" />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploadBusy}>
              {uploadBusy ? t("locationForm.loading") : t("locationForm.replaceImage")}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setUrl("")} disabled={uploadBusy}>
              {t("locationForm.removeImage")}
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) void upload(f);
          }}
          disabled={uploadBusy}
          className={`flex flex-col items-center justify-center gap-2 rounded-(--radius) border-2 border-dashed px-10 py-12 text-center text-sm transition-colors ${
            dragOver ? "border-foreground bg-muted/40" : "border-border text-muted-foreground hover:bg-muted/40"
          }`}
        >
          <Icon
            icon={uploadBusy ? "ph:spinner" : "ph:upload-simple"}
            className={`size-6 ${uploadBusy ? "animate-spin" : ""}`}
          />
          <span>{uploadBusy ? t("locationForm.loading") : t("locationForm.uploadOrDrop")}</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.target.value = "";
        }}
      />
      {uploadErr && <p className="text-sm text-destructive">{uploadErr}</p>}
    </EditorShell>
  );
}

// --- Wegbeschreibung-Editor ------------------------------------------------

function DirectionsEditor({
  ex,
  onSave,
  onClose,
}: {
  ex: LocationExtras;
  onSave: (
    patch: Partial<Property>,
    extras?: Partial<LocationExtras>,
  ) => Promise<true | string>;
  onClose: () => void;
}) {
  const [v, setV] = useState(ex.directions);
  const { busy, error, run } = useSaver(onSave);
  const t = useTranslations("objects");
  return (
    <EditorShell
      title={t("locationForm.directionsCardTitle")}
      subtitle={t("locationForm.directionsCardHint")}
      onClose={onClose}
      footer={<Footer busy={busy} error={error} onCancel={onClose} onSave={() => run({}, { directions: v })} />}
    >
      <LocalizedTextEditor
        value={v}
        onChange={setV}
        placeholder={t("locationForm.directionsInputPlaceholder")}
      />
    </EditorShell>
  );
}
