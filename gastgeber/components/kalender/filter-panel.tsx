"use client";

// Inserats-Filter der Seitenleiste (Vorbild: Airbnbs „Inserats-Filter" im
// Multikalender): Zimmer und Betten als Zähler, Ausstattung als Kästchen,
// Status des Inserats, unten „Filter aufheben" und „Anwenden".
//
// Der Filter arbeitet auf den BEREITS GELADENEN Objekten — kein zweiter
// Server-Aufruf, keine zweite Wahrheit. Angeboten werden nur Merkmale, die
// unsere Objekte wirklich tragen (Zimmerzahlen aus `type_attributes`,
// Ausstattung aus dem Katalog): ein Kästchen, das nie etwas findet, weil das
// Feld bei uns gar nicht existiert, wäre eine Attrappe.
//
// „Anwenden" schließt und übernimmt; „Filter aufheben" setzt alles zurück und
// zeigt sofort wieder alle Objekte.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { AMENITY_KATALOG } from "@/components/objekt-editor/amenity-katalog";
import type { Property } from "@/lib/properties";

export type InseratFilter = {
  schlafzimmer: number;
  betten: number;
  badezimmer: number;
  ausstattung: string[];
  /** "alle" | "aktiv" (inseriert) | "entwurf" (nicht inseriert) */
  status: "alle" | "aktiv" | "entwurf";
};

export const LEERER_FILTER: InseratFilter = {
  schlafzimmer: 0,
  betten: 0,
  badezimmer: 0,
  ausstattung: [],
  status: "alle",
};

/** Ausstattung im Filter: die beliebten Merkmale, wie sie der Editor zuerst zeigt. */
const AUSSTATTUNG = AMENITY_KATALOG.filter((a) => a.kategorie === "Beliebt");

export function istGefiltert(f: InseratFilter): boolean {
  return (
    f.schlafzimmer > 0 ||
    f.betten > 0 ||
    f.badezimmer > 0 ||
    f.ausstattung.length > 0 ||
    f.status !== "alle"
  );
}

/** Trifft ein Objekt den Filter? Zähler sind Mindestwerte (wie im Vorbild). */
export function trifftFilter(o: Property, f: InseratFilter): boolean {
  const a = o.type_attributes ?? {};
  const baeder = (a.bathrooms_private ?? 0) + (a.bathrooms_shared ?? 0);
  if (f.schlafzimmer > 0 && (a.bedrooms ?? 0) < f.schlafzimmer) return false;
  if (f.betten > 0 && (a.beds ?? 0) < f.betten) return false;
  if (f.badezimmer > 0 && baeder < f.badezimmer) return false;
  if (f.status === "aktiv" && o.status !== "active") return false;
  if (f.status === "entwurf" && o.status === "active") return false;
  return f.ausstattung.every((k) => o.amenities.includes(k));
}

export function FilterPanel({
  filter,
  onAnwenden,
  onSchliessen,
}: {
  filter: InseratFilter;
  onAnwenden: (f: InseratFilter) => void;
  onSchliessen: () => void;
}) {
  const t = useTranslations("kalender");
  const [entwurf, setEntwurf] = useState<InseratFilter>(filter);

  function zaehler(
    key: "schlafzimmer" | "betten" | "badezimmer",
    label: string,
  ) {
    const wert = entwurf[key];
    return (
      <div key={key} className="flex items-center justify-between py-3">
        <span className="text-[0.9375rem]">{t(label)}</span>
        <span className="flex items-center gap-3">
          <button
            type="button"
            aria-label={`${t(label)} − 1`}
            disabled={wert === 0}
            onClick={() => setEntwurf({ ...entwurf, [key]: Math.max(0, wert - 1) })}
            className="flex size-8 items-center justify-center rounded-full border border-border disabled:opacity-30"
          >
            <Icon icon="ph:minus" className="size-3.5" />
          </button>
          <span className="w-6 text-center text-[0.9375rem] tabular-nums">
            {wert === 0 ? t("filterEgal") : wert}
          </span>
          <button
            type="button"
            aria-label={`${t(label)} + 1`}
            onClick={() => setEntwurf({ ...entwurf, [key]: wert + 1 })}
            className="flex size-8 items-center justify-center rounded-full border border-border"
          >
            <Icon icon="ph:plus" className="size-3.5" />
          </button>
        </span>
      </div>
    );
  }

  return (
    <div className="absolute inset-x-0 top-full z-50 mt-2 max-h-[32rem] overflow-y-auto rounded-2xl border border-border bg-background shadow-xl">
      <div className="p-5">
        <h2 className="font-display text-lg font-semibold">{t("filterTitel")}</h2>

        <section className="mt-4">
          <h3 className="font-medium">{t("filterZimmer")}</h3>
          <div className="mt-1 divide-y divide-border">
            {zaehler("schlafzimmer", "filterSchlafzimmer")}
            {zaehler("betten", "filterBetten")}
            {zaehler("badezimmer", "filterBadezimmer")}
          </div>
        </section>

        <section className="mt-6 border-t border-border pt-5">
          <h3 className="font-medium">{t("filterAusstattung")}</h3>
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
            {AUSSTATTUNG.map((a) => (
              <label
                key={a.key}
                className="flex cursor-pointer items-center gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={entwurf.ausstattung.includes(a.key)}
                  onChange={(e) =>
                    setEntwurf({
                      ...entwurf,
                      ausstattung: e.target.checked
                        ? [...entwurf.ausstattung, a.key]
                        : entwurf.ausstattung.filter((k) => k !== a.key),
                    })
                  }
                  className="size-4 shrink-0 accent-foreground"
                />
                <span className="truncate">{a.label}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="mt-6 border-t border-border pt-5">
          <h3 className="font-medium">{t("filterStatus")}</h3>
          <div className="mt-3 space-y-2">
            {(
              [
                ["alle", "filterStatusAlle"],
                ["aktiv", "filterStatusAktiv"],
                ["entwurf", "filterStatusEntwurf"],
              ] as const
            ).map(([wert, label]) => (
              <label key={wert} className="flex cursor-pointer items-center gap-3 text-sm">
                <input
                  type="radio"
                  name="inserat-status"
                  checked={entwurf.status === wert}
                  onChange={() => setEntwurf({ ...entwurf, status: wert })}
                  className="size-4 accent-foreground"
                />
                {t(label)}
              </label>
            ))}
          </div>
        </section>
      </div>

      <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-border bg-background px-5 py-3">
        <button
          type="button"
          onClick={() => {
            setEntwurf(LEERER_FILTER);
            onAnwenden(LEERER_FILTER);
          }}
          className="text-sm font-medium underline underline-offset-4 hover:opacity-70"
        >
          {t("filterAufheben")}
        </button>
        <span className="flex gap-2">
          <button
            type="button"
            onClick={onSchliessen}
            className="rounded-full px-4 py-2 text-sm font-medium underline underline-offset-4 hover:opacity-70"
          >
            {t("abbrechen")}
          </button>
          <button
            type="button"
            onClick={() => onAnwenden(entwurf)}
            className="rounded-full bg-foreground px-6 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            {t("filterAnwenden")}
          </button>
        </span>
      </div>
    </div>
  );
}
