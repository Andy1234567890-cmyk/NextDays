"use client";

// Objekt-Wizard (Airbnb-„Become a Host"-Flow). Vollbild, ein Schritt pro Screen,
// Draft wird beim ersten Weiter angelegt (POST) und danach je Schritt gepatcht.
import { currencyForCountry, LAENDER } from "@nextdays/laender";
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Input } from "@nextdays/ui/input";
import { NativeSelect } from "@nextdays/ui/native-select";
import { Textarea } from "@nextdays/ui/textarea";

import { AdressSuche, type PlacesAddress } from "@/components/objekt-editor/adress-suche";
import { AMENITY_KATALOG } from "@/components/objekt-editor/amenity-katalog";
import { normalisiere } from "@/components/objekt-editor/amenity-panel";
import { LageKarte } from "@/components/objekt-editor/lage-panel";
import { WizardFotos, wizardRaeume } from "./wizard-fotos";
import {
  createProperty,
  updateProperty,
} from "@/lib/properties-actions";
import { WizardShell } from "./wizard-shell";
import { ChoiceCard, GridTile, StepperRow } from "./wizard-primitives";

// Wizard-State (alle Schritt-Daten in einem Objekt).
interface WizardData {
  property_type: string;
  privacy_type: string;
  country: string;
  street: string;
  house_number: string;
  postal_code: string;
  city: string;
  // Aus der Places-Auswahl. null = von Hand getippt, dann kennt nur der Server
  // die Lage (Geocoding beim Speichern) — nie einen Ersatzwert erfinden (Wurzel 4).
  lat: number | null;
  lng: number | null;
  max_guests: number;
  bedrooms: number;
  beds: number;
  bathrooms_private: number;
  bathrooms_shared: number;
  occupancy: string[];
  amenities: string[];
  photos: string[];
  title: string;
  description: string;
  booking_mode: "instant" | "request";
  base_price: number;
  weekly_discount: boolean;
  monthly_discount: boolean;
}

// Icons pro Objekttyp — jeder Typ eindeutig (keine Duplikate, keine Lücken).
// Solar hat kein Zelt/Boot → dafür Phosphor (ph, gleicher Duotone-Stil).
// Zimmertypen als unterscheidbare Bett-Serie (mdi: single/double/king).
const TYPES = [
  { key: "ferienhaus", icon: "solar:home-2-bold-duotone" },
  { key: "appartement", icon: "solar:buildings-2-bold-duotone" },
  { key: "glamping", icon: "ph:tent-duotone" },
  { key: "tiny_house", icon: "solar:home-smile-bold-duotone" },
  { key: "hausboot", icon: "ph:sailboat-duotone" },
  { key: "einzelzimmer", icon: "mdi:bed-single" },
  { key: "doppelzimmer", icon: "mdi:bed-double" },
  { key: "suite", icon: "mdi:bed-king" },
] as const;

// Unterkunftsart (Schritt 2) — je Typ ein eigenes Icon: ganze Unterkunft = Haus,
// ein Zimmer = Bett, Gemeinschaftszimmer = Personengruppe. Nicht dreimal dasselbe.
const PRIVACY_ICON = {
  entire: "solar:home-bold-duotone",
  room: "solar:bed-bold-duotone",
  shared: "solar:users-group-rounded-bold-duotone",
} as const;


const OCCUPANCY = [
  // "ich", nicht "me": so heisst der Schluessel in allen 45 Sprachdateien
  // (wizard.belegung.ich). Der Dreher warf MISSING_MESSAGE und liess die Kachel
  // unbeschriftet — der Wert war dadurch nie waehlbar, steht also in keiner Zeile.
  { key: "ich", icon: "solar:user-bold-duotone" },
  { key: "familie", icon: "solar:user-heart-bold-duotone" },
  { key: "andere", icon: "solar:users-group-two-rounded-bold-duotone" },
  { key: "mitbewohner", icon: "solar:user-hands-bold-duotone" },
] as const;

