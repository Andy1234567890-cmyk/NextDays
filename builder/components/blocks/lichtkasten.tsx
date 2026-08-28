"use client";

// Die Lightbox — ein Bild groß, mit Blättern (0474).
//
// WARUM SIE JETZT EIGENSTÄNDIG IST
// Sie steckte im Galerie-Baustein (`galerie.tsx`, 0087/0451) und war dort
// festverdrahtet. Die Objektseite braucht dieselbe: ihr Fotoraster zeigt fünf
// Bilder, ein Objekt hat aber oft zwanzig — ohne Weg zu den übrigen fehlt der
// halbe Eindruck, und genau das ist die häufigste Handlung eines Gastes auf
// einer Objektseite („alle Fotos ansehen").
//
// Eine zweite Fassung daneben wäre die Doppelung, gegen die Wurzel 2 steht: die
// erste, die bei einem Fehler niemand mehr findet. Deshalb EINE Komponente,
// zwei Verwender.
//
// WAS SIE MITBRINGT — und was in einer schnell gebauten Lightbox meist fehlt
//   · `<dialog>` statt eines eigenen Overlays: der Browser übernimmt
//     Fokus-Falle, Escape und die Ebene über allem.
//   · `onClose` (nicht nur der X-Knopf): sonst bliebe der Zustand nach Escape
//     gesetzt, und dasselbe Bild ließe sich nicht wieder öffnen.
//   · Klick auf den Hintergrund schließt, Klick auf das Bild nicht.
//   · Pfeiltasten blättern, ringförmig.
//   · Der Bildnachweis wandert mit — er hängt am BILD, nicht an der Kachel.
import { Icon } from "@iconify/react";
import { useEffect, useRef } from "react";

import { texte } from "@/lib/texte";

import { BildNachweis } from "./bildnachweis";

export type LichtkastenBild = {
  url: string;
  alt: string;
  titel?: string | null;
  text?: string | null;
};

export function Lichtkasten({
  bilder,
  offen,
  onOffen,
  sprache,
}: {
  bilder: LichtkastenBild[];
  /** Index des gezeigten Bildes, oder `null` = geschlossen. */
  offen: number | null;
  onOffen: (i: number | null) => void;
  sprache: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const t = texte(sprache);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (offen !== null && !d.open) d.showModal();
    if (offen === null && d.open) d.close();
  }, [offen]);

  function blaettern(schritt: number) {
    onOffen(
      offen === null
        ? null
        : (offen + schritt + bilder.length) % bilder.length,
    );
  }

  const aktuell = offen === null ? null : bilder[offen];

  return (
    <dialog
      ref={dialog}
      // `onClose` fängt auch Escape ab — sonst bliebe `offen` gesetzt und der
      // Dialog ließe sich beim nächsten Klick auf DASSELBE Bild nicht mehr
      // öffnen (`showModal` auf einen bereits „offenen" Zustand).
      onClose={() => onOffen(null)}
      onClick={(e) => {
        // Klick auf den Hintergrund schließt. Der Vergleich mit
        // `currentTarget` unterscheidet ihn vom Klick auf den Inhalt —
        // `<dialog>` selbst ist die Fläche hinter dem Bild.
        if (e.target === e.currentTarget) onOffen(null);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") blaettern(1);
        if (e.key === "ArrowLeft") blaettern(-1);
      }}
      className="m-auto max-h-[90dvh] max-w-[92vw] bg-transparent p-0 backdrop:bg-black/80"
    >
      {aktuell ? (
        <figure className="relative flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={aktuell.url}
            alt={aktuell.alt}
            className="max-h-[78dvh] w-auto rounded-2xl object-contain"
          />
          {aktuell.titel || aktuell.text ? (
            <figcaption className="max-w-2xl px-4 text-center text-sm text-white">
              {aktuell.titel ? (
                <span className="block font-semibold">{aktuell.titel}</span>
              ) : null}
              {aktuell.text ? <span>{aktuell.text}</span> : null}
            </figcaption>
          ) : null}
          {/* Auf schwarzem Grund ist die dunkle Pille mit weißer Schrift
              lesbar, eine geerbte Textfarbe wäre es nicht. */}
          <BildNachweis src={aktuell.url} variante="pille" />
          <div className="flex items-center gap-2 pb-2">
            {bilder.length > 1 ? (
              <button
                type="button"
                onClick={() => blaettern(-1)}
                aria-label={t.galerieZurueck}
                className="flex size-10 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/30"
              >
                <Icon icon="ph:caret-left" className="size-5" />
              </button>
            ) : null}
            {/* Die Zählung („3 / 20") steht zwischen den Pfeilen und nicht am
                Bildrand: bei zwanzig Fotos ist die wichtigste Frage, wie weit
                man ist. Bei einem einzelnen Bild entfällt sie. */}
            {bilder.length > 1 ? (
              <span className="min-w-16 text-center text-sm text-white">
                {(offen ?? 0) + 1} / {bilder.length}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => onOffen(null)}
              aria-label={t.popupSchliessen}
              className="flex size-10 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/30"
            >
              <Icon icon="ph:x" className="size-5" />
            </button>
            {bilder.length > 1 ? (
              <button
                type="button"
                onClick={() => blaettern(1)}
                aria-label={t.galerieWeiter}
                className="flex size-10 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/30"
              >
                <Icon icon="ph:caret-right" className="size-5" />
              </button>
            ) : null}
          </div>
        </figure>
      ) : null}
    </dialog>
  );
}
