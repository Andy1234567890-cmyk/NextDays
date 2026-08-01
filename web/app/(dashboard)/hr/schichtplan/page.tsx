import { ComingSoon } from "@nextdays/ui/coming-soon";
import { useTranslations } from "next-intl";

export default function SchichtplanPage() {
  const t = useTranslations("nav");
  return (
    <ComingSoon
      title="Schichtplan"
      description={t("hrShiftsSub")}
      icon="ph:calendar-check"
    />
  );
}
