// Eigentümer-Portal · Objektbereich, Detail (pm_property_area, §4.2 read-only).
//
// SCOPE: die ID aus der Adresszeile wird NICHT geprüft-und-durchgereicht,
// sondern ausschließlich an den owner-gescopten Endpunkt gegeben. Ein fremdes
// oder unbekanntes Objekt beantwortet das Backend mit 404 (nicht 403 — die
// Existenz fremder Objekte wird nicht verraten), und genau das zeigt die Fläche
// dann an. Der Item-Pfad prüft damit denselben Scope wie der Listen-Pfad
// (Wurzel 9).
//
// BILDER: der Abschnitt hängt am eigenen Recht `pm_view_property_images`. Die
// Prüfung hier ist Kosmetik — sie verhindert nur einen sinnlosen 403 und ein
// leeres Kästchen; die Sicherheit hängt am Endpunkt
// (/public-portal/properties/{id}/images prüft dasselbe Recht selbst). Die
// Rechte kommen aus /auth/me, also serverseitig aus der DB (Wurzel 7).
import { PortalObjektDetail } from "@/components/portal/portal-objekt-detail";
import {
  getOwnerProperty,
  getOwnerPropertyImages,
} from "@/lib/portal";
import { portalGuard } from "@/lib/rollen-guard";

export const dynamic = "force-dynamic";

export default async function PortalObjektDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sitzung = await portalGuard();
  // `art === "fehler"` fängt bereits das Layout ab und rendert die Kinder nicht;
  // die Abfrage steht hier nur, damit der Typ eng bleibt. Fail-closed: ohne
  // belegbare Rechte kein Bilder-Abschnitt.
  const rechte =
    sitzung.art === "ok" ? (sitzung.me.permissions ?? []) : [];
  const darfBilder = rechte.includes("pm_view_property_images");

  const [objekt, bilder] = await Promise.all([
    getOwnerProperty(id),
    // Ohne das Recht wird gar nicht erst gefragt — ein 403 im Log ist kein
    // Erkenntnisgewinn.
    darfBilder
      ? getOwnerPropertyImages(id)
      : Promise.resolve(null),
  ]);

  return (
    <PortalObjektDetail
      property={objekt.ok ? objekt.data : null}
      error={objekt.ok ? null : objekt.error}
      zeigtBilder={darfBilder}
      bilder={bilder && bilder.ok ? bilder.data.items : []}
      bilderError={bilder && !bilder.ok ? bilder.error : null}
    />
  );
}
