// Quick-Replies-Verwaltung (Airbnb „Manage quick replies"): Nachrichten-Vorlagen
// des Betriebs anlegen/bearbeiten/löschen. Nur admin/co_admin (Backend erzwingt
// INBOX_MANAGE_CONFIG). Server lädt die Vorlagen; Client verwaltet.
import { getQuickReplies } from "@/lib/posteingang";

import { VorlagenVerwaltung } from "@/components/posteingang/vorlagen-verwaltung";

export default async function VorlagenPage() {
  const vorlagen = await getQuickReplies();
  return <VorlagenVerwaltung initial={vorlagen ?? []} />;
}
