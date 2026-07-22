import { getTranslations } from "next-intl/server";
import { ComingSoon } from "@nextdays/ui/coming-soon";

export default async function KontenplanPage() {
  const t = await getTranslations("finance");
  return (
    <ComingSoon
      title={t("kontenplanPage.kontenplanTitle")}
      description={t("kontenplanPage.kontenplanDescription")}
      icon="ph:tree-structure"
    />
  );
}
