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
import { PortalSidebar } from "@/components/portal/portal-sidebar";
import { PortalTopbar } from "@/components/portal/portal-topbar";
import { RealtimeDebugPanel } from "@/components/realtime-debug-panel";
import { SidebarInset, SidebarProvider } from "@nextdays/ui/sidebar";
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

  return (
    <SidebarProvider>
      <PortalSidebar email={sitzung.me.email ?? ""} />
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
