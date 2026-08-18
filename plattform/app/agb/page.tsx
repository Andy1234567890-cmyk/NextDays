// Die Gast-AGB heißen jetzt „Nutzungsbedingungen" und liegen unter
// /rechtliches/nutzungsbedingungen — zusammen mit allen übrigen Rechtstexten.
// /agb bleibt als dauerhafte Weiterleitung bestehen, weil der Pfad verlinkt
// und indexiert ist; es gibt aber nur EINEN Ort, an dem der Text gerendert wird.
import { permanentRedirect } from "next/navigation";

import { isLegalLocale } from "@/content/legal/locales";

export default async function AgbPage({
  searchParams,
}: {
  searchParams: Promise<{ sprache?: string }>;
}) {
  const { sprache } = await searchParams;
  const ziel = "/rechtliches/nutzungsbedingungen";
  permanentRedirect(isLegalLocale(sprache) ? `${ziel}?sprache=${sprache}` : ziel);
}
