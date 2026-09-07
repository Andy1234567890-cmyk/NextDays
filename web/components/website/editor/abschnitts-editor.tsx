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
import { setBranding } from "@/lib/site-config";
import {
  mitTeil,
  mitTeilGesperrt,
  mitTeilVersteckt,
  mitWert,
  teilSettings,
  type Region,
  type RegionStand,
  regionLesen,
  regionZumSpeichern,
  teilVerschoben,
  teilVerschobenVor,
} from "@nextdays/baukasten-stil";
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
  listBlocks,
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
import {
  anzeigeBloecke,
  bausteinReihenfolge,
  elternKette,
} from "../ebenen-baum";
import {
  menueBeschriftung,
  REITER_HREF,
  REITER_MENUE,
  REITER_SYMBOL,
  ZULETZT_ID,
} from "../reiter";
import { MenueSpalte } from "../menue-spalte";
import { GrossPanel, type SpeicherStand } from "../schale";
import { useVerlauf } from "../use-verlauf";
import { useVorschauToken } from "../use-vorschau-token";
import { useZuletzt } from "../use-zuletzt";
import { type BlogPunkt, BlogPanel } from "../blog/blog-panel";
import { BeitragsTeile } from "../blog/beitrags-teile";
import type { FeldKonfig } from "../blog/felder";
import { protokoll, protokollFehler } from "./protokoll";
import {
  SpeicherHaken,
  SprachWahl,
  VeroeffentlichenKnopf,
  VerlaufKnoepfe,
  WebsiteAnsehen,
} from "../kopfleiste";
import { SeitenWahl } from "../seiten-wahl";
import type { Geraet } from "../vorschau";
import { Buehne, RAHMEN_BREITE, rahmenUrsprung, useKamera } from "./buehne";
import { FramerSchale, KopfKnopf } from "./framer-schale";
import { SeitenInspektor } from "./seiten-inspektor";
import { AgentReiter } from "./agent-reiter";
import { Mediathek } from "../mediathek";
import { type Gemessen, StilInspektor } from "./stil-inspektor";
import { ContainerInspektor } from "./container-inspektor";
import { InhaltDialog } from "./inhalt-dialog";
import {
  HinzufuegenPanel,
  type KatalogKategorie,
} from "../hinzufuegen-panel";
import { MedienPanel } from "../medien-panel";
import {
  type EbenenAktion,
  UEBERLAUF_AKTION,
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
import { RegionInspektor } from "./region-inspektor";
import { beweglicheTeile, type RegionAuswahl } from "../ebenen-regionen";
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
  "mediathek",
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
  // Framers dritter Reiter links („Assets"): die Mediathek im Panel.
  | "mediathek"
  | null;

/** Die Reiter des linken Panels (Framer: Pages · Layers · Assets). */
type LinkerReiter = "seiten" | "ebenen" | "mediathek";
/** Die Reiter des rechten Panels (Framer: Agent · Style). */
type RechterReiter = "agent" | "style";
/** Sichtbare Breakpoint-Rahmen je Browser — Sichtzustand, keine Einstellung. */
const RAHMEN_SCHLUESSEL = "editor-rahmen";
const DUNKEL_SCHLUESSEL = "editor-dunkel";

/** Ein Container samt allem, was darunter hängt — für die sofortige Anzeige.
 *
 *  Die Datenbank macht dasselbe über `on delete cascade` an `parent_id`
 *  (0472). Hier wird es nachgezeichnet, damit die Ebenen-Liste nicht eine
 *  Sekunde lang Spalten und Bausteine eines Abschnitts zeigt, den es nicht
 *  mehr gibt. */
/** Ist der geklickte Baustein oder einer seiner Container gesperrt? Liefert
 *  die Kennung der gesperrten Ebene — die ÄUSSERSTE, denn ein gesperrter
 *  Abschnitt sperrt alles darin. */
function gesperrteEbene(
  blocks: Block[],
  bausteinId: string | null,
  containerId: string | null,
): string | null {
  const start = bausteinId ?? containerId;
  if (!start) return null;
  const kette = [start, ...elternKette(blocks, start)];
  const nachId = new Map(blocks.map((b) => [b.id, b]));
  let gesperrt: string | null = null;
  for (const id of kette) {
    if (nachId.get(id)?.settings?.locked === true) gesperrt = id;
  }
  return gesperrt;
}

/** Der erste NICHT gesperrte Container über einer Ebene, oder `null`. */
function ersterFreierElternteil(blocks: Block[], id: string): string | null {
  const nachId = new Map(blocks.map((b) => [b.id, b]));
  for (const eltern of elternKette(blocks, id)) {
    if (nachId.get(eltern)?.settings?.locked !== true) return eltern;
  }
  return null;
}

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

/** Welche gemeldeten Arten einen RAHMEN bilden — sie tragen Layout und
 *  Innenabstand, ein Text- oder Bild-Layer nicht (Framer, 06.09.2026). */
const RAHMEN_ARTEN = new Set(["frame", "stack", "grid", "masonry", "link", "knopf"]);
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
  // An welcher Stelle der Katalog einfügt. `null` = ans Ende (der Knopf
  // unter der Liste); eine Zahl = genau dort (das `+` an einer Karte).
  const [einfuegenVor, setEinfuegenVor] = useState<number | null>(null);
  /** Läuft gerade ein Layout-Einsatz? Er besteht aus mehreren Requests
   *  (Abschnitt, dann je Spalte einer) — ein Doppelklick würde die Struktur
   *  doppelt anlegen. */
  const [legtLayoutAn, setLegtLayoutAn] = useState(false);
  const [geraet, setGeraet] = useState<Geraet>("desktop");
  const geraetRef = useRef<Geraet>("desktop");
  geraetRef.current = geraet;
  // Welche Breakpoints als RAHMEN auf der Fläche stehen (Framer: Desktop
  // zuerst, „+" holt Tablet/Phone dazu). Gemerkt je Browser — eine Sicht,
  // keine Einstellung der Seite.
  const [sichtbareRahmen, setSichtbareRahmen] = useState<Geraet[]>(() => {
    try {
      const roh = window.localStorage.getItem(RAHMEN_SCHLUESSEL);
      const liste = roh ? (JSON.parse(roh) as unknown) : null;
      if (Array.isArray(liste)) {
        const ok = liste.filter(
          (g): g is Geraet => g === "desktop" || g === "tablet" || g === "mobil",
        );
        if (ok.includes("desktop")) return ok;
      }
    } catch {
      // kein Speicher — Standard
    }
    return ["desktop"];
  });
  function rahmenSetzen(g: Geraet, drin: boolean) {
    setSichtbareRahmen((alt) => {
      const neu = drin ? [...new Set([...alt, g])] : alt.filter((x) => x !== g);
      if (!neu.includes("desktop")) neu.unshift("desktop");
      try {
        window.localStorage.setItem(RAHMEN_SCHLUESSEL, JSON.stringify(neu));
      } catch {
        // kein Speicher — egal
      }
      return neu;
    });
    if (!drin && geraet === g) setGeraet("desktop");
    protokoll("klick", drin ? "Rahmen hinzu" : "Rahmen weg", { geraet: g });
  }
  const kamera = useKamera(sichtbareRahmen);
  const sichtbareRahmenRef = useRef<Geraet[]>(sichtbareRahmen);
  sichtbareRahmenRef.current = sichtbareRahmen;
  const { hoeheSetzen: kameraHoehe, rad: kameraRad, taste: kameraTaste } = kamera;
  // Dunkles Editor-Thema (Framers Standard); der Mond unten schaltet um.
  const [dunkel, setDunkel] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(DUNKEL_SCHLUESSEL) !== "0";
    } catch {
      return true;
    }
  });
  function dunkelSetzen(d: boolean) {
    setDunkel(d);
    try {
      window.localStorage.setItem(DUNKEL_SCHLUESSEL, d ? "1" : "0");
    } catch {
      // kein Speicher — egal
    }
  }
  const [rechterReiter, setRechterReiter] = useState<RechterReiter>("style");
  /** Der Baustein, dessen INHALT im Dialog offen ist (Schlüssel der Zeile). */
  const [inhaltOffen, setInhaltOffen] = useState<string | null>(null);
  const [canvasMenue, setCanvasMenue] = useState(false);
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
  /** Ein Knoten in der Struktur eines Bausteins — die Ebene unterhalb des
   *  Bausteins, wie Framer sie führt. */
  type TeilKnoten = {
    feld: string;
    eltern: string | null;
    art: string;
    marke: string | null;
  };

  /** Ein laufender Ziehvorgang AUF DER FLÄCHE (06.09.2026): welcher Baustein,
   *  wo steht der Zeiger, und ist die Maus schon los? Der Zustand lebt hier,
   *  weil die Geste im iframe beginnt und im Overlay endet. */
  const [flaechenZug, setFlaechenZug] = useState<{
    key: string;
    x: number;
    y: number;
    fertig?: boolean;
  } | null>(null);

  /** Der gewählte TEIL eines Bausteins (06.09.2026).
   *
   *  „jeder text und bild und alles ist eine einzelne Funktion, die individuell
   *  einzeln gestaltbar ist durch das Style-Panel" (Auftrag), nach der Messung
   *  bei Framer: dort ist jede Überschrift und jeder Absatz eine eigene Ebene.
   *  Unser Baustein ist gröber — seine Teile stehen deshalb unter dem
   *  Feldschlüssel in `settings.teile.<feld>` und tragen dieselbe Darstellung
   *  wie ein ganzer Block.
   *
   *  NEBEN `aktiv` und nicht darin: `aktiv` ist der Baustein, `teil` die
   *  Stelle darin. Beides zusammen ist die Auswahl. */
  const [teilAuswahl, setTeilAuswahl] = useState<{
    key: string;
    feld: string;
  } | null>(null);
  /** Die Rechtecke der Teile, gemeldet von der Brücke — Schlüssel
   *  `<blockId>/<feld>`. */
  const [teilRechtecke, setTeilRechtecke] = useState<
    Map<
      string,
      {
        top: number;
        left: number;
        width: number;
        height: number;
        /** Schlüssel des übergeordneten Knotens im Baustein, `null` = oberste
         *  Ebene darin. */
        eltern: string | null;
        /** `frame` · `stack` · `grid` · `masonry` · `bild` · `video` · `text` … */
        art: string;
        /** Der sichtbare Text als Namenszusatz im Baum. */
        marke: string | null;
      }
    >
  >(new Map());

  /** Welche TEILE ein Baustein zeigt — aus den gemeldeten Rechtecken. Die
   *  Reihenfolge ist die Lesereihenfolge auf der Seite (oben nach unten, links
   *  nach rechts), nicht die des Katalogs: im Baum soll dieselbe Ordnung
   *  stehen wie auf der Fläche. */
  const teileJeBlock = useMemo(() => {
    const karte = new Map<string, TeilKnoten[]>();
    const sortiert = [...teilRechtecke.entries()].sort(
      ([, a], [, b]) => a.top - b.top || a.left - b.left,
    );
    for (const [schluessel, r] of sortiert) {
      const trenner = schluessel.indexOf("/");
      const id = schluessel.slice(0, trenner);
      const feld = schluessel.slice(trenner + 1);
      if (!id || !feld) continue;
      const liste = karte.get(id) ?? [];
      liste.push({ feld, eltern: r.eltern, art: r.art, marke: r.marke });
      karte.set(id, liste);
    }
    return karte;
  }, [teilRechtecke]);

  // --- Kopf-/Fußzeile als Ebenen (0570) -----------------------------------
  // Die gewählte Regions-Ebene (Region selbst oder ein Teil), ihre Rechtecke
  // aus der Brücke und der Stand aus dem Branding. Der Stand lebt HIER und
  // nicht im Design-Panel, weil Baum, Fläche und Inspektor ihn zugleich
  // brauchen — gespeichert wird sofort je Klick über `setBranding`, es gibt
  // keinen Entwurf: ein Auge ist eine Absicht, kein Tippen.
  const [regionAuswahl, setRegionAuswahl] = useState<RegionAuswahl | null>(null);
  const [regionRechtecke, setRegionRechtecke] = useState<
    Map<string, { top: number; left: number; width: number; height: number }>
  >(new Map());
  const [teileStand, setTeileStand] = useState<Record<Region, RegionStand>>(() => ({
    kopfzeile: regionLesen("kopfzeile", branding.header_teile),
    fusszeile: regionLesen("fusszeile", branding.footer_teile),
  }));
  // Eine Regions-Ebene und ein Block schließen sich aus — wie im Baum.
  useEffect(() => {
    if (aktiv || containerId) setRegionAuswahl(null);
  }, [aktiv, containerId]);
  // Ein TEIL gehört zu genau einem Baustein: wechselt der, ist die Stelle weg.
  useEffect(() => {
    setTeilAuswahl((t) => (t && t.key === aktiv ? t : null));
  }, [aktiv]);

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
  /** Der Baum, wie die EBENEN ihn zeigen: Container aus `baumBlocks`, Bausteine
   *  aus `zeilen` (05.09.2026, Befund 1/2/12). Vorher las der Baum nur den
   *  Server-Stand und sah keine Bausteinänderung, bis die Seite neu lud. */
  const baumAnzeige = useMemo(
    () => anzeigeBloecke(baumBlocks, zeilen, page.id),
    [baumBlocks, zeilen, page.id],
  );
  // Für die Meldungs-Handler der Brücke, die über eine Ref laufen und den
  // aktuellen Baum sonst nicht sähen.
  const baumBlocksRef = useRef(baumAnzeige);
  baumBlocksRef.current = baumAnzeige;

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

  /** Waren seit dem letzten Speichern NUR Darstellungs-Werte dran?
   *
   *  Dann braucht die Vorschau kein Neuladen: sie zeigt die Änderung längst
   *  (`sendeStil` schickt sie sofort in den iframe). Inhalt und Struktur
   *  brauchen es weiterhin — ein neuer Baustein, ein anderer Text oder ein
   *  anderes HTML-Element entsteht nicht aus einer CSS-Regel. */
  const nurStilRef = useRef(true);

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
    // NUR neu laden, wenn es etwas zu holen gibt: neue Bausteine (Struktur)
    // oder geänderter Inhalt. Eine reine Stiländerung steht in der Vorschau
    // schon — sie noch einmal zu laden hieße, sie eine Sekunde später gegen
    // dasselbe Bild zu tauschen, mit Sprung an den Seitenanfang.
    const strukturNeu = gesendet.some((r) => !r.id);
    if (!nurStilRef.current || strukturNeu) {
      protokoll("vorschau", "Vorschau wird neu geladen", {
        abschnitte: verschmolzen.length,
        grund: strukturNeu ? "struktur" : "inhalt",
      });
      setNeuLaden((n) => n + 1);
    } else {
      protokoll("vorschau", "Neuladen übersprungen — nur Darstellung", {
        abschnitte: verschmolzen.length,
      });
    }
    nurStilRef.current = true;
    // Die CONTAINER nachladen (05.09.2026): der Server legt für einen neuen
    // Baustein Abschnitt und Spalte an, und der Baum kannte sie bis zum
    // nächsten `router.refresh()` nicht — der Baustein stand als Wurzel mit
    // dem Abzeichen „ohne Elternteil" da, obwohl er längst seine Hülle hatte.
    // Nur bei Strukturänderung (mindestens ein Baustein war neu), nicht bei
    // jedem Tastendruck.
    if (strukturNeu) {
      const baum = await listBlocks(page.id, true);
      if (baum.ok) setBaumBlocks(baum.data.items);
      else {
        protokollFehler("antwort", "Baum nach dem Speichern nicht geladen", {
          fehler: baum.error,
        });
      }
    }
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

  /** Die AUSWAHLKETTE unter dem Zeiger, von außen nach innen.
   *
   *  Framers Regel, am 06.09.2026 gemessen: ein Klick bei leerer Auswahl
   *  trifft den ÄUSSERSTEN Rahmen (bei uns den Abschnitt). Jeder Doppelklick
   *  geht eine Ebene tiefer — Abschnitt → Spalte → Baustein → Teil. Steht die
   *  Auswahl schon in der Kette, bleibt ein Klick auf DERSELBEN Ebene und
   *  wählt das Geschwister unter dem Zeiger.
   *
   *  Vorher traf jeder Klick sofort das Innerste. Das ist bequem, solange man
   *  einen Baustein sucht, und unbrauchbar, sobald man den Abschnitt darum
   *  gestalten will: man kam nur über den Ebenen-Baum an ihn heran. */
  type KettenGlied =
    | { art: "container"; id: string }
    | { art: "baustein"; key: string }
    | { art: "teil"; key: string; feld: string };

  // Die Struktur-Rechtecke als Ref: `ketteAus` läuft in einem Callback, der
  // die Meldungen der Brücke bedient — er darf nicht bei jeder Messung neu
  // entstehen.
  const teilRechteckeRef = useRef(teilRechtecke);
  teilRechteckeRef.current = teilRechtecke;

  const ketteAus = useCallback(
    (data: CanvasMeldung): KettenGlied[] => {
      const zeile = zeilenRef.current.find(
        (r) => (data.id && r.id === data.id) || (data.index != null && r.id == null && false),
      );
      const kette: KettenGlied[] = [];
      // Die Container von AUSSEN nach innen: `elternKette` liefert sie
      // umgekehrt (innerstes zuerst), also drehen.
      const start = zeile?.id ?? data.containerId ?? null;
      if (start) {
        const eltern = elternKette(baumBlocksRef.current, start).reverse();
        for (const id of eltern) kette.push({ art: "container", id });
      }
      if (!zeile && data.containerId) {
        // Der Container selbst ist das Innerste (leere Spalte, leerer Abschnitt).
        if (!kette.some((g) => g.art === "container" && g.id === data.containerId)) {
          kette.push({ art: "container", id: data.containerId });
        }
      }
      if (zeile) {
        kette.push({ art: "baustein", key: zeile.key });
        if (typeof data.feld === "string" && zeile.id) {
          // Die STRUKTUR zwischen Baustein und getroffener Stelle: Stapel,
          // Rahmen, Bild — sie stehen im Baum und gehören deshalb auch in die
          // Kette, sonst spränge ⎋ vom Text direkt zum Baustein und
          // übersprünge alles dazwischen.
          const kn: string[] = [];
          let lauf: string | null = data.feld;
          const gesehen = new Set<string>();
          while (lauf && !gesehen.has(lauf)) {
            gesehen.add(lauf);
            kn.unshift(lauf);
            lauf = teilRechteckeRef.current.get(`${zeile.id}/${lauf}`)?.eltern ?? null;
          }
          for (const feld of kn) kette.push({ art: "teil", key: zeile.key, feld });
        }
      }
      return kette;
    },
    [],
  );

  /** Wie tief die AKTUELLE Auswahl in einer Kette steht — `-1`, wenn sie gar
   *  nicht darin vorkommt (dann fängt der Klick wieder außen an). */
  const tiefeInKette = useCallback(
    (kette: KettenGlied[]): number => {
      for (let i = kette.length - 1; i >= 0; i--) {
        const g = kette[i]!;
        if (g.art === "teil" && teilAuswahl?.key === g.key && teilAuswahl.feld === g.feld) {
          return i;
        }
        if (g.art === "baustein" && !teilAuswahl && aktiv === g.key) return i;
        if (g.art === "container" && containerId === g.id) return i;
      }
      return -1;
    },
    [aktiv, containerId, teilAuswahl],
  );

  /** Ein Glied der Kette auswählen. */
  const waehleGlied = useCallback((g: KettenGlied | undefined) => {
    if (!g) return;
    setMenu(null);
    setRegionAuswahl(null);
    if (g.art === "container") {
      setContainerId(g.id);
      setAktiv(null);
      setTeilAuswahl(null);
      return;
    }
    if (g.art === "baustein") {
      setAktiv(g.key);
      setContainerId(null);
      setTeilAuswahl(null);
      return;
    }
    setAktiv(g.key);
    setContainerId(null);
    setTeilAuswahl({ key: g.key, feld: g.feld });
  }, []);

  const teileStandRef = useRef(teileStand);
  teileStandRef.current = teileStand;

  /** Den Stand einer Region schreiben: sofort in die Anzeige, dann ins
   *  Branding; scheitert das Speichern, kommt der alte Stand zurück und der
   *  Fehler steht im Protokoll — kein stilles „gespeichert" (Wurzel 5). */
  const regionSpeichern = useCallback(
    async (region: Region, neu: RegionStand) => {
      const vorher = teileStandRef.current[region];
      setTeileStand((s) => ({ ...s, [region]: neu }));
      const feld = region === "kopfzeile" ? "header_teile" : "footer_teile";
      const wert = regionZumSpeichern(region, neu);
      protokoll("speichern", "Regions-Ebene speichern", { region, wert });
      const res = await setBranding({ [feld]: wert });
      if (!res.ok) {
        protokollFehler("speichern", "Regions-Ebene nicht gespeichert", {
          region,
          fehler: res.error,
        });
        setTeileStand((s) => ({ ...s, [region]: vorher }));
        return;
      }
      // Die Vorschau zeigt den neuen Stand erst nach dem Neuladen — der
      // Renderer liest ihn aus dem Branding, nicht aus dem Block-Baum.
      setNeuLaden((n) => n + 1);
    },
    [],
  );
  const regionVersteckt = useCallback(
    (a: RegionAuswahl, geraete: Geraet[]) =>
      void regionSpeichern(
        a.region,
        mitTeilVersteckt(teileStandRef.current[a.region], a.teil, geraete),
      ),
    [regionSpeichern],
  );
  const regionSperren = useCallback(
    (a: RegionAuswahl, locked: boolean) =>
      void regionSpeichern(
        a.region,
        mitTeilGesperrt(teileStandRef.current[a.region], a.teil, locked),
      ),
    [regionSpeichern],
  );
  const regionZiehen = useCallback(
    (region: Region, teil: string, vorTeil: string) =>
      void regionSpeichern(
        region,
        teilVerschobenVor(teileStandRef.current[region], teil, vorTeil, beweglicheTeile(region)),
      ),
    [regionSpeichern],
  );
  const regionVerschiebe = useCallback(
    (region: Region, teil: string, richtung: -1 | 1) =>
      void regionSpeichern(
        region,
        teilVerschoben(teileStandRef.current[region], teil, richtung, beweglicheTeile(region)),
      ),
    [regionSpeichern],
  );

  const aufNachricht = useCallback(
    (data: CanvasMeldung) => {
      // Neue Geometrie. Sie kommt bei jedem Scrollen und jeder Größenänderung
      // im iframe — deshalb NUR den Zustand ersetzen und sonst nichts tun.
      // Kamera: Rad/Pinch und Kürzel, die im iframe landen (Bühne).
      if (data.type === "rad") {
        kameraRad(data.dx ?? 0, data.dy ?? 0, data.zoom === true, null);
        return;
      }
      if (data.type === "taste" && typeof data.key === "string") {
        if (data.meta === true && data.key.toLowerCase() === "z" && data.typ !== "keyup") {
          verlaufSchrittRef.current(data.shift === true ? "wiederholen" : "rueckgaengig");
          return;
        }
        kameraTaste(
          {
            key: data.key,
            code: data.code ?? "",
            meta: data.meta === true,
            typ: data.typ ?? "keydown",
            alt: data.alt === true,
          },
          geraetRef.current,
        );
        return;
      }
      if (data.type === "rects" && Array.isArray(data.rechtecke)) {
        if (typeof data.seitenHoehe === "number") {
          kameraHoehe(geraetRef.current, data.seitenHoehe);
        }
        const karte = new Map<number, Rechteck>();
        for (const r of data.rechtecke) karte.set(r.index, r);
        setRechtecke(karte);
        // Kopf-/Fußzeile und Teile (0570): Schlüssel `kopfzeile` bzw.
        // `kopfzeile/logo`, genau wie `regionRect` sie unten nachschlägt.
        const regionen = new Map<
          string,
          { top: number; left: number; width: number; height: number }
        >();
        for (const r of data.regionen ?? []) {
          regionen.set(r.teil ? `${r.region}/${r.teil}` : r.region, r);
        }
        setRegionRechtecke(regionen);
        const teileKarte = new Map<
          string,
          {
            top: number;
            left: number;
            width: number;
            height: number;
            eltern: string | null;
            art: string;
            marke: string | null;
          }
        >();
        for (const t of data.teile ?? []) {
          teileKarte.set(`${t.id}/${t.feld}`, {
            top: t.top,
            left: t.left,
            width: t.width,
            height: t.height,
            eltern: t.eltern ?? null,
            art: t.art ?? "frame",
            marke: t.marke ?? null,
          });
        }
        setTeilRechtecke(teileKarte);
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

      // ZIEHEN AUF DER FLÄCHE (06.09.2026): ein Baustein wird an eine andere
      // Stelle gezogen. Bei Framer wird dabei UMSORTIERT — bei uns ebenso,
      // denn die Reihenfolge der Bausteine IST ihre Position auf der Seite.
      //
      // Die STELLE kommt aus der Geometrie (`onFlaechenZug` im Overlay rechnet
      // sie aus den gemeldeten Rechtecken), nicht aus einem Index: der
      // Renderer zählt anders als der Editor, und genau daran landete früher
      // jeder gezogene Abschnitt unten.
      if (data.type === "zug" && typeof data.x === "number" && typeof data.y === "number") {
        if (data.phase === "start") {
          const zeile = zeilenRef.current.find((r) => r.id === data.id);
          if (zeile) setFlaechenZug({ key: zeile.key, x: data.x, y: data.y });
          return;
        }
        if (data.phase === "bewegt") {
          setFlaechenZug((z) => (z ? { ...z, x: data.x!, y: data.y! } : z));
          return;
        }
        // ENDE: die Umsortierung führt das Overlay aus (es kennt die
        // Rechtecke); hier wird nur die Geste beendet.
        setFlaechenZug((z) => (z ? { ...z, x: data.x!, y: data.y!, fertig: true } : z));
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

      // DOPPELKLICK = EINE EBENE TIEFER (Framer-Messung 06.09.2026:
      // Abschnitt → Raster → Karte → Text). Auf einer Textstelle meldet die
      // Brücke stattdessen `bearbeitet` — dort öffnet der Doppelklick den
      // Schreibcursor, wie im Vorbild.
      if (data.type === "dblclick") {
        // DOPPELKLICK GEHT GANZ NACH INNEN — zum kleinsten Element unter dem
        // Zeiger (06.09.2026, gemeldet als „der Button lässt sich nicht in der
        // Fläche anpassen").
        //
        // Vorher ging er EINE Ebene tiefer, wie bei Framer gemessen. Das passt
        // dort, weil eine Framer-Seite flach gebaut ist. Bei uns liegen über
        // jedem Baustein noch Abschnitt UND Spalte (0472) — bis zum Knopf
        // waren es vier Doppelklicks, und nach zweien stand man bei „Inhalt"
        // und hielt es für kaputt. Der Weg nach innen ist jetzt einer, der
        // Weg zurück bleibt ⎋ Schritt für Schritt.
        const kette = ketteAus(data);
        if (kette.length === 0) return;
        waehleGlied(kette[kette.length - 1]);
        return;
      }

      // Der Kunde schreibt gerade IN einer Textstelle: sie ist zugleich die
      // Auswahl, damit das Panel ihre Schrift zeigt, während getippt wird.
      if (data.type === "bearbeitet" && typeof data.feld === "string") {
        const zeile = zeileAusMeldung(data);
        if (!zeile) return;
        setAktiv(zeile.key);
        setContainerId(null);
        setTeilAuswahl({ key: zeile.key, feld: data.feld });
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
        // Gesperrt heißt gesperrt — auch für den Rechtsklick (Befund 19).
        if (
          gesperrteEbene(
            baumBlocksRef.current,
            zeile?.id ?? null,
            typeof data.containerId === "string" ? data.containerId : null,
          )
        ) {
          protokoll("klick", "Rechtsklick auf gesperrte Ebene abgefangen", {
            id: zeile?.id ?? data.containerId ?? null,
          });
          return;
        }
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
        const ursprung = rahmenUrsprung(sichtbareRahmenRef.current, geraetRef.current);
        setMenu({
          x: data.x + ursprung.x,
          y: data.y + ursprung.y,
          key: zeile.key,
        });
        return;
      }

      if (data.type === "select" && typeof data.region === "string") {
        // Klick in die Kopf- oder Fußzeile (0570). Ein GESPERRTER Teil gibt
        // den Klick an seine Region weiter, wie ein gesperrter Block an den
        // nächsten freien Container.
        const region = data.region === "fusszeile" ? "fusszeile" : "kopfzeile";
        const stand = teileStandRef.current[region];
        let teil = typeof data.teil === "string" ? data.teil : null;
        if (teil && stand.teile[teil]?.locked) teil = null;
        if (stand.locked) {
          protokoll("klick", "Klick auf gesperrte Region abgefangen", { region });
          return;
        }
        protokoll("klick", "Regions-Ebene aus der Fläche gewählt", { region, teil });
        setAktiv(null);
        setContainerId(null);
        setMenu(null);
        setRegionAuswahl({ region, teil });
        return;
      }

      if (data.type === "select") {
        const zeile = zeileAusMeldung(data);
        // Eine GESPERRTE Ebene lässt sich auf der Fläche nicht anklicken — das
        // war bis 05.09.2026 nur ein Kommentar (Befund 19). Der Klick geht an
        // den nächsten nicht gesperrten Container darüber, wie in Framer.
        const gesperrtId = gesperrteEbene(
          baumBlocksRef.current,
          zeile?.id ?? null,
          typeof data.containerId === "string" ? data.containerId : null,
        );
        if (gesperrtId) {
          protokoll("klick", "Klick auf gesperrte Ebene abgefangen", {
            id: gesperrtId,
          });
          const frei = ersterFreierElternteil(baumBlocksRef.current, gesperrtId);
          setAktiv(null);
          setContainerId(frei);
          setMenu(null);
          return;
        }
        // FRAMERS AUSWAHLKETTE (06.09.2026 gemessen): außen anfangen, mit
        // Doppelklick tiefer, auf derselben Ebene bleiben, solange man dort
        // schon ist.
        const kette = ketteAus(data);
        if (kette.length === 0) {
          setMenu(null);
          return;
        }
        const tiefe = tiefeInKette(kette);
        // Nicht in der Kette (frische Auswahl) → der äußerste Rahmen.
        // Schon darin → dieselbe Ebene, also das Geschwister unter dem Zeiger.
        waehleGlied(kette[tiefe < 0 ? 0 : Math.min(tiefe, kette.length - 1)]);
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
    [
      kameraHoehe,
      kameraRad,
      kameraTaste,
      ketteAus,
      locale,
      tiefeInKette,
      waehleGlied,
      zeileAusMeldung,
    ],
  );

  const { iframeBereit, scrolleZu, sendeStil } = useCanvasBruecke(
    iframeRef,
    aufNachricht,
  );

  // Wechselt der aktive Rahmen, hängt `iframeRef` am NEUEN iframe — der hat
  // sein `load` längst gemeldet. Also neu grüßen und die Rechtecke des alten
  // Rahmens verwerfen: sie gehören zu einer anderen Breite.
  useEffect(() => {
    setRechtecke(new Map());
    setRegionRechtecke(new Map());
    iframeBereit();
  }, [geraet, iframeBereit]);

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
  // Dasselbe für einen gewählten CONTAINER (Befund 6): der Renderer trägt an
  // Abschnitten und Spalten dieselbe `data-block-id`, der Sprung läuft also
  // über denselben Befehl.
  useEffect(() => {
    if (containerId) scrolleZu(containerId);
  }, [containerId, scrolleZu]);


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
    verlaufMerken(key, "content");
    setZeilen((z) => z.map((r) => (r.key === key ? { ...r, content } : r)));
    nurStilRef.current = false;
  }

  /** Die Darstellungs-Einstellungen eines Abschnitts (0432).
   *
   *  Sie wurden bisher NUR durchgereicht: `background_color`, `padding` und die
   *  Stil-Werte standen im Backend-Schema (`BlockSettings`) und in der
   *  Datenbank, aber es gab keine Oberfläche, sie zu setzen. Damit waren sie
   *  eine Attrappe — der Renderer liest sie, niemand konnte sie füllen. */
  function aendereSettings(key: string, settings: Record<string, unknown>) {
    verlaufMerken(key, "settings");
    setZeilen((z) => z.map((r) => (r.key === key ? { ...r, settings } : r)));
    // SOFORT in die Vorschau (06.09.2026, „schau dir an, wie der Canvas mit
    // dem Style-Panel arbeitet"): der Wert steht drüben, bevor überhaupt
    // gespeichert wird. Vorher sah man ihn erst nach dem Autospeichern und
    // einem Neuladen des iframe — gut eine Sekunde später, mit Sprung nach
    // oben. Wer an einem Schieberegler zieht, braucht die Wirkung UNTER dem
    // Zeiger, sonst regelt er blind.
    const zeile = zeilenRef.current.find((r) => r.key === key);
    if (zeile?.id) sendeStil(zeile.id, settings);
    nurStilRef.current = true;
  }

  // --- Rückgängig / Wiederholen (Framer ⌘Z / ⌘⇧Z, Vollerfassung §11) --------
  //
  // Der Verlauf führt Stil- und Inhaltsänderungen an Bausteinen (das, was der
  // Editor lokal hält und mit dem Autospeichern schreibt). Strukturänderungen
  // (Abschnitt anlegen/löschen/verschieben) laufen über die Struktur-Endpunkte
  // und haben serverseitig keinen Rückweg — sie stehen NICHT im Verlauf, statt
  // eines Rückgängig, das nur so aussieht (Wurzel 4). Ein Eintrag = ein Feld
  // einer Zeile VOR der Änderung; Rückgängig legt den heutigen Stand in die
  // Zukunft, Wiederholen umgekehrt.
  type VerlaufEintrag = { key: string; feld: "settings" | "content"; wert: Record<string, unknown> };
  const verlaufRef = useRef<{ vergangen: VerlaufEintrag[]; zukunft: VerlaufEintrag[] }>({
    vergangen: [],
    zukunft: [],
  });
  function verlaufMerken(key: string, feld: "settings" | "content") {
    const zeile = zeilenRef.current.find((r) => r.key === key);
    if (!zeile) return;
    const v = verlaufRef.current;
    v.vergangen.push({ key, feld, wert: zeile[feld] });
    if (v.vergangen.length > 200) v.vergangen.shift();
    v.zukunft = [];
  }
  function verlaufSchritt(richtung: "rueckgaengig" | "wiederholen") {
    const v = verlaufRef.current;
    const von = richtung === "rueckgaengig" ? v.vergangen : v.zukunft;
    const nach = richtung === "rueckgaengig" ? v.zukunft : v.vergangen;
    const eintrag = von.pop();
    if (!eintrag) {
      toast.message(t("ebenen.nichtsRueckgaengig"));
      return;
    }
    const zeile = zeilenRef.current.find((r) => r.key === eintrag.key);
    if (!zeile) {
      // Die Zeile gibt es nicht mehr (gelöscht) — der Eintrag ist wertlos, weiter.
      verlaufSchritt(richtung);
      return;
    }
    nach.push({ key: eintrag.key, feld: eintrag.feld, wert: zeile[eintrag.feld] });
    protokoll("klick", richtung === "rueckgaengig" ? "Rückgängig" : "Wiederholen", {
      key: eintrag.key,
      feld: eintrag.feld,
    });
    setZeilen((z) => z.map((r) => (r.key === eintrag.key ? { ...r, [eintrag.feld]: eintrag.wert } : r)));
    setAktiv(eintrag.key);
  }
  const verlaufSchrittRef = useRef(verlaufSchritt);
  verlaufSchrittRef.current = verlaufSchritt;
  useEffect(() => {
    function drauf(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.key.toLowerCase() !== "z") return;
      const ziel = e.target as HTMLElement | null;
      if (
        ziel &&
        (ziel.tagName === "INPUT" ||
          ziel.tagName === "TEXTAREA" ||
          ziel.tagName === "SELECT" ||
          ziel.isContentEditable)
      ) {
        return; // dort gilt das Rückgängig des Feldes
      }
      e.preventDefault();
      verlaufSchrittRef.current(e.shiftKey ? "wiederholen" : "rueckgaengig");
    }
    window.addEventListener("keydown", drauf);
    return () => window.removeEventListener("keydown", drauf);
  }, []);

  // --- Stil kopieren / einfügen (Framer ⌥⌘C / ⌥⌘V) ----------------------------
  //
  // Kopiert wird die DARSTELLUNG: Stil, Transform, Text, Effekte, Cursor,
  // Position, Größe, Layout, Abstände samt Geräte-Fassungen. NICHT kopiert:
  // Name, Sperre, Sichtbarkeit, Scroll-Anker, Link, Zugänglichkeit — das sind
  // Eigenschaften genau dieses Elements (ein zweiter gleicher Anker wäre ein
  // ungültiges Dokument, ein kopierter Link ein falsches Ziel).
  const stilZwischenablage = useRef<Record<string, unknown> | null>(null);
  const NICHT_KOPIEREN = new Set(["name", "locked", "hidden_on", "scroll", "link", "a11y"]);
  function stilAuszug(settings: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(Object.entries(settings).filter(([k]) => !NICHT_KOPIEREN.has(k)));
  }
  /** Die Settings nach einem Stil-Handgriff — oder `null`, wenn nichts zu tun ist. */
  function settingsNachStilAktion(
    vorher: Record<string, unknown>,
    aktion: EbenenAktion,
  ): Record<string, unknown> | null {
    if (aktion === "stilKopieren") {
      stilZwischenablage.current = stilAuszug(vorher);
      toast.message(t("ebenen.stilKopiert"));
      return null;
    }
    if (aktion === "stilEinfuegen") {
      if (!stilZwischenablage.current) {
        toast.message(t("ebenen.stilLeer"));
        return null;
      }
      const eigen = Object.fromEntries(Object.entries(vorher).filter(([k]) => NICHT_KOPIEREN.has(k)));
      return { ...eigen, ...stilZwischenablage.current };
    }
    if (aktion in UEBERLAUF_AKTION) {
      const wert = UEBERLAUF_AKTION[aktion as keyof typeof UEBERLAUF_AKTION];
      const stil = (vorher.stil ?? {}) as Record<string, unknown>;
      return { ...vorher, stil: { ...stil, ueberlauf: wert } };
    }
    return null;
  }
  // Als Ref in `containerAktion` (useCallback): die Funktion liest nur Refs
  // und `t`, ein neuer Verweis je Render würde den Callback sonst ständig kippen.
  const stilAktionRef = useRef(settingsNachStilAktion);
  stilAktionRef.current = settingsNachStilAktion;

  function entferne(key: string) {
    nurStilRef.current = false;
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
    // Eine Umsortierung ist KEINE Stiländerung: die Vorschau zeigt die neue
    // Reihenfolge erst nach dem Neuladen. Ohne diese Zeile blieb sie stehen —
    // der Baum zeigte die neue Ordnung, die Seite die alte (live gefunden am
    // 06.09.2026 beim Ziehen auf der Fläche).
    nurStilRef.current = false;
    setZeilen((z) => {
      const i = z.findIndex((r) => r.key === key);
      if (i < 0) return z;
      // Getauscht wird mit dem Nachbarn in DERSELBEN Spalte. Die Liste ist
      // flach über alle Spalten; ein Tausch mit dem Listen-Nachbarn traf am
      // Spaltenrand einen Baustein einer anderen Spalte — im Baum bewegte
      // sich dann nichts (Prüfbefund A14, 05.09.2026).
      const eltern = z[i]!.parentId ?? null;
      let j = i + richtung;
      while (j >= 0 && j < z.length && (z[j]!.parentId ?? null) !== eltern) {
        j += richtung;
      }
      if (j < 0 || j >= z.length) return z;
      const kopie = [...z];
      [kopie[i], kopie[j]] = [kopie[j]!, kopie[i]!];
      return kopie;
    });
  }

  function dupliziere(key: string) {
    nurStilRef.current = false;
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
  // Die Scroll-Anker der Seite (Framers „Abschnitt"-Auswahl am Link):
  // aus den Bausteinen UND den Containern, je Seite eindeutig.
  const ankerListe = useMemo(() => {
    const menge = new Set<string>();
    const lese = (st: unknown) => {
      const sc = (st as { scroll?: { anker?: unknown } } | null)?.scroll;
      if (sc && typeof sc.anker === "string" && sc.anker) menge.add(sc.anker);
    };
    for (const z of zeilen) lese(z.settings);
    for (const b of baumVomServer) lese(b.settings);
    return [...menge].sort();
  }, [zeilen, baumVomServer]);
  /** Ein Beitrag ohne jeden Block zeigt seine Felder statt eines leeren Baums.
   *  EINE Bedingung für Ebenen UND Abschnittsliste — vorher prüfte die eine
   *  `baumBlocks`, die andere `zeilen`, und beide konnten verschieden
   *  ausfallen (Befund 22). */
  const beitragOhneBloecke = istBeitrag && baumAnzeige.length === 0;

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
      <SeitenLeiste pages={pages} aktiveId={page.id} />
    ) : panel === "ebenen" || panel === null ? (
      // Ohne `?panel=` steht der Editor auf den EBENEN — Framers „Layers" ist
      // der Normalzustand, die flache Abschnittsliste darunter nur noch der
      // Rückfall für Beiträge ohne Blöcke.
      // Ein BEITRAG hat keinen Baum: sein Inhalt sind Felder, keine Bloecke.
      // Ohne diese Abzweigung stand hier eine leere Ebenenliste, waehrend die
      // Vorschau daneben Titelbild, Einleitung, Galerien und Text zeichnete
      // (gemeldet am 28.08.2026: „auch in layer nicht").
      beitragOhneBloecke ? (
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
        blocks={baumAnzeige}
        // EINE Auswahl für Baustein und Container (Befund 7/16/17): der Baum
        // bekommt die Kennung der gewählten Ebene, egal welcher Art.
        aktiv={
          aktiveZeile ? (aktiveZeile.id ?? aktiveZeile.key) : containerId
        }
        geraet={geraet}
        onGeraet={setGeraet}
        seiten={pages}
        seiteId={page.id}
        onSeite={(id) => {
          if (id === page.id) return;
          protokoll("klick", "Seitenwechsel aus den Ebenen", { id });
          if (offen) void schreibeRef.current?.();
          router.push(`/website/seiten/${id}`);
        }}
        onWaehle={(id) => {
          if (!id) {
            setAktiv(null);
            setContainerId(null);
            return;
          }
          const zeile = zeilen.find((z) => z.id === id || z.key === id);
          if (zeile) {
            setAktiv(zeile.key);
            setContainerId(null);
          } else {
            setContainerId(id);
            setAktiv(null);
          }
        }}
        onZiehen={(zug) => void ebenenZiehen(zug)}
        onUmbenennen={(id, name) => {
          const zeile = zeilen.find((z) => z.id === id || z.key === id);
          if (zeile) {
            // Bausteine heißen jetzt auch selbst (Framer benennt jede Ebene).
            // Der Name geht mit `settings` über den normalen Speicherweg.
            const settings = { ...zeile.settings };
            if (name) settings.name = name;
            else delete settings.name;
            aendereSettings(zeile.key, settings);
            return;
          }
          void containerUmbenennen(id, name);
        }}
        onVersteckt={(id, g) => {
          const zeile = zeilen.find((z) => z.id === id || z.key === id);
          if (zeile) aendereVersteckt(zeile.key, g);
          else void containerVersteckt(id, g);
        }}
        // Die Handgriffe laufen in DIESELBEN Funktionen wie die der
        // Abschnittsliste bzw. des Container-Inspektors — ein zweiter
        // Schreibweg wäre die Doppelung, gegen die Wurzel 2 steht.
        onAktion={(id, aktion) => {
          const zeile = zeilen.find((z) => z.id === id || z.key === id);
          if (!zeile) {
            void containerAktion(id, aktion);
            return;
          }
          if (aktion === "hoch") verschiebe(zeile.key, -1);
          else if (aktion === "runter") verschiebe(zeile.key, 1);
          else if (aktion === "duplizieren") dupliziere(zeile.key);
          else if (aktion === "verstecken") {
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
          } else if (aktion === "entfernen") entferne(zeile.key);
          else {
            const neu = settingsNachStilAktion(zeile.settings, aktion);
            if (neu) aendereSettings(zeile.key, neu);
          }
        }}
        // Die TEILE je Baustein — aus der MESSUNG der Brücke, nicht aus dem
        // Katalog: im Baum steht, was auf dieser Seite wirklich gerendert ist.
        teileVonBlock={teileJeBlock}
        teilAktiv={
          aktiveZeile && teilAuswahl
            ? `${aktiveZeile.id}#${teilAuswahl.feld}`
            : null
        }
        onTeilWaehle={(blockId, feld) => {
          const zeile = zeilen.find((z) => z.id === blockId);
          if (!zeile) return;
          setAktiv(zeile.key);
          setContainerId(null);
          setTeilAuswahl({ key: zeile.key, feld });
        }}
        onSiteLayout={() => panelSetzen("design")}
        kopfzeile={teileStand.kopfzeile}
        fusszeile={teileStand.fusszeile}
        regionAuswahl={regionAuswahl}
        onRegionWaehle={(a) => {
          setAktiv(null);
          setContainerId(null);
          setRegionAuswahl(a);
        }}
        onRegionVersteckt={regionVersteckt}
        onRegionSperren={regionSperren}
        onRegionZiehen={regionZiehen}
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
        {beitragOhneBloecke ? (
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

      // UMBENENNEN öffnet das Feld in der Ebenenliste selbst; hier gibt es
      // nichts zu tun. Ohne diesen Zweig fiel die Aktion in den `else` unten
      // — und der heißt `removeBlock` (Prüfbefund A2, 05.09.2026).
      if (aktion === "umbenennen") return;
      // Ein Container MIT Inhalt verschwindet samt Inhalt (`on delete
      // cascade`) und ohne Verlauf — deshalb einmal fragen.
      if (
        aktion === "entfernen" &&
        baumBlocks.some((b) => b.parent_id === id) &&
        !window.confirm(t("ebenen.containerLoeschenFrage"))
      ) {
        return;
      }

      // SPERREN und VERSTECKEN sind Einstellungen, keine Strukturänderung —
      // sie laufen über `updateBlock` und nicht über die Struktur-Endpunkte.
      const stilNeu =
        aktion !== "sperren" && aktion !== "verstecken"
          ? stilAktionRef.current((knoten.settings ?? {}) as Record<string, unknown>, aktion)
          : null;
      if (aktion === "stilKopieren" || (aktion === "stilEinfuegen" && !stilNeu)) return;
      if (aktion === "sperren" || aktion === "verstecken" || stilNeu) {
        const vorher = (knoten.settings ?? {}) as Record<string, unknown>;
        const neu = stilNeu
          ? stilNeu
          : aktion === "sperren"
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
    [baumBlocks, containerId, containerGeaendert, router, t],
  );

  /** Einen CONTAINER auf bestimmten Geräten ausblenden (Befund 3: das Auge an
   *  einem Abschnitt war ein stiller No-Op, weil es in `zeilen` suchte).
   *  Dieselbe Sofort-Anzeige und dieselbe Rücknahme bei Fehler wie beim
   *  Umbenennen. */
  const containerVersteckt = useCallback(
    async (id: string, geraete: Geraet[]) => {
      const knoten = baumBlocks.find((b) => b.id === id);
      if (!knoten) return;
      const vorher = knoten.settings ?? {};
      const neu = mitVersteckt(vorher, geraete);
      // Unverändert heißt: nicht schreiben (Wurzel 2).
      if (versteckteGeraete(vorher).join() === versteckteGeraete(neu).join()) {
        return;
      }
      protokoll("klick", "Container je Gerät verstecken", { id, geraete });
      setBaumBlocks((alt) =>
        alt.map((b) => (b.id === id ? { ...b, settings: neu } : b)),
      );
      const res = await updateBlock(id, { settings: neu });
      if (!res.ok) {
        toast.error(res.error);
        setBaumBlocks((alt) =>
          alt.map((b) => (b.id === id ? { ...b, settings: vorher } : b)),
        );
        return;
      }
      router.refresh();
    },
    [baumBlocks, router],
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
      // Im ANZEIGE-Baum suchen: dort stehen auch die ungespeicherten Bausteine.
      const quelleArt =
        baumAnzeige.find((b) => b.id === zug.quelleId)?.kind ?? "widget";

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

      nurStilRef.current = false;
      setZeilen((z) => {
        // Über ID ODER Key: ein noch ungespeicherter Baustein steht im Baum
        // unter seinem Editor-Schlüssel (`anzeigeBloecke`), nicht unter einer
        // DB-ID — sonst wäre er im Baum ziehbar und die Liste fände ihn nicht.
        const passt = (r: Zeile, kennung: string) =>
          r.id === kennung || r.key === kennung;
        const von = z.findIndex((r) => passt(r, zug.quelleId));
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

        const zielIndex = kopie.findIndex((r) => passt(r, zug.zielId));
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
    [baumAnzeige, baumBlocks, containerGeaendert],
  );

  /** Gemessene Größe eines Blocks in der Vorschau — für die Platzhalter der
   *  Karte „Größe" (Framer zeigt bei „Fit Content" die berechnete Höhe grau). */
  function gemessenFuer(id: string | null | undefined): Gemessen | null {
    if (!id) return null;
    for (const r of rechtecke.values()) {
      if (r.id === id) return { breite: r.width, hoehe: r.height };
    }
    return null;
  }
  /** Die gemessene Größe EINES TEILS — der graue Platzhalter im Panel. */
  /** Hat dieser TEIL eigene Kinder? Dann zeigt das Panel seine Layout-Karte
   *  und keine Text-Karte — Framers Regel, am 06.09.2026 am Knopf „Kontakt"
   *  gemessen (Rahmen mit Kind: Layout, ohne Text; Text-Layer: umgekehrt). */
  /** Liegt dieser TEIL in einem Raster? Sein Elternteil steht im gemeldeten
   *  Teilbaum, nicht im Block-Baum — deshalb rechnet das Panel es nicht selbst
   *  aus. Nur dann zeigt die Größe-Karte Spalten- und Zeilen-Span (Framer). */
  function teilImRaster(id: string | null | undefined, feld: string): boolean {
    if (!id) return false;
    const eltern = teilRechtecke.get(`${id}/${feld}`)?.eltern;
    if (!eltern) return false;
    const art = teilRechtecke.get(`${id}/${eltern}`)?.art;
    return art === "grid" || art === "masonry";
  }

  function teilIstRahmen(id: string | null | undefined, feld: string): boolean {
    const art = id ? teilRechtecke.get(`${id}/${feld}`)?.art : null;
    return art != null && RAHMEN_ARTEN.has(art);
  }

  /** Trägt dieser TEIL eigenen Text? Ein Rahmen mit Kindern trägt ihn nicht
   *  (er sitzt im Kind), ein Bild oder Video gar nicht — Framers Regel,
   *  06.09.2026 gemessen. */
  function teilHatText(id: string | null | undefined, feld: string): boolean {
    if (!id) return false;
    const art = teilRechtecke.get(`${id}/${feld}`)?.art;
    if (art === "bild" || art === "video") return false;
    return !(teileJeBlock.get(id) ?? []).some((k) => k.eltern === feld);
  }

  function gemessenFuerTeil(id: string | null | undefined, feld: string): Gemessen | null {
    if (!id) return null;
    const r = teilRechtecke.get(`${id}/${feld}`);
    return r ? { breite: r.width, hoehe: r.height } : null;
  }

  /** Der Rahmen (Spalte) eines Bausteins — für die Ausrichtungsreihe, die
   *  am Baustein in seinen Rahmen schreibt. Optimistisch, mit Rücknahme. */
  function elternFuer(id: string | null | undefined) {
    if (!id) return undefined;
    const knoten = baumBlocks.find((b) => b.id === id);
    if (!knoten) return undefined;
    const vorher = (knoten.settings ?? {}) as Record<string, unknown>;
    return {
      settings: vorher,
      onSettings: (neu: Record<string, unknown>) => {
        setBaumBlocks((liste) => liste.map((b) => (b.id === id ? { ...b, settings: neu } : b)));
        void updateBlock(id, { settings: neu }).then((antwort) => {
          if (antwort.ok) {
            setNeuLaden((n) => n + 1);
            return;
          }
          toast.error(antwort.error);
          setBaumBlocks((liste) => liste.map((b) => (b.id === id ? { ...b, settings: vorher } : b)));
        });
      },
    };
  }
  // --- Fläche und Panel als EIN Werkzeug (Canvas 3/4, 06.09.2026) ---------
  //
  // Im Vorbild nachgemessen: die Griffe auf der Fläche sind die Zeilen des
  // Panels. Wer an einem zieht, schreibt `groesse.<achse>` — dieselbe Zeile,
  // die rechts steht, und live sichtbar, bevor gespeichert wird.
  //
  // Ein Ziehvorgang ist EIN Schritt: währenddessen geht nur die Vorschau mit
  // (`sendeStil`), erst beim Loslassen wird der Wert in den Stand geschrieben.
  // Sonst stünden hundert Zwischenstände im Verlauf, und ⌘Z bräuchte hundert
  // Anschläge für einen Zug.
  const auswahlSettings = useMemo<Record<string, unknown> | null>(() => {
    if (aktiveZeile) return aktiveZeile.settings;
    if (aktiverContainer) {
      return (aktiverContainer.settings ?? {}) as Record<string, unknown>;
    }
    return null;
  }, [aktiveZeile, aktiverContainer]);

  /** Das Rechteck einer Block-ID aus der Meldung der Brücke. */
  const rechteckVon = useCallback(
    (id: string | null | undefined) =>
      id ? ([...rechtecke.values()].find((r) => r.id === id) ?? null) : null,
    [rechtecke],
  );

  /** Der ELTERNTEIL der Auswahl — Framer zeichnet ihn gestrichelt mit. */
  const elternRect = useMemo(() => {
    const id = aktiveZeile?.parentId ?? aktiverContainer?.parent_id ?? null;
    return rechteckVon(id);
  }, [aktiveZeile, aktiverContainer, rechteckVon]);

  /** Die direkten Kinder des gewählten Containers — für die Abstandsmarker. */
  const kinderRects = useMemo(() => {
    if (!aktiverContainer) return [];
    return baumBlocks
      .filter((b) => b.parent_id === aktiverContainer.id)
      .map((b) => rechteckVon(b.id))
      .filter((r): r is NonNullable<typeof r> => r !== null);
  }, [aktiverContainer, baumBlocks, rechteckVon]);

  // `aendereSettings` und `elternFuer` entstehen bei jedem Render neu (sie
  // lesen den laufenden Zustand). Als Abhängigkeit gelesen, kippten die beiden
  // Callbacks unten deshalb bei jedem Tastendruck — und ein Ziehvorgang hinge
  // an einem Rückruf, der sich unter der Hand austauscht. Über eine Ref bleibt
  // die Funktion stabil und der Inhalt trotzdem aktuell (dasselbe Muster wie
  // `stilAktionRef` und `schreibeRef`).
  const aendereSettingsRef = useRef(aendereSettings);
  aendereSettingsRef.current = aendereSettings;
  const elternFuerRef = useRef(elternFuer);
  elternFuerRef.current = elternFuer;

  /** Ein Maß aus einem Griff — live in die Vorschau, beim Loslassen in den
   *  Stand. `fest` ist die einzige ehrliche Antwort auf „gezogen": eine Zahl
   *  in Pixeln, genau die, die danach im Panel steht. */
  const massSetzen = useCallback(
    (achse: "breite" | "hoehe", px: number, fertig: boolean) => {
      const ziel = aktiveZeile ?? aktiverContainer;
      if (!ziel) return;
      const vorher = (aktiveZeile?.settings ??
        aktiverContainer?.settings ??
        {}) as Record<string, unknown>;
      const neu = mitWert(vorher, geraet, ["groesse", achse], {
        modus: "fest",
        wert: px,
      });
      const id = aktiveZeile?.id ?? aktiverContainer?.id ?? null;
      if (!fertig) {
        sendeStil(id, neu, aktiverContainer?.span ?? null);
        return;
      }
      if (aktiveZeile) aendereSettingsRef.current(aktiveZeile.key, neu);
      else if (aktiverContainer) {
        elternFuerRef.current(aktiverContainer.id)?.onSettings(neu);
      }
    },
    [aktiveZeile, aktiverContainer, geraet, sendeStil],
  );

  /** ⎋ auf der Fläche: eine Ebene nach oben (Framers „Select Parent").
   *
   *  Der Weg ist derselbe wie im Ebenen-Baum, nur ohne ihn zu öffnen: vom
   *  Baustein in seine Spalte, von dort in den Abschnitt, von dort ins Nichts
   *  (dann steht der Seiten-Inspektor mit den Breakpoints da — genau wie im
   *  Vorbild, wo das letzte ⎋ auf dem Breakpoint landet). */
  const elternteilWaehlen = useCallback((): boolean => {
    const id = aktiveZeile?.parentId ?? aktiverContainer?.parent_id ?? null;
    if (!id) return false;
    setAktiv(null);
    setContainerId(id);
    setRegionAuswahl(null);
    return true;
  }, [aktiveZeile, aktiverContainer]);

  /** Der Abstand zwischen den Kindern (Framers magenta Gap-Marker). */
  const abstandSetzen = useCallback(
    (px: number, fertig: boolean) => {
      if (!aktiverContainer) return;
      const vorher = (aktiverContainer.settings ?? {}) as Record<string, unknown>;
      const neu = mitWert(vorher, geraet, ["layout_abstand"], px);
      if (!fertig) {
        sendeStil(aktiverContainer.id, neu, aktiverContainer.span ?? null);
        return;
      }
      elternFuerRef.current(aktiverContainer.id)?.onSettings(neu);
    },
    [aktiverContainer, geraet, sendeStil],
  );

  /** Ein Innenabstand aus einem Padding-Marker (Framer: der Strich an der
   *  Innenkante). Er schreibt dieselbe Zeile, die die Layout-Karte zeigt. */
  const paddingSetzen = useCallback(
    (
      seite: "top" | "right" | "bottom" | "left",
      px: number,
      fertig: boolean,
    ) => {
      if (!aktiverContainer) return;
      const vorher = (aktiverContainer.settings ?? {}) as Record<string, unknown>;
      const neu = mitWert(vorher, geraet, [`padding_${seite}`], `${px}px`);
      if (!fertig) {
        sendeStil(aktiverContainer.id, neu, aktiverContainer.span ?? null);
        return;
      }
      elternFuerRef.current(aktiverContainer.id)?.onSettings(neu);
    },
    [aktiverContainer, geraet, sendeStil],
  );

  const regionRect = regionAuswahl
    ? regionRechtecke.get(
        regionAuswahl.teil
          ? `${regionAuswahl.region}/${regionAuswahl.teil}`
          : regionAuswahl.region,
      ) ?? null
    : null;
  const inspektor = regionAuswahl ? (
    <RegionInspektor
      auswahl={regionAuswahl}
      stand={teileStand[regionAuswahl.region]}
      geraet={geraet}
      onWaehle={setRegionAuswahl}
      onVersteckt={regionVersteckt}
      onSperren={regionSperren}
      onVerschiebe={regionVerschiebe}
      onDesign={(u) => {
        setDesignUnterpunkt(u);
        panelSetzen("design");
      }}
      onPfad={(pfad) => {
        if (offen) void schreibeRef.current?.();
        router.push(pfad);
      }}
    />
  ) : aktiverContainer ? (
    <ContainerInspektor
      container={aktiverContainer}
      geschwister={containerGeschwister}
      kinder={containerKinder}
      geraet={geraet}
      sprache={locale}
      gemessen={gemessenFuer(aktiverContainer.id)}
      ankerListe={ankerListe}
      onLiveStil={(neu) => sendeStil(aktiverContainer.id, neu, aktiverContainer.span ?? null)}
      onGeaendert={() => void containerGeaendert()}
    />
  ) : aktiveZeile && teilAuswahl ? (
    // EIN TEIL des Bausteins — die Überschrift, der Absatz, das Bild
    // (06.09.2026). Dasselbe Panel wie für alles andere: ein Teil ist ein
    // Element wie jedes andere, es steht nur in `settings.teile.<feld>`.
    //
    // Kein `eltern` und kein `container`: die Ausrichtungsreihe würde in den
    // RAHMEN schreiben, und der Rahmen eines Teils ist der Baustein selbst —
    // seine Kinder ordnet der Baustein, nicht der Kunde (Wurzel 4).
    <StilInspektor
      settings={teilSettings(aktiveZeile.settings, teilAuswahl.feld)}
      geraet={geraet}
      sprache={locale}
      gemessen={gemessenFuerTeil(aktiveZeile.id, teilAuswahl.feld)}
      textKarte={teilHatText(aktiveZeile.id, teilAuswahl.feld)}
      layout={teilIstRahmen(aktiveZeile.id, teilAuswahl.feld)}
      imRaster={teilImRaster(aktiveZeile.id, teilAuswahl.feld)}
      onSettings={(st) =>
        aendereSettings(
          aktiveZeile.key,
          mitTeil(aktiveZeile.settings, teilAuswahl.feld, st),
        )
      }
      ankerListe={ankerListe}
    />
  ) : aktiveZeile ? (
    // NUR STIL — Framers Style-Panel (Auftrag 05.09.2026). Kein Kopf mit
    // Namen (der steht in den Ebenen), kein Inhaltsformular: Texte werden
    // auf der Fläche getippt, alles andere im Inhalt-Dialog (`InhaltDialog`,
    // über den „Inhalt"-Knopf an der Auswahl und das Kontextmenü).
    <StilInspektor
      settings={aktiveZeile.settings}
      geraet={geraet}
      sprache={locale}
      gemessen={gemessenFuer(aktiveZeile.id)}
      onSettings={(st) => aendereSettings(aktiveZeile.key, st)}
      eltern={elternFuer(aktiveZeile.parentId)}
      ankerListe={ankerListe}
    />
  ) : null;

  return (
    <>
      <FramerSchale<LinkerReiter, RechterReiter>
        dunkel={dunkel}
        // KOPF LINKS — Framer: „Canvas ▾", dann Einfügen, Frame, Text, Bild.
        // Das Canvas-Menü trägt alle Bereiche, die vorher in der
        // Bereichsleiste standen: die Panels wechseln hier, die eigenen
        // Arbeitsbereiche (SEO, Objekte, Regeln …) bleiben Routen.
        kopfLinks={
          <>
            <div className="relative">
              <button
                type="button"
                onClick={() => setCanvasMenue((m) => !m)}
                aria-haspopup="menu"
                aria-expanded={canvasMenue}
                className="flex h-8 items-center gap-1.5 rounded-lg bg-secondary/60 pl-2 pr-2.5 text-[13px] font-semibold transition hover:bg-secondary"
              >
                <Logo heightRem={1} />
                <span>{t("canvas.menue")}</span>
                <Icon icon="ph:caret-down" className="size-3 text-muted-foreground" />
              </button>
              {canvasMenue ? (
                <>
                  <button
                    type="button"
                    aria-label={t("editor.closeMenu")}
                    onClick={() => setCanvasMenue(false)}
                    className="fixed inset-0 z-30 cursor-default"
                  />
                  <ul
                    role="menu"
                    className="absolute left-0 top-9 z-40 w-60 rounded-lg border border-border bg-popover p-1 shadow-xl"
                  >
                    {(
                      [
                        ["hinzufuegen", "panel"],
                        ["vorlagen", "panel"],
                        ["design", "panel"],
                        ["blog", "panel"],
                        ["mediathek", "panel"],
                        ["seo", "route"],
                        ["objekte", "route"],
                        ["regeln", "route"],
                        ["anfragen", "route"],
                        ["widgets", "route"],
                        ["einstellungen", "route"],
                      ] as const
                    ).map(([id, art]) => (
                      <li key={id}>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setCanvasMenue(false);
                            if (art === "panel") {
                              panelSetzen(id);
                              return;
                            }
                            if (offen) void schreibeRef.current?.();
                            router.push(REITER_HREF[id]);
                          }}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition hover:bg-secondary"
                        >
                          <Icon icon={REITER_SYMBOL[id]} className="size-4 text-muted-foreground" />
                          <span className="min-w-0 flex-1 truncate">{t(`reiter.${id}`)}</span>
                          {art === "route" ? (
                            <Icon icon="ph:arrow-square-out" className="size-3.5 text-muted-foreground" />
                          ) : null}
                        </button>
                      </li>
                    ))}
                    <li className="my-1 border-t border-border" />
                    <li>
                      <a
                        href={hilfeUrl("website-baukasten")}
                        target="_blank"
                        rel="noreferrer"
                        role="menuitem"
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition hover:bg-secondary"
                      >
                        <Icon icon="ph:question" className="size-4 text-muted-foreground" />
                        {t("kopf.hilfe")}
                      </a>
                    </li>
                    <li>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          if (offen) void schreibeRef.current?.();
                          router.push("/");
                        }}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition hover:bg-secondary"
                      >
                        <Icon icon="ph:house" className="size-4 text-muted-foreground" />
                        {t("canvas.zumDashboard")}
                      </button>
                    </li>
                  </ul>
                </>
              ) : null}
            </div>
            <span aria-hidden className="mx-1 h-5 w-px bg-border" />
            <KopfKnopf
              icon="ph:plus"
              label={t("canvas.einfuegen")}
              aktiv={panel === "hinzufuegen"}
              onClick={() => panelSetzen(panel === "hinzufuegen" ? "ebenen" : "hinzufuegen")}
            />
            <KopfKnopf
              icon="ph:frame-corners"
              label={t("canvas.layout")}
              onClick={() => {
                setKategorie("layout");
                panelSetzen("hinzufuegen");
              }}
            />
            <KopfKnopf
              icon="ph:text-t"
              label={t("canvas.text")}
              onClick={() => hinzufuegen("rich_text")}
            />
            <KopfKnopf
              icon="ph:image"
              label={t("canvas.bild")}
              onClick={() => {
                setKategorie("medien");
                panelSetzen("hinzufuegen");
              }}
            />
          </>
        }
        // KOPF MITTE — Seite · Sprache · Stand („main"-Chip im Vorbild).
        kopfMitte={
          <>
            <SeitenWahl
              seiten={pages}
              aktiveId={page.id}
              onWahl={(id) => {
                if (id === page.id) return;
                if (offen) void schreibeRef.current?.();
                router.push(`/website/seiten/${id}`);
              }}
            />
            <SprachWahl
              sprachen={websiteSprachen}
              gefuehrt={gefuehrteSprachen}
              aktiv={locale}
              standard={standardSprache}
              onWahl={(l) => spracheWechseln(l)}
              verwaltenHref="/website/einstellungen/sprachen"
            />
            <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] text-muted-foreground">
              <SpeicherHaken stand={stand} />
            </span>
          </>
        }
        // KOPF RECHTS — Verlauf · Übersetzen · ▷ Vorschau · Veröffentlichen.
        kopfRechts={
          <>
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
            <VerlaufKnoepfe
              kannZurueck={verlauf.kannZurueck}
              kannVor={verlauf.kannVor}
              onZurueck={() => springe("zurueck")}
              onVor={() => springe("vor")}
            />
            {gefuehrteSprachen.length > 1 ? (
              <KopfKnopf
                icon={uebersetztLaeuft ? "ph:circle-notch" : "ph:translate"}
                label={t("uebersetzung.starten")}
                onClick={() => void seiteUebersetzen()}
                disabled={uebersetztLaeuft}
              />
            ) : null}
            <KopfKnopf
              icon="ph:info"
              label={t("seiten.einstellungen")}
              onClick={() => setInfoOffen(true)}
            />
            <WebsiteAnsehen pages={pages} liveDomain={liveDomain} />
            <VeroeffentlichenKnopf pages={pages} />
          </>
        }
        // LINKS — Pages · Layers · Assets. Ein anderes Panel (Einfügen,
        // Vorlagen, Design) steht ÜBER den Reitern mit eigenem Kopf und ✕.
        linkeReiter={[
          { id: "seiten", label: t("reiter.seiten") },
          { id: "ebenen", label: t("reiter.ebenen") },
          { id: "mediathek", label: t("canvas.assets") },
        ]}
        linkerReiter={
          panel === "seiten" ? "seiten" : panel === "mediathek" ? "mediathek" : "ebenen"
        }
        onLinkerReiter={(id) => {
          setVorlageAnsehen(null);
          panelSetzen(id);
        }}
        linkesPanel={
          panel === "hinzufuegen" || panel === "vorlagen" || panel === "design" ? (
            <div className="flex min-h-full flex-col">
              <div className="flex items-center gap-1 border-b border-border px-3 py-2">
                {panel === "design" && designUnterpunkt ? (
                  <button
                    type="button"
                    onClick={() => setDesignUnterpunkt(null)}
                    aria-label={t("kopf.panelZurueck")}
                    className="rounded p-1 text-muted-foreground transition hover:text-foreground"
                  >
                    <Icon icon="ph:caret-left" className="size-4" />
                  </button>
                ) : null}
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
                  {panel === "design" && designUnterpunkt
                    ? menueBeschriftung(t, designUnterpunkt)
                    : t(`reiter.${panel}`)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setVorlageAnsehen(null);
                    panelSetzen("ebenen");
                  }}
                  aria-label={t("editor.schliessen")}
                  className="rounded p-1 text-muted-foreground transition hover:text-foreground"
                >
                  <Icon icon="ph:x" className="size-4" />
                </button>
              </div>
              {panel === "design" && !designUnterpunkt ? (
                // Die sieben Design-Unterpunkte als Liste — ohne `href`, damit
                // sie das Panel wechseln statt zu navigieren (wie vorher in
                // der Menüspalte der alten Schale).
                <MenueSpalte
                  titel={t("reiter.design")}
                  eintraege={(REITER_MENUE.design ?? []).map((e) =>
                    e.art === "ziel" ? { art: "ziel" as const, id: e.id } : e,
                  )}
                  aktiv={null}
                  beschriften={(id) => menueBeschriftung(t, id)}
                  onWaehle={(id) => setDesignUnterpunkt(id as DesignUnterseite)}
                />
              ) : null}
              <div className="min-h-0 flex-1">{seitenleiste}</div>
            </div>
          ) : panel === "mediathek" ? (
            <Mediathek modus="verwaltung" onSchliesse={() => panelSetzen("ebenen")} />
          ) : (
            seitenleiste
          )
        }
        // DIE FLÄCHE — Kamera, Rahmen je Breakpoint, untere Leiste.
        flaeche={
          <Buehne
            steuerung={kamera}
            sichtbar={sichtbareRahmen}
            aktiv={geraet}
            onAktiv={setGeraet}
            onRahmenHinzu={(g) => rahmenSetzen(g, true)}
            onRahmenWeg={(g) => rahmenSetzen(g, false)}
            dunkel={dunkel}
            onDunkel={dunkelSetzen}
            onPlay={() => {
              if (!token) return;
              const url =
                `${process.env.NEXT_PUBLIC_BUILDER_URL}/render/${encodeURIComponent(page.id)}?` +
                new URLSearchParams({ token, locale }).toString();
              window.open(url, "_blank", "noopener");
            }}
            hinweis={
              !aktiv && !containerId && !regionAuswahl ? t("arbeitsflaeche.anstupser") : null
            }
            rahmenInhalt={(g, istAktiv) => {
              const basis = process.env.NEXT_PUBLIC_BUILDER_URL;
              if (!basis || !token) {
                return (
                  <div className="flex h-full items-center justify-center text-sm text-neutral-500">
                    {tokenFehler ? t("vorschau.fehler") : t("vorschau.laedt")}
                  </div>
                );
              }
              const params = new URLSearchParams({ token, locale, v: String(neuLaden) });
              if (istAktiv) params.set("edit", "1");
              const url =
                vorlageAnsehen && vorlageToken && istAktiv
                  ? `${basis}/render/vorlage/${encodeURIComponent(vorlageAnsehen)}?` +
                    new URLSearchParams({ token: vorlageToken, slug: "", locale }).toString()
                  : `${basis}/render/${encodeURIComponent(page.id)}?${params.toString()}`;
              return (
                <>
                  <iframe
                    ref={istAktiv ? iframeRef : undefined}
                    src={url}
                    title={`${t("vorschau.titel")} · ${t(`canvas.geraet.${g}`)}`}
                    onLoad={istAktiv ? iframeBereit : undefined}
                    className="absolute inset-0 h-full w-full border-0 bg-white"
                    style={{ width: RAHMEN_BREITE[g] }}
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                  />
                  {istAktiv ? (
                    <FlaechenOverlay
                      zeilen={zeilen}
                      rechtecke={rechtecke}
                      aktiv={aktiv}
                      containerId={containerId}
                      regionRect={regionRect}
                      elternRect={elternRect}
                      teilRect={
                        aktiveZeile && teilAuswahl
                          ? (teilRechtecke.get(
                              `${aktiveZeile.id}/${teilAuswahl.feld}`,
                            ) ?? null)
                          : null
                      }
                      auswahlSettings={auswahlSettings}
                      kinderRects={kinderRects}
                      onMass={massSetzen}
                      onAbstand={abstandSetzen}
                      onPadding={paddingSetzen}
                      onElternteil={elternteilWaehlen}
                      flaechenZug={flaechenZug}
                      onFlaechenZug={(key, stelle) => {
                        setFlaechenZug(null);
                        if (stelle == null) return;
                        nurStilRef.current = false;
                        setZeilen((z) => {
                          const von = z.findIndex((r) => r.key === key);
                          if (von < 0) return z;
                          const kopie = [...z];
                          const [bewegt] = kopie.splice(von, 1);
                          if (!bewegt) return z;
                          // Nach dem Herausnehmen rutscht alles dahinter eine
                          // Stelle vor — sonst landet der Baustein eine Position
                          // zu weit unten (derselbe Fehler wie beim Baum-Zug).
                          const ziel = von < stelle ? stelle - 1 : stelle;
                          const nachbar = kopie[Math.min(ziel, kopie.length - 1)];
                          kopie.splice(Math.max(0, Math.min(ziel, kopie.length)), 0, {
                            ...bewegt,
                            // In die Spalte des neuen Nachbarn: sonst stünde er
                            // in der Liste an der richtigen Stelle und auf der
                            // Seite in der alten Spalte (Wurzel 1).
                            parentId: nachbar?.parentId ?? bewegt.parentId,
                          });
                          return kopie;
                        });
                        protokoll("klick", "Baustein auf der Fläche verschoben", {
                          key,
                          stelle,
                        });
                      }}
                      ueberfahren={ueberfahren}
                      zeiger={zeiger}
                      menu={menu}
                      geraet={geraet}
                      zieht={zieht}
                      onAbwurfInSpalte={(spalteId, stelle) => {
                        if (!zieht) return;
                        hinzufuegen(
                          zieht,
                          zieht === "image" && ziehtBild ? { url: ziehtBild } : {},
                          spalteId,
                          stelle,
                        );
                        setZieht(null);
                        setZiehtBild(null);
                        panelSetzen("ebenen");
                      }}
                      onAbwurf={(position) => {
                        if (!zieht) return;
                        hinzufuegen(
                          zieht,
                          zieht === "image" && ziehtBild ? { url: ziehtBild } : {},
                          null,
                          position,
                        );
                        setZieht(null);
                        setZiehtBild(null);
                        panelSetzen("ebenen");
                      }}
                      onMenu={setMenu}
                      onWaehle={setAktiv}
                      onInhalt={(key) => {
                        setAktiv(key);
                        setInhaltOffen(key);
                      }}
                      onDesign={(key) => {
                        setAktiv(key);
                        setRechterReiter("style");
                      }}
                      onDuplizieren={dupliziere}
                      onEinfuegenAn={(position) => {
                        setEinfuegenVor(position);
                        panelSetzen("hinzufuegen");
                      }}
                      onLayoutEinfuegen={(bs, position) => {
                        void layoutEinfuegen(bs, position);
                      }}
                      onVerschiebe={verschiebe}
                      onEntferne={entferne}
                      onVersteckt={aendereVersteckt}
                    />
                  ) : (
                    // Ein nicht aktiver Rahmen zeigt die Seite in seiner
                    // Breite; ein Klick macht ihn zum aktiven — dann kommen
                    // Auswahl-Schicht und Brücke dorthin.
                    <button
                      type="button"
                      aria-label={t(`canvas.geraet.${g}`)}
                      onClick={() => setGeraet(g)}
                      className="absolute inset-0 cursor-default bg-transparent"
                    />
                  )}
                </>
              );
            }}
          />
        }
        // RECHTS — Agent · Style. Style zeigt die Auswahl oder, ohne Auswahl,
        // die Seite mit ihren Breakpoints (Framer §0.12).
        rechteReiter={[
          { id: "agent", label: t("canvas.agent.titel") },
          { id: "style", label: t("canvas.style") },
        ]}
        rechterReiter={rechterReiter}
        onRechterReiter={setRechterReiter}
        rechtesPanel={
          rechterReiter === "agent" ? (
            <AgentReiter />
          ) : (
            inspektor ?? (
              <SeitenInspektor
                seite={page}
                sprachen={page.languages ?? gefuehrteSprachen}
                sichtbar={sichtbareRahmen}
                aktiv={geraet}
                hoehen={kamera.hoehen}
                branding={branding}
                onAktiv={setGeraet}
                onRahmen={rahmenSetzen}
                onEinstellungen={() => setInfoOffen(true)}
                onDesign={(u) => {
                  setDesignUnterpunkt(u);
                  panelSetzen("design");
                }}
                onVorlagen={() => panelSetzen("vorlagen")}
              />
            )
          )
        }
        ueberlagerung={
          panel === "blog" ? (
            <GrossPanel
              titel={t("reiter.blog")}
              onZu={() => panelSetzen("ebenen")}
              texte={{
                panelEinklappen: t("kopf.panelEinklappen"),
                panelAusklappen: t("kopf.panelAusklappen"),
                panelBreite: t("kopf.panelBreite"),
                panelHilfe: t("kopf.panelHilfe"),
                panelZurueck: t("kopf.panelZurueck"),
              }}
            >
              <BlogPanel
                punkt={blogPunkt}
                onPunkt={setBlogPunkt}
                beitraege={pages.filter((p) => p.page_type === "post")}
                seiten={pages}
                einstellungen={blogEinstellungen}
                feldKonfig={blogFeldKonfig}
                eigeneFelder={blogEigeneFelder}
                liveDomain={liveDomain}
                oeffneBeitragId={beitragWunsch}
                onNeuLaden={() => router.refresh()}
              />
            </GrossPanel>
          ) : null
        }
      />
      {inhaltOffen
        ? (() => {
            const zeile = zeilen.find((z) => z.key === inhaltOffen);
            if (!zeile) return null;
            const meta = abschnittFuer(zeile.typ);
            return (
              <InhaltDialog
                typ={zeile.typ}
                titel={meta ? t(`abschnitte.${meta.label}`) : t("editor.unbekannterAbschnitt")}
                content={zeile.content}
                settings={zeile.settings}
                sprache={locale}
                onChange={(c) => aendere(zeile.key, c)}
                onSettings={(st) => aendereSettings(zeile.key, st)}
                onSprache={(l) => spracheWechseln(l as Locale)}
                onZu={() => setInhaltOffen(null)}
              />
            );
          })()
        : null}
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
