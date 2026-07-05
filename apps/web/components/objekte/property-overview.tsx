"use client";

// Objekt-Overview wie Lodgify: Kopf (Name/Status) + Sektionskarten
//  (Name & Beschreibung, Rental info, Rooms, Sleeping arrangements, Amenities,
//   Location). Jede Karte öffnet einen Sheet-Editor; gespeichert wird per
//  updateProperty(). Flexible Sektionen (rooms/beds/size/units) liegen in
//  type_attributes.
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useSaver } from "@/components/objekte/editor-primitives";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChannelBadge } from "@/components/ui/channel-badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  AMENITY_SLUGS,
  amenityLabel,
  BED_OPTIONS,
  HOTEL_TYPES,
  ROOM_OPTIONS,
  STATUS_OPTIONS,
  TYPE_LABELS,
  typeOptionsFor,
} from "@/lib/property-meta";
import {
  type Property,
  type PropertyInput,
  type PropertyStatus,
  type PropertyType,
  publishProperty,
  updateProperty,
} from "@/lib/properties";

type Section =
  | null
  | "name"
  | "info"
  | "rooms"
  | "beds"
  | "amenities"
  | "location";

// Typsichere Helfer für die flexiblen type_attributes.
function attrList(p: Property, key: string): string[] {
  const v = p.type_attributes?.[key];
  return Array.isArray(v) ? (v as string[]) : [];
}
function attrNum(p: Property, key: string): number | "" {
  const v = p.type_attributes?.[key];
  return typeof v === "number" ? v : "";
}

