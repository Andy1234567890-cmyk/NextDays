// Konto → Abrechnung: Guthaben des verbundenen Stripe-Kontos, Auszahlung
// beantragen und Auszahlungs-Rhythmus wählen. Erreichbar über das Nutzermenü
// („Abrechnung"), das bis hierher auf keine Seite zeigte.
import { KontoAbrechnung } from "@/components/konto/konto-abrechnung";

export default function AbrechnungPage() {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <KontoAbrechnung />
    </div>
  );
}
