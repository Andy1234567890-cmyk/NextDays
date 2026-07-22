// Konto-Bereich: Unter-Navigation (Profil/Nutzer/Sicherheit) links, Inhalt rechts.
// Liegt in der (dashboard)-Gruppe, behält also Sidebar + Topbar. Die Tabs werden
// nach Rolle/Berechtigung gefiltert (Daten aus /auth/me), damit niemand auf
// Tabs landet, die für ihn 403/„Kein Zugriff" liefern.
import { KontoNav } from "@/components/konto/konto-nav";
import { getMe } from "@/lib/auth";

export default async function KontoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await getMe();
  return (
    <div className="flex flex-1 flex-col gap-8 md:flex-row md:gap-12">
      <aside className="md:w-48 md:shrink-0">
        <KontoNav
          role={me?.role ?? null}
          capabilities={me?.capabilities ?? []}
          permissions={me?.permissions ?? []}
        />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
