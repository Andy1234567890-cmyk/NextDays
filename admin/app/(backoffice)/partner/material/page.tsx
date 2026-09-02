// Werbematerial des Partnerprogramms (affiliate_assets): Videos, Bilder,
// Textbausteine, Links. Sprache leer = für alle Partner; sonst sieht es nur,
// wer diese Sprache eingestellt hat (plus Englisch als Ersatz, nie Deutsch).
import Link from "next/link";

import { PartnerMaterial } from "@/components/partner-material";
import { getMaterial } from "@/lib/partner";

export default async function MaterialSeite() {
  const material = await getMaterial();
  return (
    <div className="px-8 py-8 lg:px-12 lg:py-12">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="font-sans text-[2rem] font-bold tracking-tight">Werbematerial</h1>
          <p className="mt-2 text-[0.9375rem] text-muted-foreground">
            {material.length} Einträge · erscheinen unter „Links &amp; Material“ im Partner-Dashboard.
          </p>
        </div>
        <Link
          href="/partner"
          className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold transition-colors hover:border-foreground"
        >
          Zurück zu Partner
        </Link>
      </div>
      <PartnerMaterial material={material} />
    </div>
  );
}
