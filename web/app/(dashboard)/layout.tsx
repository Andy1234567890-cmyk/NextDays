// Dashboard-Gerüst (Server Component): Auth-Gate. Akzeptiert ZWEI Session-Arten:
//  1) FastAPI-Login (httpOnly-Cookies nd_access) -> getMe()
//  2) Supabase-OAuth-Login (z. B. Google) -> Supabase-Session
// Ohne beides: Redirect auf /login. Business-Logik bleibt in FastAPI
// (PROJECT.md §2) — hier nur Session-Prüfung + Durchreichen an die Sidebar.
import { redirect } from "next/navigation";

import { AppSidebar } from "@/components/app-sidebar";
import { DashboardVoiceAssistant } from "@/components/dashboard/voice-assistant";
import { RealtimeDebugPanel } from "@/components/realtime-debug-panel";
import { Topbar } from "@/components/topbar";
import { SidebarInset, SidebarProvider } from "@nextdays/ui/sidebar";
import { getMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { DiagnoseStarter } from "@/components/diagnose-starter";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 1) FastAPI-Session?
  const me = await getMe();

  // 2) Sonst Supabase-OAuth-Session?
  let email = me?.email ?? "";
  let role = me?.role ?? null;
  let permissions = me?.permissions ?? [];
  let capabilities = me?.capabilities ?? [];
  const accommodationType = me?.accommodation_type ?? "vacation_rental";

  if (!me) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");
    email = user.email ?? "";
    // Rolle/Berechtigungen kommen später aus dem FastAPI-Profil; vorerst leer.
    role = null;
    permissions = [];
    capabilities = [];
  }

  return (
    <SidebarProvider>
      {/* Technischer Fehler-Reporter (kein Verhaltens-Tracking). */}
      <DiagnoseStarter />
      <AppSidebar
        email={email}
        role={role}
        permissions={permissions}
        capabilities={capabilities}
        accommodationType={accommodationType}
      />
      <SidebarInset>
        <Topbar />
        {/* Inhaltsbereich — hier kommen später KPI-Kacheln & Charts hinein. */}
        <main className="flex min-w-0 flex-1 flex-col p-4 md:p-6">{children}</main>
      </SidebarInset>
      {/* Andy lebt im Layout → bleibt beim Navigieren auf jeder Seite bestehen
          und laedt seine Daten selbst. */}
      <DashboardVoiceAssistant userLabel={email || null} />
    </SidebarProvider>
  );
}
