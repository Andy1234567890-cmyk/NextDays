"use client";

// Der Seiten-Editor: „Bearbeiten"-Leiste links, Live-Vorschau rechts.
//
// Das ist der Ersatz für den alten Framer-Canvas (Kamera, Zoom, Frames mit
// x/y/w/h, Layer-Baum, Breakpoint-Flächen, Effects). Der war für Ferienvermieter
// unbedienbar — und der Großteil davon wurde nie gespeichert, weil eine Seite in
// der DB eine FLACHE, geordnete Liste ist. Was bleibt, ist genau das, was die
// Datenstruktur wirklich hergibt:
//
//   • Abschnitte hinzufügen, sortieren, löschen
//   • die Felder eines Abschnitts füllen
//   • sofort sehen, wie es aussieht
//
// Autospeichern statt Speichern-Knopf: der Kunde füllt ein Feld, sieht rechts
// die Folge und arbeitet weiter. Ein Bestätigungsschritt dazwischen ist eine
// Fehlerquelle ohne Nutzen.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type { Branding, CustomDomain } from "@/lib/site-config";
import { Logo } from "@/components/logo";
import { setLocale } from "@/i18n/actions";
import { LOCALES, type Locale } from "@/i18n/locales";
import { hilfeUrl } from "@/lib/marketing-url";
import { kiSeiteUebersetzen } from "@/lib/site-ki";
import {
  type AbschnittEingabe,
  type Block,
  type BlogEinstellungen,
  type BlockType,
  type EigenesFeld,
  type Page,
  type SeitenVorlage,
  type TemplateSummary,
  addContainer,
  createDraftToken,
  createTemplatePreviewToken,
  duplicateContainer,
  moveContainer,
  removeBlock,
  speichereAbschnitte,
  updateBlock,
} from "@/lib/site-pages";

import {
  type LayoutBaustein,
  MAX_ABSCHNITTE,
  abschnittFuer,
} from "../abschnitte";
import { bausteinReihenfolge } from "../ebenen-baum";
import {
  type BrotKrume,
  InspektorKarte,
  InspektorKopf,
} from "../inspektor-rahmen";
import {
  LEISTE_GRUPPEN,
  menueBeschriftung,
  REITER_HREF,
  REITER_SYMBOL,
  ZULETZT_ID,
} from "../reiter";
import {
  BaukastenSchale,
  type SpeicherStand,
} from "../schale";
import { useVerlauf } from "../use-verlauf";
import { useVorschauToken } from "../use-vorschau-token";
import { useZuletzt } from "../use-zuletzt";
import { BLOG_PUNKTE, type BlogPunkt, BlogPanel } from "../blog/blog-panel";
import { BeitragsTeile } from "../blog/beitrags-teile";
import type { FeldKonfig } from "../blog/felder";
import { protokoll, protokollFehler } from "./protokoll";
import {
  KopfSymbol,
  SpeicherHaken,
  SprachWahl,
  VeroeffentlichenKnopf,
  VerlaufKnoepfe,
  WebsiteAnsehen,
} from "../kopfleiste";
import { SeitenWahl } from "../seiten-wahl";
import { type Geraet, GeraeteUmschalter, VorschauFlaeche } from "../vorschau";
import { AbschnittDesign } from "./abschnitt-design";
import { ContainerInspektor } from "./container-inspektor";
import { AbschnittInspektor } from "./abschnitt-inspektor";
import {
  HinzufuegenPanel,
  type KatalogKategorie,
} from "../hinzufuegen-panel";
import { MedienPanel } from "../medien-panel";
import {
  type EbenenAktion,
  EbenenListe,
  type EbenenZug,
} from "../ebenen-liste";
import { SeitenEinstellungen } from "../seiten/seiten-einstellungen";
import { SeitenLeiste } from "../seiten/seiten-leiste";
import type { DesignUnterseite } from "../design-ansicht";
import { DesignPanel } from "../design/design-panel";
import { VorlagenPanel } from "../vorlagen-panel";
import { FlaechenOverlay, type Rechteck } from "./flaechen-overlay";
import type { MenuOrt } from "./flaechen-teile";
import { type CanvasMeldung, useCanvasBruecke } from "./use-canvas-bruecke";
import { mitVersteckt, versteckteGeraete } from "./sichtbarkeit";
import {
  eigenesEchoMerken,
  useBaukastenRealtime,
} from "../baukasten-realtime";

/** Ein Abschnitt im Editor. `id: null` = noch nicht gespeichert.
 *  `key` ist stabil über Umsortieren hinweg (React-Identität), die DB-`id`
 *  eignet sich dafür nicht, weil neue Abschnitte noch keine haben. */
type Zeile = {
  key: string;
  id: string | null;
  typ: BlockType;
  content: Record<string, unknown>;
  settings: Record<string, unknown>;
  /** Die Spalte, in der dieser Baustein sitzt (0472). `null` bei einem neu
   *  angelegten, der noch keinen Platz im Baum hat — der Server hängt ihn beim
   *  Speichern in eine eigene Spalte. */
  parentId?: string | null;
};

/** Locale-Map aus einem Content-Feld (leeres Objekt, wenn es keine ist). */
function alsKarte(v: unknown): Record<string, string> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, string>)
    : {};
}

let laufendeNummer = 0;
function neuerKey(): string {
  laufendeNummer += 1;
  return `neu-${laufendeNummer}`;
}

function zuZeilen(blocks: Block[]): Zeile[] {
  // NUR die Bausteine. Abschnitte und Spalten sind Struktur (0472) und gehören
  // in den Ebenen-Baum, nicht in die Bearbeitungsliste.
  //
  // Ohne diesen Filter stand jeder Container als „Unbekannter Abschnitt" in der
  // Liste — der Katalog kennt `container` nicht, und er soll ihn auch nicht
  // kennen: man legt keinen Container an, indem man ihn aus dem Katalog wählt.
  return blocks
    .filter((b) => (b.kind ?? "widget") === "widget")
    .map((b) => ({
      key: b.id,
      id: b.id,
      typ: b.type,
      content: b.content,
      settings: b.settings,
      parentId: b.parent_id ?? null,
    }));
}

/** Welche Bereiche der Leiste im Editor nur das PANEL wechseln.
 *
 *  „seiten" ist dabei: es führt zurück auf die Abschnittsliste, die der
 *  Normalzustand des Editors ist. */
const ALS_PANEL = [
  "hinzufuegen",
  "vorlagen",
  "seiten",
  "ebenen",
  "design",
  "blog",
] as const;

/** Das gerade gezeigte Panel. `null` = die Abschnittsliste. */
type PanelId =
  | "hinzufuegen"
  | "vorlagen"
  | "seiten"
  | "ebenen"
  | "design"
  // Der Blog. Er ist KEINE eigene Route: im Vorbild fährt sein CMS von links
  // über die Arbeitsfläche, die Seite dahinter bleibt stehen. Als Route wäre
  // jeder Klick auf „Blog" ein Seitenwechsel — mit neuem Entwurfs-Token,
  // neu geladenem iframe und verworfener Auswahl. Genau das war die
  // Beschwerde („warum ist blog eine unterseite").
  | "blog"
  | null;

/** Ein Container samt allem, was darunter hängt — für die sofortige Anzeige.
 *
 *  Die Datenbank macht dasselbe über `on delete cascade` an `parent_id`
 *  (0472). Hier wird es nachgezeichnet, damit die Ebenen-Liste nicht eine
 *  Sekunde lang Spalten und Bausteine eines Abschnitts zeigt, den es nicht
 *  mehr gibt. */
function ohneTeilbaum(blocks: Block[], wurzelId: string): Block[] {
  const weg = new Set([wurzelId]);
  // Mehrfach durchlaufen: die Liste ist nicht nach Tiefe sortiert, ein Kind
  // kann vor seinem Elternteil stehen. Bei drei Ebenen (Abschnitt · Spalte ·
  // Baustein) sind das höchstens drei Runden.
  let gewachsen = true;
  while (gewachsen) {
    gewachsen = false;
    for (const b of blocks) {
      if (b.parent_id && weg.has(b.parent_id) && !weg.has(b.id)) {
        weg.add(b.id);
        gewachsen = true;
      }
    }
  }
  return blocks.filter((b) => !weg.has(b.id));
}

/** Die Bausteinliste des Editors in die Reihenfolge des Baums bringen.
 *
 *  Zeilen, zu denen der Baum nichts sagt (gerade angelegt, noch ohne ID),
 *  behalten ihren Platz am Ende: sie wegzulassen hieße, sie zu löschen. */
function nachBaumOrdnen<T extends { id: string | null }>(
  zeilen: T[],
  baum: Block[],
): T[] {
  const rang = new Map(bausteinReihenfolge(baum).map((id, i) => [id, i]));
  return [...zeilen].sort(
    (a, b) =>
      (rang.get(a.id ?? "") ?? Number.MAX_SAFE_INTEGER) -
      (rang.get(b.id ?? "") ?? Number.MAX_SAFE_INTEGER),
  );
}

/** Zwei Geschwister tauschen ihre Position — die Vorwegnahme von
 *  `moveContainer`. Nur die Zahl, nicht die Listenreihenfolge: sortiert wird
 *  in der Ebenen-Ansicht über `position`. */
function mitGetauschtemRang(
  blocks: Block[],
  einer: string,
  anderer: string,
): Block[] {
  const a = blocks.find((b) => b.id === einer);
  const b = blocks.find((x) => x.id === anderer);
  if (!a || !b) return blocks;
  return blocks.map((x) =>
    x.id === a.id
      ? { ...x, position: b.position }
      : x.id === b.id
        ? { ...x, position: a.position }
        : x,
  );
}

const ENTPRELLUNG_MS = 900;
const QUITTUNG_MS = 2500;

