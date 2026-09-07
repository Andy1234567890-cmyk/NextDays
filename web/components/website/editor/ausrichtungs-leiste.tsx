"use client";

// Die AUSRICHTUNGSLEISTE — die erste Zeile jeder Style-Sidebar.
//
// Live abgelesen an Framer (Pearl-Template, 28.08.2026; Kürzel 05.09.2026,
// `docs/FRAMER-KUERZEL-VOLLSTAENDIG.md`): ganz oben im Style-Panel, über allen
// Karten, steht eine Reihe aus acht Symbolen ohne Beschriftung, in drei
// Gruppen — dazu bei uns der Füllen-Knopf an Spalten:
//
//     |◧  ◫  ◨ │ ⎺⎽  ⎼  ⎽⎺ │ ⇹  ⇳ │ |◫|
//     ├ waagerecht ┤├ senkrecht ┤├verteilen┤├füllen┤
//      ⌥A ⌥H ⌥D    ⌥W ⌥V ⌥S    ^⌥H ^⌥V
//
// WARUM SIE OBEN STEHT UND NICHT IN DER LAYOUT-KARTE
// ==================================================
// Ausrichten ist der Handgriff, den man beim Bauen am häufigsten braucht —
// häufiger als Richtung, Umbruch oder Abstand, die man einmal setzt und dann
// stehen lässt. Framer stellt ihn deshalb vor die Karten und ohne
// Beschriftungen: acht Symbole in einer Zeile sind schneller getroffen als
// zwei aufgeklappte Karten mit je vier Möglichkeiten.
//
// Die Karte `Layout` behält dieselben Werte als beschriftete Zeilen. Das ist
// keine Doppelung, sondern derselbe Zustand an zwei Griffweiten: hier für den
// schnellen Zugriff, dort zum Nachlesen, WAS gerade eingestellt ist.
//
// WAS DIE ACHSEN BEDEUTEN (und warum das nicht trivial ist)
// =========================================================
// Flexbox kennt keine „links" und „oben" — es kennt Haupt- und Querachse, und
// welche davon waagerecht liegt, entscheidet `flex-direction`. Ein Knopf
// „linksbündig" schreibt deshalb:
//
//   · bei Richtung ZEILE   → `justify-content: flex-start`  (Hauptachse)
//   · bei Richtung SPALTE  → `align-items: flex-start`      (Querachse)
//
// Wer das verwechselt, baut eine Leiste, die in der einen Richtung das
// Richtige tut und in der anderen etwas völlig anderes — und niemand versteht,
// warum. Deshalb rechnet `achsenFeld` es an EINER Stelle aus, statt es an acht
// Knöpfen zu wiederholen (Wurzel 2).
//
// VERTEILEN (die dritte Gruppe, 05.09.2026) schreibt ZWEI Felder auf einmal:
// `space-between` wirkt nur auf der Hauptachse, also muss die Richtung
// mitgesetzt werden. Deshalb nimmt `onSetzen` mehrere Felder in EINEM Aufruf
// — zwei Aufrufe wären zwei Requests und ein Zwischenzustand, in dem die
// Verteilung auf der falschen Achse steht.
//
// Ohne gesetzte Richtung gilt SPALTE: das ist das Verhalten, das ein Abschnitt
// seit jeher hat (Kinder untereinander), und ein anderer Standard würde jede
// bestehende Kundenseite umbauen (Wurzel 1).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { type ComponentType, useEffect } from "react";

import {
  AlignBottom,
  AlignCenter,
  AlignLeft,
  AlignMiddle,
  AlignRight,
  AlignTop,
  DistributeHorizontal,
  DistributeVertical,
} from "./ausrichtungs-symbole";

/** Die Felder, die diese Leiste schreibt. */
export type AusrichtungsFeld =
  | "layout_verteilen"
  | "layout_ausrichten"
  | "layout_richtung";

