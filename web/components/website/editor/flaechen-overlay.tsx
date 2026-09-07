"use client";

// Die ARBEITSFLÄCHE — und zwar auf der gerenderten Seite selbst, nicht daneben.
//
// Vorher stand hier eine dritte Spalte: eine Liste von Karten („Abschnitt ·
// Text · Ausgeblendet auf: Mobil") neben der Vorschau. Sie war eine Attrappe.
// Wer eine Überschrift ändern wollte, suchte sie in einer abstrakten Liste,
// deren Reihenfolge zwar stimmte, die aber nichts zeigte — und sah die Wirkung
// erst danach im Bild nebenan. Genau die Bedienung, die eine Arbeitsfläche
// abschaffen soll.
//
// Jetzt liegt die Bedienung DORT, wo der Abschnitt steht: Rahmen, Etikett,
// schwebende Leiste und Kontextmenü werden über den iframe gezeichnet, an den
// Koordinaten, die der Renderer selbst meldet.
//
// WIE DIE GEOMETRIE HIERHER KOMMT
// Der Renderer läuft auf einem eigenen Origin (Port 3200 gegen 3001) — das
// Dashboard kann sein DOM nicht messen und darf es auch nicht. Deshalb misst
// der Renderer selbst und schickt die Rechtecke über die bestehende Brücke
// (`builder/components/blocks/canvas-bridge.tsx`, Meldung `rects`). Die Werte
// sind relativ zum SICHTFENSTER des iframes; unsere Überlagerung liegt
// deckungsgleich auf dem iframe-Element, also werden sie unverändert
// übernommen. Beim Scrollen IM iframe kommen neue Werte — hier wird nichts
// nachgerechnet, was drüben schon gemessen wurde.
//
// WARUM `pointer-events-none` AUF DER SCHICHT
// Die Überlagerung liegt über der ganzen Seite. Nähme sie Klicks an, käme kein
// einziger mehr im iframe an: kein Textcursor, kein Aufklappen, kein Scrollen.
// Sie ist durchlässig; nur die Leiste und das Menü selbst fangen Klicks.
//
// WEGGELASSEN, WEIL ES SIE BEI UNS NICHT GIBT (statt sie als tote Knöpfe zu
// zeigen): `Edit HTML/CSS`, `Add CSS Class Name`, `Add Comment`,
// `Lock Editing for Client`, `Set As Anchor`, `Select Layer` (unsere Seite ist
// eine flache Liste, es gibt keine zweite Ebene) und `Ausrichten` (das Layout
// gehört dem Theme).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import {
  LAYOUT_BAUSTEINE,
  type LayoutBaustein,
} from "../abschnitte";
import type { Geraet } from "../vorschau";
import {
  type FlaechenZeile,
  Kontextmenue,
  type MenuOrt,
} from "./flaechen-teile";
import { darstellungFuer } from "@nextdays/baukasten-stil";

import { versteckteGeraete } from "./sichtbarkeit";

/** Ein gemeldetes Rechteck, so wie die Brücke es schickt. */
export type Rechteck = {
  index: number;
  /** DB-ID des Blocks, den dieses Rechteck umschließt. Die Zuordnung zur
   *  Editor-Zeile läuft darüber — der `index` zählt auch Container mit, die
   *  der Editor nicht kennt. */
  id?: string;
  /** Was der Knoten IST: `section` · `column` · `inner_column` · `widget`.
   *
   *  Ein leerer Container hat KEINE Zeile im Editor-Modell (das führt nur
   *  Bausteine) — er ist aber der Ort, an dem der nächste Baustein landen
   *  soll. Ohne diese Unterscheidung war ein frisch angelegtes Spaltenlayout
   *  unbenutzbar: die Spalten standen da, der Editor sah nur Baustein-Nähte,
   *  und es gab keinen Weg, etwas hineinzuziehen. */
  kind?: string;
  top: number;
  left: number;
  width: number;
  height: number;
};

