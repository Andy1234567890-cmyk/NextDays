// myBestDays-Logo (freigestellte PNGs, bereits auf die sichtbare BBox getrimmt).
// `variant="light"` ist die weisse Schrift-Fassung fuer dunkle Flaechen.
const ASPECT = 1461 / 578;

export function Logo({
  heightRem = 2.25,
  variant = "dark",
}: {
  heightRem?: number;
  variant?: "dark" | "light";
}) {
  return (
    <img
      src={variant === "light" ? "/mybestdays-logo-light.png" : "/mybestdays-logo.png"}
      alt="myBestDays — powered by AirSmil"
      style={{
        height: `${heightRem}rem`,
        width: `${heightRem * ASPECT}rem`,
        flexShrink: 0,
      }}
    />
  );
}
