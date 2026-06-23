// Posteingang — OTA-Gästekommunikation. Server Component lädt die Threads
// (abgeleitet aus importierten OTA-Buchungen), Client-Teil rendert die Liste.
// Das Posteingang-Zugriffsmodell (Scope/Aktionen/Feld-Maske) wird aus den
// effektiven Permissions des Nutzers abgeleitet und ans UI durchgereicht.
import { InboxList } from "@/components/inbox/inbox-list";
import { getAccount } from "@/lib/account";
import { inboxAccessFor } from "@/lib/inbox-access";
import { listInboxThreads } from "@/lib/inbox";

export const dynamic = "force-dynamic";

export default async function PosteingangPage() {
  const [res, acc] = await Promise.all([listInboxThreads(), getAccount()]);
  const access = acc.ok
    ? inboxAccessFor(acc.data.role, acc.data.permissions)
    : inboxAccessFor(null, []); // fail-closed, wenn /me nicht ladbar
  return (
    <InboxList
      threads={res.ok ? res.data.items : []}
      error={res.ok ? null : res.error}
      access={access}
    />
  );
}
