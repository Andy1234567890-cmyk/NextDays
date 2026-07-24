// Plattform-Posteingang (Betrieb-Seite) — Airbnb „Messages" (3 Spalten: Liste /
// Chat / Reservierung). Chat der EIGENEN Plattform (host_messages-Slice), NICHT
// der Channel-Manager/OTA-inbox. Server-Component lädt die initialen Threads +
// Quick Replies; die Client-Komponente pflegt State + Realtime.
import { getQuickReplies, getThreads } from "@/lib/posteingang";

import { Posteingang } from "@/components/posteingang/posteingang";

export default async function NachrichtenPage() {
  const [threads, quickReplies] = await Promise.all([
    getThreads(),
    getQuickReplies(),
  ]);

  return (
    <Posteingang
      initialThreads={threads ?? []}
      quickReplies={quickReplies ?? []}
      zugriffFehlt={threads === null}
    />
  );
}
