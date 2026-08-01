import { ComingSoon } from "@nextdays/ui/coming-soon";
import { useTranslations } from "next-intl";

export default function ProjektePage() {
  const t = useTranslations("nav");
  return (
    <ComingSoon
      title="Projekte"
      description={t("marketplaceProjectsSub")}
      icon="ph:folder"
    />
  );
}
