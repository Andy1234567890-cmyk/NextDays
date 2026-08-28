// Website → Regeln: die Personalisierungs-Regeln (0440).
//
// Auslöser × Aktion. Der Reiter steht neben „Seiten" und nicht darin, weil eine
// Regel keine Seite ist — sie entscheidet, WANN etwas erscheint. Hostaway
// versteckt dieselbe Funktion unter „More → Personalize"; genau deshalb findet
// sie dort kaum jemand.
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { RegelAnsicht } from "@/components/website/regeln/regel-ansicht";
import { listRegeln } from "@/lib/site-regeln";

import { ladeBaukasten } from "../daten";
import { KeinZugriff } from "../kein-zugriff";

export const dynamic = "force-dynamic";

export default async function RegelnSeite() {
  const { keinZugriff, pages, domains, branding } = await ladeBaukasten();
  if (keinZugriff) return <KeinZugriff />;
  const res = await listRegeln();

  return (
    <>
      {/* `site_rules` ist in der Publikation und hat `select` für die
          angemeldete Rolle (0441) — beides geprüft, sonst wäre das Abo eine
          stumme Attrappe. `site_pages`, weil die Pop-up-Auswahl daraus kommt. */}
      <RealtimeRefresh tables={["site_rules", "site_pages"]} />
      <RegelAnsicht
        regeln={res.ok ? res.data.items : []}
        pages={pages}
        domains={domains}
        sprachen={branding?.languages?.length ? branding.languages : ["de"]}
        // Ohne Geo-Dienst ruhen Regeln mit Ort-Bedingung. Die Oberfläche sagt
        // das an der Regel selbst — sonst sucht der Betrieb den Fehler bei sich.
        ortVerfuegbar={false}
      />
    </>
  );
}
