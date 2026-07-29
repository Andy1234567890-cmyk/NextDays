"use client";

// „Ausstattung" (Airbnb „Amenities"). Links die Übersicht der gewählten
// Ausstattung (nach Kategorie gruppiert) bzw. ein Leerzustand mit Illustration;
// Klick auf „Hinzufügen"/„Bearbeiten" öffnet rechts die Inline-Sidebar mit dem
// vollständigen Katalog (dieselbe Mechanik wie Preise/Lage/Verfügbarkeit).
//
// An die ECHTE Datenwahrheit angeschlossen (Wurzel 4, kein erfundenes Feld):
// properties.amenities (string[] der Channex-Facility-Slugs) ist die EINE
// Wahrheit — sie wird über _channex_facility_ids an Channex → die OTAs gesynct.
// Kein type_attributes, keine Zusatztabelle. Der Katalog (301 Einträge) ist 1:1
// _CHANNEX_FACILITY; ein Slug wird NIE erfunden oder umbenannt.
import { Icon } from "@iconify/react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { AMENITY_KATALOG } from "./amenity-katalog";
import { AmenityPanel } from "./amenity-panel";

// Reihenfolge der Kategorie-Abschnitte in der Übersicht („Beliebt" zuerst) —
// dieselbe Ordnung wie in der Auswahl-Sidebar.
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

export function AusstattungPanel({
  gewaehlt,
  onSpeichere,
  onDetailOffen,
}: {
  // Aktuell gewählte Slugs (properties.amenities).
  gewaehlt: string[];
  onSpeichere: (neu: string[]) => Promise<boolean>;
  // Meldet dem Editor, ob die Detail-Sidebar offen ist (linke Liste ausblenden).
  onDetailOffen?: (offen: boolean) => void;
}) {
  const t = useTranslations("objektEditor");
  const reduziert = useReducedMotion();
  const [offen, setOffenState] = useState(false);
  function setOffen(o: boolean) {
    setOffenState(o);
    onDetailOffen?.(o);
  }

  // Gewählte Slugs → Katalog-Einträge, nach Kategorie gruppiert. Slugs ohne
  // Katalog-Eintrag (z. B. aus einem älteren Channex-Stand) werden ehrlich mit
  // ihrem Slug gezeigt statt verschluckt (Wurzel 5) — nichts wird erfunden.
  const gruppen = useMemo(() => {
    const map = new Map<string, { key: string; label: string; icon: string }[]>();
    for (const slug of gewaehlt) {
      const eintrag = AMENITY_KATALOG.find((a) => a.key === slug);
      const kategorie = eintrag?.kategorie ?? "Sonstiges";
      const arr = map.get(kategorie) ?? [];
      arr.push({
        key: slug,
        label: eintrag?.label ?? slug,
        icon: eintrag?.icon ?? "ph:check-circle-duotone",
      });
      map.set(kategorie, arr);
    }
    return KATEGORIE_REIHENFOLGE.filter((k) => map.has(k)).map((k) => ({
      kategorie: k,
      eintraege: map.get(k)!,
    }));
  }, [gewaehlt]);

  const leer = gewaehlt.length === 0;

  return (
    <div className="flex h-full min-h-0">
      <section className="min-w-0 flex-1 overflow-y-auto px-8 py-8 lg:py-12">
        <div className="mx-auto max-w-2xl">
          {/* Kopf: Titel + „Bearbeiten"/„+" (nur wenn schon etwas gewählt ist —
              im Leerzustand führt der zentrale Button in die Auswahl). */}
          <div className="flex items-start justify-between gap-4">
            <h2 className="font-sans text-[2rem] font-bold tracking-tight">
              {t("secAusstattung")}
            </h2>
            {!leer && (
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOffen(true)}
                  className="rounded-full bg-muted px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-muted/70"
                >
                  {t("bearbeiten")}
                </button>
                <button
                  type="button"
                  aria-label={t("ausstattungHinzufuegen")}
                  onClick={() => setOffen(true)}
                  className="flex size-11 items-center justify-center rounded-full bg-muted transition-colors hover:bg-muted/70"
                >
                  <Icon icon="ph:plus" className="size-5" />
                </button>
              </div>
            )}
          </div>

          {leer ? (
            /* Leerzustand (Airbnb): Illustration, Erklärtext, zentraler Button. */
            <div className="mt-16 flex flex-col items-center text-center">
              <Icon
                icon="ph:beach-ball-duotone"
                className="size-28 text-muted-foreground/40"
              />
              <p className="mt-8 text-lg font-semibold">{t("ausstattungLeerTitel")}</p>
              <p className="mt-2 max-w-md text-[0.9375rem] text-muted-foreground">
                {t("ausstattungLeerText")}
              </p>
              <button
                type="button"
                onClick={() => setOffen(true)}
                className="mt-8 rounded-full bg-muted px-6 py-3 text-sm font-semibold transition-colors hover:bg-muted/70"
              >
                {t("ausstattungHinzufuegen")}
              </button>
            </div>
          ) : (
            /* Gewählte Ausstattung, nach Kategorie gruppiert. */
            <>
              <p className="mt-2 text-[0.9375rem] text-muted-foreground">
                {t("ausstattungAnzahl", { n: gewaehlt.length })}
              </p>
              <div className="mt-8">
                {gruppen.map((g) => (
                  <section key={g.kategorie} className="mb-8">
                    <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {g.kategorie}
                    </h3>
                    <ul className="divide-y divide-border">
                      {g.eintraege.map((a) => (
                        <li key={a.key} className="flex items-center gap-4 py-3.5">
                          <Icon icon={a.icon} className="size-6 shrink-0 text-foreground" />
                          <span className="min-w-0 flex-1 font-medium">{a.label}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* Inline-Auswahl-Sidebar (kein Overlay): fährt aus, schiebt die Übersicht
          zusammen. Innen das bestehende AmenityPanel (eine Quelle, keine Kopie). */}
      <AnimatePresence initial={false}>
        {offen && (
          <motion.aside
            key="ausstattung-sidebar"
            className="shrink-0 overflow-hidden border-s border-border"
            initial={reduziert ? false : { width: 0, opacity: 0 }}
            animate={{ width: "32rem", opacity: 1 }}
            exit={reduziert ? { opacity: 0 } : { width: 0, opacity: 0 }}
            transition={
              reduziert ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 30 }
            }
          >
            <div className="h-full w-[32rem]">
              <AmenityPanel
                gewaehlt={gewaehlt}
                onSpeichere={onSpeichere}
                onZurueck={() => setOffen(false)}
              />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
