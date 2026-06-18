// Konto-Bereich: Unter-Navigation (Profil/Nutzer/Sicherheit) links, Inhalt rechts.
// Liegt in der (dashboard)-Gruppe, behält also Sidebar + Topbar.
import { KontoNav } from "@/components/konto/konto-nav";

export default function KontoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col gap-8 md:flex-row md:gap-12">
      <aside className="md:w-48 md:shrink-0">
        <KontoNav />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
