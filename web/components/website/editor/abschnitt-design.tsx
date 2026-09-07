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

import { darstellungFuer, mitWert } from "@nextdays/baukasten-stil";

import { GERAET_SYMBOL, type Geraet } from "../vorschau";
import { AbstandsFeld } from "./abstands-feld";
import { protokoll } from "./protokoll";
import { GERAETE, mitVersteckt, umgeschaltet, versteckteGeraete } from "./sichtbarkeit";

/** Die Felder, die das Abstandsfeld schreibt — je Gerät überschreibbar. */
const ABSTAND_FELDER = [
  "margin_top",
  "margin_right",
  "margin_bottom",
  "margin_left",
  "padding_top",
  "padding_right",
  "padding_bottom",
  "padding_left",
] as const;

export function AbschnittDesign({
  settings,
  geraet = "desktop",
  onSettings,
}: {
  settings: Record<string, unknown>;
  /** Das Gerät der Vorschau. Die ABSTÄNDE schreiben dafür (Etappe 3): auf
   *  Tablet/Mobil als Überschreibung. Die Sichtbarkeit nicht — `hidden_on`
   *  IST bereits die Geräteliste. */
  geraet?: Geraet;
  onSettings: (settings: Record<string, unknown>) => void;
}) {
  const t = useTranslations("website");
  const versteckt = versteckteGeraete(settings);

  // Das Abstandsfeld kennt keine Geräte: es liest acht flache Schlüssel und
  // gibt die ganzen Settings zurück. Hier bekommt es die WIRKSAMEN Werte des
  // Geräts zu lesen, und was es zurückgibt, wird feldweise in die richtige
  // Fassung geschrieben — statt das Feld ein zweites Mal zu bauen.
  const wirksam = darstellungFuer(settings, geraet) as Record<string, unknown>;
  const sicht: Record<string, unknown> = { ...settings };
  for (const k of ABSTAND_FELDER) {
    if (wirksam[k] === undefined) delete sicht[k];
    else sicht[k] = wirksam[k];
  }
  function abstaendeSetzen(neu: Record<string, unknown>) {
    let ergebnis = settings;
    for (const k of ABSTAND_FELDER) {
      if (neu[k] === sicht[k]) continue;
      ergebnis = mitWert(ergebnis, geraet, [k], neu[k] ?? null);
      protokoll("klick", "Abstand setzen", { pfad: k, geraet, wert: neu[k] ?? null });
    }
    if (neu.spacing_x_gekoppelt !== settings.spacing_x_gekoppelt) {
      ergebnis = mitWert(ergebnis, "desktop", ["spacing_x_gekoppelt"], neu.spacing_x_gekoppelt);
    }
    onSettings(ergebnis);
  }

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

      <AbstandsFeld settings={sicht} onSettings={abstaendeSetzen} />
    </div>
  );
}
