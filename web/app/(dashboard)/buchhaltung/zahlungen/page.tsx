import { getTranslations } from "next-intl/server";
import { ComingSoon } from "@nextdays/ui/coming-soon";

export default async function ZahlungenPage() {
  const t = await getTranslations("finance");
  return (
    <ComingSoon
      title={t("zahlungenPage.title")}
      description={t("zahlungenPage.description")}
      icon="ph:credit-card"
    />
  );
}
