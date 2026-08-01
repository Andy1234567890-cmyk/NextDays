"use client";

// Objekt-Overview: Kopf (Name/Status) + Sektionskarten
//  (Name & Beschreibung, Rental info, Rooms, Sleeping arrangements, Amenities,
//   Location). Jede Karte öffnet einen Sheet-Editor; gespeichert wird per
//  updateProperty(). Flexible Sektionen (rooms/beds/size/units) liegen in
//  type_attributes.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useSaver } from "@/components/objekte/editor-primitives";
import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { ChannelBadge } from "@nextdays/ui/channel-badge";

import { useKanalZeilen } from "@/lib/use-kanal-felder";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@nextdays/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@nextdays/ui/sheet";
import { Textarea } from "@nextdays/ui/textarea";
import { BETT_ILLUSTRATION } from "@/components/objekte/bett-illustrationen";
import {
  AIRBNB_MERKMALE,
  AMENITY_CATALOG,
  AUSSTATTUNG_DUBLETTEN,
  AUSSTATTUNG_KATEGORIEN,
  AUSSTATTUNG_VON_SLUG,
  bedCount,
  EIGENE_AUSSTATTUNG,
  BED_SLUGS,
  HOTEL_TYPES,
  readBeds,
  ROOM_AMENITY_CATALOG,
  readZimmer,
  ROOM_AMENITY_SLUGS,
  STATUS_OPTIONS,
  type ZimmerZaehlwerk,
  ZIMMER_SLUGS,
  zimmerAnzahl,
} from "@/lib/property-meta";
import {
  useAmenityLabels,
  useRoomAmenityLabels,
} from "@/lib/use-amenity-labels";
import { usePropertyLabels } from "@/lib/use-property-labels";
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
  | "amenities";

