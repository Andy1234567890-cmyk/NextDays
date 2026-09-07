"use client";

// Inspektor für Kopf-/Fußzeile und ihre Teile (0570).
//
// Der Inhalt eines Teils ist Theme-Code — was sich einstellen lässt, sind
// Sichtbarkeit je Gerät, Sperre und Platz in der Reihenfolge. Alles andere
// (Farben, Logo, Seitenreihenfolge, Sprachen) hat bereits seinen Ort im
// Baukasten; der Inspektor führt dorthin, statt die Felder ein zweites Mal
// aufzubauen (Wurzel: eine Wahrheit je Einstellung, `baukasten-doppel-kopien`).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";

import {
  type Region,
  type RegionStand,
  teilStand,
  teileReihenfolge,
} from "@nextdays/baukasten-stil";

import type { DesignUnterseite } from "../design-ansicht";
import { beweglicheTeile, type RegionAuswahl } from "../ebenen-regionen";
import { InspektorKarte, InspektorKopf } from "../inspektor-rahmen";
import { GERAETE, umgeschaltet } from "./sichtbarkeit";
import type { Geraet } from "../vorschau";

/** Wohin „Einstellungen öffnen" je Ebene führt. `design` öffnet eine
 *  Unterseite des Design-Panels, `pfad` eine Route des Baukastens. */
type Ziel =
  | { art: "design"; unterseite: DesignUnterseite; schluessel: string }
  | { art: "pfad"; pfad: string; schluessel: string };

const ZIELE: Record<string, Ziel[]> = {
  kopfzeile: [
    { art: "design", unterseite: "farben", schluessel: "farben" },
    { art: "design", unterseite: "site-layout", schluessel: "layout" },
  ],
  fusszeile: [
    { art: "design", unterseite: "farben", schluessel: "farben" },
    { art: "design", unterseite: "site-layout", schluessel: "layout" },
  ],
  logo: [{ art: "design", unterseite: "logo", schluessel: "logo" }],
  slogan: [{ art: "design", unterseite: "logo", schluessel: "logo" }],
  navigation: [{ art: "pfad", pfad: "/website/seiten", schluessel: "seiten" }],
  sprachwaehler: [
    { art: "pfad", pfad: "/website/einstellungen/sprachen", schluessel: "sprachen" },
  ],
  buchen: [{ art: "design", unterseite: "buttons", schluessel: "buttons" }],
  social: [{ art: "pfad", pfad: "/website/einstellungen/kontakt", schluessel: "kontakt" }],
  bildnachweise: [{ art: "pfad", pfad: "/website/mediathek", schluessel: "mediathek" }],
  copyright: [{ art: "design", unterseite: "logo", schluessel: "logo" }],
};

