"use client";

// Zustimmungsdialog des MCP-Connectors (0385).
//
// Zeigt bewusst den HOST der client_id-URL als Antragsteller, NICHT einen
// Anzeigenamen aus dem Client-Dokument: das Dokument ist selbst-behauptet,
// jede Seite könnte sich darin „Claude" nennen. Der Host ist die einzige
// geprüfte Identität (MCP-Security-Spec).
import { Icon } from "@iconify/react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { erteileZustimmung } from "@/lib/mcp-verbindungen";

type Props = {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  scope: string;
  state: string;
  resource: string;
  host: string;
};

// Was der Connector lesen darf — die Liste entspricht exakt den Werkzeugen des
// MCP-Servers. Ändert sich dort etwas, gehört es auch hier hinein: der Nutzer
// stimmt zu, was hier steht.
const LESERECHTE = [
  { icon: "solar:calendar-bold-duotone", text: "Kalender und Verfügbarkeit" },
  { icon: "solar:bookmark-bold-duotone", text: "Buchungen und Buchungsnotizen" },
  { icon: "solar:chat-round-line-bold-duotone", text: "Posteingang aller Kanäle" },
];

export function ZustimmungDialog({
  clientId,
  redirectUri,
  codeChallenge,
  scope,
  state,
  resource,
  host,
}: Props) {
  const [laeuft, setLaeuft] = useState(false);

  async function erlauben() {
    setLaeuft(true);
    const res = await erteileZustimmung({
      client_id: clientId,
      redirect_uri: redirectUri,
      code_challenge: codeChallenge,
      scope,
      state,
      resource,
    });
    if (!res.ok) {
      setLaeuft(false);
      toast.error(res.error);
      return;
    }
    // Zurück zum anfragenden Client — dort hängt der Autorisierungscode dran.
    // `location.href` statt Router-Push: das Ziel liegt außerhalb dieser App.
    window.location.href = res.data.weiter_zu;
  }

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="flex w-full max-w-lg flex-col gap-6 p-8">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-xl font-extrabold">
            Zugriff erlauben
          </h1>
          <p className="text-sm text-muted-foreground">
            <span className="break-all font-semibold text-foreground">
              {host}
            </span>{" "}
            möchte auf Ihr myNextDays-Konto zugreifen.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold">Erlaubt wird nur Lesen:</p>
          <ul className="flex flex-col gap-2">
            {LESERECHTE.map((r) => (
              <li key={r.text} className="flex items-center gap-2 text-sm">
                <Icon
                  icon={r.icon}
                  className="size-5 shrink-0 text-muted-foreground"
                />
                {r.text}
              </li>
            ))}
          </ul>
        </div>

        <p className="rounded-2xl bg-muted p-4 text-xs text-muted-foreground">
          Es können keine Daten geändert, keine Nachrichten gesendet und keine
          Buchungen angelegt werden. Sichtbar ist ausschließlich, was Ihre Rolle
          auch in der Oberfläche sieht. Sie können den Zugriff jederzeit unter
          Konto → Verbindungen wieder trennen.
        </p>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="ghost"
            onClick={() => window.history.back()}
            disabled={laeuft}
          >
            Abbrechen
          </Button>
          <Button onClick={erlauben} disabled={laeuft}>
            {laeuft ? "Wird erlaubt …" : "Zugriff erlauben"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
