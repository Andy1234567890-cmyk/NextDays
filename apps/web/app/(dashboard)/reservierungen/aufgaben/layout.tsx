import { TasksSubnav } from "@/components/reservierungen/tasks-subnav";

// Layout des Aufgaben-Moduls: eigene linke Sub-Nav-Spalte („AUFGABEN") neben
// dem Inhalt — wie Lodgify beim Klick auf „Aufgaben". Die globale PM-Nav wird
// im Aufgaben-Bereich ausgeblendet (pm-module-shell.tsx), sonst stünden zwei
// Nav-Spalten nebeneinander.
export default function AufgabenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
      <aside className="w-full shrink-0 lg:w-56">
        <TasksSubnav />
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
