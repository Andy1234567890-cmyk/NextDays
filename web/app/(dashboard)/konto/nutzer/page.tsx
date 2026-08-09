// Konto → Nutzer: echte Tenant-Nutzer (listTenantUsers) + Wizard zum Anlegen.
// Zeigt den Account-Inhaber und alle Mitglieder; Leerzustand nur, wenn wirklich
// keine Nutzer existieren („Benutzer").
import { Icon } from "@iconify/react";
import { getTranslations } from "next-intl/server";

import { UserWizard } from "@/components/konto/user-wizard";
import { UserList } from "@/components/konto/user-list";
import { Button } from "@nextdays/ui/button";
import { listManagedUsers } from "@/lib/account";

export default async function NutzerPage() {
  const t = await getTranslations("account");
  const res = await listManagedUsers();
  const users = res.ok ? res.data : [];
  const forbidden = !res.ok && res.status === 403;

  // Normale Benutzer (staff/cleaner) dürfen die Nutzerverwaltung nicht sehen.
  if (forbidden) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
        <h2 className="font-display text-lg font-extrabold">{t("users.noAccess")}</h2>
        <p className="text-sm text-muted-foreground">
          Nur Administratoren und Kontoinhaber können Benutzer verwalten.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* Kein Realtime mehr: `users` ist für authenticated bewusst gesperrt
        (Wurzel 6, Migration 0337: revoke + raus aus supabase_realtime) — die
        Tabelle trägt Rolle und Berechtigungen, sie darf gerade nicht offen
        sein. Ein Abo darauf wäre eine stumme Attrappe, und eine offene
        Tabelle mit demselben Ereignis gibt es nicht. Ehrlich benannt: ein
        Benutzer, den ein ZWEITER Administrator anlegt, ändert oder entfernt,
        erscheint hier erst beim nächsten Laden der Seite. Eigene Anlagen über
        den Wizard bleiben sichtbar (die Seite lädt danach neu). */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-extrabold">Benutzer</h2>
          <p className="text-sm text-muted-foreground">
            Erstellen Sie Benutzer, um Mitglieder zu Ihrem Konto hinzuzufügen und
            ihnen direkten Zugriff zur Verwaltung von Unterkünften und Buchungen
            zu geben.
          </p>
        </div>
        {users.length > 0 && (
          <UserWizard trigger={<Button className="shrink-0">{t("users.createUser")}</Button>} />
        )}
      </div>

      {users.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <Icon icon="ph:user-circle" className="size-12 text-muted-foreground" />
          <div>
            <p className="font-display text-lg font-extrabold">
              Noch keine Benutzer
            </p>
            <p className="text-sm text-muted-foreground">
              {res.ok
                ? "Sie haben noch keine Benutzer angelegt."
                : "Benutzer konnten nicht geladen werden."}
            </p>
          </div>
          <UserWizard trigger={<Button>{t("users.createUser")}</Button>} />
        </div>
      ) : (
        <UserList users={users} />
      )}
    </div>
  );
}
