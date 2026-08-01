import { ComingSoon } from "@nextdays/ui/coming-soon";
import { useTranslations } from "next-intl";

export default function StellenPage() {
  const t = useTranslations("nav");
  return (
    <ComingSoon
      title="Stellen"
      description={t("jobsPostingsSub")}
      icon="ph:megaphone"
    />
  );
}
