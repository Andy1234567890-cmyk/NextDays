import { ComingSoon } from "@nextdays/ui/coming-soon";
import { useTranslations } from "next-intl";

export default function MpAngebotePage() {
  const t = useTranslations("nav");
  return (
    <ComingSoon
      title="Angebote"
      description={t("marketplaceQuotesSub")}
      icon="ph:handshake"
    />
  );
}
