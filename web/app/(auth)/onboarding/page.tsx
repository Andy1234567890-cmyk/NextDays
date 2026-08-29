// Onboarding-Setup-Assistent — führt ein frisch registriertes Unternehmen durch
// das Anlegen der Firmendaten (Admin-Konto). Unterkünfte legt der Kunde danach
// im Objekte-Bereich an — das ist bewusst getrennt vom Onboarding.
//
// LIEGT IN (auth), NICHT IN (dashboard): der Assistent ist ein Vollbild-Schritt
// wie Anmeldung und Registrierung, kein Dashboard-Inhalt. In der
// Dashboard-Gruppe brachte er Sidebar und Topbar mit — ein Menü mit fünfzehn
// Einträgen neben einem Formular, bei einem Betrieb, der noch kein einziges
// Objekt hat. Die URL bleibt `/onboarding`; Route-Gruppen stehen nicht im Pfad.
//
// Den Auth-Schutz des Dashboard-Layouts ersetzt die eigene `getSession()`-Prüfung
// unten — sie war schon vorher hier und ist strenger als nötig: nur eine ECHTE
// Abmeldung leitet um.
import { redirect } from "next/navigation";

import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { SupportChatButton } from "@/components/support/support-chat-button";
import { SupportChatProvider } from "@/components/support/support-chat";
import { getSession } from "@/lib/auth";
import { getOnboarding } from "@/lib/onboarding";
import { currentUserEmail } from "@/lib/session-token";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  // getSession statt getMe: nur eine ECHTE Abmeldung (401/403) darf umleiten,
  // ein technischer Fehler nicht (sonst meldet ein 503 den Nutzer ab).
  const { me, abgemeldet } = await getSession();
  if (abgemeldet) redirect("/login");
  if (!me) return null; // technischer Fehler — das Layout zeigt den Hinweis

  const [loginEmail, onboarding] = await Promise.all([
    currentUserEmail(),
    getOnboarding(),
  ]);

  return (
    // `initialStatus` fehlte hier bisher — mit der Folge, dass
    // `firstOpenStep(undefined)` immer "welcome" lieferte: wer den Assistenten
    // unterbrach und über die URL zurückkam, fing wieder bei Schritt 1 an.
    // Über das Dashboard funktionierte die Wiederaufnahme, über diesen Weg nie.
    //
    // Betriebsart vorbelegen, falls der Betrieb sie schon gewählt hat
    // (tenants.accommodation_type) — Onboarding und Konto teilen dieselbe
    // Wahrheit, keine erneute Auswahl.
    // Der Support-Chat gehoert GERADE HIER hin: Im Onboarding steht der Betrieb
    // vor Fragen, die er sonst nirgends stellen kann — Steuernummer, IBAN,
    // Kleinunternehmer-Regelung, welche Portale ueberhaupt gehen. Bis
    // 29.08.2026 hing der Chat ausschliesslich im Dashboard-Layout, und
    // `(auth)` hat keins: wer im Onboarding nicht weiterkam, hatte keinen Weg
    // zu uns und brach ab.
    //
    // Derselbe Provider und derselbe Knopf wie im Dashboard — kein zweites
    // Widget: die Unterhaltung ist dieselbe (`support_tickets` am Tenant), und
    // sie muss nach dem Onboarding im Dashboard weiterlaufen.
    <SupportChatProvider>
      <OnboardingWizard
        initialStatus={onboarding.ok ? onboarding.data : undefined}
        loginEmail={loginEmail}
        initialAccommodationType={me.accommodation_type ?? null}
        initialTenantName={me.tenant_name ?? null}
      />
      <SupportChatButton immerSichtbar />
    </SupportChatProvider>
  );
}
