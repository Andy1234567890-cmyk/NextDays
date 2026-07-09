// Reservierungs-Einstellungen-Reiter. Buchungsbezogene Einstellungen (Check-in-/
// Check-out-Zeiten, Richtlinien) liegen heute an den Objekten; dieser Reiter
// führt dorthin, damit der Sidebar-Link nicht auf die [id]-Route fällt.
import { ModulePlaceholder } from "@/components/reservierungen/module-placeholder";

export default function ReservierungsEinstellungenPage() {
  return (
    <ModulePlaceholder
      title="Reservierungs-Einstellungen"
      icon="ph:gear"
      description="Buchungsbezogene Einstellungen (Check-in-/Check-out-Zeiten, Stornoregeln, Richtlinien) pflegen Sie derzeit direkt am jeweiligen Objekt."
      link={{ href: "/objekte", label: "Zu den Objekten" }}
    />
  );
}
