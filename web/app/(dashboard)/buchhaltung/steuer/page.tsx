import { getTranslations } from "next-intl/server";
import { ComingSoon } from "@nextdays/ui/coming-soon";

export default async function SteuerPage() {
  const t = await getTranslations("finance");
  return (
    <ComingSoon
      title={t("steuerPage.taxTitle")}
      description={t("steuerPage.taxDescription")}
      icon="ph:percent"
    />
  );
}
