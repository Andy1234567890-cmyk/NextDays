// Einstellungen → Blog: Name, Nächster/Vorheriger-Navigation, RSS, Import (0457).
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { BlogLeiste } from "@/components/website/einstellungen/blog-leiste";
import { getBlogSettings } from "@/lib/site-pages";

/** Was gilt, wenn noch nie etwas gespeichert wurde.
 *
 *  Alles leer außer der Navigation — das ist der Spalten-Default aus 0457 und
 *  damit der wahre Zustand, kein erfundener Startwert (Wurzel 4). */
const LEER = {
  blog_name: null,
  blog_prev_next: true,
  rss_title: null,
  rss_description: null,
  rss_image_url: null,
};

export default async function BlogSeite() {
  const res = await getBlogSettings();
  return (
    <>
      {/* Der Blogname steht in `tenant_site_config` — dieselbe Zeile wie das
          übrige Branding. Ein zweiter Reiter, der sie gerade ändert, soll hier
          nicht unbemerkt bleiben. */}
      <RealtimeRefresh tables={["tenant_site_config"]} />
      <BlogLeiste einstellungen={res.ok ? res.data : LEER} />
    </>
  );
}
