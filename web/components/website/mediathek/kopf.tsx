"use client";

// Der Kopf des Media Managers: Titelbalken, Suche, Medienart-Reiter.
//
// Vorbild (Foto 27.08.2026, Punkte 1-2):
//
//     ┌──────────────────────────────────────────────────────────────┐
//     │                      MEDIA MANAGER                        ✕  │ dunkel
//     ├──────────────────────────────────────────────────────────────┤
//     │ ( 🔍 Bilder suchen )   ▣ Bilder ♡ Symbole ▶ Videos ♪ Audio 📎 │
//     └──────────────────────────────────────────────────────────────┘
//
// WARUM DER BALKEN DUNKEL IST — und zwar in BEIDEN Farbschemata
// Er ist die Rahmung eines Werkzeugs, das über der Arbeitsfläche liegt, nicht
// eine Kopfzeile der Seite. Im Vorbild trennt genau dieser dunkle Streifen
// „Dialog" von „Editor darunter". Deshalb steht hier eine feste dunkle Fläche
// und kein `bg-background`, das im Dunkelmodus mit dem Editor verschmelzen
// würde.
//
// WARUM DIE REITER MITTIG STEHEN
// Sie sind der Hauptschalter des Dialogs (welcher BESTAND ist gemeint), nicht
// eine Nebenfunktion der Suche. Die Suche links und die Reiter mittig ist die
// Anordnung des Vorbilds, und sie hat den praktischen Vorteil, dass die Reiter
// nicht wandern, wenn das Suchfeld wächst.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";

import type { MediumArt } from "@/lib/site-pages";

/** Die fünf Reiter in der Reihenfolge des Vorbilds, mit ihrem Symbol. */
export const ART_REITER: readonly { art: MediumArt; icon: string }[] = [
  { art: "image", icon: "ph:image" },
  { art: "icon", icon: "ph:shapes" },
  { art: "video", icon: "ph:play-circle" },
  { art: "audio", icon: "ph:music-note" },
  { art: "file", icon: "ph:paperclip" },
];

export function MediathekKopf({
  art,
  suche,
  zaehler,
  onArt,
  onSuche,
  onSchliesse,
}: {
  art: MediumArt;
  suche: string;
  /** Bestand je Art, vom Server gezählt. `null` = noch nicht geladen; dann
   *  steht KEINE Zahl da statt einer 0, die sich gleich ändert. */
  zaehler: Record<MediumArt, number> | null;
  onArt: (a: MediumArt) => void;
  onSuche: (s: string) => void;
  onSchliesse: () => void;
}) {
  const t = useTranslations("website.mediathek");

  return (
    <div className="shrink-0">
      <div className="relative flex items-center justify-center bg-slate-800 px-12 py-2.5 text-white">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em]">
          {t("titel")}
        </h2>
        <button
          type="button"
          aria-label={t("schliessen")}
          onClick={onSchliesse}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-white/80 transition hover:bg-white/10 hover:text-white"
        >
          <Icon icon="ph:x" className="size-5" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-4 border-b border-border px-4 py-3">
        <div className="flex min-w-[14rem] max-w-[22rem] flex-1 items-center gap-2 rounded-full border border-border px-3 py-1.5 focus-within:border-(--brand)">
          <Icon
            icon="ph:magnifying-glass"
            className="size-4 shrink-0 text-muted-foreground"
          />
          <input
            value={suche}
            onChange={(e) => onSuche(e.target.value)}
            placeholder={t(`suche.platzhalterArt.${art}`)}
            aria-label={t(`suche.platzhalterArt.${art}`)}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
          {suche ? (
            <button
              type="button"
              aria-label={t("suche.leeren")}
              onClick={() => onSuche("")}
              className="shrink-0 text-muted-foreground transition hover:text-foreground"
            >
              <Icon icon="ph:x" className="size-3.5" />
            </button>
          ) : null}
        </div>

        <nav className="flex flex-1 flex-wrap items-center justify-center gap-1">
          {ART_REITER.map((r) => {
            const aktiv = r.art === art;
            return (
              <button
                key={r.art}
                type="button"
                aria-pressed={aktiv}
                onClick={() => onArt(r.art)}
                className={
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition " +
                  (aktiv
                    ? "bg-(--brand)/10 text-(--brand)"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground")
                }
              >
                <Icon icon={r.icon} className="size-4" />
                {t(`art.${r.art}`)}
                {zaehler ? (
                  <span className="text-xs opacity-70">({zaehler[r.art]})</span>
                ) : null}
              </button>
            );
          })}
        </nav>

        {/* Rechts bleibt bewusst Platz: im Vorbild steht die Reiterreihe
            optisch in der Mitte des Kopfes, und ohne diesen Ausgleich würde
            sie durch das Suchfeld nach rechts rutschen. */}
        <span className="hidden w-[10rem] shrink-0 lg:block" aria-hidden="true" />
      </div>
    </div>
  );
}
