// Personal → Abwesenheit: Anträge (offen zuerst), Urlaubskonten, Krankenstand.
import { notFound } from "next/navigation";

import { Abwesenheiten } from "@/components/personal/abwesenheiten";
import { getMe } from "@/lib/auth";
import {
  getKrankenstand,
  getRegeln,
  listAbwesenheiten,
  listMitarbeiter,
  listUrlaubskonten,
} from "@/lib/personal";
import { heuteIso, tagePlus } from "@/lib/personal-typen";

export const dynamic = "force-dynamic";

export default async function AbwesenheitPage() {
  const heute = heuteIso();
  const von = tagePlus(heute, -60);
  const bis = tagePlus(heute, 365);
  const jahr = Number(heute.slice(0, 4));
  // Die Personalnummern und die Betriebszone braucht ausschliesslich die
  // Kalender-Sicht (Gantt). Sie werden mitgeladen, weil beides EIN Aufruf ist
  // und die Sicht sonst „—" statt der Nummer zeigen muesste; scheitert einer
  // der beiden, bleibt der Kalender bedienbar (kein harter Fehler fuer eine
  // Zeilenbeschriftung).
  const [liste, konten, krank, me, personal, regeln] = await Promise.all([
    listAbwesenheiten(von, bis),
    listUrlaubskonten(jahr),
    getKrankenstand(`${jahr}-01-01`, `${jahr}-12-31`),
    getMe(),
    listMitarbeiter(),
    getRegeln(),
  ]);
  if (!liste.ok && liste.status === 403) notFound();
  const personalnummern: Record<string, string | null> = {};
  if (personal.ok) {
    for (const p of personal.data.items) personalnummern[p.user_id] = p.employee_number;
  }
  return (
    <Abwesenheiten
      initial={liste.ok ? liste.data : { items: [], personen: [] }}
      von={von}
      bis={bis}
      urlaubskonten={konten.ok ? konten.data : []}
      krankenstand={krank.ok ? krank.data : []}
      kannEntscheiden={me?.capabilities.includes("approve_absence") ?? false}
      eigeneId={me?.user_id ?? null}
      jahr={jahr}
      personalnummern={personalnummern}
      zone={regeln.ok && regeln.data ? regeln.data.zeitzone : "UTC"}
    />
  );
}