// Dieselbe Ordnung wie im Objekt-Editor (ausstattung-panel.tsx) — der Gastgeber
// soll den Katalog im Wizard und spaeter im Editor gleich sortiert wiederfinden.
const AMENITY_KATEGORIEN = [
  "Beliebt", "Küche & Essen", "Bad", "Schlafzimmer & Wäsche", "Unterhaltung",
  "Familie", "Außenbereich", "Wellness & Sport", "Parken & Anreise",
  "Sicherheit", "Barrierefreiheit", "Services", "Sonstiges",
];

// Airbnb verlangt 5 Fotos je Inserat; zusaetzlich fordern wir mindestens eins
// JE RAUM — ein Inserat mit fuenf Bildern derselben Kueche zeigt dem Gast nicht,
// was er bucht.
const MIN_FOTOS = 5;

const TOTAL = 15;

export function ObjektWizard() {
  const t = useTranslations("wizard");
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [d, setD] = useState<WizardData>({
    property_type: "",
    privacy_type: "",
    country: "DE",
    street: "",
    house_number: "",
    postal_code: "",
    city: "",
    lat: null,
    lng: null,
    max_guests: 2,
    bedrooms: 1,
    beds: 1,
    bathrooms_private: 1,
    bathrooms_shared: 0,
    occupancy: [],
    amenities: [],
    photos: [],
    title: "",
    description: "",
    booking_mode: "request",
    base_price: 0,
    weekly_discount: false,
    monthly_discount: false,
  });

  const set = <K extends keyof WizardData>(k: K, v: WizardData[K]) =>
    setD((p) => ({ ...p, [k]: v }));

  // Treffer aus der Places-Suche in die Einzelfelder uebernehmen. Ein Feld, das
  // Google nicht liefert, wird NICHT geleert (Wurzel 1: der Gegenzustand zaehlt) —
  // wer Strasse und Nr. schon getippt hat und dann die Stadt sucht, verliert sie
  // sonst. `country` nur setzen, wenn Places ein ISO-2 liefert, sonst bliebe die
  // Waehrung an einem leeren Land haengen.
  function uebernehmeAdresse(a: PlacesAddress) {
    setD((p) => ({
      ...p,
      street: a.street || p.street,
      house_number: a.houseNumber || p.house_number,
      postal_code: a.postalCode || p.postal_code,
      city: a.city || p.city,
      country: a.country || p.country,
      lat: a.lat,
      lng: a.lng,
    }));
  }

  // Fotos (Schritt 9). `fotoAnzahl` ist die ECHTE Zahl aus property_photos —
  // nicht die Laenge von d.photos, die nur den alten Spiegel hielt.
  const [raumFotos, setRaumFotos] = useState<Record<string, string>>({});
  // Sammelkachel „Weitere Fotos": mehrere URLs je Raum.
  const [raumGalerie, setRaumGalerie] = useState<Record<string, string[]>>({});
  const [fotoAnzahl, setFotoAnzahl] = useState(0);

  // Ausstattungs-Suche (Schritt 8). 301 Merkmale sind ohne Suche unbenutzbar.
  const [amenitySuche, setAmenitySuche] = useState("");
  // Start auf „Beliebt" (15 Merkmale), nicht auf allen 301: der Wizard soll
  // eine Auswahl zeigen, die man ueberblickt. Wer mehr will, tippt in die Suche
  // oder waehlt eine Kategorie — beides steht direkt darueber.
  const [amenityKategorie, setAmenityKategorie] = useState("Beliebt");

  const amenityGruppen = useMemo(() => {
    const q = normalisiere(amenitySuche.trim());
    const map = new Map<string, typeof AMENITY_KATALOG>();
    for (const a of AMENITY_KATALOG) {
      // Sobald gesucht wird, gilt die Suche fuer den GANZEN Katalog. Sonst
      // faende „Sauna" nichts, solange die Kachel „Beliebt" aktiv ist — der
      // Nutzer haette den Eintrag fuer nicht vorhanden gehalten.
      if (!q && amenityKategorie !== "alle" && a.kategorie !== amenityKategorie) continue;
      if (q && !normalisiere(a.label).includes(q)) continue;
      const liste = map.get(a.kategorie) ?? [];
      liste.push(a);
      map.set(a.kategorie, liste);
    }
    return AMENITY_KATEGORIEN.filter((k) => map.has(k)).map((k) => ({
      kategorie: k,
      eintraege: map.get(k) as typeof AMENITY_KATALOG,
    }));
  }, [amenitySuche, amenityKategorie]);

  const fotoRaeume = useMemo(
    () =>
      wizardRaeume(d.bedrooms, d.bathrooms_private, d.bathrooms_shared, (k) => t(k)),
    [d.bedrooms, d.bathrooms_private, d.bathrooms_shared, t],
  );

  // Jeder Raum belegt UND die Gesamtzahl erreicht.
  const fotosVollstaendig =
    fotoRaeume.every((r) =>
      r.mehrere ? (raumGalerie[r.id]?.length ?? 0) > 0 : !!raumFotos[r.id],
    ) && fotoAnzahl >= MIN_FOTOS;

  const currency = currencyForCountry(d.country);

  // Ob der aktuelle Schritt „Weiter" erlaubt (Pflichtfelder).
  function canNext(): boolean {
    switch (step) {
      case 1:
        return !!d.property_type;
      case 2:
        return !!d.privacy_type;
      case 3:
        // `country` allein reicht NICHT: es steht per Vorgabe auf "DE", also war
        // „Weiter" auch bei komplett leerer Adresse aktiv. Verlangt werden die
        // Felder, ohne die ein Objekt nicht auffindbar ist — Strasse, Ort, Land.
        // Hausnummer und PLZ bleiben frei: laendliche Adressen haben oft keine.
        return (
          !!d.country && d.street.trim().length > 0 && d.city.trim().length > 0
        );
      case 9:
        return fotosVollstaendig;
      case 10:
        return d.title.trim().length > 0;
      case 13:
        return d.base_price > 0;
      default:
        return true;
    }
  }

  // Persistiert den aktuellen Stand (create beim ersten Mal, sonst patch).
  async function persist(): Promise<boolean> {
    const type_attributes = {
      privacy_type: d.privacy_type,
      bedrooms: d.bedrooms,
      beds: d.beds,
      bathrooms_private: d.bathrooms_private,
      bathrooms_shared: d.bathrooms_shared,
      // Reisetyp-Tags („Wer wohnt hier?") — eigener Key, damit sie NICHT mit dem
      // Belegungs-Objekt type_attributes.occupancy {rooms,children,infants}
      // kollidieren, das der Channex-Content-Sync liest (content_sync.py).
      occupancyTags: d.occupancy,
      // Dieselbe Ablage wie im Objekt-Editor: raumId → URL des Raum-Titelbilds.
      // Ohne sie stuenden die Fotos zwar in property_photos, aber die Fototour
      // im Editor waere leer — der Gastgeber muesste alles neu zuordnen.
      roomPhotos: raumFotos,
      roomGallery: raumGalerie,
    };
    const fields: Record<string, unknown> = {
      title: d.title || t("titel_step.titel"),
      property_type: d.property_type || "ferienhaus",
      max_guests: d.max_guests,
      currency,
      country: d.country,
      city: d.city || undefined,
      street: d.street || undefined,
      house_number: d.house_number || undefined,
      postal_code: d.postal_code || undefined,
      // Nur mitschicken, wenn sie aus einer echten Places-Auswahl stammen.
      ...(d.lat != null && d.lng != null ? { lat: d.lat, lng: d.lng } : {}),
      platform_description: d.description || undefined,
      amenities: d.amenities,
      photos: d.photos,
      booking_mode: d.booking_mode,
      type_attributes,
    };

    if (!propertyId) {
      const res = await createProperty({
        title: fields.title as string,
        property_type: fields.property_type as string,
        max_guests: d.max_guests,
        currency,
        country: d.country,
        city: d.city || undefined,
      });
      if (!res.ok) {
        toast.error(res.error);
        return false;
      }
      setPropertyId(res.data.id);
      // Restliche Felder direkt nachpatchen.
      await updateProperty(res.data.id, fields);
      return true;
    }
    const res = await updateProperty(propertyId, fields);
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    return true;
  }

  async function next() {
    // Ab Schritt 1 (Typ gewählt) speichern wir bei jedem Weiter.
    if (step >= 1) {
      setSaving(true);
      const ok = await persist();
      setSaving(false);
      if (!ok) return;
    }
    if (step >= TOTAL) {
      // Fertig → zur Objekt-Detailseite.
      if (propertyId) router.push(`/objekte/${propertyId}`);
      else router.push("/objekte");
      return;
    }
    setStep((s) => s + 1);
  }

  function back() {
    if (step <= 1) {
      router.push("/objekte");
      return;
    }
    setStep((s) => s - 1);
  }

  function toggle(list: string[], key: string): string[] {
    return list.includes(key) ? list.filter((x) => x !== key) : [...list, key];
  }

  return (
    <WizardShell
      breit={step === 8}
      step={step}
      total={TOTAL}
      canNext={canNext()}
      onBack={back}
      onNext={next}
      saving={saving}
      nextLabel={step === TOTAL ? t("abschluss.zumObjekt") : undefined}
    >
      {/* 1 — Objekttyp */}
      {step === 1 && (
        <Step title={t("typ.titel")}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {TYPES.map((ty) => (
              <GridTile
                key={ty.key}
                label={t(`typ.${ty.key}`)}
                icon={ty.icon}
                selected={d.property_type === ty.key}
                onClick={() => set("property_type", ty.key)}
              />
            ))}
          </div>
        </Step>
      )}

      {/* 2 — Privacy */}
      {step === 2 && (
        <Step title={t("privacy.titel")}>
          <div className="space-y-3">
            {(["entire", "room", "shared"] as const).map((p) => (
              <ChoiceCard
                key={p}
                title={t(`privacy.${p}`)}
                description={t(`privacy.${p}Hint`)}
                icon={PRIVACY_ICON[p]}
                selected={d.privacy_type === p}
                onClick={() => set("privacy_type", p)}
              />
            ))}
          </div>
        </Step>
      )}

      {/* 3 — Adresse */}
      {step === 3 && (
        <Step title={t("adresse.titel")} subtitle={t("adresse.untertitel")}>
          <div className="space-y-4">
            <Field label={t("adresse.land")}>
              <NativeSelect
                value={d.country}
                onChange={(e) => set("country", e.target.value)}
              >
                {LAENDER.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <div className="grid grid-cols-[1fr_6rem] gap-3">
              <Field label={t("adresse.strasse")}>
                <AdressSuche
                  value={d.street}
                  onChange={(v) => set("street", v)}
                  onPick={uebernehmeAdresse}
                  placeholder={t("adresse.suchePlatzhalter")}
                />
              </Field>
              <Field label={t("adresse.hausnummer")}>
                <Input
                  value={d.house_number}
                  onChange={(e) => set("house_number", e.target.value)}
                />
              </Field>
            </div>
            <div className="grid grid-cols-[8rem_1fr] gap-3">
              <Field label={t("adresse.plz")}>
                <Input
                  value={d.postal_code}
                  onChange={(e) => set("postal_code", e.target.value)}
                />
              </Field>
              <Field label={t("adresse.stadt")}>
                <Input value={d.city} onChange={(e) => set("city", e.target.value)} />
              </Field>
            </div>
          </div>
        </Step>
      )}

      {/* 4 — Karten-Pin: echte Karte, Pin ziehbar. Ohne Koordinaten (Adresse von
          Hand getippt statt aus der Places-Auswahl) gibt es nichts zu zeigen —
          dann die Adresse nennen und sagen, WARUM keine Karte da ist, statt eine
          Karte auf einen erfundenen Mittelpunkt zu setzen (Wurzel 4). */}
      {step === 4 && (
        <Step title={t("pin.titel")} subtitle={t("pin.untertitel")}>
          {d.lat != null && d.lng != null ? (
            <>
              <div className="aspect-video overflow-hidden rounded-2xl border border-border">
                <LageKarte
                  lat={d.lat}
                  lng={d.lng}
                  onVerschoben={(lat, lng) => setD((p) => ({ ...p, lat, lng }))}
                />
              </div>
              <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Icon icon="solar:map-point-bold-duotone" className="size-5 shrink-0" />
                {[d.street, d.house_number].filter(Boolean).join(" ")}
                {d.postal_code || d.city ? `, ${d.postal_code} ${d.city}`.trim() : ""}
              </p>
            </>
          ) : (
            <div className="flex aspect-video items-center justify-center rounded-2xl border border-border bg-muted text-center text-sm text-muted-foreground">
              <div className="px-6">
                <Icon
                  icon="solar:map-point-bold-duotone"
                  className="mx-auto mb-2 size-10"
                />
                {[d.street, d.house_number].filter(Boolean).join(" ")},{" "}
                {d.postal_code} {d.city}
                <p className="mt-2 text-xs">{t("pin.ohneKoordinaten")}</p>
              </div>
            </div>
          )}
        </Step>
      )}

      {/* 5 — Kapazität */}
      {step === 5 && (
        <Step title={t("kapazitaet.titel")}>
          <p className="mb-2 font-medium">{t("kapazitaet.frage")}</p>
          <StepperRow
            label={t("kapazitaet.gaeste")}
            value={d.max_guests}
            onChange={(v) => set("max_guests", v)}
            min={1}
            max={50}
          />
          <StepperRow
            label={t("kapazitaet.schlafzimmer")}
            value={d.bedrooms}
            onChange={(v) => set("bedrooms", v)}
            min={0}
          />
          <StepperRow
            label={t("kapazitaet.betten")}
            value={d.beds}
            onChange={(v) => set("beds", v)}
            min={1}
          />
        </Step>
      )}

      {/* 6 — Bäder */}
      {step === 6 && (
        <Step title={t("baeder.titel")}>
          <StepperRow
            label={t("baeder.privat")}
            hint={t("baeder.privatHint")}
            value={d.bathrooms_private}
            onChange={(v) => set("bathrooms_private", v)}
          />
          <StepperRow
            label={t("baeder.gemeinsam")}
            hint={t("baeder.gemeinsamHint")}
            value={d.bathrooms_shared}
            onChange={(v) => set("bathrooms_shared", v)}
          />
        </Step>
      )}

      {/* 7 — Belegung */}
      {step === 7 && (
        <Step title={t("belegung.titel")} subtitle={t("belegung.untertitel")}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {OCCUPANCY.map((o) => (
              <GridTile
                key={o.key}
                label={t(`belegung.${o.key}`)}
                icon={o.icon}
                selected={d.occupancy.includes(o.key)}
                onClick={() => set("occupancy", toggle(d.occupancy, o.key))}
              />
            ))}
          </div>
        </Step>
      )}

      {/* 8 — Ausstattung */}
      {step === 8 && (
        <Step title={t("ausstattung.titel")} subtitle={t("ausstattung.untertitel")}>
          {/* Suche + Kategorie-Chips: derselbe Katalog wie im Objekt-Editor
              (AMENITY_KATALOG, 301 Merkmale = Channex-Slugs). Ohne Suche waere
              die Liste unbenutzbar, und eine eigene Kurzliste im Wizard hiesse,
              dass ein Gastgeber hier weniger auswaehlen kann als spaeter im
              Editor — dieselbe Quelle, dieselben Slugs. */}
          {/* Suche oben, darunter zwei Spalten: Kategorien links als Liste,
              Treffer rechts. Die 14 Kategorien als Chip-Wolke brauchten mehrere
              Zeilen und sprangen beim Umschalten um — eine feste Spalte steht
              still und macht die aktive Kategorie auf einen Blick sichtbar. */}
          <div className="mb-4 flex items-center gap-2 rounded-full border border-border px-4 py-2.5 focus-within:border-foreground">
            <Icon icon="ph:magnifying-glass" className="size-5 shrink-0 opacity-60" />
            <input
              type="search"
              value={amenitySuche}
              onChange={(e) => setAmenitySuche(e.target.value)}
              placeholder={t("ausstattung.suchePlatzhalter")}
              className="w-full bg-transparent outline-none"
            />
          </div>

          <div className="flex gap-5">
            {/* Kategorien — bei aktiver Suche ausgegraut, weil dann der ganze
                Katalog durchsucht wird und die Auswahl nichts einschraenkt. */}
            <nav
              className={`hidden w-44 shrink-0 sm:block ${
                amenitySuche.trim() ? "pointer-events-none opacity-40" : ""
              }`}
            >
              <ul className="max-h-[min(22rem,calc(100svh-27rem))] space-y-0.5 overflow-y-auto pr-1">
                {["alle", ...AMENITY_KATEGORIEN].map((k) => (
                  <li key={k}>
                    <button
                      type="button"
                      onClick={() => setAmenityKategorie(k)}
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                        amenityKategorie === k
                          ? "bg-muted font-medium"
                          : "text-muted-foreground hover:bg-muted/50"
                      }`}
                    >
                      {k === "alle" ? t("ausstattung.alle") : k}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="min-w-0 flex-1">
              {/* Auf schmalen Schirmen bleibt die Chip-Zeile: eine Spalte
                  daneben passt dort nicht. */}
              <div
                className={`mb-3 flex gap-2 overflow-x-auto pb-1 sm:hidden ${
                  amenitySuche.trim() ? "pointer-events-none opacity-40" : ""
                }`}
              >
                {["alle", ...AMENITY_KATEGORIEN].map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setAmenityKategorie(k)}
                    className={`shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                      amenityKategorie === k
                        ? "border-foreground bg-foreground text-background"
                        : "border-border"
                    }`}
                  >
                    {k === "alle" ? t("ausstattung.alle") : k}
                  </button>
                ))}
              </div>

              {amenityGruppen.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {t("ausstattung.keinTreffer", { suche: amenitySuche })}
                </p>
              ) : (
                <div className="max-h-[min(22rem,calc(100svh-27rem))] space-y-6 overflow-y-auto pr-1">
                  {amenityGruppen.map((g) => (
                    <div key={g.kategorie}>
                      {/* Gruppen-Titel nur, wenn mehrere Gruppen kommen (Suche
                          oder „Alle") — sonst stuende er doppelt zur Spalte. */}
                      {amenityGruppen.length > 1 && (
                        <p className="mb-3 text-sm font-medium text-muted-foreground">
                          {g.kategorie}
                        </p>
                      )}
                      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                        {g.eintraege.map((a) => (
                          <GridTile
                            key={a.key}
                            label={a.label}
                            icon={a.icon}
                            selected={d.amenities.includes(a.key)}
                            onClick={() => set("amenities", toggle(d.amenities, a.key))}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {d.amenities.length > 0 && (
            <p className="mt-6 text-sm text-muted-foreground">
              {t("ausstattung.gewaehlt", { n: d.amenities.length })}
            </p>
          )}
        </Step>
      )}

      {/* 9 — Fotos: je Raum eine Kachel, jede braucht mindestens ein Bild. */}
      {step === 9 && (
        <Step title={t("fotos.titel")} subtitle={t("fotos.untertitel")}>
          <WizardFotos
            propertyId={propertyId}
            raeume={fotoRaeume}
            zuordnung={raumFotos}
            onZuordnung={(raumId, url) =>
              setRaumFotos((p) => {
                const next = { ...p };
                if (url) next[raumId] = url;
                // Gegenzustand mitpflegen (Wurzel 1): ohne das Loeschen bliebe
                // der Raum als „fertig" markiert, obwohl sein Foto weg ist.
                else delete next[raumId];
                return next;
              })
            }
            zuordnungMehrere={raumGalerie}
            onMehrere={(raumId, urls) =>
              setRaumGalerie((p) => ({
                ...p,
                [raumId]: [...(p[raumId] ?? []), ...urls],
              }))
            }
            onMehrereEntfernen={(raumId, url) =>
              setRaumGalerie((p) => ({
                ...p,
                [raumId]: (p[raumId] ?? []).filter((u) => u !== url),
              }))
            }
            onAnzahl={setFotoAnzahl}
          />
          <p className="mt-4 text-sm text-muted-foreground">
            {t("fotos.anzahl", { n: fotoAnzahl, min: MIN_FOTOS })}
          </p>
          {!fotosVollstaendig && (
            <p className="mt-1 text-sm text-muted-foreground">
              {t("fotos.nochOffen", {
                raeume: fotoRaeume.filter((r) =>
                  r.mehrere
                    ? (raumGalerie[r.id]?.length ?? 0) === 0
                    : !raumFotos[r.id],
                ).length,
              })}
            </p>
          )}
        </Step>
      )}

      {/* 10 — Titel */}
      {step === 10 && (
        <Step title={t("titel_step.titel")} subtitle={t("titel_step.untertitel")}>
          <Textarea
            value={d.title}
            maxLength={50}
            onChange={(e) => set("title", e.target.value)}
            className="min-h-32"
          />
          <p className="mt-2 text-sm text-muted-foreground tabular-nums">
            {d.title.length}/50
          </p>
        </Step>
      )}

      {/* 11 — Beschreibung */}
      {step === 11 && (
        <Step title={t("beschreibung.titel")} subtitle={t("beschreibung.untertitel")}>
          <Textarea
            value={d.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder={t("beschreibung.platzhalter")}
            className="min-h-40"
          />
        </Step>
      )}

      {/* 12 — Buchungsmodus */}
      {step === 12 && (
        <Step title={t("buchungsmodus.titel")}>
          <div className="space-y-3">
            <ChoiceCard
              title={t("buchungsmodus.request")}
              description={t("buchungsmodus.requestHint")}
              icon="solar:calendar-mark-bold-duotone"
              selected={d.booking_mode === "request"}
              onClick={() => set("booking_mode", "request")}
            />
            <ChoiceCard
              title={t("buchungsmodus.instant")}
              description={t("buchungsmodus.instantHint")}
              icon="solar:bolt-bold-duotone"
              selected={d.booking_mode === "instant"}
              onClick={() => set("booking_mode", "instant")}
            />
          </div>
        </Step>
      )}

      {/* 13 — Preis */}
      {step === 13 && (
        <Step title={t("preis.titel")} subtitle={t("preis.untertitel")}>
          <Field label={`${t("preis.basispreis")} (${currency || "—"})`}>
            <Input
              type="number"
              min={1}
              value={d.base_price || ""}
              onChange={(e) => set("base_price", Number(e.target.value))}
              className="text-2xl"
            />
          </Field>
        </Step>
      )}

      {/* 14 — Rabatte */}
      {step === 14 && (
        <Step title={t("rabatte.titel")} subtitle={t("rabatte.untertitel")}>
          <div className="space-y-3">
            <DiscountRow
              label={t("rabatte.wochen")}
              hint={t("rabatte.wochenHint")}
              percent={7}
              checked={d.weekly_discount}
              onToggle={() => set("weekly_discount", !d.weekly_discount)}
            />
            <DiscountRow
              label={t("rabatte.monat")}
              hint={t("rabatte.monatHint")}
              percent={15}
              checked={d.monthly_discount}
              onToggle={() => set("monthly_discount", !d.monthly_discount)}
            />
          </div>
          <p className="mt-4 text-xs text-muted-foreground">{t("rabatte.hinweis")}</p>
        </Step>
      )}

      {/* 15 — Abschluss */}
      {step === 15 && (
        <Step title={t("abschluss.titel")} subtitle={t("abschluss.untertitel")}>
          <div className="flex items-center justify-center py-10">
            <Icon
              icon="solar:check-circle-bold-duotone"
              className="size-20 text-emerald-500"
            />
          </div>
        </Step>
      )}
    </WizardShell>
  );
}

function Step({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-balance font-display text-3xl font-semibold leading-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

function DiscountRow({
  label,
  hint,
  percent,
  checked,
  onToggle,
}: {
  label: string;
  hint: string;
  percent: number;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex w-full items-center gap-4 rounded-2xl border p-5 text-start transition-colors ${
        checked ? "border-foreground bg-muted/40" : "border-border"
      }`}
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-border font-semibold tabular-nums">
        {percent}%
      </span>
      <span className="flex-1">
        <span className="block font-medium">{label}</span>
        <span className="block text-sm text-muted-foreground">{hint}</span>
      </span>
      <span
        className={`flex size-6 items-center justify-center rounded-md border ${
          checked ? "border-foreground bg-foreground text-background" : "border-border"
        }`}
      >
        {checked && <Icon icon="solar:check-read-linear" className="size-4" />}
      </span>
    </button>
  );
}
