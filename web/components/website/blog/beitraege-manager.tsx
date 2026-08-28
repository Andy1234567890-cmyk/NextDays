"use client";

// Die BEITRAGSVERWALTUNG — übernommen aus dem Agentur-CMS
// (`cms/apps/admin/src/pages/CollectionManager.tsx`, 1.472 Z.) und angepasst.
//
//     [+] [⇅ Manuell] [⚟ Alle] [⌕]                          [⋮] [Neu]
//     ⠿ │ Titel            │ Status │ Titelbild │ Datum │ Aufrufe
//     ⠿ │ Die alte Mühle   │ Live ▾ │ ▣         │ 25.08 │ 128
//     ⠿ │ └ Kapitel 1      │ Live ▾ │ ▣         │ 26.08 │ 12
//
// WAS BEIM ÜBERNEHMEN GEÄNDERT WURDE UND WARUM
// ============================================
// 1. KEINE ROUTE, sondern ein Panel. Das Vorbild ist eine Vite-SPA mit
//    `useParams`/`useSearchParams`; wir liegen als Großpanel über dem offenen
//    Seitenentwurf. Ein Seitenwechsel würde hier den Entwurf, das
//    Vorschau-Token und die Auswahl verwerfen.
// 2. KEINE KUNDENDEFINIERTEN FELDER. Das Vorbild führt beliebige Sammlungen
//    mit eigenem Schema; ein Blogbeitrag hat FESTE Felder (Titel, Anriss,
//    Titelbild, Autor, Schlagwörter, Datum, Text). Aus `FieldDef[]` wird
//    deshalb eine feste Spaltenliste — die Tabellen-Mechanik bleibt dieselbe.
// 3. NATIVES DRAG & DROP statt `dnd-kit`. Für das Ziehen von Spalten und
//    Zeilen reichen die HTML5-Ereignisse; eine Bibliothek nur dafür wären
//    50 kB für zwei Handgriffe.
// 4. SYMBOLE aus Iconify statt `lucide-react`, BESCHRIFTUNGEN aus `next-intl`
//    statt dem eigenen i18n-Modul: dieses Dashboard spricht 24 Sprachen.
// 5. Die Bedienelemente kommen aus `@nextdays/ui` — dieselbe shadcn-Basis wie
//    im Vorbild, nur unsere Fassung.
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import { Switch } from "@nextdays/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@nextdays/ui/select";
import { cn } from "@nextdays/ui/utils";

import {
  type Beitrag,
  type EigenesFeld,
  type Page,
  deletePage,
  duplicatePage,
  getPost,
  publishPage,
  resetPostFieldConfig,
  setPostFieldConfig,
  reorderPosts,
  setPageDraft,
  unpublishPage,
  updatePage,
  updatePost,
} from "@/lib/site-pages";

import { BeitragDialog, LEERE_FELDER, LEERER_BEITRAG } from "./beitrag-dialog";
import { FeldKonfigPopover } from "./feld-konfig-popover";
import { type FeldKonfig, konfigVon } from "./felder";
import { LoeschenBestaetigen } from "./loeschen-bestaetigen";
import { slugSaeubern } from "./slug";
import {
  type Filter,
  type Sortierung,
  trifftZu,
  vergleiche,
} from "./filter";
import { FilterChips, FilterMenue, SortierPanel } from "./filter-leiste";
import { type Spalte, spaltenListe } from "./spalten";
import { ZelleBearbeiten } from "./zelle-bearbeiten";

const ordnungSchluessel = "blog:spaltenordnung";
const breitenSchluessel = "blog:spaltenbreiten";

const STANDARD_BREITE = 160;
const MIN_BREITE = 80;
/** Breite der ersten Spalte: Ziehgriff + Kontrollkästchen.
 *
 *  Gerechnet und nicht geschätzt — bei 40 px lief der Inhalt über und das
 *  Kästchen wurde vom Spaltentrenner ABGESCHNITTEN (rechts offen, im
 *  Bildausschnitt vom 28.08.2026 deutlich zu sehen):
 *
 *      8 Padding links + 16 Griff + 4 Lücke + 14 Kästchen + 8 Padding rechts
 *      = 50
 *
 *  Der Fehler war aus `getBoundingClientRect().x` NICHT ablesbar: der Anfang
 *  jedes Kästchens lag korrekt bei 281, nur das Ende wurde weggeschnitten.
 *  Zweimal „behoben" gemeldet, weil ich der Messung mehr geglaubt habe als
 *  dem Bild — die Lehre steht hier, damit die Zahl beim nächsten Umbau nicht
 *  wieder auf einen glatten Wert gerundet wird. */
const GRIFF_BREITE = 8 + 16 + 4 + 14 + 8;
const TITEL_BREITE = 288;
const STATUS_BREITE = 132;

/** Gemerkte Spaltenreihenfolge und -breite.
 *
 *  Beides ist eine Ansichts-Entscheidung des einzelnen Bearbeiters und gehört
 *  deshalb in den Browser. Jeder Zugriff ist eingepackt: im privaten Fenster
 *  wirft `localStorage`. */
function ladeOrdnung(): string[] | null {
  try {
    const roh = localStorage.getItem(ordnungSchluessel);
    const gelesen: unknown = roh ? JSON.parse(roh) : null;
    return Array.isArray(gelesen) ? (gelesen as string[]) : null;
  } catch {
    return null;
  }
}

function merkeOrdnung(ordnung: string[]): void {
  try {
    localStorage.setItem(ordnungSchluessel, JSON.stringify(ordnung));
  } catch {
    /* privates Fenster / Speicher voll — die Ansicht funktioniert weiter */
  }
}

function ladeBreiten(): Record<string, number> {
  try {
    const roh = localStorage.getItem(breitenSchluessel);
    const gelesen: unknown = roh ? JSON.parse(roh) : null;
    return gelesen && typeof gelesen === "object"
      ? (gelesen as Record<string, number>)
      : {};
  } catch {
    return {};
  }
}

function merkeBreiten(breiten: Record<string, number>): void {
  try {
    localStorage.setItem(breitenSchluessel, JSON.stringify(breiten));
  } catch {
    /* siehe oben */
  }
}

/** Der Zustand eines Beitrags — DREI, nicht zwei.
 *
 *  „Entwurf" (`is_draft`) ist etwas anderes als „noch nicht veröffentlicht":
 *  der eine wird beim Veröffentlichen der Website absichtlich übersprungen,
 *  der andere ist nur noch nicht dran (0443). Das Vorbild kennt dafür
 *  draft/published/archived — dieselbe Dreiteilung mit unseren Namen. */
export function zustandVon(beitrag: Page): "entwurf" | "bereit" | "live" {
  if (beitrag.is_draft) return "entwurf";
  return beitrag.is_published ? "live" : "bereit";
}

/** Der Textauszug eines Beitragstextes für die Zelle.
 *
 *  Im Vorbild läuft hier ein TipTap-JSON-Baum flach; bei uns ist der Wert
 *  bereits gesäubertes HTML (nh3 beim Speichern). In der Zelle interessiert
 *  nur, WAS drinsteht — die Auszeichnung würde die Zeilenhöhe sprengen. */
/** Der Wert einer Zelle als reiner TEXT — für die Vorlesefunktion.
 *
 *  WARUM DAS SEIN MUSS
 *  ===================
 *  Im Vorbild heisst jede Zelle nach Feld UND Wert: „Industry: Digital
 *  Marketing", „Slug: dazzle" (am 28.08.2026 aus dem Barrierefreiheitsbaum
 *  abgelesen). Bei uns hiess jede Zelle nur nach ihrer SPALTE — bei sechs
 *  Beiträgen hörte man also sechsmal „Client" und erfuhr nie, welcher. Eine
 *  Tabelle, deren Zellen alle gleich heissen, ist für Screenreader eine Wand.
 *
 *  Getrennt von `Zellwert`, weil das eine JSX liefert und das andere Text.
 *  Beide lesen denselben Wert aus derselben Zeile — wer hier einen Fall
 *  ergänzt, ergänzt ihn dort auch. */
function zellText(
  spalte: Spalte,
  beitrag: Page,
  datum: (iso: string) => string,
  leerText: string,
  jaNein: (ja: boolean) => string,
  bilderText: (anzahl: number) => string,
): string {
  const p = beitrag as unknown as Record<string, unknown>;
  const roh = (() => {
    // Ein EIGENES Feld steht nicht in der Zeile, sondern in `custom` (0485).
    if (spalte.eigen) return beitragCustom(beitrag)[spalte.eigen.feld_key] ?? null;
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
        return beitrag.view_count;
      case "show_on_homepage":
        return beitrag.show_on_homepage;
      default:
        return p[spalte.key] ?? null;
    }
  })();

  switch (spalte.art) {
    case "schalter":
      return jaNein(Boolean(roh));
    case "zahl":
      return String(roh ?? 0);
    case "datum":
      return typeof roh === "string" && roh ? datum(roh) : leerText;
    case "galerie":
      return bilderText(Array.isArray(roh) ? roh.length : 0);
    case "bild":
      // Die Adresse vorzulesen hilft niemandem — die Aussage ist „da ist ein
      // Bild" oder „da ist keines".
      return bilderText(roh ? 1 : 0);
    case "liste":
      return Array.isArray(roh) && roh.length > 0
        ? roh.join(", ")
        : leerText;
    default: {
      const text = typeof roh === "string" ? textAuszug(roh, 120) : "";
      return text || leerText;
    }
  }
}

/** Die Werte der eigenen Felder EINER Zeile (0485).
 *
 *  Immer ein Objekt: der Server liefert `{}` bei einer leeren Zeile, aber eine
 *  ältere Antwort aus dem Cache kann `undefined` tragen. Ein `?? {}` an jeder
 *  Lesestelle wäre dieselbe Zeile fünfmal. */
function beitragCustom(p: Page): Record<string, unknown> {
  return p.custom ?? {};
}

/** Der Hintergrund EINER Tabellenzelle — deckend, immer.
 *
 *  WARUM DAS EINE FUNKTION IST UND KEIN DECKUNGSGRAD
 *  =================================================
 *  Die ersten zwei Spalten sind angeheftet (`position: sticky`). Hinter einer
 *  stehenden Zelle liegt bei waagerechtem Scroll der weggescrollte Inhalt —
 *  nicht die Zeile, denn die scrollt mit. Eine angeheftete Zelle MUSS deshalb
 *  ihren eigenen, voll deckenden Hintergrund malen.
 *
 *  Vorher stand der Zustand als Deckungsgrad an der Zelle
 *  (`group-hover:bg-secondary/30`) und schlug die deckende Grundfarbe
 *  (`bg-background`) in der Klassenreihenfolge. Gemessen: 30 % Deckung. In der
 *  eingefrorenen Titelspalte stand dadurch beim Ueberfahren die Autorenspalte
 *  von 3 750 px weiter rechts MITTEN IM TITEL („Wi**Die alte Muehle am
 *  Fjord**anine Staud", 28.08.2026).
 *
 *  Umgekehrt trug die AUSWAHL ihre Tönung nur an der `<tr>`. Die angehefteten
 *  Zellen blieben deckend weiss — die Auswahl war also genau in den zwei
 *  Spalten unsichtbar, die immer stehen: Kästchen und Titel.
 *
 *  Beides hat dieselbe Wurzel: der Zustand gehoerte an die ZEILE, gemalt wird
 *  aber in der ZELLE. Deshalb faerbt jede Zelle sich selbst, und zwar mit
 *  fertig gemischten Farben (`--tabelle-zeile-*` in `globals.css`), in denen
 *  ein Alpha-Wert gar nicht mehr vorkommen kann.
 *
 *  `ueberfahren` steht nur, wenn die Zeile NICHT gewaehlt ist: sonst schlaege
 *  der Mauszeiger die Auswahl, und wer eine Sammelaktion vorbereitet, saehe
 *  ausgerechnet die Zeile unter der Maus als nicht gewaehlt. */
function zellenGrund(gewaehlt: boolean, kind: boolean): string {
  if (gewaehlt) return "bg-(--tabelle-zeile-gewaehlt)";
  return kind
    ? "bg-(--tabelle-zeile-kapitel) group-hover:bg-(--tabelle-zeile-kapitel-ueberfahren)"
    : "bg-background group-hover:bg-(--tabelle-zeile-ueberfahren)";
}

