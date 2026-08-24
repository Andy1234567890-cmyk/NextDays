// myBestDays-Logo (freigestellte PNGs, bereits auf die sichtbare BBox getrimmt).
// `variant="light"` ist die weisse Schrift-Fassung fuer dunkle Flaechen.
// Seitenverhältnis des getrimmten Bildes. Es steht hier als Zahl und nicht als
// `height: auto`, weil das Logo in Kopfzeilen neben Text sitzt: ohne feste
// Breite springt das Layout, sobald das PNG geladen ist.
//
// Beim Wechsel auf die Figma-Logo-Familie (24.08.2026) hat sich das Verhältnis
// geändert — 578 stand hier noch aus der alten Fassung und hätte die neue
// Sperrung gestaucht, weil die Breite aus der Höhe berechnet wird. Wer das Bild
// austauscht, MUSS diese Zahl mitziehen; `magick <datei> -format "%wx%h" info:`
// nennt sie.
const ASPECT = 1461 / 403;

export function Logo({
  heightRem = 2,
  variant = "dark",
}: {
  heightRem?: number;
  variant?: "dark" | "light";
}) {
  return (
    <img
      src={variant === "light" ? "/mybestdays-logo-light.png" : "/mybestdays-logo.png"}
      alt="myBestDays"
      style={{
        height: `${heightRem}rem`,
        width: `${heightRem * ASPECT}rem`,
        flexShrink: 0,
      }}
    />
  );
}
