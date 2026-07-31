// Objekt-Editor (Server Component lädt das gescopte Objekt, Client rendert den
// Airbnb-„Listing editor"-Look mit myBestDays-Farben). Der Data-Layer
// (getProperty) ist tenant-/owner-gescopet — fremde Objekte → 404 im Backend.
import { notFound } from "next/navigation";

import { ObjektEditor } from "@/components/objekt-editor/objekt-editor";
import { ApiError } from "@/lib/api-server";
import {
  getCohostInvitations,
  getCohosts,
  getPlattformGebuehr,
} from "@/lib/cohosts";
import { getHostProfile, LEERES_PROFIL } from "@/lib/host-profil";
import { getObjektSteuern } from "@/lib/objekt-steuern";
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
  // Resolver/Kalender/Quote buchen. Host-Profil (Airbnb „Über den Gastgeber")
  // parallel laden — user-gebunden, unabhängig vom Objekt. Ein Profil-Ladefehler
  // darf NICHT den ganzen Editor blockieren → auf leeres Profil zurückfallen
  // (der Tab zeigt dann „Details hinzufügen"; kein erfundener Wert, Wurzel 4/5).
  //
  // Co-Gastgeber ebenso fehlertolerant: Ein Ladefehler zeigt den Tab als leer
  // („Einladen"), statt den ganzen Editor zu blockieren.
  const [
    preisStand,
    hostProfile,
    cohosts,
    cohostEinladungen,
    plattformBps,
    objektSteuern,
  ] = await Promise.all([
    getPreisStand(id),
    getHostProfile().catch(() => LEERES_PROFIL),
    getCohosts(id).catch(() => []),
    getCohostInvitations(id).catch(() => []),
    // 0 bei einem Ladefehler: Die Beispielrechnung zeigt dann keine Gebühr,
    // statt einen erfundenen Satz anzuzeigen (Wurzel 4). Die echte Aufteilung
    // rechnet ohnehin das Backend.
    getPlattformGebuehr().catch(() => 0),
    // null bei Ladefehler — das Panel zeigt dann einen Hinweis statt einer
    // leeren Liste, die „keine Steuern" behaupten würde (Wurzel 5).
    getObjektSteuern(id),
  ]);

  return (
    <ObjektEditor
      property={property}
      preisStand={preisStand}
      hostProfile={hostProfile}
      cohosts={cohosts}
      cohostEinladungen={cohostEinladungen}
      plattformBps={plattformBps}
      objektSteuern={objektSteuern}
    />
  );
}
