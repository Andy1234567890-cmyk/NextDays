// Kontoeinstellungen (Server Component) wie Airbnbs /account-settings: linke
// Bereichs-Nav, rechts der aktive Abschnitt (aus ?bereich=). Echte Konto-Daten
// aus /auth/account; Bereiche ohne Backend zeigen ehrlich „In Vorbereitung"
// (kein Erfinden, Wurzel 5). Der Kopf (Logo + „Fertig") sitzt im Layout.
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { AuszahlungenTab } from "@/components/konto/auszahlungen-tab";
import { BenachrichtigungenAbschnitt } from "@/components/konto/benachrichtigungen-abschnitt";
import { Dac7Meldung } from "@/components/konto/dac7-meldung";
import { SteuernAbschnitt } from "@/components/konto/steuern-abschnitt";
import { DatenschutzAbschnitt } from "@/components/konto/datenschutz-abschnitt";
import { KontoNav } from "@/components/konto/konto-nav";
import { KontostandTab } from "@/components/konto/kontostand-tab";
import { PersoenlichAbschnitt } from "@/components/konto/persoenlich-abschnitt";
import { SicherheitAbschnitt } from "@/components/konto/sicherheit-abschnitt";
import { SpendenTab } from "@/components/konto/spenden-tab";
import { SpracheAbschnitt } from "@/components/konto/sprache-abschnitt";
import { SupportDiagnose } from "@/components/konto/support-diagnose";
import { UnternehmenTab } from "@/components/konto/unternehmen-tab";
import { VorbereitungAbschnitt } from "@/components/konto/vorbereitung-abschnitt";
import { ZahlungenAbschnitt } from "@/components/konto/zahlungen-abschnitt";
import { ZahlungenTabs } from "@/components/konto/zahlungen-tabs";
import { getAuszahlungsUebersicht, getStripeGuthaben } from "@/lib/auszahlungen";
import { getNotificationOverview } from "@/lib/benachrichtigungen";
import { getMeldelaeufe } from "@/lib/dac7";
import { getObjektangaben, getTaxpayerOverview } from "@/lib/steuern";
import { getPrivacySettings } from "@/lib/datenschutz";
import { getDebugSessions } from "@/lib/diagnose";
import { getAccount } from "@/lib/konto";
import {
  getAuszahlungsKontoId,
  getAuszahlungsStatus,
  getPaymentSettings,
} from "@/lib/payments";
import { getSpendenUebersicht } from "@/lib/spenden";
import { getUnternehmensprofil } from "@/lib/unternehmen";

// Bereiche ohne eigenes Backend → Platzhalter, aber in der Nav sichtbar (wie
// Airbnb): Titel-Key je Bereich.
const VORBEREITUNG: Record<string, string> = {
  buchungsrechte: "navBuchungsrechte",
  profitools: "navProfiTools",
};

