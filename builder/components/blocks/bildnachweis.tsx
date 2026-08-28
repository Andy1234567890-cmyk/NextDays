"use client";

// Der Bildnachweis am gerenderten Kundenauftritt (Unsplash/Pexels).
//
// Stock-Fotos werden per HOTLINK eingebunden (Anbietervorgabe, kein Rehosting).
// Unsplash verlangt dafür in seinen API-Bedingungen bei JEDER Anzeige die
// Nennung `Photo by <Name> on Unsplash`, mit Link auf das Fotografenprofil und
// auf unsplash.com, beide mit utm-Parametern. Diese Bedingungen sind WIR
// eingegangen, im Namen des Betriebs — der Nachweis muss deshalb in der
// veröffentlichten Seite stehen, nicht nur im Editor.
//
// WARUM ES DEN NACHWEIS ZWEIMAL GIBT (am Bild UND in der Fußzeile):
//
//  * `<BildNachweis>` ist die RICHTIGE Nennung: direkt am Foto, dort, wo der
//    Betrachter sie dem Bild zuordnen kann.
//  * `<BildnachweisListe>` ist der BACKSTOP: sie zählt ALLE Nachweise der Site
//    auf, unabhängig davon, ob die jeweilige Anzeigestelle daran gedacht hat.
//
// Der Backstop ist keine Doppelung aus Bequemlichkeit, sondern die Antwort auf
// eine reale Fehlerart: Bilder werden im Baukasten an vielen Stellen gezeigt,
// und es kommen laufend Blocktypen dazu. Eine einzige Stelle, die den Nachweis
// vergisst, macht die Kundenseite vertragsbrüchig — und sieht dabei völlig
// normal aus, es fällt also niemandem auf. Die Fußzeilen-Liste hängt dagegen am
// Rahmen und nicht am Block: sie kann von einem neuen Blocktyp nicht vergessen
// werden. Die Nennung ist damit im schlechtesten Fall unvollständig platziert,
// aber nie abwesend.
import { createContext, useContext } from "react";

import {
  type Bildnachweis,
  bildnachweisAusListe,
  nachweiseFuerListe,
} from "@/lib/bildnachweis";
import { bildnachweisTexte } from "@/lib/bildnachweis-texte";
import type { SiteBranding } from "@/lib/site-context";

/** Die Nachweise der aktuellen Site.
 *
 *  Ein Kontext und keine Prop-Kette: die Bildstellen liegen über ein Dutzend
 *  Block-Komponenten verteilt, teils Server- teils Client-Komponenten, und
 *  einige davon reichen heute weder `branding` noch sonst etwas durch. Eine
 *  Kette, die durch jeden dieser Blöcke gefädelt werden muss, ist genau die
 *  Konstruktion, an der die nächste neue Bildstelle den Nachweis verliert. */
const NachweisKontext = createContext<Bildnachweis[]>([]);

/** Umschließt einen Bereich, in dem `<BildNachweis>` nachschlagen kann. Steht
 *  im `BlockRenderer` — damit gilt er für jeden Abschnitt jeder Seite, jedes
 *  Pop-ups und jeder Regel-Fläche, ohne dass eine Route daran denken muss. */
export function BildnachweisBereich({
  nachweise,
  children,
}: {
  nachweise: Bildnachweis[];
  children: React.ReactNode;
}) {
  return (
    <NachweisKontext.Provider value={nachweise}>
      {children}
    </NachweisKontext.Provider>
  );
}

/** Wie der Nachweis am Bild sitzt.
 *
 *  `overlay` braucht einen positionierten Vorfahren (`relative`); `pille` ist
 *  derselbe dunkle Balken im normalen Fluss (für dunkle Umgebungen wie die
 *  Lightbox); `zeile` ist eine unauffällige Textzeile für helle Inhaltsflächen. */
export type NachweisVariante = "overlay" | "pille" | "zeile";

