// Dashboard-Übersicht (Startseite).
// Solange das Onboarding des Tenants nicht abgeschlossen ist, zeigt das
// Dashboard den Setup-Assistenten (ersetzt den Inhalt). Danach erscheint das
// personalisierbare Kachel-Raster (Lastenheft §2.1): echte Kennzahlen aus dem
// Backend, Anordnung/Größe/Sichtbarkeit je Nutzer (dashboard_layout-Slice,
// 0402), Katalog in `lib/dashboard-katalog.ts`.
import { Icon } from "@iconify/react";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { DashboardRaster } from "@/components/dashboard/dashboard-raster";
import { Startbahn } from "@/components/onboarding/startbahn";
import { PaymentsStatusBanner } from "@/components/zahlungen/payments-status-banner";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { Card, CardContent } from "@nextdays/ui/card";
import { getMe } from "@/lib/auth";
import { getNachrichtenKennzahlen } from "@/lib/inbox";
import { getOnboarding, type OnboardingStatus } from "@/lib/onboarding";
import { getEigentuemerVorgaenge } from "@/lib/calendar";
import { getDashboardLayout } from "@/lib/dashboard-layout";
import { getDashboard } from "@/lib/reservations";
import { getTeamaufgabenStand } from "@/lib/tasks";

export const dynamic = "force-dynamic";

/** Zeigt die Startbahn nur, solange sie etwas zu sagen hat. */
function StartbahnWennOffen({ status }: { status: OnboardingStatus }) {
  // Erledigt heißt: Objekt da, Preise da, Kanäle da. Diese drei misst der
  // Server aus der DB (`_real_progress`) — die Liste verschwindet also, wenn
  // der Betrieb wirklich fertig ist, nicht wenn er einmal alles weggeklickt hat.
  const istFertig =
    status.object_created && status.price_set && status.channels_done;
  if (istFertig) return null;
  return <Startbahn status={status} />;
}

