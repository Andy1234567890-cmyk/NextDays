import { getTranslations } from "next-intl/server";

import { ComingSoon } from "@/components/ui/coming-soon";

export default async function BerichtePage() {
  const t = await getTranslations("finance");
  return (
    <ComingSoon
      title={t("berichtePage.title")}
      description={t("berichtePage.description")}
      icon="ph:chart-line"
    />
  );
}
