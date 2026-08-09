// Eine Ankündigung bearbeiten, veröffentlichen oder zurückziehen.
//
// Eigene Route je Ankündigung (statt Inline-Editor in der Liste): der
// TipTap-Editor ist UNKONTROLLIERT — `value` wirkt nur beim Mounten. Ohne
// Routenwechsel zeigte er beim Umschalten weiterhin den zuletzt geladenen Text.
import { notFound } from "next/navigation";

import { getAnkuendigung } from "@/lib/announcements";
import { getPlatformMe } from "@/lib/backoffice";

import { AnkuendigungFormular } from "@/components/ankuendigungen/ankuendigung-formular";

export default async function AnkuendigungSeite({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const me = await getPlatformMe();

  let ankuendigung;
  try {
    ankuendigung = await getAnkuendigung(id);
  } catch {
    // Eine unbekannte ID ist hier immer 404 — es gibt keinen Mandanten-Scope,
    // an dem sie scheitern könnte, nur „gibt es nicht".
    notFound();
  }

  return (
    <AnkuendigungFormular
      vorhanden={ankuendigung}
      darfSchreiben={me.can_write}
    />
  );
}
