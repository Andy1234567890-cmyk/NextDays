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
import { SCOPE_FREITEXT, SCOPE_LESEN, SCOPE_SCHREIBEN } from "@/lib/mcp-scopes";
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
  { icon: "solar:bookmark-bold-duotone", text: "Buchungen mit Gastname und Zeitraum" },
  { icon: "solar:home-2-bold-duotone", text: "Objekte, Einheiten und Preise" },
  { icon: "solar:checklist-bold-duotone", text: "Aufgaben und Bewertungen" },
  { icon: "solar:users-group-rounded-bold-duotone", text: "Gäste-Stammdaten (rollenabhängig)" },
  { icon: "solar:chat-round-line-bold-duotone", text: "Posteingang aller Kanäle (Übersicht)" },
];

// Der Freitext-Scope kommt aus `lib/mcp-scopes` — eine zweite Kopie hier war
// genau die Sorte Duplikat, die beim nächsten Umbenennen auseinanderläuft.

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
  // Freitexte sind bewusst AUS als Voreinstellung (Art. 25 Abs. 2 DSGVO):
  // Notizen und Gastnachrichten enthalten regelmäßig Gesundheitsangaben
  // („Rollstuhl", „Allergie"). Wer sie braucht, schaltet sie zu — niemand
  // überträgt sie versehentlich, weil ein Häkchen vorbelegt war.
  const [freitexte, setFreitexte] = useState(false);
  // Schreiben ebenso AUS — auch wenn der Client es anfragt. Diese Aufrufe
  // gehen live an Booking.com und Airbnb; ein falsch gesetzter Preis kostet
  // echtes Geld. Ein vorbelegtes Häkchen würde die Entscheidung des Betriebs
  // vorwegnehmen, und genau die soll hier bewusst fallen.
  const [schreiben, setSchreiben] = useState(false);

  // Was der Client ANGEFRAGT hat — nur zur Anzeige. Die Freigabe entscheidet
  // allein das Häkchen; eine Anfrage ist keine Erlaubnis.
  const angefragt = scope.split(" ");
  const willSchreiben = angefragt.includes(SCOPE_SCHREIBEN);

  async function erlauben() {
    setLaeuft(true);
    // Aus den Achsen ZUSAMMENSETZEN statt an `scope` anzuhängen: Der
    // übergebene Wert enthielt den Freitext-Scope bereits, wenn der Client ihn
    // angefragt hatte — angehängt stand er dann doppelt in der Datenbank
    // (`mcp:read mcp:freetext mcp:freetext`, live gefunden 14.08.2026).
    const gewaehlt = [
      SCOPE_LESEN,
      ...(freitexte ? [SCOPE_FREITEXT] : []),
      ...(schreiben ? [SCOPE_SCHREIBEN] : []),
    ].join(" ");
    const res = await erteileZustimmung({
      client_id: clientId,
      redirect_uri: redirectUri,
      code_challenge: codeChallenge,
      scope: gewaehlt,
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
          {/* Die Überschrift folgt der Auswahl: „nur Lesen" wäre falsch,
              sobald das Schreib-Häkchen gesetzt ist. */}
          <p className="text-sm font-semibold">
            {schreiben ? "Gelesen werden darf:" : "Erlaubt wird nur Lesen:"}
          </p>
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

        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border p-4">
          <input
            type="checkbox"
            checked={freitexte}
            onChange={(e) => setFreitexte(e.target.checked)}
            disabled={laeuft}
            className="mt-0.5 size-4 shrink-0 accent-primary"
          />
          <span className="flex flex-col gap-1">
            <span className="text-sm font-semibold">
              Zusätzlich Freitexte freigeben
            </span>
            <span className="text-xs text-muted-foreground">
              Buchungsnotizen und der Inhalt von Gastnachrichten. Diese Felder
              enthalten häufig Angaben zur Gesundheit (etwa „Rollstuhl" oder
              „Allergie") und sind deshalb besonders geschützt. Ohne diese
              Freigabe sieht der Dienst nur, DASS eine Nachricht vorliegt —
              nicht, was darin steht.
            </span>
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border p-4">
          <input
            type="checkbox"
            checked={schreiben}
            onChange={(e) => setSchreiben(e.target.checked)}
            disabled={laeuft}
            className="mt-0.5 size-4 shrink-0 accent-primary"
          />
          <span className="flex flex-col gap-1">
            <span className="text-sm font-semibold">
              Änderungen erlauben
              {willSchreiben ? " (angefragt)" : ""}
            </span>
            <span className="text-xs text-muted-foreground">
              Kalender sperren, Preise setzen, Buchungen stornieren oder
              verschieben, Aufgaben führen und Nachrichten an Gäste senden.{" "}
              <span className="font-semibold text-foreground">
                Diese Änderungen gehen sofort an alle Portale und lassen sich
                nicht zurücknehmen.
              </span>{" "}
              Ohne diese Freigabe kann der Dienst ausschließlich lesen.
            </span>
          </span>
        </label>

        <p className="rounded-2xl bg-muted p-4 text-xs text-muted-foreground">
          Das Konto bleibt in jedem Fall ausgenommen: Abo, Rechnungen,
          Benutzerverwaltung, Sicherheitseinstellungen und diese Verbindungen
          selbst kann der Dienst weder sehen noch ändern. Sichtbar ist im
          Übrigen ausschließlich, was Ihre Rolle auch in der Oberfläche sieht.
          Die Daten werden dabei an{" "}
          <span className="font-semibold text-foreground">{host}</span>{" "}
          übertragen — bei Anbietern außerhalb der EU auch in ein Drittland. Sie
          können den Zugriff jederzeit unter Konto → Verbindungen wieder
          trennen; er endet dann sofort. Jeder Abruf wird dort protokolliert.
        </p>

        <p className="rounded-2xl border border-border p-4 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">
            Bitte einen Geschäftskunden-Zugang verwenden.
          </span>{" "}
          Für Gästedaten eignet sich nur ein Zugang, für den der Anbieter eine
          Auftragsverarbeitung anbietet und eine Verwendung zum Training seiner
          Modelle ausschließt — bei Claude sind das Team, Enterprise oder API.
          Zugänge für private Nutzung erfüllen das in der Regel nicht. Wir
          können nicht erkennen, welchen Zugang Sie verwenden.
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
