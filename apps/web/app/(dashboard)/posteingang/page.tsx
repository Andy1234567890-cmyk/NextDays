// Posteingang — OTA-Gästekommunikation. Server Component lädt die Threads
// (abgeleitet aus importierten OTA-Buchungen), Client-Teil rendert die Liste.
import { InboxList } from "@/components/inbox/inbox-list";
import { listInboxThreads } from "@/lib/inbox";

export const dynamic = "force-dynamic";

export default async function PosteingangPage() {
  const res = await listInboxThreads();
  return <InboxList threads={res.ok ? res.data.items : []} error={res.ok ? null : res.error} />;
}
