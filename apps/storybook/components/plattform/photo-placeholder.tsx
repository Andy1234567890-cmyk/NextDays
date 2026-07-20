// Bild-Platzhalter der Plattform. Erzeugt einen ruhigen Farbverlauf aus dem
// Listing-Farbton (hue) + ein dezentes Foto-Symbol. Portiert aus plattform/.
import { Icon } from "@iconify/react";

export function PhotoPlaceholder({
  hue,
  className = "",
  label,
}: {
  hue: number;
  className?: string;
  label?: string;
}) {
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden ${className}`}
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 35% 82%), hsl(${(hue + 40) % 360} 30% 68%))`,
      }}
    >
      <Icon icon="ph:image" className="size-8 text-white/70" />
      {label && (
        <span className="absolute bottom-2 left-2 rounded bg-black/30 px-1.5 py-0.5 text-[0.625rem] font-medium text-white">
          {label}
        </span>
      )}
    </div>
  );
}
