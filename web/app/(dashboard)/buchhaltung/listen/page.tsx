import { getTranslations } from "next-intl/server";
import { ComingSoon } from "@nextdays/ui/coming-soon";

export default async function ListenPage() {
  const t = await getTranslations("finance");

  return (
    <ComingSoon
      title={t("listenPage.listenTitle")}
      description={t("listenPage.listenDescription")}
      icon="ph:list-checks"
    />
  );
}
