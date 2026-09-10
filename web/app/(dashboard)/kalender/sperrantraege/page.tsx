// Agentur-Warteschlange der Eigentümer-Sperranträge (0332).
//
// WARUM ES DIESE SEITE GEBEN MUSS: Das Backend war komplett — Liste,
// Genehmigen, Ablehnen, Widerrufen (calendar/router.py) —, aber KEIN Frontend
// rief es je auf. Jeder Antrag, den ein Eigentümer über sein Portal stellte,
// blieb damit für immer `pending`; die Benachrichtigung `block_decision`
// konnte nie feuern, und der Eigentümer wartete auf eine Antwort, die niemand
// geben konnte. Der Workflow war für den Kunden funktionslos.
//
// Sie liegt unter /kalender, weil eine Entscheidung eine KALENDER-Aktion ist:
// sie sperrt Nächte in `availability` und schiebt sie über die ARI-Outbox an
// die Portale.
import { notFound } from "next/navigation";

import { SperrantragQueue } from "@/components/kalender/sperrantrag-queue";
import { listBlockRequests } from "@/lib/calendar";

// Der Startfilter der Oberflaeche. Er steht hier UND im Client (`filter`),
// weil beide dieselbe erste Liste beschreiben: laedt der Server ungefiltert,
// zeigt die Seite alle Antraege, waehrend die Auswahlbox daneben "Offen"
// behauptet — genau der Zustand, den ein Nutzer als kaputten Filter meldet
// (09.09.2026: genehmigte und abgelehnte Antraege unter "Offen").
const START_FILTER = "pending";

export default async function SperrantraegePage() {
  const res = await listBlockRequests(START_FILTER);
  // Ohne die Capability APPROVE_BLOCK existiert die Seite für diesen Nutzer
  // nicht — kein 403-Kasten, dieselbe Regel wie bei /eigentuemer (Wurzel 3).
  if (!res.ok && res.status === 403) notFound();
  return (
    <SperrantragQueue
      startFilter={START_FILTER}
      initial={res.ok ? res.data.items : []}
      loadError={res.ok ? null : res.error}
    />
  );
}
