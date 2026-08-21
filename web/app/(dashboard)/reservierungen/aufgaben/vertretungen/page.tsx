import { VertretungenListe } from "@/components/reservierungen/vertretungen-liste";

// Vertretungen: offene Anfragen von Kolleginnen und Kollegen (echte Daten über
// GET /tasks/substitution, live via useRealtime auf task_substitutions). Ziel
// der Benachrichtigung aus Kategorie `task_substitution` (0415).
export default function VertretungenPage() {
  return <VertretungenListe />;
}
