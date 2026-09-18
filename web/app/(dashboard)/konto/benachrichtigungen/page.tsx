// Konto → Benachrichtigungen (/konto/benachrichtigungen).
//
// Die EIGENEN Einstellungen — jede Rolle sieht diese Seite, denn jede Rolle
// bekommt Mails. Sie hing bis zum 18.09.2026 an keiner Oberfläche: der
// notification_settings-Slice war vollständig, erreichbar war er im PMS aber
// nirgends. Wer zu viele Mails bekam, konnte nichts tun.
//
// Serverseitig geladen, weil `notification_settings` für `authenticated`
// bewusst gesperrt ist (Wurzel 6) — ein Client-Fetch mit anon-Key käme nicht
// an die Zeile, und ein Realtime-Abo darauf wäre eine stumme Attrappe.
import { getTranslations } from "next-intl/server";

import { BenachrichtigungsEinstellungen } from "@/components/konto/benachrichtigungs-einstellungen";
import { getEigene } from "@/lib/benachrichtigungen";

export const dynamic = "force-dynamic";

export default async function KontoBenachrichtigungenPage() {
  const [res, t] = await Promise.all([
    getEigene(),
    getTranslations("account.notifications"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-extrabold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
      </header>
      <BenachrichtigungsEinstellungen
        overview={res.ok ? res.data : null}
        error={res.ok ? null : res.error}
      />
    </div>
  );
}
