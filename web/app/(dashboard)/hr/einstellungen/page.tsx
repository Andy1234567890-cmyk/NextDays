// Personal → Einstellungen: Betriebsregeln (mit Länder-Vorschlag), Arbeits-
// bereiche, Schichtvorlagen, Pausenmodelle, Fremdfirmen, Urlaubssperren,
// Feiertags-Import. Nur MANAGE_PERSONAL.
import { notFound } from "next/navigation";

import { PersonalEinstellungen } from "@/components/personal/personal-einstellungen";
import {
  getRegelVorschlag,
  getRegeln,
  listArbeitsbereiche,
  listFremdfirmen,
  listPausenmodelle,
  listUrlaubssperren,
  listVorlagen,
} from "@/lib/personal";

export const dynamic = "force-dynamic";

export default async function EinstellungenPage() {
  const [regeln, vorschlag, bereiche, vorlagen, pausen, firmen, sperren] = await Promise.all([
    getRegeln(),
    getRegelVorschlag(),
    listArbeitsbereiche(true),
    listVorlagen(true),
    listPausenmodelle(),
    listFremdfirmen(),
    listUrlaubssperren(),
  ]);
  if (!vorschlag.ok && vorschlag.status === 403) notFound();
  return (
    <PersonalEinstellungen
      regeln={regeln.ok ? regeln.data : null}
      vorschlag={vorschlag.ok ? vorschlag.data : null}
      vorschlagFehler={vorschlag.ok ? null : vorschlag.error}
      arbeitsbereiche={bereiche.ok ? bereiche.data : []}
      vorlagen={vorlagen.ok ? vorlagen.data : []}
      pausenmodelle={pausen.ok ? pausen.data : []}
      fremdfirmen={firmen.ok ? firmen.data : []}
      sperren={sperren.ok ? sperren.data : []}
    />
  );
}
