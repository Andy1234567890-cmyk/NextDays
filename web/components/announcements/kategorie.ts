// Kategorie einer Ankündigung → i18n-Schlüssel.
//
// Eigenes Modul, weil Popup UND Liste denselben Rückfall brauchen: läge die
// Funktion in einer der beiden Komponenten, zöge die andere sie samt Radix-
// Dialog bzw. der gesamten Listendarstellung ins Bundle. In lib/announcements.ts
// kann sie nicht liegen — die Datei ist `"use server"` und darf nur
// asynchrone Funktionen exportieren.
import type { AnnouncementKategorie } from "@/lib/announcements";

// Geschlossene Allowlist. `kategorie` ist im Backend ein DB-CHECK, kein
// TS-Typ zur Laufzeit: ein neu eingeführter Wert käme hier ungeprüft an und
// würde als MISSING_MESSAGE die ganze Seite werfen (next-intl wirft bei
// fehlendem Schlüssel). Deshalb Rückfall auf „hinweis" statt Absturz —
// falsch beschriftet ist besser als weiße Seite (Wurzel 5).
const KATEGORIEN: readonly AnnouncementKategorie[] = [
  "neuerung",
  "wartung",
  "hinweis",
  "wichtig",
];

export function kategorieSchluessel(wert: string): AnnouncementKategorie {
  return (KATEGORIEN as readonly string[]).includes(wert)
    ? (wert as AnnouncementKategorie)
    : "hinweis";
}
