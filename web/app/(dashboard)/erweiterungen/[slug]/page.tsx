// Detailseite einer Erweiterung (/erweiterungen/[slug]) — Beschreibung,
// Preis und der „Aktivieren"-Knopf (Lodgify-Marktplatz-Muster).
import { notFound } from "next/navigation";

import { ErweiterungDetail } from "@/components/erweiterungen/erweiterung-detail";
import { erweiterungFuerSlug } from "@/lib/erweiterungen";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const eintrag = erweiterungFuerSlug(slug);
  // Unbekanntes Modul → 404 statt einer leeren Seite mit Aktivieren-Knopf.
  if (!eintrag) notFound();
  return (
    <div className="flex w-full flex-col p-6">
      <ErweiterungDetail eintrag={eintrag} />
    </div>
  );
}
