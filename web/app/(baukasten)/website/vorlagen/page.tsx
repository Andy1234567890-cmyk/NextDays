// Vorlagen-Reiter: ganze Websites und einzelne Seiten zum Übernehmen.
import { VorlagenAnsicht } from "@/components/website/vorlagen-ansicht";
import { listSeitenVorlagen, listTemplates } from "@/lib/site-pages";

import { ladeBaukasten } from "../daten";
import { KeinZugriff } from "../kein-zugriff";

export default async function VorlagenSeite() {
  const [{ keinZugriff, pages, domains }, templatesRes, seitenRes] =
    await Promise.all([ladeBaukasten(), listTemplates(), listSeitenVorlagen()]);
  if (keinZugriff) return <KeinZugriff />;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <VorlagenAnsicht
        pages={pages}
        domains={domains}
        // Leere Listen sind hier ehrlich: schlägt der Aufruf fehl, zeigt die
        // Galerie nichts an statt erfundener Kacheln, die beim Klick in ein
        // 404 laufen (Wurzel 4).
        templates={templatesRes.ok ? templatesRes.data.templates : []}
        kategorien={templatesRes.ok ? templatesRes.data.kategorien : []}
        seitenVorlagen={seitenRes.ok ? seitenRes.data.vorlagen : []}
      />
    </div>
  );
}
