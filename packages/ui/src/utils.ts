// shadcn/ui-Standard: Tailwind-Klassen sicher zusammenführen (Konflikte auflösen).
// Single Source des `cn`-Helfers (@nextdays/ui). Apps re-exportieren ihn bei
// Bedarf aus ihrem lib/utils, damit bestehende `./utils`-Importe funktionieren.
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
