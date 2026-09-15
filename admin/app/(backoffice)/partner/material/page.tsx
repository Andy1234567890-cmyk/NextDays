// Werbematerial des Partnerprogramms (affiliate_assets): hochgeladene Dateien
// (Banner, Logos, Presse-PDFs, Videos) sowie der Altbestand aus Textbausteinen
// und Links. Sprache leer = für alle Partner; sonst sieht es nur, wer diese
// Sprache eingestellt hat (plus Englisch als Ersatz, nie Deutsch).
import Link from "next/link";

import { PartnerMaterial } from "@/components/partner-material";
import { getMaterial, getOrdner } from "@/lib/partner";

import { RealtimeRefresh } from "@/components/realtime-refresh";

export default async function MaterialSeite() {
  // Parallel: die beiden Abfragen wissen nichts voneinander, nacheinander wären
  // sie nur langsamer.
  const [material, ordner] = await Promise.all([getMaterial(), getOrdner()]);
  return (
    <div className="px-8 py-8 lg:px-12 lg:py-12">
      {/* Material angelegt/geändert — auch aus einem zweiten Backoffice-Fenster. */}
      <RealtimeRefresh table="affiliate_assets" />
      {/* Und die Reiter: ein zweites Fenster, das einen Ordner anlegt oder
          entfernt, darf hier keine Reiter stehen lassen, die es nicht gibt. */}
      <RealtimeRefresh table="affiliate_asset_folders" />
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="font-sans text-[2rem] font-bold tracking-tight">Werbematerial</h1>
          <p className="mt-2 text-[0.9375rem] text-muted-foreground">
            {material.length} Einträge · Dateien hier ablegen, Partner laden sie unter
            „Links &amp; Material“ in ihrem Dashboard herunter.
          </p>
        </div>
        <Link
          href="/partner"
          className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold transition-colors hover:border-foreground"
        >
          Zurück zu Partner
        </Link>
      </div>
      <PartnerMaterial material={material} ordner={ordner} />
    </div>
  );
}
