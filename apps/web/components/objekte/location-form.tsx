"use client";

// Standort-Seite eines Objekts (wie Lodgify „Location"): vier Karten —
//  Adresse (Google-Karte + Places), Entfernungen (Verkehrsmittel), eigene Karte
//  (Bild) und Wegbeschreibung (mehrsprachig). Jede Karte öffnet einen
//  Slide-over-Editor. Basis-Adresse → eigene Spalten; Zusätze →
//  type_attributes.location. Speicherung per updateProperty().
import {
  APIProvider,
  Map,
  Marker,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import { Icon } from "@iconify/react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { LocalizedTextEditor } from "@/components/objekte/localized-text-editor";
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
      <h1 className="font-display text-3xl font-extrabold">Standort</h1>

      <div className="flex flex-col gap-4">
        <SectionCard
          title="Adresse"
          hint="Bearbeite die Standortdaten deines Objekts."
          icon="ph:pencil-simple"
          onOpen={() => setSection("address")}
        >
          {addressLine ? (
            <p className="text-sm">{addressLine}</p>
          ) : (
            <Empty>Noch keine Adresse hinterlegt.</Empty>
          )}
        </SectionCard>

        <SectionCard
          title="Entfernungen"
          hint="Entfernungen zu nahen Verkehrsmitteln bearbeiten."
          onOpen={() => setSection("distances")}
        >
          {hasAnyDistance(ex.distances) ? (
            <DistancesPreview ex={ex} />
          ) : (
            <Empty>Keine Entfernungen angegeben.</Empty>
          )}
        </SectionCard>

        <SectionCard
          title="Eigene Karte"
          hint="Nutze ein Bild oder eine eigene Karte, um den Standort zu illustrieren."
          onOpen={() => setSection("map")}
        >
          {ex.customMapUrl ? (
            <Empty>Eigenes Kartenbild hinterlegt.</Empty>
          ) : (
            <Empty>Kein eigenes Kartenbild.</Empty>
          )}
        </SectionCard>

        <SectionCard
          title="Wegbeschreibung"
          hint="Erkläre, wie Gäste dein Objekt erreichen."
          onOpen={() => setSection("directions")}
        >
          {hasAnyText(ex.directions) ? (
            <Empty>Wegbeschreibung hinterlegt.</Empty>
          ) : (
            <Empty>Noch keine Wegbeschreibung.</Empty>
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
          aria-label={`${title} bearbeiten`}
          onClick={onOpen}
        >
          <Icon icon={icon} className="size-4" />
        </Button>
      </div>
      {children}
    </Card>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground/70">{children}</p>;
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

// --- Editor-Hülle ----------------------------------------------------------

function EditorShell({
  title,
  subtitle,
  onClose,
  footer,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex h-full w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <SheetHeader className="shrink-0 border-b">
          <SheetTitle className="font-display text-xl font-extrabold">
            {title}
          </SheetTitle>
          <SheetDescription className={subtitle ? "" : "sr-only"}>
            {subtitle ?? title}
          </SheetDescription>
        </SheetHeader>
        {/* min-h-0 ist entscheidend, damit der Bereich scrollt statt zu wachsen */}
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5">
          {children}
        </div>
        <div className="flex shrink-0 items-center justify-end gap-3 border-t p-4">
          {footer}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Footer({
  busy,
  error,
  onCancel,
  onSave,
}: {
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="flex w-full items-center gap-3">
      {error && <p className="mr-auto text-sm text-destructive">{error}</p>}
      <Button
        variant="ghost"
        onClick={onCancel}
        disabled={busy}
        className={error ? "" : "ml-auto"}
      >
        Abbrechen
      </Button>
      <Button onClick={onSave} disabled={busy}>
        {busy ? "Speichern…" : "Speichern"}
      </Button>
    </div>
  );
}

function useSaver<T extends unknown[]>(
  fn: (...args: T) => Promise<true | string>,
) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(...args: T) {
    setBusy(true);
    setError(null);
    const r = await fn(...args);
    setBusy(false);
    if (r !== true) setError(r);
  }
  return { busy, error, run };
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
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
  lat: number | null;
  lng: number | null;
};

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
    lat: p.lat,
    lng: p.lng,
  });
  const [stateProvince, setStateProvince] = useState(ex.stateProvince);
  const [useCustomCity, setUseCustomCity] = useState(ex.useCustomCity);
  const [customCity, setCustomCity] = useState(ex.customCity);
  const [showPrecise, setShowPrecise] = useState(ex.showPreciseLocation);
  const { busy, error, run } = useSaver(onSave);

  function commit() {
    void run(
      {
        street: a.street,
        house_number: a.house_number,
        postal_code: a.postal_code,
        city: a.city,
        country: a.country,
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
      title="Adresse"
      subtitle="Bearbeite die Standortdaten deines Objekts."
      onClose={onClose}
      footer={<Footer busy={busy} error={error} onCancel={onClose} onSave={commit} />}
    >
      {!API_KEY ? (
        <p className="text-sm text-destructive">
          Kein Google-Maps-Key gesetzt (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY).
        </p>
      ) : (
        <APIProvider apiKey={API_KEY}>
          <Field label="Land" required>
            <Input
              value={a.country}
              onChange={(e) => setA({ ...a, country: e.target.value })}
              placeholder="z. B. Dänemark"
            />
          </Field>
          <PlacesSearch onPick={(picked) => setA((prev) => ({ ...prev, ...picked }))} />
          <div className="grid grid-cols-[1fr_6rem] gap-3">
            <Field label="Straße" required>
              <Input value={a.street} onChange={(e) => setA({ ...a, street: e.target.value })} />
            </Field>
            <Field label="Nr.">
              <Input value={a.house_number} onChange={(e) => setA({ ...a, house_number: e.target.value })} />
            </Field>
          </div>
          <Field label="PLZ" required>
            <Input value={a.postal_code} onChange={(e) => setA({ ...a, postal_code: e.target.value })} />
          </Field>
          <Field label="Stadt" required>
            <Input value={a.city} onChange={(e) => setA({ ...a, city: e.target.value })} />
          </Field>
          <Field label="Bundesland / Region" required>
            <Input
              value={stateProvince}
              onChange={(e) => setStateProvince(e.target.value)}
              placeholder="z. B. Region Nordjütland"
            />
          </Field>

          <label className="flex items-center gap-2.5 text-sm">
            <Checkbox
              checked={useCustomCity}
              onCheckedChange={(v) => setUseCustomCity(v === true)}
            />
            Eigenen Stadtnamen verwenden
          </label>
          {useCustomCity && (
            <Field label="Eigener Stadtname">
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
                {a.lat != null && a.lng != null && (
                  <Marker position={{ lat: a.lat, lng: a.lng }} />
                )}
              </Map>
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-(--radius) bg-blue-50 p-3 text-sm text-blue-900">
            <Icon icon="ph:info" className="mt-0.5 size-4 shrink-0" />
            <span>Bearbeite die Adresse oben, um Karte und Koordinaten zu aktualisieren.</span>
          </div>

          {/* Standortgenauigkeit */}
          <div className="flex items-start justify-between gap-4 rounded-(--radius) border p-4">
            <div className="leading-tight">
              <p className="font-medium">Genauen Standort anzeigen</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Lass Gäste vor der Buchung den genauen Standort auf der Karte sehen.
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

function PlacesSearch({ onPick }: { onPick: (p: Partial<Addr>) => void }) {
  const places = useMapsLibrary("places");
  const inputRef = useRef<HTMLInputElement>(null);
  const [ready, setReady] = useState(false);

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
      const get = (type: string) => {
        const c = comps.find((x: (typeof comps)[number]) => x.types.includes(type));
        return c ? c.long_name : "";
      };
      onPick({
        street: get("route"),
        house_number: get("street_number"),
        postal_code: get("postal_code"),
        city: get("locality") || get("postal_town"),
        country: get("country"),
        lat: place.geometry?.location?.lat() ?? null,
        lng: place.geometry?.location?.lng() ?? null,
      });
    });
    return () => listener.remove();
  }, [places, onPick]);

  return (
    <Field label="Adresse suchen (Google)">
      <Input
        ref={inputRef}
        placeholder={ready ? "Straße, Stadt …" : "Lädt …"}
        disabled={!ready}
      />
    </Field>
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

  function setValue(key: string, raw: string) {
    const num = raw === "" ? null : Number(raw);
    setD((prev) => ({
      ...prev,
      values: { ...prev.values, [key]: Number.isFinite(num as number) ? num : null },
    }));
  }

  return (
    <EditorShell
      title="Entfernungen"
      subtitle="Entfernungen zu nahen Verkehrsmitteln bearbeiten."
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
            {u === "km" ? "Kilometer" : "Meilen"}
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
        Ist die Entfernung kleiner als 1 {d.unit} (z. B. 200 m), gib sie als
        Dezimalzahl ein – das wäre dann 0,2.
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

  async function upload(file: File) {
    setUploadErr(null);
    if (!file.type.startsWith("image/")) {
      setUploadErr("Bitte eine Bilddatei wählen.");
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
      title="Eigene Karte"
      subtitle="Nutze ein Bild oder eine eigene Karte, um den Standort zu illustrieren."
      onClose={onClose}
      footer={<Footer busy={busy} error={error} onCancel={onClose} onSave={() => run({}, { customMapUrl: url })} />}
    >
      {url ? (
        <div className="flex flex-col gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="Eigene Karte" className="w-full rounded-(--radius) border object-cover" />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploadBusy}>
              {uploadBusy ? "Lädt…" : "Bild ersetzen"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setUrl("")} disabled={uploadBusy}>
              Entfernen
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
          <span>{uploadBusy ? "Lädt …" : "Bild hochladen oder hierher ziehen"}</span>
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
  return (
    <EditorShell
      title="Wegbeschreibung"
      subtitle="Erkläre, wie Gäste dein Objekt erreichen."
      onClose={onClose}
      footer={<Footer busy={busy} error={error} onCancel={onClose} onSave={() => run({}, { directions: v })} />}
    >
      <LocalizedTextEditor
        value={v}
        onChange={setV}
        placeholder="Wegbeschreibung eingeben …"
      />
    </EditorShell>
  );
}
