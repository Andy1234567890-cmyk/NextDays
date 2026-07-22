// Nachrichten-Seite. Server lädt Threads + Session-Token + Gast-ID und reicht
// sie an die Realtime-Client-Komponente. ?reservation=<id> öffnet (bzw. legt
// idempotent an) den Thread zu dieser Buchung.
import { redirect } from "next/navigation";

import { KontoShell } from "@/components/konto-shell";
import { NachrichtenClient } from "@/components/nachrichten-client";
import { guestAccessToken } from "@/lib/guest-session";
import {
  serverEnsureThread,
  serverGuestMe,
  serverThreads,
} from "@/lib/guest-server";

export default async function NachrichtenPage({
  searchParams,
}: {
  searchParams: Promise<{ reservation?: string }>;
}) {
  const { reservation } = await searchParams;

  const [me, token] = await Promise.all([
    serverGuestMe(),
    guestAccessToken(),
  ]);
  if (!me) redirect("/anmelden?weiter=/nachrichten");

  // Falls über eine Buchung gekommen: Thread sicherstellen (idempotent).
  let initialThreadId: string | null = null;
  if (reservation) {
    initialThreadId = await serverEnsureThread(reservation);
  }

  const threads = await serverThreads();

  return (
    <KontoShell titel="Nachrichten" breit>
      <NachrichtenClient
        token={token}
        guestId={me.guest_id}
        initialThreads={threads}
        initialThreadId={initialThreadId}
      />
    </KontoShell>
  );
}
