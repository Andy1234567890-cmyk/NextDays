"use client";

// Objekttyp-Editor im Airbnb-„Property type"-Stil (mit myNextDays-Farben). Drei
// ABHÄNGIGE Dropdowns als umrandete Cards mit schwebendem Label:
//   Kategorie ("Welcher Ort ähnelt Ihrem am meisten?")
//     → Immobilientyp (gefiltert nach Kategorie)
//       → Angebotsart (gefiltert nach Immobilientyp: Ganzer Ort / Zimmer / geteilt)
// Bei „Hotel & Betriebe" zusätzlich „Wie viele Zimmer insgesamt?". Darunter
// Etagen-Stepper, Baujahr, Wohnfläche+Einheit. Taxonomie aus der DB (0198),
// NICHTS hartkodiert außer den Angebotsart-/Zimmeranzahl-Labels.
import { Icon } from "@iconify/react";
import { useEffect, useMemo, useState } from "react";

import type { ListingType, Property } from "@/lib/properties";
import { getTaxonomy, type Taxonomy } from "@/lib/taxonomie";

// Angebotsart-Label (Airbnb „Listing type").
const LISTING_LABEL: Record<ListingType, string> = {
  entire_place: "Der gesamte Ort",
  private_room: "Zimmer",
  shared_room: "Geteiltes Zimmer",
};

// Zimmeranzahl-Buckets (nur „Hotel & Betriebe", Airbnb).
const ZIMMER_BUCKETS = ["2-5", "6-10", "11-20", "21-30", "31-40", "41-50", "50+"];

// Kategorie, bei der das Zimmeranzahl-Feld erscheint.
const HOTEL_KATEGORIE = "hotel_betrieb";

type Entwurf = {
  subtype_slug: string | null;
  listing_type: ListingType | null;
  total_rooms: string | null;
  floors_total: number | null;
  floor_number: number | null;
  year_built: number | null;
  size_value: number | null;
  size_unit: string | null;
};

