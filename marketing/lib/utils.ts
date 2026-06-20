// shadcn/ui-Standard: Tailwind-Klassen sicher zusammenführen (Konflikte auflösen).
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
