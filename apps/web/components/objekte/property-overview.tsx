"use client";

// Objekt-Overview wie Lodgify: Kopf (Name/Status) + Sektionskarten
//  (Name & Beschreibung, Rental info, Rooms, Sleeping arrangements, Amenities,
//   Location). Jede Karte öffnet einen Sheet-Editor; gespeichert wird per
//  updateProperty(). Flexible Sektionen (rooms/beds/size/units) liegen in
//  type_attributes.
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  AMENITY_GROUPS,
  BED_OPTIONS,
  ROOM_OPTIONS,
  STATUS_OPTIONS,
  TYPE_LABELS,
  TYPE_OPTIONS,
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
        onEdit={() => setSection("amenities")}
      >
        {p.amenities.length ? (
          <div className="flex flex-wrap gap-2">
            {p.amenities.map((a) => (
              <span
                key={a}
                className="rounded-full bg-secondary px-3 py-1 text-xs"
              >
                {a}
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

function SectionCard({
  title,
  hint,
  onEdit,
  children,
}: {
  title: string;
  hint: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-display text-lg font-extrabold">{title}</h3>
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

function useEditor() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(fn: () => Promise<true | string>) {
    setBusy(true);
    setError(null);
    const r = await fn();
    setBusy(false);
    if (r !== true) setError(r);
  }
  return { busy, error, run };
}

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
  const [type, setType] = useState<PropertyType>(p.property_type);
  const { busy, error, run } = useEditor();

  return (
    <EditorShell open={open} onClose={onClose} title="Name und Beschreibung">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="e-title">Name</Label>
        <Input
          id="e-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Typ</Label>
        <Select value={type} onValueChange={(v) => setType(v as PropertyType)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="e-desc">Beschreibung</Label>
        <Textarea
          id="e-desc"
          rows={6}
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
        />
      </div>
      <SaveBar
        busy={busy}
        error={error}
        disabled={!title.trim()}
        onSave={() =>
          run(() =>
            onSave({ title, description: desc, property_type: type }),
          )
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
  const [guests, setGuests] = useState(p.max_guests);
  const [size, setSize] = useState<number | "">(attrNum(p, "size_m2"));
  const [units, setUnits] = useState<number | "">(attrNum(p, "units"));
  const [status, setStatus] = useState<PropertyStatus>(p.status);
  const { busy, error, run } = useEditor();

  return (
    <EditorShell open={open} onClose={onClose} title="Objekt-Infos">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="e-guests">Max. Gäste</Label>
        <Input
          id="e-guests"
          type="number"
          min={1}
          max={99}
          value={guests}
          onChange={(e) => setGuests(Number(e.target.value) || 1)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="e-size">Größe (m²)</Label>
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
        <Label htmlFor="e-units">Einheiten</Label>
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
        <Label>Status</Label>
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
          run(() =>
            onSave({
              max_guests: guests,
              status,
              type_attributes: {
                ...p.type_attributes,
                size_m2: size === "" ? undefined : size,
                units: units === "" ? undefined : units,
              },
            }),
          )
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
  const { busy, error, run } = useEditor();

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
      <SaveBar busy={busy} error={error} onSave={() => run(() => onSave(vals))} />
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
  const { busy, error, run } = useEditor();

  function toggle(v: string) {
    setVals((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]));
  }

  return (
    <EditorShell open={open} onClose={onClose} title="Ausstattung bearbeiten">
      {AMENITY_GROUPS.map((g) => (
        <div key={g.group} className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase text-muted-foreground">
            {g.group}
          </span>
          <div className="flex flex-wrap gap-2">
            {g.items.map((a) => {
              const on = vals.includes(a);
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => toggle(a)}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    on
                      ? "border-accent bg-accent text-accent-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {a}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <SaveBar busy={busy} error={error} onSave={() => run(() => onSave(vals))} />
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
  const { busy, error, run } = useEditor();

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
          run(() =>
            onSave({
              street,
              house_number: houseNo,
              postal_code: zip,
              city,
              country,
            }),
          )
        }
      />
    </EditorShell>
  );
}
