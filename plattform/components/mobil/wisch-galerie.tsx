// Randlose Wisch-Galerie für kleine Displays. Das Desktop-Mosaik
// (`grid-cols-4 grid-rows-2`, 5 Bilder) schrumpft mobil auf ~90-px-Kacheln —
// vier davon sind dort Dekoration statt Bild. Mobil zeigt deshalb EIN Bild pro
// Wisch, mit Zähler und Punkten.
//
// Der Stand kommt aus dem Scroll-Ereignis, nicht aus einem Klick-Zähler: bei
// nativem Snap-Scrolling ist der Scroll-Wert die einzige Wahrheit — ein eigener
// Zähler läuft nach dem ersten Wisch auseinander.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { PhotoPlaceholder } from "../photo-placeholder";

export function WischGalerie({
  fotos,
  hues,
  altTexte,
  className = "",
}: {
  fotos: string[];
  /** Platzhalter-Farbtöne, wenn kein Foto hinterlegt ist. */
  hues: number[];
  /** Alternativtexte parallel zu `fotos`. Bewusst ein ARRAY, keine Funktion:
   *  die Server-Komponente rendert die Texte, und eine Funktion überlebt die
   *  Grenze Server → Client nicht (nicht serialisierbar). */
  altTexte?: string[];
  className?: string;
}) {
  const t = useTranslations("mobil");
  const band = useRef<HTMLDivElement>(null);
  const [stand, setStand] = useState(0);

  const quellen = fotos.length > 0 ? fotos : hues;
  const gesamt = quellen.length;

  const messen = useCallback(() => {
    const el = band.current;
    if (!el || el.clientWidth === 0) return;
    setStand(Math.round(el.scrollLeft / el.clientWidth));
  }, []);

  useEffect(() => {
    const el = band.current;
    if (!el) return;
    el.addEventListener("scroll", messen, { passive: true });
    return () => el.removeEventListener("scroll", messen);
  }, [messen]);

  if (gesamt === 0) return null;

  return (
    <div className={`relative ${className}`}>
      <div
        ref={band}
        className="band-scroll flex snap-x snap-mandatory overflow-x-auto"
      >
        {fotos.length > 0
          ? fotos.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={src}
                src={src}
                alt={altTexte?.[i] ?? ""}
                className="aspect-[4/3] w-full shrink-0 snap-center object-cover"
              />
            ))
          : hues.map((hue) => (
              <PhotoPlaceholder
                key={hue}
                hue={hue}
                className="aspect-[4/3] w-full shrink-0 snap-center"
              />
            ))}
      </div>

      {gesamt > 1 && (
        <>
          {/* Zähler unten rechts (Airbnb-Muster: „3 / 8") */}
          <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-foreground/70 px-2.5 py-1 text-xs font-medium text-background">
            {t("bildZaehler", { aktuell: stand + 1, gesamt })}
          </span>

          {/* Punkte — bei vielen Bildern nur die Nachbarn, sonst wird die Reihe
              breiter als das Bild. */}
          <div
            aria-hidden
            className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5"
          >
            {quellen.slice(0, 8).map((_, i) => (
              <span
                key={i}
                className={
                  "size-1.5 rounded-full transition-opacity " +
                  (i === Math.min(stand, 7)
                    ? "bg-background"
                    : "bg-background/50")
                }
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
