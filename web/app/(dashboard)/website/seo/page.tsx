// SEO/AEO → Übersicht: Befundliste, site-weite Angaben und die drei
// Maschinen-Dateien (0430, Etappe B).
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { SeoBefundListe } from "@/components/website/seo/befund-liste";
import { SeoUebersichtLeiste } from "@/components/website/seo/uebersicht-leiste";
import { seoPruefung } from "@/lib/site-weiterleitungen";

import { ladeBaukasten } from "../daten";

export default async function SeoSeite() {
  const [{ branding, domains }, pruefung] = await Promise.all([
    ladeBaukasten(),
    seoPruefung(),
  ]);
  // Die drei Dateien hängen an der aktiven Custom-Domain, nicht am Baukasten.
  // Ohne sie gibt es keine Adresse, unter der sie erreichbar wären — dann zeigt
  // die Ansicht einen Hinweis statt drei toter Links.
  const liveDomain = domains.find((d) => d.status === "active")?.domain ?? null;
  return (
    <>
      <RealtimeRefresh tables={["tenant_site_config", "site_pages"]} />
      <SeoUebersichtLeiste
        branding={branding}
        liveDomain={liveDomain}
        // Die Befundliste steht ÜBER den Feldern: sie sagt, was zu tun ist.
        // Ein Fehlschlag des Abrufs blendet sie aus statt eine leere Liste zu
        // zeigen — „keine Befunde" wäre dann eine Falschaussage.
        befunde={
          pruefung.ok ? (
            <SeoBefundListe
              befunde={pruefung.data.items}
              geprueft={pruefung.data.geprueft}
            />
          ) : null
        }
      />
    </>
  );
}
