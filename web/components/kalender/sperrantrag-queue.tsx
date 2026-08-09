"use client";

// Agentur-Warteschlange der Eigentümer-Sperranträge (0332).
//
// Sie bedient ALLE VIER Endpunkte des Workflows — Liste, Genehmigen, Ablehnen,
// Widerrufen. Bis hierher hatte keiner davon einen Aufrufer: das Backend war
// vollständig und getestet, aber kein Frontend rief es je auf. Jeder Antrag
// blieb dadurch für immer `pending`, und `block_decision` konnte nie feuern —
// der Eigentümer sah in seinem Portal ewig „In Prüfung".
//
// Jede Aktion ist ein Seiteneffekt am Kalender und wird deshalb BESTÄTIGT,
// bevor sie läuft; Fehler (409 „Zeitraum enthält gebuchte Tage", 409 „bereits
// entschieden") werden im Klartext gezeigt und nicht verschluckt (Wurzel 5).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Card, CardContent } from "@nextdays/ui/card";
import { Label } from "@nextdays/ui/label";
import { NativeSelect } from "@nextdays/ui/native-select";
import { Textarea } from "@nextdays/ui/textarea";
import { useRealtime } from "@/lib/use-realtime";
import {
  type Sperrantrag,
  approveBlockRequest,
  listBlockRequests,
  rejectBlockRequest,
  revokeBlockRequest,
} from "@/lib/calendar";

type Aktion = "approve" | "reject" | "revoke";

const STATUS_KEYS: Record<string, string> = {
  pending: "blockRequests.status.pending",
  approved: "blockRequests.status.approved",
  rejected: "blockRequests.status.rejected",
};

/** Nur diese Aktionen sind aus dem jeweiligen Zustand möglich — dieselbe
 *  Regel wie im Zustandsautomaten des Backends (sperrantraege.py). Ein Knopf,
 *  den der Server ohnehin mit 409 abweist, wird gar nicht erst gezeigt. */
function aktionenFuer(status: string): Aktion[] {
  if (status === "pending") return ["approve", "reject"];
  if (status === "approved") return ["revoke"];
  return [];
}

