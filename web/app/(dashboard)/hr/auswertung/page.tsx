import { ComingSoon } from "@nextdays/ui/coming-soon";
import { useTranslations } from "next-intl";

export default function AuswertungPage() {
  const t = useTranslations("nav");
  return (
    <ComingSoon
      title="Auswertung"
      description={t("hrReportsSub")}
      icon="ph:chart-bar"
    />
  );
}
