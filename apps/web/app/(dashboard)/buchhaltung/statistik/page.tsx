import { getTranslations } from "next-intl/server";
import { ComingSoon } from "@/components/ui/coming-soon";

export default async function StatistikPage() {
  const t = await getTranslations("finance");

  return (
    <ComingSoon
      title={t("statistikPage.statistikTitle")}
      description={t("statistikPage.statistikDescription")}
      icon="ph:chart-bar"
    />
  );
}
