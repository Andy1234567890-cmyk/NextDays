// Objekt-Editor (Server Component lädt das gescopte Objekt, Client rendert den
// Airbnb-„Listing editor"-Look mit myNextDays-Farben). Der Data-Layer
// (getProperty) ist tenant-/owner-gescopet — fremde Objekte → 404 im Backend.
import { notFound } from "next/navigation";

import { ObjektEditor } from "@/components/objekt-editor/objekt-editor";
import { ApiError } from "@/lib/api-server";
import { getPreisStand } from "@/lib/preise";
import { getProperty } from "@/lib/properties";

export default async function ObjektEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let property;
  try {
    property = await getProperty(id);
  } catch (exc) {
    if (exc instanceof ApiError && (exc.status === 404 || exc.status === 403)) {
      notFound();
    }
    throw exc;
  }

  // Preis-Stand aus den echten Quellen (rate_plans/dp_settings/property_discounts),
  // NICHT aus dem type_attributes-Blob — sonst zeigt der Editor andere Preise als
  // Resolver/Kalender/Quote buchen.
  const preisStand = await getPreisStand(id);

  return <ObjektEditor property={property} preisStand={preisStand} />;
}
