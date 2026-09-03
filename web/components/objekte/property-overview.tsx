"use client";

// Objekt-Overview: Kopf (Name/Status) + Sektionskarten
//  (Name & Beschreibung, Rental info, Rooms, Sleeping arrangements, Amenities,
//   Location). Jede Karte öffnet einen Sheet-Editor; gespeichert wird per
//  updateProperty(). Zimmer sind seit 0246 eine eigene Entitaet (ZimmerSektion);
//  die uebrigen flexiblen Sektionen (beds/size) liegen in type_attributes.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useSaver } from "@/components/objekte/editor-primitives";
import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { ChannelBadge } from "@nextdays/ui/channel-badge";

import {
  DeaktivierenDialog,
  VeroeffentlichenDialog,
} from "@/components/objekte/veroeffentlichen-dialog";
import { useKanalZeilen } from "@/lib/use-kanal-felder";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import { NativeSelect } from "@nextdays/ui/native-select";
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
import {
  BettenSektion,
  ZimmerSektion,
} from "@/components/objekte/zimmer-sektion";
import {
  AIRBNB_MERKMALE,
  AMENITY_CATALOG,
  AUSSTATTUNG_DUBLETTEN,
  AUSSTATTUNG_KATEGORIEN,
  AUSSTATTUNG_VON_SLUG,
  EIGENE_AUSSTATTUNG,
  EIGENE_AUSSTATTUNG_OBJEKT,
  HOTEL_TYPES,
  ROOM_AMENITY_CATALOG,
  ROOM_AMENITY_SLUGS,
  readBeds,
  STATUS_OPTIONS,
} from "@/lib/property-meta";
import {
  useAmenityLabels,
  useRoomAmenityLabels,
} from "@/lib/use-amenity-labels";
import { usePropertyLabels } from "@/lib/use-property-labels";
import {
  type Property,
  type PropertyInput,
  type PropertyType,
  publishProperty,
  updateProperty,
} from "@/lib/properties";

type Section = null | "name" | "info" | "amenities";

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

