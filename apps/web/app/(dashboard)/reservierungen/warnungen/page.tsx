// Warnungen-Reiter der PM-Fläche. Eigene Warnungs-Auswertung folgt; bis dahin
// führt der Reiter auf die Buchungsübersicht (dort sind fehlende Zahlungen /
// offene Aufgaben je Buchung sichtbar). Kein erfundener Zähler.
import { getTranslations } from "next-intl/server";
import { ModulePlaceholder } from "@/components/reservierungen/module-placeholder";

export default async function WarnungenPage() {
  const t = await getTranslations("reservations");

  return (
    <ModulePlaceholder
      title={t("warnungenPage.title")}
      icon="ph:warning"
      description={t("warnungenPage.description")}
      link={{ href: "/reservierungen", label: t("warnungenPage.linkLabel") }}
    />
  );
}