export function SperrantragQueue({
  initial,
  loadError,
}: {
  initial: Sperrantrag[];
  loadError: string | null;
}) {
  const t = useTranslations("calendar");

  const [liste, setListe] = useState<Sperrantrag[]>(initial);
  const [fehler, setFehler] = useState<string | null>(loadError);
  const [filter, setFilter] = useState<string>("pending");
  const [laeuft, setLaeuft] = useState<string | null>(null);
  // Entscheidungs-Notiz je Antrag. Sie geht an den Eigentümer und ist der
  // einzige Weg, ihm ein „warum" mitzugeben.
  const [notizen, setNotizen] = useState<Record<string, string>>({});

  const neuLaden = useCallback(async () => {
    const res = await listBlockRequests(filter || undefined);
    if (res.ok) {
      setListe(res.data.items);
      setFehler(null);
    } else {
      // Ein Ladefehler ist NICHT „keine Anträge" — beides muss unterscheidbar
      // bleiben (Wurzel 4/5).
      setFehler(res.error);
    }
  }, [filter]);

  // Realtime: eine Genehmigung schreibt in `availability`, und ein NEUER
  // Antrag eines Eigentümers muss hier von selbst auftauchen. `block_requests`
  // hat seit 0332 kein SELECT-Grant für `authenticated` (die Zeilen tragen
  // Begründung und interne Entscheidungsnotiz) — ein Abo darauf wäre eine
  // stumme Attrappe. `availability` ist die erlaubte Quelle für die WIRKUNG;
  // für den reinen Eingang eines neuen Antrags gibt es keine, das ist hier
  // ehrlich benannt statt mit einem toten Abo kaschiert.
  useRealtime({ table: "availability", onChange: () => void neuLaden() });

  const entscheiden = async (antrag: Sperrantrag, aktion: Aktion) => {
    if (laeuft) return;
    const frage = t(`blockRequests.confirm.${aktion}`, {
      objekt: antrag.property_title ?? antrag.property_id,
      von: antrag.start_date,
      bis: antrag.end_date,
    });
    // Jede dieser Aktionen verändert den Verkauf: Genehmigen sperrt die Nächte
    // bei allen Portalen, Widerrufen gibt sie wieder frei.
    if (!window.confirm(frage)) return;

    setLaeuft(antrag.id);
    const notiz = (notizen[antrag.id] ?? "").trim() || null;
    const res =
      aktion === "approve"
        ? await approveBlockRequest(antrag.id, notiz)
        : aktion === "reject"
          ? await rejectBlockRequest(antrag.id, notiz)
          : await revokeBlockRequest(antrag.id, notiz);
    setLaeuft(null);

    if (!res.ok) {
      // Der Grund kommt vom Server im Klartext („Zeitraum enthält bereits
      // gebuchte Tage") — er wird gezeigt, nicht durch einen eigenen Satz
      // ersetzt.
      setFehler(res.error);
      toast.error(res.error);
      return;
    }
    toast.success(t(`blockRequests.done.${aktion}`));
    setFehler(null);
    setNotizen((n) => {
      const rest = { ...n };
      delete rest[antrag.id];
      return rest;
    });
    // Die Antwort IST der neue Zustand des Antrags — kein Refetch nach der
    // eigenen Aktion. Passt er nicht mehr zum Filter, verschwindet die Zeile.
    setListe((alt) =>
      filter && res.data.status !== filter
        ? alt.filter((a) => a.id !== antrag.id)
        : alt.map((a) => (a.id === antrag.id ? res.data : a)),
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-extrabold">
          {t("blockRequests.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("blockRequests.subtitle")}
        </p>
      </header>

      {fehler && (
        <div className="rounded-(--radius) border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {fehler}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Label htmlFor="antrag-filter" className="text-muted-foreground">
          {t("blockRequests.filter")}
        </Label>
        <NativeSelect
          id="antrag-filter"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            // Der Filter ist eine ANFRAGE an den Server, keine eigene Aktion —
            // hier ist Nachladen richtig.
            void (async () => {
              const res = await listBlockRequests(e.target.value || undefined);
              if (res.ok) {
                setListe(res.data.items);
                setFehler(null);
              } else {
                setFehler(res.error);
              }
            })();
          }}
          className="min-w-48"
        >
          <option value="pending">{t("blockRequests.status.pending")}</option>
          <option value="approved">{t("blockRequests.status.approved")}</option>
          <option value="rejected">{t("blockRequests.status.rejected")}</option>
          <option value="">{t("blockRequests.filterAll")}</option>
        </NativeSelect>
      </div>

      {liste.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
              <Icon icon="ph:hand-palm" className="size-6" />
            </span>
            <p className="text-sm text-muted-foreground">
              {t("blockRequests.empty")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {liste.map((a) => {
            const aktionen = aktionenFuer(a.status);
            const statusKey = STATUS_KEYS[a.status];
            return (
              <li key={a.id}>
                <Card>
                  <CardContent className="flex flex-col gap-4 py-5">
                    <div className="flex flex-wrap items-start gap-4">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                        <Icon icon="ph:hand-palm" className="size-5" />
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate font-medium">
                          {a.property_title ?? a.property_id}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {a.start_date} – {a.end_date}
                        </span>
                        {a.requested_by_name && (
                          <span className="truncate text-xs text-muted-foreground">
                            {t("blockRequests.requestedBy", {
                              name: a.requested_by_name,
                            })}
                          </span>
                        )}
                        {a.reason && (
                          <span className="text-sm">
                            {t("blockRequests.reason")}: {a.reason}
                          </span>
                        )}
                        {a.decision_note && (
                          <span className="text-xs text-muted-foreground">
                            {t("blockRequests.decisionNote")}: {a.decision_note}
                          </span>
                        )}
                      </div>
                      {/* Unbekannter Status kommt als Rohwert durch, statt
                          erfunden oder verschluckt zu werden (Wurzel 4). */}
                      <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground">
                        {statusKey ? t(statusKey) : a.status}
                      </span>
                    </div>

                    {aktionen.length > 0 && (
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor={`notiz-${a.id}`}>
                            {t("blockRequests.note")}
                          </Label>
                          <Textarea
                            id={`notiz-${a.id}`}
                            rows={2}
                            value={notizen[a.id] ?? ""}
                            placeholder={t("blockRequests.notePlaceholder")}
                            onChange={(e) =>
                              setNotizen((n) => ({
                                ...n,
                                [a.id]: e.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {aktionen.map((aktion) => (
                            <Button
                              key={aktion}
                              type="button"
                              variant={
                                aktion === "approve" ? "default" : "outline"
                              }
                              disabled={laeuft !== null}
                              onClick={() => void entscheiden(a, aktion)}
                            >
                              {laeuft === a.id
                                ? t("blockRequests.working")
                                : t(`blockRequests.action.${aktion}`)}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
