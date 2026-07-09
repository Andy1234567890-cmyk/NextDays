// Warnungen-Reiter der PM-Fläche. Eigene Warnungs-Auswertung folgt; bis dahin
// führt der Reiter auf die Buchungsübersicht (dort sind fehlende Zahlungen /
// offene Aufgaben je Buchung sichtbar). Kein erfundener Zähler.
import { ModulePlaceholder } from "@/components/reservierungen/module-placeholder";

export default function WarnungenPage() {
  return (
    <ModulePlaceholder
      title="Warnungen"
      icon="ph:warning"
      description="Hier bündeln wir künftig Hinweise zu Buchungen (offene Zahlungen, fehlende Gästedaten, anstehende Aufgaben). Bis dahin finden Sie diese Angaben direkt in der jeweiligen Buchung."
      link={{ href: "/reservierungen", label: "Zur Buchungsübersicht" }}
    />
  );
}
