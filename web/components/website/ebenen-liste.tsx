"use client";

// Die Ebenen (Hostaway: „Layers") — der ECHTE Baum der Seite.
//
//     Abschnitt · Suche
//       Spalte  6/12
//         Text
//         Bild
//       Spalte  6/12
//         Innere Spalte
//           Galerie
//
// WAS AM 25.08.2026 NEU GEMACHT WURDE, UND WARUM
// ==============================================
// Der Baum war fachlich richtig und trotzdem unlesbar. Aus dem Screenshot des
// Nutzers, Zeile für Zeile:
//
// 1. ALLES WAR BLAU MARKIERT. Die Beschriftungen ließen sich mit der Maus
//    markieren, und beim Ziehen über die Liste blieb die Textauswahl stehen.
//    Ein Werkzeugbaum ist keine Textseite — `select-none`.
// 2. ACHTMAL „Abschnitt" UNTEREINANDER. Ein Name, den jede Zeile trägt,
//    benennt nichts. Ein Abschnitt heißt jetzt nach dem, was in ihm steht
//    (`Abschnitt · Suche`) — dieselbe Regel, nach der Elementor das Umbenennen
//    zu seiner Kernfunktion des Navigators gemacht hat.
// 3. „12/12" AN JEDER SPALTE und „1" AN JEDEM CONTAINER. Beides ist ERSATZLOS
//    weg. Im echten Layers-Panel gibt es keine Abzeichen (§9) — der
//    Breitenanteil steht im Inspektor rechts unter `Size`, dort wo man ihn
//    ändert. Ein Wert, den man nur ablesen und nicht anfassen kann, gehört
//    nicht in einen Werkzeugbaum.
// 4. KEINE ERKENNBARE VERSCHACHTELUNG. Die Einrückung war ein Innenabstand
//    ohne Linie. Jetzt trägt jede Ebene eine senkrechte Führungslinie — das
//    ist die Konvention, an der man in Figma, Webflow und Framer die Tiefe
//    abliest, und der Grund, warum der Nutzer „man erkennt kein column" sagte.
// 5. KEINE HANDGRIFFE. Verschieben, Duplizieren und Entfernen lagen woanders.
//    Elementars Navigator führt sie in der Zeile; hier stehen sie beim
//    Überfahren rechts.
//
// WAS DIE LISTE KANN, UND WAS NICHT
// Handgriffe gibt es NUR an Bausteinen. Abschnitte und Spalten lassen sich
// noch nicht umsortieren oder löschen — der Editor führt seine Zeilen flach
// und kennt die Container nicht. Ein Papierkorb, der an einer Spalte nichts
// tut, wäre schlimmer als keiner (Wurzel 4: keine erfundenen Zustände).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import type { Block } from "@/lib/site-pages";

import { abschnittFuer } from "./abschnitte";
import {
  type BaumKnoten,
  baumBauen,
  bausteineDarunter,
} from "./ebenen-baum";
import { umgeschaltet, versteckteGeraete } from "./editor/sichtbarkeit";
import type { Geraet } from "./vorschau";

/** Was ein Handgriff in der Zeile auslöst. Der Editor setzt es um — die Liste
 *  kennt weder Schlüssel noch Reihenfolge der Bearbeitungszeilen. */
export type EbenenAktion =
  | "hoch"
  | "runter"
  | "duplizieren"
  | "entfernen"
  | "umbenennen"
  | "sperren"
  | "verstecken";

/** Die Handgriffe, wie sie im Kontextmenü stehen — mit Tastenkürzel.
 *
 *  Warum ein Kontextmenü und keine Symbolreihe in der Zeile: im Layers-Panel
 *  von Framer (live abgelesen 28.08.2026) trägt eine Zeile NUR Pfeil, Symbol
 *  und Name. Jede Aktion steht im Rechtsklick-Menü, mit Suchfeld und
 *  Tastenkürzel — Duplicate ⌘D, Delete ⌫, Rename ⌘R, Lock ⌘L, Hide ⌘;.
 *  Fünf Symbole in jeder Zeile sind fünfmal so viel Fläche für dieselbe
 *  Funktion, und sie erscheinen erst beim Überfahren: wer sie nicht kennt,
 *  findet sie nie. */
const MENUE_EINTRAEGE: readonly {
  aktion: EbenenAktion;
  icon: string;
  schluessel: string;
  kuerzel: string;
  gefahr?: boolean;
}[] = [
  { aktion: "umbenennen", icon: "ph:cursor-text", schluessel: "umbenennen", kuerzel: "⌘R" },
  { aktion: "duplizieren", icon: "ph:copy", schluessel: "duplizieren", kuerzel: "⌘D" },
  { aktion: "hoch", icon: "ph:arrow-up", schluessel: "nachOben", kuerzel: "⌥↑" },
  { aktion: "runter", icon: "ph:arrow-down", schluessel: "nachUnten", kuerzel: "⌥↓" },
  { aktion: "sperren", icon: "ph:lock-simple", schluessel: "sperren", kuerzel: "⌘L" },
  { aktion: "verstecken", icon: "ph:eye-slash", schluessel: "verstecken", kuerzel: "⌘;" },
  { aktion: "entfernen", icon: "ph:trash", schluessel: "entfernen", kuerzel: "⌫", gefahr: true },
];

