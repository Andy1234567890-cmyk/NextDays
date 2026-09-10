// Echte Aufnahmen der myNextDays-App, gerahmt wie ein Telefon.
//
// WARUM EINE ZWEITE KOMPONENTE neben `app-aufnahme.tsx`: die Aufnahmen dort
// sind Browser-Aufnahmen im Verhältnis 16:10 und stehen in einem
// Programmfenster-Rahmen (Fensterleiste mit drei Punkten). Eine
// Telefon-Aufnahme ist hochkant, Verhältnis ~1:2,17. In den Fensterrahmen
// gelegt entsteht genau das, was auf `/funktionen/mobile-app` stand: ein
// 700 px hohes leeres Fenster mit einem schmalen Bildstreifen darin,
// angeschrieben als „Anwendung".
//
// Die Aufnahmen tragen ihre eigene Statusleiste samt Dynamic Island — der
// Rahmen hier setzt deshalb KEINE zweite Kerbe darauf, sondern nur Gehäuse,
// Rundung und Seitentasten.
import Image from "next/image";

import type { ReactNode } from "react";

import {
  APP_MOBIL_BREITE,
  APP_MOBIL_HOEHE,
  appMobilPfad,
  type AppMotivMobil,
} from "@/lib/app-mobil";

export function AppAufnahmeMobil({
  motiv,
  alt,
  priority = false,
  sizes = "(min-width: 1024px) 20vw, 42vw",
  className = "",
  // Positionierung des Gehäuses. Standard `relative` — für ein Gerät, das im
  // Textfluss steht. Ein Aufrufer, der es als Overlay über ein anderes Bild
  // legt, gibt hier "absolute" an.
  //
  // Warum als Parameter und nicht einfach `absolute` in `className`: die
  // Klasse stand fest im Gehäuse-String, und Tailwind entscheidet bei zwei
  // gleichrangigen Regeln nach der Reihenfolge im STYLESHEET, nicht im
  // Attribut. `relative` gewann dadurch immer. Gemessen am 10.09.2026:
  // `position: relative`, das Telefon ragte exakt um seine volle Höhe (378 px)
  // unter das Fenster — es stand darunter statt darüber.
  position = "relative",
}: {
  motiv: AppMotivMobil;
  /** Leer = schmückendes Zweitgerät; dann überspringen Screenreader es. */
  alt: string;
  priority?: boolean;
  sizes?: string;
  className?: string;
  position?: "relative" | "absolute";
}) {
  return (
    <figure
      className={`${position} aspect-[860/1870] rounded-[1.6rem] bg-neutral-900 p-[0.3rem] shadow-float ring-1 ring-black/10 sm:rounded-[2rem] sm:p-[0.4rem] dark:bg-neutral-800 ${className}`}
    >
      {/* Seitentasten — sie machen aus dem Rechteck ein Gerät. Reine
          Gestaltung, deshalb aria-hidden. */}
      <span
        aria-hidden
        className="absolute -left-[0.12rem] top-[21%] h-[6%] w-[0.12rem] rounded-l-full bg-neutral-700"
      />
      <span
        aria-hidden
        className="absolute -left-[0.12rem] top-[30%] h-[9%] w-[0.12rem] rounded-l-full bg-neutral-700"
      />
      <span
        aria-hidden
        className="absolute -right-[0.12rem] top-[26%] h-[11%] w-[0.12rem] rounded-r-full bg-neutral-700"
      />
      <Image
        src={appMobilPfad(motiv)}
        alt={alt}
        width={APP_MOBIL_BREITE}
        height={APP_MOBIL_HOEHE}
        priority={priority}
        sizes={sizes}
        className="h-full w-full rounded-[1.35rem] bg-white object-cover object-top sm:rounded-[1.7rem]"
      />
    </figure>
  );
}

/** Mehrere Telefone nebeneinander, das vorderste größer und angehoben.
 *
 *  Ein einzelnes Telefon füllt die Bildspalte einer Zweispalten-Sektion nicht:
 *  hochkant neben einer Textspalte bleibt links und rechts Luft, und genau
 *  diese Leere war das Problem der Seite. Zwei bis drei Geräte füllen die
 *  Fläche UND zeigen mehr Produkt — dasselbe Muster wie auf den
 *  App-Store-Seiten.
 *
 *  Alternativtext: nur das erste Gerät bekommt ihn. Dreimal derselbe Satz
 *  hintereinander ist für einen Screenreader Lärm, nicht Information; die
 *  weiteren Geräte zeigen dieselbe App in einer anderen Ansicht. */
/** Telefone auf einer weichen Akzent-Aura statt in einem Kasten.
 *
 *  Die Startseite stellt ihre Aufnahmen frei und legt nur einen zarten
 *  Farbschein dahinter (`marketing-hero.tsx`); ein umrandetes Farbfeld um ein
 *  hochkantes Gerät erzeugt dagegen die leeren Ecken, die diese Seite vorher
 *  hatte. Deshalb: Aura, kein Feld. */
export function TelefonBuehne({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-6 inset-y-10 rounded-full bg-surface-accent opacity-80 blur-3xl"
      />
      <div className="relative">{children}</div>
    </div>
  );
}

export function AppAufnahmenMobilReihe({
  motive,
  alt,
  priority = false,
  className = "",
}: {
  motive: readonly AppMotivMobil[];
  alt: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      {motive.map((motiv, i) => (
        <AppAufnahmeMobil
          key={motiv}
          motiv={motiv}
          alt={i === 0 ? alt : ""}
          priority={priority && i === 0}
          sizes={SIZES[breite(motive.length)]}
          className={LAGE[breite(motive.length)][i] ?? ""}
        />
      ))}
    </div>
  );
}

/** Wie viele Geräte in der Reihe stehen — begrenzt auf die drei gebauten
 *  Fälle. Ein vierter Screenshot in derselben Reihe wäre auf jedem Gerät zu
 *  klein, um noch etwas zu zeigen. */
function breite(anzahl: number): 1 | 2 | 3 {
  if (anzahl <= 1) return 1;
  return anzahl === 2 ? 2 : 3;
}

// Die Geräte überlappen leicht und stehen versetzt: so liest die Reihe als EIN
// Bild und nicht als zwei Kacheln. Prozente statt fester Breiten, damit die
// Reihe in Hero-Spalte, Reiter-Panel und Beleg-Block gleich gut sitzt.
//
// Die Breiten sind bewusst groß: bei drei Geräten je 31 % wird jede Aufnahme
// auf ~20 % der Originalbreite gestaucht, dann ist selbst die Überschrift im
// Screenshot nicht mehr lesbar. Zwei Geräte zeigen weniger und sagen mehr.
const LAGE: Record<1 | 2 | 3, readonly string[]> = {
  // Ein einzelnes Gerät bleibt schmal: auf 54 % der Spalte wird es über 700 px
  // hoch und beherrscht den Abschnitt, statt ihn zu belegen.
  1: ["w-[52%] sm:w-[42%]"],
  2: ["w-[46%] -rotate-3 translate-y-4", "z-10 w-[50%] -translate-x-3 -translate-y-4"],
  3: [
    "w-[33%] -rotate-3 translate-y-6",
    "z-10 w-[38%] -translate-x-3 -translate-y-3",
    "w-[33%] -translate-x-6 translate-y-6 rotate-3",
  ],
};

const SIZES: Record<1 | 2 | 3, string> = {
  1: "(min-width: 1024px) 22vw, 52vw",
  2: "(min-width: 1024px) 24vw, 46vw",
  3: "(min-width: 1024px) 18vw, 33vw",
};
