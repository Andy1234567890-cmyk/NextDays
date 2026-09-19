// Eigentümer-Portal (§4.2) — eigene Route-Gruppe mit eigenem Gerüst.
//
// Getrennt, nicht nur versteckt: der Eigentümer bekommt eine eigene Fläche mit
// eigener Navigation, statt die Agentur-Sidebar gefiltert zu sehen. Genau so
// ist es nativ gelöst (mobile-nextdays/navigation/OwnerTabs.tsx) — ein
// Eigentümer erreicht dort keinen Agentur-Screen, weil er in einem anderen
// Navigator lebt.
//
// Der Zugang ist serverseitig gesperrt (Wurzel 9): `portalGuard()` läuft vor
// jedem Render und lässt ausschließlich die Rolle `owner` durch — fail-CLOSED
// bei fehlender/unbekannter Rolle. Begründung, warum das hier und nicht in der
// Middleware sitzt: lib/rollen-guard.ts.
import { PortalGesperrt } from "@/components/portal/portal-gesperrt";
import { PortalSidebar } from "@/components/portal/portal-sidebar";
import { PortalTopbar } from "@/components/portal/portal-topbar";
import { RealtimeDebugPanel } from "@/components/realtime-debug-panel";
import { SidebarInset, SidebarProvider } from "@nextdays/ui/sidebar";
import { ladePortalRolle } from "@/lib/portal-familie";
import { portalGuard } from "@/lib/rollen-guard";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sitzung = await portalGuard();

  // Technischer Fehler ist KEINE Abmeldung (Wurzel 5): Hinweis zeigen, Sitzung
  // stehen lassen — nicht auf /login werfen.
  if (sitzung.art === "fehler") {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md space-y-2 text-center">
          <p className="text-sm font-medium">
            Die Sitzung konnte nicht geprüft werden.
          </p>
          <p className="text-sm text-muted-foreground">
            {sitzung.meldung} Du bist weiter angemeldet — lade die Seite neu,
            sobald die Verbindung steht.
          </p>
        </div>
      </div>
    );
  }

  // Plattformweite Sperre (0726): der Eigentümer bleibt angemeldet und sieht
  // einen Hinweis statt seiner Objekte. Bewusst OHNE Sidebar und Topbar — ein
  // Menü, dessen Punkte alle ins Leere führen, sieht nach Defekt aus.
  if (sitzung.art === "gesperrt") {
    return <PortalGesperrt hinweis={sitzung.hinweis} />;
  }

  // Was dieser Zugang darf (0389). Ein Ladefehler räumt die Navigation NICHT
  // leer: Voreinstellung ist der Normalfall „Eigentümer, darf alles". Das ist
  // kein Sicherheitsloch — die Endpunkte prüfen selbst, ein überflüssiger
  // Menüpunkt führt höchstens zu einem 403 (Wurzel 5: „konnte nicht laden" ist
  // nicht „darf nicht").
  const rolle = await ladePortalRolle();

  return (
    <SidebarProvider>
      <PortalSidebar
        email={sitzung.me.email ?? ""}
        darfBerichte={rolle.ok ? rolle.data.darf_berichte : true}
        darfZugaenge={rolle.ok ? rolle.data.darf_zugaenge : true}
        // Granulare Berechtigungen aus /auth/me — serverseitig aus der DB
        // gelesen (Wurzel 7), nicht aus einem JWT-Claim abgeleitet. Steuert
        // die drei Punkte Objektbereich/Fotoalbum/Statistiken.
        rechte={sitzung.me.permissions ?? []}
      />
      <SidebarInset>
        <PortalTopbar />
        <main className="flex min-w-0 flex-1 flex-col p-4 md:p-6">
          {children}
        </main>
      </SidebarInset>
      {(process.env.NODE_ENV !== "production" ||
        process.env.NEXT_PUBLIC_REALTIME_DEBUG === "1") && (
        <RealtimeDebugPanel />
      )}
    </SidebarProvider>
  );
}
