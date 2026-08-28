// Website → Hinzufügen: KEINE eigene Seite, sondern ein Panel im Editor.
//
// Begründung wie bei „Ebenen": es gibt EINEN Editor, und die Leiste wechselt
// darin nur das Panel. Wer hier landet, kommt von außen (Lesezeichen, direkter
// Aufruf) und wird in den Editor geführt, wo das Panel dann offen ist.
import { redirect } from "next/navigation";

import { ladeBaukasten } from "../daten";
import { KeinZugriff } from "../kein-zugriff";

export const dynamic = "force-dynamic";

export default async function HinzufuegenSeite() {
  const { keinZugriff, pages } = await ladeBaukasten();
  if (keinZugriff) return <KeinZugriff />;
  const ziel = pages.find((p) => p.is_home) ?? pages[0] ?? null;
  redirect(
    ziel ? `/website/seiten/${ziel.id}?panel=hinzufuegen` : "/website/seiten",
  );
}