function textAuszug(wert: string | null, max = 90): string {
  if (!wert) return "";
  const text = wert
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

/** Ein ziehbarer, breitenveränderlicher Spaltenkopf.
 *
 *  Im Vorbild macht das `dnd-kit`; hier reichen die HTML5-Ereignisse. Nur die
 *  BESCHRIFTUNG ist der Ziehgriff — der Breitengriff an der rechten Kante
 *  bleibt frei, sonst startete jeder Breitenzug auch einen Spaltenzug. */
function KopfZelle({
  spalte,
  breite,
  aktiv,
  onZiehStart,
  onZiehEnde,
  onAblegen,
  onBreite,
  onKontext,
  breiteLabel,
  onKonfig,
  konfigLabel,
}: {
  spalte: Spalte;
  breite: number;
  aktiv: boolean;
  onZiehStart: () => void;
  onZiehEnde: () => void;
  onAblegen: (von: string) => void;
  onBreite: (e: React.PointerEvent) => void;
  onKontext?: (x: number, y: number) => void;
  breiteLabel: string;
  /** Das Feld konfigurieren (0481). Fehlt bei Systemspalten — `Aufrufe` und
   *  `Erstellt` haben nichts einzustellen. */
  onKonfig?: () => void;
  konfigLabel: string;
}) {
  const [ueber, setUeber] = useState(false);
  return (
    <th
      style={{ width: breite, minWidth: breite, maxWidth: breite }}
      onDragOver={(e) => {
        e.preventDefault();
        setUeber(true);
      }}
      onDragLeave={() => setUeber(false)}
      onDrop={(e) => {
        e.preventDefault();
        setUeber(false);
        const von = e.dataTransfer.getData("text/spalte");
        if (von) onAblegen(von);
      }}
      onContextMenu={
        onKontext
          ? (e) => {
              e.preventDefault();
              onKontext(e.clientX, e.clientY);
            }
          : undefined
      }
      className={cn(
        "group/kopf relative whitespace-nowrap border-b border-r border-border px-5 py-3.5 font-normal transition-colors",
        aktiv && "opacity-30",
        ueber && !aktiv
          ? "border-l-2 border-l-(--brand)"
          : "border-l-2 border-l-transparent",
      )}
    >
      <span
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("text/spalte", spalte.key);
          e.dataTransfer.effectAllowed = "move";
          onZiehStart();
        }}
        onDragEnd={onZiehEnde}
        className="block cursor-grab truncate active:cursor-grabbing"
      >
        {spalte.label}
      </span>
      {/* Der Konfig-Knopf (Framer C1: Klick auf den Feldnamen öffnet das
          Popover). Er erscheint beim Überfahren — dauerhaft sichtbar wäre er
          ein Symbol je Spalte, das bei zwölf Spalten den Kopf zumüllt. */}
      {onKonfig ? (
        <button
          type="button"
          aria-label={konfigLabel}
          title={konfigLabel}
          onClick={(e) => {
            e.stopPropagation();
            onKonfig();
          }}
          className="absolute right-3 top-1/2 z-10 inline-flex size-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground opacity-0 transition hover:bg-secondary hover:text-foreground focus-visible:opacity-100 group-hover/kopf:opacity-100"
        >
          <Icon icon="ph:sliders-horizontal" className="size-3.5" />
        </button>
      ) : null}
      <span
        role="separator"
        aria-label={breiteLabel}
        aria-orientation="vertical"
        onPointerDown={onBreite}
        className="absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize touch-none hover:bg-(--brand)/40"
      />
    </th>
  );
}

/** Rechtsklick auf einen Spaltenkopf.
 *
 *  Im Vorbild stehen hier Name, Beschreibung und „Bezogen auf" — Einstellungen
 *  eines KUNDENDEFINIERTEN Feldes. Ein Blogbeitrag hat feste Felder: sein Titel
 *  heißt Titel, und woraus die Adresse entsteht, ist keine Wahl. Übrig bleibt,
 *  was auch dort das Häufigste ist: die Spalte wegnehmen oder nach vorn holen.
 *  Ein Popover mit einem Namensfeld, das nichts ändern kann, wäre eine
 *  Attrappe. */
function SpaltenMenue({
  spalte,
  x,
  y,
  onSchliessen,
  onAusblenden,
  onNachVorn,
}: {
  spalte: Spalte;
  x: number;
  y: number;
  onSchliessen: () => void;
  onAusblenden: () => void;
  onNachVorn: () => void;
}) {
  const t = useTranslations("website");
  // Der Kasten darf nicht aus dem Fenster laufen.
  const links = Math.min(x, (globalThis.innerWidth || 1280) - 230);
  const oben = Math.min(y, (globalThis.innerHeight || 800) - 140);
  return (
    <>
      <button
        type="button"
        aria-label={t("blog.cm.close")}
        onMouseDown={onSchliessen}
        className="fixed inset-0 z-40 cursor-default"
      />
      <div
        style={{ left: links, top: oben }}
        className="fixed z-50 w-56 rounded-(--radius) border border-border bg-background py-1 shadow-xl"
      >
        <p className="truncate px-3 py-1.5 text-xs text-muted-foreground">
          {spalte.label}
        </p>
        <button
          type="button"
          onClick={() => {
            onNachVorn();
            onSchliessen();
          }}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-secondary/60"
        >
          <Icon icon="ph:arrow-line-left" className="size-4" />
          {t("blog.cm.nachVorn")}
        </button>
        <button
          type="button"
          onClick={() => {
            onAusblenden();
            onSchliessen();
          }}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-secondary/60"
        >
          <Icon icon="ph:eye-slash" className="size-4" />
          {t("blog.cm.ausblenden")}
        </button>
      </div>
    </>
  );
}

