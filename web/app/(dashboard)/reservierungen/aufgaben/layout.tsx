import { TasksSubnav } from "@/components/reservierungen/tasks-subnav";

// Layout des Aufgaben-Moduls: Reiterzeile oben, Inhalt darunter.
//
// Bis zum 31.08.2026 stand die Navigation als 14-rem-Spalte links. Sie nahm
// dem Inhalt Breite weg, die gerade der Aufgabenkalender braucht — jede
// Tagesspalte zählt dort. `min-w-0` bleibt: ohne das sprengt ein breites
// Raster den Flex-Container, statt in seinem eigenen Kasten zu scrollen.
export default function AufgabenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <TasksSubnav />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
