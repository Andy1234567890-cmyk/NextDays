"use client";

// Grundraster des Baukastens: Reiterleiste oben, schmale Einstellungsspalte
// links, große Live-Vorschau rechts.
//
// Diese Aufteilung ist der Kern der Bedienbarkeit und im Markt einheitlich
// (live abgelesen bei Lodgify am 23.08.2026): der Kunde stellt links etwas ein
// und sieht rechts sofort die Folge. Es gibt keine Bühne, auf der er Elemente
// verschiebt — die Vorschau ist read-only, das Layout gehört dem Theme.
//
// Die Einstellungsspalte ist absichtlich schmal: was hier nicht hineinpasst,
// gehört nicht in den Baukasten. 14rem war allerdings ZU eng — Beschriftungen
// wie „Buttons und Links" wurden abgeschnitten, die Schriftart-Auswahl zeigte
// nur den Anfang des Namens, und im Abschnitts-Inspektor standen Textfelder in
// einer Breite, in der man den eigenen Satz nicht lesen kann. 20rem trägt die
// Inhalte und lässt der Vorschau weiterhin den Großteil der Fläche.
import { Icon } from "@iconify/react";
import Link from "next/link";
import { type ReactNode, useEffect, useRef, useState } from "react";

/** Zustand des Autospeicherns — wird oben rechts angezeigt, wie im Markt üblich.
 *  Es gibt bewusst KEINEN Speichern-Knopf: ein Kunde, der eine Farbe wählt und
 *  wegklickt, hat gespeichert. */
export type SpeicherStand = "ruht" | "speichert" | "gespeichert" | "fehler";

/**
 * Höhe der Schale: vom eigenen Oberrand bis zum Fensterboden, minus dem unteren
 * Innenabstand des Dashboard-Inhaltsbereichs.
 *
 * Warum gemessen und nicht gerechnet: der Abstand nach oben hängt davon ab, was
 * über der Seite steht — Topbar immer, dazu je nach Konto ein Demo-Band oder ein
 * 2FA-Hinweis. Eine feste Zahl wie `calc(100dvh - 7rem)` wäre für den einen Fall
 * richtig und für die anderen falsch, und niemand würde es merken, weil es nur
 * ein paar Pixel schief aussieht.
 *
 * Nötig ist das, weil der Sidebar-Wrapper des Dashboards nur `min-h-svh` setzt
 * (also eine Untergrenze, keine Obergrenze) und deshalb mit dem Inhalt wächst.
 * Eine Seite, die INNEN scrollen soll, muss ihre Höhe daher selbst kennen.
 */
const UNTERER_ABSTAND_PX = 24; // entspricht md:p-6 des Inhaltsbereichs

function useSchalenHoehe() {
  const ref = useRef<HTMLDivElement>(null);
  const [hoehe, setHoehe] = useState<number | null>(null);

  useEffect(() => {
    function messen() {
      const el = ref.current;
      if (!el) return;
      const oben = el.getBoundingClientRect().top;
      setHoehe(Math.max(320, window.innerHeight - oben - UNTERER_ABSTAND_PX));
    }
    messen();
    window.addEventListener("resize", messen);
    // Der Oberrand verschiebt sich auch ohne Fenster-Resize (ein Hinweisband
    // erscheint, die Topbar klappt um) — deshalb den Vorfahren beobachten.
    const beobachter = new ResizeObserver(messen);
    if (ref.current?.parentElement) beobachter.observe(ref.current.parentElement);
    return () => {
      window.removeEventListener("resize", messen);
      beobachter.disconnect();
    };
  }, []);

  return { ref, hoehe };
}