export function AbschnittsEditor({
  page,
  pages,
  initialBlocks,
  baumBlocks: baumVomServer,
  branding,
  templates,
  templateKategorien,
  seitenVorlagen,
  blogEinstellungen,
  blogFeldKonfig,
  blogEigeneFelder,
  domains = [],
}: {
  page: Page;
  pages: Page[];
  initialBlocks: Block[];
  /** Dieselben Blöcke MIT den Container-Zeilen — nur für die Ebenen-Ansicht.
   *  `initialBlocks` enthält nur die Bausteine; daraus lässt sich kein Baum
   *  bauen, weil zu jedem Baustein der Elternteil fehlt. */
  baumBlocks: Block[];
  /** Für das Design-Panel. */
  branding: Branding;
  /** Für das Vorlagen-Panel. */
  templates: TemplateSummary[];
  templateKategorien: string[];
  seitenVorlagen: SeitenVorlage[];
  /** Für das Blog-Panel: Blogname, Navigation, RSS. */
  blogEinstellungen: BlogEinstellungen;
  /** Die gespeicherten Feld-Abweichungen des Blog-CMS (0481). Nur
   *  Abweichungen — die Vorgaben stehen im Katalog `blog/felder.ts`. */
  blogFeldKonfig: readonly FeldKonfig[];
  /** Die EIGENEN Beitragsfelder dieses Betriebs (0485). Sie werden zu
   *  Spalten der Beitragstabelle und zu Zeilen im Beitragsdialog. */
  blogEigeneFelder: readonly EigenesFeld[];
  /** Für „Website ansehen" in der Kopfzeile — die aktive Domain darin ist das
   *  Ziel der Live-Fassung. Leer heißt „noch keine Domain": das Menü zeigt dann
   *  nur den Entwurf, statt auf eine Adresse zu führen, die es nicht gibt. */
  domains?: CustomDomain[];
}) {
  const t = useTranslations("website");
  const router = useRouter();
  // ZWEI Sprachen, die man nicht verwechseln darf:
  //
  //   `dashboardLocale` — die Sprache der OBERFLÄCHE (Knopfbeschriftungen,
  //     Panel-Titel). Sie kommt von next-intl und wird hier NICHT umgeschaltet:
  //     wer die englische Fassung seiner Website bearbeitet, will nicht sein
  //     halbes Dashboard auf Englisch bekommen.
  //   `locale` — die Sprache des INHALTS, also welche Sprachfassung die
  //     Vorschau zeigt und der Inspektor bearbeitet. Sie ist umschaltbar
  //     (Sprachwahl in der Kopfzeile) und geht an BEIDE Stellen zugleich —
  //     getrennte Zustände hießen: der Kunde tippt in der Vorschau auf Dänisch
  //     und im Formular auf Deutsch.
  //
  // Vorher gab es nur die erste, und sie diente als beides. Ein deutscher
  // Betrieb konnte seine englische Fassung deshalb nur erreichen, indem er sein
  // eigenes Dashboard auf Englisch stellte.
  const dashboardLocale = useLocale();
  // ALLE 24 EU-Amtssprachen stehen in der Wahl (Vorgabe vom 26.08.2026) —
  // nicht nur die, die die Website schon führt.
  //
  // Vorher war es `branding.languages`, also die geführten. Das klang richtig
  // („keine Fassung anbieten, die es nicht gibt"), sperrte den Betrieb aber
  // genau dort aus, wo er anfängt: bei leeren Feldern stand keine einzige
  // Sprache zur Wahl, und die Fassung, die er anlegen WOLLTE, war die einzige,
  // die er nicht auswählen konnte.
  //
  // Der Renderer verträgt das: `pickText` fällt auf den ersten nicht-leeren
  // Text zurück, eine noch nicht gepflegte Fassung zeigt also den vorhandenen
  // Text statt einer leeren Seite (`builder/lib/sprache.ts`). Welche Sprachen
  // die Website AUSLIEFERT, entscheidet weiterhin allein
  // `branding.languages` — diese Wahl hier bestimmt nur, welche Fassung im
  // Editor bearbeitet wird.
  const websiteSprachen = LOCALES as readonly Locale[] as Locale[];
  // Die tatsächlich geführten — sie tragen im Menü die Markierung. Ohne diese
  // Unterscheidung sähen alle 24 gleichrangig aus, und niemand wüsste, welche
  // davon ein Gast je zu sehen bekommt.
  const gefuehrteSprachen = (branding.languages ?? []).filter(
    (l): l is Locale => (LOCALES as readonly string[]).includes(l),
  );
  const standardSprache =
    branding.default_language &&
    (LOCALES as readonly string[]).includes(branding.default_language)
      ? (branding.default_language as Locale)
      : null;
  // Startpunkt: die Standardsprache der Website, sonst ihre erste geführte,
  // sonst die des Dashboards. KEIN fester Wert wie `"de"` — bei einer Website,
  // die nur Dänisch führt, wäre das eine Fassung, die es nicht gibt (Wurzel 4).
  const [inhaltsSprache, setInhaltsSprache] = useState<Locale | null>(null);
  // Der Startwert ist die Sprache der OBERFLÄCHE.
  //
  // Sie und die Inhaltssprache sind seit dem Umbau EINE Wahl (siehe `onWahl`
  // der Sprachwahl): wer den Editor auf Dänisch bedient, bearbeitet die
  // dänische Fassung. Vorher stand hier die Standardsprache der Website
  // zuerst — die Flagge zeigte dann DA, während die Knöpfe deutsch dastanden,
  // also zwei Aussagen über dieselbe Sache.
  const locale = inhaltsSprache ?? (dashboardLocale as Locale);
  // Die aktive Domain für „Website ansehen" in der Kopfzeile. `null` heißt
  // „noch keine": das Menü zeigt dann nur den Entwurf (Wurzel 4 — keine
  // erfundene Adresse).
  const liveDomain = domains.find((d) => d.status === "active")?.domain ?? null;

  /** Ist die offene Seite ein BLOGBEITRAG?
   *
   *  Er hat keine Abschnitte und keinen Baum — sein Inhalt steht in
   *  `content_html` und den Beitragsfeldern. Abschnittsliste und Ebenen
   *  zeigen fuer ihn deshalb seine TEILE. */
  const istBeitrag = page.page_type === "post";

  /** Den Beitragsdialog oeffnen — der eine Ort, an dem seine Felder
   *  bearbeitet werden. Ueber die Adresse, damit ein Neuladen dieselbe
   *  Ansicht zeigt (`?panel=blog&beitrag=<id>`). */
  const beitragOeffnen = useCallback(() => {
    router.replace(
      `/website/seiten/${page.id}?panel=blog&beitrag=${page.id}`,
      { scroll: false },
    );
  }, [page.id, router]);

  const [zeilen, setZeilen] = useState<Zeile[]>(() => zuZeilen(initialBlocks));
  const [bestaetigt, setBestaetigt] = useState<string>(() =>
    JSON.stringify(zuZeilen(initialBlocks)),
  );
  const [aktiv, setAktiv] = useState<string | null>(null);

  // Zeigt die Seitenleiste gerade das „Hinzufügen"-Panel? Ein eigener Zustand
  // und kein Dialog: der Kunde soll die Vorschau daneben behalten, während er
  // sucht — genau dafür ist ein Panel da.
  // WELCHES Panel die Leiste gerade zeigt. `null` = die Abschnittsliste (der
  // Normalfall, wenn man von der Seitenliste kommt).
  //
  // Ein Zustand für alle Bereiche und nicht ein Schalter je Bereich: zwei
  // Schalter konnten beide `true` sein, und dann entschied die Reihenfolge im
  // JSX, was man sieht — ein Fehler, der sich erst beim dritten Bereich zeigt.
  const [panel, setPanel] = useState<PanelId>(null);
  // „Mehr" ist die AUSNAHME von der Regel eine Zeile höher — und zwar keine
  // halbe: es ist kein weiterer Panel-Zustand, sondern eine andere Achse. Die
  // sechs Bereiche darunter (Objekte · Regeln · Anfragen · Widgets · Vorlagen ·
  // Einstellungen) sind eigene Routen mit eigenen Daten, keine Panels über
  // dieser Vorschau. „Mehr" öffnet deshalb NUR seine Menüspalte; das Panel
  // daneben bleibt, was es war. Zwei `true` können sich hier nicht
  // widersprechen, weil die beiden Zustände verschiedene Spalten steuern.
  const [mehrOffen, setMehrOffen] = useState(false);
  /** Welcher Theme-Unterpunkt im Design-Panel offen ist.
   *
   *  Er lebt HIER, weil die Menüspalte ihn setzt und das Panel ihn zeigt —
   *  zwei Bauteile, ein Zustand. Bis 27.08.2026 trugen die sieben Einträge ein
   *  `href` und wechselten damit die ganze Seite (Prüfbericht C4). */
  const [designUnterpunkt, setDesignUnterpunkt] =
    useState<DesignUnterseite | null>(null);
  // Läuft gerade ein Übersetzungslauf (0476)? Nur für den Knopf-Zustand —
  // der Lauf selbst ist idempotent, ein Doppelklick kostet also nichts, aber
  // ein Knopf ohne Rückmeldung sieht kaputt aus.
  const [uebersetztLaeuft, setUebersetztLaeuft] = useState(false);
  // Seiteninformation (ⓘ in der Kopfzeile) — ein Dialog über der Fläche und
  // kein Panel: er bearbeitet die Seite als GANZES (Titel, Adresse, SEO), nicht
  // einen ihrer Abschnitte, und die Vorschau dahinter soll stehen bleiben.
  const [infoOffen, setInfoOffen] = useState(false);

  // Welcher Baustein gerade aus dem Panel gezogen wird. Er lebt HIER und nicht
  // im Panel: die Abwurffläche liegt über der Vorschau, also brauchen beide
  // Seiten denselben Zustand.
  const [zieht, setZieht] = useState<BlockType | null>(null);
  // Eine ANGESEHENE Vorlage. Solange sie gesetzt ist, zeigt die Fläche rechts
  // sie statt der eigenen Seite — ohne dass etwas übernommen wäre.
  //
  // Zwei getrennte Zustände (Kennung UND Token), weil der Token erst geholt
  // werden muss: eine Adresse aus Kennung ohne Token wäre eine 401 im iframe,
  // und der Kunde sähe eine Fehlerseite statt einer Vorlage.
  const [vorlageAnsehen, setVorlageAnsehen] = useState<string | null>(null);
  const [vorlageToken, setVorlageToken] = useState<string | null>(null);
  /** Wird ein BILD gezogen, reist seine Adresse mit — sonst müsste der Kunde
   *  es nach dem Abwurf ein zweites Mal wählen. */
  const [ziehtBild, setZiehtBild] = useState<string | null>(null);
  // Was das Panel links zeigt, solange ein Abschnitt gewählt ist: seinen
  // INHALT (das Formular) oder sein DESIGN (Sichtbarkeit, Abstände).
  // Beides untereinander wäre in dieser Breite eine Bildlaufstrecke, an
  // deren Ende niemand sucht — Hostaway trennt es aus demselben Grund in
  // `Manage …` und `Edit Design`.
  const [panelModus, setPanelModus] = useState<"inhalt" | "design">(
    "inhalt",
  );
  // An welcher Stelle der Katalog einfügt. `null` = ans Ende (der Knopf
  // unter der Liste); eine Zahl = genau dort (das `+` an einer Karte).
  const [einfuegenVor, setEinfuegenVor] = useState<number | null>(null);
  /** Läuft gerade ein Layout-Einsatz? Er besteht aus mehreren Requests
   *  (Abschnitt, dann je Spalte einer) — ein Doppelklick würde die Struktur
   *  doppelt anlegen. */
  const [legtLayoutAn, setLegtLayoutAn] = useState(false);
  const [geraet, setGeraet] = useState<Geraet>("desktop");
  const [stand, setStand] = useState<SpeicherStand>("ruht");
  // Welche Kategorie der Katalog zeigt. Sie kommt aus der MENÜSPALTE und ist
  // deshalb ein Zustand DES EDITORS, nicht des Panels: die Spalte steht
  // außerhalb des Panels, und ein Zustand im Panel wäre für sie unerreichbar.
  const [kategorie, setKategorie] = useState<KatalogKategorie>(ZULETZT_ID);
  const { zuletzt, merken } = useZuletzt();
  // Welcher Punkt des Blog-CMS offen ist. Er lebt hier und nicht im Panel,
  // weil das Panel beim Schließen verschwindet — und wer es wieder öffnet,
  // soll dort weitermachen, wo er war.
  const [blogPunkt, setBlogPunkt] = useState<BlogPunkt>("beitraege");

  // --- Live-Vorschau ------------------------------------------------------

  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Die Geometrie der Abschnitte, gemeldet vom Renderer. Leer, bis der
  // Handschlag steht — dann zeichnet die Auswahl-Schicht nichts, statt Rahmen
  // an geratene Stellen zu legen (Wurzel 4).
  const [rechtecke, setRechtecke] = useState<Map<number, Rechteck>>(new Map());
  const [ueberfahren, setUeberfahren] = useState<number | null>(null);
  // Zeigerposition IM iframe. Sie entscheidet, an welcher Naht das „+" steht —
  // nicht der Abschnitt, in dem der Zeiger gerade steht.
  const [zeiger, setZeiger] = useState<{ x: number; y: number } | null>(null);
  const [menu, setMenu] = useState<MenuOrt>(null);
  const [neuLaden, setNeuLaden] = useState(0);
  /** Der ausgewählte CONTAINER (Abschnitt oder Spalte), oder `null` (0479).
   *
   *  NEBEN `aktiv` und nicht darin: `aktiv` ist ein Schlüssel aus `zeilen`,
   *  und Container stehen dort nicht (der Editor führt nur Bausteine, siehe
   *  `zuZeilen`). Beides in einen Zustand zu pressen hieße, an jeder Stelle
   *  erst wieder auseinanderzusortieren, was gemeint ist. */
  const [containerId, setContainerId] = useState<string | null>(null);

  /** Der Baum, wie ihn die Oberfläche ZEIGT — mit sofortiger Wirkung (0479).
   *
   *  Er beginnt als Kopie des Server-Stands und übernimmt jede neue Fassung,
   *  die von dort kommt. Dazwischen darf er vorauseilen: eine Strukturänderung
   *  wird HIER sofort sichtbar, während der Server-Refresh noch läuft.
   *
   *  Warum das nötig ist: `router.refresh()` lädt die ganze Editor-Seite neu
   *  (Seitenliste, Blöcke, Baum, Vorlagen, Blog) und braucht dafür deutlich
   *  über eine Sekunde. Bis dahin stand der Ebenen-Baum unverändert da — der
   *  gelöschte Abschnitt war in der Datenbank weg und in der Liste noch zu
   *  sehen. Aus Sicht des Kunden tut der Knopf nichts, und der zweite Klick
   *  darauf geht dann auf eine Zeile, die es nicht mehr gibt. Gemeldet am
   *  28.08.2026 als „ES GEHT gar Nichts".
   *
   *  Der Server bleibt die Wahrheit: was er als Nächstes schickt, gewinnt. Der
   *  lokale Stand ist eine Vorschau auf dessen Antwort, kein zweiter Bestand
   *  (Wurzel 2 — es gibt weiterhin EINEN Schreibweg). */
  const [baumBlocks, setBaumBlocks] = useState<Block[]>(baumVomServer);
  useEffect(() => {
    setBaumBlocks(baumVomServer);
  }, [baumVomServer]);

  const { token, tokenFehler } = useVorschauToken(page.id, createDraftToken);

  // --- Autospeichern ------------------------------------------------------
  const zeilenRef = useRef(zeilen);
  zeilenRef.current = zeilen;

  // Ankunft aus einem anderen Reiter: `?abschnitt=<index>` wählt den Abschnitt
  // vor, den der Kunde dort im Bild angeklickt hat. Ohne das landet er zwar auf
  // der richtigen Seite, aber wieder in der Suche nach der Stelle, die er
  // gerade noch unter dem Zeiger hatte.
  //
  // Nur EINMAL nach dem Laden — danach gehört die Auswahl dem Nutzer. Ein
  // Effekt, der dauerhaft auf die Adresse hört, würde jede spätere Auswahl
  // beim nächsten Render wieder überschreiben.
  const suchParameter = useSearchParams();
  const ankunftVerbraucht = useRef(false);

  // `?panel=ebenen|hinzufuegen` — die Leiste zeigt dorthin, weil ein Link eine
  // Adresse braucht. Wer von außen kommt, landet im Editor mit dem passenden
  // Panel; wer schon hier ist, wechselt es ohne Seitenwechsel (`onReiter`).
  const panelWunsch = suchParameter.get("panel");
  // `?beitrag=<id>` — welcher Beitrag im Blog-Panel GEÖFFNET werden soll.
  //
  // Dafür gibt es „Im Editor öffnen" im Zeilenmenü: der Beitrag ist eine
  // eigene Seite (`page_type = "post"`), und der Punkt führt auf sie. Ohne
  // diesen Parameter landete man dort auf einem LEEREN Abschnitts-Editor —
  // ein Beitrag hat keine Abschnitte, sein Inhalt steht in `content_html` und
  // den Beitragsfeldern. Genau so wurde es gemeldet („wenn wir open im editor
  // klicken geht es nicht", 28.08.2026).
  //
  // Mit ihm öffnet dieselbe Adresse den Editor der Beitragsseite UND den
  // Beitrag darin — die Vorschau daneben zeigt seine Seite, das Panel seinen
  // Inhalt.
  const beitragWunsch = suchParameter.get("beitrag");
  useEffect(() => {
    // LAUFEND und nicht nur einmal beim Mounten. Vorher stand hier ein
    // `panelVerbraucht`-Ref: die Adresse wurde EIN Mal gelesen und danach nie
    // mehr — und weil `setPanel` sie umgekehrt nie zurückschrieb, log die URL
    // ab dem ersten Panelwechsel. Ein weitergegebener Link öffnete nicht die
    // Ansicht, die der Absender sah, der Zurück-Knopf sprang aus dem Editor
    // heraus statt durch die Panels, und ein Neuladen warf den Stand weg
    // (Prüfbericht C1).
    //
    // Jede Panel-Kennung, die die Leiste kennt, darf aus der Adresse kommen.
    // Ein unbekannter Wert schließt das Panel, statt einen zu erfinden.
    const ziel = (ALS_PANEL as readonly string[]).includes(panelWunsch ?? "")
      ? (panelWunsch as PanelId)
      : null;
    setPanel(ziel);
    // „Mehr" ist eine eigene Achse (siehe oben) und steht nie in `?panel=`.
    // Wer über die Adresse ein Panel wählt, verlässt damit die Mehr-Spalte.
    if (ziel) setMehrOffen(false);
  }, [panelWunsch]);

  /** Ein Panel öffnen/schließen UND die Adresse mitführen.
   *
   *  Der einzige Weg, das Panel zu wechseln. `setPanel` direkt aufzurufen
   *  wäre der Fehler aus C1: der Zustand ändert sich, die Adresse nicht.
   *
   *  `replace` und nicht `push`: ein Panelwechsel ist keine neue Seite im
   *  Verlauf des Browsers — sonst bräuchte man nach fünf Klicks im Panel fünf
   *  Mal „zurück", um den Editor zu verlassen. Der Zurück-Knopf springt damit
   *  auf die Ansicht, aus der man in den Editor kam.
   *
   *  `scroll: false`, weil die Vorschau sonst bei jedem Panelwechsel nach oben
   *  springt. */
  const panelSetzen = useCallback(
    (ziel: PanelId) => {
      setPanel(ziel);
      const suche = new URLSearchParams(suchParameter.toString());
      if (ziel) suche.set("panel", ziel);
      else suche.delete("panel");
      const frage = suche.toString();
      router.replace(`/website/seiten/${page.id}${frage ? `?${frage}` : ""}`, {
        scroll: false,
      });
    },
    [page.id, router, suchParameter],
  );

  useEffect(() => {
    if (ankunftVerbraucht.current) return;
    const roh = suchParameter.get("abschnitt");
    if (roh == null) return;
    ankunftVerbraucht.current = true;
    const idx = Number(roh);
    if (!Number.isInteger(idx)) return;
    const zeile = zeilenRef.current[idx];
    if (zeile) setAktiv(zeile.key);
  }, [suchParameter]);
  const laeuft = useRef(false);

  /** Läuft ein Speichervorgang, während sich etwas ändert? Dann NACHHOLEN,
   *  nicht verwerfen. */
  const nachholen = useRef(false);

  const schreibe = useCallback(async () => {
    // Ein zweiter Lauf während des ersten würde denselben Stand doppelt
    // schreiben. Also vormerken und nach dem Abschluss einmal nachholen —
    // früher wurde er still verworfen, und die letzte Eingabe ging verloren.
    if (laeuft.current) {
      nachholen.current = true;
      return;
    }
    const gesendet = zeilenRef.current;
    laeuft.current = true;
    setStand("speichert");
    const items: AbschnittEingabe[] = gesendet.map((r) => ({
      id: r.id,
      type: r.typ,
      content: r.content,
      settings: r.settings,
      // Die SPALTE mitschicken. Ein Baustein, den der Kunde in eine Spalte
      // gezogen hat, muss dort bleiben — ohne dieses Feld legte der Server
      // ihm bei jedem Speichern eine eigene Hülle an, also seine eigene
      // Reihe, und das Spaltenlayout fiel bei der ersten Eingabe auseinander.
      //
      // Seit 0479 gilt das auch für BESTEHENDE Bausteine: der Server hängt
      // sie an die mitgeschickte Spalte um. Damit ist „Baustein in eine andere
      // Spalte ziehen" überhaupt erst möglich — vorher blieb jeder Baustein
      // für immer in der Spalte, in der er entstanden ist.
      parent_id: r.parentId ?? null,
    }));
    protokoll("speichern", "Abschnitte werden geschickt", {
      seite: page.id,
      anzahl: items.length,
      // `null` heißt „neu, noch nie gespeichert". Eine Liste, in der eine
      // erwartete ID fehlt, erklärt ein verschwundenes Löschen sofort.
      ids: items.map((i) => i.id),
      typen: items.map((i) => i.type),
    });
    const res = await speichereAbschnitte(page.id, items);
    laeuft.current = false;

    if (!res.ok) {
      // Der Fehlertext steht IM Satz und nicht nur im Datenobjekt: eine
      // Konsolenzeile „Speichern fehlgeschlagen ▸Object" zeigt beim Melden
      // niemand aufgeklappt, und damit fehlt genau die Angabe, die zählt.
      protokollFehler("antwort", `Speichern fehlgeschlagen: ${res.error}`, {
        seite: page.id,
        fehler: res.error,
      });
      setStand("fehler");
      toast.error(res.error);
      return;
    }
    protokoll("antwort", "Abschnitte gespeichert", {
      seite: page.id,
      zurueck: res.data.items.length,
      ids: res.data.items.map((i) => i.id),
    });

    // Die Antwort trägt die echten DB-IDs — die brauchen wir, sonst legt der
    // nächste Lauf dieselben Abschnitte erneut an.
    //
    // Zwischen Absenden und Antwort kann der Kunde weitergetippt haben. Den
    // Serverstand blind zu übernehmen würde diese Eingabe verschlucken; sie
    // einfach zu behalten würde die IDs verlieren. Also: IDs vom Server,
    // Inhalte vom lokalen Stand, wo er sich seit dem Absenden geändert hat.
    const vomServer = zuZeilen(res.data.items);
    const inzwischen = zeilenRef.current;

    // Zusammengeführt wird über den KEY, nicht über die Position.
    //
    // Vorher lief der Abgleich über den Index (`inzwischen[i]`) und setzte
    // damit voraus, dass an derselben Stelle noch derselbe Abschnitt steht.
    // Genau das ist falsch, sobald während des Requests eingefügt, gelöscht
    // oder verschoben wird — und das sind vier der Handgriffe, die der Editor
    // anbietet. Beispiel: 5 Abschnitte, der erste wird während des Speichern
    // gelöscht. Dann steht an Position 0 lokal B, gesendet A. Tragen beide
    // denselben Typ (zwei Textabschnitte untereinander), wurde B's Inhalt in
    // A's Zeile geschrieben UND die Liste auf 5 Zeilen zurückgesetzt: die
    // Löschung war rückgängig, ein Abschnitt trug fremden Text, und der
    // nächste Lauf schrieb das so in die DB.
    //
    // Der Typvergleich half dagegen nicht: bei zwei Abschnitten desselben Typs
    // ist er wirkungslos. Der Key ist stabil über alle vier Handgriffe.
    const gesendetNachKey = new Map(gesendet.map((r) => [r.key, r]));
    const lokalNachKey = new Map(inzwischen.map((r) => [r.key, r]));
    const verschmolzen = vomServer.map((zeile, i) => {
      // Der Server gibt neue Keys zurück; die Brücke zum lokalen Stand ist
      // der Key der GESENDETEN Zeile an derselben Stelle. Das ist zulässig,
      // weil `gesendet` und `vomServer` dieselbe Liste sind — einmal hin,
      // einmal zurück, ohne dass ein Handgriff dazwischenkommt.
      const gesendetItem = gesendet[i];
      if (!gesendetItem) return zeile;
      const lokal = lokalNachKey.get(gesendetItem.key);
      // Steht die Zeile lokal nicht mehr, ist sie inzwischen gelöscht worden.
      // Dann NICHTS von ihr übernehmen — die Löschung holt der nächste Lauf
      // nach (`nachholen`).
      if (!lokal || !gesendetNachKey.has(gesendetItem.key)) return zeile;
      // `content` UND `settings` retten. `settings` fehlte hier, und es ist
      // ein eigener, vom Nutzer bearbeiteter Zweig: Hintergrund, Abstände und
      // die Gerätesichtbarkeit (0449) stehen nur dort. Wer während eines
      // laufenden Speichervorgangs eine Farbe setzte oder einen Abschnitt auf
      // Mobil ausblendete, verlor das lautlos — `setBestaetigt(vomServer)`
      // erklärte den Serverstand danach für gespeichert, also feuerte die
      // Entprellung nicht mehr und der Editor zeigte „gespeichert".
      const inhaltNeu =
        JSON.stringify(lokal.content) !== JSON.stringify(gesendetItem.content);
      const settingsNeu =
        JSON.stringify(lokal.settings) !==
        JSON.stringify(gesendetItem.settings);
      if (!inhaltNeu && !settingsNeu) return zeile;
      return {
        ...zeile,
        content: inhaltNeu ? lokal.content : zeile.content,
        settings: settingsNeu ? lokal.settings : zeile.settings,
      };
    });

    // Auswahl über den KEY der gesendeten Zeile retten, nicht über deren
    // Position: `gesendet.findIndex` lieferte einen Index in die GESENDETE
    // Liste, und `verschmolzen[index]` griff daneben, sobald sich die Anzahl
    // inzwischen geändert hatte.
    const index = gesendet.findIndex((r) => r.key === aktiv);
    setZeilen(verschmolzen);
    // Der bestätigte Stand ist der SERVERSTAND, nicht der verschmolzene: sonst
    // gilt eine noch nicht gespeicherte Eingabe als gespeichert.
    setBestaetigt(JSON.stringify(vomServer));
    setAktiv(index >= 0 ? (verschmolzen[index]?.key ?? null) : null);
    setStand("gespeichert");
    protokoll("vorschau", "Vorschau wird neu geladen", {
      abschnitte: verschmolzen.length,
    });
    setNeuLaden((n) => n + 1);
    // Ab hier kommt das EIGENE Schreiben als Realtime-Ereignis zurück. Es
    // darf nicht als fremde Änderung gelten — sonst meldete der Editor nach
    // jedem Tastendruck „jemand anderes hat diese Seite geändert".
    eigenesEchoMerken();

    if (nachholen.current) {
      nachholen.current = false;
      // Kurz warten, damit React den neuen Stand übernommen hat, bevor der
      // nächste Lauf `zeilenRef` liest.
      setTimeout(() => void schreibeRef.current?.(), 0);
    }
  }, [aktiv, page.id]);

  // Selbstbezug über eine Ref, weil `schreibe` sich beim Nachholen selbst
  // aufruft und eine direkte Rekursion die useCallback-Kette bräche.
  const schreibeRef = useRef(schreibe);
  schreibeRef.current = schreibe;

  useEffect(() => {
    if (JSON.stringify(zeilen) === bestaetigt) return;
    const timer = setTimeout(() => void schreibe(), ENTPRELLUNG_MS);
    return () => clearTimeout(timer);
  }, [zeilen, bestaetigt, schreibe]);

  useEffect(() => {
    if (stand !== "gespeichert") return;
    const timer = setTimeout(() => setStand("ruht"), QUITTUNG_MS);
    return () => clearTimeout(timer);
  }, [stand]);

  /** Gibt es ungespeicherte Arbeit? */
  const offen = JSON.stringify(zeilen) !== bestaetigt;

  // Rückgängig/Wiederholen über die Abschnittsliste. Der Verlauf beobachtet
  // `zeilen` selbst und schreibt mit; hier wird nur GESETZT, was er zurückgibt.
  //
  // Er hängt an den Zeilen und nicht am Formularfeld: rückgängig zu machen ist
  // „der Abschnitt ist wieder da", „die Reihenfolge ist wieder so" — und beides
  // steht in dieser Liste. Ein Verlauf je Eingabefeld wäre ein zweiter, der dem
  // ersten widerspricht.
  //
  // `vergleiche` blendet die `id` aus: sie ist die Quittung des Servers, keine
  // Nutzeränderung. Ohne das war ein neuer Abschnitt zwei Stände (ohne/mit ID),
  // ↺ schickte den ohne ID an den Server (Identitätswechsel der DB-Zeile), und
  // ↻ blieb tot — die Wurzel von A1, im Kopf von `use-verlauf.ts` ausgeführt.
  //
  // `uebernehme` holt die IDs beim Zurückspielen aus dem HEUTIGEN Stand, über
  // den `key`. Der Key ist dafür der richtige Schlüssel und nicht die Position:
  // er ist über Einfügen, Löschen und Verschieben stabil, die Position nicht.
  //
  // Ein Abschnitt, den es heute nicht mehr gibt (gelöscht, jetzt per ↺ zurück),
  // hat keine heutige ID — er behält die aus dem gemerkten Stand. `bloecke.py`
  // belebt genau diese wieder, samt ihrer alten ID, damit der Verlauf und alles,
  // was auf sie zeigt, stabil bleiben.
  const verlauf = useVerlauf(zeilen, {
    vergleiche: (zs) =>
      zs.map(({ key, typ, content, settings }) => ({
        key,
        typ,
        content,
        settings,
      })),
    uebernehme: (gemerkt, aktuell) => {
      const idsHeute = new Map(aktuell.map((z) => [z.key, z.id]));
      return gemerkt.map((z) => ({ ...z, id: idsHeute.get(z.key) ?? z.id }));
    },
  });
  const springe = useCallback(
    (wohin: "zurueck" | "vor") => {
      const stand = wohin === "zurueck" ? verlauf.zurueck() : verlauf.vor();
      if (!stand) return;
      setZeilen(stand);
      // Die Auswahl kann auf einen Abschnitt zeigen, den es im
      // wiederhergestellten Stand nicht mehr gibt. Sie dann stehen zu lassen
      // hieße: der Inspektor rechts zeigt einen Baustein, der auf der Fläche
      // nicht existiert.
      setAktiv((a) => (stand.some((z) => z.key === a) ? a : null));
    },
    [verlauf],
  );

  /** Die Inhaltssprache umschalten — von WO AUCH IMMER.
   *
   *  Es gibt zwei Umschalter (Kopfzeile und Inspektor) und sie müssen dasselbe
   *  tun, sonst zeigt die Vorschau eine andere Fassung als das Formular sie
   *  bearbeitet. Genau das war Prüfbericht A2: der Inspektor führte seine
   *  Sprache selbst und blieb beim Wechsel in der Kopfzeile stehen. */
  const spracheWechseln = useCallback(
    (l: Locale) => {
      // Ungespeichertes zuerst wegschreiben: der Wechsel lädt die Vorschau
      // neu, und was im Inspektor der ALTEN Fassung stand, wäre sonst weg.
      if (offen) void schreibeRef.current?.();
      setInhaltsSprache(l);
      // UND die Oberfläche mitschalten — eine Wahl, nicht zwei.
      void setLocale(l).then(() => router.refresh());
    },
    [offen, router],
  );

  // --- Fremde Änderungen (Realtime) ---------------------------------------
  //
  // Die drei speisenden Tabellen dieser Ansicht. Welche der Baukasten überhaupt
  // abonnieren darf und warum die übrigen nicht, steht an EINER Stelle:
  // `baukasten-realtime.ts`.
  const { fremdeAenderung, uebernehmen } = useBaukastenRealtime({
    tabellen: ["site_blocks", "site_pages", "tenant_site_config"],
    offen,
    // Die Vorschau zeigt den SERVERSTAND. Sie darf ihm auch dann folgen, wenn
    // hier etwas Ungespeichertes offen ist — sie überschreibt nichts.
    onFremd: () => setNeuLaden((n) => n + 1),
  });

  // Nach `router.refresh()` kommen neue `initialBlocks` herein. Übernommen
  // werden sie nur, wenn nichts Ungespeichertes offen ist — sonst verschwände
  // die Eingabe unter der Hand.
  const ersteBloecke = useRef(initialBlocks);
  // `offen` gehört NICHT in die Abhängigkeiten: der Effekt soll auf neue
  // Serverdaten reagieren, nicht darauf, dass jemand gerade zu tippen aufhört.
  // Deshalb über eine Ref gelesen.
  const offenRef = useRef(offen);
  offenRef.current = offen;
  useEffect(() => {
    if (initialBlocks === ersteBloecke.current) return;
    ersteBloecke.current = initialBlocks;
    if (offenRef.current) return;
    const neu = zuZeilen(initialBlocks);
    setZeilen(neu);
    setBestaetigt(JSON.stringify(neu));
  }, [initialBlocks]);

  // Warnen, bevor die Seite verlassen wird. Der Entprellungs-Timer läuft 900 ms
  // — wer direkt nach der letzten Eingabe wegklickt, verliert sie sonst
  // lautlos. Es gab dafür bisher keinen Schutz.
  useEffect(() => {
    if (!offen) return;
    function aufVerlassen(e: BeforeUnloadEvent) {
      // Den Speichervorgang noch anstoßen — vielleicht schafft er es.
      void schreibeRef.current?.();
      // Der Text ist frei erfunden und wird von keinem modernen Browser
      // angezeigt; entscheidend ist preventDefault (so ist die Schnittstelle).
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", aufVerlassen);
    return () => window.removeEventListener("beforeunload", aufVerlassen);
  }, [offen]);

  // --- Meldungen der Vorschau ---------------------------------------------
  //
  // Origin- und Quellenprüfung liegen im Hook (`useCanvasBruecke`): sie sind
  // für jeden Reiter dieselben, und eine zweite Kopie davon wäre die Stelle,
  // an der die Prüfung beim nächsten Umbau vergessen wird (Wurzel 3).
  // Die gemeldete Zeile — über die DB-ID, nicht über den Index.
  //
  // Der Renderer zählt `data-block-index` über den GANZEN Baum (Abschnitt ·
  // Spalte · Baustein), der Editor kennt über `list_blocks` aber nur die
  // Bausteine. Bei sechs Bausteinen meldet der Renderer 0,1,2 / 3,4,5 / … und
  // `zeilen[3]` ist dann ein ganz anderer Abschnitt als der angeklickte —
  // live gesehen am 26.08.2026: Klick auf „Bild" markierte „Kontakt".
  //
  // Der Index bleibt als NOTWEG: ein Baustein, der noch nie gespeichert wurde,
  // hat keine ID. Für ihn stimmt die Zählung, weil er als einziger neu ist.
  const zeileAusMeldung = useCallback((data: CanvasMeldung) => {
    if (data.id) {
      const ueberId = zeilenRef.current.find((r) => r.id === data.id);
      if (ueberId) return ueberId;
    }
    return typeof data.index === "number"
      ? zeilenRef.current[data.index]
      : undefined;
  }, []);

  const aufNachricht = useCallback(
    (data: CanvasMeldung) => {
      // Neue Geometrie. Sie kommt bei jedem Scrollen und jeder Größenänderung
      // im iframe — deshalb NUR den Zustand ersetzen und sonst nichts tun.
      if (data.type === "rects" && Array.isArray(data.rechtecke)) {
        const karte = new Map<number, Rechteck>();
        for (const r of data.rechtecke) karte.set(r.index, r);
        setRechtecke(karte);
        // NUR beim Scrollen das offene Kontextmenü schließen: dabei wandert der
        // Abschnitt darunter weg, und ein Menü, das an seiner
        // Bildschirmposition stehen bleibt, zeigt danach auf einen anderen.
        //
        // Bei einer reinen Layout-Meldung (nachgeladenes Bild, ersetzte
        // Schrift) bleibt er stehen. Dort zuzuklappen sähe aus wie ein
        // Fehlklick — und genau solche Meldungen kommen in den ersten Sekunden
        // nach dem Laden mehrfach, also ausgerechnet dann, wenn jemand den
        // ersten Rechtsklick versucht.
        if (data.grund === "scroll") setMenu((m) => (m ? null : m));
        return;
      }

      if (data.type === "zeiger") {
        setZeiger(
          typeof data.x === "number" && typeof data.y === "number"
            ? { x: data.x, y: data.y }
            : null,
        );
        return;
      }

      if (data.type === "hover") {
        setUeberfahren(typeof data.index === "number" ? data.index : null);
        return;
      }

      if (
        data.type === "contextmenu" &&
        typeof data.x === "number" &&
        typeof data.y === "number"
      ) {
        const zeile = zeileAusMeldung(data);
        if (!zeile) {
          // Rechtsklick auf einen CONTAINER: er wird ausgewählt, das Menü
          // bleibt aus. Seine Handgriffe (Rang, duplizieren, löschen) stehen
          // im Inspektor — ein zweites Menü mit denselben vier Einträgen wäre
          // eine zweite Wahrheit über dieselben Aktionen.
          if (data.containerId) {
            setContainerId(data.containerId);
            setAktiv(null);
            setMenu(null);
          }
          return;
        }
        setAktiv(zeile.key);
        setContainerId(null);
        // Die Koordinaten kommen aus dem SICHTFENSTER DES IFRAMES. Das
        // Kontextmenü hängt aber am Dashboard-Fenster — ohne den Versatz des
        // iframe-Elements stünde es um dessen linke obere Ecke daneben, und bei
        // schmaler Mobilansicht wären das mehrere hundert Pixel.
        const kasten = iframeRef.current?.getBoundingClientRect();
        setMenu({
          x: data.x + (kasten?.left ?? 0),
          y: data.y + (kasten?.top ?? 0),
          key: zeile.key,
        });
        return;
      }

      if (data.type === "select") {
        const zeile = zeileAusMeldung(data);
        if (zeile) {
          // Ein Baustein gewinnt: er ist das Innerste unter dem Zeiger, und
          // wer auf einen Text klickt, meint den Text — nicht die Spalte
          // darum. Der Container bleibt über den Krümelweg im Inspektor
          // erreichbar.
          setAktiv(zeile.key);
          setContainerId(null);
        } else if (data.containerId) {
          // Kein Baustein, aber ein Container: der leere Abschnitt, die leere
          // Spalte. Das war vorher ein Klick ins Nichts.
          setContainerId(data.containerId);
          setAktiv(null);
          setPanelModus("inhalt");
        }
        setMenu(null);
        return;
      }

      // Text in der Vorschau geändert → in den Stand des betroffenen
      // Abschnitts schreiben. Das Autospeichern greift dann wie bei einer
      // Eingabe im Formular.
      if (
        data.type === "text" &&
        typeof data.index === "number" &&
        typeof data.feld === "string" &&
        typeof data.wert === "string"
      ) {
        const zeile = zeileAusMeldung(data);
        if (!zeile) return;
        // Nur Felder, die der Katalog für diesen Abschnitt kennt. Sonst könnte
        // eine manipulierte Nachricht beliebige Schlüssel in den Inhalt
        // schreiben, die das Backend anschließend als 422 abweist.
        const meta = abschnittFuer(zeile.typ);
        if (!meta?.felder.some((f) => f.key === data.feld)) return;
        setZeilen((z) =>
          z.map((r) => {
            if (r.key !== zeile.key) return r;
            const karte = { ...(alsKarte(r.content[data.feld!]) as Record<string, string>) };
            // Leerer Text entfernt den Eintrag statt einen Leerstring zu
            // speichern — sonst zeigt der Renderer eine leere Überschrift
            // statt gar keine.
            if (data.wert) karte[locale] = data.wert!;
            else delete karte[locale];
            return { ...r, content: { ...r.content, [data.feld!]: karte } };
          }),
        );
      }
    },
    [locale, zeileAusMeldung],
  );

  const { iframeBereit, scrolleZu } = useCanvasBruecke(iframeRef, aufNachricht);

  // Wird ein Abschnitt AUSSERHALB der Vorschau gewählt (Ebenen-Baum,
  // Abschnittsliste), soll die Vorschau ihn zeigen. Vorher markierte sie ihn
  // korrekt und blieb stehen — der markierte Abschnitt war nicht im Bild
  // (Prüfbericht D4).
  //
  // Ein Effekt auf `aktiv` und kein Aufruf an jeder Auswahl-Stelle: es gibt
  // sechs davon, und die siebte hätte es vergessen. Der Renderer springt
  // ohnehin nur, wenn der Abschnitt nicht schon sichtbar ist (`nearest`).
  useEffect(() => {
    if (!aktiv) return;
    const zeile = zeilenRef.current.find((z) => z.key === aktiv);
    scrolleZu(zeile?.id ?? null);
  }, [aktiv, scrolleZu]);


  // --- Bearbeiten ---------------------------------------------------------
  /** Einen Abschnitt anlegen.
   *
   *  `inhalt` ist der Startinhalt. Er wird gebraucht, wenn der Abschnitt aus
   *  einer Auswahl entsteht, die schon etwas mitbringt — ein Bild aus dem
   *  Medien-Panel etwa. Ohne ihn müsste der Kunde das Bild danach ein zweites
   *  Mal wählen. */
  function hinzufuegen(
    typ: BlockType,
    inhalt: Record<string, unknown> = {},
    /** In welche SPALTE der Baustein gehört (0472). Ohne Angabe bekommt er
     *  seine eigene Hülle — der Normalfall. Gesetzt heißt: der Kunde hat ihn
     *  in eine bestehende Spalte gezogen. */
    parentId: string | null = null,
    /** Die Einfügestelle, wenn der Aufrufer sie GERADE ermittelt hat (Abwurf
     *  des blauen Balkens). Sie MUSS als Parameter kommen und nicht über
     *  `setEinfuegenVor` + State: beides passiert im selben Ereignis, und
     *  dieser Aufruf liest den State des laufenden Renders — also den ALTEN
     *  Wert. Genau daran landete jeder gezogene Abschnitt unten
     *  (`stelle === null` heißt „ans Ende"), obwohl der Balken richtig stand.
     *
     *  `undefined` = keine Angabe, dann gilt die gemerkte Stelle aus der Naht. */
    stelleDirekt?: number,
  ) {
    if (zeilen.length >= MAX_ABSCHNITTE) {
      toast.error(t("editor.maxAbschnitte", { max: MAX_ABSCHNITTE }));
      return;
    }
    const key = neuerKey();
    const stelle = stelleDirekt !== undefined ? stelleDirekt : einfuegenVor;
    setZeilen((z) => {
      const eintrag: Zeile = {
        key,
        id: null,
        typ,
        content: inhalt,
        settings: {},
        parentId,
      };
      // `null` heißt ans Ende. Ein Index heißt GENAU dort — das `+` an einer
      // Karte fügt darunter ein, nicht unten an die Seite.
      if (stelle == null) return [...z, eintrag];
      const kopie = [...z];
      kopie.splice(Math.min(Math.max(stelle, 0), kopie.length), 0, eintrag);
      return kopie;
    });
    setAktiv(key);
    setPanelModus("inhalt");
    setEinfuegenVor(null);
    // Für die Sicht „Zuletzt" im Katalog.
    merken(typ);
  }

  /** Ein LAYOUT an einer Stelle einsetzen — Abschnitt mit n Spalten (0472).
   *
   *  Warum das nicht über `zeilen` läuft: der Editor führt eine flache Liste
   *  von BAUSTEINEN. Container (Abschnitt, Spalte) stehen nicht darin, und
   *  `replace_blocks` filtert sie bewusst heraus, damit ein Speichervorgang
   *  sie nicht als „weggefallen" löscht. Ein Layout ist also eine Änderung an
   *  der Struktur, nicht am Inhalt — sie geht direkt an die DB und kommt über
   *  `router.refresh()` als neuer Serverstand zurück.
   *
   *  Der offene Stand wird VORHER weggeschrieben. Ohne das liefe der
   *  Entprellungs-Timer noch, während der Server schon eine neue Struktur
   *  liefert — und der nächste Speichervorgang schickte eine Liste, die den
   *  frischen Abschnitt nicht kennt.
   *
   *  Die Spalten entstehen NACHEINANDER und nicht parallel: ihre Reihenfolge
   *  ist `position`, und die vergibt der Server aus dem Bestand („ans Ende der
   *  Geschwister"). Parallel geschickt wäre die Reihenfolge dem Zufall
   *  überlassen — bei „ein Drittel · zwei Drittel" wäre das sichtbar falsch.
   */
  async function layoutEinfuegen(bs: LayoutBaustein, position: number) {
    if (legtLayoutAn) return;
    // Dieselbe Obergrenze wie beim Baustein (`hinzufuegen`). Sie fehlte hier,
    // und damit gab es einen Weg, an ihr vorbeizubauen: 60 Bausteine sind
    // gedeckelt, 60 Layout-Abschnitte waren es nicht (Wurzel 8).
    if (zeilen.length >= MAX_ABSCHNITTE) {
      toast.error(t("editor.maxAbschnitte", { max: MAX_ABSCHNITTE }));
      return;
    }
    setLegtLayoutAn(true);
    try {
      if (offen) await schreibeRef.current?.();

      // Die STELLE, an der geklickt wurde. Sie war vorher durch das ganze
      // Overlay gereicht und hier per `void position` weggeworfen — der
      // Abschnitt landete immer unten, und die geklickte Naht war wirkungslos.
      //
      // Umgerechnet auf den Rang der ABSCHNITTE: `position` zählt in der
      // Baustein-Liste des Editors, der Server ordnet aber unter den
      // Abschnitten. Jeder Baustein sitzt in genau einem Abschnitt (0472,
      // `_huelle_fuer_widget`), also ist der Baustein-Index gleich dem
      // Abschnitts-Index — solange keine mehrspaltigen Abschnitte im Spiel
      // sind. Sind sie es, ist der Wert eine Näherung nach oben; der Server
      // klemmt ihn auf das mögliche Ende.
      const abschnitt = await addContainer(page.id, "section", { position });
      if (!abschnitt.ok) {
        toast.error(abschnitt.error);
        return;
      }
      for (let i = 0; i < bs.spalten; i++) {
        const spalte = await addContainer(page.id, "column", {
          parentId: abschnitt.data.id,
          span: bs.breiten?.[i] ?? null,
        });
        if (!spalte.ok) {
          // Die halbe Struktur stehen zu lassen wäre schlechter als keine:
          // ein Abschnitt mit einer Spalte, wo zwei bestellt waren, sieht aus
          // wie ein Fehler im Layout und nicht wie ein abgebrochener Vorgang.
          // Der Abschnitt fällt, `on delete cascade` nimmt die Spalten mit.
          await removeBlock(abschnitt.data.id).catch(() => null);
          toast.error(spalte.error);
          return;
        }
      }
      // Der Server hat die neue Struktur; der Editor liest sie über die
      // Server-Komponente neu ein.
      router.refresh();
      setNeuLaden((n) => n + 1);
      // Die Stelle war die Naht, an der geklickt wurde — sie ist verbraucht.
      setEinfuegenVor(null);
    } catch {
      toast.error(t("seiten.fehlgeschlagen"));
    } finally {
      setLegtLayoutAn(false);
    }
  }

  /** Die Geräte setzen, auf denen ein Abschnitt beim Gast fehlt (0449). */
  function aendereVersteckt(key: string, geraete: Geraet[]) {
    setZeilen((z) =>
      z.map((r) =>
        r.key === key ? { ...r, settings: mitVersteckt(r.settings, geraete) } : r,
      ),
    );
  }

  function aendere(key: string, content: Record<string, unknown>) {
    setZeilen((z) => z.map((r) => (r.key === key ? { ...r, content } : r)));
  }

  /** Die Darstellungs-Einstellungen eines Abschnitts (0432).
   *
   *  Sie wurden bisher NUR durchgereicht: `background_color`, `padding` und die
   *  Stil-Werte standen im Backend-Schema (`BlockSettings`) und in der
   *  Datenbank, aber es gab keine Oberfläche, sie zu setzen. Damit waren sie
   *  eine Attrappe — der Renderer liest sie, niemand konnte sie füllen. */
  function aendereSettings(key: string, settings: Record<string, unknown>) {
    setZeilen((z) => z.map((r) => (r.key === key ? { ...r, settings } : r)));
  }

  function entferne(key: string) {
    setZeilen((z) => {
      const weg = z.find((r) => r.key === key);
      protokoll("klick", "Abschnitt entfernen", {
        key,
        typ: weg?.typ,
        // Die DB-ID ist der entscheidende Wert: OHNE sie war der Abschnitt nie
        // gespeichert, das Entfernen ist dann rein lokal und es geht kein
        // Request hinaus. Mit ihr muss `replace_blocks` ihn in `entfallen`
        // haben — sonst bleibt er in der DB stehen.
        id: weg?.id ?? null,
        vorher: z.length,
        nachher: z.length - (weg ? 1 : 0),
        gefunden: Boolean(weg),
      });
      return z.filter((r) => r.key !== key);
    });
    setAktiv((a) => (a === key ? null : a));
  }

  function verschiebe(key: string, richtung: -1 | 1) {
    setZeilen((z) => {
      const i = z.findIndex((r) => r.key === key);
      const j = i + richtung;
      if (i < 0 || j < 0 || j >= z.length) return z;
      const kopie = [...z];
      [kopie[i], kopie[j]] = [kopie[j]!, kopie[i]!];
      return kopie;
    });
  }

  function dupliziere(key: string) {
    if (zeilen.length >= MAX_ABSCHNITTE) {
      toast.error(t("editor.maxAbschnitte", { max: MAX_ABSCHNITTE }));
      return;
    }
    setZeilen((z) => {
      const i = z.findIndex((r) => r.key === key);
      if (i < 0) return z;
      const quelle = z[i]!;
      const kopie = [...z];
      kopie.splice(i + 1, 0, {
        key: neuerKey(),
        // Bewusst OHNE id: die Kopie ist ein neuer Abschnitt. Mit derselben id
        // wäre es zweimal dieselbe Zeile — das Backend weist das ab.
        id: null,
        typ: quelle.typ,
        content: structuredClone(quelle.content),
        settings: structuredClone(quelle.settings),
        // Die Kopie bleibt in DERSELBEN Spalte. Ohne diese Zeile bekam sie
        // ihre eigene Hülle über die ganze Breite: aus „zwei Dinge
        // nebeneinander, davon eins doppelt" wurde eine dritte Reihe darunter,
        // und das Layout, das man gerade gebaut hatte, war zerlegt.
        parentId: quelle.parentId,
      });
      return kopie;
    });
  }

  useEffect(() => {
    if (!vorlageAnsehen) {
      setVorlageToken(null);
      return;
    }
    let lebt = true;
    // Nicht über `useVorschauToken`: dieser Zweig ENDET die Vorschau statt
    // eine Fehlerfläche zu zeigen — es gibt hier eine eigene Seite, auf die
    // zurückgefallen werden kann.
    createTemplatePreviewToken(vorlageAnsehen)
      .then((res) => {
        if (!lebt) return;
        if (res.ok) setVorlageToken(res.data.token);
        // Kein Token: die Vorschau bleibt bei der eigenen Seite, und der Grund
        // steht als Meldung da. Eine leere Fläche wäre die schlechtere Auskunft.
        else {
          toast.error(res.error);
          setVorlageAnsehen(null);
        }
      })
      .catch(() => {
        // Wirft die Server-Action, blieb `vorlageAnsehen` gesetzt OHNE Token:
        // die Vorschau stand dauerhaft leer, ohne Meldung (Wurzel 5).
        if (!lebt) return;
        toast.error(t("seiten.fehlgeschlagen"));
        setVorlageAnsehen(null);
      });
    return () => {
      lebt = false;
    };
    // `t` ist bei next-intl über die Lebenszeit der Sprache stabil; es steht
    // hier nur, weil die Hook-Regel es verlangt.
  }, [vorlageAnsehen, t]);

  const aktiveZeile = zeilen.find((r) => r.key === aktiv) ?? null;

  // ---------------------------------------------------------------- PANEL
  //
  // Das Panel zeigt den AKTIVEN BEREICH — und nur ihn. Der gewählte Baustein
  // steht NICHT mehr darin, sondern rechts im Inspektor (`docs/UI`, Foto
  // 19.04.54). Das ist der eigentliche Umbau: vorher ersetzte der Inspektor
  // die Liste, aus der man ihn geöffnet hatte. Man verlor beim Bearbeiten also
  // genau die Übersicht, in der man weiterarbeiten wollte, und musste für
  // jeden zweiten Baustein zurück und wieder hinein.
  const seitenleiste =
    panel === "design" ? (
      // Dasselbe Bauteil wie im Design-Reiter — Zustand und Autospeichern
      // liegen darin, nicht hier. Zwei Fassungen wären zwei Wahrheiten über
      // dieselbe Site-Konfiguration.
      <DesignPanel
        branding={branding}
        imPanel
        unterseite={designUnterpunkt}
        onUnterseite={setDesignUnterpunkt}
        onGespeichert={() => setNeuLaden((n) => n + 1)}
      />
    ) : panel === "vorlagen" ? (
      <VorlagenPanel
        onAnsehen={setVorlageAnsehen}
        templates={templates}
        kategorien={templateKategorien}
        seitenVorlagen={seitenVorlagen}
        onFertig={() => {
          panelSetzen(null);
          router.refresh();
          setNeuLaden((n) => n + 1);
        }}
      />
    ) : panel === "seiten" ? (
      // Die Seitenliste als Panel. Der Wechsel auf eine ANDERE Seite ist die
      // einzige Stelle, an der hier noch navigiert wird — und das ist
      // unvermeidbar: eine andere Seite hat andere Abschnitte, die der Server
      // liefern muss. Ein Klick statt fünf.
      <SeitenLeiste pages={pages} />
    ) : panel === "ebenen" ? (
      // Ein BEITRAG hat keinen Baum: sein Inhalt sind Felder, keine Bloecke.
      // Ohne diese Abzweigung stand hier eine leere Ebenenliste, waehrend die
      // Vorschau daneben Titelbild, Einleitung, Galerien und Text zeichnete
      // (gemeldet am 28.08.2026: „auch in layer nicht").
      istBeitrag && baumBlocks.length === 0 ? (
        <BeitragsTeile
          page={page}
          eigeneFelder={blogEigeneFelder}
          onOeffnen={beitragOeffnen}
        />
      ) : (
      // Die Ebenen zeigen den ECHTEN Baum — Abschnitt, Spalte, innere Spalte,
      // Baustein. Sie brauchen dafür eine EIGENE Blockliste (`baumBlocks`).
      //
      // Vorher standen hier `initialBlocks`, und der Baum blieb flach: der
      // Listen-Endpunkt filtert die Container heraus (die Abschnittsliste hat
      // für sie kein Formular), also fand `baumBauen` zu keinem Baustein den
      // Elternteil und hängte alles als Wurzel an. Live nachgezählt: 6
      // Abschnitte und 6 Spalten in der DB, 6 wurzellose Zeilen in der
      // Anzeige — die Ebenen sahen aus wie die Abschnittsliste daneben.
      <EbenenListe
        blocks={baumBlocks}
        aktiv={aktiveZeile?.id ?? null}
        geraet={geraet}
        onWaehle={(id) => {
          const zeile = zeilen.find((z) => z.id === id);
          if (!zeile) return;
          setAktiv(zeile.key);
          setContainerId(null);
          setPanelModus("inhalt");
        }}
        // Container haben seit 0479 ihren eigenen Inspektor (Breite, Spalten,
        // Rang, Hintergrund). Vorher war ein Klick auf einen Abschnitt oder
        // eine Spalte hier eine Sackgasse: „es gibt nichts zu bearbeiten".
        onWaehleContainer={(id) => {
          setContainerId(id);
          setAktiv(null);
          setPanelModus("inhalt");
        }}
        onContainerAktion={(id, aktion) => {
          void containerAktion(id, aktion);
        }}
        onZiehen={(zug) => void ebenenZiehen(zug)}
        onUmbenennen={(id, name) => void containerUmbenennen(id, name)}
        onVersteckt={(id, g) => {
          const zeile = zeilen.find((z) => z.id === id);
          if (zeile) aendereVersteckt(zeile.key, g);
        }}
        // Die Handgriffe der Ebenen-Zeile laufen in DIESELBEN Funktionen wie
        // die der Abschnittsliste. Ein zweiter Schreibweg auf dieselben Zeilen
        // wäre die Doppelung, gegen die Wurzel 2 steht — und er würde beim
        // nächsten Feld an einer der beiden Stellen vergessen.
        onAktion={(id, aktion) => {
          const zeile = zeilen.find((z) => z.id === id);
          if (!zeile) return;
          if (aktion === "hoch") verschiebe(zeile.key, -1);
          else if (aktion === "runter") verschiebe(zeile.key, 1);
          else if (aktion === "duplizieren") dupliziere(zeile.key);
          else if (aktion === "verstecken") {
            // Auf ALLEN Geräten aus- bzw. wieder einblenden. Dasselbe Feld,
            // das das Auge in der Zeile geräteweise schaltet.
            aendereVersteckt(
              zeile.key,
              versteckteGeraete(zeile.settings).length > 0
                ? []
                : ["desktop", "tablet", "mobil"],
            );
          } else if (aktion === "sperren") {
            aendereSettings(zeile.key, {
              ...zeile.settings,
              locked: zeile.settings?.locked !== true,
            });
          } else if (aktion === "umbenennen") {
            // Bausteine heißen nach ihrem Typ — hier gibt es nichts zu tun.
            // Die Liste bietet den Eintrag an ihnen gar nicht erst an.
          } else entferne(zeile.key);
        }}
        onSiteLayout={() => panelSetzen("design")}
      />
      )
    ) : panel === "hinzufuegen" ? (
      <HinzufuegenPanel
        kategorie={kategorie}
        zuletzt={zuletzt}
        onZiehen={setZieht}
        onWaehlen={(typ) => {
          // Ans ENDE anfügen, wenn nichts anderes gewählt ist — dieselbe Regel
          // wie beim Knopf unter der Liste.
          hinzufuegen(typ);
        }}
        onLayout={(bs) => {
          void layoutEinfuegen(bs, einfuegenVor ?? zeilen.length);
        }}
        medien={
          <MedienPanel
            onBild={(url) => hinzufuegen("image", { url })}
            onZiehen={(url) => {
              setZieht(url ? "image" : null);
              setZiehtBild(url);
            }}
          />
        }
      />
    ) : (
      // KEIN eigener `LeisteTitel` hier. Den Namen des Bereichs setzt die
      // Schale über `panelTitel` — so wie bei jedem anderen Panel auch.
      // Solange der Titel oben auf „Ebenen" zurückfiel, brauchte die Liste
      // eine zweite Überschrift, um überhaupt benannt zu sein; jetzt stünde
      // „Abschnitte" zweimal untereinander.
      <div className="flex flex-col pb-8">
        {istBeitrag && zeilen.length === 0 ? (
          // Ein BEITRAG hat keine Abschnitte — er hat Felder. „Noch keine
          // Abschnitte" war hier keine Auskunft, sondern eine Sackgasse.
          <BeitragsTeile
            page={page}
            eigeneFelder={blogEigeneFelder}
            onOeffnen={beitragOeffnen}
          />
        ) : zeilen.length === 0 ? (
          <p className="px-4 pb-2 text-xs text-muted-foreground">
            {t("editor.nochKeineAbschnitte")}
          </p>
        ) : (
          <ul>
            {zeilen.map((r, i) => {
              const meta = abschnittFuer(r.typ);
              return (
                <li key={r.key}>
                  <div
                    className={
                      "group flex items-center gap-1.5 px-4 py-1.5 transition " +
                      (r.key === aktiv
                        ? "bg-secondary"
                        : "hover:bg-secondary/60")
                    }
                  >
                    <Icon
                      icon={meta?.icon ?? "ph:question"}
                      className="size-4 shrink-0 text-muted-foreground"
                    />
                    <button
                      type="button"
                      onClick={() => setAktiv(r.key)}
                      className="min-w-0 flex-1 truncate text-left text-sm"
                    >
                      {meta
                        ? t(`abschnitte.${meta.label}`)
                        : t("editor.unbekannterAbschnitt")}
                    </button>
                    <div className="flex shrink-0 items-center opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                      <IconKnopf
                        icon="ph:caret-up"
                        label={t("editor.nachOben")}
                        disabled={i === 0}
                        onClick={() => verschiebe(r.key, -1)}
                      />
                      <IconKnopf
                        icon="ph:caret-down"
                        label={t("editor.nachUnten")}
                        disabled={i === zeilen.length - 1}
                        onClick={() => verschiebe(r.key, 1)}
                      />
                      <IconKnopf
                        icon="ph:copy"
                        label={t("editor.duplizieren")}
                        onClick={() => dupliziere(r.key)}
                      />
                      <IconKnopf
                        icon="ph:trash"
                        label={t("editor.entfernen")}
                        gefahr
                        onClick={() => entferne(r.key)}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="px-4 pt-3">
          <button
            type="button"
            disabled={zeilen.length >= MAX_ABSCHNITTE}
            onClick={() => {
              // Die gemerkte Naht-Stelle ZURÜCKSETZEN. Dieser Knopf heißt
              // „hinzufügen" und meint ans Ende; ohne die Zeile klebte eine
              // Stelle aus einem früheren Naht-Klick daran, und der Baustein
              // landete mitten in der Seite (Wurzel 1: jede Aktion hat einen
              // Gegenzustand).
              setEinfuegenVor(null);
              panelSetzen("hinzufuegen");
            }}
            className="flex w-full items-center justify-center gap-1.5 rounded-(--radius) bg-secondary px-3 py-2 text-sm font-medium transition hover:bg-secondary/70 disabled:opacity-40"
          >
            <Icon icon="ph:plus" className="size-4" />
            {t("editor.hinzufuegen")}
          </button>
          <p className="pt-1.5 text-center text-[0.6875rem] text-muted-foreground">
            {zeilen.length}/{MAX_ABSCHNITTE}
          </p>
        </div>
      </div>
    );

  // ------------------------------------------------------------- INSPEKTOR
  //
  // Rechts, mit Breadcrumb, Titel und Klappkarten — genau wie im Vorbild.
  //
  // Der Breadcrumb zeigt die Verschachtelung: Abschnitt › Spalte › Baustein.
  // Er wird aus dem ECHTEN Baum (`initialBlocks`) gelesen und nicht geraten;
  // findet sich der Baustein dort nicht (ein neu angelegter, der noch keine
  // DB-Zeile hat), bleibt er leer statt eine Kette zu erfinden (Wurzel 4).
  /** Die Kopfangaben dieser Seite in alle geführten Sprachen bringen (0476).
   *
   *  Titel, Meta-Titel, Meta-Beschreibung, Schlagwörter, Anriss und
   *  Bild-Alternativtext. NICHT die Abschnittsinhalte — die sind schon
   *  mehrsprachig und werden im Inspektor je Sprache gepflegt.
   *
   *  Erst speichern, dann übersetzen: der Lauf liest die Seite aus der
   *  Datenbank, und ein ungespeicherter Titel wäre nicht dabei. Genau die Art
   *  Fehler, die aussieht wie „die Übersetzung geht nicht". */
  async function seiteUebersetzen(): Promise<void> {
    if (uebersetztLaeuft) return;
    setUebersetztLaeuft(true);
    try {
      if (offen) await schreibeRef.current?.();
      const res = await kiSeiteUebersetzen({ page_id: page.id });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const d = res.data;
      const fehler = Object.keys(d.fehlgeschlagen);
      // Jede der vier Zahlen ist eine eigene Aussage — „fertig" allein sagt
      // dem Betrieb nicht, ob eine Sprache fehlt und warum.
      if (d.uebersetzt.length > 0) {
        toast.success(
          t("uebersetzung.fertig", { anzahl: d.uebersetzt.length }),
        );
      } else if (fehler.length === 0) {
        toast.success(t("uebersetzung.aktuell"));
      }
      if (d.geschuetzt.length > 0) {
        toast.info(
          t("uebersetzung.geschuetzt", {
            sprachen: d.geschuetzt.map((l) => l.toUpperCase()).join(", "),
          }),
        );
      }
      if (fehler.length > 0) {
        toast.error(
          t("uebersetzung.fehlgeschlagen", {
            sprachen: fehler.map((l) => l.toUpperCase()).join(", "),
          }),
        );
      }
      // Die Vorschau neu laden: sie zeigt jetzt den übersetzten Titel.
      setNeuLaden((n) => n + 1);
      router.refresh();
    } finally {
      setUebersetztLaeuft(false);
    }
  }

  // --- Container-Auswahl (0479) -------------------------------------------
  //
  // Die Container kommen aus `baumBlocks` (der Baum MIT Abschnitten und
  // Spalten) und nicht aus `zeilen`: dort stehen nur Bausteine. Beim
  // Auswählen eines Bausteins bleibt `containerId` leer — der Weg zum
  // Container darüber führt über den Krümelweg im Inspektor.
  const aktiverContainer = useMemo(
    () => baumBlocks.find((b) => b.id === containerId) ?? null,
    [baumBlocks, containerId],
  );

  /** Die Container derselben Ebene, nach Rang — für „hoch/runter". */
  const containerGeschwister = useMemo(() => {
    if (!aktiverContainer) return [];
    return baumBlocks
      .filter(
        (b) =>
          (b.kind ?? "widget") !== "widget" &&
          (b.parent_id ?? null) === (aktiverContainer.parent_id ?? null),
      )
      .sort((a, b) => a.position - b.position);
  }, [baumBlocks, aktiverContainer]);

  /** Die direkten Container-Kinder — bei einem Abschnitt seine Spalten. */
  const containerKinder = useMemo(() => {
    if (!aktiverContainer) return [];
    return baumBlocks
      .filter(
        (b) =>
          b.parent_id === aktiverContainer.id &&
          (b.kind ?? "widget") !== "widget",
      )
      .sort((a, b) => a.position - b.position);
  }, [baumBlocks, aktiverContainer]);

  /** Nach jeder Strukturänderung: der Server ist die Wahrheit über den Baum.
   *
   *  Der offene Stand wird VORHER weggeschrieben — dieselbe Begründung wie bei
   *  `layoutEinfuegen`: sonst schickt der Entprellungs-Timer eine Liste, die
   *  die neue Struktur nicht kennt. */
  const containerGeaendert = useCallback(async () => {
    if (offen) await schreibeRef.current?.();
    router.refresh();
    setNeuLaden((n) => n + 1);
  }, [offen, router]);

  /** Die vier Handgriffe an einem CONTAINER — dieselben wie am Baustein, aber
   *  über die Struktur-Endpunkte statt über die Abschnittsliste.
   *
   *  „hoch/runter" braucht den Rang unter den Geschwistern; er wird HIER aus
   *  dem Baum gelesen und nicht im Aufrufer, damit die Ebenen-Zeile nichts
   *  über Positionen wissen muss. */
  const containerAktion = useCallback(
    async (id: string, aktion: EbenenAktion) => {
      const knoten = baumBlocks.find((b) => b.id === id);
      if (!knoten) return;
      const geschwister = baumBlocks
        .filter(
          (b) =>
            (b.kind ?? "widget") !== "widget" &&
            (b.parent_id ?? null) === (knoten.parent_id ?? null),
        )
        .sort((a, b) => a.position - b.position);
      const rang = geschwister.findIndex((g) => g.id === id);

      // SPERREN und VERSTECKEN sind Einstellungen, keine Strukturänderung —
      // sie laufen über `updateBlock` und nicht über die Struktur-Endpunkte.
      if (aktion === "sperren" || aktion === "verstecken") {
        const vorher = (knoten.settings ?? {}) as Record<string, unknown>;
        const neu =
          aktion === "sperren"
            ? { ...vorher, locked: vorher.locked !== true }
            : {
                ...vorher,
                // Verstecken heißt hier: auf ALLEN Geräten. Das
                // geräteweise Ausblenden bleibt am Auge in der Zeile — es
                // ist die feinere Einstellung, und beide schreiben dasselbe
                // Feld (Wurzel 2).
                hidden_on:
                  (vorher.hidden_on as string[] | undefined)?.length
                    ? []
                    : ["desktop", "tablet", "mobil"],
              };
        setBaumBlocks((alteListe) =>
          alteListe.map((b) => (b.id === id ? { ...b, settings: neu } : b)),
        );
        const antwort = await updateBlock(id, { settings: neu });
        if (!antwort.ok) {
          toast.error(antwort.error);
          setBaumBlocks((alteListe) =>
            alteListe.map((b) => (b.id === id ? { ...b, settings: vorher } : b)),
          );
          return;
        }
        router.refresh();
        return;
      }

      const res =
        aktion === "hoch"
          ? rang > 0
            ? await moveContainer(id, rang - 1)
            : null
          : aktion === "runter"
            ? rang >= 0 && rang < geschwister.length - 1
              ? await moveContainer(id, rang + 1)
              : null
            : aktion === "duplizieren"
              ? await duplicateContainer(id)
              : await removeBlock(id);
      // `null` = am Rand der Liste, es gibt nichts zu tun. Kein Fehler.
      if (res === null) return;
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      // Ein gelöschter Container darf nicht ausgewählt bleiben (Wurzel 1).
      if (aktion === "entfernen" && containerId === id) setContainerId(null);
      // SOFORT sichtbar machen, was die Datenbank schon getan hat. Der
      // Server-Refresh darunter bleibt — er ist die Wahrheit und korrigiert
      // diese Vorschau, falls sie danebenliegt. Ohne ihn stünde die Änderung
      // über eine Sekunde lang nur in der Datenbank und nicht in der Liste.
      if (aktion === "entfernen") {
        setBaumBlocks((alt) => ohneTeilbaum(alt, id));
      } else if (aktion === "hoch" || aktion === "runter") {
        const neuerBaum = mitGetauschtemRang(
          baumBlocks,
          id,
          geschwister[aktion === "hoch" ? rang - 1 : rang + 1].id,
        );
        setBaumBlocks(neuerBaum);
        // UND die Bausteinliste mitziehen (Wurzel 1).
        //
        // Ohne das war jedes Verschieben eines Abschnitts wirkungslos: der
        // Server hatte den neuen Rang, der Editor seine alte Bausteinfolge —
        // und weil `replace_blocks` den Rang eines Abschnitts aus der Position
        // seines ersten Bausteins ableitet, schrieb das nächste Speichern die
        // alte Ordnung zurück. Der Kunde klickte, und nichts bewegte sich.
        setZeilen((alteZeilen) => nachBaumOrdnen(alteZeilen, neuerBaum));
      }
      // Beim Duplizieren gibt es nichts vorwegzunehmen: die neuen Zeilen
      // tragen IDs, die nur der Server kennt. Sie hier zu erfinden wäre ein
      // Bestand, den niemand einlöst (Wurzel 4).
      await containerGeaendert();
    },
    [baumBlocks, containerId, containerGeaendert, router],
  );

  /** Einer Ebene einen eigenen Namen geben (28.08.2026).
   *
   *  Der Name steht in `settings.name` und nicht in einer eigenen Spalte: er
   *  ist eine Anzeige-Eigenschaft wie Abstand und Hintergrund, und der
   *  Schreibweg dafür steht schon (`updateBlock`). Eine neue Spalte hieße eine
   *  Migration für ein Feld, das kein Renderer liest.
   *
   *  Sofort sichtbar, und der Server korrigiert danach — dieselbe Begründung
   *  wie bei den übrigen Container-Handgriffen: der Refresh der Editor-Seite
   *  dauert über eine Sekunde, und bis dahin sähe die Liste aus, als hätte das
   *  Feld nichts getan. */
  const containerUmbenennen = useCallback(
    async (id: string, name: string | null) => {
      const knoten = baumBlocks.find((b) => b.id === id);
      if (!knoten) return;
      const vorher = knoten.settings ?? {};
      // Unverändert heißt: gar nicht erst schreiben. Ein Doppelklick, der die
      // Zeile nur ansieht, soll keine Speicherung auslösen.
      if ((vorher.name ?? null) === name) return;
      const neueSettings = { ...vorher, name };
      setBaumBlocks((alt) =>
        alt.map((b) => (b.id === id ? { ...b, settings: neueSettings } : b)),
      );
      const res = await updateBlock(id, { settings: neueSettings });
      if (!res.ok) {
        toast.error(res.error);
        // Zurück auf den Stand, den der Server hält — sonst zeigte die Liste
        // einen Namen, den niemand gespeichert hat (Wurzel 1).
        setBaumBlocks((alt) =>
          alt.map((b) => (b.id === id ? { ...b, settings: vorher } : b)),
        );
        return;
      }
      router.refresh();
    },
    [baumBlocks, router],
  );

  /** Ein Ziehvorgang aus dem Ebenen-Baum (0479).
   *
   *  Zwei Fälle, zwei Wege — und genau deshalb liegt die Umsetzung hier und
   *  nicht in der Liste:
   *
   *  · BAUSTEIN: er lebt in `zeilen`. Umsortieren heißt, die Liste neu zu
   *    ordnen und die Zielspalte zu übernehmen; gespeichert wird über den
   *    normalen Weg (`speichereAbschnitte`), der beides überträgt.
   *  · CONTAINER: er lebt in der DB. Sein Rang geht über `moveContainer`, und
   *    danach liest der Editor den Baum neu.
   */
  const ebenenZiehen = useCallback(
    async (zug: EbenenZug) => {
      const quelleArt =
        baumBlocks.find((b) => b.id === zug.quelleId)?.kind ?? "widget";

      if (quelleArt !== "widget") {
        // Container: nur der Rang unter den Geschwistern, die Liste erlaubt
        // nichts anderes.
        const geschwister = baumBlocks
          .filter(
            (b) =>
              (b.kind ?? "widget") !== "widget" &&
              (b.parent_id ?? null) ===
                (baumBlocks.find((x) => x.id === zug.quelleId)?.parent_id ??
                  null),
          )
          .sort((a, b) => a.position - b.position);
        const von = geschwister.findIndex((g) => g.id === zug.quelleId);
        let ziel = geschwister.findIndex((g) => g.id === zug.zielId);
        if (von < 0 || ziel < 0) return;
        if (zug.wohin === "nach") ziel += 1;
        // Nach dem Herausnehmen rutscht alles dahinter eine Stelle vor.
        if (von < ziel) ziel -= 1;
        const res = await moveContainer(zug.quelleId, ziel);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        await containerGeaendert();
        return;
      }

      setZeilen((z) => {
        const von = z.findIndex((r) => r.id === zug.quelleId);
        if (von < 0) return z;
        const kopie = [...z];
        const [bewegt] = kopie.splice(von, 1);
        if (!bewegt) return z;

        if (zug.wohin === "hinein") {
          // In eine SPALTE: ans Ende ihres Inhalts, und die Spalte wird die
          // neue Heimat. Ohne die zweite Zeile stünde der Baustein zwar an der
          // richtigen Stelle der Liste, gehörte aber weiter zur alten Spalte —
          // nach dem nächsten Laden wäre er wieder dort (Wurzel 1).
          const letzterDrin = kopie.reduce(
            (merker, r, i) => (r.parentId === zug.zielId ? i : merker),
            -1,
          );
          kopie.splice(letzterDrin + 1, 0, { ...bewegt, parentId: zug.zielId });
          return kopie;
        }

        const zielIndex = kopie.findIndex((r) => r.id === zug.zielId);
        if (zielIndex < 0) return z;
        const zielZeile = kopie[zielIndex]!;
        kopie.splice(zug.wohin === "vor" ? zielIndex : zielIndex + 1, 0, {
          ...bewegt,
          // Neben einem Baustein heißt: in DESSEN Spalte. Sonst stünde er in
          // der Liste daneben und auf der Seite woanders.
          parentId: zielZeile.parentId,
        });
        return kopie;
      });
    },
    [baumBlocks, containerGeaendert],
  );

  const inspektorMeta = aktiveZeile ? abschnittFuer(aktiveZeile.typ) : null;
  const inspektor = aktiverContainer ? (
    <ContainerInspektor
      container={aktiverContainer}
      geschwister={containerGeschwister}
      kinder={containerKinder}
      onGeaendert={() => void containerGeaendert()}
      onWaehleContainer={setContainerId}
    />
  ) : aktiveZeile ? (
    <div className="flex flex-col pb-8">
      <InspektorKopf
        krumen={krumenFuer(initialBlocks, aktiveZeile.id, t)}
        titel={
          inspektorMeta
            ? t(`abschnitte.${inspektorMeta.label}`)
            : t("editor.unbekannterAbschnitt")
        }
        unterzeile={
          inspektorMeta ? t(`editor.gruppe.${inspektorMeta.gruppe}`) : undefined
        }
      />
      {/* INHALT ist offen, DESIGN zugeklappt. Wer einen Baustein anklickt,
          will in neun von zehn Fällen einen Text ändern — und das soll ohne
          einen weiteren Klick gehen. */}
      <InspektorKarte titel={t("arbeitsflaeche.inhalt")} offenAnfangs>
        <AbschnittInspektor
          typ={aktiveZeile.typ}
          content={aktiveZeile.content}
          settings={aktiveZeile.settings}
          onChange={(c) => aendere(aktiveZeile.key, c)}
          onSettings={(st) => aendereSettings(aktiveZeile.key, st)}
          // DIESELBE Sprache wie die Vorschau. Der Inspektor führte sie
          // vorher selbst und lief damit auseinander (Prüfbericht A2).
          inhaltsSprache={locale}
          onInhaltsSprache={(l) => spracheWechseln(l as Locale)}
        />
      </InspektorKarte>
      <InspektorKarte
        titel={t("arbeitsflaeche.design")}
        // Der Punkt sagt, dass hier etwas anderes steht als der Standard —
        // berechnet aus dem, was wirklich in `settings` liegt, nicht gemerkt.
        geaendert={Object.keys(aktiveZeile.settings).length > 0}
        offenAnfangs={panelModus === "design"}
      >
        <AbschnittDesign
          settings={aktiveZeile.settings}
          onSettings={(st) => aendereSettings(aktiveZeile.key, st)}
        />
      </InspektorKarte>
    </div>
  ) : null;

  return (
    <>
      <BaukastenSchale
        // Die Menüspalte wechselt hier nur das PANEL, sie navigiert nicht:
        // ein Bereichswechsel im Editor darf kein Seitenwechsel sein (C4).
        imEditor
        texte={{
          panelEinklappen: t("kopf.panelEinklappen"),
          panelAusklappen: t("kopf.panelAusklappen"),
          panelBreite: t("kopf.panelBreite"),
          panelHilfe: t("kopf.panelHilfe"),
          panelZurueck: t("kopf.panelZurueck"),
        }}
        // Dieselbe Beschriftung wie außerhalb des Editors — aus EINER
        // Stelle (`reiter.ts`). Hier stand die Kette abgeschrieben ein zweites
        // Mal, und der Nachschlag für die Theme-Unterpunkte fehlte darin: die
        // Spalte zeigte im Editor weiterhin „site-layout · farben · text …"
        // (Nachprüfung B1). Zwei Kopien derselben Zuordnung sind zwei
        // Wahrheiten (Wurzel 2).
        menueBeschriften={(id) => menueBeschriftung(t, id)}
        // Die Bereichsleiste bleibt stehen, „Seiten" ist der aktive Bereich.
        // Vorher standen hier die SEITEN als Reiter — das trug drei Stück, aber
        // eine Vorlage bringt acht bis elf mit, und eine waagerechte Leiste
        // schiebt sie dann in den Bildlauf. Der Seitenwechsel läuft jetzt über
        // dasselbe Auswahlfeld wie im Seiten-Reiter (`SeitenWahl` oben).
        reiter={LEISTE_GRUPPEN.flat().map((id) => ({
          id,
          label: t(`reiter.${id}`),
          href: REITER_HREF[id],
          icon: REITER_SYMBOL[id],
        }))}
        // „Mehr" ist der einzige Bereich, der KEIN Panel hat — nur eine
        // Menüspalte mit seinen sechs Unterpunkten. Er kann deshalb nicht in
        // `panel` stehen (dort steht, WAS das Panel zeigt) und braucht sein
        // eigenes Kennzeichen. Ohne diese Trennung war „Mehr" nie aktiv, der
        // Klick fiel auf die Navigation zurück und sprang aus dem Editor nach
        // `/website/objekte` — die anderen fünf Unterpunkte sah man nie.
        aktiverReiter={mehrOffen ? "mehr" : (panel ?? "seiten")}
        // Alle Bereiche der BEARBEITUNGSFLÄCHE wechseln hier nur das Panel.
        //
        // Vorher waren es reine Links: jeder Klick lud die Seite neu, damit den
        // iframe, holte einen neuen Entwurfs-Token und verwarf die Auswahl.
        // Bei Hostaway gibt es EINEN Editor — die Leiste wechselt das Panel,
        // nicht die Seite.
        //
        // Was NICHT abgefangen wird, navigiert weiter: SEO, Regeln, Anfragen,
        // Objekte, Widgets und Einstellungen sind eigene Arbeitsbereiche mit
        // eigenen Daten, keine Panels über derselben Vorschau.
        onReiter={(id) => {
          // „Mehr" klappt nur seine Menüspalte auf und bleibt im Editor. Die
          // sechs Ziele darin sind echte Routen — der Sprung passiert erst,
          // wenn man einen davon wählt, nicht schon beim Öffnen der Liste.
          if (id === "mehr") {
            setMehrOffen((o) => !o);
            return true;
          }
          if (!ALS_PANEL.includes(id as NonNullable<PanelId>)) return false;
          // Ein anderer Bereich schließt „Mehr" — sonst bliebe seine
          // Menüspalte neben einem fremden Panel stehen.
          setMehrOffen(false);
          setAktiv(null);
          panelSetzen(id as PanelId);
          return true;
        }}
        // Erst den offenen Stand wegschreiben, dann wechseln — der Request
        // läuft über die Soft-Navigation hinweg weiter.
        vorNavigation={() => {
          if (offen) void schreibeRef.current?.();
        }}
        // Der Panel-Titel ist der Name des BEREICHS, nicht der der Seite.
        //
        // Vorher stand dort `page.title` — über einem Panel, das je nach
        // Bereich Bausteine, Vorlagen, Seiten, Ebenen oder das Theme zeigte.
        // Die Überschrift beantwortete also nie die Frage, die eine Überschrift
        // beantwortet: was steht hier. Welche Seite offen ist, sagt die
        // Seitenwahl oben — und zwar an genau einer Stelle.
        // `panel === null` ist die Abschnittsliste. Sie hat KEINEN Reiter in der
        // Leiste, weil sie der Normalzustand ist — deshalb stand hier ein
        // Rückfall auf „ebenen", und über der Abschnittsliste prangte
        // „EBENEN". Die Überschrift benannte damit einen Bereich, in dem man
        // gar nicht war (Wurzel 4: kein plausibler Ersatzwert). Sie heißt
        // jetzt nach ihrem Inhalt, mit demselben Schlüssel, den ihr eigener
        // Titel im Panel benutzt.
        //
        // Im Design-Panel benennt der Titel die OFFENE Unterseite — dasselbe
        // Wort, das `/website/design/farben` außerhalb des Editors zeigt.
        // Vorher stand hier auch dann „DESIGN", wenn darunter der
        // Farben-Editor lief (Nachprüfung C4, Nebenbefund).
        panelTitel={
          mehrOffen
            ? t("reiter.mehr")
            : panel === "design" && designUnterpunkt
              ? menueBeschriftung(t, designUnterpunkt)
              : panel
                ? t(`reiter.${panel}`)
                : t("editor.abschnitte")
        }
        // Aus einer Design-Unterseite zurück in die Übersicht — ohne
        // Seitenwechsel, weil sie hier ein Zustand ist und keine Route.
        onPanelZurueck={
          panel === "design" && designUnterpunkt
            ? () => setDesignUnterpunkt(null)
            : undefined
        }
        // Die Menüspalte des Katalogs. Sie steht ZWISCHEN Leiste und Panel und
        // ersetzt die zweite Spalte, die das Panel früher selbst mitbrachte —
        // zwei Spalten mit derselben Aufgabe nebeneinander.
        menueAktiv={
          panel === "hinzufuegen"
            ? kategorie
            : panel === "design"
              ? designUnterpunkt
              : null
        }
        onMenue={(id) => {
          // Im Editor tragen die Einträge kein `href` (siehe `imEditor` in
          // der Schale), also kommen sie ALLE hier an — jeder Bereich nimmt
          // nur seine eigenen.
          //
          // JEDER Bereich mit Menüspalte MUSS hier stehen. `blog` fehlte, und
          // damit war das komplette Blog-CMS unerreichbar: die Einträge
          // „Beiträge" und „Einstellungen" verloren durch `imEditor` ihr
          // `href`, landeten hier, und hier nahm sie niemand an — der Klick
          // fiel stumm ins Nichts. Genau die Klasse Fehler, die `imEditor`
          // vermeiden sollte, nur an einem Bereich, an den ich nicht gedacht
          // habe.
          if (panel === "hinzufuegen") {
            setKategorie(id as KatalogKategorie);
            return;
          }
          if (panel === "design") {
            setDesignUnterpunkt(id as DesignUnterseite);
            return;
          }
          if (panel === "blog") {
            if ((BLOG_PUNKTE as readonly string[]).includes(id)) {
              setBlogPunkt(id as BlogPunkt);
            }
            return;
          }
          // Ein Klick, den kein Bereich annimmt, ist ein Loch in dieser Kette
          // — und zwar ein stummes. Deshalb LAUT im Protokoll, statt es beim
          // nächsten Mal wieder wochenlang niemandem auffallen zu lassen
          // (Wurzel 5).
          protokollFehler("klick", "Menü-Klick ohne Empfänger", {
            panel,
            eintrag: id,
          });
        }}
        // Die Kopfzeile folgt dem Vorbild (docs/UI, Foto Hostaway-Kopfleiste):
        //
        //   Logo │ Seite ⌄ │ Sprache ⌄ │ 🖥 ▭ ▯    …    ↺ ↻ ✓ Vorschau [Publish] ? ⌂
        //
        // Alles Kontextbezogene links gruppiert, alle Aktionen rechts, die Mitte
        // frei. Vorher stand der Geräte-Umschalter MITTIG — er sprang dort nicht
        // (das war der Grund für den Umzug in die Mitte), aber er stand allein
        // in einer Zone, während links viel Platz frei blieb und rechts der
        // Veröffentlichen-Knopf ganz fehlte.
        kopfLinks={
          <>
            {/* Das Logo. Es fehlte hier ganz — im Vorbild ist es der Anker
                links, und es öffnet die SEITENLISTE (das Haus-Symbol rechts tut
                dasselbe, was der Redundanz des Vorbilds entspricht: man greift
                zum einen ODER zum anderen).

                Es ist ein KNOPF und kein Link auf `/website/seiten`. Genau das
                war es zuerst, und es war falsch: der Baukasten ist EIN Bereich,
                und `/website/seiten` ist eine zweite Oberfläche für dieselbe
                Aufgabe, die der Editor als Panel schon enthält
                (`panel === "seiten"`, `SeitenLeiste`). Ein Klick aufs Logo warf
                den Kunden also aus dem Builder heraus, um ihm die Liste zu
                zeigen, die er darin mit einem Klick hätte — samt Verlust des
                Bearbeitungsstands.

                `Logo` und NICHT `/Logo_transparent.png`: das PNG ist die
                ausgemusterte Fassung (1600x1600 mit breitem transparenten
                Rand). Bei fester Höhe schrumpft der Schriftzug darin auf einen
                Bruchteil der Fläche, weil der Rand mitskaliert — es sah nicht
                nur klein aus, es WAR das falsche Bild. Die freigegebene
                Wortmarke ist das exakt beschnittene Figma-Lockup in
                `components/logo.tsx` (245x44), dieselbe, die Sidebar, Login und
                Marketing tragen. */}
            <button
              type="button"
              onClick={() => panelSetzen(panel === "seiten" ? null : "seiten")}
              aria-label={t("kopf.zurUebersicht")}
              title={t("kopf.zurUebersicht")}
              className="shrink-0 transition-opacity hover:opacity-80"
            >
              <Logo heightRem={1.5} />
            </button>
            <span aria-hidden className="h-6 w-px shrink-0 bg-border" />
            <SeitenWahl
              seiten={pages}
              aktiveId={page.id}
              onWahl={(id) => {
                if (id === page.id) return;
                if (offen) void schreibeRef.current?.();
                router.push(`/website/seiten/${id}`);
              }}
            />
            {/* Die Sprachwahl — wie im Vorbild direkt neben der Seitenwahl.
                Sie schaltet die INHALTS-Sprache (`locale`), also was die
                Vorschau zeigt und der Inspektor bearbeitet; die Oberfläche
                bleibt in `dashboardLocale`. Beide Stellen hängen an derselben
                Variablen, deshalb können sie nicht auseinanderlaufen.
                Führt die Website nur eine Sprache, blendet sich das Bauteil
                selbst aus — ein Menü mit einem Eintrag ist ein Klick ohne
                Wirkung. */}
            <SprachWahl
              sprachen={websiteSprachen}
              gefuehrt={gefuehrteSprachen}
              aktiv={locale}
              standard={standardSprache}
              onWahl={(l) => {
                // Eine Funktion für BEIDE Umschalter (Kopfzeile hier,
                // Inspektor rechts) — sie sollen dasselbe tun, und getrennte
                // Kopien liefen genau deshalb auseinander (A2).
                //
                // Was sie tut, und warum die Oberfläche mitgeht:
                //
                // Der Baukasten hat bewusst keine Dashboard-Topbar
                // (`(baukasten)/layout.tsx`) — und damit fehlte ihm der
                // Sprachumschalter, den jede andere Seite oben rechts hat. Ein
                // dänischer Betrieb bediente also einen deutschen Editor, ohne
                // jeden Weg, das zu ändern, solange er im Baukasten war.
                //
                // Diese EINE Wahl schaltet deshalb beides: den Inhalt, den man
                // bearbeitet, und die Sprache, in der die Werkzeuge dastehen.
                // Zwei getrennte Umschalter wären die naheliegende Lösung und
                // die falsche — niemand will seine Oberfläche und seinen Inhalt
                // getrennt umstellen, und wer es doch will, stellt das Konto um.
                //
                // `setLocale` schreibt das Cookie, `router.refresh()` holt die
                // Server-Komponenten in der neuen Sprache. Kein `reload()`: der
                // Refresh behält den Bearbeitungsstand im Speicher.
                spracheWechseln(l);
              }}
              verwaltenHref="/website/einstellungen/sprachen"
            />
            <GeraeteUmschalter geraet={geraet} onGeraet={setGeraet} />
          </>
        }
        kopfAktionen={
          <>
            {/* Fremde Änderung, während hier etwas Ungespeichertes offen ist.
                Kein automatisches Neuladen: das würde die Eingabe verschlucken,
                an der gerade jemand sitzt. Der Knopf lädt auf Zuruf — und
                verwirft dabei ausdrücklich, was offen ist. */}
            {fremdeAenderung ? (
              <button
                type="button"
                onClick={() => {
                  uebernehmen();
                  setNeuLaden((n) => n + 1);
                }}
                className="flex items-center gap-1.5 rounded-full bg-orange-500 px-3 py-1 text-sm font-medium text-white transition hover:bg-orange-600"
              >
                <Icon icon="ph:arrows-clockwise" className="size-4" />
                {t("editor.fremdeAenderung")}
              </button>
            ) : null}
            {/* Reihenfolge wie im Foto: ↺ ↻ ✓ … Vorher gab es beides gar
                nicht — bei einem Editor mit Autospeichern ist das kein
                Komfortmangel, sondern eine Lücke: es gibt keinen
                Speichern-Knopf, den man NICHT drückt. */}
            <VerlaufKnoepfe
              kannZurueck={verlauf.kannZurueck}
              kannVor={verlauf.kannVor}
              onZurueck={() => springe("zurueck")}
              onVor={() => springe("vor")}
            />
            {/* Suche und Seiteninformation — im Vorbild stehen sie links vom
                Häkchen.

                Beide greifen auf das, was der Editor SCHON hat, statt eine
                zweite Fassung danebenzustellen: die Lupe öffnet die
                Bausteinsuche des Hinzufügen-Panels (`hinzufuegen-panel.tsx`,
                sie sucht über alle Kategorien), das ⓘ die Einstellungen der
                offenen Seite (`SeitenEinstellungen` — Titel, Adresse, SEO,
                Sprachen). Eine eigene Suche in der Kopfzeile wäre die
                Doppelung, gegen die Wurzel 2 steht. */}
            <KopfSymbol
              icon="ph:magnifying-glass"
              label={t("hinzufuegen.suchen")}
              onClick={() => panelSetzen("hinzufuegen")}
            />
            <KopfSymbol
              icon="ph:info"
              label={t("seiten.einstellungen")}
              onClick={() => setInfoOffen(true)}
            />
            {/* Übersetzen (0476). Steht NEBEN der Sprachwahl-Gruppe und nicht
                in ihr: die Wahl schaltet um, dieser Knopf verändert Daten.
                Zwei Handlungen an einem Bauteil wären der Klick, bei dem
                niemand weiß, was passiert.

                Nur sichtbar, wenn die Website mehr als eine Sprache führt —
                ohne zweite Sprache gibt es nichts zu übersetzen, und ein Knopf
                ohne Wirkung ist eine Attrappe (Wurzel 4). */}
            {gefuehrteSprachen.length > 1 ? (
              <KopfSymbol
                icon={
                  uebersetztLaeuft ? "ph:circle-notch" : "ph:translate"
                }
                label={t("uebersetzung.starten")}
                onClick={() => void seiteUebersetzen()}
                disabled={uebersetztLaeuft}
              />
            ) : null}
            <SpeicherHaken stand={stand} />
            <WebsiteAnsehen pages={pages} liveDomain={liveDomain} />
            {/* Veröffentlichen im EDITOR. Der Knopf gab es nur in der
                Übersicht: wer hier fertig wurde, musste erst zurücknavigieren,
                um seine Arbeit live zu bringen. Es ist derselbe Knopf, nicht
                eine zweite Fassung (`kopfleiste.tsx`). */}
            <VeroeffentlichenKnopf pages={pages} />
            <KopfSymbol
              icon="ph:question"
              label={t("kopf.hilfe")}
              href={hilfeUrl("website-baukasten")}
            />
            {/* Das Haus-Symbol ersetzt den Text „Zur Übersicht" — dieselbe
                Wirkung, und rechts ist der Platz für den Veröffentlichen-Knopf
                gebraucht. Es öffnet dasselbe Seiten-Panel wie das Logo und
                verlässt den Baukasten NICHT (siehe dort). */}
            <KopfSymbol
              icon="ph:house"
              label={t("kopf.zurUebersicht")}
              onClick={() => panelSetzen(panel === "seiten" ? null : "seiten")}
            />
          </>
        }
        seitenleiste={seitenleiste}
        inspektor={inspektor}
        // Das BLOG-CMS fährt von links über die Arbeitsfläche und bedeckt drei
        // Viertel — die Seite dahinter bleibt stehen, samt Vorschau. Es ist
        // deshalb ein Großpanel und keine Seitenleiste: eine Beitragsliste mit
        // Vorschaubild, Titel, Autor, Status und Datum nebeneinander passt
        // nicht in 20 rem.
        grossPanelTitel={t("reiter.blog")}
        onGrossPanelZu={
          panel === "blog" ? () => panelSetzen(null) : undefined
        }
        grossPanel={
          panel === "blog" ? (
            <BlogPanel
              punkt={blogPunkt}
              onPunkt={setBlogPunkt}
              beitraege={pages.filter((p) => p.page_type === "post")}
              seiten={pages}
              einstellungen={blogEinstellungen}
              feldKonfig={blogFeldKonfig}
              eigeneFelder={blogEigeneFelder}
              liveDomain={liveDomain}
              // Der Beitrag, der beim Ankommen geöffnet wird (`?beitrag=`).
              oeffneBeitragId={beitragWunsch}
              // Der Beitrag wird IM PANEL bearbeitet (Dialog über der
              // Tabelle) — kein Sprung mehr in den Seiten-Editor. Was der
              // Editor hier noch tun muss, ist die Seitenliste nachzuladen.
              onNeuLaden={() => router.refresh()}
            />
          ) : null
        }
        inhalt={
          // Die ARBEITSFLÄCHE ist die gerenderte Seite selbst — Rahmen,
          // Etikett, Leiste und Kontextmenü liegen ÜBER dem iframe, an den
          // Koordinaten, die der Renderer meldet. Vorher stand hier eine dritte
          // Spalte mit Karten neben der Vorschau; sie zeigte nichts und ließ
          // die Wirkung wieder erst nebenan sehen.
          <VorschauFlaeche
            // Solange eine Vorlage angesehen wird, zeigt die Fläche SIE.
            // Der Rückweg ist das Schließen des Panels — deshalb wird
            // `vorlageAnsehen` dort zurückgesetzt.
            fremdeUrl={
              vorlageAnsehen && vorlageToken
                ? `${process.env.NEXT_PUBLIC_BUILDER_URL}/render/vorlage/` +
                  `${encodeURIComponent(vorlageAnsehen)}?` +
                  new URLSearchParams({
                    token: vorlageToken,
                    slug: "",
                    locale,
                  }).toString()
                : null
            }
            geraet={geraet}
            pageId={page.id}
            token={token}
            tokenFehler={tokenFehler}
            neuLaden={neuLaden}
            iframeRef={iframeRef}
            onLoad={iframeBereit}
            editierbar
            locale={locale}
            overlay={
              <FlaechenOverlay
                zeilen={zeilen}
                rechtecke={rechtecke}
                aktiv={aktiv}
                ueberfahren={ueberfahren}
                zeiger={zeiger}
                menu={menu}
                geraet={geraet}
                zieht={zieht}
                // Abwurf in eine LEERE Spalte: der Baustein entsteht DARIN,
                // nicht in einer eigenen Reihe daneben. Das ist der Handgriff,
                // für den das Spaltenlayout überhaupt existiert.
                onAbwurfInSpalte={(spalteId, stelle) => {
                  if (!zieht) return;
                  // `stelle` steht, wenn die Spalte schon Bausteine hat: dann
                  // landet der neue GENAU zwischen ihnen, nicht am Ende.
                  hinzufuegen(
                    zieht,
                    zieht === "image" && ziehtBild ? { url: ziehtBild } : {},
                    spalteId,
                    stelle,
                  );
                  setZieht(null);
                  setZiehtBild(null);
                  panelSetzen(null);
                }}
                onAbwurf={(position) => {
                  if (!zieht) return;
                  // Die Stelle kommt aus dem blauen Balken und geht DIREKT
                  // mit — nicht über `setEinfuegenVor`. Der State wäre in
                  // diesem Aufruf noch der alte (siehe `hinzufuegen`).
                  hinzufuegen(
                    zieht,
                    zieht === "image" && ziehtBild ? { url: ziehtBild } : {},
                    null,
                    position,
                  );
                  setZieht(null);
                  setZiehtBild(null);
                  // Nach dem Abwurf zeigt die Leiste den neuen Abschnitt, nicht
                  // weiter die Baustein-Liste: der nächste Handgriff ist immer
                  // „jetzt füllen".
                  panelSetzen(null);
                }}
                onMenu={setMenu}
                onWaehle={setAktiv}
                onInhalt={(key) => {
                  setAktiv(key);
                  setPanelModus("inhalt");
                }}
                onDesign={(key) => {
                  setAktiv(key);
                  setPanelModus("design");
                }}
                onDuplizieren={dupliziere}
                // Beide Wege öffnen das HINZUFÜGEN-PANEL an der gemerkten
                // Stelle — nicht mehr einen eigenen Dialog. Es gab den Katalog
                // zweimal: als Panel in der Leiste und als Vollbild-Dialog von
                // der Fläche aus, mit verschiedener Darstellung derselben
                // sechzig Bausteine. Wer den einen kannte, fand den anderen
                // nicht wieder.
                onEinfuegenNach={(key) => {
                  setEinfuegenVor(zeilen.findIndex((r) => r.key === key) + 1);
                  panelSetzen("hinzufuegen");
                }}
                onEinfuegenAn={(position) => {
                  setEinfuegenVor(position);
                  panelSetzen("hinzufuegen");
                }}
                // Das Layout entsteht DIREKT an der Naht, ohne Umweg über den
                // Katalog: der Rahmen kommt vor dem Inhalt.
                onLayoutEinfuegen={(bs, position) => {
                  void layoutEinfuegen(bs, position);
                }}
                onVerschiebe={verschiebe}
                onEntferne={entferne}
                onVersteckt={aendereVersteckt}
              />
            }
          />
        }
      />
      {/* Die Seiteninformation zur OFFENEN Seite. Dieselbe Komponente, die die
          Seitenliste benutzt — nicht eine zweite Fassung für den Editor.
          Nach dem Schließen wird neu geladen: der Dialog kann Titel, Adresse
          oder Sprachen geändert haben, und Kopfzeile wie Vorschau zeigen sie. */}
      {infoOffen ? (
        <SeitenEinstellungen
          seite={page}
          // Hier die GEFÜHRTEN, nicht alle 24: der Dialog ordnet die Seite
          // Sprachen zu, in denen die Website erreichbar ist. Eine Seite einer
          // Sprache zuzuordnen, die niemand ausliefert, macht sie unerreichbar.
          websiteSprachen={gefuehrteSprachen}
          domain={liveDomain}
          onSchliessen={() => {
            setInfoOffen(false);
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}

/**
 * Der Breadcrumb des Inspektors: die Kette vom Abschnitt bis zum Baustein.
 *
 * Gelesen aus dem ECHTEN Baum (`parent_id`), nicht geraten. Findet sich die
 * Zeile dort nicht — ein eben angelegter Baustein hat noch keine DB-Zeile —,
 * kommt eine LEERE Kette zurück und der Inspektor zeigt nur den Titel. Eine
 * erfundene Kette („Abschnitt › Spalte") wäre eine Aussage über eine Struktur,
 * die es noch gar nicht gibt (Wurzel 4).
 *
 * Die Kette endet VOR dem Baustein selbst: sein Name steht direkt darunter als
 * Überschrift, und zweimal dasselbe Wort untereinander ist keine Navigation.
 */
function krumenFuer(
  blocks: Block[],
  id: string | null,
  t: (schluessel: string) => string,
): BrotKrume[] {
  if (!id) return [];
  const nachId = new Map(blocks.map((b) => [b.id, b]));
  const kette: BrotKrume[] = [];
  // Vom Baustein nach OBEN laufen und dabei einsammeln. Die Tiefe ist durch
  // das Datenmodell begrenzt (Abschnitt → Spalte → Innenspalte → Baustein),
  // aber die Schleife bekommt trotzdem eine harte Grenze: eine Zeile, die sich
  // durch einen Datenfehler selbst als Elternteil trägt, würde den Editor sonst
  // einfrieren (Wurzel 8: jeder unbegrenzte Lauf bekommt eine Obergrenze).
  let aktuell = nachId.get(id)?.parent_id ?? null;
  for (let tiefe = 0; aktuell && tiefe < 8; tiefe += 1) {
    const eltern = nachId.get(aktuell);
    if (!eltern) break;
    const art = eltern.kind ?? "widget";
    kette.unshift({ id: eltern.id, label: t(`ebenen.${art}`) });
    aktuell = eltern.parent_id ?? null;
  }
  return kette;
}

function IconKnopf({
  icon,
  label,
  onClick,
  disabled,
  gefahr,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  gefahr?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={
        "p-0.5 text-muted-foreground transition disabled:opacity-30 " +
        (gefahr ? "hover:text-destructive" : "hover:text-foreground")
      }
    >
      <Icon icon={icon} className="size-3.5" />
    </button>
  );
}
