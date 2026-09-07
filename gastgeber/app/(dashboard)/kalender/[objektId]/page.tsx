// Kalender EINES Objekts (Server Component). Vorbild: Airbnbs
// `/multicalendar/{listing_id}` — am 06.09.2026 im Browser ausgelesen, siehe
// docs/AIRBNB-MULTIKALENDER-ANALYSE.md Abschnitt M.
//
// Dorthin führt der Klick auf ein Objekt im Multikalender. Das ist der Grund,
// warum es diese Seite gibt: im Rasterblick sieht man zwanzig Objekte über
// wenige Wochen, hier EIN Objekt über viele Monate — mit den Einstellungen,
// die für alle Nächte gelten, gleich daneben.
//
// Geladen wird ein grosszügiges Fenster (ein Monat zurück, gut ein halbes Jahr
// voraus); der Client lädt beim Blättern nach.
import { notFound } from "next/navigation";

import { ObjektKalender } from "@/components/kalender/objekt-kalender";
import { getKalenderFenster, isoTag, tagPlus } from "@/lib/kalender";
import { monatsAnfang } from "@/lib/kalender-datum";
import { getBuchungsbedingungen } from "@/lib/buchungsbedingungen";
import { getPreisStand } from "@/lib/preise";
import { getProperties } from "@/lib/properties";

export default async function ObjektKalenderPage({
  params,
}: {
  params: Promise<{ objektId: string }>;
}) {
  const { objektId } = await params;
  const objekte = await getProperties();
  const objekt = objekte.find((o) => o.id === objektId);
  // Nicht gefunden heisst hier „gehört nicht zu diesem Gastgeber" — die Liste
  // kommt bereits gescopet vom Server. Ein leerer Kalender mit fremder ID wäre
  // die schlechtere Antwort als 404.
  if (!objekt) notFound();

  const heute = isoTag(new Date());
  const start = monatsAnfang(tagPlus(heute, -31));
  const end = tagPlus(heute, 200);
  const [fenster, preisStand, bedingungen] = await Promise.all([
    getKalenderFenster([objektId], start, end),
    // Der Preis-Stand speist das rechte Panel. Schlägt er fehl, bleibt das
    // Panel leer statt die ganze Seite zu kippen — der Kalender ist auch ohne
    // die Einstellungen brauchbar.
    getPreisStand(objektId).catch(() => null),
    // Die Stornobedingungen des Betriebs. Welche für dieses Objekt gilt,
    // entscheidet `geltendeBedingung` — am Preisplan hängend, sonst der
    // Standard des Betriebs.
    getBuchungsbedingungen().catch(() => []),
  ]);

  return (
    <ObjektKalender
      objekt={objekt}
      objekte={objekte}
      fenster={fenster}
      preisStand={preisStand}
      bedingungen={bedingungen}
      heute={heute}
    />
  );
}
