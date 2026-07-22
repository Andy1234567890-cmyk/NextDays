import { TasksCalendar } from "@/components/reservierungen/tasks-calendar";

// Aufgaben-Kalender (Default-Reiter): Monats-Timeline aller Aufgaben,
// nach Objekt gruppiert. Live über useRealtime auf tasks.
export default function AufgabenKalenderPage() {
  return <TasksCalendar />;
}
