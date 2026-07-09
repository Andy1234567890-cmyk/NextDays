// PM-Modul → Kontrollzentrum (Lodgify „STARTSEITE → Kontrollzentrum"): globale
// Kachel-Übersicht über ALLE (owner-sichtbaren) Objekte des Tenants — KPI-Kacheln
// mit Sparklines, %-Vergleich, Kanal-Donuts + Objekt-Filter. Liegt im PM-Modul
// (linke PM-Nav aus dem reservierungen-Layout), NICHT auf dem Haupt-Dashboard.
import { ControlCenterView } from "@/components/reservierungen/control-center";

export default function KontrollzentrumPage() {
  return <ControlCenterView />;
}
