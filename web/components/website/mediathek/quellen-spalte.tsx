"use client";

// Die linke Spalte des Media Managers: woher die Medien kommen (Punkte 3-6).
//
//     ┌──────────────────────┐
//     │  + Medien hochladen  │  ← gefüllte Pille, die Haupthandlung
//     │  ⤓ Bilder importieren│
//     ├──────────────────────┤
//     │ KOSTENLOSE BILDER    │  ← Stock (Unsplash, Pexels)
//     │ PREMIUM-BILDER       │  ← bezahlte Anbieter
//     │ BILDER DIESER SEITE  │  ← unser Bestand
//     │   HOCHGELADEN (65)   │
//     │   GEKAUFT (0)        │
//     │   □ Wäsche (3)       │  ← Ordnerbaum
//     │   + Ordner           │
//     ├──────────────────────┤
//     │ Alle Alt-Texte ⧉     │
//     └──────────────────────┘
//
// DREI QUELLEN, EIN UMSCHALTER
// „Kostenlos", „Premium" und „diese Website" sind keine Filter über demselben
// Bestand, sondern DREI Bestände: zwei davon liegen bei fremden Anbietern und
// werden gesucht, der dritte ist unser und wird verwaltet. Deshalb schalten sie
// den Hauptbereich um, statt ihn zu filtern.
//
// WAS HIER NICHT ERFUNDEN WIRD
// „Premium" ist bei uns heute LEER: es gibt keinen kostenpflichtigen
// Bildanbieter (Shutterstock braucht Abo und AGB-Erweiterung, siehe
// `stock.py`). Der Abschnitt steht trotzdem — und sagt genau das, wenn man ihn
// öffnet. Ein Katalog mit erfundenen Preisen wäre eine Attrappe; ein Abschnitt,
// der benennt, dass kein Anbieter verbunden ist, ist eine Auskunft.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";

import type { MediumArt } from "@/lib/site-pages";

import { type MediaOrdner, type MediaUebersichtDaten } from "@/lib/site-medien";

import { type OrdnerAnsicht, OrdnerBaum } from "./ordner-baum";

/** Welcher Bestand im Hauptbereich steht. */
export type Quelle = "site" | "frei" | "premium";

export function QuellenSpalte({
  art,
  quelle,
  uebersicht,
  ordner,
  rootCount,
  ansicht,
  laedtHoch,
  altTextHref,
  onQuelle,
  onAnsicht,
  onOrdnerGeaendert,
  onHochladen,
  onImport,
}: {
  art: MediumArt;
  quelle: Quelle;
  /** Zahlen vom Server. `null` = noch nicht geladen; dann steht keine Zahl da
   *  statt einer 0, die sich gleich ändert (Wurzel 4). */
  uebersicht: MediaUebersichtDaten | null;
  ordner: MediaOrdner[];
  rootCount: number;
  ansicht: OrdnerAnsicht;
  laedtHoch: boolean;
  /** Ziel des Alt-Text-Überblicks. Als Adresse und nicht als Rückruf: die
   *  Seite öffnet in einem neuen Tab, damit die Arbeit im Dialog stehen bleibt. */
  altTextHref: string;
  onQuelle: (q: Quelle) => void;
  onAnsicht: (a: OrdnerAnsicht) => void;
  onOrdnerGeaendert: () => void;
  onHochladen: () => void;
  onImport: () => void;
}) {
  const t = useTranslations("website.mediathek");
  // Fremde Bestände gibt es nur für Bilder (Stock) und Symbole (Bibliothek).
  // Für Videos, Audio und Dateien einen Abschnitt „kostenlos" anzubieten, der
  // nichts findet, wäre eine leere Versprechung — er erscheint dort nicht.
  const mitFremd = art === "image" || art === "icon";
  const mitPremium = art === "image";
  const mitAltText = art === "image" || art === "icon";

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border">
      <div className="flex shrink-0 flex-col gap-1 p-3">
        <button
          type="button"
          disabled={laedtHoch}
          onClick={onHochladen}
          className="flex items-center justify-center gap-1.5 rounded-full bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60"
        >
          <Icon
            icon={laedtHoch ? "svg-spinners:180-ring" : "ph:plus"}
            className="size-4"
          />
          {laedtHoch ? t("laedtHoch") : t("hochladen.knopf")}
        </button>
        {art === "image" ? (
          <button
            type="button"
            onClick={onImport}
            className="flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <Icon icon="ph:download-simple" className="size-4" />
            {t("import.knopf")}
          </button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto border-t border-border">
        {mitFremd ? (
          <QuellenAbschnitt
            titel={
              art === "icon" ? t("quelle.freieSymbole") : t("quelle.freieBilder")
            }
            aktiv={quelle === "frei"}
            onKlick={() => onQuelle("frei")}
          />
        ) : null}
        {mitPremium ? (
          <QuellenAbschnitt
            titel={t("quelle.premiumBilder")}
            aktiv={quelle === "premium"}
            onKlick={() => onQuelle("premium")}
          />
        ) : null}

        <QuellenAbschnitt
          titel={t(`quelle.eigene.${art}`)}
          aktiv={quelle === "site"}
          onKlick={() => onQuelle("site")}
        />

        {quelle === "site" ? (
          <div className="pb-2">
            {/* Zwei Zahlen, kein Filter: „hochgeladen" und „gekauft" sagen, wo
                der Bestand herkommt. Sie sind bewusst NICHT klickbar — ein
                Filter „nur gekaufte" mit dauerhaft 0 Treffern wäre eine
                Bedienung, die nie etwas tut. */}
            <dl className="flex flex-col gap-2 px-4 pb-3 pt-2 text-xs text-muted-foreground">
              <div className="flex justify-between gap-2">
                <dt>{t("quelle.hochgeladen")}</dt>
                <dd className="tabular-nums">
                  {uebersicht ? uebersicht.hochgeladen_je_art[art] : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>{t("quelle.gekauft")}</dt>
                <dd className="tabular-nums">
                  {uebersicht ? uebersicht.gekauft_je_art[art] : "—"}
                </dd>
              </div>
            </dl>

            <OrdnerBaum
              ordner={ordner}
              rootCount={rootCount}
              aktiv={ansicht}
              onWahl={onAnsicht}
              onGeaendert={onOrdnerGeaendert}
            />
          </div>
        ) : null}
      </div>

      {mitAltText ? (
        <a
          href={altTextHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex shrink-0 items-center justify-center gap-1.5 border-t border-border px-3 py-3 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
        >
          {t("altTexte.link")}
          <Icon icon="ph:arrow-square-out" className="size-3.5" />
        </a>
      ) : null}
    </aside>
  );
}

function QuellenAbschnitt({
  titel,
  aktiv,
  onKlick,
}: {
  titel: string;
  aktiv: boolean;
  onKlick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={aktiv}
      onClick={onKlick}
      className={
        "flex w-full items-center justify-between gap-2 border-b border-border px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide transition " +
        (aktiv
          ? "text-foreground"
          : "text-muted-foreground hover:text-foreground")
      }
    >
      {titel}
      {aktiv ? <Icon icon="ph:caret-down" className="size-3" /> : null}
    </button>
  );
}
