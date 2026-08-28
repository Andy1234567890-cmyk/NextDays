"use client";

// Die Mediathek als PANEL — mit echten Vorschaubildern.
//
// Vorher stand hier ein Satz und ein Knopf „Zur Mediathek". Das war ein
// Verweis, keine Mediathek: man sah nicht, welche Bilder es gibt, und der Klick
// führte aus dem Editor heraus. Bei Hostaway zeigt das Medien-Panel die Bilder
// als Kacheln und legt sie per Ziehen auf die Fläche.
//
// Ein Klick auf ein Bild legt einen BILD-Baustein mit genau diesem Bild an —
// zwei Handgriffe weniger als „Baustein einfügen, dann Bild wählen".
//
// Der Bestand wird hier nur GELESEN. Pflegen (umbenennen, in Ordner
// verschieben, löschen) bleibt im Mediathek-Dialog: zwei Schreibwege auf
// denselben Bestand wären die Doppelung, gegen die Wurzel 2 steht.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { type Medium, listMedia } from "@/lib/site-pages";

export function MedienPanel({
  onBild,
  onZiehen,
  deaktiviert = false,
}: {
  /** Ein Bild wurde gewählt — der Aufrufer legt daraus einen Baustein an. */
  onBild: (url: string) => void;
  /** Ein Bild wird gezogen (Adresse) bzw. losgelassen (`null`). */
  onZiehen?: (url: string | null) => void;
  deaktiviert?: boolean;
}) {
  const t = useTranslations("website");
  // `null` = wird noch geladen. Das ist NICHT dasselbe wie eine leere Liste:
  // „noch keine Bilder" ist eine Auskunft, „lädt" ist keine (Wurzel 4).
  const [bilder, setBilder] = useState<Medium[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    let lebt = true;
    listMedia().then((res) => {
      if (!lebt) return;
      if (res.ok) setBilder(res.data.items);
      // Der Fehler wird GEZEIGT und nicht verschluckt: eine leere Kachelwand
      // sähe aus wie „keine Bilder", und der Kunde suchte an der falschen
      // Stelle (Wurzel 5).
      else setFehler(res.error);
    });
    return () => {
      lebt = false;
    };
  }, []);

  if (fehler) {
    return (
      <p className="p-3 text-xs text-orange-600 dark:text-orange-400">{fehler}</p>
    );
  }
  if (bilder === null) {
    return <p className="p-3 text-xs text-muted-foreground">{t("medien.laedt")}</p>;
  }
  if (bilder.length === 0) {
    return (
      <p className="p-3 text-xs text-muted-foreground">{t("medien.leer")}</p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 p-2">
      {bilder.map((b) => (
        <button
          key={b.id}
          type="button"
          disabled={deaktiviert}
          onClick={() => onBild(b.url)}
          draggable={!deaktiviert}
          onDragStart={(e) => {
            e.dataTransfer.setData("text/plain", b.url);
            e.dataTransfer.effectAllowed = "copy";
            onZiehen?.(b.url);
          }}
          onDragEnd={() => onZiehen?.(null)}
          title={b.filename ?? undefined}
          className="group relative aspect-square overflow-hidden rounded-(--radius) border border-border transition hover:border-(--brand) disabled:opacity-50"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={b.url}
            // Ohne Dateinamen bleibt der Alt-Text LEER statt erfunden: ein
            // Vorleser überspringt ein leeres Alt, aber liest einen falschen
            // Text vor (Wurzel 4).
            alt={b.filename ?? ""}
            loading="lazy"
            className="size-full object-cover"
          />
          <span className="absolute inset-x-0 bottom-0 truncate bg-background/85 px-1.5 py-0.5 text-left text-[0.625rem] text-muted-foreground">
            {b.filename}
          </span>
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-foreground/0 opacity-0 transition group-hover:bg-foreground/25 group-hover:opacity-100">
            <Icon icon="ph:plus-bold" className="size-6 text-background" />
          </span>
        </button>
      ))}
    </div>
  );
}
