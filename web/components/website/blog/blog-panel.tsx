"use client";

// Das BLOG-CMS als einfahrendes Großpanel — 1:1 nach `docs/UI` (Foto 19.04.33).
//
//     BLOG                                                    ? ✕
//     ┌──────────┬──────────────────────────────────────────────┐
//     │ Beiträge │  Beiträge                [ + Neuer Beitrag ⌄]│
//     │ Einstell.│  Beiträge anlegen, verwalten und ordnen.     │
//     │ Layouts  │  🔍 …                    ⏷ Filter  ⇅ Sortier.│
//     │ Import   │  ☐ Beiträge (3)   Status         Datum       │
//     │          │  ☐ [Bild] Titel   Veröffentl.   25.08.  ⋯    │
//     └──────────┴──────────────────────────────────────────────┘
//
// Es ist ein PANEL im Editor und keine eigene Route: die Seite dahinter bleibt
// stehen, samt Vorschau. Als Route wäre jeder Klick auf „Blog" ein
// Seitenwechsel — mit neuem Entwurfs-Token, neu geladenem iframe und
// verworfener Auswahl.
//
// FÜNF Menüpunkte:
//   · Beiträge      — die Liste (das eigentliche CMS)
//   · Felder        — welche Felder ein Beitrag hat (0485, Framers „Fields")
//   · Einstellungen — Blogname, Navigation, RSS
//   · Layouts       — wie die Beitragsübersicht auf der Website aussieht
//   · Import        — Beiträge aus einem fremden Feed
//
// „Felder" steht an ZWEITER Stelle und nicht hinten: im Vorbild ist es der
// Reiter direkt neben „Collections", und es ist die Einstellung, die die
// Beitragsmaske selbst bestimmt. Hinter „Import" gestellt wäre es das, was man
// zuletzt sucht — dabei ist es das, was man einmal am Anfang tut.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  type BlogEinstellungen,
  type EigenesFeld,
  type Page,
  resetPostFieldConfig,
  setPostFieldConfig,
} from "@/lib/site-pages";

import { BlogLeiste } from "../einstellungen/blog-leiste";
import { BeitraegeManager } from "./beitraege-manager";
import type { FeldKonfig } from "./felder";
import { FelderPanel } from "./felder-panel";
import { BlogLayouts } from "./blog-layouts";

/** Die Unterpunkte des Blog-Panels, in der Reihenfolge des Fotos:
 *  Beiträge · Einstellungen · Layouts · Import.
 *
 *  Die Reihenfolge ist nicht beliebig, sie folgt der Häufigkeit: an einem Blog
 *  schreibt man täglich Beiträge, stellt einmal den Namen ein, sieht selten
 *  nach dem Layout und importiert genau einmal. */
export const BLOG_PUNKTE = [
  "beitraege",
  "blogFelder",
  "blogEinstellungen",
  "blogLayouts",
  "blogImport",
] as const;
export type BlogPunkt = (typeof BLOG_PUNKTE)[number];

