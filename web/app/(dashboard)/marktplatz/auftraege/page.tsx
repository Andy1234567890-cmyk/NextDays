import { ComingSoon } from "@nextdays/ui/coming-soon";
import { useTranslations } from "next-intl";

export default function AuftraegePage() {
  const t = useTranslations("nav");
  return (
    <ComingSoon
      title={t("marketplaceOrders")}
      description={t("marketplaceOrdersSub")}
      icon="ph:clipboard-text"
    />
  );
}
