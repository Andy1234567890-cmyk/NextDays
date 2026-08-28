"use client";

// Medien-Slider (0451) und Vorher/Nachher (0451).
//
// Beide in einer Datei, weil beide dasselbe brauchen und sonst nichts: einen
// Zustand im Browser und einen Schieberegler. Sie teilen keine Komponente —
// das eine blättert, das andere blendet über.
//
// Was der Slider ABSICHTLICH anders macht als die meisten:
//   · Autoplay ist AUS, solange der Betrieb es nicht einschaltet. Ein Slider,
//     der weiterläuft, während jemand liest, ist die häufigste Beschwerde über
//     Slider überhaupt.
//   · Läuft er, hält er an, sobald der Zeiger darauf steht ODER der Fokus
//     hineinwandert — ein Nutzer, der sich mit der Tastatur durch die Knöpfe
//     bewegt, verliert sonst bei jedem Tick seine Position.
//   · `prefers-reduced-motion` schaltet ihn ganz ab. Das ist keine Kür: für
//     Menschen mit vestibulärer Störung ist eine Bewegung, die sie nicht
//     ausgelöst haben, körperlich unangenehm.
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { Icon } from "@iconify/react";

import { type EditierModus, NICHT_EDITIERBAR } from "@/lib/editier-kontext";
import { pickText } from "@/lib/i18n";
import { texte } from "@/lib/texte";

import { AbschnittLeer } from "./abschnitt-leer";
import { BildNachweis } from "./bildnachweis";

// =========================================================================
// Medien-Slider
// =========================================================================

type Folie = {
  bild: string | null;
  video: string | null;
  alt: string;
  titel: string;
  text: string;
  ctaText: string;
  ctaZiel: string | null;
};

