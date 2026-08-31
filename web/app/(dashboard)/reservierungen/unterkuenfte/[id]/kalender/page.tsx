// Objekt → Kalender: DERSELBE Belegungsplan wie unter /kalender, nur auf dieses
// eine Objekt gefiltert.
//
// WARUM NICHT MEHR DIE EIGENE MONATSANSICHT: Hier stand bis zum 31.08.2026
// `PropertyCalendar` — zwölf Monatsraster, in denen ausschließlich BELEGTE Tage
// anklickbar waren (`disabled={!res}`), und ein Klick sprang zur
// Buchungsdetailseite. Damit war die Ansicht ein reines Schaubild: keine Sperre
// anlegen, keine aufheben, nichts verschieben. Gemeldet als „in der
// Einzelansicht vom Kalender eines Hauses kann ich gar nichts bearbeiten, keine
// Sperrungen reinlegen oder löschen oder verschieben".
//
// Schwerer wog, was sie NICHT zeigte: sie speiste sich allein aus
// `listReservations`. Sperren, Stop-Sells und OTA-Blöcke stehen in
// `availability`, nicht in `reservations` — eine im Belegungsplan gesetzte
// Sperre war hier unsichtbar. Die Ansicht behauptete also freie Tage, die zu
// waren (Wurzel 5: eine Anzeige, die ihren eigenen Mangel verschweigt).
//
// WARUM KEIN EDITOR DANEBEN GEBAUT WURDE: Ziehen, Sperren, Stop-Sell,
// Verschieben, Bulk-Edit und die Portale-Rückmeldung hängen alle im
// `CalendarBoard`. Eine zweite Umsetzung wäre eine zweite Wahrheit, die beim
// nächsten Feature auseinanderläuft. Das Board nimmt `properties: Prop[]` und
// arbeitet durchgehend über diese Liste — mit genau einem Eintrag ist es
// unverändert der volle Editor. Die Filterleiste blendet es dabei selbst aus
// (`einzelobjekt`), weil ein Objektfilter über einem Objekt nichts filtert.
import { notFound } from "next/navigation";

import { CalendarBoard } from "@/components/kalender/calendar-board";
import { getMe } from "@/lib/auth";
import { getDpOverview } from "@/lib/dynamic-pricing";
import { getProperty } from "@/lib/properties";

export default async function KalenderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Objekt + Betriebsart + Dynamic-Pricing-Status parallel — dieselben drei
  // Quellen wie die Übersicht unter /kalender, damit die Zeile hier identisch
  // aussieht (Foto, Adresse, Blitz bei aktivem DP).
  const [res, me, dp] = await Promise.all([
    getProperty(id),
    getMe(),
    getDpOverview(),
  ]);

  if (!res.ok) notFound();

  const p = res.data;
  // Best-effort wie in der Übersicht: scheitert der DP-Abruf, fehlt nur der
  // Blitz — kein Grund, den Kalender nicht zu zeigen.
  const dynamicEnabled = dp.ok
    ? dp.data.items.some((i) => i.property_id === p.id && i.enabled)
    : false;

  return (
    <CalendarBoard
      einzelobjekt
      accommodationType={me?.accommodation_type ?? null}
      properties={[
        {
          id: p.id,
          title: p.title,
          type: p.property_type,
          photo: p.photos[0] ?? null,
          address: [p.street, p.house_number].filter(Boolean).join(" "),
          city: [p.postal_code, p.city].filter(Boolean).join(" "),
          maxGuests: p.max_guests,
          dynamicEnabled,
        },
      ]}
    />
  );
}
