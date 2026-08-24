// Deep-Link auf EINEN Verlauf: /posteingang/<thread_id>
//
// WARUM DIESE ROUTE EXISTIERT: Der Benachrichtigungs-Dispatcher schreibt genau
// diesen Pfad in `ziel_pfad` — für neue Gastnachrichten und für Anfragen
// (`notification_settings/ereignisse.py`). Er steht damit in verschickten Mails
// und in der Glocke. Die Route gab es nicht: der Knopf „In myNextDays ansehen"
// führte in ein 404 (live gemeldet am 24.08.2026, Nachricht von Andreas
// Knudsen). Dieselbe Klasse wie `/aufgaben/<id>` am 11.08.2026 — eine
// verschickte Mail ist unwiderruflich draußen, die Adresse darin ist der
// Vertrag.
//
// WARUM KEINE WEITERLEITUNG AUF `?thread=<id>`: Der Posteingang kennt beide
// Formen (der Parameter kommt aus dem Buchungsdetail). Eine Weiterleitung wäre
// ein zusätzlicher Ladeschritt und würde die Adresse aus der Mail im Browser
// gegen eine andere tauschen — wer den Link weitergibt oder als Lesezeichen
// behält, hätte danach eine dritte Form im Umlauf. Die Seite rendert deshalb
// direkt.
//
// WARUM HIER DIE MAIL-WEICHE STEHT und auf `/posteingang` NICHT: Diese Form mit
// ID entsteht ausschließlich im Dispatcher; kein Menüpunkt führt hierher. Die
// Liste dagegen ist ein regulärer Punkt der Sidebar — dort würde dieselbe
// Weiche einen Besucher der Vorführung hinauswerfen. Die Begründung steht
// ausführlich in `lib/benachrichtigungs-ziel.ts`.
import type { Metadata } from "next";

import { InboxList } from "@/components/inbox/inbox-list";
import { getAccount } from "@/lib/account";
import { benachrichtigungsZiel } from "@/lib/benachrichtigungs-ziel";
import { inboxAccessFor } from "@/lib/inbox-access";
import { listInboxThreads } from "@/lib/inbox";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  // Generisch und nicht der Gastname: der Verlauf darf serverseitig noch nicht
  // geladen werden, sein Scope hängt am angemeldeten Nutzer. Ein geratener
  // Titel wäre eine Aussage über Daten, die wir hier nicht kennen.
  title: "Posteingang",
};

export default async function VerlaufDeepLinkPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  await benachrichtigungsZiel(`/posteingang/${threadId}`);

  const [res, acc] = await Promise.all([listInboxThreads(), getAccount()]);
  const access = acc.ok
    ? inboxAccessFor(acc.data.role, acc.data.permissions)
    : inboxAccessFor(null, []); // fail-closed, wenn /me nicht ladbar
  return (
    <InboxList
      threads={res.ok ? res.data.items : []}
      error={res.ok ? null : res.error}
      access={access}
      initialThreadId={threadId}
    />
  );
}