export function FlaechenOverlay({
  zeilen,
  rechtecke,
  aktiv,
  containerId = null,
  regionRect = null,
  elternRect = null,
  teilRect = null,
  auswahlSettings = null,
  kinderRects = [],
  onMass,
  onAbstand,
  onPadding,
  onElternteil,
  flaechenZug = null,
  onFlaechenZug,
  ueberfahren,
  zeiger,
  menu,
  geraet,
  zieht,
  onAbwurf,
  onAbwurfInSpalte,
  onMenu,
  onWaehle,
  onInhalt,
  onDesign,
  onDuplizieren,
  onEinfuegenAn,
  onLayoutEinfuegen,
  onVerschiebe,
  onEntferne,
  onVersteckt,
}: {
  zeilen: FlaechenZeile[];
  /** Rechtecke je Abschnitts-INDEX. Leer, solange der Handschlag mit dem
   *  Renderer nicht steht — dann zeichnet die Schicht nichts, statt Rahmen an
   *  geratene Stellen zu legen (Wurzel 4). */
  rechtecke: Map<number, Rechteck>;
  aktiv: string | null;
  /** Der gewählte CONTAINER (Abschnitt, Spalte). Er bekommt seit 05.09.2026
   *  einen eigenen Rahmen — vorher blieb die Fläche bei Container-Auswahl
   *  leer (Befund 6), obwohl die Brücke sein Rechteck mit meldete. */
  containerId?: string | null;
  /** Rechteck der gewählten Kopf-/Fußzeilen-Ebene (0570) — sie hat keinen
   *  Block-Index, ihr Rahmen kommt deshalb fertig gemessen herein. */
  regionRect?: Pick<Rechteck, "top" | "left" | "width" | "height"> | null;
  /** Rechteck des gewählten TEILS eines Bausteins (Überschrift, Absatz, Bild —
   *  06.09.2026). Ist eines gewählt, trägt ES die Kante und die Griffe: es ist
   *  die Auswahl, der Baustein darum nur ihr Rahmen. */
  teilRect?: Pick<Rechteck, "top" | "left" | "width" | "height"> | null;
  /** Rechteck des ELTERNTEILS der Auswahl — Framer zeichnet ihn gestrichelt
   *  daneben, damit man sieht, worin man arbeitet (gemessen 06.09.2026). */
  elternRect?: Pick<Rechteck, "top" | "left" | "width" | "height"> | null;
  /** Die Darstellung des gewählten Elements. Aus ihr entscheidet sich, WELCHE
   *  Griffe es gibt: eine Achse auf „Inhalt" wird gemessen, nicht gesetzt —
   *  ein Griff daran wäre ein Versprechen, das die Zeile im Panel nicht
   *  einlöst (Wurzel 4). */
  auswahlSettings?: Record<string, unknown> | null;
  /** Die Rechtecke der direkten KINDER des gewählten Containers — für die
   *  Abstandsmarker zwischen ihnen (Framers magenta Striche). */
  kinderRects?: readonly Pick<Rechteck, "top" | "left" | "width" | "height">[];
  /** Ein Griff wurde gezogen: die Achse bekommt ein festes Maß in Pixeln.
   *  `fertig` = die Maus ist los (erst dann wird gespeichert; währenddessen
   *  zeigt die Vorschau den Wert schon über den Live-Stil). */
  onMass?: (achse: "breite" | "hoehe", px: number, fertig: boolean) => void;
  /** Der Abstand zwischen den Kindern wurde gezogen (Framers Gap-Marker). */
  onAbstand?: (px: number, fertig: boolean) => void;
  /** Ein Innenabstand wurde an seiner Kante gezogen (Framers Padding-Marker). */
  onPadding?: (
    seite: "top" | "right" | "bottom" | "left",
    px: number,
    fertig: boolean,
  ) => void;
  /** ⎋: eine Ebene nach oben (Framers „Select Parent"). Liefert `true`, wenn
   *  es einen Elternteil GAB — sonst hebt die Fläche die Auswahl auf. */
  onElternteil?: () => boolean;
  /** Ein laufender Ziehvorgang auf der Fläche (06.09.2026): welcher Baustein
   *  und wo steht der Zeiger. `fertig` = die Maus ist los. */
  flaechenZug?: { key: string; x: number; y: number; fertig?: boolean } | null;
  /** Der Zug ist zu Ende: den Baustein an diese Stelle setzen (`null` = an
   *  derselben Stelle lassen), und die Geste abräumen. */
  onFlaechenZug?: (key: string, stelle: number | null) => void;
  /** Index des überfahrenen Abschnitts, oder `null`. */
  ueberfahren: number | null;
  /** Zeigerposition im iframe, oder `null`, wenn er die Fläche verlassen hat. */
  zeiger: { x: number; y: number } | null;
  menu: MenuOrt;
  geraet: Geraet;
  /** Der Baustein-Typ, der gerade gezogen wird — oder `null`.
   *
   *  Solange er gesetzt ist, nimmt diese Schicht Zeigerereignisse an. Sonst ist
   *  sie durchlässig, denn sonst käme kein Klick mehr im iframe an. */
  zieht: string | null;
  /** Abwurf: den gezogenen Baustein an dieser POSITION einfügen. */
  onAbwurf: (position: number) => void;
  /** Abwurf in eine LEERE Spalte (0472). Ohne diesen Rückruf bleibt es beim
   *  alten Verhalten: nur Nähte zwischen Bausteinen sind Ziele. */
  /** Abwurf in eine SPALTE. `stelle` ist der Rang in der Baustein-Liste des
   *  Editors, an dem der neue Baustein landet — bei einer gefüllten Spalte
   *  also GENAU zwischen zwei vorhandenen. Ohne diese Zahl konnte man nur in
   *  LEERE Spalten ziehen: eine gefüllte hatte kein Abwurfziel, und ein
   *  zweiter Baustein in derselben Spalte war unmöglich (0479). */
  onAbwurfInSpalte?: (spalteId: string, stelle?: number) => void;
  onMenu: (ort: MenuOrt) => void;
  onWaehle: (key: string | null) => void;
  onInhalt: (key: string) => void;
  onDesign: (key: string) => void;
  onDuplizieren: (key: string) => void;
  /** Neuen Abschnitt an POSITION einfügen (0 = ganz oben). Getrennt von
   *  `onEinfuegenNach`, weil die Naht über dem ERSTEN Abschnitt keinen
   *  Vorgänger hat, den man „danach" nennen könnte. */
  onEinfuegenAn: (position: number) => void;
  /** Ein LAYOUT an einer Naht einsetzen. Ohne diesen Rückruf springt das „+"
   *  wie früher direkt in den Katalog. */
  onLayoutEinfuegen?: (bs: LayoutBaustein, position: number) => void;
  onVerschiebe: (key: string, richtung: -1 | 1) => void;
  onEntferne: (key: string) => void;
  onVersteckt: (key: string, geraete: Geraet[]) => void;
}) {

  // FLACKERN, und warum es entsteht.
  //
  // Die Bedienelemente dieser Schicht liegen im Dashboard-Dokument, ÜBER dem
  // iframe. Sobald der Zeiger eines davon berührt, bekommt der iframe kein
  // `mousemove` mehr und meldet `mouseleave` — die Brücke schickt also
  // „Zeiger weg". Die Schicht nähme daraufhin die Naht weg, der Zeiger stünde
  // wieder über dem iframe, die Naht käme zurück, und so fort: ein Knopf, der
  // im Takt der Mausbewegung blinkt.
  //
  // Der letzte bekannte Zeigerstand wird deshalb FESTGEHALTEN, solange die
  // Maus über einem Element dieser Schicht steht. Er ist dann auch der
  // richtige: der Zeiger hat den iframe ja nicht wirklich verlassen, er steht
  // nur auf etwas, das darüber liegt.
  const [ueberBedienung, setUeberBedienung] = useState(false);
  const letzterZeiger = useRef<{ x: number; y: number } | null>(null);
  if (zeiger) letzterZeiger.current = zeiger;
  const wirksamerZeiger = zeiger ?? (ueberBedienung ? letzterZeiger.current : null);

  // WELCHER RENDERER-INDEX gehört zu welcher Editor-Zeile.
  //
  // Die beiden Zählungen sind NICHT dieselbe: der Renderer nummeriert jeden
  // Knoten des Baums (Abschnitt · Spalte · Baustein), der Editor führt nur die
  // Bausteine. Bei sechs Bausteinen hat der Renderer die Indizes 0..17 und der
  // Editor 0..5 — `rechtecke.get(aktivIndex)` traf deshalb das Rechteck eines
  // fremden Abschnitts, und der blaue Rahmen saß auf dem falschen Element
  // (26.08.2026: Klick auf „Bild" markierte „Kontakt").
  //
  // Die Brücke meldet zu jedem Rechteck die DB-ID mit; darüber ist die
  // Zuordnung eindeutig. Fehlt sie (ein noch nie gespeicherter Baustein), gilt
  // der Index — für ihn stimmt er, weil er als einziger neu ist.
  const rendererIndex = (zeilenIndex: number): number => {
    const id = zeilen[zeilenIndex]?.id;
    if (id) {
      for (const [i, r] of rechtecke) if (r.id === id) return i;
    }
    return zeilenIndex;
  };

  const aktivIndex = zeilen.findIndex((z) => z.key === aktiv);
  const aktivRect =
    aktivIndex >= 0 ? rechtecke.get(rendererIndex(aktivIndex)) : undefined;
  // `ueberfahren` ist ein RENDERER-Index (er kommt so aus der Brücke),
  // `aktivIndex` ein EDITOR-Index. Der Vergleich lief vorher direkt zwischen
  // beiden und war damit sinnlos: bei sechs Bausteinen heißt der aktive
  // Abschnitt im Editor 2 und im Renderer 8, `2 !== 8` ist immer wahr, und der
  // Hover-Rahmen lag zusätzlich auf dem schon ausgewählten Abschnitt — zwei
  // Rahmen auf demselben Element. Verglichen wird deshalb im Renderer-Raum.
  const aktivRendererIndex = aktivIndex >= 0 ? rendererIndex(aktivIndex) : -1;
  const hoverRect =
    ueberfahren != null && ueberfahren !== aktivRendererIndex
      ? rechtecke.get(ueberfahren)
      : undefined;
  // Rechteck des gewählten Containers — über die ID, nie über den Index.
  const containerRect = containerId
    ? [...rechtecke.values()].find((r) => r.id === containerId)
    : undefined;
  /** Das Rechteck der AUSWAHL, gleich welcher Art. Griffe und Maße hängen
   *  daran; eine Regions-Ebene (Kopf-/Fußzeile) hat keine eigenen Settings und
   *  bekommt deshalb keine. */
  const auswahlRect = teilRect ?? aktivRect ?? containerRect ?? null;
  // WELCHE NAHT das „+" bekommt.
  //
  // Zwei Wege, und beide braucht man:
  //   · die Naht am AUSGEWÄHLTEN Abschnitt — sie steht ruhig da, solange man an
  //     ihm arbeitet, und „darunter noch etwas" ist der häufigste nächste
  //     Schritt;
  //   · die Naht, der sich der ZEIGER nähert — das ist der Weg, um zwischen
  //     zwei bestehende Abschnitte etwas zu setzen, ohne vorher einen davon
  //     auszuwählen.
  //
  // Entscheidend ist die NÄHE zur Kante, nicht der Abschnitt unter dem Zeiger.
  // Ein „+", das an jeder Unterkante des gerade überfahrenen Abschnitts hängt,
  // zieht beim Lesen quer durchs Bild; eines, das erst im letzten Zentimeter
  // vor der Grenze erscheint, steht genau dort, wo man ohnehin klicken würde.
  const NAHT_NAEHE = 44;
  // Die Menge trägt RENDERER-Indizes: sie zeigt auf das Rechteck, an dem die
  // Naht klebt. Für den aktiven Abschnitt muss der Editor-Index deshalb erst
  // umgerechnet werden — `rechtecke.get(aktivIndex)` wäre das Rechteck eines
  // fremden Knotens (dieselbe Verwechslung wie beim Auswahl-Rahmen).
  const nahtIndizes = new Set<number>();
  if (aktivIndex >= 0) nahtIndizes.add(rendererIndex(aktivIndex));
  // Die Naht ÜBER dem ersten Abschnitt wird getrennt entschieden. Sonst
  // erschiene sie, sobald Abschnitt 0 aus IRGENDEINEM Grund in der Menge steht
  // — also auch, wenn der Zeiger an seiner UNTERkante steht und mit dem
  // Seitenanfang nichts zu tun hat.
  const erstes = rechtecke.get(0);
  let obenNaht = aktivIndex === 0;
  if (wirksamerZeiger) {
    const z = wirksamerZeiger;
    for (const [i, r] of rechtecke) {
      if (z.x < r.left || z.x > r.left + r.width) continue;
      if (Math.abs(z.y - (r.top + r.height)) <= NAHT_NAEHE) {
        nahtIndizes.add(i);
      }
    }
    if (
      erstes &&
      z.x >= erstes.left &&
      z.x <= erstes.left + erstes.width &&
      Math.abs(z.y - erstes.top) <= NAHT_NAEHE
    ) {
      obenNaht = true;
    }
  }

  // ESCAPE — im Vorbild „Select Parent" (gemessen 06.09.2026: Text → Stack →
  // Abschnitt → Breakpoint, und das Panel folgt jedes Mal mit).
  //
  // Drei Stufen, in dieser Reihenfolge:
  //   1. ein offenes Kontextmenü schließen (der Weg zurück aus einem
  //      Fehlklick, ohne die Auswahl zu verlieren),
  //   2. eine Ebene nach OBEN — das ist der Weg, den man auf der Fläche
  //      braucht: klicken trifft immer das Innerste, und der Rahmen darum ist
  //      genau eine Taste entfernt,
  //   3. erst wenn es keinen Elternteil mehr gibt, die Auswahl aufheben.
  //
  // Vorher hob Escape sofort alles auf. Wer den Abschnitt um einen Text
  // wählen wollte, musste ihn über den Ebenen-Baum suchen.
  useEffect(() => {
    function aufTaste(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      const ziel = e.target as HTMLElement | null;
      // In einem Feld gehört Escape dem Feld.
      if (
        ziel &&
        (ziel.tagName === "INPUT" ||
          ziel.tagName === "TEXTAREA" ||
          ziel.isContentEditable)
      ) {
        return;
      }
      if (menu) {
        onMenu(null);
        return;
      }
      if (onElternteil?.()) return;
      onWaehle(null);
    }
    window.addEventListener("keydown", aufTaste);
    return () => window.removeEventListener("keydown", aufTaste);
  }, [menu, onMenu, onWaehle, onElternteil]);

  // --- Ziehen und Abwerfen ------------------------------------------------
  //
  // Beim Ziehen schickt der iframe KEINE Zeigermeldungen: die Maus gehört dann
  // dem Ziehvorgang. Die Stelle wird deshalb hier aus dem `dragover`-Ereignis
  // bestimmt — und zwar im selben Koordinatensystem wie die Rechtecke, weil
  // diese Schicht deckungsgleich auf dem iframe liegt.
  const flaeche = useRef<HTMLDivElement>(null);
  const [abwurfStelle, setAbwurfStelle] = useState<number | null>(null);
  /** Die leere Spalte, in die gerade abgeworfen würde. Ein eigener Zustand und
   *  nicht ein Sonderwert in `abwurfStelle`: die beiden Ziele sind verschiedene
   *  Dinge (ein Rang in der Liste gegen eine DB-ID), und sie in eine Zahl zu
   *  pressen hieße, am anderen Ende wieder auseinanderzusortieren. */
  const [abwurfSpalte, setAbwurfSpalte] = useState<{
    id: string;
    rect: Rechteck;
  } | null>(null);

  // DIE EINFÜGESTELLE IST EIN EDITOR-INDEX, KEIN RENDERER-INDEX.
  //
  // Das war der Fehler „ein neuer Abschnitt landet immer unten" (27.08.2026).
  // Die Stelle wurde als `rendererIndex + 1` gemeldet und am anderen Ende als
  // Rang in der Baustein-Liste des Editors gelesen. Seit 0472 hängt jedes
  // Widget in `section > column`, der Renderer zählt also drei Knoten je
  // Baustein: bei sechs Bausteinen meldete die Naht unter dem zweiten die
  // Stelle 6, und `hinzufuegen` klemmte 6 auf die Listenlänge — ans Ende.
  //
  // Gerechnet wird deshalb GEOMETRISCH und nur über die Bausteine: wie viele
  // Bausteine liegen (mit ihrer Mitte) ÜBER dieser Kante? Diese Zahl IST der
  // Rang in `zeilen`. Kein Index-Raum-Wechsel, keine Annahme über den Aufbau
  // des Baums — und richtig auch dann, wenn der Renderer morgen eine vierte
  // Ebene meldet.
  //
  // Sortiert in LESERICHTUNG (oben nach unten, links nach rechts) und nicht in
  // der Reihenfolge der Map: die Reihenfolge der Meldungen aus der Brücke ist
  // nichts, worauf sich ein Rang verlassen darf, und bei zwei Bausteinen
  // nebeneinander entscheidet die linke Kante.
  const bausteinRechtecke = [...rechtecke.values()]
    .filter((r) => (r.kind ?? "widget") === "widget")
    .sort((a, b) => a.top - b.top || a.left - b.left);

  /** Rang in `zeilen` für eine waagerechte Kante bei `y`. */
  function editorStelle(y: number): number {
    let n = 0;
    for (const r of bausteinRechtecke) {
      if (r.top + r.height / 2 < y) n += 1;
    }
    return n;
  }

  // ZIEHEN AUF DER FLÄCHE: die Einfügestelle unter dem Zeiger, und beim
  // Loslassen die Umsortierung. Gerechnet wird geometrisch (`editorStelle`) —
  // dieselbe Regel wie beim Abwurf aus dem Katalog, und aus demselben Grund:
  // die Rechtecke des Renderers zählen anders als die Liste des Editors.
  const zugStelle =
    flaechenZug && !flaechenZug.fertig ? editorStelle(flaechenZug.y) : null;
  useEffect(() => {
    if (!flaechenZug?.fertig || !onFlaechenZug) return;
    onFlaechenZug(flaechenZug.key, editorStelle(flaechenZug.y));
    // `editorStelle` liest die Rechtecke des laufenden Renders; sie stehen
    // beim Abwurf fest, und ein erneuter Lauf würde nur denselben Wert
    // liefern.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flaechenZug?.fertig]);


  /** Die innerste SPALTE unter dem Zeiger — gleich ob leer oder gefüllt.
   *
   *  „Innerste" über die Fläche: eine innere Spalte liegt in einer Spalte, und
   *  wer über beiden steht, meint die kleinere. Vorher zählten nur LEERE
   *  Spalten als Ziel; damit ließ sich ein Spaltenlayout einmal füllen und nie
   *  wieder ergänzen. */
  function spalteUnter(x: number, y: number): { id: string; rect: Rechteck } | null {
    let treffer: { id: string; rect: Rechteck } | null = null;
    for (const r of rechtecke.values()) {
      if (r.kind !== "column" && r.kind !== "inner_column") continue;
      if (!r.id) continue;
      if (x < r.left || x > r.left + r.width) continue;
      if (y < r.top || y > r.top + r.height) continue;
      const flaecheR = r.width * r.height;
      const bisher = treffer ? treffer.rect.width * treffer.rect.height : Infinity;
      if (flaecheR < bisher) treffer = { id: r.id, rect: r };
    }
    return treffer;
  }

  /** Die Bausteine INNERHALB eines Rechtecks, in Leserichtung. */
  function bausteineIn(rect: Rechteck): Rechteck[] {
    return bausteinRechtecke.filter(
      (k) =>
        k.top >= rect.top &&
        k.top + k.height <= rect.top + rect.height &&
        k.left >= rect.left &&
        k.left + k.width <= rect.left + rect.width,
    );
  }

  /** Die Naht, die dem Zeiger am nächsten liegt — als EDITOR-Stelle. */
  function stelleAus(y: number): number {
    return editorStelle(y);
  }

  /** Wo der blaue Balken gezeichnet wird — im selben Raum wie die Stelle:
   *  zwischen Baustein `stelle - 1` und `stelle`. */
  function balkenY(stelle: number): number | null {
    if (bausteinRechtecke.length === 0) return null;
    if (stelle <= 0) return bausteinRechtecke[0].top;
    const davor = bausteinRechtecke[Math.min(stelle, bausteinRechtecke.length) - 1];
    return davor ? davor.top + davor.height : null;
  }

  const balken = abwurfStelle == null ? null : balkenY(abwurfStelle);

  return (
    <div
      ref={flaeche}
      className={
        (zieht ? "pointer-events-auto" : "pointer-events-none") +
        " absolute inset-0 overflow-hidden"
      }
      // Die Ereignisse blubbern von den Knöpfen hierher — ein Empfänger genügt,
      // statt ihn an jedes Element einzeln zu hängen.
      onMouseOver={() => setUeberBedienung(true)}
      onMouseOut={() => setUeberBedienung(false)}
      onDragOver={(e) => {
        if (!zieht) return;
        // Ohne `preventDefault` lehnt der Browser den Abwurf ab — und zwar
        // stumm: der Zeiger zeigt ein Verbotszeichen, und niemand erfährt,
        // warum das Ziehen nicht geht.
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        const kasten = flaeche.current?.getBoundingClientRect();
        if (!kasten) return;
        const x = e.clientX - kasten.left;
        const y = e.clientY - kasten.top;
        // Eine Spalte unter dem Zeiger hat VORRANG vor der nächsten Naht: sie
        // ist das genauere Ziel, und sie ist der einzige Weg, ein
        // Spaltenlayout zu füllen.
        const spalte = spalteUnter(x, y);
        if (!spalte) {
          setAbwurfSpalte(null);
          setAbwurfStelle(stelleAus(y));
          return;
        }
        const drin = bausteineIn(spalte.rect);
        setAbwurfSpalte(spalte);
        // In einer GEFÜLLTEN Spalte zeigt der Balken zwischen ihren
        // Bausteinen, nicht am Rand der ganzen Reihe: gerechnet wird deshalb
        // nur mit denen, die wirklich darin liegen — und daraus wieder eine
        // Stelle in der GESAMTliste, denn die führt der Editor.
        setAbwurfStelle(drin.length === 0 ? null : stelleAus(y));
      }}
      onDragLeave={() => {
        setAbwurfStelle(null);
        setAbwurfSpalte(null);
      }}
      onDrop={(e) => {
        if (!zieht) return;
        e.preventDefault();
        const stelle = abwurfStelle;
        const spalte = abwurfSpalte;
        setAbwurfStelle(null);
        setAbwurfSpalte(null);
        // In eine Spalte, wenn eine getroffen ist — sonst wie bisher an eine
        // Naht.
        if (spalte) onAbwurfInSpalte?.(spalte.id, stelle ?? undefined);
        else if (stelle != null) onAbwurf(stelle);
      }}
    >
      {/* Die getroffene leere SPALTE wird ausgefüllt hervorgehoben. Ein Balken
          wie bei den Nähten passt hier nicht: dort geht es um eine Stelle
          ZWISCHEN zwei Dingen, hier um eine Fläche, die etwas aufnimmt. */}
      {abwurfSpalte ? (
        <div
          aria-hidden
          style={{
            top: `${abwurfSpalte.rect.top}px`,
            left: `${abwurfSpalte.rect.left}px`,
            width: `${abwurfSpalte.rect.width}px`,
            height: `${abwurfSpalte.rect.height}px`,
          }}
          className="pointer-events-none absolute rounded-(--radius) border-2 border-blue-500 bg-blue-500/15"
        />
      ) : null}

      {/* Die Einfügelinie beim Ziehen AUF DER FLÄCHE (06.09.2026). Sie sitzt
          an der Naht, an der der Baustein landen würde — dieselbe Rückmeldung
          wie beim Abwurf aus dem Katalog, nur dass hier ein vorhandener
          Baustein umzieht. */}
      {zugStelle != null && flaechenZug
        ? (() => {
            const kante = bausteinRechtecke[zugStelle - 1];
            const naechstes = bausteinRechtecke[zugStelle];
            const y = kante
              ? kante.top + kante.height
              : (naechstes?.top ?? 0);
            const links = kante?.left ?? naechstes?.left ?? 0;
            const breite = kante?.width ?? naechstes?.width ?? 0;
            return (
              <div
                aria-hidden
                style={{ top: `${y}px`, left: `${links}px`, width: `${breite}px` }}
                className="pointer-events-none absolute h-0.5 -translate-y-1/2 rounded-full bg-[#0099ff]"
              />
            );
          })()
        : null}

      {/* Der blaue Einfüge-Balken. Er ist die einzige Rückmeldung während des
          Ziehens — ohne ihn wirft man ins Ungewisse und sieht erst danach, wo
          der Abschnitt gelandet ist. */}
      {balken != null ? (
        <div
          aria-hidden
          style={{ top: `${balken}px` }}
          className="absolute inset-x-0 -translate-y-1/2"
        >
          <div className="h-1 w-full rounded-full bg-blue-500" />
        </div>
      ) : null}
      {/* Rahmen unter dem Zeiger — 1 px in der Akzentfarbe, ohne Füllung.
          Am 06.09.2026 im Vorbild nachgemessen: Framer benutzt für Überfahren
          UND Auswahl dieselbe Farbe und unterscheidet sie über die Kante —
          hauchdünn beim Überfahren, voll bei der Auswahl (dort kommen die
          Griffe dazu). Vorher stand hier ein oranger 2-px-Rahmen mit Füllung;
          das war gut gemeint („zwei Zustände, zwei Farben"), sah beim Fahren
          über eine Liste aber aus wie eine Warnung an jedem Abschnitt. */}
      {hoverRect ? (
        <div
          aria-hidden
          style={rahmenStil(hoverRect)}
          className="pointer-events-none absolute outline outline-1 outline-[#0099ff]/60"
        />
      ) : null}

      {/* Der ELTERNTEIL der Auswahl — gestrichelt, ohne Füllung. Framer zeigt
          ihn mit, sobald ein Kind gewählt ist: man sieht, worin man steckt,
          bevor man ⎋ drückt (gemessen 06.09.2026). */}
      {elternRect ? (
        <div
          aria-hidden
          style={rahmenStil(elternRect)}
          className="pointer-events-none absolute border border-dashed border-[#0099ff]/50"
        />
      ) : null}

      {/* Der gewählte CONTAINER. Durchgezogen, 1 px, Akzentfarbe — dieselbe
          Kante wie bei einem Baustein: „ausgewählt" ist EIN Zustand, und zwei
          Stricharten dafür sähen aus wie zwei verschiedene Dinge. */}
      {containerRect ? (
        <div
          aria-hidden
          style={rahmenStil(containerRect)}
          className="pointer-events-none absolute outline outline-1 outline-[#0099ff]"
        />
      ) : null}
      {regionRect ? (
        <div
          aria-hidden
          style={rahmenStil(regionRect)}
          className="pointer-events-none absolute outline outline-1 outline-[#0099ff]"
        />
      ) : null}

      {/* Ist ein TEIL gewählt, trägt der Baustein darum nur noch die
          gestrichelte Elternkontur — wie in Framer, wo der Stack um den
          gewählten Text gestrichelt erscheint. */}
      {teilRect && aktivRect ? (
        <div
          aria-hidden
          style={rahmenStil(aktivRect)}
          className="pointer-events-none absolute border border-dashed border-[#0099ff]/50"
        />
      ) : null}
      {teilRect ? (
        <div
          aria-hidden
          style={rahmenStil(teilRect)}
          className="pointer-events-none absolute outline outline-1 outline-[#0099ff]"
        />
      ) : null}

      {aktivRect && aktivIndex >= 0 && !teilRect ? (
        <AktiverRahmen
          rect={aktivRect}
          zeile={zeilen[aktivIndex]!}
          geraet={geraet}
          onVersteckt={onVersteckt}
        />
      ) : null}

      {/* GRIFFE und ABSTANDSMARKER an der Auswahl — gleich, ob Baustein oder
          Container. Sie stehen NACH den Rahmen, damit sie darüber liegen. */}
      {auswahlRect && auswahlSettings ? (
        <Griffe
          rect={auswahlRect}
          settings={auswahlSettings}
          geraet={geraet}
          onMass={onMass}
        />
      ) : null}
      {containerRect && auswahlSettings ? (
        <AbstandsMarker
          rect={containerRect}
          kinder={kinderRects}
          settings={auswahlSettings}
          geraet={geraet}
          onAbstand={onAbstand}
          onPadding={onPadding}
        />
      ) : null}

      {menu ? (
        <Kontextmenue
          ort={menu}
          zeile={zeilen.find((z) => z.key === menu.key) ?? null}
          index={zeilen.findIndex((z) => z.key === menu.key)}
          gesamt={zeilen.length}
          onSchliesse={() => onMenu(null)}
          onInhalt={onInhalt}
          onDesign={onDesign}
          onDuplizieren={onDuplizieren}
          onVerschiebe={onVerschiebe}
          onEntferne={onEntferne}
          onVersteckt={onVersteckt}
        />
      ) : null}

      {/* Die NÄHTE. Auf jeder Grenze zwischen zwei Abschnitten sitzt mittig ein
          „+"; ein Klick öffnet den Katalog und fügt GENAU DORT ein.
          Der Weg über die schwebende Leiste („danach einfügen") gibt es
          weiterhin, aber er verlangt, den Abschnitt DAVOR zu treffen und sich
          zu merken, dass „danach" nach unten heißt. Auf der Naht zeigt der Ort
          des Knopfes, wo der neue Abschnitt landet.
          Gezeigt wird nur die Naht am überfahrenen oder ausgewählten
          Abschnitt — ein „+" an jeder Grenze wäre eine Perlenkette über der
          ganzen Seite. */}
      {[...nahtIndizes].map((i) => {
        const r = rechtecke.get(i);
        return (
          <Naht
            key={`naht-${i}`}
            rect={r}
            // Die Stelle kommt aus der UNTERKANTE des Rechtecks, nicht aus
            // seinem Index — siehe `editorStelle`.
            position={r ? editorStelle(r.top + r.height) : 0}
            onEinfuegen={onEinfuegenAn}
            onLayout={onLayoutEinfuegen}
          />
        );
      })}
      {/* Die Naht ÜBER dem ersten Abschnitt. Ohne sie gibt es keinen Weg, etwas
          vor die Startsektion zu setzen, ohne danach zu verschieben. */}
      {obenNaht && erstes ? (
        <Naht
          rect={erstes}
          position={0}
          oben
          onEinfuegen={onEinfuegenAn}
          onLayout={onLayoutEinfuegen}
        />
      ) : null}

      {/* Nichts ausgewählt und nichts gemeldet: ein Hinweis, dass die Fläche
          bedienbar IST. Ohne ihn sieht eine frisch geöffnete Seite aus wie eine
          reine Vorschau, und niemand probiert den Klick. */}
      {rechtecke.size === 0 || aktivRect || hoverRect || containerRect ? null : (
        <Anstupser />
      )}
    </div>
  );
}

/**
 * Der ausgewählte Baustein auf der Fläche — und zwar NUR das.
 *
 * WAS HIER AM 06.09.2026 VERSCHWUNDEN IST, UND WARUM
 * Hier standen ein Namensetikett („› Titelbild") und eine schwebende Leiste
 * mit sechs Knöpfen (Verschieben, Inhalt, Design, Einfügen, Duplizieren,
 * Ausblenden, Löschen). Das war aus Hostaway übernommen und hat die Fläche
 * beherrscht: die Leiste lag über der Kopfzeile der Kundenseite, das Etikett
 * über deren erstem Abschnitt, und beides bewegte sich bei jeder Auswahl.
 *
 * Framers Fläche ist RUHIG (heute live nachgesehen): eine Kante, die Griffe,
 * beim Ziehen ein Maß — mehr nicht. Jede Aktion hat dort ihren eigenen Ort,
 * und zwar denselben wie bei uns:
 *   · Inhalt bearbeiten → Doppelklick auf den Baustein (wie im Vorbild) oder
 *     „Inhalt" im Kontextmenü,
 *   · Design → das Panel rechts, das ohnehin offen ist,
 *   · Duplizieren · Löschen · Ausblenden · Verschieben → Rechtsklick und der
 *     Ebenen-Baum, beide mit denselben Kürzeln wie im Vorbild,
 *   · darunter einfügen → das „+" an der Naht.
 * Es geht also nichts verloren; es steht nur nicht mehr alles gleichzeitig
 * auf der Seite des Kunden.
 *
 * Geblieben ist der orange Hinweis „auf diesem Gerät ausgeblendet". Er ist
 * keine Zierde, sondern die einzige Stelle, an der ein Zustand sichtbar wird,
 * den man auf der Fläche sonst nicht sieht — und er trägt den Weg zurück.
 */
function AktiverRahmen({
  rect,
  zeile,
  geraet,
  onVersteckt,
}: {
  rect: Rechteck;
  zeile: FlaechenZeile;
  geraet: Geraet;
  onVersteckt: (key: string, geraete: Geraet[]) => void;
}) {
  const t = useTranslations("website");
  const versteckt = versteckteGeraete(zeile.settings);
  return (
    <>
      {/* Die Auswahl: 1 px DURCHGEZOGEN in Framers Akzent (#0099ff, aus dem
          DOM gelesen). Die Griffe stehen in `Griffe` — sie hängen an der
          Größe des Elements und ziehen wirklich. */}
      <div
        aria-hidden
        style={rahmenStil(rect)}
        className="pointer-events-none absolute outline outline-1 outline-[#0099ff]"
      />

      {versteckt.length > 0 ? (
        <span
          style={{
            top: `${Math.max(4, rect.top + 6)}px`,
            left: `${rect.left + 6}px`,
          }}
          className="absolute flex items-center gap-1 rounded-full bg-orange-500 px-2 py-0.5 text-[0.6875rem] font-semibold text-white shadow-sm"
        >
          {t("arbeitsflaeche.verstecktAuf", {
            geraete: versteckt.map((g) => t(`arbeitsflaeche.${g}`)).join(", "),
          })}
          {versteckt.includes(geraet) ? (
            <button
              type="button"
              aria-label={t("arbeitsflaeche.einblenden", {
                geraet: t(`arbeitsflaeche.${geraet}`),
              })}
              title={t("arbeitsflaeche.einblenden", {
                geraet: t(`arbeitsflaeche.${geraet}`),
              })}
              onClick={() =>
                onVersteckt(
                  zeile.key,
                  versteckt.filter((g) => g !== geraet),
                )
              }
              className="pointer-events-auto transition hover:text-orange-100"
            >
              <Icon icon="ph:eye-slash" className="size-3.5" />
            </button>
          ) : null}
        </span>
      ) : null}
    </>
  );
}

/** Der Hinweis „klick einen Abschnitt an", solange nichts gewählt und nichts
 *  überfahren ist.
 *
 *  Er braucht keinen eigenen Weg zum Verschwinden: sobald der Zeiger über einem
 *  Abschnitt steht, meldet die Brücke `hover`, und die Bedingung oben trägt ihn
 *  weg. Ein Hinweis, der sich per Klick wegräumen lässt, wäre ein zweiter
 *  Zustand für dieselbe Frage. */
function Anstupser() {
  const t = useTranslations("website");
  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-foreground/85 px-3 py-1 text-xs font-medium text-background">
      {t("arbeitsflaeche.anstupser")}
    </div>
  );
}

/** Eine Naht zwischen zwei Abschnitten mit dem „+" in der Mitte.
 *
 *  Der Klick öffnet ein kleines Menü: die LAYOUTS direkt (Abschnitt, zwei
 *  Spalten, ein Drittel · zwei Drittel …) und darunter den Weg zu den
 *  Bausteinen.
 *
 *  Vorher sprang er sofort in den Katalog, und zwar auf „Zuletzt". Ein Layout
 *  zu setzen hieß: „+" klicken, dann links in der Menüspalte „Layout" finden.
 *  Der Rahmen kommt aber VOR dem Inhalt — er gehört an die Stelle, an der man
 *  gerade steht, nicht zwei Klicks entfernt. Framer macht es genauso (Frame ·
 *  Stack · Grid · Masonry stehen im Einfügemenü selbst). */
function Naht({
  rect,
  position,
  oben = false,
  onEinfuegen,
  onLayout,
}: {
  rect: Rechteck | undefined;
  /** Einfügeposition in der Abschnittsliste. */
  position: number;
  /** true = die Naht sitzt an der OBERkante des Rechtecks. */
  oben?: boolean;
  onEinfuegen: (position: number) => void;
  /** Ein Layout an dieser Stelle einsetzen. Fehlt der Rückruf, zeigt das Menü
   *  nur den Weg zu den Bausteinen — kein Eintrag ohne Wirkung (Wurzel 4). */
  onLayout?: (bs: LayoutBaustein, position: number) => void;
}) {
  const t = useTranslations("website");
  const [offen, setOffen] = useState(false);
  // Schließen bei Escape und bei einem Klick daneben. Ohne das bliebe das Menü
  // über der Arbeitsfläche stehen, während man weiterklickt.
  useEffect(() => {
    if (!offen) return;
    function aufTaste(e: KeyboardEvent) {
      if (e.key === "Escape") setOffen(false);
    }
    window.addEventListener("keydown", aufTaste);
    return () => window.removeEventListener("keydown", aufTaste);
  }, [offen]);
  if (!rect) return null;
  const roh = oben ? rect.top : rect.top + rect.height;
  // Die Naht liegt MIT IHRER MITTE auf der Kante (`-translate-y-1/2`) — sonst
  // sähe sie aus, als gehörte sie zum Abschnitt darunter. Am oberen Rand ragt
  // dadurch aber die halbe Knopfhöhe über das Overlay hinaus, und dort liegt
  // die Kopfzeile des Editors: der Klick landete auf ihr statt auf dem Knopf.
  //
  // Gemessen (Nachprüfung D6): vom obersten „+" trafen nur 12 von 25
  // Pixelzeilen den Knopf, bei den übrigen Nähten 24 von 25. Das erklärt das
  // Bild „erster Klick nichts, zweiter Klick öffnet" — es war kein
  // Wackelkontakt, sondern eine Überlappung, und wer eine Spur tiefer traf,
  // hatte immer Erfolg.
  //
  // `HALB` ist die halbe Höhe des Knopfes (`size-6` = 24 px). Darunter wird
  // die Naht nicht mehr zentriert, sondern angeschlagen — dieselbe Lösung wie
  // bei der Werkzeugleiste (D2), aus demselben Grund.
  const HALB = 12;
  const y = Math.max(roh, HALB);
  return (
    <div
      style={{ top: `${y}px`, left: `${rect.left}px`, width: `${rect.width}px` }}
      className="pointer-events-none absolute flex -translate-y-1/2 items-center"
    >
      <span aria-hidden className="h-px flex-1 bg-blue-400/60" />
      <div className="pointer-events-auto relative mx-1">
        <button
          type="button"
          title={t("arbeitsflaeche.einfuegenHier")}
          aria-label={t("arbeitsflaeche.einfuegenHier")}
          aria-expanded={offen}
          onClick={() => {
            // Ohne Layout-Rückruf bleibt das alte Verhalten: direkt in den
            // Katalog. Ein Menü mit einem Eintrag ist kein Menü.
            if (!onLayout) {
              onEinfuegen(position);
              return;
            }
            setOffen((o) => !o);
          }}
          className={
            "flex size-6 items-center justify-center rounded-full border-2 border-blue-500 shadow-md transition " +
            (offen
              ? "bg-blue-500 text-white"
              : "bg-background text-blue-600 hover:bg-blue-500 hover:text-white")
          }
        >
          <Icon icon="ph:plus-bold" className="size-3.5" />
        </button>

        {offen && onLayout ? (
          <>
            {/* Die Fläche zum Wegklicken. Sie liegt UNTER dem Menü und über
                allem anderen — ohne sie müsste jeder Klick daneben erst durch
                das Overlay hindurch. */}
            <button
              type="button"
              aria-hidden
              tabIndex={-1}
              onClick={() => setOffen(false)}
              className="fixed inset-0 z-40 cursor-default"
            />
            {/* Mittig unter dem „+". `max-h` mit eigenem Bildlauf: an der
                unteren Naht einer langen Seite hätte das Menü sonst keinen
                Platz und würde abgeschnitten. */}
            <div className="absolute left-1/2 top-8 z-50 max-h-[60vh] w-64 -translate-x-1/2 overflow-y-auto rounded-(--radius) border border-border bg-background p-1.5 shadow-2xl">
              <p className="px-2 pb-1 pt-1 text-[0.625rem] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("editor.gruppe.layout")}
              </p>
              {LAYOUT_BAUSTEINE.map((bs) => (
                <button
                  key={bs.id}
                  type="button"
                  onClick={() => {
                    setOffen(false);
                    onLayout(bs, position);
                  }}
                  title={t(`layout.${bs.hinweis}`)}
                  className="flex w-full items-center gap-2.5 rounded-(--radius) px-2 py-2 text-left text-sm transition hover:bg-secondary"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-(--radius) bg-secondary">
                    <Icon icon={bs.icon} className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">
                      {t(`layout.${bs.label}`)}
                    </span>
                    {/* Die Teilung als Zahlenreihe — „6 · 6", „4 · 8". Sie
                        sagt in einem Blick, was das Layout tut, und zwar
                        genauer als ein Symbol in 28 Pixeln. */}
                    {bs.breiten ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {bs.breiten.join(" · ")}
                      </span>
                    ) : null}
                  </span>
                </button>
              ))}
              <div className="my-1 border-t border-border" />
              {/* Der Weg zu den Bausteinen — das, was der Knopf vorher SOFORT
                  tat. Er bleibt einen Klick entfernt und verschwindet nicht. */}
              <button
                type="button"
                onClick={() => {
                  setOffen(false);
                  onEinfuegen(position);
                }}
                className="flex w-full items-center gap-2.5 rounded-(--radius) px-2 py-2 text-left text-sm transition hover:bg-secondary"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-(--radius) bg-secondary">
                  <Icon icon="ph:squares-four" className="size-4" />
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {t("arbeitsflaeche.bausteinWaehlen")}
                </span>
              </button>
            </div>
          </>
        ) : null}
      </div>
      <span aria-hidden className="h-px flex-1 bg-blue-400/60" />
    </div>
  );
}

