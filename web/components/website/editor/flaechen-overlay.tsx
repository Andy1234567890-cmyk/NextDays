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
  istDynamisch,
  LAYOUT_BAUSTEINE,
  type LayoutBaustein,
} from "../abschnitte";
import type { Geraet } from "../vorschau";
import {
  AusblendenKnopf,
  type FlaechenZeile,
  Kontextmenue,
  type MenuOrt,
  MenuKnopf,
  MenuZeile,
  SymbolKnopf,
  TextKnopf,
  useName,
} from "./flaechen-teile";
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
  onEinfuegenNach,
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
  onEinfuegenNach: (key: string) => void;
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
  const [ausblendenOffen, setAusblendenOffen] = useState(false);

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

  // Escape schließt das Kontextmenü. Der Klick daneben und das Scrollen sind
  // drüben abgedeckt: ein Klick ins iframe meldet `select`, ein Scrollen neue
  // Rechtecke — beides räumt das Menü im Aufrufer ab.
  useEffect(() => {
    function aufTaste(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      // Erst das Menü, dann die Auswahl. Zwei Ebenen, zwei Druck auf Escape —
      // beides auf einmal zu schließen nimmt den Weg zurück, wenn man das Menü
      // nur versehentlich geöffnet hat.
      if (menu) onMenu(null);
      else onWaehle(null);
    }
    window.addEventListener("keydown", aufTaste);
    return () => window.removeEventListener("keydown", aufTaste);
  }, [menu, onMenu, onWaehle]);

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
      {/* Rahmen unter dem Zeiger — ORANGE und durchgezogen.
          Im Vorbild sind Überfahren und Auswahl zwei verschiedene FARBEN, nicht
          zwei Stärken derselben: orange heißt „das würdest du treffen", blau
          heißt „das hast du". Vorher waren beide blau und unterschieden sich
          nur durch gestrichelt/durchgezogen — beim Überfahren einer Liste sieht
          das aus wie ein Flackern desselben Zustands. */}
      {hoverRect ? (
        <div
          aria-hidden
          style={rahmenStil(hoverRect)}
          className="absolute border-2 border-orange-500 bg-orange-500/5"
        />
      ) : null}

      {aktivRect && aktivIndex >= 0 ? (
        <AktiverRahmen
          rect={aktivRect}
          zeile={zeilen[aktivIndex]!}
          index={aktivIndex}
          gesamt={zeilen.length}
          geraet={geraet}
          ausblendenOffen={ausblendenOffen}
          onAusblendenOffen={setAusblendenOffen}
          onInhalt={onInhalt}
          onDesign={onDesign}
          onDuplizieren={onDuplizieren}
          onEinfuegenNach={onEinfuegenNach}
          onVerschiebe={onVerschiebe}
          onEntferne={onEntferne}
          onVersteckt={onVersteckt}
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
      {rechtecke.size === 0 || aktivRect || hoverRect ? null : <Anstupser />}
    </div>
  );
}

