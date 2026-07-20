// Themen-Reihe für die Suchseite — Überschrift + horizontal scrollbares Band
// aus Inserat-Karten + Pfeil-Buttons + "Alle anzeigen". Portiert aus plattform/.
"use client";

import { Icon } from "@iconify/react";
import Link from "next/link";
import { useRef } from "react";

import { type Reihe } from "./_fixtures";
import { ListingCard } from "./listing-card";
import { PhotoPlaceholder } from "./photo-placeholder";

export function ListingReihe({ reihe }: { reihe: Reihe }) {
  const bandRef = useRef<HTMLDivElement>(null);
  const stapel = reihe.listings.slice(0, 3);

  function scroll(richtung: -1 | 1) {
    const el = bandRef.current;
    if (!el) return;
    el.scrollBy({ left: richtung * el.clientWidth * 0.8, behavior: "smooth" });
  }

  return (
    <section className="group/reihe py-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold tracking-tight">
          {reihe.titel}
        </h2>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-1 opacity-0 transition-opacity group-hover/reihe:opacity-100 md:flex">
            <button
              type="button"
              aria-label="Zurück"
              onClick={() => scroll(-1)}
              className="flex size-8 items-center justify-center rounded-full border border-border bg-card shadow-sm hover:bg-secondary"
            >
              <Icon icon="ph:caret-left" className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Weiter"
              onClick={() => scroll(1)}
              className="flex size-8 items-center justify-center rounded-full border border-border bg-card shadow-sm hover:bg-secondary"
            >
              <Icon icon="ph:caret-right" className="size-4" />
            </button>
          </div>
        </div>
      </div>

      <div
        ref={bandRef}
        className="-mx-6 flex snap-x gap-5 overflow-x-auto scroll-px-6 px-6 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {reihe.listings.map((listing) => (
          <div key={listing.id} className="w-60 shrink-0 snap-start">
            <ListingCard listing={listing} />
          </div>
        ))}

        <Link
          href="#"
          className="group/alle flex w-60 shrink-0 snap-start flex-col gap-3"
        >
          <div className="flex aspect-square flex-col items-center justify-center gap-6 overflow-hidden rounded-2xl border border-border bg-secondary">
            <div className="flex items-end justify-center">
              {stapel[0] && (
                <PhotoPlaceholder
                  hue={stapel[0].hue}
                  className="size-16 -rotate-6 rounded-xl border-2 border-card shadow-md"
                />
              )}
              {stapel[1] && (
                <PhotoPlaceholder
                  hue={stapel[1].hue}
                  className="-mx-3 size-20 rounded-xl border-2 border-card shadow-md transition-transform group-hover/alle:scale-105"
                />
              )}
              {stapel[2] && (
                <PhotoPlaceholder
                  hue={stapel[2].hue}
                  className="size-16 rotate-6 rounded-xl border-2 border-card shadow-md"
                />
              )}
            </div>
            <span className="font-semibold">Alle anzeigen</span>
          </div>
        </Link>

        <div className="w-2 shrink-0" aria-hidden />
      </div>
    </section>
  );
}
