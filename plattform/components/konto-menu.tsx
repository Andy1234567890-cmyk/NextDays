// Server-Wrapper für den Konto-Button: liest die Session (nd_access), das
// Gast-Profil und die Unread-Summe und rendert den Client-Button/-Dropdown.
import { KontoButton } from "./konto-button";
import { isGuestLoggedIn } from "@/lib/guest-session";
import { serverGuestMe, serverUnreadCount } from "@/lib/guest-server";

export async function KontoMenu() {
  const eingeloggt = await isGuestLoggedIn();
  if (!eingeloggt) {
    return <KontoButton eingeloggt={false} name={null} unread={0} />;
  }
  const [me, unread] = await Promise.all([
    serverGuestMe(),
    serverUnreadCount(),
  ]);
  return (
    <KontoButton eingeloggt name={me?.name ?? me?.email ?? null} unread={unread} />
  );
}
