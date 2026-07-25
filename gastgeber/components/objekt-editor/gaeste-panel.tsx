"use client";

// „Anzahl Gäste" (Airbnb „Number of guests"). Vollpanel mit Karten (kein Ausblenden
// der linken Liste, keine Sidebar — wie Discounts/Availability). Stepper direkt in
// der Karte, Toggle für Haustiere. Speichert sofort.
//
// An die ECHTE Kapazitäts-Wahrheit angeschlossen (Wurzel 4, kein erfundenes Feld):
//   • Max. Gäste      → properties.max_guests   (onMaxGuests → PATCH /properties)
//   • Kinder/Kleinkinder → type_attributes.occupancy {children,infants}
//     (onBlob); real vom Channex-Content-Sync als occ_children/occ_infants gelesen.
//     Erwachsene sind NICHT hier — occ_adults = max_guests.
//   • Haustiere erlaubt → Amenity-Slug "pets_allowed" in properties.amenities
//     (onPets); an die OTAs gesynct.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";

import type { Property } from "@/lib/properties";

const PETS_SLUG = "pets_allowed";

export function GaestePanel({
  property,
  onMaxGuests,
  onBlob,
  onPets,
}: {
  property: Property;
  onMaxGuests: (n: number) => Promise<boolean>;
  onBlob: (teil: { children?: number; infants?: number }) => Promise<boolean>;
  onPets: (erlaubt: boolean) => Promise<boolean>;
}) {
  const t = useTranslations("objektEditor");

  const maxGuests = Math.max(1, property.max_guests);
  const occ = property.type_attributes?.occupancy ?? {};
  const children = Math.max(0, occ.children ?? 0);
  const infants = Math.max(0, occ.infants ?? 0);
  const petsAllowed = property.amenities.includes(PETS_SLUG);

  return (
    <section className="mx-auto max-w-2xl px-8 py-8 lg:py-12">
      <h2 className="font-sans text-[2rem] font-bold tracking-tight">{t("secGaeste")}</h2>
      <p className="mt-2 text-[0.9375rem] text-muted-foreground">{t("gaesteHint")}</p>

      <div className="mt-8 space-y-4">
        <StepperKarte
          titel={t("gaesteMax")}
          hint={t("gaesteMaxHint")}
          wert={maxGuests}
          min={1}
          max={99}
          onSetze={onMaxGuests}
        />
        <StepperKarte
          titel={t("gaesteKinder")}
          hint={t("gaesteKinderHint")}
          wert={children}
          min={0}
          // Kinder sind Teil der Gesamtzahl → höchstens so viele wie Gäste.
          max={maxGuests}
          onSetze={(n) => onBlob({ children: n })}
        />
        <StepperKarte
          titel={t("gaesteKleinkinder")}
          hint={t("gaesteKleinkinderHint")}
          wert={infants}
          min={0}
          max={20}
          onSetze={(n) => onBlob({ infants: n })}
        />

        {/* Haustiere — Toggle (Amenity-Slug). */}
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-border p-6">
          <div className="min-w-0">
            <p className="font-semibold">{t("gaesteHaustiere")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("gaesteHaustiereHint")}</p>
          </div>
          <Toggle an={petsAllowed} onChange={(an) => void onPets(an)} />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Bausteine                                                          */
/* ------------------------------------------------------------------ */

// Karte mit Titel/Hint links und −/N/+ rechts. Speichert sofort bei jeder Änderung
// (optimistisch über den Callback; kein Zwischenpuffer nötig, ein Klick = ein Wert).
function StepperKarte({
  titel,
  hint,
  wert,
  min,
  max,
  onSetze,
}: {
  titel: string;
  hint: string;
  wert: number;
  min: number;
  max: number;
  onSetze: (n: number) => Promise<boolean>;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-border p-6">
      <div className="min-w-0">
        <p className="font-semibold">{titel}</p>
        <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
      </div>
      <div className="flex shrink-0 items-center gap-4">
        <button
          type="button"
          aria-label={`${titel} −`}
          disabled={wert <= min}
          onClick={() => void onSetze(Math.max(min, wert - 1))}
          className="flex size-10 items-center justify-center rounded-full border border-border transition-colors hover:border-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Icon icon="ph:minus" className="size-4" />
        </button>
        <span className="min-w-8 text-center text-xl font-semibold tabular-nums">{wert}</span>
        <button
          type="button"
          aria-label={`${titel} +`}
          disabled={wert >= max}
          onClick={() => void onSetze(Math.min(max, wert + 1))}
          className="flex size-10 items-center justify-center rounded-full border border-border transition-colors hover:border-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Icon icon="ph:plus" className="size-4" />
        </button>
      </div>
    </div>
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
