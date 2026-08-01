import { ComingSoon } from "@nextdays/ui/coming-soon";
import { useTranslations } from "next-intl";

export default function BankPage() {
  const t = useTranslations("nav");
  return (
    <ComingSoon
      title="Bank"
      description={t("bankSub")}
      icon="ph:bank"
    />
  );
}
