// Konto → Nutzer: Leerzustand + Wizard zum Anlegen (wie Lodgify „Benutzer").
import { Icon } from "@iconify/react";

import { UserWizard } from "@/components/konto/user-wizard";
import { Button } from "@/components/ui/button";

export default function NutzerPage() {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <div>
        <h2 className="font-display text-xl font-extrabold">Benutzer</h2>
        <p className="text-sm text-muted-foreground">
          Erstellen Sie Benutzer, um Mitglieder zu Ihrem Konto hinzuzufügen und
          ihnen direkten Zugriff zur Verwaltung von Unterkünften und Buchungen zu
          geben.
        </p>
      </div>

      {/* Leerzustand — vertikal + horizontal zentriert im verbleibenden Platz */}
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <Icon icon="ph:user-circle" className="size-12 text-muted-foreground" />
        <div>
          <p className="font-display text-lg font-extrabold">
            Noch keine Benutzer
          </p>
          <p className="text-sm text-muted-foreground">
            Sie haben noch keine Benutzer angelegt.
          </p>
        </div>
        <UserWizard trigger={<Button>Benutzer erstellen</Button>} />
      </div>
    </div>
  );
}
