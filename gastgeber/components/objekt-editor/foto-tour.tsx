"use client";

// Fototour-Übersicht (Airbnb „Photo tour"): „Alle Fotos"/„+"-Buttons, Hinweis-
// text, Status-Leiste (Publish-Status) und Foto-Kacheln je Schlafzimmer +
// „Weitere Fotos". Klick auf eine Kachel meldet das Zimmer nach OBEN (an den
// Editor) — der Slide zur Zimmer-Detailansicht passiert auf Editor-Ebene, weil
// dort die ganze Ansicht (inkl. linker Spalte) ausgetauscht wird (wie Airbnb).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";

import type { Property } from "@/lib/properties";

import { KachelGross } from "./foto-kacheln";
import type { RaumKachel } from "./raum-detail";

export function FotoTour({
  property,
  raeume,
  fotoAnzahl,
  onOeffneRaum,
}: {
  property: Property;
  raeume: RaumKachel[];
  // Echte Anzahl aus property_photos (nicht der properties.photos-Spiegel).
  fotoAnzahl: number;
  onOeffneRaum: (id: string) => void;
}) {
  const t = useTranslations("objektEditor");
  const aktiv = property.status === "active";

  return (
    <section>
      {/* Kopf */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="max-w-lg">
          <h2 className="mb-2 font-sans text-[2rem] font-bold tracking-tight">
            {t("fotosTitel")}
          </h2>
          <p className="text-[0.9375rem] leading-relaxed text-muted-foreground">
            {t("fotosText")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => onOeffneRaum("weitere")}
            className="flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-muted"
          >
            <Icon icon="ph:squares-four" className="size-4" />
            {t("fotosAlle")}
          </button>
          <button
            type="button"
            aria-label={t("fotosHinzufuegen")}
            onClick={() => onOeffneRaum("weitere")}
            className="flex size-10 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-muted/70"
          >
            <Icon icon="ph:plus" className="size-5" />
          </button>
        </div>
      </div>

      {!aktiv && (
        <div className="mb-8 flex w-full items-center gap-3 rounded-2xl bg-muted/50 px-5 py-4 text-start">
          <span className="size-1.5 rounded-full bg-accent" />
          <span className="flex-1 text-sm font-medium">{t("aufgabenOffen")}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-6">
        {raeume.map((r) => (
          <KachelGross
            key={r.id}
            raum={r}
            untertitel={
              r.id === "weitere"
                ? t("fotosAnzahl", { n: fotoAnzahl })
                : r.bild
                  ? t("fotoGesetzt")
                  : t("fotosHinzufuegen")
            }
            onOeffne={() => onOeffneRaum(r.id)}
          />
        ))}
      </div>
    </section>
  );
}
