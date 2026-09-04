// Personal → Berichte → ein Bericht. Der Filterzustand steht KOMPLETT IN DER
// URL (`?von=&bis=&arbeitsbereich_id=&property_id=&user_id=&beschaeftigungsart=`),
// damit ein Link teilbar ist: „schau dir den März an" ist eine URL, kein
// Klickpfad. Deshalb lädt jede Filteränderung diese Seite serverseitig neu
// (`bericht-filter.tsx` schreibt die Query per `router.replace`), statt den
// Bericht im Client nachzuladen.
//
// WELCHE FILTER SICHTBAR SIND, SAGT DER KATALOG (`filter: [...]`, Vertrag
// §4.1) — nicht diese Seite. Ein Personenfilter über einem Bericht, der je
// Tag aggregiert, wäre eine Attrappe.
//
// Unbekannter Berichtsname → `notFound()`. Geprüft wird gegen den KATALOG DES
// AUFRUFERS, nicht gegen eine Liste im Code: ein Bericht, den der Server
// diesem Nutzer nicht anbietet (fehlendes `export_lohn`), ist für ihn nicht
// vorhanden — dieselbe Antwort wie ein Tippfehler, ohne zu verraten, dass es
// ihn gibt (Wurzel 9).
import { notFound } from "next/navigation";

import { BerichtSeite } from "@/components/personal/berichte/bericht-seite";
import type { FilterOptionen } from "@/components/personal/berichte/bericht-filter";
import { getBericht, listBerichte } from "@/lib/personal-berichte";
import type { BerichtFilterWerte } from "@/lib/personal-berichte-typen";
import { zeitraumSchnellwahl } from "@/lib/personal-berichte-typen";
import { listArbeitsbereiche, listMitarbeiter } from "@/lib/personal";
import { heuteIso } from "@/lib/personal-typen";
import { listProperties } from "@/lib/properties";

export const dynamic = "force-dynamic";

/** Der erste Wert einer Query — Next.js gibt bei doppeltem Schlüssel ein
 *  Array. Nie zusammenfügen: `?user_id=a&user_id=b` ist kein Filter „a,b". */
function ersterWert(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

export default async function BerichtPage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ name }, sp] = await Promise.all([params, searchParams]);
  const berichtName = decodeURIComponent(name);

  const katalog = await listBerichte();
  if (!katalog.ok && katalog.status === 403) notFound();
  const eintrag = katalog.ok ? katalog.data.find((e) => e.name === berichtName) : null;
  // Kein Eintrag = für DIESEN Aufrufer nicht vorhanden. Bei einem
  // Ladefehler des Katalogs (kein 403) wird nicht geraten, sondern die Seite
  // mit der Fehlermeldung gezeigt.
  if (katalog.ok && !eintrag) notFound();

  // Vorbelegung: der laufende Monat. Nur, solange die URL nichts sagt — sonst
  // würde ein geteilter Link seinen eigenen Zeitraum verlieren.
  const standard = zeitraumSchnellwahl("dieserMonat", heuteIso());
  const werte: BerichtFilterWerte = {
    von: ersterWert(sp.von) || standard.von,
    bis: ersterWert(sp.bis) || standard.bis,
    arbeitsbereich_id: ersterWert(sp.arbeitsbereich_id),
    property_id: ersterWert(sp.property_id),
    user_id: ersterWert(sp.user_id),
    beschaeftigungsart: ersterWert(sp.beschaeftigungsart),
  };

  const filterNamen = eintrag?.filter ?? ["zeitraum"];

  // Die Auswahllisten werden NUR geholt, wenn der Bericht den Filter
  // überhaupt zeigt — drei ungenutzte Abrufe je Seitenaufruf sind Last ohne
  // Gegenwert.
  const [bericht, bereiche, objekte, personen] = await Promise.all([
    getBericht(berichtName, werte),
    filterNamen.includes("arbeitsbereich") ? listArbeitsbereiche() : null,
    filterNamen.includes("objekt") ? listProperties() : null,
    filterNamen.includes("person") ? listMitarbeiter() : null,
  ]);
  if (!bericht.ok && bericht.status === 403) notFound();

  const optionen: FilterOptionen = {
    arbeitsbereiche:
      bereiche?.ok ? bereiche.data.map((a) => ({ id: a.id, name: a.name })) : [],
    objekte: objekte?.ok ? objekte.data.items.map((o) => ({ id: o.id, title: o.title })) : [],
    personen:
      personen?.ok
        ? personen.data.items.map((p) => ({ user_id: p.user_id, full_name: p.full_name }))
        : [],
  };

  return (
    <BerichtSeite
      name={berichtName}
      filterNamen={filterNamen}
      werte={werte}
      optionen={optionen}
      bericht={bericht.ok ? bericht.data : null}
      loadError={bericht.ok ? null : bericht.error}
    />
  );
}