export function BeitraegeManager({
  beitraege,
  feldKonfig,
  eigeneFelder,
  liveDomain,
  oeffneBeitragId,
  onNeuLaden,
}: {
  /** Die Beiträge (Seiten mit `page_type = "post"`). Sie kommen vom Editor,
   *  der die Seitenliste ohnehin geladen hat — ein eigener Abruf wäre ein
   *  zweiter Weg an dieselben Zeilen. */
  beitraege: Page[];
  /** Die gespeicherten Feld-Abweichungen (0481). NUR Abweichungen: die Vorgabe
   *  eines Feldes ohne Eintrag steht im Katalog. */
  feldKonfig: readonly FeldKonfig[];
  /** Die EIGENEN Felder dieses Betriebs (0485). Sie werden zu Spalten. */
  eigeneFelder: readonly EigenesFeld[];
  /** Die verbundene Live-Domain — der Dialog zeigt damit die GANZE Adresse
   *  unter dem Slug. */
  liveDomain: string | null;
  /** Der Beitrag, der beim Ankommen geöffnet wird (`?beitrag=<id>`). */
  oeffneBeitragId?: string | null;
  onNeuLaden: () => void;
}) {
  const t = useTranslations("website");
  const format = useFormatter();
  const router = useRouter();
  const [laeuft, start] = useTransition();

  // --- Die Rückfrage vor dem Löschen ---------------------------------------
  //: Vorher löschte sowohl das Zeilenmenü als auch die Sammelleiste SOFORT.
  //: Ein Fehlklick neben „Duplizieren" nahm damit einen Beitrag mit Text,
  //: Bildern und Adresse mit; ein Rückgängig gibt es im Blog nicht. `titel`
  //: ist nur bei EINEM Beitrag gesetzt — bei einer Auswahl zählt die Anzahl.
  const [loeschFrage, setLoeschFrage] = useState<{
    ids: string[];
    titel: string | null;
  } | null>(null);

  // Der offene Beitrag samt geladenen Feldern. Die Liste trägt nur, was in der
  // Tabelle steht; Text und SEO holt der Dialog beim Öffnen nach.
  const [offen, setOffen] = useState<{ page: Page; felder: Beitrag } | null>(null);

  const [suche, setSuche] = useState("");
  const [sucheOffen, setSucheOffen] = useState(false);
  // --- Sortierung nach BELIEBIGEM Feld (Framer B4) -------------------------
  //: Vorher vier feste Vorgaben (manuell/neueste/aelteste/Titel). Bei 34
  //: Spalten hiess das: nach 30 davon liess sich nicht sortieren.
  //: `entwurf` ist der Stand, den die Tabelle als Vorschau zeigt;
  //: `angewandt` der gespeicherte. Die Asymmetrie zum Filter ist Absicht
  //: (Analyse G).
  const [sortEntwurf, setSortEntwurf] = useState<Sortierung>({
    key: "manuell",
    richtung: "auf",
  });
  const [sortAngewandt, setSortAngewandt] = useState<Sortierung>({
    key: "manuell",
    richtung: "auf",
  });
  // --- Filter nach BELIEBIGEM Feld (Framer B5) -----------------------------
  //: Mehrere gleichzeitig, UND-verknuepft, jeder als Chip mit `×`. Vorher gab
  //: es genau einen (Status).
  const [filter, setFilter] = useState<readonly Filter[]>([]);
  const [gezogeneZeile, setGezogeneZeile] = useState<string | null>(null);
  const [sichtbar, setSichtbar] = useState<Record<string, boolean>>({});
  const [ordnung, setOrdnung] = useState<string[]>([]);
  const [breiten, setBreiten] = useState<Record<string, number>>({});
  const [gezogeneSpalte, setGezogeneSpalte] = useState<string | null>(null);
  const [spaltenSuche, setSpaltenSuche] = useState("");
  const [kopfMenue, setKopfMenue] = useState<{
    key: string;
    x: number;
    y: number;
  } | null>(null);
  // --- Das Zeilenmenue (Framer: Rechtsklick auf die Zeile) ------------------
  //: Ein Zustand fuer BEIDE Wege — Rechtsklick und der `⋯`-Knopf. Vorher hatte
  //: der Knopf sein eigenes Popover und der Rechtsklick gar nichts; zwei Wege
  //: mit zwei Menuebauten waeren zwei Wahrheiten darueber, was an einer Zeile
  //: moeglich ist (Wurzel 2).
  const [zeilenMenue, setZeilenMenue] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);

  // --- Auswahl (Framer A4/B9) ----------------------------------------------
  //: Die angehakten Zeilen. Ein Set und keine Liste: das Umschalten einer
  //: einzelnen Zeile ist der häufigste Vorgang, und `has` ist dafür der
  //: richtige Zugriff.
  const [gewaehlt, setGewaehlt] = useState<ReadonlySet<string>>(new Set());

  // --- Inline-Bearbeitung (Framer B8a) -------------------------------------
  //: Welche Zelle ausgewählt bzw. offen ist. `zeile` ist die Beitrags-ID,
  //: `spalte` der Feldschlüssel — zusammen adressieren sie genau eine Zelle.
  const [zelle, setZelle] = useState<{
    zeile: string;
    spalte: string;
    offen: boolean;
  } | null>(null);

  // --- Feldkonfiguration (Framer C1) ---------------------------------------
  //: Welches Feld gerade sein Popover offen hat.
  const [konfigFeld, setKonfigFeld] = useState<string | null>(null);
  //: Der lokale Stand der Konfiguration. Er folgt der Eigenschaft, wird beim
  //: Ändern aber sofort vorausgesetzt — sonst springt jedes Segment zurück,
  //: bis der Server geantwortet hat.
  const [konfig, setKonfig] = useState<readonly FeldKonfig[]>(feldKonfig);
  useEffect(() => setKonfig(feldKonfig), [feldKonfig]);

  const alleSpalten = useMemo(
    () => spaltenListe(t, konfig, eigeneFelder),
    [t, konfig, eigeneFelder],
  );

  // Anfangszustand: alle Spalten an, gemerkte Reihenfolge zuerst, neue Spalten
  // hinten dran. Eine gespeicherte Ordnung darf eine später hinzugekommene
  // Spalte nicht verschlucken — sonst fehlt sie in der Tabelle, und niemand
  // sucht die Ursache im Browser-Speicher.
  useEffect(() => {
    const an: Record<string, boolean> = {};
    for (const s of alleSpalten) an[s.key] = true;
    setSichtbar(an);
    const standard = alleSpalten.map((s) => s.key);
    const gemerkt = ladeOrdnung();
    setOrdnung(
      gemerkt
        ? [
            ...gemerkt.filter((k) => standard.includes(k)),
            ...standard.filter((k) => !gemerkt.includes(k)),
          ]
        : standard,
    );
    setBreiten(ladeBreiten());
  }, [alleSpalten]);

  const titelVon = (p: Page) => p.title || t("blog.cm.ohneTitel");

  /** Der durchsuchbare Text EINES Beitrags — alle Felder, nicht nur der Titel.
   *
   *  Framer-Analyse B6: „Es sucht über ALLE Felder, nicht nur den Titel:
   *  ‚fintech' findet auch *Healthcare Mobile App*, weil deren Fließtext
   *  ‚Dello Fintech' enthält." Unsere Suche fand bis hier nur den Titel — wer
   *  einen Beitrag am Autor oder an einem Schlagwort suchte, fand nichts und
   *  hielt ihn für gelöscht.
   *
   *  Der Beitragstext (`content_html`) ist NICHT dabei: er steht nicht in der
   *  Liste, sondern wird erst beim Öffnen geholt. Ihn zu durchsuchen hieße,
   *  für jeden Tastendruck jeden Beitrag nachzuladen. */
  const suchtextVon = (p: Page) =>
    [
      titelVon(p),
      p.slug,
      p.excerpt ?? "",
      p.author ?? "",
      (p.tags ?? []).join(" "),
      p.seo_title ?? "",
      p.seo_description ?? "",
    ]
      .join(" ")
      .toLowerCase();

  /** Die Spalten, nach denen sich FILTERN und SORTIEREN laesst.
   *
   *  Das ist nicht dieselbe Liste wie die sichtbaren Spalten: eine
   *  ausgeblendete Spalte bleibt ein Feld, nach dem man suchen darf. Dazu
   *  kommt der STATUS — er ist keine Spalte im Katalog (er wird aus drei
   *  Feldern abgeleitet), aber der haeufigste Filter ueberhaupt. */
  const filterSpalten = useMemo<Spalte[]>(
    () => [
      { key: "status", label: t("blog.status"), art: "status", system: true },
      ...alleSpalten,
    ],
    [alleSpalten, t],
  );

  const gefiltert = useMemo(() => {
    const q = suche.trim().toLowerCase();
    let liste = beitraege.filter((p) => !q || suchtextVon(p).includes(q));
    // Mehrere Filter sind UND-verknuepft: jeder weitere schraenkt weiter ein.
    // Ein ODER waere die Auswahl „zeig mir mehr", und dafuer nimmt man einen
    // Filter weg statt einen hinzu.
    for (const f of filter) {
      const spalte = filterSpalten.find((s) => s.key === f.key);
      if (!spalte) continue;
      liste = liste.filter((p) => trifftZu(f, spalte, p, zustandVon(p)));
    }
    const sortiert = [...liste];
    if (sortEntwurf.key === "manuell") {
      // Handsortierung; wer noch keine hat, steht hinten und dann nach Datum.
      sortiert.sort((a, b) => {
        const pa = a.post_sort ?? Number.MAX_SAFE_INTEGER;
        const pb = b.post_sort ?? Number.MAX_SAFE_INTEGER;
        if (pa !== pb) return pa - pb;
        return (b.published_at ?? "").localeCompare(a.published_at ?? "");
      });
    } else {
      const spalte = alleSpalten.find((s) => s.key === sortEntwurf.key);
      if (spalte) {
        const vz = sortEntwurf.richtung === "auf" ? 1 : -1;
        sortiert.sort((a, b) => vz * vergleiche(spalte, a, b));
      }
    }
    return sortiert;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beitraege, suche, filter, filterSpalten, alleSpalten, sortEntwurf]);

  /** Die Zeilen als Baum: Kapitel hängen eingerückt unter ihrem Buch.
   *
   *  Nur in der Handsortierung — bei jeder anderen Sortierung wäre die
   *  Einrückung eine Behauptung über eine Reihenfolge, die gar nicht gilt. */
  type Zeile = { beitrag: Page; tiefe: number; buchTitel?: string };
  // Ziehen und Umsortieren gehen nur in der ungefilterten Handsortierung: in
  // einer gefilterten oder anders sortierten Ansicht waere die Position, an
  // die man zieht, nicht die Position, die gespeichert wird.
  const handSortierung =
    sortEntwurf.key === "manuell" && !suche.trim() && filter.length === 0;

  const zeilen: Zeile[] = useMemo(() => {
    if (!handSortierung) return gefiltert.map((beitrag) => ({ beitrag, tiefe: 0 }));
    const inSicht = new Set(gefiltert.map((p) => p.id));
    const kinder = new Map<string, Page[]>();
    const wurzeln: Page[] = [];
    for (const p of gefiltert) {
      const pid = p.parent_post_id;
      if (pid && pid !== p.id && inSicht.has(pid)) {
        const liste = kinder.get(pid);
        if (liste) liste.push(p);
        else kinder.set(pid, [p]);
      } else {
        wurzeln.push(p);
      }
    }
    const raus: Zeile[] = [];
    for (const wurzel of wurzeln) {
      raus.push({ beitrag: wurzel, tiefe: 0 });
      for (const kind of kinder.get(wurzel.id) ?? []) {
        raus.push({ beitrag: kind, tiefe: 1, buchTitel: titelVon(wurzel) });
      }
    }
    return raus;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gefiltert, handSortierung]);

  /** Eine Zeile vor eine andere schieben.
   *
   *  Nur innerhalb derselben Ebene und desselben Buchs: ein Kapitel per Ziehen
   *  aus seinem Buch zu heben wäre eine ZUWEISUNG und keine Sortierung — die
   *  gehört in den Dialog, wo sie benannt ist. */
  function zeilenTauschen(vonId: string, zuId: string) {
    if (vonId === zuId) return;
    const von = zeilen.find((z) => z.beitrag.id === vonId);
    const zu = zeilen.find((z) => z.beitrag.id === zuId);
    if (!von || !zu || von.tiefe !== zu.tiefe) return;
    if (von.beitrag.parent_post_id !== zu.beitrag.parent_post_id) return;
    const liste = zeilen.map((z) => z.beitrag);
    const vonIdx = liste.findIndex((p) => p.id === vonId);
    const zuIdx = liste.findIndex((p) => p.id === zuId);
    const [bewegt] = liste.splice(vonIdx, 1);
    if (!bewegt) return;
    liste.splice(zuIdx, 0, bewegt);
    void reorderPosts(liste.map((p) => p.id)).then((res) => {
      if (!res.ok) toast.error(res.error);
      onNeuLaden();
    });
  }

  /** Eine Zeile per TASTATUR um einen Platz verschieben.
   *
   *  Der Ziehgriff war bis hier nur ein Symbol an einer `draggable`-Zeile —
   *  ohne Maus gab es also keinen Weg, die Handsortierung zu ändern. Im
   *  Vorbild ist er ein echter Knopf („Reorder row 3", aus dem
   *  Barrierefreiheitsbaum abgelesen).
   *
   *  Verschoben wird nur innerhalb derselben Ebene, wie beim Ziehen: ein
   *  Kapitel aus seinem Buch zu heben wäre eine Zuweisung, keine Sortierung.
   *
   *  „Nach unten" ist bewusst DERSELBE Aufruf mit vertauschten Rollen —
   *  „B vor A schieben" ist dasselbe wie „A hinter B schieben". Eine zweite
   *  Umsortier-Funktion daneben wäre eine zweite Wahrheit über die
   *  Reihenfolge. */
  function zeileTastatur(id: string, richtung: -1 | 1) {
    if (!handSortierung) return;
    const idx = zeilen.findIndex((z) => z.beitrag.id === id);
    if (idx === -1) return;
    const hier = zeilen[idx];
    const nachbar = zeilen[idx + richtung];
    if (!hier || !nachbar) return;
    if (nachbar.tiefe !== hier.tiefe) return;
    if (nachbar.beitrag.parent_post_id !== hier.beitrag.parent_post_id) return;
    if (richtung === -1) zeilenTauschen(id, nachbar.beitrag.id);
    else zeilenTauschen(nachbar.beitrag.id, id);
  }

  // --- „Im Editor öffnen" kommt hier an (`?beitrag=<id>`) -------------------
  //
  // Der Beitrag wird EINMAL geöffnet und danach nicht wieder: `gefragt`
  // merkt sich die Kennung, die schon dran war. Ohne diesen Merker ginge der
  // Dialog nach jedem Schliessen sofort wieder auf — die Adresse trägt den
  // Parameter ja weiter, und der Effekt liefe erneut.
  const gefragt = useRef<string | null>(null);
  useEffect(() => {
    if (!oeffneBeitragId || gefragt.current === oeffneBeitragId) return;
    const ziel = beitraege.find((p) => p.id === oeffneBeitragId);
    // Kein Treffer heisst: der Beitrag gehört nicht zu diesem Betrieb oder es
    // gibt ihn nicht mehr. Dann passiert NICHTS — ein leerer Dialog wäre die
    // schlechtere Antwort als gar keiner.
    if (!ziel) return;
    gefragt.current = oeffneBeitragId;
    void beitragOeffnen(ziel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oeffneBeitragId, beitraege]);

  async function beitragOeffnen(page: Page) {
    const res = await getPost(page.id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setOffen({ page, felder: res.data });
  }

  function aktion(lauf: () => Promise<{ ok: boolean; error?: string }>) {
    start(async () => {
      const res = await lauf();
      if (!res.ok) {
        toast.error(res.error ?? t("blog.cm.fehler"));
        return;
      }
      onNeuLaden();
    });
  }

  /** Status inline umschalten — die häufigste Änderung überhaupt. */
  function statusSetzen(p: Page, neu: "entwurf" | "bereit" | "live") {
    const jetzt = zustandVon(p);
    if (jetzt === neu) return;
    aktion(async () => {
      if (neu === "live") return publishPage(p.id);
      if (neu === "entwurf") return setPageDraft(p.id, true);
      // „bereit" = kein Entwurf, aber nicht live.
      const aus = await unpublishPage(p.id);
      if (!aus.ok) return aus;
      return p.is_draft ? setPageDraft(p.id, false) : aus;
    });
  }

  /** Den Wert EINER Zelle schreiben (Framer B8a).
   *
   *  Ein Feld je Aufruf und kein vollständiges Objekt: der Server wertet
   *  `exclude_unset` aus, ein volles Objekt löschte also jedes Feld, das die
   *  Tabelle nicht kennt (genau die Falle, die `updatePost` im Kopf nennt). */
  function zelleSchreiben(p: Page, spalte: Spalte, wert: string) {
    const feldKey = spalte.key;
    const roh = wert.trim();
    // --- EIGENE Felder (0485) ----------------------------------------------
    //
    // Sie schreiben in `custom`, unter ihrem eigenen Schlüssel, und zwar als
    // TEIL-Objekt: der Server mischt es in den Bestand. Ein volles Objekt zu
    // senden löschte jedes Feld, das diese Zelle nicht kennt — also alle
    // anderen.
    //
    // Die Art entscheidet über den Typ des Wertes. Eine Zahl als Text zu
    // senden wäre ein 422 vom Server, und eine stille Umdeutung („'zwölf'
    // ist wohl 12") wäre ein erfundener Wert (Wurzel 4).
    if (spalte.eigen) {
      const eigen = spalte.eigen;
      let neuWert: unknown = roh || null;
      if (neuWert !== null && eigen.art === "zahl") {
        const zahl = Number(roh.replace(",", "."));
        if (Number.isNaN(zahl)) {
          toast.error(t("blog.feldZahlErwartet", { name: eigen.label }));
          return;
        }
        neuWert = zahl;
      }
      const alt = beitragCustom(p)[eigen.feld_key] ?? null;
      if (JSON.stringify(alt) === JSON.stringify(neuWert)) return;
      aktion(async () => {
        const res = await updatePost(p.id, {
          custom: { [eigen.feld_key]: neuWert },
        });
        return res.ok ? { ok: true } : { ok: false, error: res.error };
      });
      return;
    }
    // Ein leer gemachtes Feld ist `null` und nicht `""` — sonst stünde in der
    // DB ein leerer String, den kein Rückfall als „nicht gesetzt" erkennt
    // (Wurzel 4).
    const text = roh || null;
    const patch: Record<string, unknown> = {};
    const zeile = p as unknown as Record<string, unknown>;
    switch (feldKey) {
      case "published": {
        // Ein leeres Datumsfeld sendet ausdrücklich `null`: „kein
        // Erscheinungsdatum" ist eine Aussage, kein fehlender Wert.
        const iso = roh ? new Date(roh).toISOString() : null;
        if (roh && Number.isNaN(new Date(roh).getTime())) {
          toast.error(t("blog.cm.fehler"));
          return;
        }
        if ((p.published_at ?? null) === iso) return;
        patch.published_at = iso;
        break;
      }
      case "slug": {
        // Die ADRESSE liegt an der SEITE und nicht an den Beitragsfeldern —
        // `updatePost` kennt sie ausdrücklich nicht (`Omit<…, "slug">`).
        // Deshalb ein eigener Weg über `updatePage`; er trägt auch die
        // Kollisionsprüfung des Servers (409 bei doppelter Adresse im
        // Blog-Adressraum, 0484).
        const sauber = slugSaeubern(roh);
        if (!sauber) {
          // Eine leere Adresse gibt es nicht: der Beitrag wäre unter
          // `/blog/` nicht erreichbar. Klar fehlschlagen statt einen
          // Ersatz-Slug zu erfinden (Wurzel 4).
          toast.error(t("blog.adresseLeer"));
          return;
        }
        if (sauber === p.slug) return;
        aktion(async () => {
          const res = await updatePage(p.id, { slug: sauber });
          return res.ok ? { ok: true } : { ok: false, error: res.error };
        });
        return;
      }
      default: {
        // Jedes andere inline editierbare Feld schreibt unter seinem eigenen
        // Schlüssel. Nur wenn die Zeile ihn überhaupt führt — ein Schlüssel,
        // den der Server nicht kennt, käme als 422 zurück.
        if (!(feldKey in zeile)) return;
        if ((zeile[feldKey] ?? null) === text) return;
        patch[feldKey] = text;
      }
    }
    aktion(async () => {
      const res = await updatePost(p.id, patch);
      return res.ok ? { ok: true } : { ok: false, error: res.error };
    });
  }

  /** Den Schalter eines EIGENEN Feldes umlegen (0485).
   *
   *  `!== true` und nicht `!wert`: ein noch nie gesetztes Feld ist
   *  `undefined`, und `!undefined` wäre zufällig richtig — bei einem Wert,
   *  der aus irgendeinem Grund `0` oder `""` ist, aber falsch. Der Schalter
   *  kennt genau zwei Zustände, und „nicht wahr" ist der eine davon. */
  function eigenSchalterUmlegen(p: Page, feld: EigenesFeld) {
    const jetzt = beitragCustom(p)[feld.feld_key] === true;
    aktion(async () => {
      const res = await updatePost(p.id, {
        custom: { [feld.feld_key]: !jetzt },
      });
      return res.ok ? { ok: true } : { ok: false, error: res.error };
    });
  }

  /** Den Schalter „Auf der Startseite" umlegen (0481, Framer B8a).
   *
   *  Ein Schalter in der Zelle schreibt SOFORT — im Vorbild genauso. Für einen
   *  Schalter einen Dialog zu öffnen wären zwei Klicks für einen Klick. */
  function startseiteUmschalten(p: Page) {
    aktion(async () => {
      const res = await updatePost(p.id, {
        show_on_homepage: !p.show_on_homepage,
      });
      return res.ok ? { ok: true } : { ok: false, error: res.error };
    });
  }

  /** Eine Sammelaktion auf alle angehakten Zeilen (Framer B9).
   *
   *  NACHEINANDER und nicht `Promise.all`: es sind Schreibvorgänge auf
   *  derselben Tabelle, und ein Schwung paralleler Anfragen ist genau der
   *  Fall, gegen den das Ratelimit steht. Ein Fehler bricht ab und meldet —
   *  stillschweigend weiterzumachen hieße, dem Kunden „erledigt" zu sagen,
   *  während die Hälfte liegen blieb (Wurzel 5). */
  function sammelAktion(
    lauf: (p: Page) => Promise<{ ok: boolean; error?: string }>,
  ) {
    const ziele = beitraege.filter((p) => gewaehlt.has(p.id));
    if (ziele.length === 0) return;
    start(async () => {
      for (const p of ziele) {
        const res = await lauf(p);
        if (!res.ok) {
          toast.error(res.error ?? t("blog.cm.fehler"));
          break;
        }
      }
      setGewaehlt(new Set());
      onNeuLaden();
    });
  }

  /** Die Konfiguration EINES Feldes schreiben (0481).
   *
   *  Der lokale Stand wird sofort gesetzt, damit das Segment nicht
   *  zurückspringt; schlägt der Server fehl, wird er aus der Eigenschaft
   *  wiederhergestellt — kein stiller Erfolg auf einem Wert, der nie ankam. */
  function konfigSchreiben(neu: FeldKonfig) {
    setKonfig((alt) => [
      ...alt.filter((k) => k.feld_key !== neu.feld_key),
      neu,
    ]);
    start(async () => {
      const { feld_key: key, ...rest } = neu;
      const res = await setPostFieldConfig(key, rest);
      if (!res.ok) {
        toast.error(res.error);
        setKonfig(feldKonfig);
        return;
      }
      onNeuLaden();
    });
  }

  function konfigZuruecksetzen(feldKey: string) {
    setKonfig((alt) => alt.filter((k) => k.feld_key !== feldKey));
    start(async () => {
      const res = await resetPostFieldConfig(feldKey);
      if (!res.ok) {
        toast.error(res.error);
        setKonfig(feldKonfig);
        return;
      }
      onNeuLaden();
    });
  }

  const breiteVon = (key: string) => breiten[key] ?? STANDARD_BREITE;

  /** Die rechte Kante eines Kopfes ziehen ändert die Breite; beim Loslassen
   *  wird sie gemerkt. Während des Ziehens NICHT speichern — das wären
   *  hunderte Schreibvorgänge je Zug. */
  function breiteZiehen(key: string, e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startBreite = breiteVon(key);
    const bewegen = (ev: PointerEvent) =>
      setBreiten((alt) => ({
        ...alt,
        [key]: Math.max(MIN_BREITE, startBreite + (ev.clientX - startX)),
      }));
    const loslassen = () => {
      window.removeEventListener("pointermove", bewegen);
      window.removeEventListener("pointerup", loslassen);
      setBreiten((alt) => {
        merkeBreiten(alt);
        return alt;
      });
    };
    window.addEventListener("pointermove", bewegen);
    window.addEventListener("pointerup", loslassen);
  }

  /** Spalte `von` vor Spalte `zu` einsortieren. */
  function spalteVerschieben(von: string, zu: string) {
    if (von === zu) return;
    setOrdnung((alt) => {
      const neu = alt.filter((k) => k !== von);
      const idx = neu.indexOf(zu);
      neu.splice(idx === -1 ? neu.length : idx, 0, von);
      merkeOrdnung(neu);
      return neu;
    });
  }

  const sichtbareSpalten = useMemo(
    () =>
      alleSpalten
        .filter((s) => sichtbar[s.key])
        .sort((a, b) => {
          const ia = ordnung.indexOf(a.key);
          const ib = ordnung.indexOf(b.key);
          return (
            (ia === -1 ? Number.MAX_SAFE_INTEGER : ia) -
            (ib === -1 ? Number.MAX_SAFE_INTEGER : ib)
          );
        }),
    [alleSpalten, sichtbar, ordnung],
  );

  // Gesamtbreite: Griff + angehefteter Titel + Status + jede sichtbare Spalte.
  // Nötig, damit `table-layout: fixed` die gesetzten Breiten einhält (Spalten
  // dürfen dann auch schmaler werden als ihr Inhalt).
  const tabellenBreite =
    GRIFF_BREITE +
    TITEL_BREITE +
    STATUS_BREITE +
    sichtbareSpalten.reduce((sum, c) => sum + breiteVon(c.key), 0) +
    44;

  const datum = (iso: string) =>
    format.dateTime(new Date(iso), {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
      {/* Werkzeugleiste — wie im Vorbild EINE Zeile: neu · Sortierung · Status
          · Suche · Spalten. Keine Überschrift und kein Erklärsatz darüber: der
          Bereich heißt schon „Blog", und ein Satz, der das wiederholt, kostet
          ein Drittel der Höhe. */}
      <div className="flex shrink-0 items-center gap-1 border-b border-border px-3 py-1.5">
        {/* Bei Auswahl ersetzt die Sammelleiste den „+"-Knopf — genau wie im
            Vorbild (A3: „Bei Zeilenauswahl wird `+` ersetzt durch
            `N Selected ⌄`"). Beide nebeneinander wären zwei Angebote für zwei
            verschiedene Absichten an derselben Stelle. */}
        {gewaehlt.size > 0 ? (
          <SammelLeiste
            anzahl={gewaehlt.size}
            disabled={laeuft}
            onAufheben={() => setGewaehlt(new Set())}
            onEntwurf={() =>
              sammelAktion((p) => setPageDraft(p.id, true))
            }
            onVeroeffentlichen={() => sammelAktion((p) => publishPage(p.id))}
            onDuplizieren={() => sammelAktion((p) => duplicatePage(p.id))}
            onLoeschen={() =>
              setLoeschFrage({ ids: [...gewaehlt], titel: null })
            }
          />
        ) : (
          <button
            type="button"
            title={t("blog.cm.neu")}
            aria-label={t("blog.cm.neu")}
            disabled={laeuft}
            onClick={() =>
              setOffen({ page: LEERER_BEITRAG, felder: LEERE_FELDER })
            }
            className="inline-flex size-8 items-center justify-center rounded-(--radius) text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40"
          >
            <Icon icon="ph:plus" className="size-4" />
          </button>
        )}

        {/* SORTIERUNG — ein ENTWURF (Framer B4/G). Nach JEDEM Feld, nicht
            mehr nach vier festen Vorgaben. Die Tabelle zeigt den Entwurf
            sofort als Vorschau, dauerhaft wird er erst mit „Speichern";
            „Verwerfen" stellt den gespeicherten Stand wieder her. Genau
            umgekehrt zum Filter daneben — das ist der Unterschied, den
            Abschnitt G als „wer beides gleich baut, baut eines davon falsch"
            benennt. */}
        <SortierPanel
          spalten={alleSpalten}
          entwurf={sortEntwurf}
          angewandt={sortAngewandt}
          onEntwurf={setSortEntwurf}
          onSpeichern={() => setSortAngewandt(sortEntwurf)}
          onVerwerfen={() => setSortEntwurf(sortAngewandt)}
        />

        {/* FILTER — greift SOFORT, ohne Speichern (Framer B5/G). Nach jedem
            Feld und mehrere gleichzeitig; jeder gesetzte steht daneben als
            Chip mit `×`, damit man ihn SIEHT: ein stiller Filter ist der
            häufigste Grund für „mein Beitrag ist weg". */}
        <FilterMenue
          spalten={filterSpalten}
          onHinzu={(f) => setFilter((alt) => [...alt, f])}
        />
        <FilterChips
          filter={filter}
          spalten={filterSpalten}
          onEntfernen={(i) =>
            setFilter((alt) => alt.filter((_, j) => j !== i))
          }
        />

        {sucheOffen ? (
          <Input
            autoFocus
            placeholder={t("blog.cm.suchen")}
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
            onBlur={() => !suche && setSucheOffen(false)}
            className="h-8 w-56"
          />
        ) : (
          <button
            type="button"
            title={t("blog.cm.suchen")}
            aria-label={t("blog.cm.suchen")}
            onClick={() => setSucheOffen(true)}
            className="inline-flex size-8 items-center justify-center rounded-(--radius) text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Icon icon="ph:magnifying-glass" className="size-4" />
          </button>
        )}

        <div className="flex-1" />
        <span className="pr-1 text-xs text-muted-foreground">
          {t("blog.beitraegeZahl", { anzahl: gefiltert.length })}
        </span>

        <SpaltenWahl
          spalten={alleSpalten}
          sichtbar={sichtbar}
          onUmschalten={(key) =>
            setSichtbar((v) => ({ ...v, [key]: !v[key] }))
          }
          suche={spaltenSuche}
          onSuche={setSpaltenSuche}
        />

        <Button
          size="sm"
          className="h-8"
          onClick={() => setOffen({ page: LEERER_BEITRAG, felder: LEERE_FELDER })}
        >
          {t("blog.cm.neu")}
        </Button>
      </div>

      {/* Tabelle */}
      <div className="min-h-0 flex-1 overflow-auto">
        {gefiltert.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            {/* „No search results" mittig (Framer B6/F). Die SUCHE bekommt
                ihre eigene Meldung: „keine Treffer" nach einem Suchbegriff
                heisst etwas anderes als „noch keine Beitraege" — das eine ist
                ein Ergebnis, das andere ein leerer Bestand. */}
            <p className="text-sm text-muted-foreground">
              {suche.trim()
                ? t("blog.cm.keinTrefferSuche")
                : filter.length > 0
                  ? t("blog.keinTreffer")
                  : t("blog.nochKeineBeitraege")}
            </p>
          </div>
        ) : (
          <table
            // `role="grid"` und nicht die Vorgabe `table`: die Zellen sind
            // BEDIENBAR (Auswahl, Inline-Bearbeitung, Schalter). Das Vorbild
            // meldet sich genauso an. Eine reine `table` sagt der
            // Vorlesefunktion „Text zum Lesen" und unterschlägt, dass hier
            // etwas geändert werden kann.
            role="grid"
            aria-label={t("blog.beitraege")}
            aria-rowcount={zeilen.length + 1}
            aria-colcount={sichtbareSpalten.length + 3}
            style={{ width: tabellenBreite, tableLayout: "fixed" }}
            className="border-separate border-spacing-0 text-sm"
          >
            <thead className="sticky top-0 z-20 bg-background">
              <tr className="text-left text-[13px] font-normal text-muted-foreground">
                {/* Ziehgriff, links angeheftet */}
                <th
                  style={{ width: GRIFF_BREITE }}
                  className="sticky left-0 z-30 border-b border-r border-border bg-background px-2"
                >
                  {/* Dieselbe Aufteilung wie in der Zeile darunter: Platz für
                      den Ziehgriff, dann das Kästchen. Ohne den Platzhalter
                      stand das Kopf-Kästchen 14 px weiter links als die der
                      Zeilen — gemessen 267 gegen 281 — und die Spalte sah
                      schief aus. Eine Auswahlspalte, deren Kästchen nicht auf
                      einer Achse stehen, liest sich als Fehler, nicht als
                      Gestaltung. */}
                  <span className="flex items-center gap-1">
                    {/* `size-4` allein genügt hier NICHT: ein leeres
                        `inline-block` kollabiert auf seine Zeilenbox und maß
                        gemessen 6 statt 16 px — das Kopf-Kästchen stand
                        danach immer noch 10 px daneben. `shrink-0` und die
                        Blockdarstellung halten die Breite. */}
                    <span
                      aria-hidden
                      className="block size-4 shrink-0"
                    />
                    {/* „Select all rows" (Framer A4). Es wählt die SICHTBAREN
                        Zeilen, nicht alle Beiträge: bei gesetztem Filter wäre
                        „alle" eine Auswahl, die man nicht sieht — und die
                        nächste Sammelaktion träfe Beiträge, die gar nicht auf
                        dem Bildschirm stehen. */}
                    <input
                    type="checkbox"
                    aria-label={t("blog.auswahl.alleWaehlen")}
                    checked={
                      zeilen.length > 0 &&
                      zeilen.every((z) => gewaehlt.has(z.beitrag.id))
                    }
                    ref={(el) => {
                      if (!el) return;
                      const einige = zeilen.some((z) =>
                        gewaehlt.has(z.beitrag.id),
                      );
                      const alle =
                        zeilen.length > 0 &&
                        zeilen.every((z) => gewaehlt.has(z.beitrag.id));
                      // Teilauswahl als drittes Aussehen: ein leeres Kästchen
                      // bei drei von sechs gewählten Zeilen wäre eine
                      // Falschaussage.
                      el.indeterminate = einige && !alle;
                    }}
                    onChange={(e) =>
                      setGewaehlt(
                        e.target.checked
                          ? new Set(zeilen.map((z) => z.beitrag.id))
                          : new Set(),
                      )
                    }
                      className="size-3.5 cursor-pointer accent-(--brand)"
                    />
                  </span>
                </th>
                {/* Titelspalte, links angeheftet — sie ist der Inhalt, an dem
                    der Redakteur seine Beiträge erkennt. Vorher stand hier die
                    Adresse, also Verwaltung. */}
                <th
                  style={{ width: TITEL_BREITE, left: GRIFF_BREITE }}
                  className="sticky z-30 border-b border-r border-border bg-background px-4 py-3.5 font-normal"
                >
                  {t("blog.titel")}
                </th>
                {/* Status steht direkt hinter dem Titel und wandert nicht. */}
                <th
                  style={{ width: STATUS_BREITE }}
                  className="whitespace-nowrap border-b border-r border-border px-5 py-3.5 font-normal"
                >
                  {t("blog.status")}
                </th>
                {sichtbareSpalten.map((spalte) => (
                  <KopfZelle
                    key={spalte.key}
                    spalte={spalte}
                    breite={breiteVon(spalte.key)}
                    aktiv={gezogeneSpalte === spalte.key}
                    onZiehStart={() => setGezogeneSpalte(spalte.key)}
                    onZiehEnde={() => setGezogeneSpalte(null)}
                    onAblegen={(von) => spalteVerschieben(von, spalte.key)}
                    onBreite={(e) => breiteZiehen(spalte.key, e)}
                    onKontext={(x, y) => setKopfMenue({ key: spalte.key, x, y })}
                    breiteLabel={t("blog.cm.spalteBreite")}
                    onKonfig={
                      spalte.def
                        ? () =>
                            setKonfigFeld((offenJetzt) =>
                              offenJetzt === spalte.key ? null : spalte.key,
                            )
                        : undefined
                    }
                    konfigLabel={t("blog.feld.konfigurieren")}
                  />
                ))}
                <th
                  style={{ width: 44 }}
                  className="border-b border-border"
                />
              </tr>
            </thead>
            <tbody>
              {zeilen.map(({ beitrag, tiefe, buchTitel }, zeilenNr) => {
                const kind = tiefe > 0;
                // 1-basiert und wie im Vorbild benannt („Select row 3",
                // „Reorder row 3"): eine Zeilennummer, die bei 0 anfängt,
                // stimmt mit nichts überein, was der Nutzer sieht.
                const nr = zeilenNr + 1;
                const grund = zellenGrund(gewaehlt.has(beitrag.id), kind);
                return (
                  <tr
                    key={beitrag.id}
                    draggable={handSortierung}
                    onDragStart={
                      handSortierung
                        ? (e) => {
                            setGezogeneZeile(beitrag.id);
                            e.dataTransfer.effectAllowed = "move";
                          }
                        : undefined
                    }
                    onDragOver={
                      handSortierung && gezogeneZeile && gezogeneZeile !== beitrag.id
                        ? (e) => e.preventDefault()
                        : undefined
                    }
                    onDrop={
                      handSortierung && gezogeneZeile
                        ? (e) => {
                            e.preventDefault();
                            zeilenTauschen(gezogeneZeile, beitrag.id);
                            setGezogeneZeile(null);
                          }
                        : undefined
                    }
                    onDragEnd={
                      handSortierung ? () => setGezogeneZeile(null) : undefined
                    }
                    // RECHTSKLICK oeffnet dasselbe Menue wie der `⋯`-Knopf
                    // (Framer: `Edit · Open · Draft · Duplicate · Delete`).
                    // Es war der einzige Weg, der im Vorbild ueberall
                    // funktioniert — unser Knopf sass in der LETZTEN Spalte
                    // und damit bei 24 Feldern 3 750 px ausserhalb des Bildes.
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setZeilenMenue({
                        id: beitrag.id,
                        x: e.clientX,
                        y: e.clientY,
                      });
                    }}
                    // KEIN Zeilenklick mehr, der den Dialog öffnet
                    // (Framer B8): „Den Editor-Dialog öffnet ausschließlich
                    // der `Expand row`-Knopf." Vorher schluckte die Zeile
                    // jeden Klick — damit war eine Zelle nicht anklickbar,
                    // ohne dass sich der Dialog darüberlegte, und die
                    // Inline-Bearbeitung wäre unerreichbar geblieben.
                    // KEINE Zustandsfarbe an der Zeile — sie steht in jeder
                    // Zelle (siehe `zellenGrund`). Die `<tr>` bleibt nur die
                    // Gruppe, an der `group-hover` haengt.
                    aria-selected={gewaehlt.has(beitrag.id)}
                    className={cn(
                      "group transition-colors",
                      gezogeneZeile === beitrag.id && "opacity-40",
                    )}
                  >
                    <td
                      style={{ width: GRIFF_BREITE }}
                      onClick={(e) => e.stopPropagation()}
                      className={cn(
                        "sticky left-0 z-10 border-b border-r border-border px-2 text-center align-middle text-muted-foreground/40",
                        grund,
                      )}
                    >
                      <span className="flex items-center gap-1">
                        {/* Griff und Kästchen nebeneinander wie im Vorbild
                            (A4: „⠿ Reorder row N · Select row N"). Der Griff
                            tritt beim Überfahren hervor, das Kästchen bleibt
                            sichtbar, sobald etwas gewählt ist — sonst
                            verschwände die eigene Auswahl aus dem Blick. */}
                        <button
                          type="button"
                          // Ein echter Knopf und kein dekoratives Symbol: ohne
                          // ihn gab es KEINEN Weg, die Handsortierung ohne
                          // Maus zu ändern. ↑/↓ verschieben um einen Platz,
                          // das Vorbild nennt ihn „Reorder row N".
                          aria-label={t("blog.cm.zeileVerschieben", { nr })}
                          disabled={!handSortierung}
                          onKeyDown={(e) => {
                            if (e.key === "ArrowUp") {
                              e.preventDefault();
                              zeileTastatur(beitrag.id, -1);
                            } else if (e.key === "ArrowDown") {
                              e.preventDefault();
                              zeileTastatur(beitrag.id, 1);
                            }
                          }}
                          title={
                            handSortierung
                              ? t("blog.cm.zumSortierenZiehen")
                              : t("blog.cm.sortierenNurManuell")
                          }
                          // KONSTANT sichtbar, kein Sprung beim Überfahren.
                          //
                          // Vorher ging der Griff von `opacity-30` auf `1`,
                          // sobald die Maus die Zeile berührte. Weil immer nur
                          // EINE Zeile überfahren ist, standen in derselben
                          // Spalte gleichzeitig ein kräftiger und mehrere
                          // blasse Griffe — und das liest sich als Versatz der
                          // Kästchen daneben, obwohl rechnerisch nichts
                          // wandert (gemessen: alle bei x = 281). Gemeldet
                          // wurde es genau so: „immer noch Probleme", mit
                          // einem Bild, auf dem die überfahrene Zeile
                          // eingerückt wirkt.
                          //
                          // Ein Bedienelement, dessen Auffälligkeit von der
                          // Mausposition abhängt, macht die Spalte unruhig.
                          // Der Griff ist eine Geste, kein Ziel: er bleibt
                          // dezent — aber überall gleich dezent.
                          className={cn(
                            "inline-block select-none",
                            handSortierung
                              ? "cursor-grab opacity-30"
                              : "opacity-15",
                          )}
                        >
                          <Icon
                            icon="ph:dots-six-vertical"
                            className="size-4"
                          />
                        </button>
                        <input
                          type="checkbox"
                          aria-label={t("blog.auswahl.zeileWaehlenNr", { nr })}
                          checked={gewaehlt.has(beitrag.id)}
                          onChange={(e) =>
                            setGewaehlt((alt) => {
                              const neu = new Set(alt);
                              if (e.target.checked) neu.add(beitrag.id);
                              else neu.delete(beitrag.id);
                              return neu;
                            })
                          }
                          // DAUERHAFT sichtbar und nicht erst beim
                          // Überfahren. Vorher stand hier `opacity-0`: die
                          // Kästchen erschienen nur unter der Maus, während
                          // das im Kopf immer stand — die Spalte wirkte
                          // dadurch halb leer und halb gefüllt. Ein
                          // Bedienelement, das man erst findet, wenn man
                          // zufällig darüberfährt, ist keines. Der ZIEHGRIFF
                          // bleibt zurückhaltend: er ist eine Geste, kein
                          // Ziel.
                          className="size-3.5 cursor-pointer accent-(--brand)"
                        />
                      </span>
                    </td>
                    <td
                      aria-label={`${t("blog.titel")}: ${titelVon(beitrag)}`}
                      style={{ width: TITEL_BREITE, left: GRIFF_BREITE }}
                      className={cn(
                        "sticky z-10 truncate border-b border-r border-border px-4 py-3.5 font-medium text-foreground",
                        grund,
                      )}
                    >
                      <span
                        className="flex items-center gap-1.5"
                        style={{ paddingLeft: tiefe * 20 }}
                      >
                        {kind ? (
                          <span
                            title={
                              buchTitel
                                ? t("blog.cm.kapitelVon", { titel: buchTitel })
                                : undefined
                            }
                            className="shrink-0 text-muted-foreground/50"
                          >
                            <Icon
                              icon="ph:arrow-elbow-down-right"
                              className="size-3.5"
                            />
                          </span>
                        ) : null}
                        <span className="min-w-0 flex-1 truncate">
                          {titelVon(beitrag)}
                        </span>
                        {/* `Expand row` (Framer A4/B8): erscheint beim
                            Überfahren rechts in der Titelzelle und ist der
                            EINZIGE Weg in den Dialog. */}
                        <button
                          type="button"
                          aria-label={t("blog.cm.aufklappen")}
                          title={t("blog.cm.aufklappen")}
                          onClick={(e) => {
                            e.stopPropagation();
                            void beitragOeffnen(beitrag);
                          }}
                          className="inline-flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition hover:bg-secondary hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                        >
                          <Icon
                            icon="ph:arrows-out-simple"
                            className="size-3.5"
                          />
                        </button>
                        {/* Das Zeilenmenue gehoert HIERHER, in die
                            angeheftete Titelspalte — nicht ans rechte Ende
                            der Tabelle. Bei 24 Feldern stand es dort bei
                            x = 5 624 px und war erst nach 3 750 px Scrollen
                            erreichbar; gemessen am 28.08.2026. Eine Aktion,
                            die man nur nach einer Reise findet, ist keine. */}
                        <button
                          type="button"
                          aria-label={t("blog.zeileMenue")}
                          title={t("blog.zeileMenue")}
                          aria-haspopup="menu"
                          aria-expanded={zeilenMenue?.id === beitrag.id}
                          disabled={laeuft}
                          onClick={(e) => {
                            e.stopPropagation();
                            const r =
                              e.currentTarget.getBoundingClientRect();
                            setZeilenMenue({
                              id: beitrag.id,
                              x: r.left,
                              y: r.bottom + 4,
                            });
                          }}
                          className="inline-flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition hover:bg-secondary hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-30"
                        >
                          <Icon icon="ph:dots-three" className="size-4" />
                        </button>
                      </span>
                    </td>
                    <td
                      aria-label={`${t("blog.status")}: ${t(
                        `blog.zustand.${zustandVon(beitrag)}`,
                      )}`}
                      style={{ width: STATUS_BREITE }}
                      onClick={(e) => e.stopPropagation()}
                      className={cn(
                        "truncate whitespace-nowrap border-b border-r border-border px-5 py-3.5",
                        grund,
                      )}
                    >
                      <StatusPille
                        zustand={zustandVon(beitrag)}
                        disabled={laeuft}
                        onZustand={(z) => statusSetzen(beitrag, z)}
                      />
                    </td>
                    {sichtbareSpalten.map((spalte) => {
                      // Feld UND Wert, wie im Vorbild („Industry: Digital
                      // Marketing"). Nur der Spaltenname wäre bei sechs
                      // Zeilen sechsmal dasselbe Wort — und genau das stand
                      // vorher an der Zelle UND an ihrem Eingabeknopf.
                      const zellName = `${spalte.label}: ${zellText(
                        spalte,
                        beitrag,
                        datum,
                        t("blog.zelle.leer"),
                        (ja) => (ja ? t("blog.ja") : t("blog.nein")),
                        (anzahl) =>
                          anzahl === 0
                            ? t("blog.keinBild")
                            : t("blog.bilderZahl", { anzahl }),
                      )}`;
                      return (
                      <td
                        key={spalte.key}
                        aria-label={zellName}
                        style={{ width: breiteVon(spalte.key) }}
                        className={cn(
                          "truncate whitespace-nowrap border-b border-r border-border px-5 py-3.5 text-foreground/70 transition-opacity",
                          grund,
                          gezogeneSpalte === spalte.key && "opacity-30",
                        )}
                      >
                        <Zellwert
                          spalte={spalte}
                          beitrag={beitrag}
                          datum={datum}
                          konfig={
                            spalte.def
                              ? konfigVon(spalte.def, konfig)
                              : null
                          }
                          ausgewaehlt={
                            zelle?.zeile === beitrag.id &&
                            zelle.spalte === spalte.key
                          }
                          bearbeitet={
                            zelle?.zeile === beitrag.id &&
                            zelle.spalte === spalte.key &&
                            zelle.offen
                          }
                          onAuswaehlen={() =>
                            setZelle({
                              zeile: beitrag.id,
                              spalte: spalte.key,
                              offen: false,
                            })
                          }
                          onBearbeiten={() =>
                            setZelle({
                              zeile: beitrag.id,
                              spalte: spalte.key,
                              offen: true,
                            })
                          }
                          onFertig={(abschluss, wert) => {
                            setZelle({
                              zeile: beitrag.id,
                              spalte: spalte.key,
                              offen: false,
                            });
                            if (abschluss === "speichern") {
                              zelleSchreiben(beitrag, spalte, wert);
                            }
                          }}
                          // Der Schalter eines EIGENEN Feldes schreibt in
                          // `custom`, der eingebaute in `show_on_homepage` —
                          // zwei verschiedene Ziele hinter demselben Klick.
                          onSchalter={() =>
                            spalte.eigen
                              ? eigenSchalterUmlegen(beitrag, spalte.eigen)
                              : startseiteUmschalten(beitrag)
                          }
                          leerText={t("blog.zelle.leer")}
                          // Der SCHALTER trägt nur den Feldnamen: seinen
                          // Zustand sagt die Rolle `switch` selbst, und
                          // „Auf der Startseite: Ja" wäre danach ein zweites
                          // Mal dasselbe. Jedes andere Feld trägt Feld UND
                          // Wert.
                          feldLabel={
                            spalte.def?.art === "schalter"
                              ? spalte.label
                              : zellName
                          }
                        />
                      </td>
                      );
                    })}
                    {/* Fueller. Er gibt der letzten echten Spalte ihre
                        rechte Kante und steckt in `tabellenBreite` mit drin;
                        BEDIENELEMENTE stehen hier keine mehr. */}
                    <td
                      style={{ width: 44 }}
                      className={cn("border-b border-border", grund)}
                    />
                  </tr>
                );
              })}

              {/* Die leere ABSCHLUSSZEILE (Framer A4: „Unter der letzten Zeile
                  eine leere Zeile `New item` — Klick legt einen Eintrag an").
                  Sie fehlte bei uns ganz.

                  Sie ist mehr als eine Abkürzung: sie zeigt, wo die Liste
                  aufhört und dass sie weitergehen darf. Ohne sie endet die
                  Tabelle mit einer Kante, und der einzige Weg zu einem neuen
                  Beitrag steht oben in der Werkzeugleiste — also am anderen
                  Ende des Blicks, nachdem man gerade nach unten gelesen hat.

                  Sie erscheint NUR in der ungefilterten Handsortierung: in
                  einer gefilterten Ansicht wäre der neue Beitrag im selben
                  Moment wieder verschwunden, weil er den Filter nicht
                  erfüllt. */}
              {handSortierung ? (
                <tr
                  className="group cursor-pointer"
                  onClick={() =>
                    setOffen({ page: LEERER_BEITRAG, felder: LEERE_FELDER })
                  }
                >
                  <td
                    style={{ width: GRIFF_BREITE }}
                    className="sticky left-0 z-10 border-b border-r border-border bg-background px-2 group-hover:bg-(--tabelle-zeile-ueberfahren)"
                  />
                  <td
                    style={{ width: TITEL_BREITE, left: GRIFF_BREITE }}
                    className="sticky z-10 border-b border-r border-border bg-background px-4 py-3.5 group-hover:bg-(--tabelle-zeile-ueberfahren)"
                  >
                    <button
                      type="button"
                      className="flex items-center gap-1.5 text-sm text-muted-foreground transition group-hover:text-foreground"
                    >
                      <Icon icon="ph:plus" className="size-3.5" />
                      {t("blog.cm.neu")}
                    </button>
                  </td>
                  <td
                    colSpan={sichtbareSpalten.length + 2}
                    className="border-b border-border bg-background group-hover:bg-(--tabelle-zeile-ueberfahren)"
                  />
                </tr>
              ) : null}
            </tbody>
          </table>
        )}
      </div>

      {kopfMenue
        ? (() => {
            const spalte = alleSpalten.find((s) => s.key === kopfMenue.key);
            if (!spalte) return null;
            return (
              <SpaltenMenue
                spalte={spalte}
                x={kopfMenue.x}
                y={kopfMenue.y}
                onSchliessen={() => setKopfMenue(null)}
                onAusblenden={() =>
                  setSichtbar((v) => ({ ...v, [spalte.key]: false }))
                }
                onNachVorn={() => {
                  const erste = sichtbareSpalten[0];
                  if (erste) spalteVerschieben(spalte.key, erste.key);
                }}
              />
            );
          })()
        : null}

      {/* Das ZEILENMENÜ — ein Zustand, zwei Wege (Rechtsklick und `⋯`). */}
      {zeilenMenue
        ? (() => {
            const beitrag = beitraege.find((p) => p.id === zeilenMenue.id);
            if (!beitrag) return null;
            return (
              <ZeilenMenue
                beitrag={beitrag}
                x={zeilenMenue.x}
                y={zeilenMenue.y}
                disabled={laeuft}
                onSchliessen={() => setZeilenMenue(null)}
                onBearbeiten={() => void beitragOeffnen(beitrag)}
                liveDomain={liveDomain}
                // Auf die SEITE des Beitrags im EDITOR — ohne Panel, wie bei
                // jeder anderen Seite. Die Vorschau daneben zeichnet den
                // Beitrag seit heute selbst (`app/render/[pageId]`); vorher
                // stand dort eine weisse Flaeche, und genau das war „geht
                // nicht".
                onOeffnenImEditor={() =>
                  router.push(`/website/seiten/${beitrag.id}`)
                }
                // Der veröffentlichte Beitrag in einem NEUEN Tab: das
                // Dashboard bleibt stehen, samt offenem Panel und Auswahl.
                // `noopener` gegen `window.opener`-Zugriff der fremden Seite.
                onAufWebsiteAnsehen={() =>
                  globalThis.open(
                    `https://${liveDomain}/blog/${beitrag.slug}`,
                    "_blank",
                    "noopener,noreferrer",
                  )
                }
                onStatus={() =>
                  statusSetzen(
                    beitrag,
                    zustandVon(beitrag) === "live" ? "entwurf" : "live",
                  )
                }
                onDuplizieren={() => aktion(() => duplicatePage(beitrag.id))}
                onLoeschen={() =>
                  setLoeschFrage({
                    ids: [beitrag.id],
                    titel: titelVon(beitrag),
                  })
                }
              />
            );
          })()
        : null}

      {/* Die Rückfrage vor dem Löschen — für eine Zeile wie für eine Auswahl. */}
      {loeschFrage ? (
        <LoeschenBestaetigen
          titel={loeschFrage.titel}
          anzahl={loeschFrage.ids.length}
          laeuft={laeuft}
          onAbbrechen={() => setLoeschFrage(null)}
          onLoeschen={() => {
            const ids = loeschFrage.ids;
            setLoeschFrage(null);
            // NACHEINANDER, mit Abbruch beim ersten Fehler — dieselbe
            // Begründung wie bei `sammelAktion`: „erledigt" zu melden, während
            // die Hälfte liegen blieb, ist eine Falschaussage (Wurzel 5).
            start(async () => {
              for (const id of ids) {
                const res = await deletePage(id);
                if (!res.ok) {
                  toast.error(res.error ?? t("blog.cm.fehler"));
                  break;
                }
              }
              setGewaehlt(new Set());
              onNeuLaden();
            });
          }}
        />
      ) : null}

      {/* Das Feldkonfigurations-Popover (Framer C1). Es haengt an der
          Werkzeugleiste und nicht am Spaltenkopf: der Kopf scrollt waagerecht
          weg, und ein Popover, das mit seiner Spalte aus dem Bild faehrt,
          laesst sich nicht mehr bedienen. */}
      {konfigFeld
        ? (() => {
            const spalte = alleSpalten.find((c) => c.key === konfigFeld);
            // `def` in eine eigene Konstante: im Callback unten verengt
            // TypeScript `spalte.def` nicht mehr — die Eigenschaft könnte
            // zwischen Prüfung und Aufruf ein anderer Wert sein.
            const def = spalte?.def;
            if (!def) return null;
            return (
              <div className="absolute right-3 top-12 z-50">
                <FeldKonfigPopover
                  def={def}
                  konfig={konfigVon(def, konfig)}
                  name={t(def.i18n)}
                  // Als Quelle einer abgeleiteten Vorgabe taugt jede andere
                  // Spalte samt der eigenen Felder — nur nicht das Feld
                  // selbst: seine Vorgabe wäre dann ihr eigener Ausgangspunkt.
                  quellfelder={[
                    { key: "title", name: t("blog.titel") },
                    ...alleSpalten
                      .filter((s) => s.key !== def.key && !s.system)
                      .map((s) => ({ key: s.key, name: s.label })),
                  ]}
                  onAendern={konfigSchreiben}
                  onZuruecksetzen={() => {
                    konfigZuruecksetzen(def.key);
                    setKonfigFeld(null);
                  }}
                  onSchliessen={() => setKonfigFeld(null)}
                />
              </div>
            );
          })()
        : null}

      {offen ? (
        <BeitragDialog
          page={offen.page}
          felder={offen.felder}
          eigeneFelder={eigeneFelder}
          feldKonfig={konfig}
          liveDomain={liveDomain}
          onSchliessen={() => setOffen(null)}
          onNeuLaden={onNeuLaden}
        />
      ) : null}
    </div>
  );
}

