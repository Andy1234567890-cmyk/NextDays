// Ein Bericht, dessen Nachbartabelle (Ausgaben 0656, Kontenplan 0671) noch
// nicht eingespielt ist, SAGT das — statt „0 Ausgaben" zu behaupten (Wurzel 4).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";

export function NachbarHinweis({
  ausgaben,
  konten,
}: {
  ausgaben?: boolean;
  konten?: boolean;
}) {
  const t = useTranslations("finance");
  const fehlend: string[] = [];
  if (ausgaben === false) fehlend.push(t("berichteGemeinsam.nachbarAusgaben"));
  if (konten === false) fehlend.push(t("berichteGemeinsam.nachbarKonten"));
  if (fehlend.length === 0) return null;
  return (
    <p className="flex items-start gap-2 rounded-(--radius) bg-muted p-3 text-xs text-muted-foreground">
      <Icon icon="ph:info" className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{t("berichteGemeinsam.nachbarFehlt", { was: fehlend.join(", ") })}</span>
    </p>
  );
}
