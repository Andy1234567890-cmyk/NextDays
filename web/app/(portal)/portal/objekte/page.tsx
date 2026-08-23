// Eigentümer-Portal · Objektbereich, Liste (pm_property_area, §4.2 read-only).
//
// Zeigt AUSSCHLIESSLICH die dem Eigentümer zugeordneten Objekte — die Liste
// kommt aus dem owner-gescopten /public-portal/properties, nicht aus der
// Agentur-API. Verlinkt wird nur nach /portal/objekte/[id]; es gibt von hier
// keinen Weg in eine `(app)`-Route.
//
// WARUM DIESE LISTE DEN BESTEHENDEN, UNGEGUARDETEN ENDPUNKT NUTZT:
// Sie zeigt Titel, Ort und Bild — exakt das, was der Eigentümer auf `/portal`
// ohnehin sieht. Ein zweiter, geguardeter Listen-Endpunkt wäre Doppelung ohne
// Sicherheitsgewinn. Die erzwungene Prüfung von `pm_property_area` sitzt am
// DETAIL-Endpunkt (/public-portal/properties/{id}), und dort liegt auch der
// Inhalt, den das Recht schützt.
//
// DIE PRÜFUNG HIER IST NAVIGATIONS-KOSMETIK, KEINE SICHERHEIT. Sie sorgt nur
// dafür, dass jemand ohne das Recht einen verständlichen Hinweis sieht statt
// einer Liste, deren jeder Eintrag ihn in einen 403 führt. Wer die Prüfung
// umgeht, gewinnt nichts: der Detail-Endpunkt prüft selbst, und die Liste
// selbst gibt nichts preis, was `/portal` nicht schon zeigt. Die Rechte kommen
// aus /auth/me, also serverseitig aus der DB (Wurzel 7) — nicht aus einem
// JWT-Claim.
import { getTranslations } from "next-intl/server";

import { PortalObjekte } from "@/components/portal/portal-objekte";
import { Card, CardContent } from "@nextdays/ui/card";
import { getOwnerProperties } from "@/lib/portal";
import { portalGuard } from "@/lib/rollen-guard";

export const dynamic = "force-dynamic";

export default async function PortalObjektePage() {
  const sitzung = await portalGuard();
  // `art === "fehler"` fängt bereits das Layout ab und rendert die Kinder nicht;
  // die Abfrage steht hier nur, damit der Typ eng bleibt.
  const rechte = sitzung.art === "ok" ? (sitzung.me.permissions ?? []) : [];

  if (!rechte.includes("pm_property_area")) {
    const t = await getTranslations("portal.propertyArea");
    return (
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="font-display text-3xl font-extrabold">{t("title")}</h1>
        </header>
        {/* Ohne Iconify: diese Seite rendert serverseitig, und `Icon` aus
            @iconify/react ist eine Client-Komponente (Hooks). In einer
            Server-Komponente bricht sie erst zur Laufzeit — weder `tsc` noch
            ESLint sehen das. */}
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <p className="max-w-md text-sm text-muted-foreground">
              {t("noPermission")}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const objekte = await getOwnerProperties();
  return (
    <PortalObjekte
      properties={objekte.ok ? objekte.data.items : []}
      error={objekte.ok ? null : objekte.error}
    />
  );
}
