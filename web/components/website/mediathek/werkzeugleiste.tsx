"use client";

// Die Werkzeugleiste über der Kachelwand (Punkte 7-8 des Vorbilds):
//
//     Alle Bilder                    ▽ Bilder   ⇅ Sortierung   ▦ ▤
//     Bilder dieser Website
//
// Links die Überschrift des BESTANDS (und darunter, wo man steht), rechts die
// drei Schalter: Art-Filter, Sortierung, Ansicht.
//
// WARUM DER ART-FILTER HIER STEHT, OBWOHL ES OBEN REITER GIBT
// Es ist derselbe Zustand, absichtlich zweimal bedienbar — genau so im Vorbild.
// Der Reiter oben ist der Wechsel des Bestands, der Trichter hier die Frage
// „was sehe ich gerade": wer nach unten gescrollt hat, sieht die Reiterreihe
// nicht mehr. Zwei Bedienelemente auf EINEN Zustand ist dabei die Bedingung —
// zwei getrennte Filter mit derselben Beschriftung wären der Fehler.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";

import type { MediaSortierung } from "@/lib/site-medien";
import type { MediumArt } from "@/lib/site-pages";

import { ART_REITER } from "./kopf";
import type { AnsichtsModus } from "./kachel-wand";

const SORTEN: MediaSortierung[] = ["neueste", "aelteste", "name", "groesse"];

export function Werkzeugleiste({
  art,
  sortierung,
  modus,
  ortName,
  anzahl,
  onArt,
  onSortierung,
  onModus,
}: {
  art: MediumArt;
  sortierung: MediaSortierung;
  modus: AnsichtsModus;
  /** Wo man steht: Ordnername, „ohne Ordner" oder „alle". Als fertiger Text,
   *  weil nur der Aufrufer die drei Zustände auseinanderhält. */
  ortName: string;
  /** Treffer im aktuellen Blick. Vom Server, nicht die Länge der Liste — die
   *  wäre bei mehr als 200 Medien die Zahl der geladenen. */
  anzahl: number | null;
  onArt: (a: MediumArt) => void;
  onSortierung: (s: MediaSortierung) => void;
  onModus: (m: AnsichtsModus) => void;
}) {
  const t = useTranslations("website.mediathek");

  return (
    <div className="flex shrink-0 flex-wrap items-end justify-between gap-3 border-b border-border px-4 py-3">
      <div className="min-w-0">
        <h3 className="truncate font-display text-xl font-extrabold">
          {t(`werkzeug.alle.${art}`)}
          {anzahl !== null ? (
            <span className="ml-2 align-middle text-sm font-medium text-muted-foreground">
              {anzahl}
            </span>
          ) : null}
        </h3>
        <p className="truncate text-xs text-muted-foreground">{ortName}</p>
      </div>

      <div className="flex items-center gap-1">
        {/* Art-Filter: ein echtes <select> und keine eigene Klappliste. Es
            bringt Tastaturbedienung, Bildschirmleser-Ansage und die
            Auswahlliste des Betriebssystems mit — nichts davon müsste hier
            nachgebaut werden, damit es aussieht wie im Foto. */}
        <label className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm">
          <Icon icon="ph:funnel" className="size-4 text-muted-foreground" />
          <span className="sr-only">{t("werkzeug.filter")}</span>
          <select
            value={art}
            onChange={(e) => onArt(e.target.value as MediumArt)}
            className="bg-transparent text-sm outline-none"
          >
            {ART_REITER.map((r) => (
              <option key={r.art} value={r.art}>
                {t(`art.${r.art}`)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm">
          <Icon icon="ph:arrows-down-up" className="size-4 text-muted-foreground" />
          <span className="sr-only">{t("werkzeug.sortierung")}</span>
          <select
            value={sortierung}
            onChange={(e) => onSortierung(e.target.value as MediaSortierung)}
            className="bg-transparent text-sm outline-none"
          >
            {SORTEN.map((s) => (
              <option key={s} value={s}>
                {t(`sortierung.${s}`)}
              </option>
            ))}
          </select>
        </label>

        <div className="ml-1 flex items-center gap-0.5 rounded-full border border-border p-0.5">
          <AnsichtKnopf
            icon="ph:squares-four"
            label={t("werkzeug.raster")}
            aktiv={modus === "raster"}
            onKlick={() => onModus("raster")}
          />
          <AnsichtKnopf
            icon="ph:rows"
            label={t("werkzeug.liste")}
            aktiv={modus === "liste"}
            onKlick={() => onModus("liste")}
          />
        </div>
      </div>
    </div>
  );
}

function AnsichtKnopf({
  icon,
  label,
  aktiv,
  onKlick,
}: {
  icon: string;
  label: string;
  aktiv: boolean;
  onKlick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={aktiv}
      aria-label={label}
      title={label}
      onClick={onKlick}
      className={
        "rounded-full p-1.5 transition " +
        (aktiv
          ? "bg-(--brand)/10 text-(--brand)"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground")
      }
    >
      <Icon icon={icon} className="size-4" />
    </button>
  );
}