export default async function DashboardPage() {
  const t = await getTranslations("nav");
  const [onboarding, me] = await Promise.all([
    getOnboarding(),
    getMe(),
  ]);
  // Rollen-Startseite (§4.2/§4.3): Das Reservierungs-Dashboard verlangt
  // VIEW_CALENDAR. Rollen ohne diese Fähigkeit (staff/cleaner) bekämen hier nur
  // eine 403-Fehlerkarte — deshalb auf ihre operative Startseite leiten, statt
  // sie auf einer toten Seite landen zu lassen.
  if (me && !me.capabilities.includes("view_calendar")) {
    redirect("/reservierungen/aufgaben");
  }

  // Onboarding noch offen → auf den Assistenten leiten.
  //
  // Weiterleitung statt Einbetten: der Assistent ist seit dem Umbau ein
  // Vollbild-Schritt mit eigener Schale (Foto rechts, Fortschritt unten). Hier
  // eingebettet läge er in der Dashboard-Schale und brächte Sidebar und Topbar
  // doppelt mit. `/onboarding` liest denselben Status und nimmt den Faden am
  // ersten offenen Schritt wieder auf.
  const status = onboarding.ok ? onboarding.data : null;
  if (status && !status.completed) {
    redirect("/onboarding");
  }

  // Beide Quellen der Startseite parallel. Die Nachrichten-Kennzahlen sind
  // NICHT kritisch: wer keinen Zugang zum Posteingang hat, bekommt dort eine
  // Absage — dann entfällt der Abschnitt, statt die ganze Seite zu kippen.
  // Eigentuemer-Vorgaenge sind wie die Nachrichten NICHT kritisch: ohne
  // APPROVE_BLOCK antwortet der Endpunkt mit 403 (staff/cleaner, aber auch ein
  // Eigentuemer im eigenen Konto). Dann entfaellt die Kachel, statt die
  // Startseite mit einer Fehlerkarte zu ersetzen.
  // Das Layout ist ebenfalls NICHT kritisch: schlägt der Aufruf fehl, rendert
  // das Raster den Katalog-Standard und SAGT es (Toast + Statuszeile) — statt
  // die Startseite wegen einer Anordnungs-Einstellung zu kippen.
  // Teamaufgaben sind wie die Nachrichten NICHT kritisch: ohne MANAGE_TASKS
  // antwortet der Endpunkt mit 403 — dann entfaellt die Kachel.
  // BEWUSST OHNE Tagesgrenzen: hier laeuft die Uhr des Rechenzentrums, nicht
  // die des Lesers. Der Server liefert deshalb nur den Bestand; „ueberfaellig"
  // und „heute" holt die Kachel im Browser nach, wo die Zone feststeht
  // (Wurzel 4: lieber 0 als eine Zahl aus der falschen Zeitzone).
  const [dashboard, kennzahlen, vorgaenge, aufgaben, layout] = await Promise.all([
    getDashboard(),
    getNachrichtenKennzahlen(),
    getEigentuemerVorgaenge(),
    getTeamaufgabenStand(),
    getDashboardLayout(),
  ]);
  if (!dashboard.ok) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
            <Icon icon="ph:warning-circle" className="size-6" />
          </span>
          <div>
            <p className="font-medium">{t("dashboardLoadFailed")}</p>
            <p className="text-sm text-muted-foreground">{dashboard.error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* `properties` speist die Objekt-Zahlen, `reservations` alle
          Reservierungskarten und KPIs.
          BEWUSST OHNE `portal_messages`/`channex_booking`: beide haben für
          `authenticated` weder `select`-Grant noch Publikationsmitgliedschaft
          (live geprüft), ein Abo darauf wäre eine stumme Attrappe. Der Grant
          ist hier auch nicht nachzuholen — es sind Gastkonversationen, und ein
          tenant-weites Leserecht gäbe sie jeder Rolle frei (Wurzel 6). Der
          Nachrichten-Abschnitt aktualisiert daher beim Seitenaufruf. */}
      <RealtimeRefresh tables={["reservations", "properties", "availability"]} />
      {/* Zahlungs-Status ist Sache der Konto-Führung (MANAGE_BILLING, wie der
          Backend-Endpunkt). Angestellte ohne diese Fähigkeit dürfen den Banner
          gar nicht sehen — sonst käme für sie nur ein 403-Fehler (Wurzel 3). */}
      {/* In der Vorfuehrung nicht: der Banner forderte auf, Auszahlungen
          einzurichten ("um Objekte anzulegen und Buchungen zu empfangen") —
          beides kann ein Demo-Besucher nicht, und beides ist im gezeigten
          Betrieb langst passiert. Er lieferte damit eine Aufgabe, die weder
          erfuellbar noch noetig ist, und liess die Vorfuehrung wie ein halb
          eingerichtetes Konto aussehen. */}
      {!me?.is_demo && me?.capabilities.includes("manage_billing") && (
        <Suspense fallback={null}>
          <PaymentsStatusBanner />
        </Suspense>
      )}
      {/* Die Startbahn führt weiter, wo der Assistent aufhörte: er endete mit
          einem Link auf /objekte und verschwand, die Strecke bis zum
          verkaufsfertigen Objekt (Preise, Sperrtermine, Veröffentlichen) fand
          der Betrieb allein.

          Sie steht ÜBER den Kennzahlen, solange etwas offen ist — ein Betrieb
          ohne veröffentlichtes Objekt hat noch keine Zahlen, die eine
          Kopfposition verdienen. Sobald alles erledigt ist, verschwindet sie
          ersatzlos (`istFertig`), statt als abgehakte Liste liegen zu bleiben.

          Nicht für Demo-Mandanten: dort ist alles längst eingerichtet, und der
          Demo-Riegel (0407) lehnt jede schreibende Aktion ohnehin ab — die
          Liste böte also Aufgaben an, die der Besucher nicht ausführen kann. */}
      {status && !me?.is_demo && <StartbahnWennOffen status={status} />}
      {/* Zugang je Kachel: Rolle/Berechtigung aus `me` (Katalog) UND gelieferte
          Daten (Kachel-Inhalt). Ohne `me` fail-closed — nur Kacheln ohne
          Anforderung. */}
      <DashboardRaster
        daten={{
          dashboard: dashboard.data,
          nachrichten: kennzahlen.ok ? kennzahlen.data : null,
          vorgaenge: vorgaenge.ok ? vorgaenge.data : null,
          aufgaben: aufgaben.ok ? aufgaben.data : null,
        }}
        me={
          me
            ? {
                role: me.role,
                capabilities: me.capabilities,
                permissions: me.permissions,
                is_demo: me.is_demo,
              }
            : { role: null, capabilities: [], permissions: [] }
        }
        antwort={layout.ok ? layout.data : null}
        ladefehler={layout.ok ? null : layout.error}
      />
    </>
  );
}
