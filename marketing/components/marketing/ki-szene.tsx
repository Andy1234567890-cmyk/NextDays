// Die Produkt-Szene der KI-Sektion: Foto mit Sprechblasen, die nacheinander
// erscheinen — Frage, Tipp-Punkte, Antwort — und danach leicht schweben.
//
// Warum animiert: eine statische Blase liest sich wie ein Screenshot. Der
// zeitliche Ablauf (fragen → es tippt → Antwort) zeigt in zwei Sekunden, was
// die Funktion tut. Gestartet wird erst, wenn die Sektion wirklich im Bild ist
// — sonst ist die Vorstellung vorbei, bevor jemand hinsieht.
//
// `prefers-reduced-motion` schaltet Bewegung ab (globals.css); die Schritte
// laufen dann sofort durch, es fehlt niemandem Inhalt.
"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";

import { Icon } from "@/components/ui/icon";

// Ablauf in Millisekunden ab dem Sichtbarwerden.
const T_FRAGE = 400;
const T_TIPPEN = 1100;
const T_ANTWORT = 2600;

export function KiSzene() {
  const t = useTranslations("ki");
  const wurzelRef = useRef<HTMLDivElement>(null);
  const [schritt, setSchritt] = useState<0 | 1 | 2 | 3>(0);

  useEffect(() => {
    const el = wurzelRef.current;
    if (!el) return undefined;

    const timer: number[] = [];
    const starten = () => {
      timer.push(window.setTimeout(() => setSchritt(1), T_FRAGE));
      timer.push(window.setTimeout(() => setSchritt(2), T_TIPPEN));
      timer.push(window.setTimeout(() => setSchritt(3), T_ANTWORT));
    };

    const beobachter = new IntersectionObserver(
      (eintraege) => {
        if (eintraege.some((e) => e.isIntersecting)) {
          starten();
          beobachter.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    beobachter.observe(el);

    return () => {
      beobachter.disconnect();
      timer.forEach(window.clearTimeout);
    };
  }, []);

  return (
    <div ref={wurzelRef} className="relative mx-auto w-full max-w-md">
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-3xl bg-surface-accent shadow-float-lg">
        <Image
          src="/marketing/usecases/ki-nutzung.jpg"
          alt=""
          fill
          loading="eager"
          sizes="(min-width: 1024px) 28rem, 100vw"
          className="object-cover"
        />
      </div>

      {/* Frage der Vermieterin */}
      {schritt >= 1 ? (
        <div className="bubble-in absolute -left-4 top-10 max-w-[15rem] rounded-2xl rounded-bl-sm bg-card px-4 py-3 text-sm shadow-float sm:-left-10">
          {t("blaseFrage")}
        </div>
      ) : null}

      {/* Antwort — davor kurz die Tipp-Punkte an derselben Stelle, damit die
          Blase nicht aus dem Nichts aufpoppt. */}
      {schritt === 2 ? (
        <div className="bubble-in-slow absolute -right-4 top-1/3 flex items-center gap-1.5 rounded-2xl rounded-br-sm bg-card px-4 py-3.5 shadow-float sm:-right-10">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="typing-dot size-1.5 rounded-full bg-accent"
              style={{ animationDelay: `${i * 0.18}s` }}
            />
          ))}
        </div>
      ) : null}

      {schritt >= 3 ? (
        <div className="bubble-in-slow absolute -right-4 top-1/3 max-w-[16rem] rounded-2xl rounded-br-sm bg-card px-4 py-3 text-sm shadow-float sm:-right-10">
          <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-accent">
            <Icon icon="ph:sparkle" className="size-3.5" />
            myNextDays
          </span>
          {t("blaseAntwort")}
        </div>
      ) : null}

      {/* Eingabefeld mit Mikrofon */}
      <div className="absolute -bottom-6 left-1/2 flex w-[19rem] max-w-[calc(100%+2rem)] -translate-x-1/2 items-center gap-3 rounded-full bg-card px-5 py-3 shadow-float">
        <span className="flex-1 truncate text-sm text-muted-foreground">
          {t("eingabe")}
        </span>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Icon icon="ph:microphone" className="size-4" />
        </span>
      </div>
    </div>
  );
}
