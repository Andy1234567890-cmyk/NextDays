// Kontoeinstellungen (Server Component) wie Airbnbs /account-settings: linke
// Bereichs-Nav, rechts der aktive Abschnitt (aus ?bereich=). Echte Konto-Daten
// aus /auth/account; Bereiche ohne Backend zeigen ehrlich „In Vorbereitung"
// (kein Erfinden, Wurzel 5). Der Kopf (Logo + „Fertig") sitzt im Layout.
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { DatenschutzAbschnitt } from "@/components/konto/datenschutz-abschnitt";
import { KontoNav } from "@/components/konto/konto-nav";
import { PersoenlichAbschnitt } from "@/components/konto/persoenlich-abschnitt";
import { SicherheitAbschnitt } from "@/components/konto/sicherheit-abschnitt";
import { SpracheAbschnitt } from "@/components/konto/sprache-abschnitt";
import { VorbereitungAbschnitt } from "@/components/konto/vorbereitung-abschnitt";
import { ZahlungenAbschnitt } from "@/components/konto/zahlungen-abschnitt";
import { getPrivacySettings } from "@/lib/datenschutz";
import { getAccount } from "@/lib/konto";
import { getPaymentSettings } from "@/lib/payments";

// Bereiche ohne eigenes Backend → Platzhalter, aber in der Nav sichtbar (wie
// Airbnb): Titel-Key je Bereich.
const VORBEREITUNG: Record<string, string> = {
  benachrichtigungen: "navBenachrichtigungen",
  steuern: "navSteuern",
  buchungsrechte: "navBuchungsrechte",
  unternehmen: "navUnternehmen",
  profitools: "navProfiTools",
};

export default async function KontoPage({
  searchParams,
}: {
  searchParams: Promise<{ bereich?: string }>;
}) {
  const [account, t, { bereich }] = await Promise.all([
    getAccount(),
    getTranslations("konto"),
    searchParams,
  ]);

  if (!account) redirect("/anmelden?weiter=/konto");
  const aktiv = bereich ?? "persoenlich";

  const settings = aktiv === "zahlungen" ? await getPaymentSettings() : null;
  const privacy = aktiv === "datenschutz" ? await getPrivacySettings() : null;

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
          {aktiv === "zahlungen" && <ZahlungenAbschnitt settings={settings} />}
          {aktiv === "sprache" && <SpracheAbschnitt account={account} />}
          {aktiv === "datenschutz" && (
            <DatenschutzAbschnitt settings={privacy} />
          )}
          {VORBEREITUNG[aktiv] && (
            <VorbereitungAbschnitt titelKey={VORBEREITUNG[aktiv]} />
          )}
        </div>
      </div>
    </div>
  );
}
