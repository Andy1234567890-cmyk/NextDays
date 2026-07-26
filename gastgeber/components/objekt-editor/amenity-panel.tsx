"use client";

// „Ausstattung hinzufügen" (Airbnb „Add amenities") als rechte Sidebar: Filter
// „Alle"/„Vorgeschlagen", Suche, und die nach Kategorie gruppierte Liste des
// Channex-Facility-Katalogs mit Checkbox je Eintrag. Gespeichert wird in
// properties.amenities (string[] der Slugs) — das ist die eine Wahrheit, die über
// _channex_facility_ids an die Portale synct. KEIN type_attributes, KEINE Tabelle.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { AMENITY_KATALOG } from "./amenity-katalog";

// Reihenfolge der Kategorie-Abschnitte in der Liste („Beliebt" zuerst).
const KATEGORIE_REIHENFOLGE = [
  "Beliebt",
  "Küche & Essen",
  "Bad",
  "Schlafzimmer & Wäsche",
  "Unterhaltung",
  "Familie",
  "Außenbereich",
  "Wellness & Sport",
  "Parken & Anreise",
  "Sicherheit",
  "Barrierefreiheit",
  "Services",
  "Sonstiges",
];

// Umlaut-toleranter Suchvergleich.
function normalisiere(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ß/g, "ss");
}

export function AmenityPanel({
  gewaehlt,
  onSpeichere,
  onZurueck,
}: {
  gewaehlt: string[];
  onSpeichere: (neu: string[]) => Promise<boolean>;
  onZurueck: () => void;
}) {
  const t = useTranslations("objektEditor");
  const [lokal, setLokal] = useState<Set<string>>(new Set(gewaehlt));
  // Kategorie-Filter: "alle" oder ein Kategorie-Name aus KATEGORIE_REIHENFOLGE
  // (Airbnb zeigt alle Kategorien als Chips, nicht nur „Alle/Vorgeschlagen").
  const [filter, setFilter] = useState<string>("alle");
  const [suche, setSuche] = useState("");
  const [sucheOffen, setSucheOffen] = useState(false);
  const [speichert, setSpeichert] = useState(false);

  function toggle(key: string) {
    setLokal((v) => {
      const next = new Set(v);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // Gefilterte + nach Kategorie gruppierte Einträge.
  const gruppen = useMemo(() => {
    const q = normalisiere(suche.trim());
    const gefiltert = AMENITY_KATALOG.filter((a) => {
      if (filter !== "alle" && a.kategorie !== filter) return false;
      if (q && !normalisiere(a.label).includes(q)) return false;
      return true;
    });
    const map = new Map<string, typeof AMENITY_KATALOG>();
    for (const a of gefiltert) {
      const arr = map.get(a.kategorie) ?? [];
      arr.push(a);
      map.set(a.kategorie, arr);
    }
    return KATEGORIE_REIHENFOLGE.filter((k) => map.has(k)).map((k) => ({
      kategorie: k,
      eintraege: map.get(k)!,
    }));
  }, [filter, suche]);

  async function speichern() {
    setSpeichert(true);
    const ok = await onSpeichere([...lokal]);
    setSpeichert(false);
    if (ok) onZurueck();
  }

  return (
    <div className="flex h-full flex-col">
      {/* Fixer Kopf (Titel, Suche, Filter) — scrollt NICHT mit der Liste. */}
      <div className="shrink-0 border-b border-border px-8 pb-5 pt-8 lg:px-12 lg:pt-12">
        {/* Schließen-X oben rechts (Airbnb-Muster). */}
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={onZurueck}
            aria-label={t("schliessen")}
            className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-muted"
          >
            <Icon icon="ph:x" className="size-5" />
          </button>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-sans text-[2rem] font-bold tracking-tight">
              {t("amenityTitel")}
            </h2>
            <p className="mt-2 text-[0.9375rem] text-muted-foreground">
              {t("amenityText")}
            </p>
          </div>
          <button
            type="button"
            aria-label={t("suchen")}
            onClick={() => setSucheOffen((o) => !o)}
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
          >
            <Icon icon="ph:magnifying-glass" className="size-5" />
          </button>
        </div>

        {sucheOffen && (
          <input
            type="text"
            autoFocus
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
            placeholder={t("amenitySuche")}
            className="mt-4 w-full rounded-full border border-border bg-background px-5 py-2.5 text-sm outline-none focus-visible:border-foreground"
          />
        )}

        {/* Kategorie-Chips: „Alle" + alle Katalog-Kategorien (Airbnb-Muster).
            EINE Zeile, horizontal scrollbar (kein Umbruch) — bei 14 Chips würde
            flex-wrap den Kopf sonst mehrzeilig aufblähen. Die Scrollbar bleibt
            unsichtbar; gewischt/gescrollt wird seitlich. */}
        <div className="mt-5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex w-max gap-2 pr-8 lg:pr-12">
            {["alle", ...KATEGORIE_REIHENFOLGE].map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  filter === f
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-foreground hover:border-foreground"
                }`}
              >
                {f === "alle" ? t("amenityAlle") : f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Scrollende Liste — nur dieser Bereich scrollt intern. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-8 pt-8 lg:px-12">
        {gruppen.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t("amenityKeine")}
          </p>
        ) : (
          gruppen.map((g) => (
            <section key={g.kategorie} className="mb-6">
              {filter === "alle" && !suche && (
                <h3 className="mb-1 mt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {g.kategorie}
                </h3>
              )}
              <ul className="divide-y divide-border">
                {g.eintraege.map((a) => {
                  const an = lokal.has(a.key);
                  return (
                    <li key={a.key}>
                      <button
                        type="button"
                        onClick={() => toggle(a.key)}
                        className="flex w-full items-center gap-4 py-3.5 text-left"
                      >
                        <Icon
                          icon={a.icon}
                          className="size-6 shrink-0 text-foreground"
                        />
                        <span className="min-w-0 flex-1 font-medium">{a.label}</span>
                        <span
                          className={`flex size-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                            an
                              ? "border-foreground bg-foreground text-background"
                              : "border-border"
                          }`}
                        >
                          {an && <Icon icon="ph:check-bold" className="size-4" />}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </div>

      {/* Fixe Fußzeile — außerhalb des Scroll-Bereichs, immer sichtbar. */}
      <div className="flex shrink-0 items-center justify-between gap-4 border-t border-border bg-background px-8 py-5 lg:px-12">
        <button
          type="button"
          onClick={onZurueck}
          className="text-sm font-semibold underline-offset-4 hover:underline"
        >
          {t("abbrechen")}
        </button>
        <button
          type="button"
          onClick={speichern}
          disabled={speichert}
          className="rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {speichert ? t("speichert") : t("amenityFertig")}
        </button>
      </div>
    </div>
  );
}
