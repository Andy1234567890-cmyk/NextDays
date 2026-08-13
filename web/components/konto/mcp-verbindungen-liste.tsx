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
import { trenneVerbindung, type McpVerbindung } from "@/lib/mcp-verbindungen";

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
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate font-semibold">{v.host}</span>
            <span className="text-xs text-muted-foreground">
              Lesender Zugriff{v.erteilt_am ? ` · seit ${datumKurz(v.erteilt_am)}` : ""}
            </span>
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
