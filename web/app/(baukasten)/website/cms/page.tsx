// Website → CMS: KEINE eigene Seite, sondern ein Panel im Editor (0480).
//
// Begründung wie beim Blog: es gibt EINEN Editor, und die Leiste wechselt darin
// nur das Panel. Im Vorbild (Framers CMS-Modus) liegt das CMS über der
// Arbeitsfläche; die Seite dahinter bleibt stehen, samt Vorschau.
//
// Wer hier landet, kommt von außen (Lesezeichen, direkter Aufruf) und wird in
// den Editor geführt, wo das Panel dann offen ist. Diese Route ist damit die
// ADRESSE des Panels und keine zweite Ansicht daneben.
import { redirect } from "next/navigation";

import { ladeBaukasten } from "../daten";
import { KeinZugriff } from "../kein-zugriff";

export const dynamic = "force-dynamic";

export default async function CmsSeite() {
  const { keinZugriff, pages } = await ladeBaukasten();
  if (keinZugriff) return <KeinZugriff />;
  // Das CMS gehört zu keiner einzelnen Seite. Der Editor braucht aber eine
  // offene, über der das Panel liegen kann — die Startseite, sonst die erste.
  const ziel = pages.find((p) => p.is_home) ?? pages[0] ?? null;
  redirect(ziel ? `/website/seiten/${ziel.id}?panel=cms` : "/website/seiten");
}
