// Personal → Mitarbeitende → Akte einer Person (/hr/mitarbeiter/<id>).
// Leitung (MANAGE_PERSONAL, Rolle frisch aus der DB) sieht die ganze Kartei;
// die Schichtleitung nur die Reiter ohne Akteninhalt (Einsatz-Qualifikationen,
// Nachweise, Schulungen, Arbeitszeit, Verfügbarkeit, Anträge). 403/404 führen
// auf dieselbe Seite — die Existenz einer fremden Person ist keine Auskunft
// (Wurzel 9).
import { notFound } from "next/navigation";

import { MitarbeiterAkte } from "@/components/personal/mitarbeiter-akte";
import { getAccount } from "@/lib/account";
import { getMe } from "@/lib/auth";
import {
  getAkte,
  getArbeitszeitkonto,
  getRegeln,
  getUebersicht,
  getUrlaubskonto,
  listAbwesenheiten,
  listArbeitsbereiche,
  listDokumente,
  listFremdfirmen,
  listGespraeche,
  listMassnahmen,
  listMitarbeiter,
  listNachweise,
  listQualifikationen,
  listSchulungen,
  listVerfuegbarkeiten,
  listVertraege,
  listVorfaelle,
  listZeiten,
} from "@/lib/personal";
import { listAkteAenderungen } from "@/lib/personal-betrieb";
import type { AkteAenderung } from "@/lib/personal-betrieb-typen";
import {
  type Gespraech,
  type Massnahme,
  type Result,
  type Vertrag,
  type Vorfall,
  heuteIso,
} from "@/lib/personal-typen";
import { listProperties } from "@/lib/properties";

export const dynamic = "force-dynamic";

export default async function AktePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const [uebersicht, me] = await Promise.all([getUebersicht(userId), getMe()]);
  if (!uebersicht.ok) notFound();
  const kannAkte = me?.capabilities.includes("manage_personal") ?? false;
  const heute = heuteIso();
  const jahr = Number(heute.slice(0, 4));
  const monatVon = `${heute.slice(0, 7)}-01`;
  // Ohne Akte-Recht die Akteninhalte gar nicht anfragen (der Server gäbe 403).
  const leer = <T,>(): Promise<Result<T[]>> => Promise.resolve({ ok: true, data: [] });

  const [
    akteRes,
    liste,
    quali,
    doks,
    firmen,
    bereiche,
    objekte,
    urlaub,
    azk,
    verf,
    konto,
    abw,
    zeiten,
    regeln,
    vertraege,
    massnahmen,
    vorfaelle,
    gespraeche,
    nachweise,
    schulungen,
    aenderungen,
  ] = await Promise.all([
    getAkte(userId),
    listMitarbeiter(),
    listQualifikationen(userId),
    listDokumente(userId),
    listFremdfirmen(),
    listArbeitsbereiche(),
    listProperties(),
    getUrlaubskonto(userId, jahr),
    getArbeitszeitkonto(userId),
    listVerfuegbarkeiten(userId),
    getAccount(),
    listAbwesenheiten(`${jahr}-01-01`, `${jahr}-12-31`),
    listZeiten(monatVon, heute, userId),
    getRegeln(),
    kannAkte ? listVertraege(userId) : leer<Vertrag>(),
    kannAkte ? listMassnahmen(userId) : leer<Massnahme>(),
    kannAkte ? listVorfaelle(userId) : leer<Vorfall>(),
    kannAkte ? listGespraeche(userId) : leer<Gespraech>(),
    listNachweise(userId),
    listSchulungen(userId),
    // Terminierte Änderungen (§3.1) hängen am Manage-Guard — ohne Akte-Recht
    // gar nicht anfragen, statt einen 403 zu erzeugen und zu verschlucken.
    kannAkte ? listAkteAenderungen(userId) : leer<AkteAenderung>(),
  ]);
  const person = liste.ok ? liste.data.items.find((m) => m.user_id === userId) ?? null : null;
  if (!person) notFound();
  // Ohne Akte-Recht liefert der Server 403 — die Kartei zeigt dann die leere
  // Vorlage mit der Beschäftigungsart aus der Liste, nicht den Fehler.
  const akte = akteRes.ok
    ? akteRes.data
    : {
        user_id: userId,
        employee_number: person.employee_number,
        beschaeftigungsart: person.beschaeftigungsart ?? "vollzeit",
        firma_id: null,
        firma_name: person.firma_name,
        position: person.position,
        eintritt: person.eintritt,
        austritt: person.austritt,
        probezeit_bis: null,
        wochenstunden: person.wochenstunden,
        tagesstunden: null,
        arbeitstage_je_woche: null,
        stundenlohn_minor: null,
        gehalt_minor: null,
        currency: null,
        urlaubsanspruch_tage: null,
        geburtsdatum: null,
        geburtsort: null,
        staatsangehoerigkeit: null,
        strasse: null,
        hausnummer: null,
        plz: null,
        ort: null,
        land: null,
        notfall_name: null,
        notfall_beziehung: null,
        notfall_telefon: null,
        steuer_id_maskiert: null,
        sv_nummer_maskiert: null,
        iban_maskiert: null,
        krankenkasse: null,
        bic: null,
        bank_name: null,
        kontoinhaber: null,
        notiz: null,
        familienstand: null,
        kinder_anzahl: null,
        lohnmerkmale: [],
        arbeitgeber_aufschlag_pct: null,
        updated_at: null,
      };
  return (
    <MitarbeiterAkte
      person={person}
      uebersicht={uebersicht.data}
      akte={akte}
      qualifikationen={quali.ok ? quali.data : []}
      dokumente={doks.ok ? doks.data : []}
      fremdfirmen={firmen.ok ? firmen.data : []}
      arbeitsbereiche={bereiche.ok ? bereiche.data : []}
      objekte={objekte.ok ? objekte.data.items.map((p) => ({ id: p.id, title: p.title })) : []}
      urlaubskonto={urlaub.ok ? urlaub.data : null}
      urlaubFehler={urlaub.ok ? null : urlaub.error}
      arbeitszeitkonto={azk.ok ? azk.data : null}
      verfuegbarkeiten={verf.ok ? verf.data : []}
      abwesenheiten={abw.ok ? abw.data.items.filter((a) => a.user_id === userId) : []}
      vertraege={vertraege.ok ? vertraege.data : []}
      massnahmen={massnahmen.ok ? massnahmen.data : []}
      vorfaelle={vorfaelle.ok ? vorfaelle.data : []}
      gespraeche={gespraeche.ok ? gespraeche.data : []}
      nachweise={nachweise.ok ? nachweise.data : []}
      schulungen={schulungen.ok ? schulungen.data : []}
      zeiten={zeiten.ok ? zeiten.data : { items: [], personen: [] }}
      aenderungen={aenderungen.ok ? aenderungen.data : []}
      zone={regeln.ok && regeln.data ? regeln.data.zeitzone : "UTC"}
      tenantCountry={konto.ok ? konto.data.tenant_country : null}
      jahr={jahr}
      kannAkte={kannAkte}
      kannBestaetigen={me?.capabilities.includes("confirm_time") ?? false}
      kannEntscheiden={me?.capabilities.includes("approve_absence") ?? false}
      eigeneId={me?.user_id ?? null}
    />
  );
}
