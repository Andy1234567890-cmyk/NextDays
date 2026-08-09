// Neue Ankündigung anlegen.
//
// Eigene Route (kein Inline-Formular in der Liste): der TipTap-Editor ist
// UNKONTROLLIERT — `value` ist nur der Startwert. Nur ein echter Remount, den
// ein Routenwechsel garantiert, setzt seinen Inhalt zuverlässig zurück.
import { notFound } from "next/navigation";

import { getPlatformMe } from "@/lib/backoffice";

import { AnkuendigungFormular } from "@/components/ankuendigungen/ankuendigung-formular";

export default async function NeueAnkuendigungSeite() {
  const me = await getPlatformMe();
  // Ein Anlege-Formular für jemanden, der nicht schreiben darf, wäre eine
  // Einladung in einen sicheren Fehler — der Server lehnt ohnehin ab.
  if (!me.can_write) notFound();

  return <AnkuendigungFormular darfSchreiben />;
}
