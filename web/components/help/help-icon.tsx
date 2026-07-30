"use client";

// Iconify-Insel für die Hilfe-Seiten. @iconify/react baucht intern einen React-
// Context und läuft deshalb nur im Client — direkt in einer Server-Komponente
// importiert, wirft es „createContext only works in Client Components" (500).
// Die Seiten selbst bleiben Server-Komponenten (sie brauchen generateMetadata),
// und holen sich das Icon über diese Insel.
import { Icon } from "@iconify/react";

export function HelpIcon({
  icon,
  className,
}: {
  icon: string;
  className?: string;
}) {
  return <Icon icon={icon} className={className} />;
}
