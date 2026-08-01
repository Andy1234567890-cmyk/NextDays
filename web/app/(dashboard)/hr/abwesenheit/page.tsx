import { ComingSoon } from "@nextdays/ui/coming-soon";
import { useTranslations } from "next-intl";

export default function AbwesenheitPage() {
  const t = useTranslations("nav");
  return (
    <ComingSoon
      title="Abwesenheit"
      description={t("hrAbsenceSub")}
      icon="ph:airplane-takeoff"
    />
  );
}