/** Ein Ziehvorgang im Baum: WAS soll WOHIN (0479).
 *
 *  `wohin` ist die Stelle relativ zum Ziel — „vor" und „nach" ordnen auf
 *  derselben Ebene, „hinein" legt in einen Container. Die Liste entscheidet
 *  nur, WAS erlaubt ist (gleiche Ebene, passender Elternteil); WIE es
 *  umgesetzt wird, weiß nur der Editor: Bausteine wandern in seiner
 *  Abschnittsliste, Container über die Struktur-Endpunkte. */
/** MIME-Art des Ziehvorgangs im Ebenen-Baum. Eigene Art, damit ein Baustein
 *  aus dem Katalog (`text/plain`) hier NICHT als Umsortieren ankommt. */
export const EBENEN_DRAG_TYP = "application/x-nextdays-ebene";

export type EbenenZug = {
  quelleId: string;
  zielId: string;
  wohin: "vor" | "nach" | "hinein";
};

/** Symbol je Art. Container bekommen eigene, damit man Abschnitt, Spalte und
 *  innere Spalte auf einen Blick auseinanderhält — das ist der ganze Zweck
 *  einer Ebenen-Ansicht. */
const ART_SYMBOL: Record<BaumKnoten["art"], string> = {
  section: "ph:rows",
  column: "ph:columns",
  inner_column: "ph:square-split-horizontal",
  widget: "ph:cube",
};

/** Farbe des Symbols je Art. Drei Grautöne hätten die Arten nicht getrennt;
 *  der Abschnitt trägt die Markenfarbe, die Spalten einen eigenen Ton, der
 *  Baustein bleibt neutral — er ist der Inhalt, nicht das Gerüst. */
const ART_FARBE: Record<BaumKnoten["art"], string> = {
  section: "text-(--brand)",
  column: "text-sky-500",
  inner_column: "text-sky-400",
  widget: "text-muted-foreground",
};