/** Mehrere Felder auf einmal; `null` LÖSCHT ein Feld. */
export type AusrichtungsAenderung = Partial<Record<AusrichtungsFeld, string | null>>;

/** Die zwei Felder, zwischen denen die Achsen-Rechnung wählt. */
type AchsenFeld = Exclude<AusrichtungsFeld, "layout_richtung">;

/** Welches Feld eine WAAGERECHTE Ausrichtung bei dieser Richtung schreibt.
 *
 *  Die senkrechte schreibt jeweils das andere — deshalb gibt es nur diese
 *  eine Funktion und keine zweite daneben, die man vergessen kann. */
function achsenFeld(richtung: unknown): {
  waagerecht: AchsenFeld;
  senkrecht: AchsenFeld;
} {
  return richtung === "zeile"
    ? { waagerecht: "layout_verteilen", senkrecht: "layout_ausrichten" }
    : { waagerecht: "layout_ausrichten", senkrecht: "layout_verteilen" };
}

/** Was in dem Feld stehen muss, damit es „Anfang/Mitte/Ende" bedeutet.
 *
 *  `layout_verteilen` und `layout_ausrichten` teilen sich drei Werte
 *  (`start`/`mitte`/`ende`) — nur „strecken" und „zwischen" gehören je einem
 *  allein. Die Leiste kommt deshalb mit den drei gemeinsamen aus. */
const STUFEN = ["start", "mitte", "ende"] as const;
type Stufe = (typeof STUFEN)[number];

type Symbol = ComponentType<{ className?: string }>;

// Framers eigene Pfade (`ausrichtungs-symbole.tsx`), nicht Phosphor.
const WAAGERECHT_ICON: Record<Stufe, Symbol> = {
  start: AlignLeft,
  mitte: AlignCenter,
  ende: AlignRight,
};

const SENKRECHT_ICON: Record<Stufe, Symbol> = {
  start: AlignTop,
  mitte: AlignMiddle,
  ende: AlignBottom,
};

/** Framers Kürzel, wie sie im Tooltip stehen (⌥ = Alt/Option). */
const KUERZEL: Record<"waagerecht" | "senkrecht", Record<Stufe, string>> = {
  waagerecht: { start: "⌥A", mitte: "⌥H", ende: "⌥D" },
  senkrecht: { start: "⌥W", mitte: "⌥V", ende: "⌥S" },
};

/** Tastencode → Knopf. `e.code` statt `e.key`: mit ⌥ liefert die Mac-Tastatur
 *  Sonderzeichen („å" für ⌥A), der Code bleibt `KeyA`. */
const TASTEN: Record<string, { achse: "waagerecht" | "senkrecht"; stufe: Stufe }> = {
  KeyA: { achse: "waagerecht", stufe: "start" },
  KeyH: { achse: "waagerecht", stufe: "mitte" },
  KeyD: { achse: "waagerecht", stufe: "ende" },
  KeyW: { achse: "senkrecht", stufe: "start" },
  KeyV: { achse: "senkrecht", stufe: "mitte" },
  KeyS: { achse: "senkrecht", stufe: "ende" },
};

function inEingabe(ziel: EventTarget | null): boolean {
  if (!(ziel instanceof HTMLElement)) return false;
  return (
    ziel.tagName === "INPUT" ||
    ziel.tagName === "TEXTAREA" ||
    ziel.tagName === "SELECT" ||
    ziel.isContentEditable
  );
}

