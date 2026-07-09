// Aufgaben-Reiter der PM-Fläche. Zeigt die dem angemeldeten Nutzer zugewiesenen
// Aufgaben (echte Daten über /tasks/mine). Aufgaben je Buchung stehen zusätzlich
// direkt auf der jeweiligen Buchungsdetailseite.
import { MyTasksList } from "@/components/reservierungen/my-tasks-list";

export default function AufgabenPage() {
  return <MyTasksList />;
}