/**
 * Die Griffe der Auswahl — und zwar NUR die, die etwas bewirken.
 *
 * Am 06.09.2026 im Vorbild nachgemessen (Bild mit `Höhe 560 Fixed`, Abschnitt
 * mit `Breite 100 % Rel`): Framer zeigt Griffe genau an den Achsen, die im
 * Panel eine Zahl tragen. Steht die Höhe auf `Fit`, wird sie GEMESSEN — dann
 * gibt es keinen Höhengriff, weil Ziehen dort nichts zu setzen hätte. Beim
 * Abschnitt waren es deshalb zwei runde Griffe links und rechts, beim frisch
 * aufgezogenen Text (`Fixed`/`Fixed`) alle acht.
 *
 * Vorher standen hier immer acht QUADRATISCHE Griffe mit `pointer-events-none`
 * — eine Anzeige, die aussah wie ein Bedienelement. Genau das ist die Attrappe,
 * gegen die Wurzel 4 steht: ein Griff ist das Versprechen, dass Ziehen wirkt.
 *
 * Gezogen wird gegen die LIVE-Vorschau: `onMass(..., false)` schickt den Wert
 * sofort in den iframe (kein Speichern), `onMass(..., true)` beim Loslassen
 * schreibt ihn. Ein Ziehvorgang ist damit EIN Schritt im Verlauf — wie im
 * Vorbild, wo ⌘Z den ganzen Zug zurücknimmt.
 */
