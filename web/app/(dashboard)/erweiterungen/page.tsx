// Erweiterungen (/erweiterungen) — die buchbaren Zusatzmodule des Abos.
//
// Eigene Fläche, NICHT in der Abrechnung: dort stehen Tarif, Rechnungsadresse
// und Rechnungen. Lodgify trennt das genauso (Marktplatz vs. Abrechnung) — der
// Modul-Verkauf gehört auf eine Browsing-Fläche mit Kacheln und Detailseiten.
import { ErweiterungenListe } from "@/components/erweiterungen/erweiterungen-liste";

export const dynamic = "force-dynamic";

export default function ErweiterungenPage() {
  return (
    <div className="flex w-full flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-extrabold">Erweiterungen</h1>
        <p className="text-sm text-muted-foreground">
          Zusätzliche Module für Ihr myNextDays-Abo. Sie buchen sie einzeln dazu
          und können sie jederzeit wieder kündigen.
        </p>
      </header>
      <ErweiterungenListe />
    </div>
  );
}
