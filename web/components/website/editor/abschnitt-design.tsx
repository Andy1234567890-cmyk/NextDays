"use client";

// „Design bearbeiten" eines Abschnitts — das Panel hinter dem gleichnamigen
// Knopf der schwebenden Leiste.
//
// Es trägt genau die zwei Dinge, die zur FLÄCHE gehören und nicht zum Inhalt:
// auf welchen Geräten der Abschnitt erscheint, und wie viel Luft um ihn herum
// ist. Alles Inhaltliche (Überschrift, Bilder, Felder) bleibt im Inspektor —
// das ist dieselbe Trennung, die Hostaway zwischen `Manage Photos` und
// `Edit Design` zieht.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";

import { GERAET_SYMBOL, type Geraet } from "../vorschau";
import { AbstandsFeld } from "./abstands-feld";
import { GERAETE, mitVersteckt, umgeschaltet, versteckteGeraete } from "./sichtbarkeit";

export function AbschnittDesign({
  settings,
  onSettings,
}: {
  settings: Record<string, unknown>;
  onSettings: (settings: Record<string, unknown>) => void;
}) {
  const t = useTranslations("website");
  const versteckt = versteckteGeraete(settings);

  return (
    <div className="flex flex-col pb-8">
      <div className="flex flex-col gap-2 px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("arbeitsflaeche.sichtbarkeit")}
        </span>
        <p className="text-[0.6875rem] text-muted-foreground">
          {t("arbeitsflaeche.sichtbarkeitHinweis")}
        </p>
        <div className="flex flex-col gap-1">
          {GERAETE.map((g: Geraet) => {
            const aus = versteckt.includes(g);
            return (
              <button
                key={g}
                type="button"
                aria-pressed={!aus}
                onClick={() =>
                  onSettings(mitVersteckt(settings, umgeschaltet(versteckt, g)))
                }
                className={
                  "flex items-center justify-between gap-2 rounded-(--radius) border px-3 py-2 text-sm transition " +
                  (aus
                    ? "border-orange-300 bg-orange-50 text-orange-600 dark:border-orange-900 dark:bg-orange-950/40"
                    : "border-border hover:bg-secondary/60")
                }
              >
                <span className="flex items-center gap-2">
                  <Icon
                    icon={GERAET_SYMBOL[g]}
                    className="size-4"
                  />
                  {t(`arbeitsflaeche.${g}`)}
                </span>
                <Icon
                  icon={aus ? "ph:eye-slash" : "ph:eye"}
                  className="size-4"
                />
              </button>
            );
          })}
        </div>
        {versteckt.length === GERAETE.length ? (
          // Der Hinweis steht nur da, wenn er gebraucht wird — und er ist der
          // Grund, warum der Abschnitt im Editor NICHT verschwindet: sonst
          // gäbe es ab hier keinen Weg zurück.
          <p className="text-[0.6875rem] text-orange-500">
            {t("arbeitsflaeche.ueberallVersteckt")}
          </p>
        ) : null}
      </div>

      <span aria-hidden className="mx-4 block h-px bg-border" />

      <AbstandsFeld settings={settings} onSettings={onSettings} />
    </div>
  );
}