export function PropertyOverview({ initial }: { initial: Property }) {
  const router = useRouter();
  const [p, setP] = useState<Property>(initial);
  const [section, setSection] = useState<Section>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishMsg, setPublishMsg] = useState<string | null>(null);

  // PropertyRealtime (Layout) liefert nach externen Änderungen (anderer
  // Nutzer, Channex-Import) via router.refresh() frische Props — ohne Sync
  // bliebe die Übersicht für immer auf dem Mount-Stand. Während ein
  // Abschnitt bearbeitet wird, nicht hineinfunken.
  useEffect(() => {
    if (section === null) setP(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  async function save(input: PropertyInput) {
    const res = await updateProperty(p.id, input);
    if (res.ok) {
      setP(res.data);
      setSection(null);
      // Server-Components neu rendern (Layout-Kopf links: Titel/Status/Foto),
      // sonst zeigen Übersicht und linke Karte widersprüchliche Stände.
      router.refresh();
      return true;
    }
    return res.error;
  }

  async function onPublish() {
    setPublishing(true);
    setPublishMsg(null);
    const res = await publishProperty(p.id);
    setPublishing(false);
    if (res.ok) {
      setP(res.data);
      setPublishMsg("Veröffentlicht — mit den Buchungsportalen verbunden.");
      // Layout-Karte (status „Entwurf"→„Aktiv") ist eine separate Server-
      // Component → ohne refresh bliebe sie auf „Entwurf" stehen.
      router.refresh();
    } else {
      setPublishMsg(res.error);
    }
  }

  const sizeM2 = attrNum(p, "size_m2");
  const units = attrNum(p, "units");
  const rooms = attrList(p, "rooms");
  const beds = attrList(p, "beds");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-extrabold">Übersicht</h1>
        <div className="flex items-center gap-3">
          <span
            className={
              "rounded-full px-2.5 py-1 text-xs font-medium " +
              (p.status === "active"
                ? "bg-secondary text-secondary-foreground"
                : "bg-muted text-muted-foreground")
            }
          >
            {p.status === "active" ? "Aktiv" : "Entwurf"}
          </span>
          {p.status !== "active" && (
            <Button onClick={onPublish} disabled={publishing}>
              {publishing ? "Veröffentliche…" : "Veröffentlichen"}
            </Button>
          )}
        </div>
      </div>
      {publishMsg && (
        <p
          className={
            "text-sm " +
            (p.status === "active" ? "text-foreground" : "text-destructive")
          }
        >
          {publishMsg}
        </p>
      )}

      {/* Name & Beschreibung */}
      <SectionCard
        title="Name und Beschreibung"
        hint="Name, Typ und Beschreibung für dein Objekt."
        onEdit={() => setSection("name")}
      >
        <p className="font-medium">{p.title}</p>
        <p className="whitespace-pre-line text-sm text-muted-foreground">
          {p.description || "Noch keine Beschreibung."}
        </p>
      </SectionCard>

      {/* Rental info */}
      <SectionCard
        title="Objekt-Infos"
        hint="Die wichtigsten Eckdaten."
        onEdit={() => setSection("info")}
      >
        <ul className="text-sm text-muted-foreground">
          <li>{TYPE_LABELS[p.property_type]}</li>
          <li>
            {sizeM2 ? `${sizeM2} m² · ` : ""}
            {p.max_guests} Gäste{units ? ` · ${units} Einheit(en)` : ""}
          </li>
        </ul>
      </SectionCard>

      {/* Rooms */}
      <SectionCard
        title="Räume"
        hint="Welche Räume gibt es?"
        channel="local"
        onEdit={() => setSection("rooms")}
      >
        {rooms.length ? (
          <ul className="text-sm text-muted-foreground">
            {rooms.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Noch keine Räume.</p>
        )}
      </SectionCard>

      {/* Sleeping arrangements */}
      <SectionCard
        title="Schlafmöglichkeiten"
        hint="Welche Betten gibt es?"
        channel="local"
        onEdit={() => setSection("beds")}
      >
        {beds.length ? (
          <ul className="text-sm text-muted-foreground">
            {beds.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Noch keine Schlafmöglichkeiten.
          </p>
        )}
      </SectionCard>

      {/* Amenities */}
      <SectionCard
        title="Ausstattung"
        hint="Was bietet dein Objekt?"
        channel="ota"
        onEdit={() => setSection("amenities")}
      >
        {p.amenities.length ? (
          <div className="flex flex-wrap gap-2">
            {p.amenities.map((a) => (
              <span
                key={a}
                className="rounded-full bg-secondary px-3 py-1 text-xs"
              >
                {amenityLabel(a)}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Noch keine Ausstattung.
          </p>
        )}
      </SectionCard>

      {/* Location */}
      <SectionCard
        title="Standort"
        hint="Adresse des Objekts."
        channel="ota"
        onEdit={() => setSection("location")}
      >
        <p className="text-sm text-muted-foreground">
          {[p.street, p.house_number].filter(Boolean).join(" ")}
          {p.street && <br />}
          {[p.postal_code, p.city].filter(Boolean).join(" ")}
          {p.city && p.country ? ", " : ""}
          {p.country}
          {!p.street && !p.city && "Noch keine Adresse."}
        </p>
      </SectionCard>

      {/* --- Editoren --- */}
      <NameEditor
        open={section === "name"}
        p={p}
        onClose={() => setSection(null)}
        onSave={save}
      />
      <InfoEditor
        open={section === "info"}
        p={p}
        onClose={() => setSection(null)}
        onSave={save}
      />
      <ListEditor
        open={section === "rooms"}
        title="Räume bearbeiten"
        options={ROOM_OPTIONS}
        selected={rooms}
        onClose={() => setSection(null)}
        onSave={(vals) =>
          save({ type_attributes: { ...p.type_attributes, rooms: vals } })
        }
      />
      <ListEditor
        open={section === "beds"}
        title="Schlafmöglichkeiten bearbeiten"
        options={BED_OPTIONS}
        selected={beds}
        onClose={() => setSection(null)}
        onSave={(vals) =>
          save({ type_attributes: { ...p.type_attributes, beds: vals } })
        }
      />
      <AmenitiesEditor
        open={section === "amenities"}
        selected={p.amenities}
        onClose={() => setSection(null)}
        onSave={(vals) => save({ amenities: vals })}
      />
      <LocationEditor
        open={section === "location"}
        p={p}
        onClose={() => setSection(null)}
        onSave={save}
      />
    </div>
  );
}

// --- Bausteine -------------------------------------------------------------

// Label eines Formularfelds mit Kanal-Kennzeichnung (OTA vs. nur myNextDays).
function FieldLabel({
  htmlFor,
  channel,
  children,
}: {
  htmlFor?: string;
  channel: "ota" | "local";
  children: React.ReactNode;
}) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      <Label htmlFor={htmlFor}>{children}</Label>
      <ChannelBadge channel={channel} />
    </span>
  );
}

function SectionCard({
  title,
  hint,
  onEdit,
  channel,
  children,
}: {
  title: string;
  hint: string;
  onEdit: () => void;
  channel?: "ota" | "local";
  children: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg font-extrabold">{title}</h3>
            {channel && <ChannelBadge channel={channel} />}
          </div>
          <p className="text-sm text-muted-foreground">{hint}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`${title} bearbeiten`}
          onClick={onEdit}
          className="shrink-0 text-muted-foreground"
        >
          <Icon icon="ph:pencil-simple" className="size-4" />
        </Button>
      </div>
      <div>{children}</div>
    </Card>
  );
}

function EditorShell({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display text-xl font-extrabold">
            {title}
          </SheetTitle>
          <SheetDescription className="sr-only">{title}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 p-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

function SaveBar({
  busy,
  error,
  onSave,
  disabled,
}: {
  busy: boolean;
  error: string | null;
  onSave: () => void;
  disabled?: boolean;
}) {
  return (
    <>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button onClick={onSave} disabled={busy || disabled}>
        {busy ? "Speichern…" : "Speichern"}
      </Button>
    </>
  );
}

type SaveFn = (input: PropertyInput) => Promise<true | string>;

function NameEditor({
  open,
  p,
  onClose,
  onSave,
}: {
  open: boolean;
  p: Property;
  onClose: () => void;
  onSave: SaveFn;
}) {
  const [title, setTitle] = useState(p.title);
  const [desc, setDesc] = useState(p.description ?? "");
  const [platformDesc, setPlatformDesc] = useState(p.platform_description ?? "");
  const [type, setType] = useState<PropertyType>(p.property_type);
  const { busy, error, run } = useSaver(onSave);
  // Typ-Liste passend zur Objektwelt (0098): ein Zimmer bleibt in den
  // Zimmertypen, ein Ferienobjekt in den Ferienobjekt-Typen — kein
  // versehentlicher Wechsel zwischen den Welten.
  const typeOptions = typeOptionsFor(
    HOTEL_TYPES.includes(p.property_type) ? "hotel" : "vacation_rental",
  );

  return (
    <EditorShell open={open} onClose={onClose} title="Name und Beschreibung">
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="e-title" channel="ota">
          Name
        </FieldLabel>
        <Input
          id="e-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <FieldLabel channel="ota">Typ</FieldLabel>
        <Select value={type} onValueChange={(v) => setType(v as PropertyType)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {typeOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="e-desc" channel="ota">
          Beschreibung
        </FieldLabel>
        <Textarea
          id="e-desc"
          rows={6}
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Dieser Text wird an Booking.com, Airbnb &amp; Co. übertragen.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="e-platform-desc" channel="local">
          Beschreibung für die eigene Buchungsseite (optional)
        </FieldLabel>
        <Textarea
          id="e-platform-desc"
          rows={6}
          value={platformDesc}
          onChange={(e) => setPlatformDesc(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Leer lassen, um den OTA-Text auch auf der eigenen Seite zu zeigen.
        </p>
      </div>
      <SaveBar
        busy={busy}
        error={error}
        disabled={!title.trim()}
        onSave={() =>
          run({
            title,
            description: desc,
            platform_description: platformDesc || null,
            property_type: type,
          })
        }
      />
    </EditorShell>
  );
}

function InfoEditor({
  open,
  p,
  onClose,
  onSave,
}: {
  open: boolean;
  p: Property;
  onClose: () => void;
  onSave: SaveFn;
}) {
  const occ = (p.type_attributes?.occupancy ?? {}) as {
    children?: number;
    infants?: number;
    rooms?: number;
  };
  const [guests, setGuests] = useState(p.max_guests);
  const [children, setChildren] = useState<number>(occ.children ?? 0);
  const [infants, setInfants] = useState<number>(occ.infants ?? 0);
  const [rooms, setRooms] = useState<number>(occ.rooms ?? 1);
  const [size, setSize] = useState<number | "">(attrNum(p, "size_m2"));
  const [units, setUnits] = useState<number | "">(attrNum(p, "units"));
  const [status, setStatus] = useState<PropertyStatus>(p.status);
  const { busy, error, run } = useSaver(onSave);

  return (
    <EditorShell open={open} onClose={onClose} title="Objekt-Infos">
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="e-guests" channel="ota">
          Max. Gäste
        </FieldLabel>
        <Input
          id="e-guests"
          type="number"
          min={1}
          max={99}
          value={guests}
          onChange={(e) => setGuests(Number(e.target.value) || 1)}
        />
      </div>

      {/* Belegung — geht als Kapazität an die Buchungsportale (Room-Type-
          Belegung: Erwachsene/Kinder/Kleinkinder + Anzahl Zimmer). */}
      <div className="flex flex-col gap-2 rounded-2xl border p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">Belegung</span>
          <ChannelBadge channel="ota" />
        </div>
        <p className="text-xs text-muted-foreground">
          Erwachsenenplätze bieten Platz für Erwachsene und Kinder,
          Kinderplätze nur für Kinder. „Max. Gäste" (oben) sind die
          Erwachsenenplätze.
        </p>
        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="e-children">Kinderplätze</Label>
            <Input
              id="e-children"
              type="number"
              min={0}
              max={99}
              value={children}
              onChange={(e) => setChildren(Math.max(0, Number(e.target.value) || 0))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="e-infants">Kleinkindplätze</Label>
            <Input
              id="e-infants"
              type="number"
              min={0}
              max={99}
              value={infants}
              onChange={(e) => setInfants(Math.max(0, Number(e.target.value) || 0))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="e-rooms">Anzahl Zimmer</Label>
            <Input
              id="e-rooms"
              type="number"
              min={1}
              max={99}
              value={rooms}
              onChange={(e) => setRooms(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="e-size" channel="local">
          Größe (m²)
        </FieldLabel>
        <Input
          id="e-size"
          type="number"
          min={0}
          value={size}
          onChange={(e) =>
            setSize(e.target.value === "" ? "" : Number(e.target.value))
          }
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="e-units" channel="local">
          Einheiten
        </FieldLabel>
        <Input
          id="e-units"
          type="number"
          min={1}
          value={units}
          onChange={(e) =>
            setUnits(e.target.value === "" ? "" : Number(e.target.value))
          }
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <FieldLabel channel="local">Status</FieldLabel>
        <Select
          value={status}
          onValueChange={(v) => setStatus(v as PropertyStatus)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <SaveBar
        busy={busy}
        error={error}
        onSave={() =>
          run({
            max_guests: guests,
            status,
            type_attributes: {
              ...p.type_attributes,
              size_m2: size === "" ? undefined : size,
              units: units === "" ? undefined : units,
              occupancy: { children, infants, rooms },
            },
          })
        }
      />
    </EditorShell>
  );
}

function ListEditor({
  open,
  title,
  options,
  selected,
  onClose,
  onSave,
}: {
  open: boolean;
  title: string;
  options: string[];
  selected: string[];
  onClose: () => void;
  onSave: (vals: string[]) => Promise<true | string>;
}) {
  const [vals, setVals] = useState<string[]>(selected);
  const { busy, error, run } = useSaver(onSave);

  function toggle(v: string) {
    setVals((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]));
  }

  return (
    <EditorShell open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-2">
        {options.map((o) => (
          <label
            key={o}
            className="flex cursor-pointer items-center gap-3 rounded-(--radius) border p-3 text-sm"
          >
            <input
              type="checkbox"
              checked={vals.includes(o)}
              onChange={() => toggle(o)}
              className="size-4"
            />
            {o}
          </label>
        ))}
      </div>
      <SaveBar busy={busy} error={error} onSave={() => run(vals)} />
    </EditorShell>
  );
}

function AmenitiesEditor({
  open,
  selected,
  onClose,
  onSave,
}: {
  open: boolean;
  selected: string[];
  onClose: () => void;
  onSave: (vals: string[]) => Promise<true | string>;
}) {
  const [vals, setVals] = useState<string[]>(selected);
  const [query, setQuery] = useState("");
  const { busy, error, run } = useSaver(onSave);

  function add(v: string) {
    setVals((s) => (s.includes(v) ? s : [...s, v]));
    setQuery("");
  }
  function remove(v: string) {
    setVals((s) => s.filter((x) => x !== v));
  }

  // Suchleisten-Muster: Vorschläge erscheinen NUR bei aktiver Suche (301 auf
  // einmal wäre unübersichtlich). Bereits Gewähltes wird nicht vorgeschlagen.
  const q = query.trim().toLowerCase();
  const suggestions = q
    ? AMENITY_SLUGS.filter(
        (s) => !vals.includes(s) && amenityLabel(s).toLowerCase().includes(q),
      ).slice(0, 30)
    : [];

  return (
    <EditorShell open={open} onClose={onClose} title="Ausstattung bearbeiten">
      <p className="text-xs text-muted-foreground">
        Alle Ausstattungsmerkmale werden automatisch an die Buchungsportale
        (Booking.com, Airbnb &amp; Co.) übertragen.
      </p>

      {/* Gewählte Ausstattung — kompakt oben, mit ✕ zum Entfernen */}
      {vals.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {vals.map((slug) => (
            <span
              key={slug}
              className="inline-flex items-center gap-1.5 rounded-full border border-accent bg-accent px-3 py-1 text-xs text-accent-foreground"
            >
              {amenityLabel(slug)}
              <span className="rounded-full bg-accent-foreground/20 px-1 text-[0.6rem] font-semibold">
                OTA
              </span>
              <button
                type="button"
                onClick={() => remove(slug)}
                aria-label={`${amenityLabel(slug)} entfernen`}
                className="text-accent-foreground/70 hover:text-accent-foreground"
              >
                <Icon icon="ph:x" className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Suchleiste + Vorschlagsliste (Zeilen, keine Chip-Wolke) */}
      <div className="flex flex-col gap-0">
        <Input
          placeholder="Ausstattung suchen …"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {q && (
          <div className="mt-1 max-h-64 overflow-y-auto rounded-2xl border">
            {suggestions.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                Keine Treffer.
              </p>
            ) : (
              suggestions.map((slug) => (
                <button
                  key={slug}
                  type="button"
                  onClick={() => add(slug)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-secondary"
                >
                  <span className="flex items-center gap-2">
                    <Icon icon="ph:plus" className="size-3.5 text-muted-foreground" />
                    {amenityLabel(slug)}
                  </span>
                  <span className="rounded-full bg-secondary px-1.5 text-[0.6rem] font-semibold text-muted-foreground">
                    OTA
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <SaveBar busy={busy} error={error} onSave={() => run(vals)} />
    </EditorShell>
  );
}

function LocationEditor({
  open,
  p,
  onClose,
  onSave,
}: {
  open: boolean;
  p: Property;
  onClose: () => void;
  onSave: SaveFn;
}) {
  const [street, setStreet] = useState(p.street ?? "");
  const [houseNo, setHouseNo] = useState(p.house_number ?? "");
  const [zip, setZip] = useState(p.postal_code ?? "");
  const [city, setCity] = useState(p.city ?? "");
  const [country, setCountry] = useState(p.country ?? "");
  const { busy, error, run } = useSaver(onSave);

  return (
    <EditorShell open={open} onClose={onClose} title="Standort bearbeiten">
      <div className="grid grid-cols-[1fr_6rem] gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="e-street">Straße</Label>
          <Input
            id="e-street"
            value={street}
            onChange={(e) => setStreet(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="e-no">Nr.</Label>
          <Input
            id="e-no"
            value={houseNo}
            onChange={(e) => setHouseNo(e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-[8rem_1fr] gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="e-zip">PLZ</Label>
          <Input id="e-zip" value={zip} onChange={(e) => setZip(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="e-city">Stadt</Label>
          <Input
            id="e-city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="e-country">Land</Label>
        <Input
          id="e-country"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
        />
      </div>
      <SaveBar
        busy={busy}
        error={error}
        onSave={() =>
          run({
            street,
            house_number: houseNo,
            postal_code: zip,
            city,
            country,
          })
        }
      />
    </EditorShell>
  );
}
