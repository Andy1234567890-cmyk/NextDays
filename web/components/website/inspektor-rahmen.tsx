"use client";

// Der INSPEKTOR rechts — die vierte Spalte des Editors.
//
// 1:1 nach `docs/UI` (Foto 19.04.54 und 19.05.26):
//
//     ▣                                    ✕     ← Kopf (in der Schale)
//     … › Spalte › Innenspalte ›  ▸              ← BREADCRUMB, anklickbar
//     Textblock                                  ← Titel, groß
//     Rahmen                                     ← Unterzeile, klein und grau
//     ┌───────────────────────────────────┐
//     │ ›  Stil                           │      ← Klappkarte, Pfeil LINKS
//     ├───────────────────────────────────┤
//     │ ›  Ausrichtung                    │
//     │ ›  Abstände                       │
//     │ ›  Größe                       ⓘ  │
//     │ ›  Animation                   ●  │      ← türkiser Punkt = geändert
//     │ ›  Position                       │
//     └───────────────────────────────────┘
//
// DREI Dinge machen den Unterschied zu dem, was vorher links stand:
//
// 1. **Der Breadcrumb.** Er zeigt die Verschachtelung — Abschnitt › Spalte ›
//    Baustein — und jede Stufe ist anklickbar. Vorher gab es dafür einen BAUM
//    in der Seitenleiste; im Vorbild steht die Verschachtelung hier und als
//    Pille auf der Fläche, und der Baum ist ein eigener Bereich („Ebenen").
// 2. **Klappkarten statt einer Rolle.** Alle Felder untereinander sind in
//    20 rem eine Bildlaufstrecke, an deren Ende niemand sucht. Zugeklappt sieht
//    man in einem Bild, WAS es zu stellen gibt.
// 3. **Der Änderungspunkt.** Ein türkiser Punkt an der Karte sagt: hier steht
//    etwas anderes als der Standard. Ohne ihn muss man jede Karte aufklappen,
//    um zu sehen, ob darin etwas Eigenes steht — und genau das tut niemand.
import { Icon } from "@iconify/react";
import { type ReactNode, useId, useState } from "react";

/** Eine Stufe des Breadcrumbs.
 *
 *  `onKlick` fehlt bei der Stufe, auf der man STEHT — sie ist kein Ziel, und
 *  ein Link auf den eigenen Ort wäre eine Lüge über das, was ein Klick tut. */
export type BrotKrume = { id: string; label: string; onKlick?: () => void };

/**
 * Kopfbereich des Inspektors: Breadcrumb, Titel, Unterzeile.
 *
 * Der Breadcrumb scrollt waagerecht statt umzubrechen. Bei tiefer
 * Verschachtelung („Hauptbereich › Spalte › Innenspalte › Innenspalte") wären
 * es sonst drei Zeilen über einem einzeiligen Titel — und der Titel, das
 * Wichtigste, stünde am weitesten unten.
 */
export function InspektorKopf({
  krumen,
  titel,
  unterzeile,
}: {
  krumen: BrotKrume[];
  titel: string;
  /** Was das Element IST, wenn der Titel es nicht schon sagt (Vorbild:
   *  „Frame" unter „Text Block"). Fehlt sie, entfällt die Zeile — eine leere
   *  Zeile Platzhalter wäre schlechter als keine. */
  unterzeile?: string;
}) {
  return (
    <div className="flex flex-col gap-1 px-4 pb-3">
      {krumen.length > 0 ? (
        <nav
          aria-label={titel}
          // `scrollbar-none` gibt es nicht überall; der Balken stört hier aber
          // auch nicht — die Zeile ist 20 px hoch und der Balken liegt darunter.
          className="flex min-w-0 items-center gap-0.5 overflow-x-auto text-xs text-muted-foreground"
        >
          {krumen.map((k, i) => (
            <span key={k.id} className="flex shrink-0 items-center gap-0.5">
              {i > 0 ? (
                <Icon
                  icon="ph:caret-right"
                  aria-hidden
                  className="size-3 shrink-0 opacity-60"
                />
              ) : null}
              {k.onKlick ? (
                <button
                  type="button"
                  onClick={k.onKlick}
                  className="max-w-[7rem] truncate rounded px-1 py-0.5 transition hover:bg-secondary hover:text-foreground"
                >
                  {k.label}
                </button>
              ) : (
                <span className="max-w-[7rem] truncate px-1 py-0.5">
                  {k.label}
                </span>
              )}
            </span>
          ))}
        </nav>
      ) : null}
      <h2 className="truncate font-display text-lg font-extrabold leading-tight">
        {titel}
      </h2>
      {unterzeile ? (
        <p className="truncate text-xs text-muted-foreground">{unterzeile}</p>
      ) : null}
    </div>
  );
}

