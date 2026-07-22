import { getTranslations } from "next-intl/server";

import { ComingSoon } from "@nextdays/ui/coming-soon";

export default async function UmsatzPage() {
  const t = await getTranslations("finance");

  return (
    <ComingSoon
      title={t("umsatzPage.title")}
      description={t("umsatzPage.description")}
      icon="ph:trend-up"
    />
  );
}
