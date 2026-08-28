// Hinweis für Rollen ohne MANAGE_SITE_CONFIG. Eigene Datei, weil alle
// Baukasten-Routen ihn zeigen können.
import { getTranslations } from "next-intl/server";

export async function KeinZugriff() {
  const [tNav, t] = await Promise.all([
    getTranslations("nav"),
    getTranslations("website"),
  ]);
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
      <h2 className="font-display text-lg font-extrabold">{tNav("noAccess")}</h2>
      <p className="text-sm text-muted-foreground">{t("baukasten.keinZugriff")}</p>
    </div>
  );
}
