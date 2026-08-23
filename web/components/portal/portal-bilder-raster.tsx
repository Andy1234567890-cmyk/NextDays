"use client";

// Eigentümer-Portal · Bilder-Raster mit Vergrößern (read-only).
//
// WARUM EINE EIGENE ANSICHT UND NICHT `components/objekte/photos-manager.tsx`:
// Der PM-Fotoverwalter ist eine Schreibfläche — Hochladen, Sortieren (Drag &
// Drop → `reorderPhotos`), Titelbild setzen, Bildunterschrift ändern, Löschen.
// Ohne diese Wege bleibt von ihm nichts übrig als das Raster selbst; ihn mit
// abgeschalteten Knöpfen einzubinden hieße, den kompletten Schreibpfad in eine
// Fläche zu holen, die keinen haben darf (Wurzel 3). Deshalb hier ein eigenes,
// rein darstellendes Raster.
//
// Geteilte Grundlage für den Bilder-Abschnitt im Objektbereich UND das
// Fotoalbum: dieselbe Darstellung, damit ein Bild an beiden Stellen gleich
// aussieht und die Lightbox nur einmal existiert.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@nextdays/ui/dialog";
import type { PortalImage } from "@/lib/portal";

/**
 * Bildunterschrift in der Anzeigesprache.
 *
 * Reihenfolge: eigene Sprache → Englisch → irgendeine hinterlegte. Der letzte
 * Schritt ist kein erfundener Ersatzwert (Wurzel 4), sondern echter Text des
 * Betriebs; eine vorhandene Unterschrift zu verschweigen, nur weil sie in einer
 * anderen Sprache steht, wäre der schlechtere Tausch. Gar keine Unterschrift
 * bleibt `null` — es wird keine aus dem Dateinamen gebastelt.
 */
function bildunterschrift(
  caption: Record<string, string>,
  locale: string,
): string | null {
  const eigene = caption[locale];
  if (eigene && eigene.trim() !== "") return eigene;
  const en = caption.en;
  if (en && en.trim() !== "") return en;
  const erste = Object.values(caption).find((v) => v && v.trim() !== "");
  return erste ?? null;
}

export function PortalBilderRaster({
  bilder,
  titel,
}: {
  bilder: PortalImage[];
  /** Objekttitel — Grundlage des Alternativtexts, wenn keine Unterschrift
   *  hinterlegt ist. */
  titel: string;
}) {
  const t = useTranslations("portal.photoAlbum");
  const locale = useLocale();
  // Index des vergrößerten Bildes; null = Lightbox zu.
  const [offen, setOffen] = useState<number | null>(null);

  const weiter = useCallback(
    (richtung: 1 | -1) =>
      setOffen((i) =>
        i === null || bilder.length === 0
          ? i
          : (i + richtung + bilder.length) % bilder.length,
      ),
    [bilder.length],
  );

  // Pfeiltasten in der Lightbox. Der Listener hängt nur, solange sie offen ist.
  useEffect(() => {
    if (offen === null) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") weiter(1);
      if (e.key === "ArrowLeft") weiter(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [offen, weiter]);

  const aktiv = offen === null ? null : (bilder[offen] ?? null);
  const aktivText = aktiv ? bildunterschrift(aktiv.caption, locale) : null;

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {bilder.map((bild, index) => {
          const text = bildunterschrift(bild.caption, locale);
          return (
            <li key={bild.id}>
              <button
                type="button"
                onClick={() => setOffen(index)}
                className="group relative block w-full overflow-hidden rounded-(--radius) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={t("open")}
              >
                {/* <img>, weil die URL aus dem Storage kommt und keine feste
                    Domänenliste hat (wie überall sonst im Portal). */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={bild.url}
                  alt={text ?? titel}
                  loading="lazy"
                  className="aspect-4/3 w-full object-cover transition-transform group-hover:scale-105"
                />
                {bild.is_cover && (
                  <span className="absolute left-2 top-2 rounded-full bg-background/90 px-2 py-0.5 text-[0.625rem] font-medium">
                    {t("cover")}
                  </span>
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-transparent transition-colors group-hover:bg-black/30 group-hover:text-white">
                  <Icon icon="ph:magnifying-glass-plus" className="size-6" />
                </span>
              </button>
              {text && (
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {text}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <Dialog
        open={offen !== null}
        onOpenChange={(o) => {
          if (!o) setOffen(null);
        }}
      >
        <DialogContent className="max-w-4xl gap-3">
          {/* Radix verlangt einen Titel; sichtbar ist er als Bildunterschrift. */}
          <DialogTitle className="pr-8 text-base font-semibold">
            {aktivText ?? titel}
          </DialogTitle>
          {aktiv && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={aktiv.url}
              alt={aktivText ?? titel}
              className="max-h-[70dvh] w-full rounded-(--radius) object-contain"
            />
          )}
          {bilder.length > 1 && (
            <div className="flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => weiter(-1)}
                aria-label={t("previous")}
                className="flex size-9 items-center justify-center rounded-full bg-secondary text-secondary-foreground transition-colors hover:bg-secondary/80"
              >
                <Icon icon="ph:caret-left" className="size-5" />
              </button>
              <span className="text-xs text-muted-foreground">
                {t("position", {
                  index: (offen ?? 0) + 1,
                  total: bilder.length,
                })}
              </span>
              <button
                type="button"
                onClick={() => weiter(1)}
                aria-label={t("next")}
                className="flex size-9 items-center justify-center rounded-full bg-secondary text-secondary-foreground transition-colors hover:bg-secondary/80"
              >
                <Icon icon="ph:caret-right" className="size-5" />
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
