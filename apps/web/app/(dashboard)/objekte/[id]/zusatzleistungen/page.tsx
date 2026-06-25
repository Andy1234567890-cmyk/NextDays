// Objekt → Zusatzleistungen (Upsells, wie Hostaway/Guesty): optionale Extras,
// die Gäste auf der Buchungsstrecke ODER nach der Buchung dazubuchen
// (Früh-Check-in, Late-Check-out, Reinigung, Transfer, Frühstück …). Katalog je
// Objekt: Name/Beschreibung mehrsprachig, Medien, Preis + Abrechnungsbasis,
// optional/pflicht, „erscheint in", „wann anzeigen", aktiv, Reihenfolge.
import { AddonsManager } from "@/components/objekte/addons-manager";
import { listAddons } from "@/lib/addons";
import { getProperty } from "@/lib/properties";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [prop, addons] = await Promise.all([getProperty(id), listAddons(id)]);
  if (!prop.ok) {
    return (
      <div className="text-sm text-destructive">
        Objekt konnte nicht geladen werden: {prop.error}
      </div>
    );
  }
  return (
    <AddonsManager
      propertyId={id}
      initial={addons.ok ? addons.data.items : []}
      currency={addons.ok ? addons.data.currency : null}
    />
  );
}
