"use client";

// Zielgruppen — die zehn Unterkunftsarten als gestapelte Scroll-Karten.
//
// Referenz-UX: st-sicherheitsdienst.de, Abschnitt „Ablauf unserer
// Zusammenarbeit" (deren `/scripts/process-stack.js`, ausgelesen 14.08.2026).
// Übernommen ist der Rechenweg, nicht das Skript:
//   • Eine Hülle bekommt die Höhe (n − 1) · Fensterhöhe + Kartenhöhe.
//   • Darin klebt ein `sticky`-Block, alle Karten liegen deckungsgleich
//     (`absolute inset-0`) übereinander.
//   • Fortschritt sp = −wrap.top / Fensterhöhe. Karte i fährt für sp < i von
//     unten herein (translateY 110 % → 0) und wandert danach als Stapel je
//     Tiefenstufe um STAPEL_VERSATZ nach oben, dabei minimal kleiner.
//   • Links leuchtet genau die Nummer der aktiven Karte (round(sp)).
//
// Unter der lg-Grenze läuft KEIN Stapel: neun Bildschirmhöhen Blindscroll sind
// auf einem Handy kein Effekt, sondern eine Sperre. Dort steht dieselbe Liste
// als gewöhnliche Karten untereinander.
//
// Bilder: ein kuratiertes Stockfoto je Unterkunftsart aus
// marketing/public/marketing/zielgruppen (Herkunft und Lizenz im `manifest.json`
// daneben, geladen von scripts/marketing/zielgruppen_fotos.py). KEINE Fotos aus
// Kundenbeständen — fremde Objektfotos und Gäste haben auf einer Verkaufsseite
// ohne Einwilligung nichts zu suchen. Aufnahmen der Software stehen in der
// Sektion „Einblicke", wo sie ganze Breite haben; auf halber Kartenbreite wäre
// eine 1600er-Oberfläche nur ein grauer Fleck.
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import { TYPE_ICONS } from "@/components/marketing/property-type-icons";
import { SectionHeading } from "@/components/marketing/section-kit";

// Reihenfolge der Karten. Der Schlüssel ist gleichzeitig Dateiname des Fotos
// (`<key>.webp`) und Übersetzungsschlüssel (`intro.typen.<key>`).
const TYPEN = [
  "hotel",
  "bnb",
  "gaestehaus",
  "motel",
  "lodge",
  "ferienwohnung",
  "resort",
  "huette",
  "pension",
  "campingplatz",
] as const;

// Stapel-Kennwerte der Referenz: 18 px Versatz und 1,8 % Verkleinerung je
// Tiefenstufe. In rem, damit der Stapel mit der Schriftgröße mitwächst.
const STAPEL_VERSATZ_REM = 1.125;
const STAPEL_SKALIERUNG = 0.018;
// Ab dieser Breite (Tailwind `lg`) läuft der Stapel — darunter die Liste.
const STAPEL_AB = "(min-width: 64rem)";

/** Hängt den Stapel an Scroll und Resize; gibt die Abmeldung zurück.
 *
 * Steht außerhalb der Komponente, weil hier nur DOM gerechnet wird — und weil
 * die Elemente so einmal geprüft hereinkommen statt in jeder inneren Funktion. */
function stapelBinden(
  huelle: HTMLDivElement,
  klebe: HTMLDivElement,
  karten: (HTMLLIElement | null)[],
  aktivSetzen: (index: number) => void,
): () => void {
  const anzahl = TYPEN.length;
  let rahmen = 0;
  let beendet = false;

  const stapelLaeuft = () => window.matchMedia(STAPEL_AB).matches;

  /** Ohne Stapel dürfen keine Reste stehen bleiben (Resize aufs Handy-Maß). */
  function zuruecksetzen() {
    huelle.style.height = "";
    for (const karte of karten) {
      if (karte) {
        karte.style.transform = "";
        karte.style.zIndex = "";
      }
    }
  }

  /* Die Scrollstrecke ist echte Layout-Rechnung, nicht Gestaltung: eine
     Fensterhöhe je Karte plus die Höhe der klebenden Karte selbst. */
  function hoeheSetzen() {
    if (!stapelLaeuft()) {
      zuruecksetzen();
      return;
    }
    huelle.style.height = `${(anzahl - 1) * window.innerHeight + klebe.offsetHeight}px`;
  }

  function zeichnen() {
    if (beendet || !stapelLaeuft()) {
      return;
    }
    const stufe = window.innerHeight;
    const strecke = (anzahl - 1) * stufe;
    if (strecke <= 0) {
      return;
    }
    const gescrollt = Math.min(Math.max(-huelle.getBoundingClientRect().top, 0), strecke);
    const sp = gescrollt / stufe;

    karten.forEach((karte, index) => {
      if (!karte) {
        return;
      }
      const lokal = sp - index;
      if (lokal <= 0) {
        // Noch im Anmarsch: von 110 % unterhalb auf 0 hereinfahren.
        const y = (1 - Math.min(Math.max(lokal + 1, 0), 1)) * 110;
        karte.style.transform = `translate3d(0, ${y}%, 0)`;
      } else {
        const tiefe = Math.min(lokal, anzahl);
        karte.style.transform =
          `translate3d(0, ${-tiefe * STAPEL_VERSATZ_REM}rem, 0)` +
          ` scale(${1 - tiefe * STAPEL_SKALIERUNG})`;
      }
      karte.style.zIndex = String(index + 1);
    });

    aktivSetzen(Math.min(Math.max(Math.round(sp), 0), anzahl - 1));
  }

  function beiScroll() {
    if (rahmen || beendet) {
      return;
    }
    rahmen = window.requestAnimationFrame(() => {
      zeichnen();
      rahmen = 0;
    });
  }

  function beiResize() {
    hoeheSetzen();
    beiScroll();
  }

  hoeheSetzen();
  zeichnen();
  window.addEventListener("scroll", beiScroll, { passive: true });
  window.addEventListener("resize", beiResize);

  return () => {
    beendet = true;
    window.removeEventListener("scroll", beiScroll);
    window.removeEventListener("resize", beiResize);
    if (rahmen) {
      window.cancelAnimationFrame(rahmen);
    }
    zuruecksetzen();
  };
}

