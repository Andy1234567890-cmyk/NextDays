// Oeffentliche Terminal-Oberflaeche `/terminal/<token>` (Vertrag §3.2, §6).
//
// KEIN LOGIN, KEIN DASHBOARD-CHROME
// ---------------------------------
// Die Seite liegt bewusst ausserhalb der Gruppe `(dashboard)` (Begruendung im
// Nachbar-`layout.tsx`). Sie ruft weder `getMe()` noch `getSession()` und
// laeuft nicht durch `rollen-guard` — ihre Berechtigung ist ausschliesslich
// der Token aus der URL, den das Backend gehasht gegen `personal_terminals`
// prueft.
//
// WARUM DIE SERVER-KOMPONENTE NUR DEN TOKEN WEITERGIBT
// ----------------------------------------------------
// Sie holt hier NICHT `terminalInfo()` vor. Das Terminal laeuft Tage am
// Stueck; ein serverseitig vorgeladener Kopf waere nach einer Stunde falsch
// (Uhr, Wetter, Datum). Die Client-Komponente holt den Kopf selbst und
// aktualisiert ihn — und behaelt den Token dabei nur im Speicher.
import { Terminal } from "@/components/personal/terminal";

export const dynamic = "force-dynamic";

export default async function TerminalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <Terminal token={tokenLesen(token)} />;
}

/**
 * Token aus dem Pfad entpacken.
 *
 * `decodeURIComponent` ist noetig, weil der Token urlsafe-Base64 ist und Next
 * den Pfadteil kodiert weitergibt. Eine kaputte Prozent-Kodierung ist
 * derselbe Fall wie „kein Token": leerer String, den die Oberflaeche als
 * „Link unvollstaendig" anzeigt — nie ein Ersatzwert (Wurzel 4/5).
 */
function tokenLesen(roh: string | undefined): string {
  try {
    return decodeURIComponent(roh ?? "").trim();
  } catch {
    return "";
  }
}
