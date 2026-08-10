// Konto → Nutzer: echte Tenant-Nutzer (listManagedUsers) + Wizard zum Anlegen.
// Zeigt den Account-Inhaber und alle Mitglieder mit Rolle und Zugangs-Status;
// jede Zeile führt auf die Detailseite (/konto/nutzer/<id>). Leerzustand nur,
// wenn wirklich keine Nutzer existieren („Benutzer").
import { Icon } from "@iconify/react";
import { getTranslations } from "next-intl/server";

import { UserWizard } from "@/components/konto/user-wizard";
import { UserList } from "@/components/konto/user-list";
import { Button } from "@nextdays/ui/button";
import { getAccount, listManagedUsers } from "@/lib/account";

export default async function NutzerPage() {
  const t = await getTranslations("account");
  const [res, konto] = await Promise.all([listManagedUsers(), getAccount()]);
  const users = res.ok ? res.data : [];
  const forbidden = !res.ok && res.status === 403;

  // Normale Benutzer (staff/cleaner) dürfen die Nutzerverwaltung nicht sehen.
  if (forbidden) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
        <h2 className="font-display text-lg font-extrabold">{t("users.noAccess")}</h2>
        <p className="text-sm text-muted-foreground">{t("users.noAccessHint")}</p>
      </div>
    );
  }

  return (
    // pb-20 wie auf der Detailseite: der Support-Chat schwebt unten rechts und
    // deckt sonst das „…"-Menü der letzten Zeile ab.
    <div className="flex flex-1 flex-col gap-4 pb-20">
      {/* Kein Realtime: `users` ist für authenticated bewusst gesperrt
        (Wurzel 6, Migration 0337: revoke + raus aus supabase_realtime) — die
        Tabelle trägt Rolle, Berechtigungen und interne Anmerkungen, sie darf
        nicht offen sein. Ein Abo darauf wäre eine stumme Attrappe, und eine
        offene Tabelle mit demselben Ereignis gibt es nicht. Ehrlich benannt:
        ein Benutzer, den ein ZWEITER Administrator anlegt, ändert oder
        entfernt, erscheint hier erst beim nächsten Laden der Seite. Eigene
        Änderungen bleiben sichtbar (die Aktionen lösen `router.refresh()`
        bzw. `revalidatePath` aus). */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-extrabold">
            {t("users.title")}
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {t("users.intro")}
          </p>
        </div>
        {users.length > 0 && (
          <UserWizard
            tenantCountry={konto.ok ? konto.data.tenant_country : null}
            trigger={<Button className="shrink-0">{t("users.createUser")}</Button>}
          />
        )}
      </div>

      {users.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <Icon icon="ph:user-circle" className="size-12 text-muted-foreground" />
          <div>
            <p className="font-display text-lg font-extrabold">
              {t("users.emptyTitle")}
            </p>
            <p className="text-sm text-muted-foreground">
              {res.ok ? t("users.emptyHint") : t("users.loadFailed")}
            </p>
          </div>
          <UserWizard
            tenantCountry={konto.ok ? konto.data.tenant_country : null}
            trigger={<Button>{t("users.createUser")}</Button>}
          />
        </div>
      ) : (
        <UserList users={users} />
      )}
    </div>
  );
}
