// Personal → Stempeluhr (Vertrag §6, Guard `track_own_time`): die EIGENE
// Stempeluhr, die EIGENEN Zeiten des laufenden Monats, die EIGENEN
// Ueberstundenantraege.
//
// WARUM EINE EIGENE SEITE NEBEN /hr/zeiterfassung
// -----------------------------------------------
// /hr/zeiterfassung ist die Team-Sicht der Leitung (Korrektur, Bestaetigung,
// Monatsabschluss) und verlangt `view_team_schedule`. Eine Reinigungskraft hat
// dieses Recht nicht — sie braucht genau drei Dinge: stempeln, ihre Zeiten
// sehen, Ueberstunden beantragen. Das ist diese Seite. Sie fragt nirgends nach
// einer fremden Person und filtert nichts clientseitig weg: `GET /zeiterfassung`
// liefert einer Person ohne Team-Recht ohnehin nur die eigenen Zeilen
// (Rollen-Datensplit im Service), und `GET /ueberstunden` liefert unter dem
// Own-Guard die eigenen Antraege. Der Scope kommt also vom Server, nicht von
// der Oberflaeche (Wurzel 3/9).
//
// SCHICHT HEUTE
// -------------
// Kommt aus `GET /dienstplan/mein` fuer die laufende Woche und wird in der
// ZONE DES BETRIEBS auf den heutigen Kalendertag gefiltert — nicht mit
// `.slice(0,10)` auf dem UTC-Zeitpunkt (das war die Wurzel der falschen
// Tagesanker im Aufgabenkalender).
import { notFound } from "next/navigation";

import { StempeluhrSeite } from "@/components/personal/stempeluhr-seite";
import { getMe } from "@/lib/auth";
import { getMeinPlan, getOffeneZeit, getRegeln, listZeiten } from "@/lib/personal";
import { getRegelnVoll, listUeberstunden } from "@/lib/personal-betrieb";
import { heuteIso, montagVon } from "@/lib/personal-typen";
import { tagInZone } from "@/lib/personal-zeit";
import { listProperties } from "@/lib/properties";

export const dynamic = "force-dynamic";

export default async function StempeluhrPage() {
  const heute = heuteIso();
  const von = `${heute.slice(0, 7)}-01`;
  const [me, offen, regeln, regelnVoll, zeiten, antraege, plan, objekte] = await Promise.all([
    getMe(),
    getOffeneZeit(),
    getRegeln(),
    getRegelnVoll(),
    listZeiten(von, heute),
    listUeberstunden(von, heute),
    getMeinPlan(montagVon(heute)),
    listProperties(),
  ]);
  // Ohne `track_own_time` gibt es hier nichts zu tun. Die Sichtbarkeit in der
  // Sidebar allein reicht nicht (wer den Pfad eintippt, kaeme sonst durch) —
  // dasselbe Muster wie in den uebrigen HR-Seiten.
  if (!me?.capabilities.includes("track_own_time")) notFound();
  if (!zeiten.ok && zeiten.status === 403) notFound();

  const zone = regeln.ok && regeln.data ? regeln.data.zeitzone : "UTC";
  const eigeneId = me.user_id;
  // Schicht heute in der BETRIEBSZONE, nicht in UTC.
  const meine = plan.ok
    ? plan.data.schichten
        .filter(
          (s) =>
            s.user_id === eigeneId &&
            s.status !== "abgesagt" &&
            tagInZone(s.start_at, zone) === tagInZone(new Date().toISOString(), zone),
        )
        .sort((a, b) => a.start_at.localeCompare(b.start_at))
    : [];
  const schicht = meine[0] ?? null;

  return (
    <StempeluhrSeite
      offen={offen.ok ? offen.data : null}
      zeiten={zeiten.ok ? zeiten.data : { items: [], personen: [] }}
      antraege={antraege.ok ? antraege.data : []}
      von={von}
      bis={heute}
      zone={zone}
      eigeneId={eigeneId}
      gpsPflicht={regelnVoll.ok && regelnVoll.data ? (regelnVoll.data.gps_pflicht ?? false) : false}
      gpsRadiusM={regelnVoll.ok && regelnVoll.data ? (regelnVoll.data.gps_radius_m ?? 250) : 250}
      objekte={objekte.ok ? objekte.data.items.map((p) => ({ id: p.id, title: p.title })) : []}
      schichtHeute={
        schicht
          ? {
              id: schicht.id,
              datum: schicht.datum,
              start_at: schicht.start_at,
              end_at: schicht.end_at,
              property_title: schicht.property_title,
              arbeitsbereich_id: schicht.arbeitsbereich_id,
              status: schicht.status,
            }
          : null
      }
    />
  );
}
