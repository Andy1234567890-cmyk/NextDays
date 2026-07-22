// Layout-Group des eingeloggten Gastgeber-Bereichs. Auth-Guard NAH AN DEN DATEN
// (Server Component getMe → Redirect wenn kein Konto), nicht nur in der
// Middleware — die ist kein verlässlicher Auth-Ort (CVE-2025-29927, ADR-0017).
// Host-Sidebar links, Content rechts (@nextdays/ui Sidebar-Primitive).
import { redirect } from "next/navigation";

import { SidebarInset, SidebarProvider, SidebarTrigger } from "@nextdays/ui/sidebar";

import { HostSidebar } from "@/components/host-sidebar";
import { getMe } from "@/lib/me";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const me = await getMe();
  if (!me?.tenant_id) redirect("/anmelden?weiter=/");

  return (
    <SidebarProvider>
      <HostSidebar />
      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b border-border px-4">
          <SidebarTrigger />
        </header>
        <div className="flex-1">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
