// Eine Ankündigung bearbeiten, veröffentlichen oder zurückziehen.
//
// Eigene Route je Ankündigung (statt Inline-Editor in der Liste): der
// TipTap-Editor ist UNKONTROLLIERT — `value` wirkt nur beim Mounten. Ohne
// Routenwechsel zeigte er beim Umschalten weiterhin den zuletzt geladenen Text.
import { notFound } from "next/navigation";

import { getAnkuendigung, getFassungen } from "@/lib/announcements";
import { getPlatformMe } from "@/lib/backoffice";

import { AnkuendigungFormular } from "@/components/ankuendigungen/ankuendigung-formular";
import { UebersetzungenPanel } from "@/components/ankuendigungen/uebersetzungen-panel";

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

  // Der Sprachstand hängt an derselben Ankündigung und wird deshalb hier
  // mitgeladen — ein zweiter Roundtrip aus dem Client heraus würde den Bereich
  // erst nach dem ersten Rendern erscheinen lassen.
  const uebersicht = await getFassungen(id);

  return (
    <>
      <AnkuendigungFormular
        vorhanden={ankuendigung}
        darfSchreiben={me.can_write}
      />
      <div className="px-8 pb-12 lg:px-12">
        <UebersetzungenPanel
          announcementId={id}
          uebersicht={uebersicht}
          darfSchreiben={me.can_write}
        />
      </div>
    </>
  );
}