function Griffe({
  rect,
  settings,
  geraet,
  onMass,
}: {
  rect: Pick<Rechteck, "top" | "left" | "width" | "height">;
  settings: Record<string, unknown>;
  geraet: Geraet;
  onMass?: (achse: "breite" | "hoehe", px: number, fertig: boolean) => void;
}) {
  const t = useTranslations("website.stil.groesse");
  const [zug, setZug] = useState<{
    achse: "breite" | "hoehe";
    px: number;
  } | null>(null);

  const d = darstellungFuer(settings, geraet);
  /** Trägt diese Achse eine Zahl — oder wird sie gemessen? */
  const ziehbar = (achse: "breite" | "hoehe") => {
    const modus = (achse === "breite" ? d.groesse?.breite : d.groesse?.hoehe)?.modus;
    // `inhalt` (Framers „Fit") ist eine MESSUNG. Ohne gesetzten Modus gilt
    // dasselbe: der Baustein bringt seine eigene Höhe mit, und ein Griff
    // daran wäre eine Einstellung, die es noch gar nicht gibt — Ziehen legt
    // sie an, deshalb ist genau das erlaubt.
    return modus !== "inhalt";
  };

  // Ohne Rückruf gibt es nichts zu ziehen — dann auch keine Griffe. Eine
  // Region (Kopf-/Fußzeile) kommt so hierher.
  if (!onMass) return null;

  const punkte: ReadonlyArray<{
    x: number;
    y: number;
    achse: "breite" | "hoehe";
    richtung: 1 | -1;
    cursor: string;
  }> = [
    { x: 0, y: 0.5, achse: "breite", richtung: -1, cursor: "ew-resize" },
    { x: 1, y: 0.5, achse: "breite", richtung: 1, cursor: "ew-resize" },
    { x: 0.5, y: 0, achse: "hoehe", richtung: -1, cursor: "ns-resize" },
    { x: 0.5, y: 1, achse: "hoehe", richtung: 1, cursor: "ns-resize" },
  ];

  function zieheAn(
    e: React.PointerEvent,
    achse: "breite" | "hoehe",
    richtung: 1 | -1,
  ) {
    e.preventDefault();
    e.stopPropagation();
    const start = achse === "breite" ? e.clientX : e.clientY;
    const anfang = achse === "breite" ? rect.width : rect.height;
    const ziel = e.currentTarget as HTMLElement;
    ziel.setPointerCapture(e.pointerId);
    // Der Faktor der Kamera: die Fläche ist skaliert, ein Pixel auf dem
    // Bildschirm ist also nicht ein Pixel der Seite. Ohne ihn zöge man bei
    // 50 % Zoom doppelt so schnell wie man sieht.
    const flaeche = ziel.closest("[data-buehne]") as HTMLElement | null;
    const zoom = flaeche
      ? (flaeche.getBoundingClientRect().width || 1) / (flaeche.offsetWidth || 1)
      : 1;
    const bewege = (ev: PointerEvent) => {
      const jetzt = achse === "breite" ? ev.clientX : ev.clientY;
      const px = Math.max(
        8,
        Math.round(anfang + ((jetzt - start) * richtung) / (zoom || 1)),
      );
      setZug({ achse, px });
      onMass?.(achse, px, false);
    };
    const los = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", bewege);
      window.removeEventListener("pointerup", los);
      const jetzt = achse === "breite" ? ev.clientX : ev.clientY;
      const px = Math.max(
        8,
        Math.round(anfang + ((jetzt - start) * richtung) / (zoom || 1)),
      );
      setZug(null);
      onMass?.(achse, px, true);
    };
    window.addEventListener("pointermove", bewege);
    window.addEventListener("pointerup", los);
  }

  return (
    <>
      {punkte
        .filter((p) => ziehbar(p.achse))
        .map((p) => (
          <button
            key={`${p.x}-${p.y}`}
            type="button"
            aria-label={t(p.achse)}
            title={t(p.achse)}
            onPointerDown={(e) => zieheAn(e, p.achse, p.richtung)}
            style={{
              left: `${rect.left + rect.width * p.x}px`,
              top: `${rect.top + rect.height * p.y}px`,
              cursor: p.cursor,
            }}
            className="pointer-events-auto absolute size-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-[#0099ff] shadow-sm"
          />
        ))}
      {/* Das Maß, solange gezogen wird — im Vorbild steht es an der Kante und
          sagt, was gerade entsteht. Ohne es zieht man auf gut Glück und liest
          die Zahl erst hinterher im Panel. */}
      {zug ? (
        <span
          style={{
            left: `${rect.left + rect.width / 2}px`,
            top: `${rect.top + rect.height + 8}px`,
          }}
          className="pointer-events-none absolute -translate-x-1/2 rounded-full bg-[#0099ff] px-2 py-0.5 text-[0.6875rem] font-semibold text-white shadow"
        >
          {zug.px} px
        </span>
      ) : null}
    </>
  );
}

