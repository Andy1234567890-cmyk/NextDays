"use client";

// Liste der erteilten MCP-Verbindungen mit „Trennen".
// Trennen widerruft die Zustimmung UND löscht die Refresh-Token — sonst könnte
// die Anwendung sich noch bis zu 30 Tage neue Zugangstoken holen, und
// „getrennt" wäre eine Falschaussage.
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
// Der Scope-Wert kommt aus einer Nachbardatei OHNE "use server": dort dürfen
// nur async functions exportiert werden, ein `const` bräche erst beim Build.
import { SCOPE_FREITEXT } from "@/lib/mcp-scopes";
import {
  setzeUmfang,
  trenneVerbindung,
  type McpVerbindung,
} from "@/lib/mcp-verbindungen";

function datumKurz(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

export function VerbindungenListe({
  verbindungen,
}: {
  verbindungen: McpVerbindung[];
}) {
  const router = useRouter();
  const [laeuft, setLaeuft] = useState<string | null>(null);

  async function umfangSetzen(clientId: string, freitexte: boolean) {
    setLaeuft(clientId);
    const res = await setzeUmfang(clientId, freitexte);
    setLaeuft(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(
      freitexte
        ? "Freitexte freigegeben."
        : // Ehrlich benennen, was passiert: Der Entzug löscht die
          // Erneuerungs-Token, damit er sofort wirkt und nicht erst nach
          // Ablauf des aktuellen Zugangstokens.
          "Freitexte gesperrt. Die Anwendung muss sich neu anmelden.",
    );
    router.refresh();
  }

  async function trennen(clientId: string) {
    setLaeuft(clientId);
    const res = await trenneVerbindung(clientId);
    setLaeuft(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Verbindung getrennt.");
    router.refresh();
  }

  if (verbindungen.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 p-8 text-center">
        <Icon
          icon="solar:link-broken-bold-duotone"
          className="size-8 text-muted-foreground"
        />
        <p className="text-sm font-semibold">Keine Verbindungen</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Sobald Sie einen KI-Assistenten mit Ihrem Konto verbinden, erscheint
          er hier. Die Verbindung starten Sie in der jeweiligen Anwendung.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {verbindungen.map((v) => (
        <Card
          key={v.client_id}
          className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate font-semibold">{v.host}</span>
              <span className="text-xs text-muted-foreground">
                Lesender Zugriff
                {v.scope.split(" ").includes(SCOPE_FREITEXT)
                  ? " · mit Freitexten"
                  : ""}
                {v.erteilt_am ? ` · seit ${datumKurz(v.erteilt_am)}` : ""}
              </span>
            </div>

            {/* Freitexte nachträglich schalten (0389).
                Vorher ging das nur beim Verbinden — wer sie später brauchte,
                musste trennen und neu verbinden, während der Hinweis in den
                Werkzeugen selbst auf „Konto → Verbindungen" verwies. */}
            <label className="flex cursor-pointer items-start gap-2 text-xs">
              <input
                type="checkbox"
                checked={v.scope.split(" ").includes(SCOPE_FREITEXT)}
                onChange={(e) => umfangSetzen(v.client_id, e.target.checked)}
                disabled={laeuft === v.client_id}
                className="mt-0.5 size-3.5 shrink-0 accent-primary"
              />
              <span className="text-muted-foreground">
                Freitexte freigeben — Nachrichteninhalte und Buchungsnotizen.
                Diese Felder enthalten häufig Angaben zur Gesundheit und sind
                deshalb besonders geschützt. Ohne die Freigabe sieht der Dienst
                nur, DASS eine Nachricht vorliegt — nicht, was darin steht.
              </span>
            </label>
          </div>
          <Button
            variant="ghost"
            onClick={() => trennen(v.client_id)}
            disabled={laeuft === v.client_id}
          >
            {laeuft === v.client_id ? "Wird getrennt …" : "Trennen"}
          </Button>
        </Card>
      ))}
    </div>
  );
}
