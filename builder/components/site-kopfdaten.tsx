// Strukturierte Daten + Google-Tag einer Kunden-Seite (0430).
//
// Async Server-Component, damit sie den Host SELBST liest. Die Alternative wäre
// ein `host`-Prop durch SiteShell und alle fünf Routen — und genau dort sitzt
// die Falle, die der Kommentar in site-shell.tsx beschreibt: eine neue Route
// vergisst es, und dann fehlen auf ihr still die strukturierten Daten.
import type { ReactElement } from "react";

import { aktuellerHost } from "@/lib/host";
import { basisUrl } from "@/lib/seo";
import type { SiteBranding } from "@/lib/site-context";

import { GoogleTag } from "./google-tag";
import { SiteStrukturierteDaten } from "./strukturierte-daten";

export async function SiteKopfdaten({
  branding,
}: {
  branding: SiteBranding | null | undefined;
}): Promise<ReactElement | null> {
  const host = await aktuellerHost();
  // Ohne Host gibt es keine absolute Adresse — und strukturierte Daten mit
  // relativen Adressen sind für Google wertlos. Dann eben keine (Wurzel 4).
  if (!host) return null;
  return (
    <>
      <SiteStrukturierteDaten branding={branding} basisUrl={basisUrl(host)} />
      <GoogleTag branding={branding} />
    </>
  );
}
