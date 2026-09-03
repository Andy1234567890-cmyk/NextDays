// Welche Flächen des Eigentümer-Portals die App anbietet.
//
// WARUM EINE EIGENE DATEI: Die vier Rechte `pm_property_area`,
// `pm_view_property_images`, `pm_photo_album` und `pm_nonrevenue_charts`
// entscheiden an DREI Stellen mit — im Tab-Navigator, in der Objektliste und im
// Objekt-Detail. Verteilt man die Abfragen dorthin, driften sie
// auseinander: ein Tab erscheint, dessen Detailseite 403 liefert, oder eine
// Objektzeile ist antippbar und öffnet einen leeren Screen. Hier steht die
// Antwort genau einmal.
//
// Der Server ist und bleibt die Autorität (Guard-Permission + Capability je
// Endpunkt, siehe public_portal-Slice). Diese Datei macht NICHTS auf, was der
// Server nicht ohnehin erlaubt — sie versteckt nur, was er abweisen würde.
// Fail-closed: ohne geladenes Konto ist alles aus (Wurzel 5).
import type { Me } from "@/contexts/AuthContext";
import { can } from "@/lib/permissions";

export type OwnerFlaechen = {
  /** Objektbereich: Objekt-Detail lesend (GET /public-portal/properties/{id}). */
  objektbereich: boolean;
  /** Bilder-Abschnitt IM Objekt-Detail (GET …/{id}/images). */
  objektbilder: boolean;
  /** Fotoalbum über alle zugeordneten Objekte (GET /public-portal/photo-album). */
  fotoalbum: boolean;
  /** Nicht-Umsatz-Statistiken (GET /public-portal/statistics). */
  statistiken: boolean;
};

export function ownerFlaechenFor(me: Me | null): OwnerFlaechen {
  return {
    objektbereich: can(me, "pm_property_area"),
    objektbilder: can(me, "pm_view_property_images"),
    fotoalbum: can(me, "pm_photo_album"),
    statistiken: can(me, "pm_nonrevenue_charts"),
  };
}
