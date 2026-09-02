// Wortmarke myNextDays — dieselben Figma-Assets wie auf der Marketing-Seite
// (245×44, freigegeben 21.08.2026), kopiert nach public/brand. Rot #B82028 auf
// hellen, die Negativ-Fassung auf dunklen Flächen. SVG → `unoptimized`, der
// Bild-Optimierer würde daraus nur ein Raster machen.
import Image from "next/image";

const ASPECT = 245 / 44;

export function Logo({ heightRem = 1.75, dark = false }: { heightRem?: number; dark?: boolean }) {
  return (
    <Image
      src={dark ? "/brand/mnd_lockup_negativ.svg" : "/brand/mnd_lockup.svg"}
      alt="myNextDays"
      width={245}
      height={44}
      unoptimized
      priority
      style={{ height: `${heightRem}rem`, width: `${heightRem * ASPECT}rem`, display: "inline-block", flexShrink: 0 }}
    />
  );
}
