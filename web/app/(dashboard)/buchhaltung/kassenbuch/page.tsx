import { ComingSoon } from "@nextdays/ui/coming-soon";
import { useTranslations } from "next-intl";

export default function KassenbuchPage() {
  const t = useTranslations("nav");
  return (
    <ComingSoon
      title="Kassenbuch"
      description={t("cashbookSub")}
      icon="ph:wallet"
    />
  );
}
