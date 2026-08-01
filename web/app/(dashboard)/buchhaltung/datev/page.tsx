import { ComingSoon } from "@nextdays/ui/coming-soon";
import { useTranslations } from "next-intl";

export default function DatevPage() {
  const t = useTranslations("nav");
  return (
    <ComingSoon
      title="DATEV"
      description={t("datevSub")}
      icon="ph:export"
    />
  );
}