export function TypPanel({
  property,
  onSpeichere,
}: {
  property: Property;
  onSpeichere: (fields: Partial<Property>) => Promise<boolean>;
}) {
  const [tax, setTax] = useState<Taxonomy | null>(null);
  const [busy, setBusy] = useState(false);
  const [kategorie, setKategorie] = useState<string>("");
  const [d, setD] = useState<Entwurf>({
    subtype_slug: property.subtype_slug,
    listing_type: property.listing_type,
    total_rooms: property.total_rooms,
    floors_total: property.floors_total,
    floor_number: property.floor_number,
    year_built: property.year_built,
    size_value: property.size_value,
    size_unit: property.size_unit,
  });

  useEffect(() => {
    let aktiv = true;
    getTaxonomy()
      .then((x) => {
        if (aktiv) setTax(x);
      })
      .catch(() => {
        /* Fehler → Dropdowns leer (kein Crash, keine Fake-Liste). */
      });
    return () => {
      aktiv = false;
    };
  }, []);

  const aktSubtype = useMemo(
    () => tax?.subtypes.find((s) => s.slug === d.subtype_slug) ?? null,
    [tax, d.subtype_slug],
  );
  // Kategorie aus dem gewählten Immobilientyp ableiten, sobald Katalog/Wert stehen.
  useEffect(() => {
    if (aktSubtype) setKategorie(aktSubtype.category_slug);
  }, [aktSubtype]);

  const subtypenDerKategorie = useMemo(
    () => tax?.subtypes.filter((s) => s.category_slug === kategorie) ?? [],
    [tax, kategorie],
  );
  const erlaubteListingTypes = aktSubtype?.listing_types ?? [];
  const zeigtZimmerFeld = kategorie === HOTEL_KATEGORIE;

  function waehleKategorie(slug: string) {
    setKategorie(slug);
    // Immobilientyp/Angebotsart/Zimmeranzahl zurücksetzen (passen nicht mehr).
    setD((p) => ({
      ...p,
      subtype_slug: null,
      listing_type: null,
      total_rooms: null,
    }));
  }

  function waehleSubtype(slug: string) {
    const neu = tax?.subtypes.find((s) => s.slug === slug) ?? null;
    setD((p) => ({
      ...p,
      subtype_slug: slug,
      // Angebotsart behalten, falls für den neuen Typ erlaubt, sonst zurücksetzen.
      listing_type:
        p.listing_type && neu?.listing_types.includes(p.listing_type)
          ? p.listing_type
          : null,
    }));
  }

  const geaendert =
    d.subtype_slug !== property.subtype_slug ||
    d.listing_type !== property.listing_type ||
    d.total_rooms !== property.total_rooms ||
    d.floors_total !== property.floors_total ||
    d.floor_number !== property.floor_number ||
    d.year_built !== property.year_built ||
    d.size_value !== property.size_value ||
    d.size_unit !== property.size_unit;

  async function speichern() {
    if (!geaendert || busy) return;
    setBusy(true);
    await onSpeichere({
      subtype_slug: d.subtype_slug,
      listing_type: d.listing_type,
      total_rooms: zeigtZimmerFeld ? d.total_rooms : null,
      floors_total: d.floors_total,
      floor_number: d.floor_number,
      year_built: d.year_built,
      size_value: d.size_value,
      size_unit: d.size_unit,
    });
    setBusy(false);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <h2 className="mb-8 font-sans text-[2rem] font-bold tracking-tight">
          Objekttyp
        </h2>

        <div className="max-w-2xl space-y-4">
          {/* Ebene 1 — Kategorie */}
          <SelectCard
            label="Welcher Ort ähnelt Ihrem am meisten?"
            value={kategorie}
            platzhalter="Bitte wählen"
            disabled={!tax}
            onChange={waehleKategorie}
            optionen={(tax?.categories ?? []).map((c) => ({
              value: c.slug,
              label: c.label_de,
            }))}
          />

          {/* Ebene 2 — Immobilientyp (abhängig von Kategorie) */}
          <SelectCard
            label="Immobilientyp"
            value={d.subtype_slug ?? ""}
            platzhalter="Bitte wählen"
            disabled={!kategorie}
            onChange={waehleSubtype}
            optionen={subtypenDerKategorie.map((s) => ({
              value: s.slug,
              label: s.label_de,
            }))}
          />

          {/* Zusatzfeld nur bei „Hotel & Betriebe" */}
          {zeigtZimmerFeld && (
            <SelectCard
              label="Wie viele Zimmer hat Ihre Unterkunft insgesamt?"
              value={d.total_rooms ?? ""}
              platzhalter="Bitte wählen"
              onChange={(v) => setD((p) => ({ ...p, total_rooms: v || null }))}
              optionen={ZIMMER_BUCKETS.map((b) => ({ value: b, label: b }))}
            />
          )}

          {/* Ebene 3 — Angebotsart (abhängig von Immobilientyp) */}
          <SelectCard
            label="Angebotsart"
            value={d.listing_type ?? ""}
            platzhalter="Bitte wählen"
            disabled={erlaubteListingTypes.length === 0}
            onChange={(v) =>
              setD((p) => ({ ...p, listing_type: (v || null) as ListingType | null }))
            }
            optionen={erlaubteListingTypes.map((lt) => ({
              value: lt,
              label: LISTING_LABEL[lt],
            }))}
          />

          {/* Etagen-Stepper */}
          <StepperZeile
            label="Wie viele Stockwerke hat das Gebäude?"
            wert={d.floors_total}
            min={1}
            onSetze={(n) => setD((p) => ({ ...p, floors_total: n }))}
          />
          <StepperZeile
            label="In welcher Etage befindet sich das Angebot?"
            wert={d.floor_number}
            min={0}
            onSetze={(n) => setD((p) => ({ ...p, floor_number: n }))}
          />

          {/* Baujahr */}
          <FeldCard label="Baujahr">
            <input
              type="number"
              inputMode="numeric"
              min={1000}
              max={2100}
              value={d.year_built ?? ""}
              placeholder="z. B. 1998"
              onChange={(e) =>
                setD((p) => ({
                  ...p,
                  year_built: e.target.value ? Number(e.target.value) : null,
                }))
              }
              className="w-full bg-transparent text-[0.95rem] outline-none placeholder:text-muted-foreground"
            />
          </FeldCard>

          {/* Wohnfläche + Einheit */}
          <div>
            <div className="flex overflow-hidden rounded-2xl border border-border focus-within:border-foreground">
              <div className="flex-1 px-4 py-2.5">
                <span className="block text-xs text-muted-foreground">Wohnfläche</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.1"
                  value={d.size_value ?? ""}
                  placeholder="z. B. 75"
                  onChange={(e) =>
                    setD((p) => ({
                      ...p,
                      size_value: e.target.value ? Number(e.target.value) : null,
                    }))
                  }
                  className="w-full bg-transparent text-[0.95rem] outline-none placeholder:text-muted-foreground"
                />
              </div>
              <div className="relative w-36 border-l border-border">
                <span className="pointer-events-none absolute left-4 top-2.5 text-xs text-muted-foreground">
                  Einheit
                </span>
                <select
                  value={d.size_unit ?? ""}
                  onChange={(e) =>
                    setD((p) => ({ ...p, size_unit: e.target.value || null }))
                  }
                  className="size-full appearance-none bg-transparent px-4 pt-6 pb-1.5 text-[0.95rem] outline-none"
                >
                  <option value="">—</option>
                  <option value="sqm">m²</option>
                  <option value="sqft">sq ft</option>
                </select>
                <Icon
                  icon="ph:caret-down"
                  className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 opacity-70"
                />
              </div>
            </div>
            <p className="mt-2 px-1 text-sm text-muted-foreground">
              Die für Gäste nutzbare Innenfläche.
            </p>
          </div>
        </div>
      </div>

      {/* Speichern unten rechts — deaktiviert, solange unverändert. */}
      <div className="mt-6 flex justify-end border-t border-border pt-5">
        <button
          type="button"
          onClick={() => void speichern()}
          disabled={busy || !geaendert}
          className="rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
        >
          {busy ? "Speichert …" : "Speichern"}
        </button>
      </div>
    </div>
  );
}

