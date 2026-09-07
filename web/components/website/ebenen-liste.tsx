"use client";

// Die Ebenen („Layers") — der ECHTE Baum der Seite, im Aufbau von Framer.
//
//     ⌂ Startseite ⌄                       ← Seitenwahl
//     🔍 Ebenen durchsuchen
//     ⌄ ▭ Desktop                ab 1024   ← Breakpoint-Wurzel (aktiv, offen)
//         ⌄ ☰ Abschnitt · Titelbild
//             ⌄ ▢ Inhalt
//                 ▨ Titelbild
//       › ▭ Tablet           1023 — 768
//       › ▭ Mobil              767 — 0
//
// UMBAU 05.09.2026 (Etappe 1 der Framer-Parität, gemessen an Framer live —
// docs/FRAMER-LAYERS-INSPEKTOR-ANALYSE.md — und an den 28 Befunden in
// docs/BAUKASTEN-EBENEN-BEFUNDE-2026-09-05.md):
//
// 1. EINE QUELLE. Der Baum bekommt `blocks` aus `anzeigeBloecke()`: Container
//    vom Server, Bausteine aus der Bearbeitungsliste des Editors. Vorher las er
//    nur den Server-Stand und sah keine einzige Bausteinänderung, bis man die
//    Seite neu lud (Befund 1/2/12).
// 2. EINE AUSWAHL. `aktiv` ist die Kennung JEDER Ebene — Baustein oder
//    Container. Vorher war ein gewählter Container im Baum unsichtbar, und die
//    Kürzel ⌘D/⌘L/⌘;/⌘R konnten ihn nie erreichen (Befund 7/16/17).
// 3. BREAKPOINTS ALS WURZELN wie in Framer: Desktop · Tablet · Mobil mit ihrem
//    Breitenbereich. Die aktive Wurzel ist offen und trägt den Baum; ein Klick
//    auf eine andere schaltet die Vorschau um. Das Auge je Gerät bleibt — es ist
//    die feinere Einstellung, und der Breakpoint zeigt, wofür es gerade gilt.
// 4. ZEILEN 30 px, Einrückung 21 px je Ebene, Symbol nach Art: Abschnitt und
//    Spalten sind Stapel bzw. Rahmen in der Markenfarbe, der Baustein trägt sein
//    Katalogsymbol. Auswahl VOLLTON mit weißer Schrift, ihr Teilbaum hell
//    hinterlegt — die zwei Stufen, an denen man ohne Aufklappen sieht, was
//    gewählt ist und was dazugehört. Keine Führungslinien mehr: der hinterlegte
//    Teilbaum zeigt die Tiefe.
// 5. RECHTSKLICK-MENÜ mit Suchfeld und Framers Gruppen: Elternteil · Duplizieren
//    ⌘D · Löschen ⌫ · Umbenennen ⌘R · Sperren ⌘L · Verstecken ⌘; · Nach oben/
//    unten ⌥↑/⌥↓. Jedes Kürzel ist echt gebunden, für JEDE Ebene.
// 6. TASTATUR im Baum: ↑/↓ wandern, → klappt auf, ← klappt zu bzw. springt zum
//    Elternteil. ⌫ löscht nur OHNE ⌘ (⌘⌫ ist in macOS „in den Papierkorb" und
//    traf hier vorher die Ebene, Befund 18).
// 7. MEHRFACHAUSWAHL mit ⇧-Klick; Löschen, Sperren, Verstecken und Duplizieren
//    wirken dann auf alle gewählten Ebenen.
// 8. ZIEHEN über `zugPruefen()` — mit Zyklusschutz (Befund 10: der Tab fror
//    bei a→b→a ein), gesperrtem Ziel (Befund 13) und einem GRUND für jede
//    Ablehnung, der als Hinweis an der Zeile steht statt still zu verschwinden.
// 9. Die gewählte Zeile wird ins Sichtfeld gescrollt (Befund 8), und jeder
//    Handgriff schreibt eine Zeile ins Protokoll (Befund 28).
//
// Was der Baum NICHT tut: Bausteine ändern. Er meldet, der Editor setzt um —
// ein zweiter Schreibweg auf dieselben Zeilen wäre die Doppelung, gegen die
// Wurzel 2 steht.

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import {
  type DragEvent as ReactDragEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { Block, Page } from "@/lib/site-pages";

import { abschnittFuer } from "./abschnitte";
import {
  type BaumKnoten,
  type ZugStelle,
  baumSortiert,
  bausteineDarunter,
  elternKette,
  sichtbareReihenfolge,
  zugPruefen,
} from "./ebenen-baum";
import { EINRUECKUNG_REM, GRUND_REM, ZEILE } from "./ebenen-masse";
import { RegionBaum, type RegionAuswahl } from "./ebenen-regionen";
import { protokoll } from "./editor/protokoll";
import {
  GERAETE,
  GERAETE_BEREICHE,
  umgeschaltet,
  versteckteGeraete,
} from "./editor/sichtbarkeit";
import type { Geraet } from "./vorschau";
import type { Region, RegionStand } from "@nextdays/baukasten-stil";

/** Was ein Handgriff auslöst. Der Editor setzt es um — die Liste kennt weder
 *  Schlüssel noch Reihenfolge der Bearbeitungszeilen. */
export type EbenenAktion =
  | "hoch"
  | "runter"
  | "duplizieren"
  | "entfernen"
  | "umbenennen"
  | "sperren"
  | "verstecken"
  // Framer-Kontextmenü (Vollerfassung §15, 06.09.2026): Copy Style ⌥⌘C ·
  // Paste Style ⌥⌘V · Overflow ▸ Clip/Visible/Hidden/Scroll.
  | "stilKopieren"
  | "stilEinfuegen"
  | "ueberlaufAbschneiden"
  | "ueberlaufSichtbar"
  | "ueberlaufVerborgen"
  | "ueberlaufScrollen";

/** Die vier Überlauf-Handgriffe → der Wert in `settings.stil.ueberlauf`. */
export const UEBERLAUF_AKTION: Record<
  Extract<EbenenAktion, `ueberlauf${string}`>,
  "abschneiden" | "sichtbar" | "verborgen" | "scrollen"
> = {
  ueberlaufAbschneiden: "abschneiden",
  ueberlaufSichtbar: "sichtbar",
  ueberlaufVerborgen: "verborgen",
  ueberlaufScrollen: "scrollen",
};

/** Ein Ziehvorgang im Baum: WAS soll WOHIN. „vor"/„nach" ordnen auf derselben
 *  Ebene, „hinein" legt in einen Container. */
export type EbenenZug = {
  quelleId: string;
  zielId: string;
  wohin: ZugStelle;
};

/** MIME-Art des Ziehvorgangs. Sie wird beim Ziehen GESETZT und beim Abwurf
 *  GEPRÜFT — vorher nur gesetzt (Befund 14), und die Trennung vom Katalog-Zug
 *  (`text/plain`) leistete allein der lokale Zustand. */
export const EBENEN_DRAG_TYP = "application/x-nextdays-ebene";

/** Die Menüeinträge in Framers Reihenfolge, mit Kürzel. */
const MENUE: readonly {
  aktion: EbenenAktion | "elternteil" | "geschwister";
  icon: string;
  schluessel: string;
  kuerzel: string;
  gefahr?: boolean;
  gruppe: number;
}[] = [
  {
    aktion: "elternteil",
    icon: "ph:arrow-elbow-left-up",
    schluessel: "elternteil",
    kuerzel: "←",
    gruppe: 0,
  },
  {
    aktion: "geschwister",
    icon: "ph:selection-all",
    schluessel: "geschwisterWaehlen",
    kuerzel: "⇧⌘A",
    gruppe: 0,
  },
  {
    aktion: "duplizieren",
    icon: "ph:copy",
    schluessel: "duplizieren",
    kuerzel: "⌘D",
    gruppe: 1,
  },
  {
    aktion: "entfernen",
    icon: "ph:trash",
    schluessel: "entfernen",
    kuerzel: "⌫",
    gefahr: true,
    gruppe: 1,
  },
  {
    aktion: "umbenennen",
    icon: "ph:cursor-text",
    schluessel: "umbenennen",
    kuerzel: "⌘R",
    gruppe: 2,
  },
  {
    aktion: "sperren",
    icon: "ph:lock-simple",
    schluessel: "sperren",
    kuerzel: "⌘L",
    gruppe: 2,
  },
  {
    aktion: "verstecken",
    icon: "ph:eye-slash",
    schluessel: "verstecken",
    kuerzel: "⌘;",
    gruppe: 2,
  },
  {
    aktion: "hoch",
    icon: "ph:arrow-up",
    schluessel: "nachOben",
    kuerzel: "⌥↑",
    gruppe: 3,
  },
  {
    aktion: "runter",
    icon: "ph:arrow-down",
    schluessel: "nachUnten",
    kuerzel: "⌥↓",
    gruppe: 3,
  },
  {
    aktion: "stilKopieren",
    icon: "ph:paint-brush",
    schluessel: "stilKopieren",
    kuerzel: "⌥⌘C",
    gruppe: 4,
  },
  {
    aktion: "stilEinfuegen",
    icon: "ph:paint-bucket",
    schluessel: "stilEinfuegen",
    kuerzel: "⌥⌘V",
    gruppe: 4,
  },
  {
    aktion: "ueberlaufAbschneiden",
    icon: "ph:crop",
    schluessel: "ueberlaufAbschneiden",
    kuerzel: "",
    gruppe: 5,
  },
  {
    aktion: "ueberlaufSichtbar",
    icon: "ph:eye",
    schluessel: "ueberlaufSichtbar",
    kuerzel: "",
    gruppe: 5,
  },
  {
    aktion: "ueberlaufVerborgen",
    icon: "ph:eye-closed",
    schluessel: "ueberlaufVerborgen",
    kuerzel: "",
    gruppe: 5,
  },
  {
    aktion: "ueberlaufScrollen",
    icon: "ph:arrows-vertical",
    schluessel: "ueberlaufScrollen",
    kuerzel: "",
    gruppe: 5,
  },
];

// AUSWAHLFARBE: Framers Akzent `#0099ff`, nicht die Markenfarbe des
// Dashboards (06.09.2026). Der Grund ist nicht Geschmack: dieselbe Auswahl
// erscheint gleichzeitig auf der FLÄCHE und hier im Baum. Stünde sie dort blau
// und hier rot, sähe es aus wie zwei verschiedene Dinge — und genau das war
// der Zustand, bis die Fläche auf Framers Kante umgestellt wurde.

/** Symbol je TEIL-Feld. Die Schlüssel sind die Feldnamen aus dem Katalog
 *  (`abschnitte.ts`); was hier fehlt, bekommt das Textsymbol — ein Teil ohne
 *  eigenes Bild ist immer noch eine Textstelle. */
const TEIL_SYMBOL: Record<string, string> = {
  heading: "ph:text-h",
  subheading: "ph:text-h-two",
  eyebrow: "ph:text-t",
  title: "ph:text-h",
  text: "ph:text-align-left",
  body: "ph:text-align-left",
  cta_label: "ph:cursor-click",
  cta_href: "ph:link",
  button_label: "ph:cursor-click",
  image_url: "ph:image",
  url: "ph:image",
  alt: "ph:text-aa",
  video_url: "ph:video",
  quote: "ph:quotes",
  name: "ph:user",
  role: "ph:identification-badge",
  label: "ph:tag",
  price: "ph:currency-eur",
};

/** Symbol je ART eines Struktur-Knotens — dieselben Begriffe wie in Framers
 *  Einfügemenü (Frame · Stack · Grid · Masonry · Image · Video). */
const ART_SYMBOL: Record<string, string> = {
  frame: "ph:square",
  stack: "ph:rows",
  grid: "ph:grid-four",
  masonry: "ph:squares-four",
  bild: "ph:image",
  video: "ph:video",
  link: "ph:link",
  knopf: "ph:cursor-click",
  ueberschrift: "ph:text-h",
  text: "ph:text-align-left",
};

/** Symbol je Art. Abschnitt = Stapel (Richtung aus `layout_richtung`), Spalte
 *  = Rahmen, Baustein = sein Katalogsymbol. Framer: Stack/Frame blau, Inhalt
 *  grau. */
function symbolFuer(k: BaumKnoten): { icon: string; farbe: string } {
  if (k.art === "widget") {
    return {
      icon: abschnittFuer(k.block.type)?.icon ?? "ph:cube",
      farbe: "text-muted-foreground",
    };
  }
  if (k.art === "section") {
    return {
      icon:
        k.block.settings?.layout_richtung === "zeile"
          ? "ph:columns"
          : "ph:rows",
      farbe: "text-[#0099ff]",
    };
  }
  return { icon: "ph:square", farbe: "text-[#0099ff]" };
}

/** 30-px-Zeile, 21 px Einrückung je Ebene (Framer, gemessen 05.09.2026). */

export function EbenenListe({
  blocks,
  aktiv,
  geraet,
  onGeraet,
  seiten,
  seiteId,
  onSeite,
  onWaehle,
  onAktion,
  onZiehen,
  onUmbenennen,
  onVersteckt,
  teileVonBlock,
  teilAktiv = null,
  onTeilWaehle,
  onSiteLayout,
  kopfzeile,
  fusszeile,
  regionAuswahl = null,
  onRegionWaehle,
  onRegionVersteckt,
  onRegionSperren,
  onRegionZiehen,
}: {
  /** Die FLACHEN Zeilen aus `anzeigeBloecke()` — Container UND Bausteine. */
  blocks: Block[];
  /** Kennung der gewählten Ebene — Baustein oder Container. */
  aktiv: string | null;
  geraet: Geraet;
  /** Klick auf eine Breakpoint-Wurzel schaltet die Vorschau um. */
  onGeraet: (g: Geraet) => void;
  /** Für die Seitenwahl im Kopf (Framer: `⌂ Home ⌄`). */
  seiten: readonly Page[];
  seiteId: string;
  onSeite: (id: string) => void;
  onWaehle: (id: string | null) => void;
  /** Fehlt sie, zeigt die Zeile kein Menü. Kein Knopf ins Leere. */
  onAktion?: (id: string, aktion: EbenenAktion) => void;
  onZiehen?: (zug: EbenenZug) => void;
  /** Eigener Name für JEDE Ebene (Framer benennt auch Text- und Bildebenen). */
  onUmbenennen?: (id: string, name: string | null) => void;
  onVersteckt?: (id: string, geraete: Geraet[]) => void;
  /** Die STRUKTUR eines Bausteins — jeder Knoten mit eigener Box, dazu Bilder
   *  und Videos (06.09.2026). Sie kommt aus der MESSUNG der Brücke, nicht aus
   *  dem Katalog: gezeigt wird, was auf dieser Seite wirklich gerendert ist,
   *  nicht was der Baustein theoretisch könnte (Wurzel 4).
   *
   *  `eltern` verkettet die Knoten untereinander; so steht im Baum dieselbe
   *  Verschachtelung wie auf der Seite — von der äußeren Kiste bis zum
   *  einzelnen Wort. */
  teileVonBlock?: ReadonlyMap<
    string,
    readonly {
      feld: string;
      eltern: string | null;
      art: string;
      marke: string | null;
    }[]
  >;
  /** Der gewählte Teil, als `<blockId>#<feld>`. */
  teilAktiv?: string | null;
  onTeilWaehle?: (blockId: string, feld: string) => void;
  onSiteLayout?: () => void;
  /** Kopf- und Fußzeile als aufklappbare Ebenen (0570). Fehlen sie, stehen
   *  die beiden Zeilen wie bisher als Verweis auf das Site-Layout. */
  kopfzeile?: RegionStand;
  fusszeile?: RegionStand;
  regionAuswahl?: RegionAuswahl | null;
  onRegionWaehle?: (auswahl: RegionAuswahl) => void;
  onRegionVersteckt?: (auswahl: RegionAuswahl, geraete: Geraet[]) => void;
  onRegionSperren?: (auswahl: RegionAuswahl, locked: boolean) => void;
  onRegionZiehen?: (region: Region, teil: string, vorTeil: string) => void;
}) {
  const t = useTranslations("website");
  const [zu, setZu] = useState<Set<string>>(new Set());
  const [benennt, setBenennt] = useState<{ id: string; wert: string } | null>(
    null,
  );
  const [suche, setSuche] = useState("");
  /** Zusätzlich gewählte Ebenen (⇧-Klick). `aktiv` ist immer die primäre. */
  const [mitgewaehlt, setMitgewaehlt] = useState<Set<string>>(new Set());
  const [menue, setMenue] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const [menueSuche, setMenueSuche] = useState("");
  const zeilenRefs = useRef(new Map<string, HTMLElement>());
  /** Der Baum als Element — und ob der letzte Mausklick DARIN lag.
   *
   *  Die Kürzel hängen an `window`, weil der Fokus nach einem Klick auf der
   *  Fläche nirgends liegt. Sie gelten aber nur, solange der Baum das zuletzt
   *  bediente Bauteil ist: ein ⌫ mit Fokus auf einer Klappliste im Inspektor
   *  löschte sonst die Ebene, und ⌘R nahm dem Browser das Neuladen weg,
   *  sobald irgendeine Ebene gewählt war (Prüfbefunde A5/A6). */
  const baumRef = useRef<HTMLDivElement>(null);
  const zuletztImBaum = useRef(false);
  useEffect(() => {
    function aufMaus(e: MouseEvent) {
      zuletztImBaum.current = Boolean(
        baumRef.current?.contains(e.target as Node),
      );
    }
    window.addEventListener("mousedown", aufMaus, true);
    return () => window.removeEventListener("mousedown", aufMaus, true);
  }, []);

  const baum = useMemo(() => baumSortiert(blocks), [blocks]);
  const nachId = useMemo(() => new Map(blocks.map((b) => [b.id, b])), [blocks]);
  const alleGewaehlt = useMemo(() => {
    // Nur Kennungen, die es noch gibt: nach Duplizieren, Ziehen oder einem
    // Server-Refresh blieben sonst tote IDs in der Menge und die Anzeige
    // zählte „4 Ebenen gewählt", wo zwei stehen (Prüfbefund A9).
    const menge = new Set([...mitgewaehlt].filter((id) => nachId.has(id)));
    if (aktiv && nachId.has(aktiv)) menge.add(aktiv);
    return menge;
  }, [aktiv, mitgewaehlt, nachId]);

  // Die Mehrfachauswahl fällt, sobald der Editor eine andere primäre Auswahl
  // setzt (Klick auf der Fläche, in der Abschnittsliste) — sonst hinge eine
  // alte Menge an einer neuen Auswahl.
  const vorherAktiv = useRef(aktiv);
  useEffect(() => {
    if (vorherAktiv.current !== aktiv) {
      vorherAktiv.current = aktiv;
      setMitgewaehlt((m) => (m.size && aktiv && !m.has(aktiv) ? new Set() : m));
    }
  }, [aktiv]);

  // Die gewählte Zeile ins Sichtfeld (Befund 8) — samt Aufklappen ihrer
  // Vorfahren, sonst liegt sie in einem zugeklappten Zweig und ist unsichtbar.
  //
  // Am 06.09.2026 bei Framer nachgemessen (Klick auf die Fußzeile im Canvas):
  // der Baum klappt die KETTE auf, klappt den gewählten Knoten SELBST auf und
  // scrollt gerade so weit, dass die Zeile sichtbar wird (`nearest`, nicht
  // zentriert) — der Baum springt also nie unnötig. Offene Zweige bleiben
  // offen. Genau das steht hier.
  useEffect(() => {
    if (!aktiv) return;
    const eltern = elternKette(blocks, aktiv);
    setZu((s) => {
      // Auch den Knoten SELBST öffnen: wer ihn auf der Fläche anfasst, will
      // als Nächstes sehen, was darin liegt (Framer macht es genauso).
      const zuOeffnen = [...eltern, aktiv];
      if (!zuOeffnen.some((e) => s.has(e))) return s;
      const n = new Set(s);
      for (const e of zuOeffnen) n.delete(e);
      return n;
    });
    const raf = requestAnimationFrame(() => {
      zeilenRefs.current.get(aktiv)?.scrollIntoView({ block: "nearest" });
    });
    return () => cancelAnimationFrame(raf);
  }, [aktiv, blocks]);

  // Dasselbe für einen gewählten TEIL (06.09.2026): seine Zeile hängt unter
  // dem Baustein und hat keine DB-Kennung, sondern `<blockId>#<feld>`. Ohne
  // diesen Effekt bliebe sie in einem zugeklappten Baustein unsichtbar —
  // man wählte auf der Fläche eine Überschrift, und der Baum zeigte weiter
  // irgendwohin.
  useEffect(() => {
    if (!teilAktiv) return;
    const blockId = teilAktiv.split("#")[0];
    if (!blockId) return;
    const eltern = elternKette(blocks, blockId);
    setZu((s) => {
      const zuOeffnen = [...eltern, blockId];
      if (!zuOeffnen.some((e) => s.has(e))) return s;
      const n = new Set(s);
      for (const e of zuOeffnen) n.delete(e);
      return n;
    });
    const raf = requestAnimationFrame(() => {
      zeilenRefs.current.get(teilAktiv)?.scrollIntoView({ block: "nearest" });
    });
    return () => cancelAnimationFrame(raf);
  }, [teilAktiv, blocks]);

  /** Alle Kennungen UNTER der Auswahl — für die helle Hinterlegung. */
  const teilbaum = useMemo(() => {
    const treffer = new Set<string>();
    const kinderVon = new Map<string, string[]>();
    for (const b of blocks) {
      if (!b.parent_id) continue;
      kinderVon.set(b.parent_id, [...(kinderVon.get(b.parent_id) ?? []), b.id]);
    }
    for (const wurzel of alleGewaehlt) {
      const stapel = [...(kinderVon.get(wurzel) ?? [])];
      while (stapel.length) {
        const id = stapel.pop() as string;
        if (treffer.has(id)) continue;
        treffer.add(id);
        stapel.push(...(kinderVon.get(id) ?? []));
      }
    }
    return treffer;
  }, [alleGewaehlt, blocks]);

  /** Filter: Treffer, ihre Vorfahren und ihre Nachkommen. `null` = kein Filter. */
  const sichtbar = useMemo<Set<string> | null>(() => {
    const text = suche.trim().toLowerCase();
    if (!text) return null;
    const treffer = new Set<string>();
    const kinderVon = new Map<string, string[]>();
    for (const b of blocks) {
      if (!b.parent_id) continue;
      kinderVon.set(b.parent_id, [...(kinderVon.get(b.parent_id) ?? []), b.id]);
    }
    const passt = (b: Block) => {
      const eigener =
        typeof b.settings?.name === "string" ? b.settings.name : "";
      const meta = abschnittFuer(b.type);
      const typname = meta ? t(`abschnitte.${meta.label}`) : b.type;
      return (
        eigener.toLowerCase().includes(text) ||
        typname.toLowerCase().includes(text) ||
        t(`ebenen.${b.kind ?? "widget"}`)
          .toLowerCase()
          .includes(text)
      );
    };
    for (const b of blocks) {
      if (!passt(b)) continue;
      treffer.add(b.id);
      for (const e of elternKette(blocks, b.id)) treffer.add(e);
      const stapel = [...(kinderVon.get(b.id) ?? [])];
      while (stapel.length) {
        const id = stapel.pop() as string;
        if (treffer.has(id)) continue;
        treffer.add(id);
        stapel.push(...(kinderVon.get(id) ?? []));
      }
    }
    return treffer;
  }, [blocks, suche, t]);

  /** Die Kennungen in Anzeigereihenfolge — für ↑/↓. */
  const reihenfolge = useMemo(
    () =>
      sichtbareReihenfolge(baum, sichtbar ? new Set() : zu).filter(
        (id) => !sichtbar || sichtbar.has(id),
      ),
    [baum, sichtbar, zu],
  );

  function umklappen(id: string) {
    setZu((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  /** Einen Handgriff auf ALLE gewählten Ebenen anwenden (Mehrfachauswahl). */
  function ausfuehren(aktion: EbenenAktion, ziel: string) {
    const ziele = alleGewaehlt.has(ziel) ? [...alleGewaehlt] : [ziel];
    protokoll("klick", "Ebenen-Handgriff", { aktion, ziele });
    if (aktion === "umbenennen") {
      const block = nachId.get(ziel);
      const eigen =
        typeof block?.settings?.name === "string" ? block.settings.name : "";
      setBenennt({ id: ziel, wert: eigen });
      return;
    }
    // Reihenfolge je Aktion: Löschen/Duplizieren/Runter von unten nach oben,
    // Hoch von oben nach unten — sonst verrutschen die Indizes der übrigen
    // Zeilen unter der Hand, und drei Ebenen „hoch" blieben, wo sie waren
    // (Prüfbefund A3).
    const vonOben = aktion === "hoch";
    const geordnet = ziele.sort((a, b) =>
      vonOben
        ? reihenfolge.indexOf(a) - reihenfolge.indexOf(b)
        : reihenfolge.indexOf(b) - reihenfolge.indexOf(a),
    );
    // Sperren/Verstecken sind UMSCHALTER je Ebene. Bei mehreren gibt der
    // Zustand der geklickten Ebene das Ziel vor: nur die, die noch gleich
    // stehen, werden umgeschaltet — sonst kippten drei Ebenen in drei
    // Richtungen (Prüfbefund A4).
    const zustand = (id: string) => {
      const st = nachId.get(id)?.settings ?? {};
      return aktion === "sperren"
        ? st.locked === true
        : versteckteGeraete(st).length > 0;
    };
    const umschalter = aktion === "sperren" || aktion === "verstecken";
    const start = zustand(ziel);
    for (const id of geordnet) {
      if (umschalter && zustand(id) !== start) continue;
      onAktion?.(id, aktion);
    }
    if (aktion === "entfernen") setMitgewaehlt(new Set());
  }

  function elternteilWaehlen(id: string) {
    const [eltern] = elternKette(blocks, id);
    if (eltern) onWaehle(eltern);
  }

  /** Framer „Select All Siblings" ⇧⌘A: alle Kinder desselben Elternteils. */
  function geschwisterWaehlen(id: string) {
    const block = nachId.get(id);
    if (!block) return;
    const geschwister = blocks.filter(
      (b) => (b.parent_id ?? null) === (block.parent_id ?? null) && b.id !== id,
    );
    onWaehle(id);
    setMitgewaehlt(new Set(geschwister.map((b) => b.id)));
  }

  // --- Tastatur ------------------------------------------------------------
  useEffect(() => {
    function tastatur(e: KeyboardEvent) {
      if (!aktiv || !nachId.has(aktiv)) return;
      if (!zuletztImBaum.current) return;
      const ziel = e.target as HTMLElement | null;
      if (
        ziel &&
        (ziel.tagName === "INPUT" ||
          ziel.tagName === "TEXTAREA" ||
          ziel.tagName === "SELECT" ||
          ziel.isContentEditable ||
          ziel.closest?.("[role=combobox],[role=dialog],[role=menu]"))
      ) {
        return;
      }
      const meta = e.metaKey || e.ctrlKey;
      const taste = e.key.toLowerCase();
      const greife = (aktion: EbenenAktion) => {
        e.preventDefault();
        ausfuehren(aktion, aktiv);
      };
      if (meta && e.altKey && taste === "c") greife("stilKopieren");
      else if (meta && e.altKey && taste === "v") greife("stilEinfuegen");
      else if (meta && e.shiftKey && taste === "a") {
        e.preventDefault();
        geschwisterWaehlen(aktiv);
      } else if (meta && taste === "d") greife("duplizieren");
      else if (meta && taste === "l") greife("sperren");
      else if (meta && e.key === ";") greife("verstecken");
      else if (meta && taste === "r") greife("umbenennen");
      else if (
        !meta &&
        !e.altKey &&
        (e.key === "Backspace" || e.key === "Delete")
      ) {
        greife("entfernen");
      } else if (e.altKey && e.key === "ArrowUp") greife("hoch");
      else if (e.altKey && e.key === "ArrowDown") greife("runter");
      else if (
        !meta &&
        !e.altKey &&
        (e.key === "ArrowUp" || e.key === "ArrowDown")
      ) {
        const i = reihenfolge.indexOf(aktiv);
        const naechste = reihenfolge[i + (e.key === "ArrowDown" ? 1 : -1)];
        if (naechste) {
          e.preventDefault();
          onWaehle(naechste);
        }
      } else if (!meta && e.key === "ArrowRight") {
        if (zu.has(aktiv)) {
          e.preventDefault();
          umklappen(aktiv);
        }
      } else if (!meta && e.key === "ArrowLeft") {
        e.preventDefault();
        const hatKinder = blocks.some((b) => b.parent_id === aktiv);
        if (hatKinder && !zu.has(aktiv)) umklappen(aktiv);
        else elternteilWaehlen(aktiv);
      }
    }
    window.addEventListener("keydown", tastatur);
    return () => window.removeEventListener("keydown", tastatur);
    // `ausfuehren`/`elternteilWaehlen` sind Closures über denselben Zustand,
    // den die Abhängigkeiten schon abdecken.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    aktiv,
    alleGewaehlt,
    blocks,
    nachId,
    reihenfolge,
    zu,
    onAktion,
    onWaehle,
  ]);

  // --- Ziehen ---------------------------------------------------------------
  const [zieht, setZieht] = useState<string | null>(null);
  const [ueberZiel, setUeberZiel] = useState<EbenenZug | null>(null);
  /** Der Grund, warum das Ziel unter dem Zeiger NICHT nimmt — als Hinweis an
   *  der Zeile. Ein stummer Drop ist ein verschluckter Fehler (Befund 11). */
  const [abgelehnt, setAbgelehnt] = useState<{
    id: string;
    grund: string;
  } | null>(null);

  function stelleAus(e: ReactDragEvent, zielId: string): ZugStelle {
    const kasten = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const anteil = (e.clientY - kasten.top) / Math.max(1, kasten.height);
    const zielArt = nachId.get(zielId)?.kind ?? "widget";
    const nimmtAuf = zielArt === "column" || zielArt === "inner_column";
    if (nimmtAuf && anteil > 0.25 && anteil < 0.75) return "hinein";
    return anteil < 0.5 ? "vor" : "nach";
  }

  /** Der Name eines TEILS. Er kommt aus dem Katalog des Bausteins
   *  (`abschnitte.ts` → `felder[].label` → `website.felder.*`), damit im Baum
   *  dasselbe Wort steht wie im Inhalt-Dialog. Kennt der Katalog das Feld
   *  nicht, steht der Schlüssel da — das ist ehrlicher als ein erfundener
   *  Name, und es zeigt zugleich, wo ein Label fehlt (Wurzel 4). */
  function teilName(
    typ: string,
    feld: string,
    art?: string,
    marke?: string | null,
  ): string {
    const meta = abschnittFuer(typ as Parameters<typeof abschnittFuer>[0]);
    const eintrag = meta?.felder.find((f) => f.key === feld);
    if (eintrag) return t(`felder.${eintrag.label}`);
    // Ein Knoten OHNE Feldnamen (eine Kiste, ein Bild): seine Art plus, wenn
    // er Text trägt, dessen Anfang — „Stapel · Jetzt buchen". Der reine Pfad
    // (`c1_3_2`) stünde sonst als Nummer da und sagte nichts.
    const artName = art ? t(`ebenen.art.${art}`) : feld;
    return marke ? `${artName} · ${marke}` : artName;
  }

  // --- Benennung -------------------------------------------------------------
  function benennen(
    k: BaumKnoten,
    eltern: BaumKnoten | null,
  ): { name: string; zusatz: string | null } {
    const eigener = k.block.settings?.name;
    if (typeof eigener === "string" && eigener.trim()) {
      return { name: eigener.trim(), zusatz: null };
    }
    if (k.art === "widget") {
      const meta = abschnittFuer(k.block.type);
      return {
        name: meta
          ? t(`abschnitte.${meta.label}`)
          : t("editor.unbekannterAbschnitt"),
        zusatz: null,
      };
    }
    if (k.art === "column" || k.art === "inner_column") {
      const geschwister = (eltern?.kinder ?? []).filter(
        (g) => g.art === "column" || g.art === "inner_column",
      );
      if (geschwister.length <= 1)
        return { name: t("ebenen.inhalt"), zusatz: null };
      const nr = geschwister.findIndex((g) => g.block.id === k.block.id) + 1;
      return {
        name: t(
          k.art === "inner_column"
            ? "ebenen.innereSpalteNr"
            : "ebenen.spalteNr",
          { nr },
        ),
        zusatz: null,
      };
    }
    const name = t("ebenen.section");
    const inhalte = bausteineDarunter(k)
      .map((w) => abschnittFuer(w.block.type))
      .filter((m): m is NonNullable<typeof m> => Boolean(m))
      .map((m) => t(`abschnitte.${m.label}`));
    if (inhalte.length === 0) return { name, zusatz: null };
    return {
      name,
      zusatz:
        inhalte.length <= 2
          ? inhalte.join(" · ")
          : `${inhalte.slice(0, 2).join(" · ")} +${inhalte.length - 2}`,
    };
  }

  /** Die Ebenen INNERHALB eines Bausteins, rekursiv — von der äußeren Kiste
   *  bis zum einzelnen Wort (06.09.2026).
   *
   *  Sie haben keine DB-Zeile: ihre Kennung ist `<blockId>#<schlüssel>`, ihre
   *  Darstellung steht in `settings.teile.<schlüssel>`. Deshalb sind sie nicht
   *  ziehbar und nicht löschbar — ein Teil gehört zum Baustein; man kann es
   *  gestalten, aber nicht herausnehmen. */
  function teilZeilen(
    blockId: string,
    typ: string,
    alle: readonly {
      feld: string;
      eltern: string | null;
      art: string;
      marke: string | null;
    }[],
    eltern: string | null,
    tiefe: number,
  ): ReactNode {
    const kinder = alle.filter((x) => (x.eltern ?? null) === eltern);
    if (kinder.length === 0) return null;
    return (
      <div>
        {kinder.map((knoten) => {
          const kennung = `${blockId}#${knoten.feld}`;
          const gewaehltesTeil = teilAktiv === kennung;
          return (
            <div key={kennung}>
              <button
                ref={(el) => {
                  if (el) zeilenRefs.current.set(kennung, el);
                  else zeilenRefs.current.delete(kennung);
                }}
                type="button"
                role="treeitem"
                aria-selected={gewaehltesTeil}
                aria-level={tiefe + 1}
                onClick={() => onTeilWaehle?.(blockId, knoten.feld)}
                style={{ paddingLeft: `${tiefe * 12 + 8}px` }}
                className={
                  `flex ${ZEILE} w-full items-center gap-1.5 rounded-lg pr-2 text-left transition ` +
                  (gewaehltesTeil
                    ? "bg-[#0099ff] text-white"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground")
                }
              >
                <Icon
                  icon={
                    TEIL_SYMBOL[knoten.feld] ??
                    ART_SYMBOL[knoten.art] ??
                    "ph:square"
                  }
                  className="size-3.5 shrink-0"
                />
                <span className="min-w-0 flex-1 truncate">
                  {teilName(typ, knoten.feld, knoten.art, knoten.marke)}
                </span>
              </button>
              {teilZeilen(blockId, typ, alle, knoten.feld, tiefe + 1)}
            </div>
          );
        })}
      </div>
    );
  }

  // --- Eine Zeile ---------------------------------------------------------------
  function zeile(
    k: BaumKnoten,
    eltern: BaumKnoten | null,
    tiefe: number,
  ): ReactNode {
    const b = k.block;
    if (sichtbar && !sichtbar.has(b.id)) return null;
    const { icon, farbe } = symbolFuer(k);
    const versteckt = versteckteGeraete(b.settings);
    const offen = Boolean(sichtbar) || !zu.has(b.id);
    const gewaehlt = alleGewaehlt.has(b.id);
    const gesperrt = b.settings?.locked === true;
    const imTeilbaum = !gewaehlt && teilbaum.has(b.id);
    const { name, zusatz } = benennen(k, eltern);
    const eigenerName =
      typeof b.settings?.name === "string" ? b.settings.name : "";
    const hatKinder = k.kinder.length > 0;
    // Ein Baustein, dessen Spalte fehlt (Befund 20), oder ein neuer ohne Hülle.
    const verwaist =
      k.art === "widget" && b.parent_id != null && !nachId.has(b.parent_id);
    const ungespeichert = k.art === "widget" && b.id.startsWith("neu-");
    const teilListe =
      k.art === "widget" ? (teileVonBlock?.get(b.id) ?? []) : [];
    const ablehnung = abgelehnt?.id === b.id ? abgelehnt.grund : null;

    return (
      <div key={b.id}>
        <div
          ref={(el) => {
            if (el) zeilenRefs.current.set(b.id, el);
            else zeilenRefs.current.delete(b.id);
          }}
          role="treeitem"
          aria-selected={gewaehlt}
          aria-expanded={hatKinder ? offen : undefined}
          aria-level={tiefe + 1}
          title={ablehnung ? t(`ebenen.zugAbgelehnt.${ablehnung}`) : undefined}
          draggable={Boolean(onZiehen) && !gesperrt && !benennt}
          onDragStart={(e) => {
            if (!onZiehen) return;
            e.stopPropagation();
            e.dataTransfer.setData(EBENEN_DRAG_TYP, b.id);
            e.dataTransfer.effectAllowed = "move";
            setZieht(b.id);
            protokoll("klick", "Ebene ziehen: Start", { id: b.id, art: k.art });
          }}
          onDragEnd={() => {
            setZieht(null);
            setUeberZiel(null);
            setAbgelehnt(null);
          }}
          onDragOver={(e) => {
            if (!onZiehen || !zieht) return;
            if (!e.dataTransfer.types.includes(EBENEN_DRAG_TYP)) return;
            const wohin = stelleAus(e, b.id);
            const pruefung = zugPruefen(blocks, zieht, b.id, wohin);
            if (!pruefung.erlaubt) {
              e.dataTransfer.dropEffect = "none";
              setUeberZiel(null);
              setAbgelehnt({ id: b.id, grund: pruefung.grund });
              return;
            }
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = "move";
            setAbgelehnt(null);
            setUeberZiel({ quelleId: zieht, zielId: b.id, wohin });
          }}
          onDragLeave={() => {
            setUeberZiel((z) => (z?.zielId === b.id ? null : z));
            setAbgelehnt((a) => (a?.id === b.id ? null : a));
          }}
          onDrop={(e) => {
            if (!onZiehen || !zieht) return;
            const wohin = stelleAus(e, b.id);
            const pruefung = zugPruefen(blocks, zieht, b.id, wohin);
            protokoll("klick", "Ebene ziehen: Abwurf", {
              quelle: zieht,
              ziel: b.id,
              wohin,
              erlaubt: pruefung.erlaubt,
              grund: pruefung.erlaubt ? null : pruefung.grund,
            });
            if (!pruefung.erlaubt) return;
            e.preventDefault();
            e.stopPropagation();
            onZiehen({ quelleId: zieht, zielId: b.id, wohin });
            setZieht(null);
            setUeberZiel(null);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!alleGewaehlt.has(b.id)) onWaehle(b.id);
            setMenueSuche("");
            setMenue({ id: b.id, x: e.clientX, y: e.clientY });
          }}
          onClick={(e) => {
            if (e.shiftKey && aktiv && aktiv !== b.id) {
              // ⇧-Klick: dazu- oder abwählen. `aktiv` bleibt die primäre.
              setMitgewaehlt((m) => {
                const n = new Set(m);
                if (n.has(b.id)) n.delete(b.id);
                else n.add(b.id);
                return n;
              });
              return;
            }
            setMitgewaehlt(new Set());
            onWaehle(b.id);
          }}
          onDoubleClick={() => {
            if (onUmbenennen) setBenennt({ id: b.id, wert: eigenerName });
          }}
          style={{ paddingLeft: `${GRUND_REM + tiefe * EINRUECKUNG_REM}rem` }}
          className={
            `group/zeile relative flex ${ZEILE} cursor-default items-center gap-1.5 pr-2 text-xs transition ` +
            (zieht === b.id ? "opacity-40 " : "") +
            (ueberZiel?.zielId === b.id && ueberZiel.wohin === "hinein"
              ? "ring-2 ring-inset ring-[#0099ff] "
              : "") +
            (ablehnung ? "cursor-not-allowed " : "") +
            (gewaehlt
              ? `bg-[#0099ff] text-white ${hatKinder && offen ? "rounded-t-lg" : "rounded-lg"}`
              : imTeilbaum
                ? "bg-[#0099ff]/10 text-foreground"
                : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground")
          }
        >
          {ueberZiel?.zielId === b.id && ueberZiel.wohin !== "hinein" ? (
            <span
              aria-hidden
              className={
                "pointer-events-none absolute inset-x-2 h-0.5 rounded-full bg-[#0099ff] " +
                (ueberZiel.wohin === "vor" ? "-top-px" : "-bottom-px")
              }
            />
          ) : null}

          {/* Pfeil: EIGENER Knopf, sonst klappt jeder Klick auf den Namen. */}
          <span className="flex w-4 shrink-0 justify-center">
            {hatKinder ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  umklappen(b.id);
                }}
                aria-label={t(offen ? "ebenen.zuklappen" : "ebenen.aufklappen")}
                className={
                  "rounded p-0.5 transition " +
                  (gewaehlt
                    ? "text-white/80 hover:text-white"
                    : "text-muted-foreground/70 hover:text-foreground")
                }
              >
                <Icon
                  icon={offen ? "ph:caret-down" : "ph:caret-right"}
                  className="size-3"
                />
              </button>
            ) : null}
          </span>

          <Icon
            icon={icon}
            className={"size-3.5 shrink-0 " + (gewaehlt ? "text-white" : farbe)}
          />

          {benennt?.id === b.id ? (
            <input
              autoFocus
              value={benennt.wert}
              maxLength={60}
              placeholder={name}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setBenennt({ id: b.id, wert: e.target.value })}
              onBlur={() => {
                const neuerName = benennt.wert.trim() || null;
                if (neuerName !== (eigenerName || null)) {
                  protokoll("klick", "Ebene umbenennen", {
                    id: b.id,
                    name: neuerName,
                  });
                  onUmbenennen?.(b.id, neuerName);
                }
                setBenennt(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                else if (e.key === "Escape") setBenennt(null);
              }}
              className="min-w-0 flex-1 rounded-md border border-[#0099ff] bg-background px-1.5 py-0.5 text-xs text-foreground outline-none"
            />
          ) : (
            <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
              <span
                className={
                  "truncate " + (k.art === "section" ? "font-medium" : "")
                }
              >
                {name}
              </span>
              {zusatz ? (
                <span
                  className={
                    "min-w-0 truncate text-[0.6875rem] " +
                    (gewaehlt ? "text-white/70" : "text-muted-foreground/70")
                  }
                >
                  · {zusatz}
                </span>
              ) : null}
            </span>
          )}

          {/* Rechts: Framers Marker (Vollerfassung §2): `#` Scroll Section,
              Kette Link, Blitz Effekte — dann Verwaist/Neu/Leer, Schloss, Auge. */}
          {(b.settings as { scroll?: { anker?: unknown } } | null)?.scroll?.anker ? (
            <span
              title={t("ebenen.scrollAbschnitt")}
              className={"shrink-0 text-[0.6875rem] font-semibold " + (gewaehlt ? "text-white/80" : "text-muted-foreground")}
            >
              #
            </span>
          ) : null}
          {(b.settings as { link?: { href?: unknown } } | null)?.link?.href ? (
            <span title={t("ebenen.hatLink")} className="flex shrink-0">
              <Icon
                icon="ph:link-simple"
                className={"size-3 " + (gewaehlt ? "text-white/80" : "text-muted-foreground")}
              />
            </span>
          ) : null}
          {(b.settings as { effekte?: unknown } | null)?.effekte ? (
            <span title={t("ebenen.hatEffekte")} className="flex shrink-0">
              <Icon
                icon="ph:lightning-fill"
                className={"size-3 " + (gewaehlt ? "text-white/80" : "text-amber-500")}
              />
            </span>
          ) : null}
          {verwaist ? (
            <Abzeichen text={t("ebenen.verwaist")} hell={gewaehlt} />
          ) : ungespeichert ? (
            <Abzeichen text={t("ebenen.neu")} hell={gewaehlt} />
          ) : k.art !== "widget" && !hatKinder ? (
            <Abzeichen text={t("ebenen.leerContainer")} hell={gewaehlt} />
          ) : null}

          {gesperrt ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                ausfuehren("sperren", b.id);
              }}
              aria-label={t("ebenen.entsperren")}
              title={t("ebenen.entsperren")}
              className={
                "shrink-0 rounded p-0.5 " +
                (gewaehlt ? "text-white" : "text-muted-foreground")
              }
            >
              <Icon icon="ph:lock-simple-fill" className="size-3.5" />
            </button>
          ) : null}

          {onVersteckt ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const neu = umgeschaltet(versteckt, geraet);
                protokoll("klick", "Ebene je Gerät", {
                  id: b.id,
                  geraet,
                  versteckt: neu,
                });
                onVersteckt(b.id, neu);
              }}
              aria-label={
                versteckt.includes(geraet)
                  ? t("arbeitsflaeche.einblenden", {
                      geraet: t(`arbeitsflaeche.${geraet}`),
                    })
                  : t("arbeitsflaeche.ausblendenAuf")
              }
              title={
                versteckt.includes(geraet)
                  ? t("arbeitsflaeche.einblenden", {
                      geraet: t(`arbeitsflaeche.${geraet}`),
                    })
                  : t("ebenen.verstecktAufGeraet", {
                      geraet: t(`arbeitsflaeche.${geraet}`),
                    })
              }
              className={
                "shrink-0 rounded p-0.5 transition " +
                (versteckt.includes(geraet)
                  ? gewaehlt
                    ? "text-white"
                    : "text-orange-500 hover:text-orange-600"
                  : (gewaehlt ? "text-white/80 " : "text-muted-foreground ") +
                    "opacity-0 group-hover/zeile:opacity-100 focus:opacity-100")
              }
            >
              <Icon
                icon={versteckt.includes(geraet) ? "ph:eye-slash" : "ph:eye"}
                className="size-3.5"
              />
            </button>
          ) : null}
        </div>

        {offen && hatKinder ? (
          <div className={gewaehlt ? "rounded-b-lg bg-[#0099ff]/10" : ""}>
            {k.kinder.map((kind) => zeile(kind, k, tiefe + 1))}
          </div>
        ) : null}

        {/* Die TEILE eines Bausteins (06.09.2026): Überschrift, Absatz, Knopf,
            Bild — jedes eine eigene Ebene mit eigenem Style-Panel, wie in
            Framer jede Textstelle ein Layer ist.
            Sie haben keine DB-Zeile: ihre Kennung ist `<blockId>#<feld>`, und
            ihre Darstellung steht in `settings.teile.<feld>`. Deshalb sind sie
            nicht ziehbar und nicht löschbar — ein Teil gehört zum Baustein,
            man kann es gestalten, aber nicht herausnehmen. */}
        {offen && k.art === "widget" && teilListe.length > 0
          ? teilZeilen(b.id, k.block.type, teilListe, null, tiefe + 2)
          : null}
      </div>
    );
  }

  // --- Breakpoint-Wurzeln ----------------------------------------------------------
  function bereichText(g: Geraet): string {
    const b = GERAETE_BEREICHE[g];
    return b.max == null
      ? t("ebenen.abBreite", { min: b.min })
      : t("ebenen.breite", { von: b.max, bis: b.min });
  }

  const menueEintraege = MENUE.filter((e) => {
    const text = menueSuche.trim().toLowerCase();
    if (!text) return true;
    return t(`ebenen.${e.schluessel}`).toLowerCase().includes(text);
  });

  return (
    <div
      ref={baumRef}
      role="tree"
      className="flex select-none flex-col gap-2 px-2.5 py-2 text-xs"
    >
      {/* Seitenwahl (Framer: `⌂ Home ⌄`). Der Wechsel ist ein Seitenwechsel im
          Editor — der Editor speichert vorher (`vorNavigation`). */}
      <label
        className={`relative flex ${ZEILE} items-center rounded-lg bg-secondary px-2.5`}
      >
        <Icon
          icon={
            seiten.find((s) => s.id === seiteId)?.is_home
              ? "ph:house"
              : "ph:file"
          }
          className="size-3.5 shrink-0 text-muted-foreground"
        />
        <select
          value={seiteId}
          onChange={(e) => onSeite(e.target.value)}
          aria-label={t("ebenen.seiteWaehlen")}
          className="min-w-0 flex-1 appearance-none bg-transparent pl-2 pr-5 text-xs font-medium text-foreground outline-none"
        >
          {seiten.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title || (s.is_home ? t("seiten.startseite") : `/${s.slug}`)}
            </option>
          ))}
        </select>
        <Icon
          icon="ph:caret-down"
          className="pointer-events-none absolute right-2.5 size-3 text-muted-foreground"
        />
      </label>

      <div
        className={`relative flex ${ZEILE} items-center rounded-lg bg-secondary px-2.5`}
      >
        <Icon
          icon="ph:magnifying-glass"
          className="size-3.5 shrink-0 text-muted-foreground"
        />
        <input
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setSuche("");
          }}
          placeholder={t("ebenen.suchen")}
          className="min-w-0 flex-1 bg-transparent pl-2 text-xs outline-none placeholder:text-muted-foreground"
        />
        {suche ? (
          <button
            type="button"
            onClick={() => setSuche("")}
            aria-label={t("ebenen.sucheLeeren")}
            className="text-muted-foreground transition hover:text-foreground"
          >
            <Icon icon="ph:x" className="size-3" />
          </button>
        ) : null}
      </div>

      <div className="flex flex-col">
        {GERAETE.map((g) => {
          const aktivesGeraet = g === geraet;
          return (
            <div key={g}>
              <button
                type="button"
                onClick={() => onGeraet(g)}
                aria-pressed={aktivesGeraet}
                className={`flex ${ZEILE} w-full items-center gap-1.5 rounded-lg pl-1.5 pr-2 text-left transition hover:bg-secondary/70`}
              >
                <span className="flex w-4 shrink-0 justify-center text-muted-foreground/70">
                  <Icon
                    icon={aktivesGeraet ? "ph:caret-down" : "ph:caret-right"}
                    className="size-3"
                  />
                </span>
                <Icon
                  icon="ph:browser"
                  className="size-3.5 shrink-0 text-[#0099ff]"
                />
                <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                  {t(`arbeitsflaeche.${g}`)}
                </span>
                <span className="shrink-0 text-[0.6875rem] text-muted-foreground">
                  {g === "desktop" ? t("ebenen.primaer") : bereichText(g)}
                </span>
              </button>

              {aktivesGeraet ? (
                <div>
                  {kopfzeile && onRegionWaehle ? (
                    <RegionBaum
                      region="kopfzeile"
                      stand={kopfzeile}
                      geraet={geraet}
                      auswahl={regionAuswahl}
                      onWaehle={onRegionWaehle}
                      onVersteckt={onRegionVersteckt}
                      onSperren={onRegionSperren}
                      onZiehen={onRegionZiehen}
                    />
                  ) : (
                    <RegionZeile
                      icon="ph:layout"
                      label={t("ebenen.kopfzeile")}
                      hinweis={t("ebenen.ausTheme")}
                      onKlick={onSiteLayout}
                    />
                  )}
                  {baum.length === 0 ? (
                    <p className="px-6 py-1.5 text-muted-foreground">
                      {t("ebenen.leer")}
                    </p>
                  ) : sichtbar && sichtbar.size === 0 ? (
                    <p className="px-6 py-1.5 text-muted-foreground">
                      {t("ebenen.keinTreffer", { suche })}
                    </p>
                  ) : (
                    baum.map((k) => zeile(k, null, 1))
                  )}
                  {fusszeile && onRegionWaehle ? (
                    <RegionBaum
                      region="fusszeile"
                      stand={fusszeile}
                      geraet={geraet}
                      auswahl={regionAuswahl}
                      onWaehle={onRegionWaehle}
                      onVersteckt={onRegionVersteckt}
                      onSperren={onRegionSperren}
                      onZiehen={onRegionZiehen}
                    />
                  ) : (
                    <RegionZeile
                      icon="ph:layout"
                      label={t("ebenen.fusszeile")}
                      hinweis={t("ebenen.ausTheme")}
                      onKlick={onSiteLayout}
                    />
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {mitgewaehlt.size > 0 ? (
        <p className="px-1 text-[0.6875rem] text-muted-foreground">
          {t("ebenen.mehrfach", { n: alleGewaehlt.size })}
        </p>
      ) : null}

      <button
        type="button"
        onClick={onSiteLayout}
        className="mt-1 flex items-center gap-2 border-t border-border px-1.5 pb-1 pt-2.5 text-left text-muted-foreground transition hover:text-foreground"
      >
        <Icon icon="ph:columns" className="size-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate">
          {t("ebenen.siteLayout")}
        </span>
        <Icon icon="ph:caret-right" className="size-3 shrink-0" />
      </button>

      {menue ? (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setMenue(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setMenue(null);
            }}
          />
          <div
            role="menu"
            className="fixed z-50 w-52 overflow-hidden rounded-lg border border-border bg-background py-1 shadow-lg"
            style={{
              left: Math.min(menue.x, window.innerWidth - 216),
              top: Math.min(menue.y, window.innerHeight - 340),
            }}
          >
            <div className="border-b border-border px-2 pb-1.5">
              <input
                autoFocus
                value={menueSuche}
                onChange={(e) => setMenueSuche(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setMenue(null);
                }}
                placeholder={t("ebenen.menueSuchen")}
                className="w-full bg-transparent px-1 py-1 text-xs outline-none"
              />
            </div>
            {menueEintraege.map((e, i) => {
              const ziel = menue.id;
              const block = nachId.get(ziel);
              const gesperrt = block?.settings?.locked === true;
              const versteckt =
                versteckteGeraete(block?.settings ?? {}).length > 0;
              const label =
                e.aktion === "sperren" && gesperrt
                  ? t("ebenen.entsperren")
                  : e.aktion === "verstecken" && versteckt
                    ? t("ebenen.einblenden")
                    : t(`ebenen.${e.schluessel}`);
              const neueGruppe =
                i > 0 && menueEintraege[i - 1]!.gruppe !== e.gruppe;
              const ohneElternteil =
                e.aktion === "elternteil" &&
                elternKette(blocks, ziel).length === 0;
              return (
                <div key={e.aktion}>
                  {neueGruppe ? (
                    <div className="my-1 border-t border-border" />
                  ) : null}
                  <button
                    type="button"
                    role="menuitem"
                    disabled={ohneElternteil}
                    onClick={() => {
                      setMenue(null);
                      if (e.aktion === "elternteil") elternteilWaehlen(ziel);
                      else if (e.aktion === "geschwister") geschwisterWaehlen(ziel);
                      else ausfuehren(e.aktion, ziel);
                    }}
                    className={
                      "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition hover:bg-secondary disabled:opacity-40 " +
                      (e.gefahr ? "text-destructive" : "")
                    }
                  >
                    <Icon icon={e.icon} className="size-3.5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{label}</span>
                    <span className="shrink-0 text-[0.625rem] text-muted-foreground">
                      {e.kuerzel}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}

function Abzeichen({ text, hell }: { text: string; hell: boolean }) {
  return (
    <span
      className={
        "shrink-0 text-[0.625rem] " +
        (hell ? "text-white/70" : "text-muted-foreground/70")
      }
    >
      {text}
    </span>
  );
}

/** Kopf- und Fußzeile als reiner Verweis auf das Site-Layout — der Rückfall,
 *  wenn der Aufrufer keinen `RegionStand` liefert (Design-Ansicht). Im
 *  Seiten-Editor zeigt `RegionBaum` beide seit 0570 als Ebenen mit Kindern. */
function RegionZeile({
  icon,
  label,
  hinweis,
  onKlick,
}: {
  icon: string;
  label: string;
  hinweis: string;
  onKlick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onKlick}
      style={{ paddingLeft: `${GRUND_REM + EINRUECKUNG_REM}rem` }}
      className={`flex ${ZEILE} w-full items-center gap-1.5 rounded-lg pr-2 text-left text-muted-foreground transition hover:bg-secondary/70 hover:text-foreground`}
    >
      <span className="w-4 shrink-0" />
      <Icon icon={icon} className="size-3.5 shrink-0 text-orange-500" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="shrink-0 text-[0.625rem] text-muted-foreground/70">
        {hinweis}
      </span>
    </button>
  );
}
