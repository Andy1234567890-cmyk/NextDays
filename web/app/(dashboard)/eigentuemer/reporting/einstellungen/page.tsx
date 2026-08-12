// Erweiterte Einstellungen des Eigentümer-Reportings.
//
// Zwei Konfigurationen entscheiden, was von einer Buchung beim Eigentümer
// ankommt — und beide gehören zusammen:
//   1. Portal-Abzugssätze (0364)  — was das Portal einbehält (Provision +
//      ggf. Zahlungsgebühr), mit Zeitachse.
//   2. Gebühren-Zuordnung (0343)  — wem eine Gebühr gehört und ob sie
//      provisionspflichtig ist. Sie entscheidet, welcher Rest überhaupt in die
//      Provisionsbemessung fällt.
//
// WARUM DIESELBEN KOMPONENTEN WIE UNTER /buchhaltung/abrechnungsregeln:
// Es ist EINE Konfiguration mit zwei Einstiegen. Wer aus dem Reporting kommt,
// sucht sie hier; wer aus der Buchhaltung kommt, dort. Eine zweite
// Implementierung derselben Maske liefe beim ersten neuen Feld auseinander —
// dann hätte der Betrieb zwei Formulare für dieselbe Tabelle und keines wäre
// nachweislich das gültige.
import { getTranslations } from "next-intl/server";

import { PortalAbzugssaetze } from "@/components/buchhaltung/portal-abzugssaetze";
import { GebuehrenZuordnung } from "@/components/objekte/pricing/gebuehren-zuordnung";

export default async function ReportingEinstellungenPage() {
  const t = await getTranslations("ownerReporting.settings");
  const tBilling = await getTranslations("ownerBilling");
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-extrabold">{t("title")}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          {t("subtitle")}
        </p>
      </header>

      <PortalAbzugssaetze />

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-lg font-extrabold">
            {tBilling("classifyTitle")}
          </h2>
          <p className="max-w-3xl text-sm text-muted-foreground">
            {tBilling("classifyScopeHint")}
          </p>
        </div>
        <GebuehrenZuordnung />
      </section>
    </div>
  );
}