export function BaukastenSchale({
  reiter,
  aktiverReiter,
  vorNavigation,
  kopfAktionen,
  seitenleiste,
  inhalt,
  breit = false,
}: {
  /** Die Reiter mit ihrer ROUTE. Kein `onReiter`-Rückruf mehr: ein Reiter ist
   *  eine Adresse, kein Zustand. Vorher stand der aktive Reiter in
   *  `?reiter=design`, womit ein Unterpunkt wie das Logo-Panel überhaupt keine
   *  Adresse hatte — man konnte niemandem einen Link darauf schicken, und der
   *  Zurück-Knopf sprang aus dem Baukasten heraus statt eine Ebene hoch. */
  reiter: Array<{ id: string; label: string; href: string }>;
  aktiverReiter: string;
  /** Läuft bei einem Reiter-Klick, BEVOR die Navigation stattfindet. Der
   *  Abschnitts-Editor schreibt darin seinen offenen Stand weg — der Request
   *  überlebt die Soft-Navigation, ein Hard-Reload hätte den laufenden
   *  Entprellungs-Timer und damit die letzte Eingabe verworfen. */
  vorNavigation?: () => void;
  kopfAktionen?: ReactNode;
  /** Einstellungen links. Fehlt sie, füllt `inhalt` die ganze Breite. */
  seitenleiste?: ReactNode;
  inhalt: ReactNode;
  /** true = keine Vorschau, Inhalt über die volle Breite (wie „Einstellungen"). */
  breit?: boolean;
}) {
  const { ref, hoehe } = useSchalenHoehe();
  return (
    <div
      ref={ref}
      // Vor der ersten Messung eine Näherung, damit es beim ersten Bild nicht
      // springt; danach gilt der gemessene Wert.
      style={{ height: hoehe ?? "calc(100dvh - 7rem)" }}
      className="flex min-h-0 flex-col overflow-hidden rounded-(--radius) border border-border bg-background"
    >
      {/* Reiterleiste */}
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-4">
        {/* Kein negativer Rand am Knopf: der ragte 1px über den Container und
            machte aus overflow-x-auto zusätzlich einen vertikalen Scrollbalken
            neben den Reitern. Die Unterstreichung liegt stattdessen INNEN. */}
        <nav className="flex items-center gap-1 overflow-x-auto overflow-y-hidden">
          {reiter.map((r) => {
            const aktiv = r.id === aktiverReiter;
            return (
              <Link
                key={r.id}
                href={r.href}
                onClick={() => {
                  if (!aktiv) vorNavigation?.();
                }}
                aria-current={aktiv ? "page" : undefined}
                className={
                  "relative shrink-0 px-3 py-3 text-sm transition " +
                  "after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full " +
                  (aktiv
                    ? "font-semibold text-foreground after:bg-foreground"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                {r.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex shrink-0 items-center gap-2 py-2">
          {kopfAktionen}
        </div>
      </div>

      {/* Arbeitsfläche */}
      {breit || !seitenleiste ? (
        <div className="min-h-0 flex-1 overflow-y-auto">{inhalt}</div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <aside className="w-80 shrink-0 overflow-y-auto border-r border-border">
            {seitenleiste}
          </aside>
          <div className="min-w-0 flex-1 overflow-hidden bg-secondary/20">
            {inhalt}
          </div>
        </div>
      )}
    </div>
  );
}

/** Abschnittstitel in der Einstellungsspalte. Fett, klein, mit Abstand darüber —
 *  die einzige Gliederungsebene, die es dort gibt. */
export function LeisteTitel({ children }: { children: ReactNode }) {
  return (
    <h3 className="px-4 pb-2 pt-5 font-display text-sm font-extrabold">
      {children}
    </h3>
  );
}

/** Zeile in der Einstellungsspalte: Beschriftung links, Bedienelement rechts.
 *  Das ist die Grundform für Farbrollen und Schalter. */
export function LeisteZeile({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2">
      <span className="min-w-0 truncate text-sm">{label}</span>
      <div className="flex shrink-0 items-center">{children}</div>
    </div>
  );
}

/** Zeile, die zu einer Unterseite führt (wie „Logo →"). */
export function LeisteVerweis({
  label,
  href,
}: {
  label: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm font-medium transition hover:bg-secondary/60"
    >
      {label}
      <Icon icon="ph:arrow-right" className="size-4 text-muted-foreground" />
    </Link>
  );
}

/** Kopf einer Unterseite der Einstellungsspalte (Zurück-Pfeil + Titel).
 *
 *  Zwei Rückwege, weil es zwei Arten von Unterseite gibt und sie sich echt
 *  unterscheiden:
 *
 *  • `zurueckHref` — die Unterseite hat eine eigene ADRESSE (Design → Logo,
 *    `/website/design/logo`). Der Rückweg ist eine Navigation, also ein Link:
 *    Mittelklick, „in neuem Tab öffnen" und der Zurück-Knopf funktionieren.
 *
 *  • `onZurueck` — die Unterseite ist ein Auswahl-Zustand OHNE Adresse (der
 *    Abschnitts-Inspektor: welcher Abschnitt gerade bearbeitet wird). Dafür
 *    wäre ein Link eine Lüge, denn es gibt keine Seite, auf die er führt.
 *
 *  Der Union-Typ erzwingt genau eines von beiden — nicht keines und nicht
 *  beides, sonst wäre unklar, was der Pfeil tut. */
export function LeisteUnterseite({
  titel,
  children,
  ...rest
}: {
  titel: string;
  children: ReactNode;
} & ({ zurueckHref: string; onZurueck?: never } | { onZurueck: () => void; zurueckHref?: never })) {
  const klasse =
    "flex items-center gap-2 px-4 pt-4 text-sm font-medium text-muted-foreground transition hover:text-foreground";
  return (
    <div className="flex flex-col">
      {rest.zurueckHref ? (
        <Link href={rest.zurueckHref} className={klasse}>
          <Icon icon="ph:arrow-left" className="size-4" />
          {titel}
        </Link>
      ) : (
        <button type="button" onClick={rest.onZurueck} className={klasse}>
          <Icon icon="ph:arrow-left" className="size-4" />
          {titel}
        </button>
      )}
      {children}
    </div>
  );
}

/** Anzeige des Autospeicher-Zustands. Kein Knopf — nur die Wahrheit darüber,
 *  was mit den Eingaben passiert ist.
 *
 *  Die Texte kommen von außen: eine Anzeige-Komponente soll keine Übersetzung
 *  selbst ziehen, sonst hängt sie am Namespace ihres Aufrufers. */
export function SpeicherAnzeige({
  stand,
  texte,
}: {
  stand: SpeicherStand;
  texte: { speichert: string; gespeichert: string; fehler: string };
}) {
  if (stand === "ruht") return null;
  return (
    <span
      data-stand={stand}
      className={
        "text-sm " +
        (stand === "fehler" ? "text-destructive" : "text-muted-foreground")
      }
    >
      {stand === "speichert"
        ? texte.speichert
        : stand === "gespeichert"
          ? texte.gespeichert
          : texte.fehler}
    </span>
  );
}
