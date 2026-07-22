// Reservierungs-Einstellungen-Reiter. Buchungsbezogene Einstellungen (Check-in-/
// Check-out-Zeiten, Richtlinien) liegen heute an den Objekten; dieser Reiter
// führt dorthin, damit der Sidebar-Link nicht auf die [id]-Route fällt.
import { getTranslations } from "next-intl/server";
import { ModulePlaceholder } from "@/components/reservierungen/module-placeholder";

export default async function ReservierungsEinstellungenPage() {
  const t = await getTranslations("reservations");

  return (
    <ModulePlaceholder
      title={t("einstellungenPage.title")}
      icon="ph:gear"
      description={t("einstellungenPage.description")}
      link={{ href: "/objekte", label: t("einstellungenPage.linkLabel") }}
    />
  );
}
