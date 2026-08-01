import { ComingSoon } from "@nextdays/ui/coming-soon";
import { useTranslations } from "next-intl";

export default function BewerbungenPage() {
  const t = useTranslations("nav");
  return (
    <ComingSoon
      title="Bewerbungen"
      description={t("jobsApplicationsSub")}
      icon="ph:user-list"
    />
  );
}