/** Der ausgewählte Abschnitt: Rahmen, Etikett und die schwebende Leiste. */
function AktiverRahmen({
  rect,
  zeile,
  index,
  gesamt,
  geraet,
  ausblendenOffen,
  onAusblendenOffen,
  onInhalt,
  onDesign,
  onDuplizieren,
  onEinfuegenNach,
  onVerschiebe,
  onEntferne,
  onVersteckt,
}: {
  rect: Rechteck;
  zeile: FlaechenZeile;
  index: number;
  gesamt: number;
  geraet: Geraet;
  ausblendenOffen: boolean;
  onAusblendenOffen: (offen: boolean) => void;
  onInhalt: (key: string) => void;
  onDesign: (key: string) => void;
  onDuplizieren: (key: string) => void;
  onEinfuegenNach: (key: string) => void;
  onVerschiebe: (key: string, richtung: -1 | 1) => void;
  onEntferne: (key: string) => void;
  onVersteckt: (key: string, geraete: Geraet[]) => void;
}) {
  const t = useTranslations("website");
  const name = useName();
  const [verschiebenOffen, setVerschiebenOffen] = useState(false);
  const versteckt = versteckteGeraete(zeile.settings);
  // Zieht dieser Baustein seinen Inhalt aus den DATEN? Dann trägt seine Pille
  // Violett statt Blau — im Vorbild derselbe Unterschied (`docs/UI`, Foto
  // 19.05.26: die Pille am Suchformular ist violett).
  const dynamisch = istDynamisch(zeile.typ);

  // Die Leiste sitzt normalerweise ÜBER der Oberkante. Steht der Abschnitt am
  // oberen Rand des sichtbaren Bereichs, wäre sie dort abgeschnitten.
  //
  // Sie rutschte dann NACH INNEN — und lag damit über der Kopfzeile der
  // Website: „Kontakt" und „Jetzt buchen" waren verdeckt, reproduzierbar bei
  // jedem Abschnitt am oberen Rand (Prüfbericht D2). Genau der erste
  // Abschnitt ist aber der häufigste Fall.
  //
  // Sie rutscht jetzt UNTER die Kopfzeile der Vorschau statt über sie: 44 px
  // ist deren Höhe im Overlay-Maßstab, und darunter beginnt der Abschnitt
  // selbst. Ein Abschnitt, der höher ist als das Sichtfeld (Hero), behält die
  // Leiste damit im Bild — sie an seine UNTERKANTE zu setzen hätte sie bei
  // einem hohen Abschnitt aus dem Fenster geschoben.
  const obenEng = rect.top < 44;
  const leisteOben = obenEng ? 52 : rect.top - 38;
  // Schmaler als die Leiste breit ist. Die Zahl ist die gemessene Breite der
  // Leiste in der schmalsten Sprache; darunter wird links angeschlagen.
  const schmal = rect.width < 420;

  return (
    <>
      {/* Die Auswahl: GESTRICHELTER blauer Rahmen mit ACHT quadratischen
          Griffen — vier Ecken, vier Kantenmitten. Genau so im Vorbild
          (`docs/UI`, Foto 19.05.26).
          Die Griffe zeigen an, dass hier etwas AUSGEWÄHLT ist; sie sind
          bewusst nicht anziehbar: unsere Seite ist eine Abfolge von
          Abschnitten, deren Breite dem Theme gehört. Ein Griff, an dem man
          ziehen kann und der nichts bewirkt, wäre schlechter als keiner —
          deshalb `pointer-events-none`. */}
      <div
        aria-hidden
        style={rahmenStil(rect)}
        className="absolute border-2 border-dashed border-blue-500 bg-blue-500/5"
      />
      <Griffe rect={rect} />

      {/* Etikett mit dem Namen des Abschnitts, an der Oberkante links. Es sagt,
          WAS man gerade anfasst — ohne es ist ein blauer Rahmen um ein Bild
          nicht von einem um den ganzen Abschnitt zu unterscheiden. */}
      <span
        style={{
          top: `${obenEng ? rect.top + 8 : rect.top - 24}px`,
          left: `${rect.left}px`,
        }}
        className={
          "absolute flex items-center gap-0.5 rounded-t-sm px-2 py-1 text-xs font-semibold shadow-sm " +
          // ZWEI Farben, wie im Vorbild: ein gewöhnlicher Baustein trägt eine
          // helle BLAUE Pille, ein dynamischer eine VIOLETTE. Der Unterschied
          // ist keine Zierde — bei einem dynamischen Baustein (Objektliste,
          // Buchungsstrecke) kommt der Inhalt aus den Daten, und wer dort eine
          // Überschrift sucht, sucht sie vergeblich. Die Farbe sagt das, bevor
          // man klickt.
          (dynamisch
            ? "bg-violet-500 text-white"
            : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-200")
        }
      >
        <Icon icon="ph:caret-right" className="size-3" />
        {name(zeile.typ)}
      </span>

      {/* Der orange Hinweis sagt, WO der Abschnitt fehlt. Ist er auf dem gerade
          gezeigten Gerät versteckt, trägt er zusätzlich den Weg zurück — als
          echten Knopf, deshalb `pointer-events-auto`. Einblenden wirkt NUR für
          diesen Breakpoint (Hostaway macht es genauso): sonst holt der Klick
          etwas zurück, das der Kunde gerade gar nicht sieht. */}
      {versteckt.length > 0 ? (
        <span
          style={{
            top: `${leisteOben}px`,
            left: `${rect.left + 8}px`,
          }}
          className="absolute flex translate-y-8 items-center gap-1 rounded-full bg-orange-500 px-2 py-1 text-xs font-semibold text-white shadow-sm"
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

      {/* Die schwebende Leiste. `pointer-events-auto` hebt die Durchlässigkeit
          der Schicht für genau dieses Element auf — sie ist das einzige, das
          Klicks annehmen soll. */}
      {/* Die Leiste hängt mit ihrer RECHTEN Kante an der rechten Kante des
          Abschnitts — über `translateX(-100%)`, nicht über eine geschätzte
          Breite. Vorher stand hier `rect.left + rect.width - 320`, und 320 war
          geraten: die Leiste ist breiter, also ragte sie rechts aus dem Bild
          und der Löschen-Knopf lag halb im Abgeschnittenen.
          Bei einem schmalen Abschnitt (Mobilansicht) ist die Leiste breiter als
          er selbst — dann links anschlagen statt rechts, sonst rutscht sie über
          die linke Kante hinaus. */}
      <div
        style={{
          top: `${leisteOben}px`,
          left: `${schmal ? rect.left : rect.left + rect.width}px`,
        }}
        className={
          "pointer-events-auto absolute flex items-center gap-0.5 rounded-full border-2 border-blue-500 bg-background px-1 py-0.5 shadow-lg " +
          (schmal ? "" : "-translate-x-full")
        }
      >
        <MenuKnopf
          icon="ph:dots-three-vertical"
          label={t("arbeitsflaeche.verschieben")}
          offen={verschiebenOffen}
          onOffen={setVerschiebenOffen}
        >
          <MenuZeile
            label={t("editor.nachOben")}
            icon="ph:arrow-up"
            deaktiviert={index === 0}
            onKlick={() => {
              setVerschiebenOffen(false);
              onVerschiebe(zeile.key, -1);
            }}
          />
          <MenuZeile
            label={t("editor.nachUnten")}
            icon="ph:arrow-down"
            deaktiviert={index === gesamt - 1}
            onKlick={() => {
              setVerschiebenOffen(false);
              onVerschiebe(zeile.key, 1);
            }}
          />
        </MenuKnopf>

        <TextKnopf
          label={t("arbeitsflaeche.inhaltBearbeiten", {
            abschnitt: name(zeile.typ),
          })}
          onKlick={() => onInhalt(zeile.key)}
        />
        <TextKnopf
          label={t("arbeitsflaeche.designBearbeiten")}
          onKlick={() => onDesign(zeile.key)}
        />

        <span aria-hidden className="mx-0.5 h-4 w-px bg-border" />

        <SymbolKnopf
          icon="ph:plus"
          label={t("arbeitsflaeche.einfuegenDanach")}
          onKlick={() => onEinfuegenNach(zeile.key)}
        />
        <SymbolKnopf
          icon="ph:copy"
          label={t("editor.duplizieren")}
          onKlick={() => onDuplizieren(zeile.key)}
        />
        <AusblendenKnopf
          versteckt={versteckt}
          offen={ausblendenOffen}
          onOffen={onAusblendenOffen}
          onVersteckt={(g) => onVersteckt(zeile.key, g)}
        />
        <SymbolKnopf
          icon="ph:trash"
          label={t("editor.entfernen")}
          gefahr
          onKlick={() => onEntferne(zeile.key)}
        />
      </div>
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
 * Die ACHT Griffe der Auswahl — vier Ecken, vier Kantenmitten.
 *
 * Sie sagen „das hier ist ausgewählt", und zwar in derselben Sprache, die jedes
 * Gestaltungswerkzeug spricht. Ziehen kann man daran NICHT: unsere Seite ist
 * eine Abfolge von Abschnitten, deren Breite dem Theme gehört, und ein Griff,
 * an dem man zieht und der nichts bewirkt, wäre schlechter als keiner
 * (Wurzel 4). Deshalb `pointer-events-none` und `aria-hidden` — sie sind eine
 * Anzeige, kein Bedienelement.
 *
 * Sie sitzen AUF der Rahmenkante, nicht daneben: `-translate-*-1/2` zieht jeden
 * Griff um seine halbe Kantenlänge zurück, sodass die Kante durch seine Mitte
 * läuft. Ohne das lägen sie alle innen und die untere Reihe verdeckte den
 * Inhalt.
 */
function Griffe({ rect }: { rect: Rechteck }) {
  // Position je Griff als Anteil der Kante: 0 = Anfang, 0.5 = Mitte, 1 = Ende.
  const punkte: ReadonlyArray<[number, number]> = [
    [0, 0],
    [0.5, 0],
    [1, 0],
    [0, 0.5],
    [1, 0.5],
    [0, 1],
    [0.5, 1],
    [1, 1],
  ];
  return (
    <>
      {punkte.map(([x, y]) => (
        <span
          key={`${x}-${y}`}
          aria-hidden
          style={{
            left: `${rect.left + rect.width * x}px`,
            top: `${rect.top + rect.height * y}px`,
          }}
          className="pointer-events-none absolute size-2 -translate-x-1/2 -translate-y-1/2 border border-blue-600 bg-background"
        />
      ))}
    </>
  );
}

/** Absolute Position eines Rahmens aus einem gemeldeten Rechteck. */
function rahmenStil(r: Rechteck) {
  return {
    top: `${r.top}px`,
    left: `${r.left}px`,
    width: `${r.width}px`,
    height: `${r.height}px`,
  };
}
