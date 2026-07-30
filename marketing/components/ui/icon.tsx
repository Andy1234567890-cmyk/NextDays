// Icon — rendert Phosphor-Icons serverseitig aus dem lokal generierten Satz.
//
// Ersetzt `@iconify/react`: das holt die Icon-Daten zur LAUFZEIT von
// api.iconify.design. Auf dieser Seite hieß das zweierlei — ein
// Drittanbieter-Request (dieselbe App lädt ihre Schriften bewusst lokal) und
// Icons, die erst nach der Hydration erscheinen. Serverseitig gerendert sind
// sie sofort da und funktionieren auch in Server Components.
//
// Der SVG-Body kommt aus components/ui/icon-set.ts, generiert von
// scripts/generate-icon-set.mjs aus dem versionierten Paket @iconify-json/ph —
// statischer, im Repo eingecheckter Inhalt, kein Client-Input (Wurzel 8).
import { ICON_SET, ICON_VIEWBOX, type IconName } from "@/components/ui/icon-set";

export function Icon({
  icon,
  className,
}: {
  icon: IconName;
  className?: string;
}) {
  return (
    <svg
      aria-hidden
      viewBox={ICON_VIEWBOX}
      className={className}
      dangerouslySetInnerHTML={{ __html: ICON_SET[icon] }}
    />
  );
}

export type { IconName };
