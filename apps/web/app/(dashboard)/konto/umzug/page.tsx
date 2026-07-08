// Konto → Umzug (eigener Tab): zentraler „Von Lodgify & anderen wechseln"-Bereich.
// Der Kunde verbindet pro Objekt die iCal-URL seines alten Anbieters; die
// Belegung wird übernommen und bleibt synchron. Kein Datenimport, nur Kalender.
import { KontoUmzugSection } from "@/components/konto/konto-umzug-section";

export default function UmzugPage() {
  return <KontoUmzugSection />;
}
