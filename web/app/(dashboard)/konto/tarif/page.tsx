// Konto → Tarif & Abo (eigener Tab): zwei Reiter — „Abrechnung" (Status,
// Rechnungsadresse, Rechnungen) und „Tarif" (Objektzahl-Rechner, Leistungs-
// umfang, Marktvergleich). Überschrift und Reiter stecken in KontoAboSection,
// weil sie sich je nach aktivem Reiter ändern.
import { KontoAboSection } from "@/components/konto/konto-abo-section";

export default function TarifPage() {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <KontoAboSection />
    </div>
  );
}
