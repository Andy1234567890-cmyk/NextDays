"use client";

// Eigentümer-Portal · Stufe 1: Sperrwünsche der Familie entscheiden (0389).
//
// Wünscht ein Familienmitglied einen Zeitraum zur eigenen Nutzung, landet der
// Wunsch ZUERST hier. Erst nach der Freigabe sieht ihn die Verwaltung; eine
// Ablehnung beendet ihn, ohne dass die Verwaltung je davon erfährt.
//
// WICHTIG für das Verständnis der Fläche: Beide Knöpfe haben KEINE
// Kalenderwirkung. Freigeben sperrt nichts — es reicht den Wunsch nur weiter.
// Die Nächte werden erst belegt, wenn die Verwaltung anschließend genehmigt.
// Der Text unter der Überschrift sagt das ausdrücklich, weil „Freigeben" sonst
// wie „gebucht" gelesen wird.
//
// KEIN Realtime: Eine Freigabe schreibt nichts in `availability` (sie hat ja
// keine Kalenderwirkung), und `block_requests` hat seit 0332 kein SELECT-Grant
// — es gäbe also keine erlaubte Quelle. Die Fläche entfernt die entschiedene
// Zeile stattdessen selbst aus ihrem Zustand.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Card, CardContent } from "@nextdays/ui/card";
import { Textarea } from "@nextdays/ui/textarea";
import {
  type FreigabeAntrag,
  entscheideFreigabe,
} from "@/lib/portal-familie";
import type { PortalProperty } from "@/lib/portal";

export function PortalFreigaben({
  antraege,
  properties,
  error,
}: {
  antraege: FreigabeAntrag[];
  properties: PortalProperty[];
  error: string | null;
}) {
  const t = useTranslations("portal");
  const [liste, setListe] = useState<FreigabeAntrag[]>(antraege);
  const [notizen, setNotizen] = useState<Record<string, string>>({});
  // Je Antrag, nicht global: Während einer entschieden wird, bleiben die
  // anderen bedienbar.
  const [laeuft, setLaeuft] = useState<string | null>(null);

  const objektTitel = (id: string) =>
    properties.find((p) => p.id === id)?.title ?? "";

  async function entscheiden(antrag: FreigabeAntrag, freigeben: boolean) {
    if (laeuft) return;
    setLaeuft(antrag.id);
    const res = await entscheideFreigabe(
      antrag.id,
      freigeben,
      notizen[antrag.id]?.trim() || null,
    );
    setLaeuft(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(
      t(freigeben ? "family.approvals.forwarded" : "family.approvals.declined"),
    );
    // Die eigene Antwort des Servers, kein fremdes Ereignis: die entschiedene
    // Zeile verschwindet aus der Warteschlange, ohne neu zu laden.
    setListe((alt) => alt.filter((a) => a.id !== antrag.id));
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-destructive">
          {error}
        </CardContent>
      </Card>
    );
  }

  if (liste.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h2 className="font-display text-xl font-extrabold">
          {t("family.approvals.title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("family.approvals.hint")}
        </p>
      </header>

      <div className="flex flex-col gap-3">
        {liste.map((a) => (
          <Card key={a.id}>
            <CardContent className="flex flex-col gap-4 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <p className="font-semibold">
                    {/* Der Name, nicht die UUID. Fehlt er ausnahmsweise,
                        steht dort nichts — kein erfundener Platzhalter. */}
                    {a.antragsteller}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {objektTitel(a.property_id)}
                  </p>
                </div>
                <p className="text-sm font-medium">
                  {/* Beide Daten sind INKLUSIV („vom 1. bis zum 5."). */}
                  {a.start_date} – {a.end_date}
                </p>
              </div>

              {a.reason ? (
                <p className="rounded-2xl bg-muted p-3 text-sm">{a.reason}</p>
              ) : null}

              <Textarea
                value={notizen[a.id] ?? ""}
                onChange={(e) =>
                  setNotizen((alt) => ({ ...alt, [a.id]: e.target.value }))
                }
                placeholder={t("family.approvals.notePlaceholder")}
                rows={2}
                disabled={laeuft === a.id}
              />

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  variant="ghost"
                  onClick={() => void entscheiden(a, false)}
                  disabled={laeuft === a.id}
                >
                  <Icon icon="solar:close-circle-bold-duotone" className="size-4" />
                  {t("family.approvals.decline")}
                </Button>
                <Button
                  onClick={() => void entscheiden(a, true)}
                  disabled={laeuft === a.id}
                >
                  <Icon icon="solar:check-circle-bold-duotone" className="size-4" />
                  {t("family.approvals.approve")}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
