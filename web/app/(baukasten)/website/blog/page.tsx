// Website → Blog: KEINE eigene Seite, sondern ein Panel im Editor.
//
// Begründung wie bei „Ebenen" und „Hinzufügen": es gibt EINEN Editor, und die
// Leiste wechselt darin nur das Panel. Im Vorbild (`docs/UI`, Foto 19.04.33)
// fährt das Blog-CMS von links über die Arbeitsfläche — die Seite dahinter
// bleibt stehen, samt Vorschau.
//
// Wer hier landet, kommt von außen (Lesezeichen, direkter Aufruf) und wird in
// den Editor geführt, wo das Panel dann offen ist. Diese Route ist damit nur
// noch die ADRESSE des Panels, nicht mehr eine zweite Ansicht daneben.
import { redirect } from "next/navigation";

import { ladeBaukasten } from "../daten";
import { KeinZugriff } from "../kein-zugriff";

export const dynamic = "force-dynamic";

export default async function BlogSeite() {
  const { keinZugriff, pages } = await ladeBaukasten();
  if (keinZugriff) return <KeinZugriff />;
  // Der Blog hängt an der Startseite wie jedes andere Panel: das CMS gehört
  // nicht zu EINER Seite, aber der Editor braucht eine offene, über der es
  // liegen kann.
  const ziel = pages.find((p) => p.is_home) ?? pages[0] ?? null;
  redirect(ziel ? `/website/seiten/${ziel.id}?panel=blog` : "/website/seiten");
}