export function BlogPanel({
  punkt,
  onPunkt,
  beitraege,
  seiten,
  einstellungen,
  feldKonfig,
  eigeneFelder,
  liveDomain,
  oeffneBeitragId,
  onNeuLaden,
}: {
  punkt: BlogPunkt;
  onPunkt: (p: BlogPunkt) => void;
  /** Die Blogbeiträge (Seiten vom Typ `post`). */
  beitraege: Page[];
  /** ALLE Seiten — „Layouts" braucht die Blog-Übersichtsseite, und die ist
   *  kein Beitrag. */
  seiten: Page[];
  einstellungen: BlogEinstellungen;
  /** Die gespeicherten Feld-Abweichungen (0481) — siehe `blog/felder.ts`. */
  feldKonfig: readonly FeldKonfig[];
  /** Die EIGENEN Felder dieses Betriebs (0485). */
  eigeneFelder: readonly EigenesFeld[];
  /** Die verbundene Live-Domain, falls es eine gibt. Sie steht unter dem
   *  Slug-Feld als GANZE Adresse — im Vorbild genauso
   *  (`rotating-organization-714551.framer.app/work/dazzle`). Ohne verbundene
   *  Domain bleibt nur der Pfad; eine erfundene Adresse wäre schlimmer als
   *  keine (Wurzel 4). */
  liveDomain: string | null;
  /** Der Beitrag, der beim Ankommen GEÖFFNET wird (`?beitrag=<id>`). So
   *  funktioniert „Im Editor öffnen": die Adresse führt auf die Seite des
   *  Beitrags und trägt gleich mit, welcher Beitrag dort aufgehen soll. */
  oeffneBeitragId?: string | null;
  /** Die Seitenliste neu holen — Anlegen, Löschen und jede Änderung an einem
   *  Beitrag verändern sie. Der Beitrag wird IM PANEL bearbeitet (Dialog über
   *  der Tabelle), nicht durch einen Sprung in den Seiten-Editor: genau das
   *  war der Unterschied zum Vorbild. */
  onNeuLaden: () => void;
}) {
  const t = useTranslations("website");

  return (
    <div className="flex h-full min-h-0">
      {/* Die Menüspalte DES PANELS. Sie steht innen und nicht in der Schale,
          weil das Großpanel die Schalen-Menüspalte überdeckt — eine Spalte,
          die man nicht sieht, kann nicht die Navigation sein. */}
      <nav className="flex w-48 shrink-0 flex-col gap-1 border-r border-border p-3">
        {/* Die SAMMLUNGEN oben, die Werkzeuge darunter — dieselbe Aufteilung
            wie im Vorbild: dort steht über der linken Spalte
            `Collections · Fields · Plugins`, und unter „Collections" die
            Sammlungen mit ihrer Anzahl (`Work  6`).

            Bei uns ist es GENAU EINE Sammlung, und das bleibt so: ein Blog ist
            ein Inhaltstyp mit einer Adresse (`/blog/<slug>`), einer Übersicht
            und einem Renderer. Deshalb steht hier auch KEIN `+` — ein Knopf,
            der keine zweite Sammlung anlegen kann, wäre eine Attrappe. Was er
            im Vorbild anlegt, legt bei uns der Reiter „Felder" an: zusätzliche
            FELDER an dem einen Inhaltstyp (0485).

            „Beiträge" steht deshalb hier und nicht mehr in der Werkzeugliste
            darunter — zweimal derselbe Eintrag wären zwei Wege zu einer
            Ansicht. */}
        <p className="px-3 pb-1 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
          {t("blog.sammlungen")}
        </p>
        <button
          type="button"
          onClick={() => onPunkt("beitraege")}
          aria-current={punkt === "beitraege" ? "true" : undefined}
          className={
            "flex items-center gap-2 rounded-(--radius) px-3 py-2 text-left text-sm transition " +
            (punkt === "beitraege"
              ? "bg-secondary font-medium text-foreground"
              : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground")
          }
        >
          <Icon icon="ph:table" className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{t("menue.beitraege")}</span>
          {/* Die Anzahl wie im Vorbild rechts an der Sammlung. Sie zählt die
              Beiträge, nicht die gefilterte Ansicht — die Zahl in der
              Werkzeugleiste tut das. */}
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {beitraege.length}
          </span>
        </button>

        <span aria-hidden className="my-2 block h-px bg-border" />

        {BLOG_PUNKTE.filter((p) => p !== "beitraege").map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPunkt(p)}
            aria-current={p === punkt ? "true" : undefined}
            className={
              // OHNE Symbol. Vier Wörter untereinander brauchen keine
              // Bildchen zur Unterscheidung — sie machen die Spalte nur
              // unruhig und zwingen den Text in die Kürzung. Die SAMMLUNG
              // darüber trägt eines, weil sie etwas anderes ist als ein
              // Werkzeug.
              "rounded-(--radius) px-3 py-2 text-left text-sm transition " +
              (p === punkt
                ? "bg-secondary font-medium text-foreground"
                : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground")
            }
          >
            {t(`menue.${p}`)}
          </button>
        ))}
      </nav>

      <div className="min-h-0 flex-1 overflow-hidden">
        {punkt === "beitraege" ? (
          <BeitraegeManager
            beitraege={beitraege}
            feldKonfig={feldKonfig}
            eigeneFelder={eigeneFelder}
            liveDomain={liveDomain}
            oeffneBeitragId={oeffneBeitragId}
            onNeuLaden={onNeuLaden}
          />
        ) : punkt === "blogFelder" ? (
          // Die Feldverwaltung. Sie schreibt über dieselben Wege wie die
          // Tabelle (`setPostFieldConfig` für eingebaute Felder, die
          // `eigene-felder`-Endpunkte für eigene) — kein zweiter Schreibweg
          // auf dieselben Werte (Wurzel 2).
          <FelderPanel
            konfig={feldKonfig}
            eigene={eigeneFelder}
            onKonfig={(neu) => {
              void setPostFieldConfig(neu.feld_key, {
                label: neu.label,
                beschreibung: neu.beschreibung,
                platzhalter: neu.platzhalter,
                max_zeichen: neu.max_zeichen,
                pflicht: neu.pflicht,
                mehrzeilig: neu.mehrzeilig,
                versteckt: neu.versteckt,
                standard_wert: neu.standard_wert,
                standard_feld: neu.standard_feld,
              }).then((res) => {
                if (!res.ok) toast.error(res.error);
                onNeuLaden();
              });
            }}
            onKonfigZuruecksetzen={(feldKey) => {
              void resetPostFieldConfig(feldKey).then((res) => {
                if (!res.ok) toast.error(res.error);
                onNeuLaden();
              });
            }}
            onNeuLaden={onNeuLaden}
          />
        ) : punkt === "blogLayouts" ? (
          <BlogLayouts seiten={seiten} />
        ) : (
          // Einstellungen UND Import stehen beide in `BlogLeiste` — sie ist die
          // eine Stelle, an der die Blog-Konfiguration geschrieben wird. Ein
          // zweites Formular daneben wäre ein zweiter Schreibweg auf dieselben
          // Werte (Wurzel 2).
          <div className="h-full overflow-y-auto px-8 py-8">
            <BlogLeiste
              einstellungen={einstellungen}
              ohneKopf
              abschnitt={punkt === "blogImport" ? "import" : "einstellungen"}
            />
          </div>
        )}
      </div>
    </div>
  );
}
