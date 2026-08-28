// Die SPALTEN der Beitragstabelle — Definition, Liste und Rohwert.
//
// WARUM EINE EIGENE DATEI
// =======================
// Drei Stellen brauchen dieselbe Spaltenliste: die Tabelle (was zeigt sie),
// das Sortier-Panel (wonach lässt sich sortieren) und die Filterleiste (wonach
// lässt sich filtern). Stünde sie weiterhin in `beitraege-manager.tsx`, müsste
// Filter und Sortierung aus dem Modul importieren, das SIE importiert — ein
// Kreis, den TypeScript nur deshalb erlaubt, weil Typen zur Laufzeit
// verschwinden. Eine eigene Datei sagt stattdessen, was der Fall ist: die
// Spaltenliste ist die gemeinsame Grundlage, nicht ein Detail der Tabelle.
//
// `rohWert` steht bewusst HIER und nicht bei den Zellen: Anzeige und Vergleich
// sind zwei verschiedene Fragen an denselben Wert. Die Zelle formatiert ein
// Datum, der Filter vergleicht es — wer beides aus derselben Funktion holt,
// filtert am Ende gegen „28. Aug. 2026".
import type { EigenesFeld, Page } from "@/lib/site-pages";

import {
  BEITRAG_FELDER,
  type FeldArt,
  type FeldDef,
  type FeldKonfig,
  konfigVon,
} from "./felder";

/** Eine Spalte der Tabelle.
 *
 *  Im Vorbild entstand diese Liste aus den kundendefinierten Feldern der
 *  Sammlung. Ein Blogbeitrag hat FESTE Felder — deshalb steht sie hier, und
 *  `art` sagt der Zelle, wie sie den Wert zeigt. */
export type Spalte = {
  key: string;
  label: string;
  art:
    | "titel"
    | "status"
    | "bild"
    /** MEHRERE Bilder in einem Feld. Eine eigene Art und nicht „bild": die
     *  Zelle zeigt bis zu drei Miniaturen nebeneinander. */
    | "galerie"
    | "datum"
    | "zahl"
    | "text"
    /** Seite oder externe Adresse. */
    | "link"
    | "liste"
    | "schalter";
  /** Systemspalten sind nicht konfigurierbar — sie haben keinen Namen, den der
   *  Kunde vergeben hätte, und keinen Wert, den er setzen könnte. */
  system?: boolean;
  /** Systemspalten, die sich TROTZDEM in der Zelle ändern lassen. Genau eine:
   *  die Adresse. `Aufrufe`, `Erstellt` und `Zuletzt geändert` sind
   *  schreibgeschützt — im Vorbild ausdrücklich („ein Doppelklick öffnet kein
   *  Eingabefeld", Analyse A4). */
  inline?: boolean;
  /** Die Definition aus dem Katalog, sofern es eine gibt. Nur konfigurierbare
   *  Felder haben eine — `views` und `created` sind reine Anzeige. */
  def?: FeldDef;
  /** Die Definition eines EIGENEN Feldes (0485). Ihr Wert steht nicht in einer
   *  eigenen Spalte der Zeile, sondern unter `beitrag.custom[feld_key]` —
   *  deshalb braucht die Zelle diese Definition, um überhaupt zu wissen, wo
   *  sie nachsehen muss. */
  eigen?: EigenesFeld;
};

/** Die Spalten in ihrer Standardreihenfolge.
 *
 *  Sie entstehen AUS DEM KATALOG (`felder.ts`) und stehen nicht mehr von Hand
 *  hier. Vorher waren es zwei Listen: eine hier, eine im Dialog — und die
 *  Feldkonfiguration hätte eine dritte gebraucht. Ein Feld, das nur eine der
 *  Listen kennt, ist entweder eine Spalte ohne Konfiguration oder eine
 *  Konfiguration ohne Wirkung (Wurzel 2).
 *
 *  Titel und Status stehen NICHT darin: beide sind angeheftet und wandern
 *  nicht, und beide sind im Vorbild ausdrücklich nicht konfigurierbar (C1).
 *  `Aufrufe` und `Erstellt` kommen dazu, obwohl sie im Katalog fehlen — sie
 *  sind Anzeige, nicht Eingabe. */
