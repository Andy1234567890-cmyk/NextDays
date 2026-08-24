// SEO/AEO → Weiterleitungen (0430).
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { SeoWeiterleitungenListe } from "@/components/website/seo/weiterleitungen-liste";
import { listWeiterleitungen } from "@/lib/site-weiterleitungen";

export default async function SeoWeiterleitungenSeite() {
  const res = await listWeiterleitungen();
  // 403/500 werden NICHT zu einer leeren Liste: „kein Zugriff" oder „Backend
  // weg" sähe dann aus wie „noch keine Weiterleitungen angelegt" — und der
  // Kunde würde eine anlegen, die es längst gibt.
  const items = res.ok ? res.data.items : [];
  return (
    <>
      <RealtimeRefresh tables={["site_redirects"]} />
      <SeoWeiterleitungenListe weiterleitungen={items} />
    </>
  );
}
