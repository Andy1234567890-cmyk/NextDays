// Abrechnungsregeln: was die Portale einbehalten und wem die Gebühren gehören.
//
// WARUM DIESE ZWEI DINGE AUF EINER SEITE:
// Beide beantworten dieselbe Frage — „was passiert mit dem Geld einer Buchung,
// bevor der Eigentümer seinen Anteil bekommt". Der Portal-Abzug geht zuerst ab,
// dann entscheidet die Gebühren-Zuordnung, welcher Rest überhaupt in die
// Provisionsbemessung fällt. Wer das eine pflegt, braucht das andere im Blick.
//
// WARUM NICHT AM OBJEKT (die Gebühren-Zuordnung stand vorher unter
// /objekte/<id>/preise): sie ist BETRIEBSWEIT. Im Live-Bestand kommt
// `cleaning_fee` an 18 Objekten von 16 verschiedenen Eigentümern vor — dieselbe
// Aussage 18-mal am Objekt zu pflegen ist keine Einstellung, sondern eine
// Fehlerquelle. Lodgify führt sie aus demselben Grund nicht am Objekt.
// Die Gebühren SELBST (Betrag, je Nacht/Aufenthalt) bleiben am Objekt — dort
// gehören sie hin, weil sie sich je Haus unterscheiden.
import { getTranslations } from "next-intl/server";

import { GebuehrenZuordnung } from "@/components/objekte/pricing/gebuehren-zuordnung";
import { PortalAbzugssaetze } from "@/components/buchhaltung/portal-abzugssaetze";

export default async function AbrechnungsregelnPage() {
  const t = await getTranslations("ownerBilling");
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-extrabold">
          {t("rulesPageTitle")}
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          {t("rulesPageIntro")}
        </p>
      </header>

      <PortalAbzugssaetze />

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-lg font-extrabold">
            {t("classifyTitle")}
          </h2>
          <p className="max-w-3xl text-sm text-muted-foreground">
            {t("classifyScopeHint")}
          </p>
        </div>
        <GebuehrenZuordnung />
      </section>
    </div>
  );
}