export function spaltenListe(
  t: (k: string) => string,
  konfig: readonly FeldKonfig[],
  eigene: readonly EigenesFeld[],
): Spalte[] {
  // JEDE Feldart des Katalogs steht hier. Vorher fehlten `galerie` und `link`
  // und fielen ueber `?? "text"` still auf Text zurueck — ein erfundener
  // Ersatzwert fuer einen Fall, den es wirklich gibt (Wurzel 4). Aufgefallen
  // waere es erst, wenn die Spaltenart etwas entscheidet, was sie heute noch
  // nicht entscheidet; genau deshalb steht hier `satisfies` und kein `??`.
  const artVon = {
    text: "text",
    richtext: "text",
    bild: "bild",
    galerie: "galerie",
    datum: "datum",
    liste: "liste",
    link: "link",
    schalter: "schalter",
  } satisfies Record<FeldArt, Spalte["art"]>;
  const ausKatalog = BEITRAG_FELDER.filter((f) => f.spalte).map((def) => {
    const k = konfigVon(def, konfig);
    return {
      key: def.key,
      // Der vom Betrieb vergebene Name gewinnt; sonst der eingebaute aus dem
      // Übersetzungskatalog. Genau dafür gibt es `label` in der Konfiguration.
      label: k.label ?? t(def.i18n),
      art: artVon[def.art],
      def,
    } satisfies Spalte;
  });
  // Die ADRESSE steht im Vorbild als feste Spalte zwischen „Show on the
  // homepage" und „Industry" (Analyse A4). Bei uns fehlte sie ganz: 34 Spalten
  // und keine davon war der Slug — obwohl jeder Beitrag einen hat und er die
  // Adresse ist, unter der er gefunden wird. Sie steht deshalb an derselben
  // Stelle wie dort und nicht hinten bei den Systemspalten.
  //
  // Sie ist KEIN Katalogfeld: die Adresse ist die Identität des Beitrags,
  // genau wie Titel und Status — nichts davon lässt sich umbenennen oder zur
  // Pflicht erklären, weil es das schon ist.
  const slugIdx = ausKatalog.findIndex((c) => c.key === "show_on_homepage");
  const mitSlug: Spalte[] = [...ausKatalog];
  mitSlug.splice(slugIdx === -1 ? mitSlug.length : slugIdx + 1, 0, {
    key: "slug",
    label: t("blog.cm.adresse"),
    art: "text",
    system: true,
    inline: true,
  });
  // Die EIGENEN Felder (0485) stehen HINTER den eingebauten und VOR den
  // Systemspalten: sie sind Inhalt wie die eingebauten, aber neuer — und im
  // Vorbild stehen die frei angelegten Felder ebenfalls unter dem Trenner,
  // nicht dazwischen. Versteckte Felder sind gar keine Spalte: „versteckt"
  // gilt für den ganzen Betrieb, nicht nur für den Dialog.
  const ausEigenen: Spalte[] = eigene
    .filter((f) => !f.versteckt)
    .map((f) => ({
      key: f.feld_key,
      label: f.label,
      art: f.art,
      eigen: f,
    }));

  return [
    ...mitSlug,
    ...ausEigenen,
    { key: "views", label: t("blog.aufrufe"), art: "zahl", system: true },
    { key: "created", label: t("blog.erstellt"), art: "datum", system: true },
    // `Edited` im Vorbild — die zweite der beiden schreibgeschützten
    // Zeitspalten ganz rechts. Sie stand bei uns nirgends, obwohl die Zeile
    // sie seit 0087 führt.
    {
      key: "updated",
      label: t("blog.zuletztGeaendert"),
      art: "datum",
      system: true,
    },
  ];
}



/** Der ROHE Wert einer Spalte in EINER Zeile — für Vergleich und Sortierung.
 *
 *  Nicht der angezeigte: die Zelle formatiert ein Datum als „28. Aug. 2026",
 *  und ein Filter, der dagegen vergleicht, findet nichts, sobald der Nutzer
 *  die Sprache wechselt.
 *
 *  Zurück kommt, was in der Zeile steht — Text, Zahl, Wahrheitswert, Liste
 *  oder `null`. Kein Ersatzwert: „nicht gesetzt" ist die Aussage, auf die die
 *  halbe Operatorliste sich bezieht (Wurzel 4). */
export function rohWert(spalte: Spalte, beitrag: Page): unknown {
  if (spalte.eigen) {
    return (beitrag.custom ?? {})[spalte.eigen.feld_key] ?? null;
  }
  const p = beitrag as unknown as Record<string, unknown>;
  switch (spalte.key) {
    case "published":
      return beitrag.published_at;
    case "created":
      return beitrag.created_at;
    case "updated":
      return beitrag.updated_at;
    case "content":
      return beitrag.content_html;
    case "cover":
      return beitrag.cover_image_url;
    case "views":
      return beitrag.view_count ?? 0;
    case "show_on_homepage":
      return beitrag.show_on_homepage;
    default:
      return p[spalte.key] ?? null;
  }
}
