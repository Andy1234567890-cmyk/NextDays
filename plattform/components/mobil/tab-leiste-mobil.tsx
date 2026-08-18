// Server-Wrapper der unteren Tab-Leiste: liest die Gast-Session (nd_access) und
// die Unread-Summe und übergibt beides an den Client-Teil. Gleiches Muster wie
// `konto-menu.tsx` — die Session bleibt HttpOnly, der Client erfährt nur
// „eingeloggt: ja/nein" und eine Zahl.
import { serverUnreadCount } from "@/lib/guest-server";
import { isGuestLoggedIn } from "@/lib/guest-session";

import { TabLeisteUnten } from "./tab-leiste-unten";

export async function TabLeisteMobil() {
  const eingeloggt = await isGuestLoggedIn();
  if (!eingeloggt) return <TabLeisteUnten eingeloggt={false} />;
  const unread = await serverUnreadCount();
  return <TabLeisteUnten eingeloggt unread={unread} />;
}
