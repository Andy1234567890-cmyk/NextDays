// Konto → Tarif & Abo (eigener Tab): Grundgebühr + Objekt-Staffel, Zusatzmodule,
// Abo-Status und die externe Buchungs-Provision. Abrechnung monatlich über
// myNextDays. Die Logik/Realtime steckt in KontoAboSection (Client-Komponente).
import { KontoAboSection } from "@/components/konto/konto-abo-section";

export default function TarifPage() {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <div>
        <h2 className="font-display text-xl font-extrabold">Tarif &amp; Abo</h2>
        <p className="text-sm text-muted-foreground">
          Grundgebühr, Objekt-Staffel und Zusatzmodule sowie die Provision für
          Buchungen über externe Portale. Abrechnung monatlich über myNextDays.
        </p>
      </div>
      <KontoAboSection />
    </div>
  );
}