export function RegionInspektor({
  auswahl,
  stand,
  geraet,
  onWaehle,
  onVersteckt,
  onSperren,
  onVerschiebe,
  onDesign,
  onPfad,
}: {
  auswahl: RegionAuswahl;
  stand: RegionStand;
  /** Das Gerät der Vorschau — die Zeile hebt es hervor. */
  geraet: Geraet;
  onWaehle: (auswahl: RegionAuswahl) => void;
  onVersteckt: (auswahl: RegionAuswahl, geraete: Geraet[]) => void;
  onSperren: (auswahl: RegionAuswahl, locked: boolean) => void;
  onVerschiebe: (region: Region, teil: string, richtung: -1 | 1) => void;
  onDesign: (unterseite: DesignUnterseite) => void;
  onPfad: (pfad: string) => void;
}) {
  const t = useTranslations("website");
  const { region, teil } = auswahl;
  const st = teil === null ? stand : teilStand(stand, teil);
  const titel = teil === null ? t(`ebenen.${region}`) : t(`ebenen.teile.${teil}`);
  const beweglich = beweglicheTeile(region);
  const gruppe = teileReihenfolge(stand, beweglich);
  const platz = teil ? gruppe.indexOf(teil) : -1;
  const ziele = ZIELE[teil ?? region] ?? [];

  return (
    <div className="flex flex-col pb-8">
      <InspektorKopf
        krumen={
          teil === null
            ? []
            : [
                {
                  id: region,
                  label: t(`ebenen.${region}`),
                  onKlick: () => onWaehle({ region, teil: null }),
                },
              ]
        }
        titel={titel}
        unterzeile={t("ebenen.ausTheme")}
      />

      <InspektorKarte titel={t("arbeitsflaeche.sichtbarkeit")} offenAnfangs>
        <p className="text-xs text-muted-foreground">
          {t("arbeitsflaeche.sichtbarkeitHinweis")}
        </p>
        <div className="mt-2 flex gap-1">
          {GERAETE.map((g) => {
            const aus = st.hidden_on.includes(g);
            return (
              <button
                key={g}
                type="button"
                aria-pressed={!aus}
                onClick={() => onVersteckt(auswahl, umgeschaltet(st.hidden_on, g))}
                title={
                  aus
                    ? t("arbeitsflaeche.einblenden", { geraet: t(`arbeitsflaeche.${g}`) })
                    : t("ebenen.verstecktAufGeraet", { geraet: t(`arbeitsflaeche.${g}`) })
                }
                className={
                  "flex flex-1 items-center justify-center gap-1 rounded-(--radius) border px-2 py-1.5 text-xs transition " +
                  (aus
                    ? "border-orange-300 bg-orange-50 text-orange-600"
                    : "border-border hover:bg-secondary") +
                  (g === geraet ? " ring-1 ring-(--brand)" : "")
                }
              >
                <Icon icon={aus ? "ph:eye-slash" : "ph:eye"} className="size-3.5" />
                {t(`arbeitsflaeche.${g}`)}
              </button>
            );
          })}
        </div>
      </InspektorKarte>

      <InspektorKarte titel={t("ebenen.region.anordnung")} offenAnfangs>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="text-xs font-medium">{t("ebenen.sperren")}</span>
          <input
            type="checkbox"
            checked={st.locked}
            onChange={(e) => onSperren(auswahl, e.target.checked)}
          />
        </label>
        <p className="mt-1 text-xs text-muted-foreground">{t("ebenen.region.sperrenHinweis")}</p>
        {teil !== null ? (
          platz >= 0 ? (
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                disabled={platz === 0 || st.locked}
                onClick={() => onVerschiebe(region, teil, -1)}
                className="flex items-center gap-1 rounded-(--radius) border border-border px-2.5 py-1.5 text-xs transition hover:bg-secondary disabled:opacity-30"
              >
                <Icon icon="ph:arrow-up" className="size-3.5" />
                {t("ebenen.nachOben")}
              </button>
              <button
                type="button"
                disabled={platz === gruppe.length - 1 || st.locked}
                onClick={() => onVerschiebe(region, teil, 1)}
                className="flex items-center gap-1 rounded-(--radius) border border-border px-2.5 py-1.5 text-xs transition hover:bg-secondary disabled:opacity-30"
              >
                <Icon icon="ph:arrow-down" className="size-3.5" />
                {t("ebenen.nachUnten")}
              </button>
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">{t("ebenen.region.festImTheme")}</p>
          )
        ) : null}
      </InspektorKarte>

      {ziele.length > 0 ? (
        <InspektorKarte titel={t("ebenen.region.einstellungen")} offenAnfangs>
          <div className="flex flex-col gap-2">
            {ziele.map((z) => (
              <button
                key={z.schluessel}
                type="button"
                onClick={() =>
                  z.art === "design" ? onDesign(z.unterseite) : onPfad(z.pfad)
                }
                className="flex items-center justify-between rounded-(--radius) border border-border px-3 py-2 text-left text-sm transition hover:bg-secondary"
              >
                {t(`ebenen.region.ziel.${z.schluessel}`)}
                <Icon icon="ph:arrow-right" className="size-3.5 text-muted-foreground" />
              </button>
            ))}
          </div>
        </InspektorKarte>
      ) : null}
    </div>
  );
}