// — Dropdown als umrandete Card mit schwebendem Label (Airbnb-Muster) —
function SelectCard({
  label,
  value,
  platzhalter,
  disabled,
  optionen,
  onChange,
}: {
  label: string;
  value: string;
  platzhalter?: string;
  disabled?: boolean;
  optionen: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div
      className={`relative rounded-2xl border border-border px-4 pt-2.5 pb-2 transition-colors focus-within:border-foreground ${
        disabled ? "opacity-50" : ""
      }`}
    >
      <span className="block text-xs text-muted-foreground">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none bg-transparent pr-6 text-[0.95rem] font-medium outline-none disabled:cursor-not-allowed"
      >
        {platzhalter != null && <option value="">{platzhalter}</option>}
        {optionen.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Icon
        icon="ph:caret-down"
        className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 opacity-70"
      />
    </div>
  );
}

// — Umrandetes Eingabefeld mit schwebendem Label —
function FeldCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border px-4 pt-2.5 pb-2 transition-colors focus-within:border-foreground">
      <span className="block text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

// — Stepper-Zeile (Label links, −/N/+ rechts), null = min —
function StepperZeile({
  label,
  wert,
  min,
  onSetze,
}: {
  label: string;
  wert: number | null;
  min: number;
  onSetze: (n: number | null) => void;
}) {
  const aktuell = wert ?? min;
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-[0.95rem]">{label}</span>
      <div className="flex items-center gap-4">
        <button
          type="button"
          aria-label={label}
          disabled={aktuell <= min}
          onClick={() => onSetze(aktuell - 1 < min ? min : aktuell - 1)}
          className="flex size-8 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:border-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Icon icon="ph:minus" className="size-3.5" />
        </button>
        <span className="min-w-5 text-center text-[0.95rem] tabular-nums">{aktuell}</span>
        <button
          type="button"
          aria-label={label}
          onClick={() => onSetze(aktuell + 1)}
          className="flex size-8 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:border-foreground"
        >
          <Icon icon="ph:plus" className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
