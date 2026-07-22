import { getTranslations } from "next-intl/server";
import { ComingSoon } from "@nextdays/ui/coming-soon";

export default async function ERechnungPage() {
  const t = await getTranslations("finance");
  return (
    <ComingSoon
      title={t("eRechnungPage.eRechnungTitle")}
      description={t("eRechnungPage.eRechnungDescription")}
      icon="ph:file-code"
    />
  );
}
