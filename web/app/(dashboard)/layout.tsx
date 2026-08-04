// Dashboard-Gerüst (Server Component): Auth-Gate. Akzeptiert ZWEI Session-Arten:
//  1) FastAPI-Login (httpOnly-Cookies nd_access) -> getMe()
//  2) Supabase-OAuth-Login (z. B. Google) -> Supabase-Session
// Ohne beides: Redirect auf /login. Business-Logik bleibt in FastAPI
// (PROJECT.md §2) — hier nur Session-Prüfung + Durchreichen an die Sidebar.
import { redirect } from "next/navigation";

import { AppSidebar } from "@/components/app-sidebar";
// Der Sprach-Assistent ist abgeschaltet (siehe unten) — Import bewusst nicht
// vorhanden, damit kein toter Code im Bundle landet.
import { RealtimeDebugPanel } from "@/components/realtime-debug-panel";
import { Topbar } from "@/components/topbar";
import { SupportChatButton } from "@/components/support/support-chat-button";
import { SupportChatProvider } from "@/components/support/support-chat";
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
      {/* Live-Chat mit dem Team: liegt im Layout, damit die Unterhaltung beim
          Navigieren offen bleibt und der Ungelesen-Zähler überall stimmt. */}
      <SupportChatProvider>
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
          <main className="flex min-w-0 flex-1 flex-col p-4 md:p-6">
            {children}
          </main>
        </SidebarInset>
        {/* Support-Chat-Knopf: der schwebende Weg zum Team, bleibt beim
          Navigieren bestehen.

          An dieser Stelle schwebte vorher der Sprach-Assistent „Andy"
          (`DashboardVoiceAssistant`). Er ist ABGESCHALTET, nicht entfernt: die
          Sprachsteuerung ist noch nicht fertig, und ein Knopf zu einer
          halbfertigen Funktion kostet Vertrauen. Zum Wiedereinschalten den
          Import und die Zeile
          `<DashboardVoiceAssistant userLabel={email || null} />` zurückholen. */}
        <SupportChatButton />
        {/* Realtime-Overlay: zeigt je Seite, ob die Abos wirklich verbinden und
          Events ankommen. Beide Bedingungen sind Build-Zeit-Konstanten, in
          Produktion faellt die Komponente also aus dem Bundle — sie zeigt
          Tabellennamen und Filter inkl. tenant_id im Klartext. Auf Staging per
          NEXT_PUBLIC_REALTIME_DEBUG=1 zuschaltbar. */}
        {(process.env.NODE_ENV !== "production" ||
          process.env.NEXT_PUBLIC_REALTIME_DEBUG === "1") && <RealtimeDebugPanel />}
      </SupportChatProvider>
    </SidebarProvider>
  );
}