export function EbenenListe({
  blocks,
  aktiv,
  geraet,
  onWaehle,
  onWaehleContainer,
  onContainerAktion,
  onZiehen,
  onUmbenennen,
  onVersteckt,
  onAktion,
  onSiteLayout,
}: {
  /** Die FLACHEN Zeilen. Der Baum entsteht hier — der Editor arbeitet auf der
   *  flachen Liste, weil er einzelne Zeilen ändert. */
  blocks: Block[];
  /** ID des ausgewählten Blocks. */
  aktiv: string | null;
  /** Die gerade gezeigte Gerätebreite. Sie entscheidet, welches Auge
   *  durchgestrichen ist — und was ein Klick darauf einblendet. */
  geraet: Geraet;
  onWaehle: (id: string) => void;
  /** Ein CONTAINER wurde gewählt (Abschnitt, Spalte, innere Spalte, 0479).
   *
   *  Getrennt von `onWaehle`: der Editor führt Bausteine in seiner
   *  Abschnittsliste und Container im Baum — zwei Bestände, zwei Zustände.
   *  Fehlt der Rückruf, bleibt die Zeile ein Aufklapper (so wie vorher). */
  onWaehleContainer?: (id: string) => void;
  /** Handgriffe an einem CONTAINER: Rang, duplizieren, löschen. Sie laufen
   *  über eigene Endpunkte (`/blocks/{id}/move|duplicate`, DELETE) und nicht
   *  über die Abschnittsliste — Container stehen dort nicht. */
  onContainerAktion?: (id: string, aktion: EbenenAktion) => void;
  /** Eine Zeile wurde per Ziehen an eine andere Stelle gebracht. Ohne diesen
   *  Rückruf ist die Liste nicht ziehbar — das war der Zustand bis 0479:
   *  umsortieren ging nur über die Pfeilknöpfe, eine Zeile nach ganz oben zu
   *  bringen kostete sechs Klicks. */
  onZiehen?: (zug: EbenenZug) => void;
  /** Eine Ebene bekommt einen eigenen Namen (Doppelklick auf die Zeile).
   *
   *  Der Standardgriff jeder Ebenen-Ansicht — Framer, Figma und Webflow haben
   *  ihn aus demselben Grund: „Abschnitt" achtmal untereinander benennt
   *  nichts, und ab dem vierten findet man seinen wieder nur durch Anklicken.
   *  Ein leerer Name stellt den Standardnamen wieder her.
   *
   *  Nur an CONTAINERN: ein Baustein heißt nach seinem Typ, und sein Name
   *  liefe über die Abschnittsliste — zwei Schreibwege auf dieselbe Zeile
   *  (Wurzel 2). */
  onUmbenennen?: (id: string, name: string | null) => void;
  onVersteckt?: (id: string, geraete: Geraet[]) => void;
  /** Fehlt sie, zeigt die Zeile keine Handgriffe. Kein Knopf ins Leere. */
  onAktion?: (id: string, aktion: EbenenAktion) => void;
  onSiteLayout?: () => void;
}) {
  const t = useTranslations("website");
  // Container sind offen, Bausteine haben keine Kinder. Ein Baum, der sich
  // zugeklappt öffnet, zwingt zu drei Klicks, bevor man irgendetwas sieht.
  const [zu, setZu] = useState<Set<string>>(new Set());
  /** Welche Zeile gerade umbenannt wird, und der Zwischenstand des Feldes. */
  const [benennt, setBenennt] = useState<{ id: string; wert: string } | null>(
    null,
  );
  /** Der Filtertext über dem Baum. Framer hat ihn, und aus gutem Grund: eine
   *  echte Seite hat vierzig Ebenen, und die gesuchte liegt zugeklappt in der
   *  dritten Verschachtelung. */
  const [suche, setSuche] = useState("");
  /** Das offene Kontextmenü: WO es steht und WELCHE Zeile es meint. */
  const [menue, setMenue] = useState<{
    id: string;
    art: BaumKnoten["art"];
    x: number;
    y: number;
  } | null>(null);
  /** Der Filtertext IM Kontextmenü (Framer: „Type to search…"). */
  const [menueSuche, setMenueSuche] = useState("");

  const baum = baumBauen(blocks);

  /** Die TASTENKÜRZEL der ausgewählten Ebene (Framer: ⌘D, ⌫, ⌘R, ⌘L, ⌘;).
   *
   *  Sie hängen an `aktiv` und nicht am Fokus einer Zeile: der Fokus liegt
   *  nach einem Klick auf dem Namensknopf, nach einem Klick im Canvas
   *  nirgends — und die Auswahl gilt trotzdem. Genau deshalb gibt es sie:
   *  wer im Canvas etwas markiert, will es dort auch löschen können.
   *
   *  Wenn gerade in ein Feld getippt wird, sind sie AUS. Ein ⌫ im
   *  Umbenenn-Feld löscht ein Zeichen, nicht die Ebene. */
  useEffect(() => {
    function tastatur(e: KeyboardEvent) {
      if (!aktiv) return;
      const ziel = e.target as HTMLElement | null;
      const tippt =
        ziel &&
        (ziel.tagName === "INPUT" ||
          ziel.tagName === "TEXTAREA" ||
          ziel.isContentEditable);
      if (tippt) return;
      const meta = e.metaKey || e.ctrlKey;
      const block = blocks.find((b) => b.id === aktiv);
      if (!block) return;
      const istContainer = (block.kind ?? "widget") !== "widget";
      const ausloesen = (aktion: EbenenAktion) => {
        e.preventDefault();
        if (istContainer) onContainerAktion?.(aktiv, aktion);
        else onAktion?.(aktiv, aktion);
      };
      if (meta && e.key.toLowerCase() === "d") ausloesen("duplizieren");
      else if (meta && e.key.toLowerCase() === "l") ausloesen("sperren");
      else if (meta && e.key === ";") ausloesen("verstecken");
      else if (meta && e.key.toLowerCase() === "r" && istContainer) {
        e.preventDefault();
        const eigen =
          typeof block.settings?.name === "string" ? block.settings.name : "";
        setBenennt({ id: aktiv, wert: eigen });
      } else if (e.key === "Backspace" || e.key === "Delete") {
        ausloesen("entfernen");
      } else if (e.altKey && e.key === "ArrowUp") ausloesen("hoch");
      else if (e.altKey && e.key === "ArrowDown") ausloesen("runter");
    }
    window.addEventListener("keydown", tastatur);
    return () => window.removeEventListener("keydown", tastatur);
  }, [aktiv, blocks, onAktion, onContainerAktion]);

  /** Alle IDs UNTER der ausgewählten Zeile — für die helle Hinterlegung. */
  const ausgewaehlterTeilbaum = useMemo(() => {
    const treffer = new Set<string>();
    if (!aktiv) return treffer;
    const kinderVon = new Map<string, string[]>();
    for (const b of blocks) {
      if (!b.parent_id) continue;
      const liste = kinderVon.get(b.parent_id) ?? [];
      liste.push(b.id);
      kinderVon.set(b.parent_id, liste);
    }
    const stapel = [...(kinderVon.get(aktiv) ?? [])];
    while (stapel.length) {
      const id = stapel.pop() as string;
      if (treffer.has(id)) continue;
      treffer.add(id);
      stapel.push(...(kinderVon.get(id) ?? []));
    }
    return treffer;
  }, [aktiv, blocks]);

  /** Welche Zeilen der Filter durchlässt: die TREFFER, ihre Vorfahren (sonst
   *  hinge der Treffer an nichts) und ihre Nachkommen (man sucht einen
   *  Abschnitt, um zu sehen, was darin steht).
   *
   *  `null` = kein Filter aktiv. Das ist nicht dasselbe wie „alle": eine leere
   *  Trefferliste muss „nichts gefunden" heißen können. */
  const sichtbar = useMemo<Set<string> | null>(() => {
    const text = suche.trim().toLowerCase();
    if (!text) return null;
    const nachId = new Map(blocks.map((b) => [b.id, b]));
    const treffer = new Set<string>();
    const kinderVon = new Map<string, string[]>();
    for (const b of blocks) {
      if (!b.parent_id) continue;
      const liste = kinderVon.get(b.parent_id) ?? [];
      liste.push(b.id);
      kinderVon.set(b.parent_id, liste);
    }
    function passt(b: Block): boolean {
      const eigener = typeof b.settings?.name === "string" ? b.settings.name : "";
      const meta = abschnittFuer(b.type);
      const typname = meta ? t(`abschnitte.${meta.label}`) : b.type;
      return (
        eigener.toLowerCase().includes(text) ||
        typname.toLowerCase().includes(text) ||
        t(`ebenen.${b.kind ?? "widget"}`).toLowerCase().includes(text)
      );
    }
    for (const b of blocks) {
      if (!passt(b)) continue;
      treffer.add(b.id);
      // Die Vorfahren mit — ohne sie fehlt dem Treffer der Ast, an dem er
      // hängt, und die Liste zeigt lauter Wurzeln.
      let eltern = b.parent_id ? nachId.get(b.parent_id) : undefined;
      while (eltern) {
        treffer.add(eltern.id);
        eltern = eltern.parent_id ? nachId.get(eltern.parent_id) : undefined;
      }
      // Und die Nachkommen: wer „Kontakt" sucht, will den Abschnitt samt
      // Inhalt sehen.
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

  // --- Ziehen (0479) ------------------------------------------------------
  //
  // Umsortieren ging bis hierher nur über die Pfeilknöpfe: eine Zeile nach
  // ganz oben zu bringen kostete bei sechs Abschnitten fünf Klicks, und ein
  // Baustein ließ sich überhaupt nicht in eine andere Spalte bringen.
  //
  // Erlaubt ist nur, was der Baum zulässt (dieselben Regeln wie im Backend):
  //   · Baustein → vor/nach einen Baustein, oder HINEIN in eine Spalte.
  //   · Container → vor/nach einen Container DERSELBEN Ebene (gleicher
  //     Elternteil). Eine Spalte in einen fremden Abschnitt zu ziehen wäre ein
  //     Umhängen, das der Server für Container nicht anbietet — dann lieber
  //     kein Abwurfziel als eine Bewegung, die stillschweigend nichts tut.
  const [zieht, setZieht] = useState<string | null>(null);
  const [ueberZiel, setUeberZiel] = useState<EbenenZug | null>(null);
  const artVon = new Map(
    blocks.map((b) => [b.id, (b.kind ?? "widget") as BaumKnoten["art"]]),
  );
  const elternVon = new Map(blocks.map((b) => [b.id, b.parent_id ?? null]));

  function zugErlaubt(quelleId: string, zielId: string, wohin: EbenenZug["wohin"]) {
    if (quelleId === zielId) return false;
    const quelleArt = artVon.get(quelleId);
    const zielArt = artVon.get(zielId);
    if (!quelleArt || !zielArt) return false;
    // Nichts in sich selbst: ein Abschnitt, den man in seine eigene Spalte
    // zieht, wäre ein Baum ohne Wurzel — die DB fängt das erst als Zyklus.
    let lauf: string | null = zielId;
    while (lauf) {
      if (lauf === quelleId) return false;
      lauf = elternVon.get(lauf) ?? null;
    }
    if (quelleArt === "widget") {
      if (wohin === "hinein") {
        return zielArt === "column" || zielArt === "inner_column";
      }
      return zielArt === "widget";
    }
    // Container bewegen sich nur unter ihresgleichen.
    if (wohin === "hinein") return false;
    return quelleArt === zielArt && elternVon.get(quelleId) === elternVon.get(zielId);
  }

  /** Wohin der Abwurf zeigt: oberes/unteres Viertel = daneben, Mitte = hinein
   *  (nur bei Containern, die etwas aufnehmen können). */
  function stelleAus(e: React.DragEvent, zielId: string): EbenenZug["wohin"] {
    const kasten = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const anteil = (e.clientY - kasten.top) / Math.max(1, kasten.height);
    const zielArt = artVon.get(zielId);
    const nimmtAuf = zielArt === "column" || zielArt === "inner_column";
    if (nimmtAuf && anteil > 0.25 && anteil < 0.75) return "hinein";
    return anteil < 0.5 ? "vor" : "nach";
  }

  function umklappen(id: string) {
    setZu((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  /** Der Name einer Zeile. Bausteine heißen nach ihrem Typ, Container nach
   *  ihrer Art — und ein Abschnitt zusätzlich nach seinem Inhalt, sonst steht
   *  achtmal dasselbe Wort untereinander. */
  function benennen(
    k: BaumKnoten,
    eltern: BaumKnoten | null,
  ): { name: string; zusatz: string | null } {
    if (k.art === "widget") {
      const meta = abschnittFuer(k.block.type);
      return {
        name: meta ? t(`abschnitte.${meta.label}`) : t("editor.unbekannterAbschnitt"),
        zusatz: null,
      };
    }
    // Ein selbst vergebener Name schlägt jeden Standardnamen — er ist der
    // einzige Grund, warum eine lange Ebenen-Liste lesbar bleibt.
    const eigener = k.block.settings?.name;
    if (typeof eigener === "string" && eigener.trim()) {
      return { name: eigener.trim(), zusatz: null };
    }
    // EINE Spalte über die volle Breite ist keine Spalte — sie ist der
    // Inhaltsbereich des Abschnitts. Dieselbe Regel, nach der der Renderer ihr
    // keinen Rahmen gibt und nach der `spanZeigen` das „12/12" weglässt: was
    // nicht geteilt ist, hat keine Spalten. Achtmal „Spalte" untereinander
    // benennt nichts, es füllt nur die Liste (gemeldet 28.08.2026: „hier steht
    // spalte es ist aber keine spalte").
    //
    // Erst ab ZWEI bekommen sie ihre Nummer — dann sagt der Name, welche
    // gemeint ist.
    if (k.art === "column" || k.art === "inner_column") {
      const geschwister = (eltern?.kinder ?? []).filter(
        (g) => g.art === "column" || g.art === "inner_column",
      );
      if (geschwister.length <= 1) {
        return { name: t("ebenen.inhalt"), zusatz: null };
      }
      const nr = geschwister.findIndex((g) => g.block.id === k.block.id) + 1;
      return {
        name: t(
          k.art === "inner_column" ? "ebenen.innereSpalteNr" : "ebenen.spalteNr",
          { nr },
        ),
        zusatz: null,
      };
    }
    const name = t(`ebenen.${k.art}`);
    if (k.art !== "section") return { name, zusatz: null };
    const inhalte = bausteineDarunter(k)
      .map((w) => abschnittFuer(w.block.type))
      .filter((m): m is NonNullable<typeof m> => Boolean(m))
      .map((m) => t(`abschnitte.${m.label}`));
    if (inhalte.length === 0) return { name, zusatz: null };
    // Höchstens zwei Namen und dann eine Zahl: die Zeile ist 20 rem breit, und
    // eine abgeschnittene Aufzählung nennt den Abschnitt schlechter als eine
    // kurze.
    const zusatz =
      inhalte.length <= 2
        ? inhalte.join(" · ")
        : `${inhalte.slice(0, 2).join(" · ")} +${inhalte.length - 2}`;
    return { name, zusatz };
  }

  function knotenZeigen(
    k: BaumKnoten,
    eltern: BaumKnoten | null = null,
  ): React.ReactNode {
    const b = k.block;
    // Der Filter entscheidet ÜBER die Zeile, nicht über ihren Inhalt: eine
    // ausgeblendete Zeile nimmt auch ihre Kinder mit (sie stehen ohnehin in
    // der Trefferliste, wenn sie passen).
    if (sichtbar && !sichtbar.has(b.id)) return null;
    const meta = k.art === "widget" ? abschnittFuer(b.type) : null;
    const versteckt = versteckteGeraete(b.settings);
    // Bei aktiver Suche IMMER offen: ein Treffer, der in einer zugeklappten
    // Ebene liegt, ist kein Treffer.
    const offen = Boolean(sichtbar) || !zu.has(b.id);
    const gewaehlt = b.id === aktiv;
    const gesperrt = b.settings?.locked === true;
    //: Liegt diese Zeile UNTER der Auswahl? Framer hinterlegt den ganzen
    //: Teilbaum der gewählten Ebene hell — man sieht damit sofort, was zur
    //: Auswahl gehört, ohne aufzuklappen.
    const imAusgewaehlten = ausgewaehlterTeilbaum.has(b.id);
    const { name, zusatz } = benennen(k, eltern);
    //: Der SELBST vergebene Name — leer, solange die Zeile ihren
    //: Standardnamen trägt. Er ist der Wert des Umbenenn-Feldes; `name` ist
    //: nur die Anzeige und gehört in den Platzhalter.
    const eigenerName =
      typeof b.settings?.name === "string" ? b.settings.name : "";
    // Ein Handgriff läuft an Bausteinen über die Abschnittsliste, an
    // Containern über die Struktur-Endpunkte. Dieselben Griffe, zwei Wege —
    // deshalb zwei Rückrufe (siehe Props).
    const aktionAusfuehren = (aktion: EbenenAktion) =>
      k.art === "widget"
        ? onAktion?.(b.id, aktion)
        : onContainerAktion?.(b.id, aktion);

    return (
      <div key={b.id} className={k.art === "section" ? "mt-1 first:mt-0" : ""}>
        <div
          // Eine GESPERRTE Ebene lässt sich nicht ziehen — das ist der halbe
          // Zweck des Schlosses (der andere: sie fängt keinen Klick im Canvas
          // mehr ab).
          draggable={Boolean(onZiehen) && !gesperrt}
          onDragStart={(e) => {
            if (!onZiehen) return;
            e.stopPropagation();
            // Eigene MIME-Art: ein Baustein aus dem Katalog trägt
            // `text/plain`, und die beiden Ziehvorgänge dürfen sich nicht
            // gegenseitig annehmen.
            e.dataTransfer.setData(EBENEN_DRAG_TYP, b.id);
            e.dataTransfer.effectAllowed = "move";
            setZieht(b.id);
          }}
          onDragEnd={() => {
            setZieht(null);
            setUeberZiel(null);
          }}
          onDragOver={(e) => {
            if (!onZiehen || !zieht) return;
            const wohin = stelleAus(e, b.id);
            if (!zugErlaubt(zieht, b.id, wohin)) return;
            // Nur ein erlaubtes Ziel nimmt an. Ohne `preventDefault` zeigt der
            // Zeiger „verboten" — genau die Rückmeldung, die man hier will.
            e.preventDefault();
            e.stopPropagation();
            setUeberZiel({ quelleId: zieht, zielId: b.id, wohin });
          }}
          onDragLeave={() =>
            setUeberZiel((z) => (z?.zielId === b.id ? null : z))
          }
          onContextMenu={(e) => {
            // Das EIGENE Menü statt des Browser-Menüs: „Bild speichern unter"
            // hilft an einer Ebene niemandem.
            e.preventDefault();
            e.stopPropagation();
            setMenueSuche("");
            setMenue({ id: b.id, art: k.art, x: e.clientX, y: e.clientY });
          }}
          onDrop={(e) => {
            if (!onZiehen || !zieht) return;
            const wohin = stelleAus(e, b.id);
            if (!zugErlaubt(zieht, b.id, wohin)) return;
            e.preventDefault();
            e.stopPropagation();
            onZiehen({ quelleId: zieht, zielId: b.id, wohin });
            setZieht(null);
            setUeberZiel(null);
          }}
          className={
            "group/zeile relative flex items-center gap-1.5 rounded-(--radius) pr-1 transition " +
            (zieht === b.id ? "opacity-40 " : "") +
            (ueberZiel?.zielId === b.id && ueberZiel.wohin === "hinein"
              ? "ring-2 ring-(--brand) "
              : "") +
            // VOLLTON für die Auswahl, hell für ihren Teilbaum — die zwei
            // Stufen, an denen man in Framer ohne Aufklappen sieht, was
            // gewählt ist und was dazugehört. `bg-(--brand)/12` war beides
            // nicht: es sah aus wie ein Überfahren.
            (gewaehlt
              ? "bg-(--brand) text-white"
              : imAusgewaehlten
                ? "bg-(--brand)/10"
                : k.art === "section"
                  ? "bg-secondary/50 hover:bg-secondary"
                  : "hover:bg-secondary/70") +
            (gesperrt ? " opacity-60" : "")
          }
        >
          {/* Die Einfügelinie. Sie steht ÜBER oder UNTER der Zeile, an der der
              Zeiger gerade steht — dieselbe Sprache wie der blaue Balken auf
              der Fläche. */}
          {ueberZiel?.zielId === b.id && ueberZiel.wohin !== "hinein" ? (
            <span
              aria-hidden
              className={
                "pointer-events-none absolute inset-x-0 h-0.5 rounded-full bg-(--brand) " +
                (ueberZiel.wohin === "vor" ? "-top-px" : "-bottom-px")
              }
            />
          ) : null}
          {/* Der gewählte Baustein bekommt einen Balken an der Kante. Eine
              Tönung allein verschwindet, sobald die Zeile darüber beim
              Überfahren ebenfalls getönt ist. */}
          {gewaehlt ? (
            <span
              aria-hidden
              className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-(--brand)"
            />
          ) : null}

          {/* Der Aufklapp-Pfeil ist ein EIGENER Knopf. Läge er im Zeilen-Knopf,
              würde jeder Klick auf den Namen mit auf- und zuklappen — und man
              käme nie zum Inspektor. */}
          <span className="flex w-4 shrink-0 justify-center pl-1">
            {k.kinder.length > 0 ? (
              <button
                type="button"
                onClick={() => umklappen(b.id)}
                aria-expanded={offen}
                aria-label={name}
                className="text-muted-foreground transition hover:text-foreground"
              >
                <Icon
                  icon={offen ? "ph:caret-down" : "ph:caret-right"}
                  className="size-3"
                />
              </button>
            ) : null}
          </span>

          <Icon
            icon={k.art === "widget" ? (meta?.icon ?? "ph:question") : ART_SYMBOL[k.art]}
            className={"size-4 shrink-0 " + ART_FARBE[k.art]}
          />

          {benennt?.id === b.id ? (
            // Das Umbenenn-Feld steht AN DER STELLE des Namens und nicht in
            // einem Dialog: man sieht dabei die Nachbarzeilen, und genau die
            // sind der Grund, warum man umbenennt.
            <input
              autoFocus
              value={benennt.wert}
              maxLength={60}
              // Der PLATZHALTER trägt den Standardnamen, das Feld startet
              // leer. Andersherum — den Anzeigenamen als Wert vorzugeben —
              // speichert ein Doppelklick mit Enter den Standardnamen als
              // eigenen: die Zeile hieße danach fest „Abschnitt", auch wenn
              // ihr Inhalt längst ein anderer ist. Genau das ist beim ersten
              // Versuch passiert (28.08.2026), an zwei Zeilen gleichzeitig.
              placeholder={name}
              onChange={(e) =>
                setBenennt({ id: b.id, wert: e.target.value })
              }
              onBlur={() => {
                const neuerName = benennt.wert.trim() || null;
                // Nur bei echter Änderung schreiben. Ein Doppelklick, der die
                // Zeile nur ansieht, darf nichts speichern (Wurzel 2).
                if (neuerName !== (eigenerName || null)) {
                  onUmbenennen?.(b.id, neuerName);
                }
                setBenennt(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur();
                } else if (e.key === "Escape") {
                  // Abbrechen heißt: nichts speichern. Erst den Zustand
                  // löschen, dann das Feld verlassen — sonst schriebe das
                  // `onBlur` darüber den verworfenen Wert doch noch weg.
                  setBenennt(null);
                }
              }}
              className="min-w-0 flex-1 rounded-(--radius) border border-(--brand) bg-background px-1.5 py-1 text-sm outline-none"
            />
          ) : (
          <button
            type="button"
            onDoubleClick={() => {
              if (k.art === "widget" || !onUmbenennen) return;
              setBenennt({ id: b.id, wert: eigenerName });
            }}
            onClick={() => {
              // Seit 0479 hat auch ein CONTAINER einen Inspektor (Breite,
              // Spalten, Rang, Hintergrund). Vorher klappte diese Zeile nur
              // auf und zu, weil es nichts zu zeigen gab — jetzt ist sie ein
              // Ziel wie jede andere. Der Pfeil links klappt weiterhin.
              if (k.art === "widget") onWaehle(b.id);
              else if (onWaehleContainer) onWaehleContainer(b.id);
              else umklappen(b.id);
            }}
            className={
              "flex min-w-0 flex-1 items-baseline gap-1.5 py-1 text-left " +
              (k.art === "section"
                ? "text-sm font-semibold"
                : k.art === "widget"
                  ? "text-sm"
                  : "text-[0.8125rem] font-medium")
            }
          >
            <span className="shrink-0 truncate">{name}</span>
            {zusatz ? (
              <span className="min-w-0 truncate text-xs font-normal text-muted-foreground">
                · {zusatz}
              </span>
            ) : null}
          </button>
          )}

          {/* KEINE ABZEICHEN.
              Hier standen `12/12` und eine Anzahl an jeder Zeile. Im echten
              Layers-Panel (live abgelesen 25.08.2026, §9/§30) gibt es beides
              nicht — nur Pfeil, Symbol, Name und rechts das Auge, wo etwas
              versteckt ist. Die Abzeichen standen achtmal untereinander und
              trugen nichts bei; sie machten die eine Zeile, die wirklich
              geteilt ist, nur schwerer auffindbar.

              Der Breitenanteil steht dort, wo man ihn braucht: im Inspektor
              rechts, unter `Size`. */}
          {versteckt.length > 0 ? (
            <span className="shrink-0 text-[0.625rem] text-orange-500 group-hover/zeile:hidden">
              {versteckt.map((g) => t(`arbeitsflaeche.${g}`)).join(", ")}
            </span>
          ) : null}

          {/* KEINE HANDGRIFFE IN DER ZEILE (28.08.2026).
              Hier standen fünf Symbole, die nur beim Überfahren erschienen.
              Im Layers-Panel von Framer (live abgelesen) trägt eine Zeile
              NUR Pfeil, Symbol und Name; jede Aktion steht im Rechtsklick-
              Menü mit Tastenkürzel. Das ist nicht Geschmack: Symbole, die man
              erst beim Überfahren sieht, findet niemand, der sie nicht schon
              kennt — und sie fraßen die halbe Zeilenbreite, in der der Name
              stehen soll.

              Was BLEIBT, ist der Zustand: ein Schloss an einer gesperrten und
              ein durchgestrichenes Auge an einer versteckten Ebene. Beides
              sind keine Knöpfe, sondern Auskunft. */}
          {gesperrt ? (
            <button
              type="button"
              onClick={() => aktionAusfuehren("sperren")}
              aria-label={t("ebenen.entsperren")}
              title={t("ebenen.entsperren")}
              className="shrink-0 rounded p-0.5 text-muted-foreground transition hover:text-foreground"
            >
              <Icon icon="ph:lock-simple" className="size-3.5" />
            </button>
          ) : null}

          {onVersteckt ? (
            <button
              type="button"
              onClick={() => onVersteckt(b.id, umgeschaltet(versteckt, geraet))}
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
                  : t("arbeitsflaeche.ausblendenAuf")
              }
              className={
                "shrink-0 rounded p-0.5 transition " +
                (versteckt.includes(geraet)
                  ? "text-orange-500 hover:text-orange-600"
                  : "text-muted-foreground opacity-0 group-hover/zeile:opacity-100 focus:opacity-100")
              }
            >
              <Icon
                icon={versteckt.includes(geraet) ? "ph:eye-slash" : "ph:eye"}
                className="size-4"
              />
            </button>
          ) : null}
        </div>

        {/* Die Kinder hängen an einer senkrechten Führungslinie. Sie ist die
            Einrückung: ein bloßer Innenabstand zeigt die Tiefe erst, wenn man
            zwei Zeilen vergleicht — eine Linie zeigt sie sofort. */}
        {offen && k.kinder.length > 0 ? (
          <div className="ml-[1.0625rem] border-l border-border pl-1">
            {k.kinder.map((kind) => knotenZeigen(kind, k))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    // `select-none`: die Liste ist ein Werkzeug, kein Text. Ohne das blieb beim
    // Ziehen über die Zeilen die Textauswahl stehen und färbte den halben Baum
    // blau — im Screenshot vom 25.08.2026 jede einzelne Beschriftung.
    <div className="flex select-none flex-col gap-0.5 p-2">
      {/* SUCHE über dem Baum. Ohne sie ist eine Seite mit vierzig Ebenen ein
          Scrollfeld: die gesuchte liegt zugeklappt in der dritten
          Verschachtelung. Framer und Figma haben das Feld an genau dieser
          Stelle. */}
      <div className="relative mb-1 px-1">
        <Icon
          icon="ph:magnifying-glass"
          className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
        />
        <input
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setSuche("");
          }}
          placeholder={t("ebenen.suchen")}
          className="w-full rounded-(--radius) border border-border bg-background py-1 pl-8 pr-2 text-xs outline-none focus:border-(--brand)"
        />
        {suche ? (
          <button
            type="button"
            onClick={() => setSuche("")}
            aria-label={t("ebenen.sucheLeeren")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
          >
            <Icon icon="ph:x" className="size-3.5" />
          </button>
        ) : null}
      </div>

      {/* Kopf- und Fußzeile kommen aus dem Theme und nicht aus den Blöcken.
          Sie stehen trotzdem hier: Hostaways Ebenen-Panel ist ausdrücklich der
          Ort, an dem man eine ausgeblendete Kopfzeile wieder einblendet. */}
      <RegionZeile
        icon="ph:layout"
        label={t("ebenen.kopfzeile")}
        hinweis={t("ebenen.ausTheme")}
        onKlick={onSiteLayout}
      />

      {baum.length === 0 ? (
        <p className="px-3 py-2 text-xs text-muted-foreground">
          {t("ebenen.leer")}
        </p>
      ) : sichtbar && sichtbar.size === 0 ? (
        <p className="px-3 py-2 text-xs text-muted-foreground">
          {t("ebenen.keinTreffer", { suche })}
        </p>
      ) : (
        baum.map((k) => knotenZeigen(k))
      )}

      <RegionZeile
        icon="ph:layout"
        label={t("ebenen.fusszeile")}
        hinweis={t("ebenen.ausTheme")}
        onKlick={onSiteLayout}
      />

      <button
        type="button"
        onClick={onSiteLayout}
        className="mt-2 flex items-center gap-2 rounded-(--radius) border-t border-border px-2 pb-1.5 pt-3 text-left text-sm text-muted-foreground transition hover:text-foreground"
      >
        <Icon icon="ph:columns" className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{t("ebenen.siteLayout")}</span>
        <Icon icon="ph:caret-right" className="size-3 shrink-0" />
      </button>

      {/* DAS KONTEXTMENÜ. Ein eigenes Bauteil wäre eine zweite Datei für
          fünfzig Zeilen, die nirgends sonst gebraucht werden — es lebt hier,
          wo die Zeile es öffnet. */}
      {menue ? (
        <>
          {/* Die Fangfläche schließt das Menü beim Klick daneben. Ohne sie
              bliebe es stehen, bis man einen Eintrag wählt — und ein Menü, das
              man nicht schließen kann, ohne etwas auszulösen, ist eine
              Falle. */}
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
            className="fixed z-50 w-56 overflow-hidden rounded-(--radius) border border-border bg-background py-1 shadow-lg"
            style={{
              // Am Rand nach innen ziehen: ein Menü, das halb außerhalb des
              // Fensters steht, ist keins.
              left: Math.min(menue.x, window.innerWidth - 232),
              top: Math.min(menue.y, window.innerHeight - 320),
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
            {MENUE_EINTRAEGE.filter((e) => {
              // Umbenennen gibt es nur an Containern: ein Baustein heißt nach
              // seinem Typ, und sein Name liefe über einen zweiten Schreibweg
              // (Wurzel 2).
              if (e.aktion === "umbenennen" && menue.art === "widget") {
                return false;
              }
              const text = menueSuche.trim().toLowerCase();
              if (!text) return true;
              return t(`ebenen.${e.schluessel}`).toLowerCase().includes(text);
            }).map((e) => (
              <button
                key={e.aktion}
                type="button"
                role="menuitem"
                onClick={() => {
                  const ziel = menue.id;
                  const art = menue.art;
                  setMenue(null);
                  if (e.aktion === "umbenennen") {
                    const block = blocks.find((b) => b.id === ziel);
                    const eigen =
                      typeof block?.settings?.name === "string"
                        ? block.settings.name
                        : "";
                    setBenennt({ id: ziel, wert: eigen });
                    return;
                  }
                  if (art === "widget") onAktion?.(ziel, e.aktion);
                  else onContainerAktion?.(ziel, e.aktion);
                }}
                className={
                  "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition hover:bg-secondary " +
                  (e.gefahr ? "text-destructive" : "")
                }
              >
                <Icon icon={e.icon} className="size-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">
                  {t(`ebenen.${e.schluessel}`)}
                </span>
                <span className="shrink-0 text-[0.625rem] text-muted-foreground">
                  {e.kuerzel}
                </span>
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

/** Kopf- und Fußzeile.
 *
 *  Sie stehen als ZEILEN DES BAUMS da, nicht als andersartige Knöpfe darüber
 *  und darunter: im echten Layers-Panel ist `Header` der erste Knoten des
 *  Baums, mit Aufklapp-Pfeil und orangefarbenem Symbol, und darunter hängen
 *  `Section › Column › Image / Navigation Links` (live abgelesen 25.08.2026,
 *  §9). Genau deshalb sagte der Nutzer „eine Kopfzeile ist eine Nav".
 *
 *  Was hier NOCH fehlt und bewusst nicht vorgetäuscht wird: die Kinder. Unsere
 *  Regionen liegen noch nicht als Blöcke in `site_blocks`, also gibt es nichts
 *  aufzuklappen. Die Zeile führt deshalb ins Regionen-Panel, statt einen leeren
 *  Pfeil anzubieten. Ein Aufklapp-Pfeil, unter dem nichts steht, wäre die
 *  Attrappe, gegen die Wurzel 4 steht.
 */
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
    <div className="group/zeile flex items-center gap-1.5 rounded-(--radius) pr-1 transition hover:bg-secondary/70">
      {/* Dieselbe Pfeil-Spalte wie im Baum, damit die Symbole auf einer Linie
          stehen. Leer, solange es keine Kinder gibt. */}
      <span className="w-4 shrink-0 pl-1" />
      <Icon icon={icon} className="size-4 shrink-0 text-orange-500" />
      <button
        type="button"
        onClick={onKlick}
        className="min-w-0 flex-1 truncate py-1.5 text-left text-sm font-semibold"
      >
        {label}
      </button>
      <span className="shrink-0 text-[0.625rem] text-muted-foreground">
        {hinweis}
      </span>
    </div>
  );
}
