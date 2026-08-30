// Unterstruktur des Bewertungsbereichs. Vier Flächen, weil sie unterschiedliche
// Arbeit sind: die Bewertungen selbst, die geplanten Bewertungen ÜBER Gäste
// (Warteschlange), die Auswertung und die Einstellungen.
//
// Die vier Flächen stehen als REITER über dem Inhalt, nicht als Seitenspalte
// daneben: die Spalte kostete ein Sechstel der Breite für vier Wörter, und der
// Tabelle fehlte genau die.
//
// Anders als bei den Referenz-Systemen ist die Liste NICHT nach Kanal getrennt
// (dort: „Website" und „Airbnb" nebeneinander) — bei uns laufen Portale und
// myBestDays in einer Liste zusammen, die Herkunft ist ein Filter. Das ist der
// Punkt des Cockpits.
import { BewertungenNav } from "@/components/bewertungen/bewertungen-nav";

export default function BewertungenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Breiter als 6xl und untereinander statt nebeneinander: die Liste ist
    // eine Tabelle mit acht Spalten, und die Seitenspalte hat ihr genau die
    // Breite genommen, die sie braucht (siehe BewertungenNav).
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-6">
      <BewertungenNav />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
