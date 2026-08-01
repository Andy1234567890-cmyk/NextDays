// Website-Baukasten: Seitenliste der white-label Agentur-Website. Anlegen,
// Home setzen, veröffentlichen, löschen + Start-Templates. Realtime auf
// site_pages, damit Änderungen (auch aus dem Editor) live erscheinen.
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { getTranslations } from "next-intl/server";
import { WebsitePages } from "@/components/website/website-pages";
import { listPages } from "@/lib/site-pages";

export default async function WebsitePage() {
  const t = await getTranslations("nav");
  const res = await listPages();
  const pages = res.ok ? res.data.items : [];
  const forbidden = !res.ok && res.status === 403;

  if (forbidden) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
        <h2 className="font-display text-lg font-extrabold">{t("noAccess")}</h2>
        <p className="text-sm text-muted-foreground">
          Sie haben keinen Zugriff auf den Website-Baukasten.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <RealtimeRefresh tables={["site_pages"]} />
      <WebsitePages pages={pages} />
    </div>
  );
}
