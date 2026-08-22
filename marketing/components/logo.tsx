// Marketing-Logo. Zwei echte Assets statt CSS-Filter, damit die Markenfarben
// stimmen: Rot #B82028 auf hellen, #E24B4A auf dunklen Flächen — ein einziges
// Asset umgefärbt würde auf der jeweils anderen Fläche kippen.
//
// SVG statt PNG mit Crop-Transform: die Vektor-Assets aus Figma
// (freigegeben 21.08.2026) sind exakt auf die sichtbare Wortmarke beschnitten,
// 245×44. Das alte Logo_transparent.png war 1600×1600 mit breitem Rand und
// musste im Rendering auf seine BBox zurückgerückt werden; dieser Mechanismus
// ist mit den neuen Assets ersatzlos entfallen.
const ASPECT = 245 / 44;

export function Logo({
  heightRem = 2.25,
  dark = false,
}: {
  heightRem?: number;
  dark?: boolean;
}) {
  return (
    <img
      src={
        dark
          ? "/marketing/brand/mnd_lockup_negativ.svg"
          : "/marketing/brand/mnd_lockup.svg"
      }
      alt="myNextDays"
      width={245}
      height={44}
      style={{
        height: `${heightRem}rem`,
        width: `${heightRem * ASPECT}rem`,
        display: "inline-block",
        flexShrink: 0,
      }}
    />
  );
}
