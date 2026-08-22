"use client";

// Rechte Spalte der Leitfaden-Seiten: „Auf dieser Seite".
//
// Referenz-UX: docs.lodgify.com (ReadMe.io) setzt rechts eine dritte Spalte mit
// dem Inhaltsverzeichnis der offenen Seite und hebt den Abschnitt hervor, in dem
// man gerade liest. Ohne sie ist ein Doku-Layout rechts leer — und genau so sah
// es hier aus.
//
// Die Überschriften werden aus dem DOM gelesen, nicht je Kapitel gepflegt: ein
// neuer Abschnitt in einer der `api-*`-Komponenten erscheint damit von selbst.
// Eine zweite, handgeführte Liste würde beim ersten Umbau still veralten.
import { useEffect, useState } from "react";

type Eintrag = { id: string; text: string };

export function DokuToc({ titel }: { titel: string }) {
  const [eintraege, setEintraege] = useState<Eintrag[]>([]);
  const [aktiv, setAktiv] = useState<string>("");

  useEffect(() => {
    const abschnitte = Array.from(
      document.querySelectorAll<HTMLElement>("main section[id]"),
    );
    setEintraege(
      abschnitte
        .map((a) => ({
          id: a.id,
          text: a.querySelector("h2")?.textContent?.trim() ?? "",
        }))
        .filter((e) => e.text),
    );

    // Scroll-Spy: der oberste Abschnitt, der noch im Blickfeld liegt, gilt als
    // der gelesene. `rootMargin` oben entspricht der Höhe der Kopfzeile.
    const beobachter = new IntersectionObserver(
      (eintritte) => {
        const sichtbar = eintritte
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (sichtbar[0]) setAktiv(sichtbar[0].target.id);
      },
      { rootMargin: "-72px 0px -70% 0px" },
    );
    abschnitte.forEach((a) => beobachter.observe(a));
    return () => beobachter.disconnect();
  }, []);

  if (eintraege.length < 2) return null;

  return (
    <nav
      aria-label={titel}
      className="hidden xl:sticky xl:top-20 xl:block xl:self-start"
    >
      <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
        {titel}
      </p>
      <ul className="mt-3 space-y-1 border-l border-border">
        {eintraege.map((e) => (
          <li key={e.id}>
            <a
              href={`#${e.id}`}
              aria-current={aktiv === e.id ? "true" : undefined}
              className={
                "-ml-px block border-l py-1 pl-3 text-sm transition-colors " +
                (aktiv === e.id
                  ? "border-accent font-medium text-accent"
                  : "border-transparent text-muted-foreground hover:text-foreground")
              }
            >
              {e.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
