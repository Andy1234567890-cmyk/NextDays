// Gastmodul-Reiter der PM-Fläche. Das eigentliche Pre-Check-in-Formular
// (öffentlicher Gast-Link zur Datenerfassung vor Anreise) ist ein separater
// Auftrag — hier steht der Reiter mit ehrlichem Hinweis, damit „Klick führt
// dahin" stimmt, ohne Fake-Inhalt.
import { ModulePlaceholder } from "@/components/reservierungen/module-placeholder";

export default function GastmodulPage() {
  return (
    <ModulePlaceholder
      title="Gastmodul"
      icon="ph:identification-card"
      description="Mit dem Pre-Check-in-Formular erfassen Sie vor der Anreise alle Daten Ihrer Gäste (Ausweis, Adresse, Mitreisende, Ankunftszeit). Diese Fläche wird als eigener Schritt aufgebaut."
    />
  );
}
