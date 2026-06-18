// NextDays-Logo (offizielle Bilddatei, zugeschnitten). Querformat
// „NextDays powered by AirSmil". Feste Höhe in rem + proportionale Breite in rem,
// kein Stauchen. Größen in rem (Projekt-Regel).
import Image from "next/image";

// Seitenverhältnis der zugeschnittenen Datei: 1319 × 360 ≈ 3.664.
const ASPECT = 1319 / 360;

export function Logo({ heightRem = 1.75 }: { heightRem?: number }) {
  const widthRem = heightRem * ASPECT;
  return (
    <span
      style={{
        width: `${widthRem}rem`,
        height: `${heightRem}rem`,
        display: "inline-block",
        flexShrink: 0,
      }}
    >
      <Image
        src="/logo-cropped_transparent.png"
        alt="NextDays — powered by AirSmil"
        // intrinsische Pixelmaße für next/image (Asset-Auflösung, keine Layout-px)
        width={1319}
        height={360}
        priority
        style={{ width: "100%", height: "100%" }}
      />
    </span>
  );
}
