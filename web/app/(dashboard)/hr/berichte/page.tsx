// Personal → Berichte (Katalog). Die Karten sind genau die Berichte, die
// `GET /personal/berichte` für DIESEN Aufrufer liefert (Vertrag §4.1) — der
// Server filtert nach Recht (`view_team_schedule` bzw. `export_lohn`), diese
// Seite prüft NICHTS nach: eine zweite Rechte-Logik hier wäre entweder
// redundant oder falsch (Wurzel 3/9).
//
// Serverseitig geladen und `force-dynamic`: die speisenden Tabellen sind für
// `authenticated` gesperrt (Wurzel 6), ein Realtime-Abo wäre eine stumme
// Attrappe — und der Katalog hängt am Recht des Aufrufers, darf also nicht
// statisch zwischengespeichert werden.
import { notFound } from "next/navigation";

import { BerichteKatalog } from "@/components/personal/berichte/katalog";
import { listBerichte } from "@/lib/personal-berichte";

export const dynamic = "force-dynamic";

export default async function BerichteKatalogPage() {
  const res = await listBerichte();
  // 403 heißt: dieser Rolle steht der ganze Bereich nicht zu → die Route
  // existiert für sie nicht (wie /hr/auswertung).
  if (!res.ok && res.status === 403) notFound();
  return (
    <BerichteKatalog
      eintraege={res.ok ? res.data : []}
      loadError={res.ok ? null : res.error}
    />
  );
}
