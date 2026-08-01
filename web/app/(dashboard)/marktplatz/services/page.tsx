import { ComingSoon } from "@nextdays/ui/coming-soon";
import { useTranslations } from "next-intl";

export default function ServicesPage() {
  const t = useTranslations("nav");
  return (
    <ComingSoon
      title="Services"
      description={t("marketplaceServicesSub")}
      icon="ph:wrench"
    />
  );
}