export default async function KontoPage({
  searchParams,
}: {
  searchParams: Promise<{ bereich?: string; tab?: string }>;
}) {
  const [account, t, { bereich, tab }] = await Promise.all([
    getAccount(),
    getTranslations("konto"),
    searchParams,
  ]);

  if (!account) redirect("/anmelden?weiter=/konto");
  const aktiv = bereich ?? "persoenlich";
  const zahlungenTab = tab ?? "zahlungen";

  const settings = aktiv === "zahlungen" ? await getPaymentSettings() : null;
  // Spenden nur laden, wenn der Reiter auch offen ist — ein zusätzlicher
  // Backend-Aufruf je Seitenaufruf wäre sonst reine Last.
  const spenden =
    aktiv === "zahlungen" && zahlungenTab === "spenden"
      ? await getSpendenUebersicht()
      : null;

  // Stripe-Konto: Kennung + Live-Status braucht der Zahlungen-Reiter (Schritte
  // und offene Anforderungen), der Auszahlungs-Reiter (Bank) und die
  // Vermieterdaten (persönliche Kennnummer). Der Live-Status kostet einen
  // Aufruf beim Zahlungsanbieter — nur holen, wenn ein Konto existiert.
  const auszahlungenOffen =
    aktiv === "zahlungen" && zahlungenTab === "auszahlungen";
  const stripeNoetig =
    (aktiv === "zahlungen" && zahlungenTab !== "spenden") || aktiv === "unternehmen";
  const kontostandOffen = aktiv === "zahlungen" && zahlungenTab === "kontostand";
  const [auszahlungen, kontoId, guthaben] = await Promise.all([
    auszahlungenOffen || kontostandOffen ? getAuszahlungsUebersicht() : null,
    stripeNoetig ? getAuszahlungsKontoId() : null,
    // Stripe-Saldo nur für den Kontostand — ein echter Stripe-Aufruf.
    kontostandOffen ? getStripeGuthaben() : null,
  ]);
  const kontoStatus = kontoId ? await getAuszahlungsStatus(kontoId) : null;

  // Vermieterdaten: eigener Bereich UND Quelle für Land/Kontoinhaber im
  // Auszahlungs-Reiter und für die Schritte der Stripe-Einrichtung.
  const unternehmen = stripeNoetig ? await getUnternehmensprofil() : null;
  const privacy = aktiv === "datenschutz" ? await getPrivacySettings() : null;
  // Diagnose-Freigaben gehören thematisch zum Datenschutz — der Kunde
  // steuert dort, wer wann Einblick in seine Fehlerdaten hat.
  const debugSessions =
    aktiv === "datenschutz" ? await getDebugSessions().catch(() => []) : [];
  const benachrichtigungen =
    aktiv === "benachrichtigungen" ? await getNotificationOverview() : null;
  // Beide Steuer-Abfragen parallel: die Objektangaben sind ein eigener
  // Endpunkt, aber derselbe Tab — nacheinander wäre der Tab doppelt langsam.
  // Drei Abfragen desselben Tabs parallel — nacheinander waere er dreifach
  // langsam. `getMeldelaeufe` gibt bei fehlender Rolle `null` statt einer
  // leeren Liste: die UI unterscheidet „nichts gemeldet" von „darf nicht
  // sehen" und erfindet keinen Ersatzwert.
  const [steuern, objektangaben, meldelaeufe] =
    aktiv === "steuern"
      ? await Promise.all([
          getTaxpayerOverview(),
          getObjektangaben(),
          getMeldelaeufe(),
        ])
      : [null, null, null];

  return (
    <div className="mx-auto max-w-6xl px-8 py-12">
      <div className="grid gap-12 md:grid-cols-[20rem_1fr]">
        <aside className="md:sticky md:top-28 md:self-start">
          <h2 className="mb-8 font-display text-3xl font-semibold tracking-tight">
            {t("titel")}
          </h2>
          <KontoNav />
        </aside>

        <div className="max-w-2xl">
          {aktiv === "persoenlich" && <PersoenlichAbschnitt account={account} />}
          {aktiv === "sicherheit" && <SicherheitAbschnitt account={account} />}
          {aktiv === "zahlungen" && (
            <section>
              <h1 className="mb-8 font-display text-3xl font-semibold tracking-tight">
                {t("zahlungenTitel")}
              </h1>
              <ZahlungenTabs />
              {zahlungenTab === "spenden" ? (
                spenden ? (
                  // Währung des Betriebs steht im Account nicht zur Verfügung.
                  // Statt eine zu raten (Wurzel 4) wird null durchgereicht —
                  // formatCurrency rendert dann symbollos, und die echten
                  // Beträge im Verlauf tragen ohnehin ihre eigene Währung.
                  <SpendenTab uebersicht={spenden} waehrung={null} />
                ) : (
                  <p className="text-[0.9375rem] text-muted-foreground">
                    Die Spendenübersicht ist gerade nicht abrufbar. Bitte später
                    erneut versuchen.
                  </p>
                )
              ) : zahlungenTab === "kontostand" ? (
                <KontostandTab uebersicht={auszahlungen} guthaben={guthaben} />
              ) : zahlungenTab === "auszahlungen" ? (
                <AuszahlungenTab
                  uebersicht={auszahlungen}
                  kontoStatus={kontoStatus}
                  kontoId={kontoId}
                  land={unternehmen?.companyCountry || null}
                  kontoinhaber={unternehmen?.companyName ?? ""}
                />
              ) : (
                <ZahlungenAbschnitt
                  settings={settings}
                  kontoId={kontoId}
                  kontoStatus={kontoStatus}
                  profil={unternehmen}
                />
              )}
            </section>
          )}
          {aktiv === "sprache" && <SpracheAbschnitt account={account} />}
          {aktiv === "datenschutz" && (
            <>
              <DatenschutzAbschnitt settings={privacy} />
              <SupportDiagnose sessions={debugSessions} />
            </>
          )}
          {aktiv === "benachrichtigungen" && (
            <BenachrichtigungenAbschnitt uebersicht={benachrichtigungen} />
          )}
          {aktiv === "steuern" && (
            <>
              <SteuernAbschnitt
                uebersicht={steuern}
                objektangaben={objektangaben}
              />
              {/* Die DAC7-Meldung gehoert unter die Steuerangaben, weil sie
                  auf ihnen aufbaut: ohne Steuer-Identifikation und
                  Objektangaben ist keine Meldung erzeugbar. Die Komponente
                  war fertig gebaut, wurde aber von keiner Seite importiert
                  und war damit fuer den Gastgeber nicht erreichbar. */}
              <Dac7Meldung laeufe={meldelaeufe} />
            </>
          )}
          {aktiv === "unternehmen" && (
            <UnternehmenTab
              profil={unternehmen}
              account={account}
              kontoId={kontoId}
              kontoStatus={kontoStatus}
            />
          )}
          {VORBEREITUNG[aktiv] && (
            <VorbereitungAbschnitt titelKey={VORBEREITUNG[aktiv]} />
          )}
        </div>
      </div>
    </div>
  );
}