/** Inhalt einer Karte — im Stapel und in der Liste identisch. */
function KartenInhalt({ typKey }: { typKey: string }) {
  const t = useTranslations("zielgruppen");
  const tIntro = useTranslations("intro");
  const TypIcon = TYPE_ICONS[typKey as keyof typeof TYPE_ICONS];
  const name = tIntro(`typen.${typKey}`);

  return (
    <div className="grid h-full items-center gap-6 md:grid-cols-2">
      <div className="flex flex-col">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-surface-accent text-accent">
          <TypIcon className="size-7" />
        </span>
        <h3 className="mt-4 font-display text-2xl font-semibold tracking-tight">{name}</h3>
        {/* Keyword-Zeile: was jemand sucht, der diese Unterkunftsart betreibt.
            Steht als Text im Markup, nicht im Bild — sonst findet sie keine
            Suchmaschine. */}
        <p className="mt-1 text-sm font-medium text-accent">{t(`typen.${typKey}.unterzeile`)}</p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {t(`typen.${typKey}.text`)}
        </p>
        <span className="mt-5 flex items-center gap-2.5">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <svg viewBox="0 0 24 24" className="size-3" aria-hidden>
              <path
                d="m5 13 4 4L19 7"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="text-sm font-medium">{t(`typen.${typKey}.beleg`)}</span>
        </span>
      </div>
      {/* Die Mindesthöhe gilt der Liste unter lg, wo die Karte keine feste
          Höhe hat und `h-full` deshalb nichts zu füllen hätte. */}
      <div className="relative h-full min-h-56 overflow-hidden rounded-2xl">
        <Image
          src={`/marketing/zielgruppen/${typKey}.webp`}
          alt={t("bildAlt", { typ: name })}
          fill
          sizes="(min-width: 1024px) 480px, 100vw"
          className="object-cover"
        />
      </div>
    </div>
  );
}

export function MarketingZielgruppen() {
  const t = useTranslations("zielgruppen");
  const tIntro = useTranslations("intro");

  const huelleRef = useRef<HTMLDivElement>(null);
  const klebeRef = useRef<HTMLDivElement>(null);
  const kartenRef = useRef<(HTMLLIElement | null)[]>([]);
  const [aktiv, setAktiv] = useState(0);

  const kartenRefSetzen = useCallback(
    (index: number) => (element: HTMLLIElement | null) => {
      kartenRef.current[index] = element;
    },
    [],
  );

  useEffect(() => {
    const huelle = huelleRef.current;
    const klebe = klebeRef.current;
    // Unter lg steht die Liste statt des Stapels — dann gibt es die Hülle nicht.
    if (!huelle || !klebe) {
      return undefined;
    }
    return stapelBinden(huelle, klebe, kartenRef.current, setAktiv);
  }, []);

  return (
    <section id="zielgruppen" className="scroll-mt-24 bg-background">
      <div className="mx-auto max-w-7xl px-6 pt-16 pb-24">
        <SectionHeading eyebrow={tIntro("typenEyebrow")} heading={tIntro("reichweite")} />

        {/* Stapel — nur ab lg. */}
        <div ref={huelleRef} className="relative mt-14 hidden lg:block">
          {/* Der Klebeabstand liegt unter der Navigationsleiste (h-18) plus Luft,
              damit die Kanten der schon durchgelaufenen Karten oben als Stapel
              sichtbar bleiben und nicht hinter der Leiste verschwinden. */}
          <div ref={klebeRef} className="sticky top-32">
            <div className="grid grid-cols-[8.75rem_1fr] gap-8">
              {/* Nummernspalte: sichtbar ist immer nur die aktive Zahl. */}
              <div className="relative h-136">
                {TYPEN.map((typ, index) => (
                  <div
                    key={typ}
                    aria-hidden
                    className={
                      "absolute top-6 right-0 flex w-16 flex-col items-center transition-opacity duration-300 ease-out " +
                      (index === aktiv ? "opacity-100" : "opacity-0")
                    }
                  >
                    <span className="font-display text-4xl leading-none">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="mt-3 flex size-10 items-center justify-center rounded-full bg-accent">
                      <span className="size-2 rounded-full bg-accent-foreground" />
                    </span>
                  </div>
                ))}
              </div>

              <ol className="relative h-136">
                {TYPEN.map((typ, index) => (
                  <li
                    key={typ}
                    ref={kartenRefSetzen(index)}
                    className="absolute inset-0 overflow-hidden rounded-3xl bg-surface-warm p-7 shadow-card ring-1 ring-border will-change-transform"
                  >
                    <KartenInhalt typKey={typ} />
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>

        {/* Liste — unter lg, ohne Stapel und ohne Scroll-Rechnung. */}
        <ol className="mt-10 flex flex-col gap-4 lg:hidden">
          {TYPEN.map((typ) => (
            <li
              key={typ}
              className="overflow-hidden rounded-3xl bg-surface-warm p-6 shadow-card ring-1 ring-border"
            >
              <KartenInhalt typKey={typ} />
            </li>
          ))}
        </ol>

        <p className="mt-10 text-center text-muted-foreground">{t("abschluss")}</p>
      </div>
    </section>
  );
}