// Dunkler, leicht durchscheinender Grund mit weißer Schrift: das ist die eine
// Kombination, die sowohl über einem hellen Himmel als auch über einer dunklen
// Nachtaufnahme lesbar bleibt. Eine Farbe aus dem Theme wäre über einem
// beliebigen Kundenfoto genau so oft unlesbar wie lesbar.
const PILLE =
  "bg-black/55 px-2 py-1 text-[0.6875rem] leading-tight text-white/90 backdrop-blur-sm";

const KLASSEN: Record<NachweisVariante, string> = {
  // Nur die obere linke Ecke ist gerundet: der Balken sitzt bündig in der
  // unteren rechten Ecke des Bildes, die anderen drei Ecken liegen an der Kante.
  overlay: `absolute bottom-0 right-0 z-10 max-w-full rounded-tl-md ${PILLE}`,
  pille: `inline-block rounded-md ${PILLE}`,
  // Erbt die Textfarbe der Umgebung — auf hellem Grund dunkel, auf dunklem
  // hell. `opacity` statt einer festen Farbe, damit sie in beiden Fällen
  // zurücktritt, ohne unlesbar zu werden.
  zeile: "block pt-1 text-[0.6875rem] leading-tight opacity-60",
};

/** Ein Link des Nachweises. Ohne Ziel bleibt der Name reiner Text — ein Link
 *  auf eine erfundene Adresse wäre schlimmer als keiner. */
function NachweisLink({ href, text }: { href: string; text: string }) {
  if (!href) return <>{text}</>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline underline-offset-2 transition hover:no-underline"
    >
      {text}
    </a>
  );
}

/** Der Satz selbst: `Photo by <Name> on <Quelle>`.
 *
 *  ENGLISCH und nicht übersetzt — die Begründung steht in
 *  `lib/bildnachweis-texte.ts`: Unsplash gibt diesen Wortlaut vor und sagt zu
 *  Übersetzungen nichts. Was wir nicht belegen können, behaupten wir nicht. */
function NachweisSatz({ nachweis }: { nachweis: Bildnachweis }) {
  return (
    <>
      {"Photo by "}
      <NachweisLink
        href={nachweis.photographer_url}
        text={nachweis.photographer}
      />
      {" on "}
      <NachweisLink href={nachweis.provider_url} text={nachweis.provider} />
    </>
  );
}

/** Nachweis zu EINEM Bild. Rendert nichts, wenn es zu dieser Adresse keinen
 *  gibt — der Normalfall bei den eigenen Fotos des Betriebs. Genau deshalb
 *  darf sie an jeder Bildstelle stehen, ohne dort etwas zu verändern. */
export function BildNachweis({
  src,
  variante = "overlay",
  nachweise,
}: {
  src: string | null | undefined;
  variante?: NachweisVariante;
  /** Nachweise ohne Umweg über den Kontext — für Server-Stellen, die das
   *  Branding ohnehin in der Hand haben (der Abschnitts-Hintergrund im
   *  `BlockRenderer`). */
  nachweise?: Bildnachweis[];
}) {
  const ausKontext = useContext(NachweisKontext);
  const nachweis = bildnachweisAusListe(nachweise ?? ausKontext, src);
  if (!nachweis) return null;
  return (
    <span className={KLASSEN[variante]}>
      <NachweisSatz nachweis={nachweis} />
    </span>
  );
}

/** ALLE Nachweise der Site, als Backstop in der Fußzeile (Begründung oben).
 *
 *  Einer je Urheber, nicht je Bild: die Nennung verlangt Name und Link, nicht
 *  eine Zeile pro Verwendung. */
export function BildnachweisListe({
  branding,
  sprache,
}: {
  branding: SiteBranding | null | undefined;
  sprache: string;
}) {
  const liste = nachweiseFuerListe(branding);
  if (liste.length === 0) return null;
  const txt = bildnachweisTexte(sprache);
  return (
    <div className="text-xs text-muted-foreground">
      <p className="font-medium">{txt.ueberschrift}</p>
      <ul className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 pt-1">
        {liste.map((n) => (
          <li key={`${n.photographer_url}|${n.photographer}|${n.provider}`}>
            <NachweisSatz nachweis={n} />
          </li>
        ))}
      </ul>
    </div>
  );
}