export function PropertyOverview({ initial }: { initial: Property }) {
  const { typeLabel } = usePropertyLabels();
  const { amenityLabel } = useAmenityLabels();
  const { roomAmenityLabel } = useRoomAmenityLabels();
  const t = useTranslations("objects");
  const router = useRouter();
  const [p, setP] = useState<Property>(initial);
  const [section, setSection] = useState<Section>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishMsg, setPublishMsg] = useState<string | null>(null);
  // Der Veröffentlichen-Dialog (Kanäle wählen → prüfen → freigeben) und die
  // Rückfrage beim Deaktivieren. Getrennt, weil es zwei verschiedene Vorgänge
  // sind: der eine zeigt, WOHIN es geht, der andere fragt nur nach.
  const [dialogOffen, setDialogOffen] = useState(false);
  const [deaktivierenOffen, setDeaktivierenOffen] = useState(false);
  // Fehler des Veröffentlichen-Aufrufs — IM Dialog, nicht auf der Seite
  // dahinter (dort bleibt er unsichtbar, solange der Dialog offen ist).
  const [dialogFehler, setDialogFehler] = useState<string | null>(null);

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

  // `kanaele` kommt aus dem Dialog. Der Backend-Aufruf nimmt die Auswahl noch
  // nicht entgegen — publish() schaltet weiterhin alle verbundenen Kanäle. Die
  // Liste hier nicht zu verschweigen ist Absicht: sobald der Endpunkt sie
  // annimmt, wird sie durchgereicht, ohne die Oberfläche anzufassen.
  async function onPublish(_kanaele: string[] = []) {
    setPublishing(true);
    setPublishMsg(null);
    setDialogFehler(null);
    const res = await publishProperty(p.id);
    setPublishing(false);
    if (res.ok) {
      setP(res.data);
      setDialogOffen(false);
      setPublishMsg(t("propertyOverview.publishSuccess"));
      // Layout-Karte (status „Entwurf"→„Aktiv") ist eine separate Server-
      // Component → ohne refresh bliebe sie auf „Entwurf" stehen.
      router.refresh();
    } else {
      // IM Dialog zeigen, nicht dahinter: der Dialog bleibt offen, also sah
      // der Betrieb die Meldung auf der Seite nie. „Nichts passiert" ist die
      // schlechteste Rückmeldung — der Grund (z. B. fehlendes Abo) ist
      // umsetzbar, wenn man ihn liest.
      setDialogFehler(res.error);
      setPublishMsg(res.error);
    }
  }

  /** Objekt aus dem Verkauf nehmen — nach ausdrücklicher Bestätigung. */
  async function onDeaktivieren() {
    setPublishing(true);
    setPublishMsg(null);
    const res = await updateProperty(p.id, { status: "inactive" });
    setPublishing(false);
    setDeaktivierenOffen(false);
    if (res.ok) {
      setP(res.data);
      router.refresh();
    } else {
      setPublishMsg(res.error);
    }
  }

  const flaeche = p.size_value;
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
          {/* Der Knopf öffnet den Dialog, statt sofort zu senden: erst zeigen,
              wohin es geht und was sich dort ändert. */}
          {p.status !== "active" ? (
            <Button onClick={() => setDialogOffen(true)} disabled={publishing}>
              {publishing
                ? t("propertyOverview.publishing")
                : t("propertyOverview.publish")}
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => setDeaktivierenOffen(true)}
              disabled={publishing}
            >
              {t("veroeffentlichen.deaktivieren")}
            </Button>
          )}
        </div>
      </div>

      <VeroeffentlichenDialog
        propertyId={p.id}
        open={dialogOffen}
        onClose={() => {
          setDialogOffen(false);
          setDialogFehler(null);
        }}
        onPublish={onPublish}
        busy={publishing}
        fehler={dialogFehler}
      />
      <DeaktivierenDialog
        open={deaktivierenOffen}
        onClose={() => setDeaktivierenOffen(false)}
        onBestaetigen={onDeaktivieren}
        busy={publishing}
        titel={p.title}
      />
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
            {flaeche
              ? t(
                  p.size_unit === "sqft"
                    ? "propertyOverview.sizeSqftPrefix"
                    : "propertyOverview.sizeM2Prefix",
                  { size: flaeche },
                )
              : ""}
            {t("propertyOverview.guestsCount", { count: p.max_guests })}
          </li>
        </ul>
      </SectionCard>

      {/* Zimmer — eigene Zeilen in property_rooms (0246), deshalb eigene
          Komponente mit eigenem Laden und Realtime-Abo statt einer Sektion
          über type_attributes. Die Schlafgelegenheiten liegen dagegen am
          Objekt und speichern über dasselbe save() wie die übrigen Karten
          (0251). */}
      <ZimmerSektion propertyId={p.id} />
      <BettenSektion
        beds={readBeds(p.type_attributes?.beds)}
        onSave={(beds) =>
          save({ type_attributes: { ...p.type_attributes, beds } })
        }
      />

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
// Die Reichweite wird AUS DER MATRIX abgeleitet, nicht je Aufrufstelle
// behauptet. Vorher standen `channel` und `feld` nebeneinander: die sichtbare
// Aufschrift kam aus dem handgetippten `channel`, die Aufschlüsselung im
// Tooltip aus `feld` — nichts hielt beide zusammen. Live stand deshalb an
// „Typ" die Aufschrift „Booking, Airbnb & Co.", während die Matrix darunter
// `objekttyp` bei Airbnb als `bedingt` und bei Booking.com als `unklar` führt.
// Ein Feld ohne Matrix-Eintrag bekommt gar kein Badge, statt eine Reichweite
// zu behaupten, für die es keine Quelle gibt (Wurzel 4).
function FieldLabel({
  htmlFor,
  feld,
  required,
  children,
}: {
  htmlFor?: string;
  feld?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  const kanaele = useKanalZeilen(feld ?? "");
  return (
    <span className="flex flex-wrap items-center gap-2">
      <Label htmlFor={htmlFor}>
        {children}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {kanaele.length > 0 && <ChannelBadge kanaele={kanaele} />}
    </span>
  );
}

// Fläche in m² oder ft². Gespeichert statt umgerechnet: der Wert ist die
// Angabe des Gastgebers, keine Messung — eine Umrechnung würde eine
// Genauigkeit vortäuschen, die die Angabe nicht hat.
type FlaechenEinheit = "sqm" | "sqft";

/** Zahl mit Minus/Plus statt Tippfeld — wie im Vorbild. Die Tastatureingabe
 *  bleibt möglich, damit große Werte nicht erklickt werden müssen. */
function Stepper({
  id,
  value,
  min,
  max,
  onChange,
  ariaLess,
  ariaMore,
}: {
  id: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  ariaLess: string;
  ariaMore: string;
}) {
  const setzen = (v: number) => onChange(Math.min(max, Math.max(min, v)));
  return (
    <div className="flex items-center gap-3">
      <Button
        variant="ghost"
        size="icon"
        className="size-9 bg-secondary text-secondary-foreground disabled:opacity-40"
        disabled={value <= min}
        aria-label={ariaLess}
        onClick={() => setzen(value - 1)}
      >
        <Icon icon="ph:minus" className="size-4" />
      </Button>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        value={value}
        className="w-20 text-center"
        onChange={(e) => setzen(Number(e.target.value) || min)}
      />
      <Button
        variant="ghost"
        size="icon"
        className="size-9 bg-secondary text-secondary-foreground disabled:opacity-40"
        disabled={value >= max}
        aria-label={ariaMore}
        onClick={() => setzen(value + 1)}
      >
        <Icon icon="ph:plus" className="size-4" />
      </Button>
    </div>
  );
}

function SectionCard({
  title,
  hint,
  onEdit,
  feld,
  children,
}: {
  title: string;
  hint: string;
  onEdit: () => void;
  /** Schlüssel aus lib/kanal-felder.ts — trägt allein die Reichweite. */
  feld?: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("objects");
  const kanaele = useKanalZeilen(feld ?? "");
  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg font-extrabold">{title}</h3>
            {kanaele.length > 0 && <ChannelBadge kanaele={kanaele} />}
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
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display text-xl font-extrabold">
            {title}
          </SheetTitle>
          <SheetDescription className={subtitle ? "" : "sr-only"}>
            {subtitle ?? title}
          </SheetDescription>
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
  const t = useTranslations("objects");
  const [title, setTitle] = useState(p.title);
  const [desc, setDesc] = useState(p.description ?? "");
  const [platformDesc, setPlatformDesc] = useState(p.platform_description ?? "");
  const { busy, error, run } = useSaver(onSave);

  return (
    <EditorShell
      open={open}
      onClose={onClose}
      title={t("propertyOverview.nameCardTitle")}
    >
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="e-title" feld="titel">
          {t("propertyOverview.nameFieldLabel")}
        </FieldLabel>
        <Input
          id="e-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="e-desc" feld="beschreibung">
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
        <FieldLabel htmlFor="e-platform-desc" feld="plattformBeschreibung">
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
  };
  const { typeOptionsFor } = usePropertyLabels();
  const [type, setType] = useState<PropertyType>(p.property_type);
  const [guests, setGuests] = useState(p.max_guests);
  const [children, setChildren] = useState<number>(occ.children ?? 0);
  const [infants, setInfants] = useState<number>(occ.infants ?? 0);
  const [size, setSize] = useState<number | "">(p.size_value ?? "");
  // Maßeinheit der Fläche. Gespeichert, nicht abgeleitet: wer in ft² denkt,
  // soll auch ft² sehen — umgerechnet wird nichts (der eingegebene Wert ist
  // die Angabe des Gastgebers, kein Messwert, Wurzel 4).
  const [einheit, setEinheit] = useState<FlaechenEinheit>(
    p.size_unit === "sqft" ? "sqft" : "sqm",
  );
  // Nur zur Anzeige — geändert wird der Status über „Veröffentlichen".
  const status = p.status;
  const { busy, error, run } = useSaver(onSave);
  const t = useTranslations("objects");
  const belegungKanaele = useKanalZeilen("belegung");
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
      title={t("propertyOverview.infoEditorTitle")}
      subtitle={t("propertyOverview.infoEditorSubtitle")}
    >
      {/* Reihenfolge wie im Vorbild: Typ → Maßeinheit → Größe → Gäste. Der
          Unterkunftstyp stand vorher in der Namens-Karte; er gehört zu den
          Eckdaten, nicht zum Text. */}
      <div className="flex flex-col gap-1.5">
        <FieldLabel feld="objekttyp">
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
        {/* Dieselbe Reichweite wie die Fläche: Airbnb liefert `listing_size`
            mit Wert UND Einheit, deshalb derselbe Matrix-Eintrag. */}
        <FieldLabel htmlFor="e-unit" feld="groesseQm">
          {t("propertyOverview.masseinheitLabel")}
        </FieldLabel>
        <NativeSelect
          id="e-unit"
          value={einheit}
          onChange={(e) => setEinheit(e.target.value as FlaechenEinheit)}
        >
          <option value="sqm">{t("propertyOverview.masseinheitQm")}</option>
          <option value="sqft">{t("propertyOverview.masseinheitQft")}</option>
        </NativeSelect>
      </div>

      {/* Größe ist Pflicht — ohne sie kann weder die eigene Strecke noch der
          Marktplatz das Objekt sauber ausweisen. Leer lassen heißt hier NICHT
          „0", sondern „nicht speicherbar" (Wurzel 4).

          Die Einheit steht NICHT in der Aufschrift: sie wird eine Zeile höher
          eingestellt. Vorher hatte `sizeFieldLabel` „(m²)" in allen 24 Sprachen
          fest eingebrannt — wer auf ft² umstellte, las darunter weiter „Größe
          (m²)". Eine Angabe, zwei Quellen, und die zweite log. */}
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="e-size" feld="groesseQm" required>
          {t("propertyOverview.sizeFieldLabel")}
        </FieldLabel>
        <div className="relative">
          <Input
            id="e-size"
            type="number"
            min={1}
            value={size}
            className="pr-12"
            onChange={(e) =>
              setSize(e.target.value === "" ? "" : Number(e.target.value))
            }
          />
          {/* Rein schmückend — die Einheit ist über die Auswahl oben bedienbar
              und wird dort auch vorgelesen. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground"
          >
            {t(
              einheit === "sqft"
                ? "propertyOverview.masseinheitQft"
                : "propertyOverview.masseinheitQm",
            )}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="e-guests" feld="belegung">
          {t("propertyOverview.maxGuestsFieldLabel")}
        </FieldLabel>
        <Stepper
          id="e-guests"
          value={guests}
          min={1}
          max={99}
          onChange={setGuests}
          ariaLess={t("propertyOverview.gaesteWeniger")}
          ariaMore={t("propertyOverview.gaesteMehr")}
        />
      </div>

      {/* Belegung — geht als Kapazität an die Buchungsportale (Room-Type-
          Belegung: Erwachsene/Kinder/Kleinkinder). KEINE Zimmer-/Einheitenzahl:
          Channex' count_of_rooms ist die Obergrenze, wie oft das Objekt am
          selben Tag verkaufbar ist (live belegt: ein höherer availability-Push
          wird darauf gekappt). Bei „1 Objekt = 1 Einheit" ist das immer 1. */}
      <div className="flex flex-col gap-2 rounded-2xl border p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">
            {t("propertyOverview.occupancyTitle")}
          </span>
          <ChannelBadge kanaele={belegungKanaele} />
        </div>
        <p className="text-xs text-muted-foreground">
          {t("propertyOverview.occupancyHint")}
        </p>
        <div className="grid grid-cols-2 gap-2">
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
        </div>
      </div>

      {/* Status wird hier nur ANGEZEIGT, nicht geändert.
          Vorher stand hier ein Dropdown — ein zweiter Weg zum selben Zustand,
          und der stille: Ein Wechsel auf „Aktiv" erreichte die Portale gar
          nicht, weil `properties.status` im Channel-Manager nirgends gelesen
          wird. Bei Airbnb blieben alle Objekte auf „Unlisted".
          Verkaufen/Deaktivieren entscheidet der Betrieb jetzt oben über
          „Veröffentlichen" — dort sieht er, WOHIN es geht und WAS sich bei den
          Portalen ändert (Wurzel 9: ein Zustand, ein Weg). */}
      <div className="flex flex-col gap-1.5">
        <Label>{t("propertyOverview.statusFieldLabel")}</Label>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
            {STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status}
          </span>
          <span className="text-xs text-muted-foreground">
            {t("veroeffentlichen.statusHinweis")}
          </span>
        </div>
      </div>
      <SaveBar
        busy={busy}
        error={error}
        disabled={size === "" || size <= 0}
        onSave={() =>
          run({
            property_type: type,
            max_guests: guests,
            // KEIN `status` — der wird über „Veröffentlichen"/„Deaktivieren"
            // gesetzt. Mitzusenden hieße, dass ein Speichern der Eckdaten den
            // Verkaufszustand mitverändert (Wurzel 1).
            size_value: size === "" ? null : size,
            // Einheit nur mit einer Fläche — eine Einheit ohne Wert ist keine
            // Aussage (Wurzel 4).
            size_unit: size === "" ? null : einheit,
            type_attributes: {
              ...p.type_attributes,
              occupancy: { children, infants },
            },
          })
        }
      />
    </EditorShell>
  );
}

/** Zimmer: Zähler je Zimmerart, getrennt nach privat und gemeinschaftlich.
 *  Eine Wohnung hat 2 Schlafzimmer, nicht "Schlafzimmer ja/nein" — und in einer
 *  Anlage ist ein Gemeinschaftsbad etwas anderes als ein eigenes. */
type AusstattungsEintrag = {
  slug: string;
  label: string;
  quelle: "room" | "property";
};

/** Ausstattung — EIN Editor für beide Channex-Kataloge. */
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
    // Merkmale ohne Channex-Gegenstück. Die Spalte folgt derselben Zuordnung,
    // nach der der Airbnb-Import schreibt — sonst prüft `gewaehlt()` die andere
    // Spalte und die Checkbox bleibt leer, obwohl der Wert in der DB steht.
    for (const slug of EIGENE_AUSSTATTUNG) {
      einsortieren(
        slug,
        teigen(slug),
        EIGENE_AUSSTATTUNG_OBJEKT.has(slug) ? "property" : "room",
      );
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