/** Die Spaltenwahl (⋮) — mit Suchfeld wie im Vorbild.
 *
 *  Ein eigenes Popover statt `DropdownMenu`: das Suchfeld darin muss Tasten
 *  behalten, und ein Menü, das auf jede Taste reagiert, schließt beim ersten
 *  Buchstaben. */
function SpaltenWahl({
  spalten,
  sichtbar,
  onUmschalten,
  suche,
  onSuche,
}: {
  spalten: Spalte[];
  sichtbar: Record<string, boolean>;
  onUmschalten: (key: string) => void;
  suche: string;
  onSuche: (v: string) => void;
}) {
  const t = useTranslations("website");
  const [offen, setOffen] = useState(false);
  const huelle = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!offen) return;
    function aufKlick(e: MouseEvent) {
      if (!huelle.current?.contains(e.target as Node)) setOffen(false);
    }
    document.addEventListener("mousedown", aufKlick);
    return () => document.removeEventListener("mousedown", aufKlick);
  }, [offen]);

  const gefiltert = spalten.filter((s) =>
    s.label.toLowerCase().includes(suche.trim().toLowerCase()),
  );

  return (
    <div ref={huelle} className="relative shrink-0">
      <button
        type="button"
        title={t("blog.cm.spalten")}
        aria-label={t("blog.cm.spalten")}
        aria-expanded={offen}
        onClick={() => {
          setOffen((o) => !o);
          onSuche("");
        }}
        className="inline-flex size-8 items-center justify-center rounded-(--radius) text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <Icon icon="ph:dots-three-vertical" className="size-4" />
      </button>
      {offen ? (
        <div className="absolute right-0 top-9 z-40 flex max-h-96 w-64 flex-col rounded-(--radius) border border-border bg-background shadow-xl">
          <div className="border-b border-border p-2">
            <Input
              autoFocus
              value={suche}
              onChange={(e) => onSuche(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder={t("blog.cm.spaltenSuchen")}
              className="h-8"
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-1">
            {gefiltert.map((spalte) => (
              <button
                key={spalte.key}
                type="button"
                onClick={() => onUmschalten(spalte.key)}
                className="flex w-full items-center gap-2 rounded-(--radius) px-2 py-1.5 text-left text-sm transition-colors hover:bg-secondary/60"
              >
                <span className="w-4 text-center text-xs">
                  {sichtbar[spalte.key] ? "✓" : ""}
                </span>
                <span className="min-w-0 flex-1 truncate">{spalte.label}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Der Status als farbige Pille mit Auswahl — direkt in der Zelle bedienbar.
 *
 *  Das ist die häufigste Änderung an einem Beitrag; dafür den Dialog zu öffnen
 *  wären zwei Klicks zu viel. Drei Zustände, nicht zwei — siehe `zustandVon`. */
function StatusPille({
  zustand,
  disabled,
  onZustand,
}: {
  zustand: "entwurf" | "bereit" | "live";
  disabled?: boolean;
  onZustand: (z: "entwurf" | "bereit" | "live") => void;
}) {
  const t = useTranslations("website");
  const farbe =
    zustand === "live"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
      : zustand === "entwurf"
        ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
        : "bg-secondary text-muted-foreground";
  return (
    <Select
      value={zustand}
      disabled={disabled}
      onValueChange={(v) => onZustand(v as typeof zustand)}
    >
      <SelectTrigger
        className={cn(
          "h-6 w-auto gap-1 rounded-full border-0 px-2 text-xs font-medium shadow-none focus:ring-0",
          farbe,
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="entwurf">{t("blog.zustand.entwurf")}</SelectItem>
        <SelectItem value="bereit">{t("blog.zustand.bereit")}</SelectItem>
        <SelectItem value="live">{t("blog.zustand.live")}</SelectItem>
      </SelectContent>
    </Select>
  );
}

/** Der Wert einer Zelle — je Spaltenart so, wie er sich in einer Zeile liest.
 *
 *  Ein Titelbild als Adresse und ein Anriss als HTML-Quelltext wären in einer
 *  Tabelle unlesbar. Deshalb Miniatur und Textauszug. */
/** Die Bildminiatur EINER Zelle — eine Bauart für alle Bildfelder.
 *
 *  MASSE AUS DEM VORBILD, NICHT GERATEN
 *  ====================================
 *  Am 28.08.2026 im offenen Framer-Projekt gemessen: die Zelle ist 315 × 51
 *  mit 10 px Innenabstand, die Miniatur darin **46 × 20**, Radius **6 px**,
 *  Platte `#f3f3f3`, Bild `cover` und mittig (`background-position: 50% 50%`).
 *
 *  Unsere war 48 × 28 mit dem grossen Baukasten-Radius. In einer 51 px hohen
 *  Zeile ist das mehr als die halbe Zeilenhöhe — ein leeres Bildfeld sah
 *  dadurch aus wie ein fetter grauer Klotz statt wie ein Platzhalter, und
 *  genau so wurde es gemeldet („bei den Images schaut es voll schlecht aus").
 *
 *  Die PLATTE bleibt auch mit Bild stehen: sie ist der Platzhalter für die
 *  Ladezeit und der Grund, warum eine leere und eine gefüllte Zelle dieselbe
 *  Grundfläche haben. Ohne sie springt die Spalte beim Laden.
 *
 *  Auf der Skala und nicht in Pixeln: `h-5 w-11` = 1.25 × 2.75 rem = 20 × 44
 *  (Vorbild 46) und `rounded-md` = 0.375 rem = 6 px (Vorbild 6). */
function Miniatur({ url }: { url: string | null }) {
  return (
    <span className="inline-flex h-5 w-11 shrink-0 overflow-hidden rounded-md bg-(--tabelle-bild-platte) align-middle">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="size-full object-cover" />
      ) : null}
    </span>
  );
}

function Zellwert({
  spalte,
  beitrag,
  datum,
  konfig,
  ausgewaehlt,
  bearbeitet,
  onAuswaehlen,
  onBearbeiten,
  onFertig,
  onSchalter,
  leerText,
  feldLabel,
}: {
  spalte: Spalte;
  beitrag: Page;
  datum: (iso: string) => string;
  /** Die geltende Feldkonfiguration (0481) — `null` bei Systemspalten. */
  konfig: FeldKonfig | null;
  ausgewaehlt: boolean;
  bearbeitet: boolean;
  onAuswaehlen: () => void;
  onBearbeiten: () => void;
  onFertig: (abschluss: "speichern" | "verwerfen", wert: string) => void;
  onSchalter: () => void;
  leerText: string;
  feldLabel: string;
}) {
  // DIE ZELLE IST DAS EINGABEFELD (Framer B8a). Was sich direkt bearbeiten
  // lässt, sagt der Katalog — ein Bild und eine Schlagwortliste brauchen mehr
  // Platz, als eine Zeile hat, und öffnen deshalb weiterhin den Dialog.
  // --- EIGENE Felder (0485) -------------------------------------------------
  //
  // Sie stehen VOR allem anderen, weil sie sich nicht am Schlüssel erkennen
  // lassen: `rooms` ist für die Zeile ein Wort wie jedes andere. Was sie
  // ausmacht, ist die Definition — und die hängt an der Spalte.
  if (spalte.eigen) {
    const wert = beitragCustom(beitrag)[spalte.eigen.feld_key] ?? null;
    const art = spalte.eigen.art;
    if (art === "schalter") {
      return (
        <Switch
          checked={wert === true}
          aria-label={feldLabel}
          onClick={(e) => e.stopPropagation()}
          onCheckedChange={onSchalter}
          className="scale-75"
        />
      );
    }
    if (art === "bild") {
      return <Miniatur url={typeof wert === "string" ? wert : null} />;
    }
    if (art === "galerie") {
      const bilder = Array.isArray(wert) ? (wert as string[]) : [];
      if (bilder.length === 0) return <Miniatur url={null} />;
      return (
        <span className="flex items-center gap-1">
          {bilder.slice(0, 3).map((url, i) => (
            <Miniatur key={`${url}-${i}`} url={url} />
          ))}
          {bilder.length > 3 ? (
            <span className="text-xs text-muted-foreground">
              +{bilder.length - 3}
            </span>
          ) : null}
        </span>
      );
    }
    if (art === "liste") {
      const eintraege = Array.isArray(wert) ? (wert as string[]) : [];
      return (
        <span className="text-muted-foreground">
          {eintraege.join(", ") || (
            <span className="text-muted-foreground/60">{leerText}</span>
          )}
        </span>
      );
    }
    // Text, Zahl, Datum und Link ändert man DIREKT IN DER ZELLE — dieselbe
    // Regel wie bei den eingebauten Feldern (B8a): was in eine Zeile passt,
    // braucht keinen Dialog.
    return (
      <ZelleBearbeiten
        wert={wert === null || wert === undefined ? "" : String(wert)}
        mehrzeilig={spalte.eigen.mehrzeilig}
        maxZeichen={spalte.eigen.max_zeichen}
        ausgewaehlt={ausgewaehlt}
        bearbeitet={bearbeitet}
        platzhalter={spalte.eigen.platzhalter ?? leerText}
        ariaLabel={feldLabel}
        onAuswaehlen={onAuswaehlen}
        onBearbeiten={onBearbeiten}
        onFertig={onFertig}
      />
    );
  }

  if (
    (spalte.def?.inlineEditierbar && spalte.def.art !== "schalter") ||
    // Die ADRESSE ist eine Systemspalte und trotzdem in der Zelle änderbar
    // (`inline`). Sie hat keine Katalogdefinition — sie ist die Identität des
    // Beitrags, nicht eine seiner Eigenschaften.
    spalte.inline
  ) {
    // Der Wert kommt über den FELDSCHLÜSSEL aus der Zeile, nicht über eine
    // Kette von Sonderfällen: bei achtzehn Textfeldern wäre die Kette
    // achtzehn Zweige lang, und ein vergessener Zweig ist eine Spalte, die
    // dauerhaft leer aussieht — genau der Fehler, der live gemeldet wurde
    // („warum ist das alles leer", 28.08.2026).
    const felder = beitrag as unknown as Record<string, unknown>;
    const roh =
      spalte.key === "published"
        ? // Das Datumsfeld bearbeitet man als ISO-Tag, nicht als formatiertes
          // Datum: „28. Aug. 2026" liesse sich nicht zuverlässig zurücklesen,
          // und ein falsch geparster Tag wäre eine stille Datenänderung
          // (Wurzel 4).
          (beitrag.published_at?.slice(0, 10) ?? "")
        : ((felder[spalte.key] as string | null) ?? "");
    return (
      <ZelleBearbeiten
        wert={
          // In RUHE zeigt die Datumszelle das formatierte Datum, in der
          // Bearbeitung den ISO-Tag. Zwei Darstellungen desselben Wertes —
          // eine zum Lesen, eine zum Tippen.
          spalte.key === "published" && !bearbeitet && beitrag.published_at
            ? datum(beitrag.published_at)
            : roh
        }
        mehrzeilig={konfig?.mehrzeilig ?? false}
        maxZeichen={konfig?.max_zeichen ?? null}
        ausgewaehlt={ausgewaehlt}
        bearbeitet={bearbeitet}
        platzhalter={konfig?.platzhalter ?? leerText}
        ariaLabel={feldLabel}
        onAuswaehlen={onAuswaehlen}
        onBearbeiten={onBearbeiten}
        onFertig={onFertig}
      />
    );
  }

  // Ein Schalter IST die Bedienung: ein Klick schreibt sofort (B8a).
  //
  // Der `Switch` aus `@nextdays/ui` und KEIN handgebauter: das Produkt hat
  // genau eine Schalter-Bauart, und eine zweite daneben wäre eine zweite
  // Wahrheit über Größe, Farbe und Tastaturverhalten (Wurzel 2). Er trägt
  // `bg-primary` — die Bedienfarbe. `--brand` wäre hier falsch: das ist die
  // Markenfarbe des KUNDEN (sie kommt aus dessen Branding), und ein Schalter
  // im CMS gehört nicht der Website, die damit gebaut wird.
  if (spalte.def?.art === "schalter") {
    return (
      <Switch
        checked={beitrag.show_on_homepage}
        aria-label={feldLabel}
        onClick={(e) => e.stopPropagation()}
        onCheckedChange={onSchalter}
        className="scale-75"
      />
    );
  }

  // --- Die Felder der Vorlage (0483) ---------------------------------------
  //
  // Sie stehen hier VOR dem `switch`, weil sie sich nach ART unterscheiden und
  // nicht nach Namen: vier Karussellbilder und zwei Einzelgalerien wären sonst
  // sechs gleichlautende `case`-Zweige.
  if (spalte.def && spalte.key !== "cover") {
    const p = beitrag as unknown as Record<string, unknown>;
    if (spalte.def.art === "galerie") {
      const bilder = (p[spalte.key] as string[] | null) ?? [];
      if (bilder.length === 0) {
        // Eine leere Galerie zeigt die PLATTE, kein Wort — wie im Vorbild
        // (Analyse A4: „eine leere Galerie zeigt eine graue Platzhalter-
        // Pille"). „Leer" als Text neben lauter Bildern liest sich als
        // Fehlermeldung.
        return <Miniatur url={null} />;
      }
      // Bis zu drei Miniaturen nebeneinander, der Rest als Zahl — genau wie im
      // Vorbild („Galerie-Zellen zeigen mehrere Miniaturbilder nebeneinander,
      // bis zu drei sichtbar, Rest abgeschnitten", Analyse A4).
      return (
        <span className="flex items-center gap-1">
          {bilder.slice(0, 3).map((url, i) => (
            <Miniatur key={`${url}-${i}`} url={url} />
          ))}
          {bilder.length > 3 ? (
            <span className="text-xs text-muted-foreground">
              +{bilder.length - 3}
            </span>
          ) : null}
        </span>
      );
    }
    if (spalte.def.art === "bild") {
      return <Miniatur url={(p[spalte.key] as string | null) ?? null} />;
    }
    if (spalte.def.art === "link" || spalte.def.art === "richtext") {
      const roh = p[spalte.key === "content" ? "content_html" : spalte.key] as
        | string
        | null;
      const text =
        spalte.def.art === "richtext" ? textAuszug(roh) : (roh ?? "");
      return (
        <span className="text-muted-foreground">
          {text || <span className="text-muted-foreground/60">{leerText}</span>}
        </span>
      );
    }
  }

  switch (spalte.key) {
    case "cover":
      return <Miniatur url={beitrag.cover_image_url} />;
    case "excerpt":
      return (
        <span className="text-muted-foreground">
          {textAuszug(beitrag.excerpt) || "—"}
        </span>
      );
    case "author":
      return <span>{beitrag.author || "—"}</span>;
    case "tags":
      return (
        <span className="text-muted-foreground">
          {(beitrag.tags ?? []).join(", ") || "—"}
        </span>
      );
    case "published":
      return (
        <span className="text-muted-foreground">
          {beitrag.published_at ? datum(beitrag.published_at) : "—"}
        </span>
      );
    case "created":
      return (
        <span className="text-muted-foreground">
          {beitrag.created_at ? datum(beitrag.created_at) : "—"}
        </span>
      );
    case "updated":
      return (
        <span className="text-muted-foreground">
          {beitrag.updated_at ? datum(beitrag.updated_at) : "—"}
        </span>
      );
    case "views":
      return (
        <span className="tabular-nums text-muted-foreground">
          {beitrag.view_count ?? 0}
        </span>
      );
    default:
      return null;
  }
}

/** Das Zeilenmenü — EIN Menü für Rechtsklick UND `⋯`.
 *
 *  Es steht bewusst nicht mehr als eigenes Popover im `⋯`-Knopf: der Knopf sass
 *  in der letzten Spalte, also bei 24 Feldern 3 750 px ausserhalb des Bildes,
 *  und der Rechtsklick auf die Zeile tat gar nichts. Im Vorbild ist der
 *  Rechtsklick der Hauptweg (`Edit · Open · Draft · Duplicate · Delete`).
 *
 *  Gebaut wie `SpaltenMenue`: fest am Mauszeiger, über allem, mit einer
 *  Schliessflaeche dahinter. Ein `absolute`-Menü in einer Zelle waere vom
 *  waagerechten Scrollrahmen beschnitten.
 *
 *  `Öffnen` heisst hier: die SEITE des Beitrags im Editor. Ein Beitrag IST
 *  eine Seite (`page_type = "post"`) — dasselbe wie im Vorbild, wo `Open` den
 *  verknüpften Entwurf auf der Arbeitsfläche zeigt. */
function ZeilenMenue({
  beitrag,
  x,
  y,
  disabled,
  onSchliessen,
  onBearbeiten,
  onOeffnenImEditor,
  onAufWebsiteAnsehen,
  liveDomain,
  onStatus,
  onDuplizieren,
  onLoeschen,
}: {
  beitrag: Page;
  x: number;
  y: number;
  disabled?: boolean;
  onSchliessen: () => void;
  onBearbeiten: () => void;
  onOeffnenImEditor: () => void;
  onAufWebsiteAnsehen: () => void;
  /** Die verbundene Live-Domain — ohne sie gibt es keine Adresse, die man
   *  ansehen könnte, und der Menüpunkt entfällt. */
  liveDomain: string | null;
  onStatus: () => void;
  onDuplizieren: () => void;
  onLoeschen: () => void;
}) {
  const t = useTranslations("website");
  const live = zustandVon(beitrag) === "live";
  // Der Kasten darf nicht aus dem Fenster laufen — dieselbe Rechnung wie im
  // Spaltenmenü.
  const links = Math.min(x, (globalThis.innerWidth || 1280) - 230);
  const oben = Math.min(y, (globalThis.innerHeight || 800) - 240);
  const punkte: {
    key: string;
    icon: string;
    label: string;
    gefahr?: boolean;
    lauf: () => void;
  }[] = [
    {
      key: "bearbeiten",
      icon: "ph:pencil-simple",
      label: t("blog.bearbeiten"),
      lauf: onBearbeiten,
    },
    // „Im Editor öffnen" (Framers `Open`). Es führt auf die SEITE des
    // Beitrags — ein Beitrag ist eine Seite (`page_type = "post"`) — und
    // trägt in `?beitrag=` mit, welcher Beitrag dort aufgehen soll.
    //
    // Der Parameter ist der Unterschied zwischen „geht" und „geht nicht":
    // ohne ihn landete man auf einem LEEREN Abschnitts-Editor, weil ein
    // Beitrag keine Abschnitte hat — sein Inhalt steht in `content_html` und
    // den Beitragsfeldern. Genau so wurde es gemeldet („wenn wir open im
    // editor klicken geht es nicht", 28.08.2026).
    {
      key: "oeffnen",
      icon: "ph:arrow-square-out",
      label: t("blog.cm.imEditorOeffnen"),
      lauf: onOeffnenImEditor,
    },
    // Dazu der Weg auf die veröffentlichte Seite. Er fehlt, solange es dort
    // nichts zu sehen gibt: ohne verbundene Domain oder bei einem Beitrag,
    // der nicht live ist, führte er ins Leere — und eine erfundene Adresse
    // wäre die schlechtere Antwort (Wurzel 4).
    ...(liveDomain && live && beitrag.slug
      ? [
          {
            key: "ansehen",
            icon: "ph:arrow-square-out",
            label: t("blog.cm.aufWebsiteAnsehen"),
            lauf: onAufWebsiteAnsehen,
          },
        ]
      : []),
    {
      key: "status",
      icon: live ? "ph:eye-slash" : "ph:globe",
      label: live ? t("blog.cm.alsEntwurf") : t("blog.cm.veroeffentlichen"),
      lauf: onStatus,
    },
    {
      key: "duplizieren",
      icon: "ph:copy",
      label: t("blog.duplizieren"),
      lauf: onDuplizieren,
    },
    {
      key: "loeschen",
      icon: "ph:trash",
      label: t("blog.loeschen"),
      gefahr: true,
      lauf: onLoeschen,
    },
  ];
  return (
    <>
      <button
        type="button"
        aria-label={t("blog.cm.close")}
        onMouseDown={onSchliessen}
        className="fixed inset-0 z-40 cursor-default"
      />
      <div
        role="menu"
        aria-label={t("blog.zeileMenue")}
        style={{ left: links, top: oben }}
        className="fixed z-50 flex w-56 flex-col rounded-(--radius) border border-border bg-background py-1 shadow-xl"
      >
        <p className="truncate px-3 py-1.5 text-xs text-muted-foreground">
          {beitrag.title || t("blog.cm.ohneTitel")}
        </p>
        {punkte.map((punkt) => (
          <span key={punkt.key} className="contents">
            {punkt.gefahr ? (
              <span aria-hidden className="my-1 block h-px bg-border" />
            ) : null}
            <button
              type="button"
              role="menuitem"
              disabled={disabled}
              onClick={() => {
                onSchliessen();
                punkt.lauf();
              }}
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-left text-sm transition disabled:opacity-40",
                punkt.gefahr
                  ? "text-destructive hover:bg-destructive/10"
                  : "hover:bg-secondary/60",
              )}
            >
              <Icon icon={punkt.icon} className="size-4" />
              {punkt.label}
            </button>
          </span>
        ))}
      </div>
    </>
  );
}


/** Die Sammelaktionen bei Zeilenauswahl (Framer A3/B9).
 *
 *  Sie ERSETZT den „+"-Knopf, statt daneben zu stehen — im Vorbild genauso
 *  („Bei Zeilenauswahl wird `+` ersetzt durch `N Selected ⌄`"). Zwei Angebote
 *  für zwei verschiedene Absichten an derselben Stelle wären eine
 *  Verwechslung, die etwas löscht.
 *
 *  Die Einträge folgen B9 (`Add To Agent` · `Draft` · `Undraft` · `Duplicate`
 *  · `Delete`) ohne den KI-Eintrag: „Add To Agent" ist Framers Assistent und
 *  nicht unser Produkt. */
function SammelLeiste({
  anzahl,
  disabled,
  onAufheben,
  onEntwurf,
  onVeroeffentlichen,
  onDuplizieren,
  onLoeschen,
}: {
  anzahl: number;
  disabled?: boolean;
  onAufheben: () => void;
  onEntwurf: () => void;
  onVeroeffentlichen: () => void;
  onDuplizieren: () => void;
  onLoeschen: () => void;
}) {
  const t = useTranslations("website");
  return (
    <div className="flex items-center gap-1">
      <span className="rounded-full bg-(--brand)/10 px-2.5 py-1 text-xs font-medium text-(--brand)">
        {t("blog.auswahl.markiert", { anzahl })}
      </span>
      <button
        type="button"
        disabled={disabled}
        onClick={onEntwurf}
        className="rounded-(--radius) px-2 py-1 text-xs text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-40"
      >
        {t("blog.auswahl.entwurf")}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={onVeroeffentlichen}
        className="rounded-(--radius) px-2 py-1 text-xs text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-40"
      >
        {t("blog.auswahl.veroeffentlichen")}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={onDuplizieren}
        className="rounded-(--radius) px-2 py-1 text-xs text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-40"
      >
        {t("blog.auswahl.duplizieren")}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={onLoeschen}
        className="rounded-(--radius) px-2 py-1 text-xs text-destructive transition hover:bg-secondary disabled:opacity-40"
      >
        {t("blog.auswahl.loeschen")}
      </button>
      <button
        type="button"
        aria-label={t("blog.auswahl.aufheben")}
        title={t("blog.auswahl.aufheben")}
        onClick={onAufheben}
        className="inline-flex size-7 items-center justify-center rounded-(--radius) text-muted-foreground transition hover:bg-secondary hover:text-foreground"
      >
        <Icon icon="ph:x" className="size-3.5" />
      </button>
    </div>
  );
}
