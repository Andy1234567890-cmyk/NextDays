// Layout-Group des eingeloggten Gastgeber-Bereichs. Auth-Guard NAH AN DEN DATEN
// (Server Component getMe → Redirect wenn kein Konto), nicht nur in der
// Middleware — die ist kein verlässlicher Auth-Ort (CVE-2025-29927, ADR-0017).
// Airbnb-Host-Muster: Top-Navigation, Content darunter (KEINE Sidebar).
import { redirect } from "next/navigation";

import { HostTopNav } from "@/components/host-topnav";
import { getMe } from "@/lib/me";

import { DiagnoseStarter } from "@/components/diagnose-starter";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const me = await getMe();
  if (!me?.tenant_id) redirect("/anmelden?weiter=/");

  return (
    <div className="min-h-screen bg-background">
      {/* Technischer Fehler-Reporter (kein Verhaltens-Tracking). */}
      <DiagnoseStarter />
      <HostTopNav email={me.email} />
      <main>{children}</main>
    </div>
  );
}
