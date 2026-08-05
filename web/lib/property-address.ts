// Adresszeile eines Objekts — von Server- UND Client-Komponenten genutzt.
//
// Bewusst eine EIGENE Datei ohne `"use server"`/`"use client"`: `properties.ts`
// ist mit `"use server"` markiert (dort darf nur async exportiert werden), und
// in einer `"use client"`-Datei wäre sie vom Server nicht aufrufbar — genau
// dieser Fehler trat auf („Attempted to call adressZeile() from the server but
// adressZeile is on the client").
import type { Property } from "@/lib/properties";

/** „Skagen Landevej 772, 9800, Hjørring" — leere Teile fallen weg.
 *
 * Reihenfolge wie im Standort-Formular. `address` wird NICHT genutzt: dort
 * steht die volle Zeile, die bei Objekten aus dem Channex-Kreislauf noch die
 * Firmenanschrift tragen kann. `street`/`house_number` sind die gepflegten
 * Felder. */
export function adressZeile(
  p: Pick<Property, "street" | "house_number" | "postal_code" | "city">,
): string {
  return [
    [p.street, p.house_number].filter(Boolean).join(" "),
    p.postal_code,
    p.city,
  ]
    .filter(Boolean)
    .join(", ");
}
