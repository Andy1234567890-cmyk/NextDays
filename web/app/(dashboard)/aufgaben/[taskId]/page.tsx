// Deep-Link auf EINE Aufgabe: /aufgaben/<task_id>
//
// WARUM DIESE ROUTE AUF DER OBERSTEN EBENE LIEGT (und nicht unter
// /reservierungen/aufgaben/<id>):
// Diese URL steht bereits in verschickten Benachrichtigungs-Mails („Neue
// Aufgabe: …" → „In myNextDays ansehen"). Eine Mail ist unwiderruflich raus;
// wer sie morgen öffnet, muss ankommen. Die Route trägt deshalb genau die Form,
// die im Postfach steht — sie umzubenennen hieße, jede bereits zugestellte Mail
// ins Leere laufen zu lassen. Live gesehen: sie lief in ein 404 (11.08.2026).
//
// WIE ES DIE ANDEREN MACHEN (Recherche 11.08.2026):
//   * Lodgify (PM-Module → Aufgaben) öffnet eine Aufgabe als MODAL über dem
//     Aufgaben-Kalender; die URL bleibt `#/pm/modules`. Es gibt dort KEINE
//     Adresse je Aufgabe — folgerichtig verschickt Lodgify auch keine
//     Aufgaben-Links.
//   * Hostaway hat Aufgaben-Detail mit Status (To Do/Accepted/In Progress/
//     Done), Checkliste, Kosten, Resolution + Score und Anhängen, und schickt
//     Erinnerungen an die zuständige Person.
// Wir verschicken Links (Hostaway-Weg), zeigen die Aufgabe im Alltag aber als
// Overlay (Lodgify-Weg). Beides bedient DIESELBE Komponente
// (`TaskDetailInhalt`) — kein zweiter Aufbau derselben Aufgabe.
//
// SICHTBARKEIT: Der Server entscheidet (`GET /tasks/detail/<id>`, Wurzel 9):
// eigener Mandant, und für staff/cleaner nur innerhalb der eigenen
// Objekt-Freigabe. Alles andere ist ein 404 — gelöscht, fremd und
// nicht-freigegeben sehen für den Aufrufer gleich aus, sonst verrät die
// Meldung die Existenz einer fremden Aufgabe.
import type { Metadata } from "next";

import { AufgabeSeite } from "@/components/reservierungen/aufgabe-seite";
import { benachrichtigungsZiel } from "@/lib/benachrichtigungs-ziel";

export const metadata: Metadata = {
  // Der Titel steht bewusst NICHT in der Metadata: er käme aus der Aufgabe, und
  // die darf hier serverseitig noch gar nicht geladen werden (der Scope hängt
  // am eingeloggten Nutzer). Ein generischer Titel ist ehrlicher als ein
  // geratener.
  title: "Aufgabe",
};

export default async function AufgabeDeepLinkPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  // Ziel einer Benachrichtigung: im richtigen Konto oeffnen, sonst zurueck zur
  // Anmeldung MIT diesem Pfad als Rueckziel. Begruendung und der live
  // beobachtete Fehlweg stehen in `lib/benachrichtigungs-ziel.ts`.
  const me = await benachrichtigungsZiel(`/aufgaben/${taskId}`);

  // Wer Aufgaben VERTEILT, darf das auch aus der Mail heraus. Diese Seite ist
  // die einzige Detailansicht, die aus einer Benachrichtigung geöffnet wird —
  // ein Verwalter, der hier eine falsch zugewiesene Aufgabe vor sich hat,
  // müsste sonst den Umweg über /team nehmen. Die Rolle kommt vom Server
  // (`/auth/me`, aus der DB), nicht aus dem Client; der Endpunkt prüft
  // `MANAGE_TASKS` ohnehin erneut.
  const darfZuweisen =
    me?.role === "admin" ||
    me?.role === "co_admin" ||
    (me?.capabilities ?? []).includes("manage_tasks") ||
    (me?.permissions ?? []).includes("manage_tasks");
  return <AufgabeSeite taskId={taskId} darfZuweisen={darfZuweisen} />;
}
