// Gemeinsame Sektions-Bausteine der Landingpage.
//
// Referenz-UX (hostaway.com, ausgewertet 30.07.2026): jede Sektion folgt
// demselben Dreiklang „Eyebrow (Kategorie) → Überschrift (Aussage) →
// Unterzeile (Erklärung)", und harte Sektionskanten werden durch flache
// Wellen aufgelöst. Beides hier EINMAL definiert, damit der Rhythmus über
// alle Sektionen gleich ist und nicht in jeder Datei neu erfunden wird.
import type { ReactNode } from "react";

// EINE Wellenkachel, 1440 breit. Start- und Endhöhe sind identisch (y = 26),
// sonst entsteht beim Aneinanderreihen ein sichtbarer Knick — genau das macht
// die Endlos-Animation möglich.
const WAVE_TILE =
  "M0 26C240 4 480 4 720 26s480 22 720 0V0H0Z";

type SectionHeadingProps = {
  eyebrow?: string;
  heading: string;
  sub?: string;
  /** Links statt zentriert — für zweispaltige Sektionen. */
  align?: "center" | "left";
  children?: ReactNode;
};

export function SectionHeading({
  eyebrow,
  heading,
  sub,
  align = "center",
  children,
}: SectionHeadingProps) {
  const centered = align === "center";

  return (
    <div className={centered ? "mx-auto max-w-3xl text-center" : "max-w-2xl"}>
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h2
        className={
          "font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl " +
          (eyebrow ? "mt-4" : "")
        }
      >
        {heading}
      </h2>
      {sub ? (
        <p
          className={
            "mt-4 text-lg text-muted-foreground " + (centered ? "mx-auto" : "")
          }
        >
          {sub}
        </p>
      ) : null}
      {children}
    </div>
  );
}

/**
 * Wellenkante INNERHALB einer farbigen Sektion: liegt oben bzw. unten auf der
 * Fläche und ist in der Farbe der ANGRENZENDEN Sektion gefüllt — dadurch läuft
 * der Farbblock wellenförmig aus, statt hart abzuschneiden.
 *
 * `color` ist eine Textfarb-Utility (die Kurve nutzt currentColor).
 */
export function WaveEdge({
  position,
  color = "text-background",
}: {
  position: "top" | "bottom";
  color?: string;
}) {
  return (
    <div
      aria-hidden
      className={
        "pointer-events-none absolute inset-x-0 z-10 overflow-hidden leading-none " +
        color +
        (position === "top" ? " top-0" : " bottom-0 rotate-180")
      }
    >
      <svg
        viewBox="0 0 2880 80"
        preserveAspectRatio="none"
        className={
          "block h-10 w-[200%] sm:h-16 " +
          (position === "top" ? "wave-drift" : "wave-drift-slow")
        }
      >
        <path d={WAVE_TILE} fill="currentColor" />
        <path d={WAVE_TILE} fill="currentColor" transform="translate(1440 0)" />
      </svg>
    </div>
  );
}

/**
 * Flache Welle als Sektionsübergang.
 *
 * `from` = Textfarb-Utility der Fläche ÜBER der Welle (die Kurve wird darin
 * gezeichnet), `to` = Hintergrund-Utility der Fläche UNTER der Welle. Beide
 * müssen zu den angrenzenden Sektionen passen, sonst entsteht ein Farbsprung.
 */
export function SectionWave({
  from = "text-background",
  to = "bg-surface-warm",
}: {
  from?: string;
  to?: string;
}) {
  return (
    <div
      aria-hidden
      className={`w-full overflow-hidden leading-none ${to} ${from}`}
    >
      <svg
        viewBox="0 0 2880 80"
        preserveAspectRatio="none"
        className="wave-drift block h-10 w-[200%] sm:h-16"
      >
        <path d={WAVE_TILE} fill="currentColor" />
        <path d={WAVE_TILE} fill="currentColor" transform="translate(1440 0)" />
      </svg>
    </div>
  );
}
