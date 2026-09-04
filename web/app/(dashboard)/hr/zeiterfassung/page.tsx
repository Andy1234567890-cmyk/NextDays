// Personal → Zeiterfassung (Team). Zeitraum: laufender Monat.
//
// AUSBAU NACH VERTRAG §6
// ----------------------
// Die Seite lädt zusätzlich, was die drei neuen Tabs im Erstaufschlag brauchen:
// die Zusammenfassung (§3.4) und die Überstundenanträge (§3.5) für denselben
// Monat, „Unbestätigt & verpasst" (§3.4, zeitraumunabhängig) sowie — nur wenn
// die aufrufende Person `track_own_time` hat — ihre offene Stempelung, ihre
// Schicht von heute und die GPS-Regeln für die Stempeluhr-Karte am Kopf.
//
// WARUM DIE SCHICHT IN DER BETRIEBSZONE GEFILTERT WIRD
// ----------------------------------------------------
// `.slice(0,10)` auf einem UTC-Zeitpunkt nimmt in Zonen östlich von UTC den
// Vortag — dieselbe Wurzel wie die falschen Tagesanker im Aufgabenkalender.
// Deshalb `tagInZone` gegen die Zone aus den Betriebsregeln, wie in
// /hr/stempeluhr.
import { notFound } from "next/navigation";

import { ZeiterfassungTeam } from "@/components/personal/zeiterfassung";
import { getMe } from "@/lib/auth";
import { getMeinPlan, getOffeneZeit, getRegeln, listMonatsabschluesse, listZeiten } from "@/lib/personal";
import {
  getRegelnVoll,
  getZeitUnbestaetigt,
  getZeitZusammenfassung,
  listUeberstunden,
} from "@/lib/personal-betrieb";
import { heuteIso, montagVon } from "@/lib/personal-typen";
import { tagInZone } from "@/lib/personal-zeit";
import { listProperties } from "@/lib/properties";

export const dynamic = "force-dynamic";

export default async function ZeiterfassungPage() {
  const heute = heuteIso();
  const von = `${heute.slice(0, 7)}-01`;
  const jahr = Number(heute.slice(0, 4));
  const monat = Number(heute.slice(5, 7));
  const [liste, regeln, abschluesse, me, objekte, summen, antraege] = await Promise.all([
    listZeiten(von, heute),
    getRegeln(),
    listMonatsabschluesse(jahr, monat === 1 ? 12 : monat - 1),
    getMe(),
    listProperties(),
    getZeitZusammenfassung(von, heute),
    listUeberstunden(von, heute),
  ]);
  if (!liste.ok && liste.status === 403) notFound();

  const zone = regeln.ok && regeln.data ? regeln.data.zeitzone : "UTC";
  const kannBestaetigen = me?.capabilities.includes("confirm_time") ?? false;
  const kannEigeneZeit = me?.capabilities.includes("track_own_time") ?? false;

  // `GET /zeiterfassung/unbestaetigt` haengt am Confirm-Guard (`confirm_time`),
  // die Zusammenfassung nur am Team-Guard. Ohne Bestaetigungsrecht die Route
  // gar nicht anfragen: ein verschluckter 403 saehe hier wie „nichts offen" aus
  // und waere eine Falschaussage (Wurzel 5).
  const offen = kannBestaetigen ? await getZeitUnbestaetigt() : null;

  // Nur für die Stempeluhr-Karte, und nur wenn es sie überhaupt gibt: ohne
  // `track_own_time` werden diese drei Routen gar nicht angefragt, statt einen
  // 403 zu erzeugen und zu verschlucken.
  const [eigeneZeit, regelnVoll, plan] = kannEigeneZeit
    ? await Promise.all([getOffeneZeit(), getRegelnVoll(), getMeinPlan(montagVon(heute))])
    : [null, null, null];

  const eigeneId = me?.user_id ?? null;
  const jetzt = tagInZone(new Date().toISOString(), zone);
  const schicht =
    plan?.ok && eigeneId
      ? (plan.data.schichten
          .filter((s) => s.user_id === eigeneId && s.status !== "abgesagt" && tagInZone(s.start_at, zone) === jetzt)
          .sort((a, b) => a.start_at.localeCompare(b.start_at))[0] ?? null)
      : null;

  return (
    <ZeiterfassungTeam
      initial={liste.ok ? liste.data : { items: [], personen: [] }}
      von={von}
      bis={heute}
      zone={zone}
      kannBestaetigen={kannBestaetigen}
      eigeneId={eigeneId}
      monatsabschluesse={abschluesse.ok ? abschluesse.data : []}
      objekte={objekte.ok ? objekte.data.items.map((p) => ({ id: p.id, title: p.title })) : []}
      zusammenfassung={summen.ok ? summen.data : []}
      unbestaetigt={offen?.ok ? offen.data : []}
      ueberstunden={antraege.ok ? antraege.data : []}
      kannEigeneZeit={kannEigeneZeit}
      eigeneOffeneZeit={eigeneZeit?.ok ? eigeneZeit.data : null}
      gpsPflicht={regelnVoll?.ok && regelnVoll.data ? (regelnVoll.data.gps_pflicht ?? false) : false}
      gpsRadiusM={regelnVoll?.ok && regelnVoll.data ? (regelnVoll.data.gps_radius_m ?? 250) : 250}
      eigeneSchichtHeute={
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
