// Reservierungsgruppen-Reiter. Gruppen-Buchungen (mehrere Zimmer/Objekte unter
// einer Buchung) werden als eigener Schritt aufgebaut; bis dahin ehrlicher
// Hinweis, damit der Sidebar-Link nicht ins Leere / auf die [id]-Route fällt.
import { getTranslations } from "next-intl/server";
import { ModulePlaceholder } from "@/components/reservierungen/module-placeholder";

export default async function ReservierungsgruppenPage() {
  const t = await getTranslations("reservations");
  return (
    <ModulePlaceholder
      title={t("gruppenPage.title")}
      icon="ph:users-three"
      description={t("gruppenPage.description")}
      link={{ href: "/reservierungen", label: t("gruppenPage.linkLabel") }}
    />
  );
}
