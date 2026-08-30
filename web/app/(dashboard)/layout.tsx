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
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getOnboarding } from "@/lib/onboarding";
import { PORTAL_ROLLEN } from "@/lib/rollen-guard";
import { PFAD_HEADER } from "@/lib/demo-cookie";
import { loginMitZiel } from "@/lib/rueckziel";

import { AppSidebar } from "@/components/app-sidebar";
// Der Sprach-Assistent ist abgeschaltet (siehe unten) — Import bewusst nicht
// vorhanden, damit kein toter Code im Bundle landet.
import { RealtimeDebugPanel } from "@/components/realtime-debug-panel";
import { DemoBand } from "@/components/demo-band";
import { TestphaseBand } from "@/components/testphase-band";
import { Topbar } from "@/components/topbar";
import { SupportChatButton } from "@/components/support/support-chat-button";
import { SupportChatProvider } from "@/components/support/support-chat";
import { SidebarInset, SidebarProvider } from "@nextdays/ui/sidebar";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { DiagnoseStarter } from "@/components/diagnose-starter";
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
    if (!user) {
      // Mit RUECKZIEL, damit die Anmeldung dort endet, wo der Nutzer hin
      // wollte. Ohne das landete jeder auf dem Dashboard — wer aus einer
      // Benachrichtigungs-Mail auf eine bestimmte Aufgabe geklickt hatte,
      // musste sie sich danach in seiner Liste wiedersuchen. Den Pfad kennt
      // eine Server Component nicht selbst; die Middleware reicht ihn als
      // Header herein. Fehlt er, bleibt es beim nackten `/login`.
      redirect(loginMitZiel((await headers()).get(PFAD_HEADER)));
    }
    email = user.email ?? "";
    // Rolle/Berechtigungen kommen später aus dem FastAPI-Profil; vorerst leer.
    role = null;
    permissions = [];
    capabilities = [];
  }

  // Firmendaten + Abo: ohne beides ist die Oberflaeche eine SACKGASSE.
  // Ein Objekt laesst sich dann nicht veroeffentlichen (`publish` lehnt mit
  // 422 ab: kein Abrechnungsprofil, kein Abo), Geld kann nicht ankommen, und
  // jeder Menuepunkt fuehrt auf eine Seite, an der der Betrieb nichts
  // ausrichten kann. Statt ihn dort suchen zu lassen, bleibt die Navigation
  // gesperrt, bis die Einrichtung steht — sichtbar, damit der Umfang der
  // Software erkennbar bleibt (dieselbe Entscheidung wie beim Vorfuehr-Zugang,
  // 0408).
  //
  // Beides wird SERVERSEITIG gemessen (`/dashboard/onboarding`), nicht aus
  // einem Flag gelesen: `company_data_set` stand am 29.08.2026 in 4 Betrieben
  // auf `true`, waehrend es in der ganzen DB genau EIN Abrechnungsprofil gab.
  //
  // Nur fuer die Entscheider: staff/cleaner richten nichts ein, ihnen wuerde
  // eine gesperrte Oberflaeche nur den Weg zu ihrer Arbeit verstellen.
  //
  // NIEMALS im Vorfuehr-Zugang: der hat naturgemaess weder Firmendaten noch
  // Abo, und die neue Regel wuerde ihm die halbe Oberflaeche zusperren, die er
  // gerade zeigen soll. Die Demo behaelt AUSSCHLIESSLICH ihre eigene Sperre
  // (`demo-sperre.ts`, unveraendert).
  let einrichtungOffen = false;
  // Laeuft die kostenlose Testphase? Kommt aus demselben Abruf — ein zweiter
  // waere pro Seitenaufruf eine weitere Rundreise fuer eine Zahl, die schon
  // unterwegs ist. `null` heisst „laeuft keine": das Band erscheint dann gar
  // nicht, und ein fehlendes Datum bei laufender Testphase zeigt es ohne Tag
  // statt mit einem gerechneten (Wurzel 4).
  let testphaseEndet: string | null = null;
  let inTestphase = false;
  if (!me?.is_demo && (role === "admin" || role === "co_admin")) {
    const stand = await getOnboarding();
    einrichtungOffen =
      stand.ok && !(stand.data.company_data_set && stand.data.subscription_active);
    if (stand.ok) {
      inTestphase = stand.data.in_trial;
      testphaseEndet = stand.data.trial_ends_at;
    }
  }

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
          istIntern={Boolean(me?.is_internal)}
          einrichtungOffen={einrichtungOffen}
        />
        <SidebarInset>
          {/* Ueber allem, auch ueber der Topbar: der Besucher soll wissen, wo
              er ist, BEVOR er etwas anklickt (0407). */}
          {me?.is_demo && <DemoBand />}
          {inTestphase && <TestphaseBand endetAm={testphaseEndet} />}
          <Topbar />
          {/* Inhaltsbereich — hier kommen später KPI-Kacheln & Charts hinein. */}
          <main className="flex min-h-0 min-w-0 flex-1 flex-col p-4 md:p-6">
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