/**
 * Die ABSTANDSMARKER: Lücken zwischen den Kindern und die Innenabstände.
 *
 * Am 06.09.2026 bei Framer nachgemessen (Navigation mit `Padding 24/32`, bei
 * 119 % herangezoomt): es sind KURZE Striche in der Akzentfarbe `#0099ff` —
 * einer mittig in jeder Lücke, einer an jeder Innenkante. Kein durchgehender
 * Balken, keine Füllung, kein Magenta (das hatte ich aus den kleinen
 * Bildschirmfotos falsch gelesen; der Zoom zeigt Blau).
 *
 * Sie sind mehr als Zierde: Abstand und Innenabstand sind die einzigen Maße,
 * die man auf der Fläche NICHT sieht, solange sie stimmen — und deshalb die,
 * die man im Panel sucht. Ziehen an einem Strich ändert genau die Zeile, die
 * dort steht.
 */
function AbstandsMarker({
  rect,
  kinder,
  settings,
  geraet,
  onAbstand,
  onPadding,
}: {
  /** Der Container selbst — für die Innenabstände. */
  rect: Pick<Rechteck, "top" | "left" | "width" | "height">;
  kinder: readonly Pick<Rechteck, "top" | "left" | "width" | "height">[];
  settings: Record<string, unknown>;
  geraet: Geraet;
  onAbstand?: (px: number, fertig: boolean) => void;
  onPadding?: (seite: "top" | "right" | "bottom" | "left", px: number, fertig: boolean) => void;
}) {
  const t = useTranslations("website.container");
  const d = darstellungFuer(settings, geraet);
  const abstand = d.layout_abstand;
  const reihe = d.layout_richtung === "zeile";

  /** Ein Strich, an dem man ziehen kann. `achse` sagt, welche Zeigerachse
   *  zählt; `richtung` dreht sie um (rechts/unten wachsen nach innen). */
  function Strich({
    stil,
    achse,
    richtung,
    start,
    grenze,
    titel,
    onWert,
  }: {
    stil: React.CSSProperties;
    achse: "x" | "y";
    richtung: 1 | -1;
    start: number;
    grenze: number;
    titel: string;
    onWert?: (px: number, fertig: boolean) => void;
  }) {
    if (!onWert) return null;
    function zieheAn(e: React.PointerEvent) {
      e.preventDefault();
      e.stopPropagation();
      const anfang = achse === "x" ? e.clientX : e.clientY;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      const wert = (ev: PointerEvent) =>
        Math.min(
          grenze,
          Math.max(
            0,
            Math.round(start + ((achse === "x" ? ev.clientX : ev.clientY) - anfang) * richtung),
          ),
        );
      const bewege = (ev: PointerEvent) => onWert?.(wert(ev), false);
      const los = (ev: PointerEvent) => {
        window.removeEventListener("pointermove", bewege);
        window.removeEventListener("pointerup", los);
        onWert?.(wert(ev), true);
      };
      window.addEventListener("pointermove", bewege);
      window.addEventListener("pointerup", los);
    }
    return (
      <button
        type="button"
        aria-label={titel}
        title={titel}
        onPointerDown={zieheAn}
        style={{ ...stil, cursor: achse === "x" ? "ew-resize" : "ns-resize" }}
        className="pointer-events-auto absolute rounded-full bg-[#0099ff]"
      />
    );
  }

  /** Zahl aus einem Maß wie `104px` — ohne Einheit gibt es nichts zu ziehen. */
  function px(wert: string | null | undefined): number | null {
    if (!wert) return null;
    const m = /^(\d{1,4})px$/.exec(wert);
    return m ? Number(m[1]) : null;
  }

  const sortiert = [...kinder].sort((a, b) =>
    reihe ? a.left - b.left : a.top - b.top,
  );

  return (
    <>
      {/* LÜCKEN zwischen den Kindern (Framer „Gap"). */}
      {abstand != null && sortiert.length >= 2
        ? sortiert.slice(0, -1).map((k, i) => {
            const naechstes = sortiert[i + 1]!;
            const mitte = reihe
              ? {
                  left: `${(k.left + k.width + naechstes.left) / 2}px`,
                  top: `${k.top + k.height / 2}px`,
                  width: "2px",
                  height: "14px",
                }
              : {
                  left: `${k.left + k.width / 2}px`,
                  top: `${(k.top + k.height + naechstes.top) / 2}px`,
                  width: "14px",
                  height: "2px",
                };
            return (
              <Strich
                key={`gap-${i}`}
                stil={{ ...mitte, transform: "translate(-50%,-50%)" }}
                achse={reihe ? "x" : "y"}
                richtung={1}
                start={abstand}
                grenze={160}
                titel={`${t("abstand")} ${abstand} px`}
                onWert={onAbstand}
              />
            );
          })
        : null}

      {/* INNENABSTÄNDE an den vier Kanten (Framer „Padding"). Gezeigt wird nur,
          was gesetzt ist: ein Strich an einer Kante ohne Wert wäre ein Griff
          für eine Zeile, die es nicht gibt (Wurzel 4). */}
      {(
        [
          ["top", px(d.padding_top), "y", 1] as const,
          ["bottom", px(d.padding_bottom), "y", -1] as const,
          ["left", px(d.padding_left), "x", 1] as const,
          ["right", px(d.padding_right), "x", -1] as const,
        ] satisfies ReadonlyArray<
          readonly ["top" | "bottom" | "left" | "right", number | null, "x" | "y", 1 | -1]
        >
      ).map(([seite, wert, achse, richtung]) => {
        if (wert == null) return null;
        const quer = achse === "y"
          ? { left: `${rect.left + rect.width / 2}px`, width: "14px", height: "2px" }
          : { top: `${rect.top + rect.height / 2}px`, width: "2px", height: "14px" };
        const laengs =
          seite === "top"
            ? { top: `${rect.top + wert}px` }
            : seite === "bottom"
              ? { top: `${rect.top + rect.height - wert}px` }
              : seite === "left"
                ? { left: `${rect.left + wert}px` }
                : { left: `${rect.left + rect.width - wert}px` };
        return (
          <Strich
            key={`pad-${seite}`}
            stil={{ ...quer, ...laengs, transform: "translate(-50%,-50%)" }}
            achse={achse}
            richtung={richtung}
            start={wert}
            grenze={400}
            titel={`${t("innen")} ${seite} ${wert} px`}
            onWert={
              onPadding ? (v, fertig) => onPadding(seite, v, fertig) : undefined
            }
          />
        );
      })}
    </>
  );
}

/** Absolute Position eines Rahmens aus einem gemeldeten Rechteck. */
function rahmenStil(r: Pick<Rechteck, "top" | "left" | "width" | "height">) {
  return {
    top: `${r.top}px`,
    left: `${r.left}px`,
    width: `${r.width}px`,
    height: `${r.height}px`,
  };
}
