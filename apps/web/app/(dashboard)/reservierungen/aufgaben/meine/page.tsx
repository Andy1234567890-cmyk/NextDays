import { MyTasksList } from "@/components/reservierungen/my-tasks-list";

// „Meine Aufgaben": dem angemeldeten Nutzer zugewiesene Aufgaben (echte Daten
// über /tasks/mine, live via useRealtime auf tasks).
export default function MeineAufgabenPage() {
  return <MyTasksList />;
}
