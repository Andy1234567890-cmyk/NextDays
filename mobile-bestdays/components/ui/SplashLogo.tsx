// Woraus der Splash dieser App sein Logo baut. Die BEWEGUNG steht in
// components/Splash.tsx und ist in allen drei Apps dieselbe; hier steht nur,
// aus welchen Teilen das Markenbild besteht.
//
// KEINE Schwesterdatei: genau das ist der markenabhängige Teil. myBestDays hat
// nur PNG-Logos — die Zweiteilung (Chevron und Wortmarke fliegen nacheinander)
// setzt eine Vektor-Vorlage voraus, wie sie myNextDays unter
// `components/ui/LogoVektor.tsx` hat. Sie hier nachzubauen hieße, ein Logo zu
// erfinden. Diese App fliegt deshalb als EIN Stück ein — dieselbe Kurve,
// dieselbe Dauer, nur ohne Versatz.
//
// Kommt eine Vektor-Vorlage der myBestDays-Wortmarke dazu, wird diese Datei
// durch die zweiteilige Fassung ersetzt; an `Splash.tsx` ändert sich nichts.
import type { ReactNode } from "react";
import { Image } from "react-native";

import type { Marke } from "@/theme/tokens";

/** Höhe des Logos auf dem Splash — dieselbe Zahl wie in den Schwester-Apps. */
const HOEHE = 44;

export type SplashTeil = {
  key: string;
  knoten: ReactNode;
  /** Abstand zum vorherigen Teil. Nur ab dem zweiten Teil wirksam. */
  abstand?: number;
};

/**
 * Die Teile des Logos in ihrer Reihenfolge. Hier genau eines: das vollständige
 * Lockup. Das erste Teil startet sofort (siehe Splash.tsx).
 */
export function SplashLogoTeile({
  negativ,
  marke,
}: {
  negativ: boolean;
  marke: Marke;
}): SplashTeil[] {
  return [
    {
      key: "lockup",
      knoten: (
        <Image
          // `logoHell` ist die Negativ-Fassung (helle Schrift) und gehört auf
          // DUNKLE Flächen. Der bisherige Splash nahm immer `logo` — im Dark
          // Mode also dunkle Schrift auf dunklem Grund.
          source={negativ ? marke.logoHell : marke.logo}
          // Breite aus dem gemessenen Seitenverhältnis, nicht geschätzt: die
          // alte Fassung setzte `width: "100%"` bei fester Höhe und verzerrte
          // das Logo je nach Bildschirmbreite.
          style={{ height: HOEHE, width: HOEHE * marke.logoRatio }}
          resizeMode="contain"
        />
      ),
    },
  ];
}
