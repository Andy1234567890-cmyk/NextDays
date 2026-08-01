// Gastmodul-Reiter der PM-Fläche. Das eigentliche Pre-Check-in-Formular
// (öffentlicher Gast-Link zur Datenerfassung vor Anreise) ist ein separater
// Auftrag — hier steht der Reiter mit ehrlichem Hinweis, damit „Klick führt
// dahin" stimmt, ohne Fake-Inhalt.
import { ModulePlaceholder } from "@/components/reservierungen/module-placeholder";
import { useTranslations } from "next-intl";

export default function GastmodulPage() {
  const t = useTranslations("reservations");
  return (
    <ModulePlaceholder
      title="Gastmodul"
      icon="ph:identification-card"
      description={t("guestModuleHint")}
    />
  );
}
