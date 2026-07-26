// Hilfe & Support des Gastgebers: eigene Anfragen + geführter Kontakt-Flow.
import { getTickets } from "@/lib/support";

import { SupportAnsicht } from "@/components/support/support-ansicht";

export default async function SupportSeite() {
  const liste = await getTickets();
  return <SupportAnsicht tickets={liste.items} />;
}
