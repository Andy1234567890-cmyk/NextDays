"use client";

// Gemeinsame Foto-Kacheln der Foto-Tour. Jede Kachel trägt eine stabile
// `layoutId` — dieselbe Kachel existiert im Übersichts-Grid (FotoTour) UND als
// Thumbnail-Streifen in der Zimmer-Detailansicht (RaumDetail). Weil beide in
// EINER `LayoutGroup` liegen und dieselbe `layoutId` teilen, animiert Framer
// Motion beim Wechsel die GLEICHE Kachel weich von der Grid- zur Thumbnail-
// Position (physisches „mit dem Finger verschieben"), statt zwei verschiedene
// Ansichten gegeneinander umzublättern.
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";
import { useState } from "react";

import type { RaumKachel } from "./raum-detail";

// Weiche Feder mit Trägheit — der „Finger-Zieh"-Charakter (kein hartes Snap).
export const KACHEL_SPRING = {
  type: "spring" as const,
  stiffness: 60,
  damping: 18,
  mass: 1.1,
};

/** Das Bild/Platzhalter-Innere einer Kachel (in Grid und Thumbnail gleich). */
function KachelBild({ raum, klein }: { raum: RaumKachel; klein?: boolean }) {
  // Ladefehler pro URL im State (nicht imperativ style.display=none): sonst bliebe
  // ein einmal gescheitertes <img> für immer versteckt, auch wenn danach eine
  // gültige URL käme (klebender Fehler-Zustand). Bild da + kein Fehler → rendern.
  const [fehlerUrl, setFehlerUrl] = useState<string | null>(null);
  const bild = raum.bild;
  if (bild && bild !== fehlerUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={bild}
        src={bild}
        alt={raum.titel}
        className="size-full object-cover"
        onError={() => setFehlerUrl(bild)}
      />
    );
  }
  // Airbnb-Muster: farbige 3D-Illustration als Platzhalter (Bett je Zimmer,
  // Bildstapel für „Weitere Fotos"), nicht ein graues Icon.
  const illu = raum.id === "weitere" ? "fluent-emoji:framed-picture" : "fluent-emoji:bed";
  return (
    <span className="flex size-full items-center justify-center">
      <Icon icon={illu} className={klein ? "size-10" : "size-20"} />
    </span>
  );
}

/**
 * Große Kachel im Übersichts-Grid. Der Bild-Container trägt die `layoutId` —
 * beim Öffnen wandert genau dieses Element zur Thumbnail-Position.
 */
export function KachelGross({
  raum,
  untertitel,
  onOeffne,
}: {
  raum: RaumKachel;
  untertitel: string;
  onOeffne: () => void;
}) {
  return (
    <button type="button" onClick={onOeffne} className="w-[13.5rem] text-left">
      <motion.div
        layoutId={`kachel-${raum.id}`}
        transition={KACHEL_SPRING}
        className="aspect-square overflow-hidden rounded-2xl bg-muted transition-shadow hover:shadow-md"
      >
        <KachelBild raum={raum} />
      </motion.div>
      <div className="mt-2">
        <p className="font-semibold">{raum.titel}</p>
        <p className="text-sm text-muted-foreground">{untertitel}</p>
      </div>
    </button>
  );
}

/**
 * Kleines Thumbnail im Detail-Navigationsstreifen. Trägt dieselbe `layoutId`
 * wie die große Kachel → Framer Motion animiert die Position dazwischen.
 */
export function KachelThumb({
  raum,
  aktiv,
  onWaehle,
}: {
  raum: RaumKachel;
  aktiv: boolean;
  onWaehle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onWaehle}
      className="flex flex-col items-center gap-1.5 text-center"
    >
      <motion.span
        layoutId={`kachel-${raum.id}`}
        transition={KACHEL_SPRING}
        className={`block size-20 overflow-hidden rounded-2xl bg-muted ${
          aktiv ? "ring-2 ring-foreground ring-offset-2" : ""
        }`}
      >
        <KachelBild raum={raum} klein />
      </motion.span>
      <span className="text-xs font-medium leading-tight">{raum.titel}</span>
    </button>
  );
}
