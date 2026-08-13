"use client";

// Protokoll der Abrufe über MCP-Verbindungen (0388).
//
// WARUM DIESE ANSICHT EXISTIERT: Der Betrieb ist datenschutzrechtlich
// Verantwortlicher. Fragt ein Gast nach Art. 15 DSGVO „wer hat meine Daten
// bekommen?", muss er antworten können. Ohne diese Liste wäre die Antwort
// „wir wissen es nicht" — und das ist keine zulässige Auskunft.
//
// Bewusst OHNE Inhalte: sichtbar ist, WAS abgerufen wurde (Werkzeug, Ziel,
// Umfang), nie die Gastdaten selbst. Ein Protokoll, das die Nachrichtentexte
// ein zweites Mal zeigt, vergrößert genau das Risiko, das es dokumentiert.
import { Icon } from "@iconify/react";

import { Card } from "@nextdays/ui/card";
import type { McpZugriff } from "@/lib/mcp-verbindungen";

// Technischer Werkzeugname → was der Betrieb darunter versteht. Fehlt ein
// Name, wird er unverändert gezeigt: lieber technisch als falsch beschriftet.
const WERKZEUG_TEXT: Record<string, string> = {
  kalender_verfuegbarkeit: "Kalender gelesen",
  buchungen_liste: "Buchungen gelesen",
  buchung_detail: "Buchung geöffnet",
  posteingang_liste: "Posteingang gelesen",
  posteingang_verlauf: "Nachrichtenverlauf gelesen",
  buchung_notizen: "Notizen gelesen",
};

function zeitpunktLang(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

export function ZugriffeListe({ zugriffe }: { zugriffe: McpZugriff[] }) {
  if (zugriffe.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 p-8 text-center">
        <Icon
          icon="solar:document-text-bold-duotone"
          className="size-8 text-muted-foreground"
        />
        <p className="text-sm font-semibold">Noch keine Abrufe</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Sobald ein verbundener Assistent Daten abruft, steht hier, was er
          gelesen hat — Zeitpunkt, Bereich und Umfang, ohne die Inhalte selbst.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {zugriffe.map((z, i) => (
        <Card
          key={`${z.zeitpunkt}-${i}`}
          className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-sm font-semibold">
              {WERKZEUG_TEXT[z.werkzeug] ?? z.werkzeug}
              {!z.erfolg ? " — abgelehnt" : ""}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {z.host}
              {z.anzahl > 0 ? ` · ${z.anzahl} Datensätze` : ""}
              {z.ziel_id ? ` · ${z.ziel_id}` : ""}
            </span>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">
            {zeitpunktLang(z.zeitpunkt)}
          </span>
        </Card>
      ))}
    </div>
  );
}
