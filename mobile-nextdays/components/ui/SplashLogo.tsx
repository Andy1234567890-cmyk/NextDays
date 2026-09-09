// Woraus der Splash dieser App sein Logo baut. Die BEWEGUNG steht in
// components/Splash.tsx und ist in allen drei Apps dieselbe; hier steht nur,
// aus welchen Teilen das Markenbild besteht.
//
// KEINE Schwesterdatei: genau das ist der markenabhängige Teil. myNextDays und
// die Eigentümer-App haben eine Vektor-Vorlage und trennen deshalb Chevron und
// Wortmarke — sie fliegen nacheinander ein. myBestDays hat nur PNGs (die
// Trennung ließe sich dort nur durch ein erfundenes Logo herstellen) und
// liefert ein Stück.
import type { ReactNode } from "react";

import { LOCKUP_HOEHE, LogoChevron, LogoWortmarke } from "@/components/ui/LogoVektor";
import type { Marke } from "@/theme/tokens";

/** Höhe des Lockups auf dem Splash. Die Breiten rechnet `LogoVektor` daraus. */
const HOEHE = 44;

export type SplashTeil = {
  key: string;
  knoten: ReactNode;
  /** Abstand zum vorherigen Teil. Nur ab dem zweiten Teil wirksam. */
  abstand?: number;
};

/**
 * Die Teile des Logos in ihrer Lockup-Reihenfolge. Das erste Teil startet
 * sofort, jedes weitere folgt versetzt (siehe Splash.tsx).
 *
 * `marke` bleibt hier ungenutzt — die Vektor-Vorlage traegt Geometrie UND
 * Farben selbst (die Logo-Rots stehen bewusst nicht in `theme/marke.ts`, wo
 * `akzent` die Oberflaechenfarbe ist). Der Parameter steht trotzdem in der
 * Signatur, damit alle drei Apps denselben Adapter-Vertrag erfuellen und
 * `Splash.tsx` byte-identisch bleiben kann.
 */
export function SplashLogoTeile({
  negativ,
}: {
  negativ: boolean;
  marke: Marke;
}): SplashTeil[] {
  return [
    { key: "chevron", knoten: <LogoChevron hoehe={HOEHE} negativ={negativ} /> },
    {
      key: "wort",
      knoten: <LogoWortmarke hoehe={HOEHE} negativ={negativ} />,
      // Der Zwischenraum der Vorlage (x 34 → 55.9), auf HOEHE skaliert.
      abstand: (HOEHE / LOCKUP_HOEHE) * 18,
    },
  ];
}