export function SliderBlock({
  content,
  modus = NICHT_EDITIERBAR,
}: {
  content: Record<string, unknown>;
  modus?: EditierModus;
}) {
  const [aktiv, setAktiv] = useState(0);
  const [pausiert, setPausiert] = useState(false);

  const roh = Array.isArray(content.slides)
    ? (content.slides as Array<Record<string, unknown>>)
    : [];
  const folien: Folie[] = roh
    .map((f) => ({
      bild: typeof f.image_url === "string" ? f.image_url : null,
      video: typeof f.video_url === "string" ? f.video_url : null,
      alt: pickText(f.alt, modus.locale),
      titel: pickText(f.title, modus.locale).trim(),
      text: pickText(f.text, modus.locale).trim(),
      ctaText: pickText(f.cta_label, modus.locale).trim(),
      ctaZiel: typeof f.cta_href === "string" ? f.cta_href : null,
    }))
    // Eine Folie ganz ohne Medium und ohne Text ist eine leere Fläche im
    // Karussell — sie wird weggelassen, nicht als Lücke gezeigt.
    .filter((f) => f.bild || f.video || f.titel || f.text);

  const anzahl = folien.length;
  const takt =
    typeof content.autoplay_seconds === "number" &&
    content.autoplay_seconds >= 1 &&
    content.autoplay_seconds <= 20
      ? content.autoplay_seconds
      : 0;

  const weiter = useCallback(
    (schritt: number) =>
      setAktiv((i) => (anzahl ? (i + schritt + anzahl) % anzahl : 0)),
    [anzahl],
  );

  useEffect(() => {
    if (!takt || pausiert || anzahl < 2) return;
    // Wer „weniger Bewegung" eingestellt hat, bekommt keinen laufenden Slider.
    // Die Knöpfe bleiben — die Folien sind dann von Hand erreichbar.
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const timer = setInterval(() => weiter(1), takt * 1000);
    return () => clearInterval(timer);
  }, [takt, pausiert, anzahl, weiter]);

  const headline = pickText(content.headline, modus.locale);
  if (anzahl === 0) {
    return (
      <AbschnittLeer
        modus={modus}
        titel={headline || undefined}
        grund={texte(modus.locale).leerSlider}
      />
    );
  }

  const t = texte(modus.locale);
  const gewaehlt = Math.min(aktiv, anzahl - 1);
  const deckung =
    typeof content.overlay === "number" &&
    content.overlay >= 0 &&
    content.overlay <= 0.9
      ? content.overlay
      : 0.35;
  const ueberblenden = content.transition === "fade";
  // Der Pausen-Grund hängt am Betrieb: ohne Autoplay gibt es nichts anzuhalten,
  // und dann sollen die Handler auch nicht dranhängen.
  const pausenHandler =
    takt && content.pause_on_hover !== false
      ? {
          onMouseEnter: () => setPausiert(true),
          onMouseLeave: () => setPausiert(false),
          onFocus: () => setPausiert(true),
          onBlur: () => setPausiert(false),
        }
      : {};

  return (
    <section className="mx-auto max-w-6xl px-6 py-14">
      {headline ? (
        <h2 className="pb-6 font-display text-3xl font-extrabold tracking-tight">
          {headline}
        </h2>
      ) : null}
      <div
        className="relative overflow-hidden rounded-3xl bg-secondary"
        // `roledescription` sagt dem Screenreader, was das Ding IST — ohne sie
        // ist es eine Liste von Bildern, bei der jedes Mal etwas verschwindet.
        role="region"
        aria-roledescription="carousel"
        aria-label={headline || t.sliderNavigation}
        {...pausenHandler}
      >
        {folien.map((f, i) => (
          <div
            key={i}
            // Die aktive Folie steht im Fluss, die anderen liegen darüber und
            // sind ausgeblendet. Damit bestimmt die aktive die Höhe und der
            // Abschnitt springt beim Wechsel nicht.
            className={
              (i === gewaehlt
                ? "relative"
                : "pointer-events-none absolute inset-0") +
              (ueberblenden ? " transition-opacity duration-500" : "")
            }
            style={{ opacity: i === gewaehlt ? 1 : 0 }}
            aria-hidden={i !== gewaehlt}
          >
            <div className="relative aspect-[16/9] w-full">
              {f.video ? (
                // Stumm, in Schleife, ohne Bedienelemente: die Folie ist ein
                // Hintergrund. `playsInline` verhindert, dass iOS das Video in
                // den Vollbildmodus reißt.
                <video
                  src={f.video}
                  poster={f.bild ?? undefined}
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="size-full object-cover"
                />
              ) : f.bild ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={f.bild}
                  alt={f.alt}
                  loading={i === 0 ? "eager" : "lazy"}
                  className="size-full object-cover"
                />
              ) : null}
              {f.titel || f.text || f.ctaText ? (
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center text-white"
                  style={{ backgroundColor: `rgba(0,0,0,${deckung})` }}
                >
                  {f.titel ? (
                    <span className="font-display text-3xl font-extrabold md:text-4xl">
                      {f.titel}
                    </span>
                  ) : null}
                  {f.text ? (
                    <span className="max-w-2xl text-base md:text-lg">
                      {f.text}
                    </span>
                  ) : null}
                  {f.ctaText && f.ctaZiel ? (
                    <a
                      href={f.ctaZiel}
                      className="btn-marke mt-2 inline-flex bg-white px-6 py-3 text-sm font-semibold text-black"
                    >
                      {f.ctaText}
                    </a>
                  ) : null}
                </div>
              ) : null}
              {/* Pflicht-Nachweis der Stock-Quelle dieser Folie. Das Poster
                  eines Videos ist ebenfalls ein angezeigtes Bild — deshalb
                  `f.bild` und nicht nur der Bild-Fall. */}
              <BildNachweis src={f.bild} />
            </div>
          </div>
        ))}

        {anzahl > 1 ? (
          <>
            <button
              type="button"
              onClick={() => weiter(-1)}
              aria-label={t.sliderZurueck}
              className="absolute left-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white transition hover:bg-black/60"
            >
              <Icon icon="ph:caret-left" className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => weiter(1)}
              aria-label={t.sliderWeiter}
              className="absolute right-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white transition hover:bg-black/60"
            >
              <Icon icon="ph:caret-right" className="size-5" />
            </button>
            <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2">
              {folien.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setAktiv(i)}
                  aria-label={t.sliderFolie.replace("{n}", String(i + 1))}
                  aria-current={i === gewaehlt}
                  className={
                    "size-2.5 rounded-full transition " +
                    (i === gewaehlt ? "bg-white" : "bg-white/40")
                  }
                />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}

// =========================================================================
// Vorher / Nachher
// =========================================================================

export function VorherNachherBlock({
  content,
  modus = NICHT_EDITIERBAR,
}: {
  content: Record<string, unknown>;
  modus?: EditierModus;
}) {
  const reglerId = useId();
  const [pos, setPos] = useState(50);
  const rahmen = useRef<HTMLDivElement>(null);

  const vorher = typeof content.before_url === "string" ? content.before_url : null;
  const nachher = typeof content.after_url === "string" ? content.after_url : null;
  const headline = pickText(content.headline, modus.locale);

  if (!vorher || !nachher) {
    return (
      <AbschnittLeer
        modus={modus}
        titel={headline || undefined}
        grund={texte(modus.locale).leerVorherNachher}
      />
    );
  }

  const t = texte(modus.locale);
  const vorherText = pickText(content.before_label, modus.locale) || t.vorher;
  const nachherText = pickText(content.after_label, modus.locale) || t.nachher;

  return (
    <section className="mx-auto max-w-4xl px-6 py-14">
      {headline ? (
        <h2 className="pb-6 font-display text-3xl font-extrabold tracking-tight">
          {headline}
        </h2>
      ) : null}
      <div
        ref={rahmen}
        className="relative aspect-[4/3] w-full select-none overflow-hidden rounded-3xl"
      >
        {/* Das NACHHER-Bild liegt unten und ist immer ganz da; das VORHER-Bild
            liegt darüber und wird beschnitten. Andersherum müsste beim Ziehen
            das untere Bild wachsen, und der Beschnitt sähe wie ein Ruckeln aus. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={nachher}
          alt={pickText(content.after_alt, modus.locale)}
          loading="lazy"
          className="absolute inset-0 size-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={vorher}
            alt={pickText(content.before_alt, modus.locale)}
            loading="lazy"
            className="size-full object-cover"
          />
        </div>

        <span className="absolute left-3 top-3 rounded-full bg-black/55 px-3 py-1 text-xs font-semibold text-white">
          {vorherText}
        </span>
        <span className="absolute right-3 top-3 rounded-full bg-black/55 px-3 py-1 text-xs font-semibold text-white">
          {nachherText}
        </span>

        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow"
          style={{ left: `${pos}%` }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute top-1/2 flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-black shadow"
          style={{ left: `${pos}%` }}
        >
          <Icon icon="ph:arrows-left-right" className="size-5" />
        </span>

        {/* Ein echter `<input type="range">` statt eigener Zieh-Logik: er
            bringt Tastaturbedienung (Pfeiltasten, Pos1/Ende), die Ansage des
            Wertes und die Bedienung per Touch mit. Er ist unsichtbar über das
            ganze Bild gelegt — was man greift, ist das Bild, was der Browser
            bedient, ist ein Regler. */}
        <label htmlFor={reglerId} className="sr-only">
          {t.vorherNachherRegler}
        </label>
        <input
          id={reglerId}
          type="range"
          min={0}
          max={100}
          value={pos}
          onChange={(e) => setPos(Number(e.target.value))}
          className="absolute inset-0 size-full cursor-ew-resize opacity-0"
        />
      </div>
      {/* Beide Bilder koennen aus einer Stock-Quelle stammen, also braucht jedes
          seinen eigenen Nachweis. UNTER dem Rahmen und nicht darin: im Rahmen
          liegt der Regler ueber der ganzen Flaeche, ein Link darunter waere
          nicht anklickbar. */}
      <BildNachweis src={vorher} variante="zeile" />
      <BildNachweis src={nachher} variante="zeile" />
    </section>
  );
}