export function AusrichtungsLeiste({
  settings,
  span = null,
  laeuft = false,
  onSetzen,
  onBreiteFuellen,
}: {
  /** Die WIRKSAMEN Einstellungen des Containers auf dem Gerät der Vorschau. */
  settings: Record<string, unknown>;
  /** Breitenanteil in Zwölfteln — nur an Spalten. `12` heißt „füllt". */
  span?: number | null;
  laeuft?: boolean;
  /** Mehrere Felder auf einmal; `null` LÖSCHT die Einstellung — der Rückweg
   *  zu „automatisch". Ohne ihn säße der Kunde auf einer Ausrichtung fest,
   *  die er nur ausprobieren wollte (Wurzel 1). */
  onSetzen: (aenderung: AusrichtungsAenderung) => void;
  /** Fehlt der Rückruf, gibt es den Füllen-Knopf nicht — an einem Abschnitt
   *  hätte er nichts zu schreiben. */
  onBreiteFuellen?: () => void;
}) {
  const t = useTranslations("website.container");
  const richtung = settings.layout_richtung;
  const { waagerecht, senkrecht } = achsenFeld(richtung);

  function stufeSetzen(achse: "waagerecht" | "senkrecht", stufe: Stufe) {
    const feld = achse === "waagerecht" ? waagerecht : senkrecht;
    onSetzen({ [feld]: settings[feld] === stufe ? null : stufe });
  }

  /** Verteilen entlang einer Achse = diese Achse wird Hauptachse UND bekommt
   *  `zwischen`. Ein zweiter Klick nimmt nur die Verteilung zurück, die
   *  Richtung bleibt — sie war die sichtbare Änderung, die der Kunde
   *  vielleicht behalten will. */
  function verteilen(achse: "waagerecht" | "senkrecht") {
    const zielRichtung = achse === "waagerecht" ? "zeile" : "spalte";
    const aktiv =
      (richtung ?? "spalte") === zielRichtung && settings.layout_verteilen === "zwischen";
    onSetzen(
      aktiv
        ? { layout_verteilen: null }
        : { layout_richtung: zielRichtung, layout_verteilen: "zwischen" },
    );
  }

  // Die Kürzel gelten, solange die Leiste steht — also solange ein Container
  // gewählt ist. In Eingabefeldern nicht: dort tippt der Kunde.
  useEffect(() => {
    function drauf(e: KeyboardEvent) {
      if (!e.altKey || e.metaKey || e.shiftKey || laeuft) return;
      if (inEingabe(e.target)) return;
      if (e.ctrlKey) {
        if (e.code === "KeyH") verteilen("waagerecht");
        else if (e.code === "KeyV") verteilen("senkrecht");
        else return;
        e.preventDefault();
        return;
      }
      const taste = TASTEN[e.code];
      if (!taste) return;
      e.preventDefault();
      stufeSetzen(taste.achse, taste.stufe);
    }
    document.addEventListener("keydown", drauf);
    return () => document.removeEventListener("keydown", drauf);
    // `settings` ändert sich mit jedem Klick; der Handler liest es frisch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, laeuft, onSetzen]);

  function knopf(
    achse: "waagerecht" | "senkrecht",
    stufe: Stufe,
    Symbol: Symbol,
  ) {
    const feld = achse === "waagerecht" ? waagerecht : senkrecht;
    const aktiv = settings[feld] === stufe;
    const titel = `${t(achse)} · ${t(stufe === "start" ? "anfang" : stufe === "mitte" ? "mitte" : "ende")} (${KUERZEL[achse][stufe]})`;
    return (
      <button
        key={`${achse}:${stufe}`}
        type="button"
        disabled={laeuft}
        aria-pressed={aktiv}
        aria-label={titel}
        title={titel}
        aria-keyshortcuts={`Alt+${KUERZEL[achse][stufe].slice(1)}`}
        onClick={() => stufeSetzen(achse, stufe)}
        className={
          "flex size-7 items-center justify-center rounded-(--radius) transition disabled:opacity-40 " +
          (aktiv
            ? "bg-secondary text-foreground"
            : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground")
        }
      >
        <Symbol className="size-4" />
      </button>
    );
  }

  function verteilenKnopf(achse: "waagerecht" | "senkrecht") {
    const zielRichtung = achse === "waagerecht" ? "zeile" : "spalte";
    const aktiv =
      (richtung ?? "spalte") === zielRichtung && settings.layout_verteilen === "zwischen";
    const kuerzel = achse === "waagerecht" ? "^⌥H" : "^⌥V";
    const titel = `${t(achse === "waagerecht" ? "verteilenWaagerecht" : "verteilenSenkrecht")} (${kuerzel})`;
    return (
      <button
        type="button"
        disabled={laeuft}
        aria-pressed={aktiv}
        aria-label={titel}
        title={titel}
        aria-keyshortcuts={`Control+Alt+${kuerzel.slice(2)}`}
        onClick={() => verteilen(achse)}
        className={
          "flex size-7 items-center justify-center rounded-(--radius) transition disabled:opacity-40 " +
          (aktiv
            ? "bg-secondary text-foreground"
            : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground")
        }
      >
        {achse === "waagerecht" ? (
          <DistributeHorizontal className="size-4" />
        ) : (
          <DistributeVertical className="size-4" />
        )}
      </button>
    );
  }

  /** BREITE FÜLLEN — Framers vierte Gruppe.
   *
   *  Empirisch geklärt am 28.08.2026: ein Klick auf das Symbol setzte im
   *  Style-Panel `Breite: 1fr · Fill`. Es ist also FÜLLEN, nicht Verteilen.
   *
   *  Framer hat davon zwei Knöpfe (Breite und Höhe). Hier steht nur EINER:
   *  unser Baum kennt für die Breite einer Spalte die Zwölftel (`span`), und
   *  `span = 12` IST „füllt die Reihe". Die Höhe steht seit Etappe 3 in der
   *  Karte „Größe" (Modus „Füllen"), nicht hier — ein zweiter Knopf, der
   *  dasselbe schreibt wie eine Zeile eine Karte tiefer, wäre die Doppelung
   *  ohne zweite Griffweite.
   *
   *  An einem Abschnitt ist er ausgeblendet: ein Abschnitt füllt die Seite
   *  ohnehin, `span` wertet der Renderer dort nicht aus. */
  function fuellenKnopf() {
    if (!onBreiteFuellen) return null;
    const aktiv = span === 12;
    return (
      <button
        type="button"
        disabled={laeuft}
        aria-pressed={aktiv}
        aria-label={t("breiteFuellen")}
        title={t("breiteFuellen")}
        onClick={() => onBreiteFuellen()}
        className={
          "flex size-7 items-center justify-center rounded-(--radius) transition disabled:opacity-40 " +
          (aktiv
            ? "bg-secondary text-foreground"
            : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground")
        }
      >
        <Icon icon="ph:arrows-horizontal" className="size-4" />
      </button>
    );
  }

  return (
    <div
      role="group"
      aria-label={t("ausrichten")}
      className="flex items-center gap-0.5 border-b border-border px-3 py-2"
    >
      {STUFEN.map((stufe) => knopf("waagerecht", stufe, WAAGERECHT_ICON[stufe]))}
      {/* Die Trennstriche sind nicht Zierrat: ohne sie sind es acht gleich
          aussehende Symbole, und man muss jedes einzeln lesen, um die Gruppen
          zu finden. Mit ihnen sieht man die Gruppen auf einen Blick — genau
          so hält es Framer. */}
      <span aria-hidden className="mx-1 h-4 w-px shrink-0 bg-border" />
      {STUFEN.map((stufe) => knopf("senkrecht", stufe, SENKRECHT_ICON[stufe]))}
      <span aria-hidden className="mx-1 h-4 w-px shrink-0 bg-border" />
      {verteilenKnopf("waagerecht")}
      {verteilenKnopf("senkrecht")}
      {onBreiteFuellen ? (
        <>
          <span aria-hidden className="mx-1 h-4 w-px shrink-0 bg-border" />
          {fuellenKnopf()}
        </>
      ) : null}
    </div>
  );
}
