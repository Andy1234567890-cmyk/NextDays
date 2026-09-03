// Eigentümer-Portal · Meine Aufgaben (03.09.2026).
//
// Manche Eigentümer reinigen oder empfangen selbst. Die Verwaltung weist ihnen
// dafür im Aufgaben-Popup die Aufgabe zu — und hier sehen sie sie und melden
// zurück. Ohne diese Seite wäre die Zuweisung eine ins Nichts: genau der Grund,
// aus dem Eigentümer bis heute BEWUSST aus der Zuständig-Auswahl entfernt
// waren (11 Aufgaben lagen auf Konten, die sie nie öffnen konnten).
//
// Was der Eigentümer hier sieht, entscheidet der Server (`/tasks/mine`,
// TasksService-Scope): ausschliesslich Aufgaben, die IHM zugewiesen sind UND
// an einem SEINER Objekte hängen. Nicht die Aufgaben des Personals an seinem
// Haus — wer putzt, ist Personaleinsatz des Betriebs (§4.3).
//
// Die Daten holt die Client-Komponente selbst: die Reiter-Einteilung „heute /
// bevorstehend" braucht das Tagesende in der Zeitzone des NUTZERS, und die
// kennt nur der Browser (siehe `listMyTasks`).
import { PortalAufgaben } from "@/components/portal/portal-aufgaben";

export const dynamic = "force-dynamic";

export default function PortalAufgabenPage() {
  return <PortalAufgaben />;
}
