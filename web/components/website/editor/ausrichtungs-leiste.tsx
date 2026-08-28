"use client";

// Die AUSRICHTUNGSLEISTE — die erste Zeile jeder Style-Sidebar.
//
// Live abgelesen an Framer (Pearl-Template, 28.08.2026): ganz oben im
// Style-Panel, über allen Karten, steht eine Reihe aus acht Symbolen ohne
// Beschriftung, in drei Gruppen:
//
//     |◧  ◫  ◨ │ ⎺⎽  ⎼  ⎽⎺ │ |◫|  ⎓
//     ├ waagerecht ┤├ senkrecht ┤├  füllen  ┤
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
// Ohne gesetzte Richtung gilt SPALTE: das ist das Verhalten, das ein Abschnitt
// seit jeher hat (Kinder untereinander), und ein anderer Standard würde jede
// bestehende Kundenseite umbauen (Wurzel 1).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";

/** Die Felder, die diese Leiste schreibt.
 *
 *  `layout_richtung` gehört dazu, weil „waagerecht verteilen" ohne sie nicht
 *  geht: `space-between` wirkt in Flexbox nur auf der Hauptachse, und welche
 *  das ist, entscheidet die Richtung. */
type Feld = "layout_verteilen" | "layout_ausrichten" | "layout_richtung";

/** Die zwei Felder, zwischen denen die Achsen-Rechnung wählt. */
type AchsenFeld = Exclude<Feld, "layout_richtung">;

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

const WAAGERECHT_ICON: Record<Stufe, string> = {
  start: "ph:align-left-simple",
  mitte: "ph:align-center-horizontal-simple",
  ende: "ph:align-right-simple",
};

const SENKRECHT_ICON: Record<Stufe, string> = {
  start: "ph:align-top-simple",
  mitte: "ph:align-center-vertical-simple",
  ende: "ph:align-bottom-simple",
};

export function AusrichtungsLeiste({
  settings,
  span = null,
  laeuft = false,
  onSetzen,
  onBreiteFuellen,
}: {
  /** Die Einstellungen des Containers, dessen Kinder ausgerichtet werden. */
  settings: Record<string, unknown>;
  /** Breitenanteil in Zwölfteln — nur an Spalten. `12` heißt „füllt". */
  span?: number | null;
  laeuft?: boolean;
  /** `null` LÖSCHT die Einstellung — der Rückweg zu „automatisch". Ohne ihn
   *  säße der Kunde auf einer Ausrichtung fest, die er nur ausprobieren
   *  wollte (Wurzel 1). */
  onSetzen: (feld: Feld, wert: string | null) => void;
  /** Fehlt der Rückruf, gibt es den Füllen-Knopf nicht — an einem Abschnitt
   *  hätte er nichts zu schreiben. */
  onBreiteFuellen?: () => void;
}) {
  const t = useTranslations("website.container");
  const { waagerecht, senkrecht } = achsenFeld(settings.layout_richtung);

  function knopf(feld: AchsenFeld, stufe: Stufe, icon: string, titel: string) {
    const aktiv = settings[feld] === stufe;
    return (
      <button
        key={`${feld}:${stufe}`}
        type="button"
        disabled={laeuft}
        aria-pressed={aktiv}
        aria-label={titel}
        title={titel}
        onClick={() => onSetzen(feld, aktiv ? null : stufe)}
        className={
          "flex size-7 items-center justify-center rounded-(--radius) transition disabled:opacity-40 " +
          (aktiv
            ? "bg-secondary text-foreground"
            : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground")
        }
      >
        <Icon icon={icon} className="size-4" />
      </button>
    );
  }

  /** BREITE FÜLLEN — Framers dritte Gruppe.
   *
   *  Empirisch geklärt am 28.08.2026: ein Klick auf das siebte Symbol setzte
   *  im Style-Panel `Breite: 1fr · Fill`. Es ist also FÜLLEN, nicht
   *  Verteilen — zweimal hatte ich es anders geraten (erst „strecken", dann
   *  „gleichmäßig verteilen"), und beides war falsch.
   *
   *  Framer hat davon zwei Knöpfe (Breite und Höhe). Hier steht nur EINER:
   *  unser Baum kennt für die Breite einer Spalte die Zwölftel (`span`), und
   *  `span = 12` IST „füllt die Reihe". Für die Höhe gibt es kein Gegenstück —
   *  ein zweiter Knopf wäre einer, der nichts schreibt (Wurzel 4).
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
        <Icon icon="ph:arrows-out-line-horizontal" className="size-4" />
      </button>
    );
  }

  return (
    <div
      role="group"
      aria-label={t("ausrichten")}
      className="flex items-center gap-0.5 border-b border-border px-3 py-2"
    >
      {STUFEN.map((stufe) =>
        knopf(
          waagerecht,
          stufe,
          WAAGERECHT_ICON[stufe],
          `${t("waagerecht")} · ${t(stufe === "start" ? "anfang" : stufe === "mitte" ? "mitte" : "ende")}`,
        ),
      )}
      {/* Die Trennstriche sind nicht Zierrat: ohne sie sind es acht gleich
          aussehende Symbole, und man muss jedes einzeln lesen, um die Gruppen
          zu finden. Mit ihnen sieht man drei Gruppen auf einen Blick — genau
          so hält es Framer. */}
      <span aria-hidden className="mx-1 h-4 w-px shrink-0 bg-border" />
      {STUFEN.map((stufe) =>
        knopf(
          senkrecht,
          stufe,
          SENKRECHT_ICON[stufe],
          `${t("senkrecht")} · ${t(stufe === "start" ? "anfang" : stufe === "mitte" ? "mitte" : "ende")}`,
        ),
      )}
      {onBreiteFuellen ? (
        <>
          <span aria-hidden className="mx-1 h-4 w-px shrink-0 bg-border" />
          {fuellenKnopf()}
        </>
      ) : null}
    </div>
  );
}
