// Angebote (Lastenheft §2.2, 0586): Liste der verschickten Buchungsangebote.
//
// Angelegt werden sie im Kalender (Zeitraum ziehen → „Angebot"), hier laufen
// sie zusammen: Zustand, Frist, Betrag, und die zwei Aktionen, die dem Betrieb
// bleiben — erneut senden und zurückziehen.
import { AngeboteListe } from "@/components/reservierungen/angebote-liste";

export default function AngebotePage() {
  return <AngeboteListe />;
}
