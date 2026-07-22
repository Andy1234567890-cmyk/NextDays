// Sub-Layout der Einstellungen-Fläche: links die feste Sub-Navigation
// (Konditionen / Zahlungen), rechts der jeweilige Seiteninhalt. Die Auth-Prüfung
// liegt bereits im übergeordneten (dashboard)/layout — hier nur die Anordnung.
// Auf schmalen Screens klappt die Nav über den Inhalt.
//
// Der Zahlungen-Reiter verlangt manage_billing (der Endpunkt erzwingt es
// serverseitig, Wurzel 9). Wir blenden ihn ohne diese Berechtigung aus, damit
// kein toter Reiter erscheint, der beim Öffnen 403 wirft.
import { EinstellungenNav } from "@/components/einstellungen/einstellungen-nav";
import { getMe } from "@/lib/auth";

export default async function EinstellungenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await getMe();
  const grants = new Set([
    ...(me?.permissions ?? []),
    ...(me?.capabilities ?? []),
  ]);
  const canBilling = grants.has("manage_billing");

  return (
    <div className="flex flex-col gap-6 p-6 lg:flex-row lg:gap-8">
      <aside className="w-full shrink-0 lg:w-56">
        <EinstellungenNav canBilling={canBilling} />
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