// Icon je Ausstattungs-Kategorie (die 13 aus AUSSTATTUNG_KATEGORIEN).
const KATEGORIE_ICON: Record<string, string> = {
  wesentliches: "ph:star",
  bad_waschkueche: "ph:shower",
  unterhaltung: "ph:television-simple",
  heizung_klima: "ph:thermometer-simple",
  sicherheit: "ph:shield-check",
  internet_buero: "ph:wifi-high",
  kueche_esszimmer: "ph:cooking-pot",
  standort: "ph:map-pin",
  parkplaetze: "ph:car",
  konditionen: "ph:clipboard-text",
  pool_spa: "ph:swimming-pool",
  dienstleistungen: "ph:bell",
  sonstiges: "ph:dots-three-circle",
};

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
  const { typeLabel } = usePropertyLabels();
  const { amenityLabel } = useAmenityLabels();
  const { roomAmenityLabel } = useRoomAmenityLabels();
  const t = useTranslations("objects");
  const tb = useTranslations("beds");
  const tz = useTranslations("zimmer");
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
      setPublishMsg(t("propertyOverview.publishSuccess"));
      // Layout-Karte (status „Entwurf"→„Aktiv") ist eine separate Server-
      // Component → ohne refresh bliebe sie auf „Entwurf" stehen.
      router.refresh();
    } else {
      setPublishMsg(res.error);
    }
  }

  const sizeM2 = attrNum(p, "size_m2");
  const units = attrNum(p, "units");
  // rooms ist {privat, gemeinschaftlich}; readZimmer liest auch das Altformat
  // (string[] aus der alten Mehrfachauswahl).
  const zimmer = readZimmer(p.type_attributes?.rooms);
  // beds ist {slug: anzahl}; readBeds liest zusätzlich die beiden Altformate
  // (string[] aus der alten Auswahl, blanke Zahl aus einer früheren Wizard-Version).
  const beds = readBeds(p.type_attributes?.beds);
  const bedEintraege = Object.entries(beds);
  // Altbestand kennt die Spalte noch nicht (0243) → leer statt Absturz.
  const roomAmenities = p.room_amenities ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-extrabold">
          {t("propertyOverview.title")}
        </h1>
        <div className="flex items-center gap-3">
          <span
            className={
              "rounded-full px-2.5 py-1 text-xs font-medium " +
              (p.status === "active"
                ? "bg-secondary text-secondary-foreground"
                : "bg-muted text-muted-foreground")
            }
          >
            {p.status === "active"
              ? t("propertyOverview.statusActive")
              : t("propertyOverview.statusDraft")}
          </span>
          {p.status !== "active" && (
            <Button onClick={onPublish} disabled={publishing}>
              {publishing
                ? t("propertyOverview.publishing")
                : t("propertyOverview.publish")}
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
        title={t("propertyOverview.nameCardTitle")}
        hint={t("propertyOverview.nameCardHint")}
        onEdit={() => setSection("name")}
      >
        <p className="font-medium">{p.title}</p>
        <p className="whitespace-pre-line text-sm text-muted-foreground">
          {p.description || t("propertyOverview.noDescription")}
        </p>
      </SectionCard>

      {/* Rental info */}
      <SectionCard
        title={t("propertyOverview.infoCardTitle")}
        hint={t("propertyOverview.infoCardHint")}
        onEdit={() => setSection("info")}
      >
        <ul className="text-sm text-muted-foreground">
          <li>{typeLabel(p.property_type)}</li>
          <li>
            {sizeM2 ? t("propertyOverview.sizeM2Prefix", { size: sizeM2 }) : ""}
            {t("propertyOverview.guestsCount", { count: p.max_guests })}
            {units ? t("propertyOverview.unitsSuffix", { count: units }) : ""}
          </li>
        </ul>
      </SectionCard>

      {/* Rooms */}
      <SectionCard
        title={t("propertyOverview.roomsCardTitle")}
        hint={t("propertyOverview.roomsCardHint")}
        onEdit={() => setSection("rooms")}
      >
        {zimmerAnzahl(zimmer) ? (
          <ul className="flex flex-col gap-1 text-muted-foreground text-sm">
            {(["privat", "gemeinschaftlich"] as const).flatMap((ebene) =>
              Object.entries(zimmer[ebene]).map(([slug, anzahl]) => (
                <li key={`${ebene}:${slug}`}>
                  {anzahl}× {tz(slug)}
                  {ebene === "gemeinschaftlich"
                    ? ` (${t("propertyOverview.zimmerGemeinschaftlich")})`
                    : ""}
                </li>
              )),
            )}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("propertyOverview.noRooms")}
          </p>
        )}
      </SectionCard>

      {/* Sleeping arrangements */}
      <SectionCard
        title={t("propertyOverview.bedsCardTitle")}
        hint={t("propertyOverview.bedsCardHint")}
        onEdit={() => setSection("beds")}
      >
        {bedEintraege.length ? (
          <ul className="flex flex-col gap-2 text-muted-foreground text-sm">
            {bedEintraege.map(([slug, anzahl]) => {
              const Illustration = BETT_ILLUSTRATION[slug];
              return (
                <li key={slug} className="flex items-center gap-2">
                  {Illustration ? <Illustration className="size-4" /> : null}
                  <span>
                    {anzahl}× {tb(slug)}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("propertyOverview.noBeds")}
          </p>
        )}
      </SectionCard>

      {/* Amenities — ohne Kanal-Badge: welches Portal ein Merkmal kennt, steht
          im Editor an jeder einzelnen Zeile als Logo. Ein pauschaler Hinweis
          über der ganzen Karte sagte dasselbe unschärfer. */}
      <SectionCard
        title={t("propertyOverview.amenitiesCardTitle")}
        hint={t("propertyOverview.amenitiesCardHint")}
        onEdit={() => setSection("amenities")}
      >
        {p.amenities.length + roomAmenities.length ? (
          <div className="flex flex-wrap gap-2">
            {roomAmenities.map((a) => (
              <span
                key={`room:${a}`}
                className="rounded-full bg-secondary px-3 py-1 text-xs"
              >
                {roomAmenityLabel(a)}
              </span>
            ))}
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
            {t("propertyOverview.noAmenities")}
          </p>
        )}
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
      <ZimmerEditor
        open={section === "rooms"}
        zimmer={zimmer}
        onClose={() => setSection(null)}
        onSave={(vals) =>
          save({ type_attributes: { ...p.type_attributes, rooms: vals } })
        }
      />
      <BedsEditor
        open={section === "beds"}
        beds={beds}
        onClose={() => setSection(null)}
        onSave={(vals) =>
          save({ type_attributes: { ...p.type_attributes, beds: vals } })
        }
      />
      <AmenitiesEditor
        open={section === "amenities"}
        selected={p.amenities}
        selectedRoom={roomAmenities}
        onClose={() => setSection(null)}
        onSave={(vals, roomVals) =>
          save({ amenities: vals, room_amenities: roomVals })
        }
      />
    </div>
  );
}

// --- Bausteine -------------------------------------------------------------

// Label eines Formularfelds mit Kanal-Kennzeichnung.
//
// `feld` ist der Schlüssel aus lib/kanal-felder.ts: dann zeigt der Tooltip die
// Aufschlüsselung je Portal (Airbnb, Booking.com, myBestDays) statt nur „geht an
// die Portale". Ohne `feld` bleibt es beim groben Badge.
function FieldLabel({
  htmlFor,
  channel,
  feld,
  children,
}: {
  htmlFor?: string;
  channel: "ota" | "local";
  feld?: string;
  children: React.ReactNode;
}) {
  const kanaele = useKanalZeilen(feld ?? "");
  return (
    <span className="flex flex-wrap items-center gap-2">
      <Label htmlFor={htmlFor}>{children}</Label>
      <ChannelBadge channel={channel} kanaele={kanaele} />
    </span>
  );
}

function SectionCard({
  title,
  hint,
  onEdit,
  channel,
  feld,
  children,
}: {
  title: string;
  hint: string;
  onEdit: () => void;
  channel?: "ota" | "local";
  feld?: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("objects");
  const kanaele = useKanalZeilen(feld ?? "");
  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg font-extrabold">{title}</h3>
            {channel && <ChannelBadge channel={channel} kanaele={kanaele} />}
          </div>
          <p className="text-sm text-muted-foreground">{hint}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("propertyOverview.editCardAriaLabel", { title })}
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
  const t = useTranslations("objects");
  return (
    <>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button onClick={onSave} disabled={busy || disabled}>
        {busy ? t("propertyOverview.saving") : t("propertyOverview.save")}
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
  const { typeOptionsFor } = usePropertyLabels();
  const t = useTranslations("objects");
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
    <EditorShell
      open={open}
      onClose={onClose}
      title={t("propertyOverview.nameCardTitle")}
    >
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="e-title" channel="ota" feld="titel">
          {t("propertyOverview.nameFieldLabel")}
        </FieldLabel>
        <Input
          id="e-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <FieldLabel channel="ota">
          {t("propertyOverview.typeFieldLabel")}
        </FieldLabel>
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
        <FieldLabel htmlFor="e-desc" channel="ota" feld="beschreibung">
          {t("propertyOverview.descriptionFieldLabel")}
        </FieldLabel>
        <Textarea
          id="e-desc"
          rows={6}
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          {t("propertyOverview.descriptionOtaHint")}
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="e-platform-desc" channel="local" feld="plattformBeschreibung">
          {t("propertyOverview.platformDescriptionFieldLabel")}
        </FieldLabel>
        <Textarea
          id="e-platform-desc"
          rows={6}
          value={platformDesc}
          onChange={(e) => setPlatformDesc(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          {t("propertyOverview.platformDescriptionHint")}
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
  const t = useTranslations("objects");
  const belegungKanaele = useKanalZeilen("belegung");

  return (
    <EditorShell
      open={open}
      onClose={onClose}
      title={t("propertyOverview.infoCardTitle")}
    >
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="e-guests" channel="ota" feld="belegung">
          {t("propertyOverview.maxGuestsFieldLabel")}
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
          <span className="font-semibold">
            {t("propertyOverview.occupancyTitle")}
          </span>
          <ChannelBadge channel="ota" kanaele={belegungKanaele} />
        </div>
        <p className="text-xs text-muted-foreground">
          {t("propertyOverview.occupancyHint")}
        </p>
        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="e-children">
              {t("propertyOverview.childrenSlotsFieldLabel")}
            </Label>
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
            <Label htmlFor="e-infants">
              {t("propertyOverview.infantSlotsFieldLabel")}
            </Label>
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
            <Label htmlFor="e-rooms">
              {t("propertyOverview.roomsCountFieldLabel")}
            </Label>
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
        <FieldLabel htmlFor="e-size" channel="local" feld="groesseQm">
          {t("propertyOverview.sizeFieldLabel")}
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
          {t("propertyOverview.unitsFieldLabel")}
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
        <FieldLabel channel="local">
          {t("propertyOverview.statusFieldLabel")}
        </FieldLabel>
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

/** Zimmer: Zähler je Zimmerart, getrennt nach privat und gemeinschaftlich.
 *  Eine Wohnung hat 2 Schlafzimmer, nicht "Schlafzimmer ja/nein" — und in einer
 *  Anlage ist ein Gemeinschaftsbad etwas anderes als ein eigenes. */
function ZimmerEditor({
  open,
  zimmer,
  onClose,
  onSave,
}: {
  open: boolean;
  zimmer: ZimmerZaehlwerk;
  onClose: () => void;
  onSave: (vals: ZimmerZaehlwerk) => Promise<true | string>;
}) {
  const t = useTranslations("objects");
  const tz = useTranslations("zimmer");
  const [vals, setVals] = useState<ZimmerZaehlwerk>(zimmer);
  const [offen, setOffen] = useState<"privat" | "gemeinschaftlich" | null>(
    "privat",
  );
  const { busy, error, run } = useSaver(onSave);

  useEffect(() => {
    if (open) {
      setVals(zimmer);
      setOffen("privat");
    }
  }, [open, zimmer]);

  function setzen(
    ebene: "privat" | "gemeinschaftlich",
    slug: string,
    delta: number,
  ) {
    setVals((s) => {
      const next = Math.max(0, (s[ebene][slug] ?? 0) + delta);
      const kopie = { ...s[ebene] };
      if (next === 0) delete kopie[slug];
      else kopie[slug] = next;
      return { ...s, [ebene]: kopie };
    });
  }

  const ebenen = [
    { key: "privat" as const, icon: "ph:user" },
    { key: "gemeinschaftlich" as const, icon: "ph:users" },
  ];

  return (
    <EditorShell
      open={open}
      onClose={onClose}
      title={t("propertyOverview.roomsEditorTitle")}
    >
      <p className="mb-4 text-muted-foreground text-sm">
        {t("propertyOverview.zimmerHinweis")}
      </p>
      <div className="flex flex-col divide-y rounded-2xl border">
        {ebenen.map(({ key, icon }) => {
          const auf = offen === key;
          return (
            <div key={key}>
              <button
                type="button"
                onClick={() => setOffen(auf ? null : key)}
                aria-expanded={auf}
                className="flex w-full items-center gap-4 px-5 py-4 text-left"
              >
                <Icon
                  icon={icon}
                  className="size-[1.375rem] shrink-0 text-foreground"
                />
                <span className="flex-1 font-semibold text-[0.9375rem]">
                  {t(`propertyOverview.zimmer${key === "privat" ? "Privat" : "Gemeinschaftlich"}`)}
                </span>
                <Icon
                  icon={auf ? "ph:caret-up" : "ph:caret-down"}
                  className="size-[1.125rem] shrink-0 text-muted-foreground"
                />
              </button>
              {auf && (
                <div className="flex flex-col divide-y border-t">
                  {ZIMMER_SLUGS.map((slug) => {
                    const anzahl = vals[key][slug] ?? 0;
                    return (
                      <div
                        key={slug}
                        className="flex items-center gap-4 px-5 py-3"
                      >
                        <span className="flex-1 text-[0.9375rem]">
                          {tz(slug)}
                        </span>
                        <div className="flex items-center gap-3">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 bg-secondary text-secondary-foreground disabled:opacity-40"
                            disabled={anzahl === 0}
                            aria-label={t("propertyOverview.zimmerWeniger", {
                              room: tz(slug),
                            })}
                            onClick={() => setzen(key, slug, -1)}
                          >
                            <Icon icon="ph:minus" className="size-4" />
                          </Button>
                          <span
                            className="w-5 text-center text-[0.9375rem] tabular-nums"
                            aria-live="polite"
                          >
                            {anzahl}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 bg-secondary text-secondary-foreground"
                            aria-label={t("propertyOverview.zimmerMehr", {
                              room: tz(slug),
                            })}
                            onClick={() => setzen(key, slug, 1)}
                          >
                            <Icon icon="ph:plus" className="size-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <SaveBar busy={busy} error={error} onSave={() => run(vals)} />
    </EditorShell>
  );
}

/** Schlafgelegenheiten: Zähler je Bettentyp statt Ja/Nein-Auswahl — ein Objekt
 *  hat oft mehrere gleiche Betten (2 Einzelbetten), das trägt eine Checkbox nicht. */
function BedsEditor({
  open,
  beds,
  onClose,
  onSave,
}: {
  open: boolean;
  beds: Record<string, number>;
  onClose: () => void;
  onSave: (vals: Record<string, number>) => Promise<true | string>;
}) {
  const t = useTranslations("objects");
  const tb = useTranslations("beds");
  const tz = useTranslations("zimmer");
  const [vals, setVals] = useState<Record<string, number>>(beds);
  const { busy, error, run } = useSaver(onSave);

  // Beim Öffnen den gespeicherten Stand übernehmen — der Editor bleibt gemountet,
  // sonst zeigt er nach einem Abbrechen weiter die verworfenen Zahlen.
  useEffect(() => {
    if (open) setVals(beds);
  }, [open, beds]);

  function setzen(slug: string, delta: number) {
    setVals((s) => {
      const next = Math.max(0, (s[slug] ?? 0) + delta);
      const kopie = { ...s };
      if (next === 0) delete kopie[slug];
      else kopie[slug] = next;
      return kopie;
    });
  }

  const plaetze = bedCount(vals);

  return (
    <EditorShell
      open={open}
      onClose={onClose}
      title={t("propertyOverview.bedsEditorTitle")}
    >
      <p className="mb-4 text-muted-foreground text-sm">
        {t("propertyOverview.bedsEditorHint")}
      </p>
      <div className="flex flex-col divide-y rounded-(--radius) border">
        {BED_SLUGS.map((slug) => {
          const Illustration = BETT_ILLUSTRATION[slug];
          const anzahl = vals[slug] ?? 0;
          return (
            <div key={slug} className="flex items-center gap-4 p-4">
              <Illustration className="size-6 shrink-0 text-muted-foreground" />
              <span className="flex-1 text-sm">{tb(slug)}</span>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-8"
                  disabled={anzahl === 0}
                  aria-label={t("propertyOverview.bedsDecrease", {
                    bed: tb(slug),
                  })}
                  onClick={() => setzen(slug, -1)}
                >
                  <Icon icon="ph:minus" className="size-4" />
                </Button>
                <span
                  className="w-6 text-center text-sm tabular-nums"
                  aria-live="polite"
                >
                  {anzahl}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-8"
                  aria-label={t("propertyOverview.bedsIncrease", {
                    bed: tb(slug),
                  })}
                  onClick={() => setzen(slug, 1)}
                >
                  <Icon icon="ph:plus" className="size-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      {plaetze > 0 && (
        <p className="mt-3 text-muted-foreground text-sm">
          {t("propertyOverview.bedsSleeps", { count: plaetze })}
        </p>
      )}
      <SaveBar busy={busy} error={error} onSave={() => run(vals)} />
    </EditorShell>
  );
}

/** Zimmer-Ausstattung: eigener Katalog (Channex /room_facilities), nach
 *  Kategorien gegliedert. Anders als beim Objekt-Katalog keine Suchleiste —
 *  191 Merkmale in 7 klaren Kategorien blättert man schneller durch, als man
 *  „Klimaanlage" tippt, und man sieht dabei, was es überhaupt gibt. */
/** Ein Merkmal im Ausstattungs-Editor. `quelle` = der Channex-Katalog, aus dem
 *  es stammt; er entscheidet beim Speichern, ob es an die Property oder an den
 *  Room-Type geht. Für den Nutzer ist das unsichtbar. */
type AusstattungsEintrag = {
  slug: string;
  label: string;
  quelle: "room" | "property";
};

/** Ausstattung — EIN Editor für beide Channex-Kataloge.
 *
 *  Channex führt zwei Kataloge mit eigenen UUIDs: /property_facilities (301,
 *  hängt am Objekt) und /room_facilities (191, hängt am Zimmer). Für den Nutzer
 *  ist das EINE Ausstattung: er hakt "Klimaanlage" an, wir entscheiden, an
 *  welchen der beiden Kataloge das geht. Deshalb eine Karte, ein Editor, und
 *  die Katalog-Trennung passiert unsichtbar beim Speichern.
 *
 *  Aufbau nach Airbnb-Vorbild: Suchfeld, aufklappbare Kategorien, Checkboxen,
 *  Portal-Logo an den Merkmalen, die das Portal kennt. */
function AmenitiesEditor({
  open,
  selected,
  selectedRoom,
  onClose,
  onSave,
}: {
  open: boolean;
  selected: string[];
  selectedRoom: string[];
  onClose: () => void;
  onSave: (
    vals: string[],
    roomVals: string[],
  ) => Promise<true | string>;
}) {
  const t = useTranslations("objects");
  const { amenityLabel } = useAmenityLabels();
  const { roomAmenityLabel } = useRoomAmenityLabels();
  const tk = useTranslations("amenityCategories");
  const teigen = useTranslations("eigeneAusstattung");
  const [vals, setVals] = useState<string[]>(selected);
  const [roomVals, setRoomVals] = useState<string[]>(selectedRoom);
  const [query, setQuery] = useState("");
  const [offen, setOffen] = useState<string | null>(null);
  const { busy, error, run } = useSaver(
    (paar: [string[], string[]]) => onSave(paar[0], paar[1]),
  );

  useEffect(() => {
    if (open) {
      setVals(selected);
      setRoomVals(selectedRoom);
      setQuery("");
      setOffen(null);
    }
  }, [open, selected, selectedRoom]);

  // Beide Kataloge in EINER Liste. `quelle` merkt sich, in welchen Channex-
  // Katalog ein Merkmal gehört — der Nutzer sieht davon nichts.
  // Gliederung nach den 13 Kategorien. Beide Channex-Kataloge speisen dieselbe
  // Liste; ein Merkmal, das in beiden vorkommt (30 Titel), erscheint genau
  // EINMAL — der Zimmer-Katalog gewinnt, weil er näher am Zimmer liegt.
  const gruppen: {
    key: string;
    titel: string;
    icon: string;
    eintraege: AusstattungsEintrag[];
  }[] = (() => {
    const gesehen = new Set<string>();
    const nachKategorie = new Map<string, AusstattungsEintrag[]>();
    const einsortieren = (
      slug: string,
      label: string,
      quelle: "room" | "property",
    ) => {
      // Dublette (gleiches Merkmal in beiden Channex-Katalogen) → überspringen.
      // Feste Slug-Paarung statt Namensvergleich: beim ersten Render sind die
      // Übersetzungen noch nicht da, dann wäre der Name der Slug selbst.
      if (AUSSTATTUNG_DUBLETTEN[slug]) return;
      if (gesehen.has(slug)) return;
      gesehen.add(slug);
      const kat = AUSSTATTUNG_VON_SLUG[slug] ?? "sonstiges";
      const liste = nachKategorie.get(kat) ?? [];
      liste.push({ slug, label, quelle });
      nachKategorie.set(kat, liste);
    };
    for (const g of ROOM_AMENITY_CATALOG) {
      for (const slug of g.slugs) {
        einsortieren(slug, roomAmenityLabel(slug), "room");
      }
    }
    for (const g of AMENITY_CATALOG) {
      for (const slug of g.slugs) {
        einsortieren(slug, amenityLabel(slug), "property");
      }
    }
    // Eigene Merkmale (kein Channex-Gegenstück) — landen beim Speichern in
    // room_amenities, gehen aber nicht an die Portale.
    for (const slug of EIGENE_AUSSTATTUNG) {
      einsortieren(slug, teigen(slug), "room");
    }
    return AUSSTATTUNG_KATEGORIEN.filter((k) => nachKategorie.get(k)?.length)
      .map((k) => ({
        key: k,
        titel: tk(k),
        icon: KATEGORIE_ICON[k] ?? "ph:squares-four",
        eintraege: (nachKategorie.get(k) ?? []).sort((a, b) =>
          a.label.localeCompare(b.label),
        ),
      }));
  })();

  function gewaehlt(e: AusstattungsEintrag) {
    return e.quelle === "room"
      ? roomVals.includes(e.slug)
      : vals.includes(e.slug);
  }

  function toggle(e: AusstattungsEintrag) {
    const an = !gewaehlt(e);
    const umschalten = (liste: string[], slug: string) =>
      an
        ? liste.includes(slug)
          ? liste
          : [...liste, slug]
        : liste.filter((x) => x !== slug);
    const setzen = e.quelle === "room" ? setRoomVals : setVals;
    setzen((liste) => umschalten(liste, e.slug));
    // Der ausgeblendete Zwilling (gleiches Merkmal im anderen Channex-Katalog)
    // wird mitgeschaltet — sonst ginge seine UUID beim Sync verloren und das
    // Merkmal käme nur auf einer der beiden Ebenen bei den Portalen an.
    for (const [dublette, haupt] of Object.entries(AUSSTATTUNG_DUBLETTEN)) {
      if (haupt !== e.slug) continue;
      const imZimmer = ROOM_AMENITY_SLUGS.includes(dublette);
      const mit = imZimmer ? setRoomVals : setVals;
      mit((liste) => umschalten(liste, dublette));
    }
  }

  // Suche blendet die Kategorien aus und zeigt die Treffer flach — wie im
  // Vorbild. Ohne Suche bleiben die Kategorien zugeklappt.
  const q = query.trim().toLowerCase();
  const treffer = q
    ? gruppen
      .flatMap((g) => g.eintraege)
      .filter((e) => e.label.toLowerCase().includes(q))
      .slice(0, 60)
    : [];

  return (
    <EditorShell
      open={open}
      onClose={onClose}
      title={t("propertyOverview.amenitiesEditorTitle")}
    >
      <div className="relative">
        <Icon
          icon="ph:magnifying-glass"
          className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground"
        />
        <Input
          className="pl-9"
          placeholder={t("propertyOverview.amenitiesSearchPlaceholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {q ? (
        <div className="flex flex-col divide-y rounded-2xl border">
          {treffer.length === 0 ? (
            <p className="px-4 py-3 text-muted-foreground text-sm">
              {t("propertyOverview.noSearchResults")}
            </p>
          ) : (
            treffer.map((e) => (
              <AusstattungZeile
                key={`${e.quelle}:${e.slug}`}
                label={e.label}
                checked={gewaehlt(e)}
                airbnb={AIRBNB_MERKMALE.has(e.slug)}
                onToggle={() => toggle(e)}
              />
            ))
          )}
        </div>
      ) : (
        <div className="flex flex-col divide-y rounded-2xl border">
          {gruppen.map((g) => {
            const anzahl = g.eintraege.filter(gewaehlt).length;
            const auf = offen === g.key;
            return (
              <div key={g.key}>
                <button
                  type="button"
                  onClick={() => setOffen(auf ? null : g.key)}
                  aria-expanded={auf}
                  className="flex w-full items-center gap-4 px-5 py-4 text-left"
                >
                  <Icon
                    icon={g.icon}
                    className="size-[1.375rem] shrink-0 text-foreground"
                  />
                  <span className="flex-1 font-semibold text-[0.9375rem]">
                    {g.titel}
                    {anzahl > 0 && (
                      <span className="ml-2 font-normal text-muted-foreground">
                        {anzahl}
                      </span>
                    )}
                  </span>
                  <Icon
                    icon={auf ? "ph:caret-up" : "ph:caret-down"}
                    className="size-[1.125rem] shrink-0 text-muted-foreground"
                  />
                </button>
                {auf && (
                  <div className="flex flex-col divide-y border-t">
                    {g.eintraege.map((e) => (
                      <AusstattungZeile
                        key={`${e.quelle}:${e.slug}`}
                        label={e.label}
                        checked={gewaehlt(e)}
                        airbnb={AIRBNB_MERKMALE.has(e.slug)}
                        onToggle={() => toggle(e)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <SaveBar
        busy={busy}
        error={error}
        onSave={() => run([vals, roomVals])}
      />
    </EditorShell>
  );
}

/** Eine Ausstattungs-Zeile: Checkbox links, Label, Portal-Logos rechts.
 *  Die Logos zeigen, welches Portal das Merkmal kennt — jedes Channex-Merkmal
 *  geht an beide, deshalb stehen beide Logos an jeder Zeile. */
function AusstattungZeile({
  label,
  checked,
  airbnb,
  onToggle,
}: {
  label: string;
  checked: boolean;
  airbnb: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-4 px-5 py-3.5 hover:bg-secondary/50">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="size-[1.125rem] shrink-0 accent-foreground"
      />
      <span className="flex-1 font-medium text-[0.9375rem]">{label}</span>
      {/* Airbnb-Zeichen nur an den Merkmalen, die Airbnb kennt (Vorgabe). */}
      {airbnb && (
        <img
          src="/channels/airbnb-mark.svg"
          alt="Airbnb"
          title="Airbnb"
          className="size-4 shrink-0"
        />
      )}
    </label>
  );
}

