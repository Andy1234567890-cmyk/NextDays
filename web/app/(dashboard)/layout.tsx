// Dashboard-Gerüst (Server Component): Auth-Gate UND Rollen-Gate. Akzeptiert
// ZWEI Session-Arten:
//  1) FastAPI-Login (httpOnly-Cookies nd_access) -> getMe()
//  2) Supabase-OAuth-Login (z. B. Google) -> Supabase-Session
// Ohne beides: Redirect auf /login. Business-Logik bleibt in FastAPI
// (PROJECT.md §2) — hier nur Session-/Rollen-Prüfung + Durchreichen an die
// Sidebar.
//
// ROLLEN-GATE (Wurzel 9): Ein Eigentümer gehört NICHT in die Agentur-Fläche. Er
// wird hier serverseitig auf sein Portal (/portal) geleitet, bevor irgendein
// Kind gerendert wird. Vorher blendete `OWNER_ALLOWED_HREFS` in der Sidebar nur
// Menüpunkte aus — wer /buchhaltung direkt eintippte, landete trotzdem hier.
// Nicht in der Middleware, weil die laut ADR-0015 keine Auth-Schranke sein darf
// (Middleware-Bypass per `x-middleware-subrequest`); Begründung in
// lib/rollen-guard.ts.
import { redirect } from "next/navigation";

import { PORTAL_ROLLEN } from "@/lib/rollen-guard";

import { AppSidebar } from "@/components/app-sidebar";
// Der Sprach-Assistent ist abgeschaltet (siehe unten) — Import bewusst nicht
// vorhanden, damit kein toter Code im Bundle landet.
import { RealtimeDebugPanel } from "@/components/realtime-debug-panel";
import { DemoBand } from "@/components/demo-band";
import { Topbar } from "@/components/topbar";
import { SupportChatButton } from "@/components/support/support-chat-button";
import { SupportChatProvider } from "@/components/support/support-chat";
import { SidebarInset, SidebarProvider } from "@nextdays/ui/sidebar";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { DiagnoseStarter } from "@/components/diagnose-starter";
import { MfaPflichtHinweis } from "@/components/auth/mfa-pflicht-hinweis";
import { getMfaStatus } from "@/lib/mfa";
import { AnkuendigungPopup } from "@/components/announcements/ankuendigung-popup";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 1) FastAPI-Session?
  //
  // `getSession()` statt `getMe()`, weil hier über An-/Abmeldung ENTSCHIEDEN
  // wird: ein technischer Fehler ist keine Abmeldung (Wurzel 5). Vorher warf
  // jeder 503/500 den eingeloggten Nutzer mitten in der Arbeit auf /login.
  const sitzung = await getSession();
  const me = sitzung.me;
  const sitzungspruefungFehler = sitzung.fehler;
  if (sitzungspruefungFehler) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md space-y-2 text-center">
          <p className="text-sm font-medium">
            Die Sitzung konnte nicht geprüft werden.
          </p>
          <p className="text-sm text-muted-foreground">
            {sitzungspruefungFehler} Du bist weiter angemeldet — lade die Seite
            neu, sobald die Verbindung steht.
          </p>
        </div>
      </div>
    );
  }

  // Rollen-Gate: Eigentümer gehören in ihr Portal, nicht in die Agentur-Fläche.
  // Steht VOR jeder weiteren Arbeit und vor dem Render der Kinder, damit auch
  // ein direkt eingetippter Agentur-Pfad (/buchhaltung, /channels …) hier
  // endet. `redirect()` wirft — es gibt keinen Weg daran vorbei.
  if (me?.role && PORTAL_ROLLEN.has(me.role)) redirect("/portal");

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

  // 2FA-Pflicht: Status EINMAL serverseitig holen. Ob die Rolle einen Faktor
  // BRAUCHT, entscheidet das Backend (`mfa_required`, Rolle aus der DB) — nicht
  // die Rolle aus dem JWT, die hier nur fuer die Navigation dient (Wurzel 7).
  // Bei einem Fehler wird NICHT gemahnt: eine Mahnung auf Verdacht waere eine
  // Falschaussage (Wurzel 4/5).
  const mfa = await getMfaStatus();
  // In der Vorfuehrung nicht mahnen (0407): einrichten KANN der Besucher den
  // zweiten Faktor nicht — das Enrollment ist ein Schreibvorgang, den der
  // Demo-Riegel ablehnt. Eine Mahnung mit Frist, die niemand erfuellen kann,
  // ist eine Aufforderung ins Leere und sieht nach einem Defekt aus.
  const zweiterFaktorFehlt =
    !me?.is_demo &&
    mfa.ok &&
    mfa.data.mfa_required &&
    !mfa.data.mfa_enrolled;
  // Echte Restfrist aus dem Backend (ISO) — nie selbst berechnet.
  const mfaFrist = mfa.ok ? mfa.data.mfa_grace_until : null;

  return (
    <SidebarProvider>
      {/* Live-Chat mit dem Team: liegt im Layout, damit die Unterhaltung beim
          Navigieren offen bleibt und der Ungelesen-Zähler überall stimmt. */}
      <SupportChatProvider>
        {/* Technischer Fehler-Reporter (kein Verhaltens-Tracking). */}
        <DiagnoseStarter />
        {/* Offizielle Ankündigungen des Plattform-Teams: einmal pro Sitzung
            nach dem Login. Zielgruppe sind ausschließlich die Entscheider des
            Betriebs — staff/cleaner sollen von einer Wartungsmeldung nicht
            unterbrochen werden, Eigentümer sind durch den Redirect oben
            (Zeile 66) ohnehin schon draußen. Das Gate steht HIER, weil das
            Layout die Rolle bereits kennt und die Komponente sonst für jede
            Rolle einen Server-Aufruf auslösen würde.

            NICHT in der Vorführung (0407): das Popup quittiert beim Schließen
            serverseitig, dass es gelesen wurde — ein Schreibvorgang, den der
            Demo-Riegel mit 405 ablehnt. Das Popup blieb dadurch stehen und
            versperrte die ganze Vorführung. Es hier auszulassen ist auch
            fachlich richtig: eine Produktankündigung an das eigene Team hat
            einen Interessenten nicht zu unterbrechen. */}
        {!me?.is_demo && (role === "admin" || role === "co_admin") && (
          <AnkuendigungPopup />
        )}
        <AppSidebar
          email={email}
          role={role}
          permissions={permissions}
          capabilities={capabilities}
          accommodationType={accommodationType}
          country={me?.country ?? null}
          istDemo={Boolean(me?.is_demo)}
        />
        <SidebarInset>
          {/* Ueber allem, auch ueber der Topbar: der Besucher soll wissen, wo
              er ist, BEVOR er etwas anklickt (0407). */}
          {me?.is_demo && <DemoBand />}
          <Topbar />
          {/* Inhaltsbereich — hier kommen später KPI-Kacheln & Charts hinein. */}
          <main className="flex min-h-0 min-w-0 flex-1 flex-col p-4 md:p-6">
            {zweiterFaktorFehlt && <MfaPflichtHinweis fristIso={mfaFrist} />}
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
