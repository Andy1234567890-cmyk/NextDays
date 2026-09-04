// Personal → Lohnläufe (EXPORT_LOHN). Zwölf Monatszeilen eines Jahres mit der
// Statuskette Entwurf → Geprüft → Freigegeben → Exportiert und je Zeile genau
// den Aktionen, die der Status erlaubt (Vertrag §4.3).
//
// Vorbelegt mit dem laufenden Jahr, weil der Lauf, der bearbeitet wird, immer
// darin liegt (im Januar auch der Dezember des Vorjahres — dafür steht die
// Jahreswahl, die im Client lädt).
//
// Serverseitig geladen, kein Realtime-Abo: `personal_lohnlaeufe` ist eine
// Finanztabelle OHNE Grant für `authenticated` (Wurzel 6, Vertrag §0) — ein
// Abo wäre eine stumme Attrappe. Nach eigener Aktion übernimmt die Komponente
// die Antwort bzw. lädt das Jahr neu.
import { notFound } from "next/navigation";

import { LohnlaufSeite } from "@/components/personal/lohn/lohnlauf";
import { listLohnlaeufe } from "@/lib/personal-berichte";
import { heuteIso } from "@/lib/personal-typen";

export const dynamic = "force-dynamic";

export default async function LohnPage() {
  const jahr = Number(heuteIso().slice(0, 4));
  const res = await listLohnlaeufe(jahr);
  // 403: ohne `export_lohn` (und Rolle admin/co_admin) gibt es diese Route
  // für den Aufrufer nicht.
  if (!res.ok && res.status === 403) notFound();
  return (
    <LohnlaufSeite
      jahr={jahr}
      laeufe={res.ok ? res.data : []}
      loadError={res.ok ? null : res.error}
    />
  );
}
