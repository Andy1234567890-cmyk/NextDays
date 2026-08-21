"use client";

// Inhaltsverzeichnis — klebende Leiste unter der Kopfzeile.
//
// Client-Komponente, weil sie den aktiven Abschnitt beim Scrollen hervorhebt.
// Ohne diese Hervorhebung ist eine langgezogene Doku-Seite unübersichtlich: man
// weiß nicht, wo man ist, und springt zurück nach oben.
//
// Umgesetzt mit IntersectionObserver statt Scroll-Handler: der feuert nur bei
// echten Sichtbarkeitswechseln, während ein Scroll-Handler bei jedem Pixel läuft
// und die Seite auf schwachen Geräten ruckeln lässt.
import { useEffect, useState } from "react";

import { useTranslations } from "next-intl";

/** Anker der Seite, in Leserichtung. Muss zu den `id`s der Abschnitte passen. */
const ABSCHNITTE = [
  "schnellstart",
  "konzepte",
  "konventionen",
  "endpunkte",
  "webhooks",
  "grenzen",
  "hilfe",
] as const;

export function ApiInhalt() {
  const t = useTranslations("entwickler.inhalt");
  const [aktiv, setAktiv] = useState<string>(ABSCHNITTE[0]);

  useEffect(() => {
    const beobachter = new IntersectionObserver(
      (eintraege) => {
        // Der oberste sichtbare Abschnitt gewinnt. Ohne diese Sortierung
        // gewinnt der zuletzt gemeldete, und beim schnellen Scrollen springt
        // die Markierung.
        const sichtbar = eintraege
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (sichtbar[0]?.target.id) setAktiv(sichtbar[0].target.id);
      },
      // Oberer Rand bei 20 %: ein Abschnitt gilt als „hier", sobald seine
      // Überschrift im oberen Fünftel steht — nicht erst, wenn er die Mitte
      // erreicht.
      { rootMargin: "-20% 0px -70% 0px" },
    );
    for (const id of ABSCHNITTE) {
      const el = document.getElementById(id);
      if (el) beobachter.observe(el);
    }
    return () => beobachter.disconnect();
  }, []);

  return (
    <nav
      aria-label={t("titel")}
      className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur"
    >
      <div className="mx-auto max-w-7xl px-6">
        {/* Waagerecht scrollbar auf kleinen Geräten — sieben Punkte passen
            nicht auf ein Telefon, und Umbrechen würde die Leiste zu hoch
            machen. */}
        <ul className="flex gap-1 overflow-x-auto py-2 text-sm">
          {ABSCHNITTE.map((a) => (
            <li key={a}>
              <a
                href={`#${a}`}
                aria-current={aktiv === a ? "true" : undefined}
                className={
                  "block whitespace-nowrap rounded-full px-3.5 py-1.5 transition-colors " +
                  (aktiv === a
                    ? "bg-surface-accent font-medium text-accent"
                    : "text-muted-foreground hover:bg-surface-warm")
                }
              >
                {t(a)}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