/**
 * Eine Klappkarte des Inspektors.
 *
 * Der Pfeil steht LINKS vor der Beschriftung, nicht rechts am Rand. Das ist
 * kein Geschmack: rechts gelesen heißt ein `›` „führt woanders hin" (so
 * benutzen wir ihn in `LeisteVerweis`), links vor der Beschriftung heißt er
 * „klappt hier auf". Zwei Bedeutungen für dasselbe Zeichen an derselben
 * Oberfläche wären der Grund, warum niemand vorhersagen kann, was ein Klick
 * tut.
 */
export function InspektorKarte({
  titel,
  children,
  geaendert = false,
  hinweis,
  offenAnfangs = false,
}: {
  titel: string;
  children: ReactNode;
  /** true = hier steht etwas anderes als der Standard. Zeigt den türkisen
   *  Punkt. Er wird BERECHNET und nicht gemerkt: ein gemerkter Zustand wäre
   *  nach einem Zurücksetzen falsch, und zwar dauerhaft. */
  geaendert?: boolean;
  /** Erklärung hinter einem ⓘ. Nur setzen, wenn die Beschriftung allein
   *  wirklich nicht reicht — ein ⓘ an jeder Karte ist ein Muster ohne
   *  Aussage. */
  hinweis?: string;
  offenAnfangs?: boolean;
}) {
  const [offen, setOffen] = useState(offenAnfangs);
  const inhaltId = useId();
  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        aria-expanded={offen}
        aria-controls={inhaltId}
        className="flex w-full items-center gap-2 px-4 py-2 text-left transition hover:bg-secondary/50"
      >
        {/* Der Titel steht LINKS und der Griff RECHTS — so hält es Framers
            Style-Sidebar (live abgelesen 28.08.2026), und der Grund ist die
            Kante: sieben Karten mit Pfeil davor haben sieben verschiedene
            Textanfänge, weil der Pfeil unterschiedlich breit rendert. Mit dem
            Griff rechts stehen alle Titel auf einer Linie. */}
        <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-semibold">
          {titel}
        </span>
        {hinweis ? (
          // Der Titel sitzt am `span` und nicht am `Icon`: `Icon` reicht
          // unbekannte Attribute nicht an das SVG durch, der Tooltip käme also
          // nie an. Ein `aria-label` ohne sichtbaren Tooltip wäre eine
          // Erklärung, die nur Vorlesehilfen hören.
          <span
            title={hinweis}
            aria-label={hinweis}
            className="flex shrink-0 items-center text-muted-foreground"
          >
            <Icon icon="ph:info" className="size-3.5" />
          </span>
        ) : null}
        <Icon
          icon={offen ? "ph:minus" : "ph:plus"}
          aria-hidden
          className="size-3.5 shrink-0 text-muted-foreground"
        />
        {geaendert ? (
          // Der Punkt trägt einen Titel: eine reine Farbfläche ohne Text ist
          // für eine Vorlesehilfe nichts, und „hier steht etwas Eigenes" ist
          // genau die Auskunft, die sie braucht.
          <span
            title={titel}
            className="size-1.5 shrink-0 rounded-full bg-(--brand)"
          />
        ) : null}
      </button>
      {offen ? (
        <div id={inhaltId} className="px-4 pb-4">
          {children}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Hinweisfeld im Inspektor — der blaue Kasten aus dem Vorbild („This content
 * cannot be edited. Contact your administrator.").
 *
 * Er steht UNTER den Karten und nicht darüber: er erklärt eine Einschränkung
 * dessen, was darüber steht, und wer ihn zuerst liest, weiß noch nicht, worauf
 * er sich bezieht.
 */
export function InspektorHinweis({ children }: { children: ReactNode }) {
  return (
    <div className="mx-4 my-3 flex items-start gap-2 rounded-(--radius) bg-blue-50 p-3 text-xs text-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
      <Icon icon="ph:info-fill" className="mt-px size-4 shrink-0 text-blue-500" />
      <p className="min-w-0">{children}</p>
    </div>
  );
}

/** Zeile INNERHALB einer Klappkarte: Beschriftung links, Bedienelement rechts.
 *
 *  Dieselbe Form wie `LeisteZeile` im Panel, aber mit dem engeren Innenabstand
 *  der Karte — die Karte bringt ihr `px-4` schon mit, und eine zweite Ebene
 *  Einzug ließe die Bedienelemente in einer 20-rem-Spalte auf halbe Breite
 *  schrumpfen. */
export function InspektorZeile({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="min-w-0 truncate text-xs text-muted-foreground">
        {label}
      </span>
      <div className="flex shrink-0 items-center">{children}</div>
    </div>
  );
}

// === Bauteile im Framer-Maß (28.08.2026) ====================================
//
// Live abgelesen an Framers Style-Sidebar (Pearl-Template, Screenshot des
// Nutzers 09:03): jede Zeile ist LABEL LINKS · KONTROLLE RECHTS, die Kontrolle
// sitzt in einem grauen Feld, und mehrere Möglichkeiten stehen als
// zusammenhängender Segmentblock mit WEISSEM aktivem Segment.
//
// Warum das kein Geschmack ist: einzelne Symbolknöpfe ohne gemeinsamen Grund
// lesen sich als vier verschiedene Dinge, ein Segmentblock als EINE
// Entscheidung mit vier Möglichkeiten. Genau das ist der Unterschied, den der
// Nutzer am 28.08.2026 gemeldet hat („ich gebe dir eine Framer-Oberfläche um
// das UI zu sehen und du baust so ein müll").

/** Eine Zeile des Inspektors: Beschriftung links, Bedienelement rechts. */
export function FeldZeile({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-8 items-center gap-2">
      {/* Feste Beschriftungsspalte: ohne sie stehen die Bedienelemente auf
          verschiedenen Kanten, und das Panel wirkt wie eine Sammlung statt
          wie eine Liste. */}
      <span className="w-[5.5rem] shrink-0 truncate text-[0.8125rem] text-muted-foreground">
        {label}
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-1.5">{children}</div>
    </div>
  );
}

/** Segmentblock — mehrere Möglichkeiten, eine Entscheidung.
 *
 *  Ein zweiter Klick auf das aktive Segment setzt zurück (`null`). Ohne diesen
 *  Rückweg säße der Kunde auf einer Einstellung fest, die er nur ausprobieren
 *  wollte (Wurzel 1). */
export function Segment<T extends string>({
  wert,
  optionen,
  laeuft = false,
  onWahl,
}: {
  wert: T | null;
  optionen: readonly (readonly [T, string, string])[];
  laeuft?: boolean;
  onWahl: (wert: T | null) => void;
}) {
  return (
    <div className="flex min-w-0 flex-1 gap-0.5 rounded-lg bg-secondary p-0.5">
      {optionen.map(([v, icon, titel]) => (
        <button
          key={v}
          type="button"
          disabled={laeuft}
          aria-pressed={wert === v}
          aria-label={titel}
          title={titel}
          onClick={() => onWahl(wert === v ? null : v)}
          className={
            "flex flex-1 items-center justify-center rounded-[calc(var(--radius)-0.125rem)] py-1 transition disabled:opacity-50 " +
            (wert === v
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground")
          }
        >
          <Icon icon={icon} className="size-4" />
        </button>
      ))}
    </div>
  );
}

/** Zahlenfeld im grauen Feld. Leer heißt „nicht gesetzt" — nicht 0. */
export function Zahlfeld({
  wert,
  min,
  max,
  einheit,
  schritt,
  platzhalter,
  laeuft = false,
  onWert,
}: {
  wert: number | null;
  min: number;
  max: number;
  /** Steht rechts im Feld („px"). Ohne Einheit ist eine Zahl keine Größe. */
  einheit?: string;
  /** Schrittweite — ohne Angabe ganze Zahlen. */
  schritt?: number;
  /** Der BERECHNETE Wert als grauer Platzhalter, solange nichts gesetzt ist
   *  (Framer: die gemessene Höhe bei „Fit Content"). Er wird angezeigt, nie
   *  gespeichert — sonst wäre eine Messung plötzlich eine Einstellung
   *  (Wurzel 4). */
  platzhalter?: string;
  laeuft?: boolean;
  onWert: (wert: number | null) => void;
}) {
  return (
    <div className="flex h-[30px] min-w-0 flex-1 items-center rounded-lg bg-secondary px-2">
      <input
        type="number"
        inputMode={schritt && schritt < 1 ? "decimal" : "numeric"}
        min={min}
        max={max}
        step={schritt ?? 1}
        disabled={laeuft}
        key={wert ?? ""}
        defaultValue={wert ?? ""}
        placeholder={platzhalter ?? "—"}
        onBlur={(e) => {
          const roh = e.target.value.trim();
          if (roh === "") {
            if (wert !== null) onWert(null);
            return;
          }
          const zahl = Math.min(max, Math.max(min, Number(roh)));
          if (!Number.isFinite(zahl) || zahl === wert) return;
          onWert(zahl);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className="h-full min-w-0 flex-1 bg-transparent text-[0.8125rem] outline-none disabled:opacity-50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      />
      {einheit ? (
        <span className="shrink-0 pl-1 text-[0.6875rem] text-muted-foreground">
          {einheit}
        </span>
      ) : null}
    </div>
  );
}

/** Zahlenfeld MIT Schieberegler daneben — für Werte, die man erfühlt
 *  (Abstand, Deckkraft). Framer stellt beides nebeneinander, weil die Zahl
 *  allein nichts über die Wirkung sagt. */
export function Schieber({
  wert,
  min,
  max,
  standard,
  einheit = "px",
  schritt,
  laeuft = false,
  onWert,
}: {
  wert: number | null;
  min: number;
  max: number;
  /** Wo der Regler steht, solange nichts gesetzt ist. Er zeigt damit den
   *  Ausgangspunkt, ohne ihn zu speichern (Wurzel 4). */
  standard: number;
  einheit?: string;
  schritt?: number;
  laeuft?: boolean;
  onWert: (wert: number | null) => void;
}) {
  return (
    <>
      <Zahlfeld
        wert={wert}
        min={min}
        max={max}
        einheit={einheit}
        schritt={schritt}
        laeuft={laeuft}
        onWert={onWert}
      />
      <input
        type="range"
        min={min}
        max={max}
        step={schritt ?? 1}
        value={wert ?? standard}
        disabled={laeuft}
        onChange={(e) => onWert(Number(e.target.value))}
        // Die Gestaltung steht als `.nd-schieber` in `globals.css` — siehe
        // dort, warum sie keine Utility-Kette ist.
        className="nd-schieber min-w-0 flex-1"
      />
    </>
  );
}
