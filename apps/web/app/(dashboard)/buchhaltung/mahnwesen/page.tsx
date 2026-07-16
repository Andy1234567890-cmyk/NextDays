import { getTranslations } from "next-intl/server";
import { ComingSoon } from "@/components/ui/coming-soon";

export default async function MahnwesenPage() {
  const t = await getTranslations("finance");

  return (
    <ComingSoon
      title={t("mahnwesenPage.mahnwesenTitle")}
      description={t("mahnwesenPage.mahnwesenDescription")}
      icon="ph:warning-circle"
    />
  );
}
