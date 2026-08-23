// `/website` ist keine eigene Ansicht, sondern der Einstieg.
//
// Ohne Seiten führt der Weg auf „Seiten": dort steht die Vorlagen-Auswahl, die
// in einem Klick eine fertige Website erzeugt. Mit Seiten auf „Design" — das
// ist, was der Kunde danach am häufigsten anfasst.
//
// Eine Weiterleitung und keine Kopie der Design-Ansicht: sonst gäbe es zwei
// Adressen für denselben Inhalt, und Lesezeichen zeigten je nach Zufall auf die
// eine oder die andere.
import { redirect } from "next/navigation";

import { ladeBaukasten } from "./daten";

export default async function WebsiteEinstieg() {
  const { pages } = await ladeBaukasten();
  redirect(pages.length === 0 ? "/website/seiten" : "/website/design");
}
