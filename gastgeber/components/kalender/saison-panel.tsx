"use client";

// Rechtes Panel, solange NICHTS ausgewählt ist (Vorbild: Airbnbs „Lege deine
// saisonalen Preise und Verfügbarkeiten fest"): die Regelsätze des Gastgebers
// als Karten, jede mit ihren einzelnen Regeln.
//
// Ein Regelsatz bündelt bei uns, was den Tagespreis bestimmt:
//   • die SAISON des Objekts (Aufschlag in Prozent oder fester Nachtpreis),
//   • die RABATTE des Objekts (Länge, Frühbucher, Last-Minute, Aktionen).
// Objekte ohne Saison, aber mit Rabatten bekommen trotzdem eine Karte — sonst
// wäre eine Preisregel unsichtbar, nur weil keine Saison daneben steht.
//
// Sortiert wird nach Objekt und dann nach Saisonname, damit die Liste bei
// zwanzig Objekten nicht bei jedem Laden anders aussieht.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import type { Rabatt, Saison } from "@/lib/kalender";
import { PANEL_REM } from "@/lib/kalender-mass";
import type { Property } from "@/lib/properties";

import { RegelsatzEditor } from "./regelsatz-editor";
import { RegelsatzKarte } from "./regelsatz-karte";

export function SaisonPanel({
  saisons,
  rabatte,
  objekte,
  laedt,
  eingeklappt,
  onUmschalten,
  onGeaendert,
  onAnwenden,
}: {
  saisons: Saison[];
  rabatte: Rabatt[];
  objekte: Property[];
  laedt: boolean;
  eingeklappt: boolean;
  onUmschalten: () => void;
  onGeaendert: () => void;
  /** „Anwenden" auf einer Karte: der Satz wartet auf die nächste Auswahl. */
  onAnwenden: (saison: Saison) => void;
}) {
  const t = useTranslations("kalender");
  // Welcher Regelsatz gerade im Editor liegt. `"neu"` = ein neuer Satz für das
  // erste Objekt; null = kein Editor offen.
  const [imEditor, setImEditor] = useState<Saison | "neu" | null>(null);

  const objektMap = useMemo(
    () => new Map(objekte.map((o) => [o.id, o])),
    [objekte],
  );

  // Karten bauen: je Saison eine, dazu je Objekt mit Rabatten aber OHNE Saison
  // eine reine Rabatt-Karte.
  const karten = useMemo(() => {
    const rabatteJeObjekt = new Map<string, Rabatt[]>();
    for (const r of rabatte) {
      const liste = rabatteJeObjekt.get(r.property_id);
      if (liste) liste.push(r);
      else rabatteJeObjekt.set(r.property_id, [r]);
    }
    const aus: { schluessel: string; saison: Saison | null; rabatte: Rabatt[]; objektId: string }[] =
      saisons
        .slice()
        .sort(
          (a, b) =>
            (objektMap.get(a.property_id)?.title ?? "").localeCompare(
              objektMap.get(b.property_id)?.title ?? "",
            ) || a.name.localeCompare(b.name),
        )
        .map((s) => ({
          schluessel: s.id,
          saison: s,
          rabatte: rabatteJeObjekt.get(s.property_id) ?? [],
          objektId: s.property_id,
        }));
    const mitSaison = new Set(saisons.map((s) => s.property_id));
    for (const [pid, liste] of rabatteJeObjekt) {
      if (!mitSaison.has(pid)) {
        aus.push({ schluessel: `r-${pid}`, saison: null, rabatte: liste, objektId: pid });
      }
    }
    return aus;
  }, [saisons, rabatte, objektMap]);

  if (eingeklappt) {
    return (
      <aside className="flex w-12 shrink-0 flex-col items-center border-s border-border pt-5">
        <button
          type="button"
          onClick={onUmschalten}
          aria-label={t("saisonPanelOeffnen")}
          className="flex size-8 items-center justify-center rounded-full transition-colors hover:bg-muted"
        >
          <Icon icon="ph:caret-left" className="size-4" />
        </button>
      </aside>
    );
  }

  return (
    <aside style={{ width: `${PANEL_REM}rem` }}
      className="flex shrink-0 flex-col overflow-y-auto border-s border-border">
      <div className="px-5 pt-5">
        <button
          type="button"
          onClick={onUmschalten}
          aria-label={t("saisonPanelSchliessen")}
          className="flex size-8 items-center justify-center rounded-full transition-colors hover:bg-muted"
        >
          <Icon icon="ph:caret-right" className="size-4" />
        </button>
      </div>

      <div className="flex-1 px-5 pb-4">
        <h2 className="mt-2 font-display text-[1.625rem] font-medium leading-tight tracking-tight">
          {t("saisonTitel")}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("saisonEinleitung")}</p>

        {laedt ? (
          <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Icon icon="ph:spinner" className="size-4 animate-spin" />
            {t("laedt")}
          </p>
        ) : karten.length === 0 ? (
          <p className="mt-6 text-[0.9375rem] text-muted-foreground">
            {t("saisonKeine")}
          </p>
        ) : (
          <ul className="mt-5 space-y-3">
            {karten.map((k) => (
              <RegelsatzKarte
                key={k.schluessel}
                saison={k.saison}
                rabatte={k.rabatte}
                objektTitel={objektMap.get(k.objektId)?.title ?? t("ksObjektUnbekannt")}
                waehrung={objektMap.get(k.objektId)?.currency ?? null}
                onBearbeiten={() => k.saison && setImEditor(k.saison)}
                onAnwenden={() => k.saison && onAnwenden(k.saison)}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Ein neuer Regelsatz gehört zunächst dem ERSTEN Objekt der Liste —
          welchem er wirklich gelten soll, entscheidet der Gastgeber im Editor
          über die Zuweisung im Kalender. Ohne Objekt gibt es nichts anzulegen. */}
      {objekte[0] && (
        <div className="sticky bottom-0 border-t border-border bg-background p-4">
          <button
            type="button"
            onClick={() => setImEditor("neu")}
            className="flex w-full items-center justify-center rounded-xl bg-foreground py-3 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            {t("saisonNeu")}
          </button>
        </div>
      )}

      {imEditor && objekte[0] && (
        <RegelsatzEditor
          offen
          saison={imEditor === "neu" ? null : imEditor}
          propertyId={
            imEditor === "neu" ? objekte[0].id : imEditor.property_id
          }
          rabatte={
            imEditor === "neu"
              ? []
              : rabatte.filter((r) => r.season_id === imEditor.id)
          }
          onSchliessen={() => setImEditor(null)}
          onGespeichert={onGeaendert}
        />
      )}
    </aside>
  );
}
