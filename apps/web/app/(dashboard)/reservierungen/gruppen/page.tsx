// Reservierungsgruppen-Reiter. Gruppen-Buchungen (mehrere Zimmer/Objekte unter
// einer Buchung) werden als eigener Schritt aufgebaut; bis dahin ehrlicher
// Hinweis, damit der Sidebar-Link nicht ins Leere / auf die [id]-Route fällt.
import { ModulePlaceholder } from "@/components/reservierungen/module-placeholder";

export default function ReservierungsgruppenPage() {
  return (
    <ModulePlaceholder
      title="Reservierungsgruppen"
      icon="ph:users-three"
      description="Gruppenbuchungen fassen mehrere Reservierungen (z. B. mehrere Objekte oder Zimmer) unter einer Buchung zusammen. Diese Fläche wird als eigener Schritt aufgebaut."
      link={{ href: "/reservierungen", label: "Zur Buchungsübersicht" }}
    />
  );
}
