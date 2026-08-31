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
//
// „Genehmigen" geht NICHT über ein `window.confirm`, sondern über den
// Prüf-Dialog: eine Genehmigung sperrt die Nächte bei allen Portalen, und die
// Frage „ist der Zeitraum überhaupt frei?" ist bei einem Jahresantrag die
// eigentliche Arbeit. Ein Ja/Nein-Fenster ohne diesen Befund führte dazu, dass
// man bestätigte und erst danach — aus einem nackten 409 — erfuhr, dass eine
// Buchung im Weg steht, ohne zu wissen welche. Ablehnen und Widerrufen bleiben
// beim `confirm`: sie brauchen keinen Befund (Ablehnen hat gar keinen
// Kalender-Effekt, Widerrufen gibt nur die eigenen Nächte frei).
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
  rejectBlockLift,
  revokeBlockRequest,
} from "@/lib/calendar";
import { SperrantragPruefungDialog } from "./sperrantrag-pruefung-dialog";

type Aktion = "approve" | "reject" | "revoke" | "rejectLift";

const STATUS_KEYS: Record<string, string> = {
  pending: "blockRequests.status.pending",
  approved: "blockRequests.status.approved",
  rejected: "blockRequests.status.rejected",
};

/** Nur diese Aktionen sind aus dem jeweiligen Zustand möglich — dieselbe
 *  Regel wie im Zustandsautomaten des Backends (sperrantraege.py). Ein Knopf,
 *  den der Server ohnehin mit 409 abweist, wird gar nicht erst gezeigt. */
function aktionenFuer(status: string, aufhebung: string): Aktion[] {
  if (status === "pending") return ["approve", "reject"];
  if (status === "approved") {
    // Liegt ein Aufhebungswunsch vor (0513), sind es ZWEI Entscheidungen:
    // „revoke" hebt auf und erfuellt damit den Wunsch, „rejectLift" lehnt ihn
    // ab und laesst die Sperrung stehen. Ohne den zweiten Knopf haette die
    // Agentur nur die Wahl zwischen Aufheben und Nichtstun — und der
    // Eigentuemer saehe ewig „wird geprueft".
    return aufhebung === "beantragt" ? ["revoke", "rejectLift"] : ["revoke"];
  }
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
  // Der Antrag, dessen Prüf-Dialog offen ist. Der ganze Antrag statt nur der
  // ID: der Dialog zeigt Objektname/Zeitraum/Einheit, und die Zeile könnte
  // durch ein Realtime-Ereignis aus der Liste verschwinden, während der Dialog
  // noch offen ist.
  const [pruefung, setPruefung] = useState<Sperrantrag | null>(null);
  // Die Server-Ablehnung DIESES Prüfvorgangs. Getrennt von `fehler` (der
  // Seitenfehler), weil sie im Dialog steht und beim Öffnen leer sein muss —
  // sonst zeigte der Dialog die Ablehnung eines vorherigen Antrags.
  const [pruefFehler, setPruefFehler] = useState<string | null>(null);

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

  /** Führt die Entscheidung aus. Rückgabe: hat sie gegriffen, und wenn nicht,
   *  warum?
   *
   *  Der Prüf-Dialog braucht beides: er bleibt offen, wenn der Server ablehnt,
   *  und zeigt den Grund an sich selbst. Ein Dialog, der sich auch im
   *  Fehlerfall schließt, verbirgt genau die Begründung, für die er gebaut
   *  wurde. */
  const entscheiden = async (
    antrag: Sperrantrag,
    aktion: Aktion,
    kuendigung: { vertragsende: string | null } | null = null,
  ): Promise<{ ok: true } | { ok: false; error: string }> => {
    setLaeuft(antrag.id);
    const notiz = (notizen[antrag.id] ?? "").trim() || null;
    const res =
      aktion === "approve"
        ? await approveBlockRequest(antrag.id, notiz, kuendigung)
        : aktion === "reject"
          ? await rejectBlockRequest(antrag.id, notiz)
          : aktion === "rejectLift"
            ? await rejectBlockLift(antrag.id, notiz)
            : await revokeBlockRequest(antrag.id, notiz);
    setLaeuft(null);

    if (!res.ok) {
      // Der Grund kommt vom Server im Klartext („Zeitraum enthält bereits
      // gebuchte Tage") — er wird gezeigt, nicht durch einen eigenen Satz
      // ersetzt.
      setFehler(res.error);
      toast.error(res.error);
      return { ok: false, error: res.error };
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
    return { ok: true };
  };

  /** Der Klick auf einen Aktionsknopf.
   *
   *  „Genehmigen" führt in die Prüfung — dort entscheidet der Befund, ob der
   *  Knopf überhaupt freigegeben wird. Die beiden anderen fragen nur nach:
   *  Ablehnen hat gar keinen Kalender-Effekt, Widerrufen gibt nur die Nächte
   *  DIESES Antrags frei, es gibt dort also nichts zu prüfen. */
  const anstossen = (antrag: Sperrantrag, aktion: Aktion) => {
    if (laeuft) return;
    if (aktion === "approve") {
      setPruefFehler(null);
      setPruefung(antrag);
      return;
    }
    const frage = t(`blockRequests.confirm.${aktion}`, {
      objekt: antrag.property_title ?? antrag.property_id,
      von: antrag.start_date,
      bis: antrag.end_date,
    });
    if (!window.confirm(frage)) return;
    void entscheiden(antrag, aktion);
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
            const aktionen = aktionenFuer(a.status, a.aufhebung);
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
                        {/* Bestellte Leistungen (0510). Wer genehmigt,
                            entscheidet damit auch ueber die Arbeit, die
                            entsteht - das gehoert vor die Entscheidung, nicht
                            in eine Detailansicht dahinter. Steht nichts da,
                            entsteht auch keine Aufgabe; bis 0510 lief die
                            volle Regelkette ungefragt an. */}
                        {/* Der Aufhebungswunsch (0513) — die wichtigste
                            Zeile fuer die Entscheidung, deshalb hervorgehoben.
                            Solange er offen ist, bleiben Naechte gesperrt, die
                            niemand mehr braucht: jeder Tag ohne Entscheidung
                            ist ein Tag ohne Verkaufsmoeglichkeit. */}
                        {a.aufhebung === "beantragt" && (
                          <span className="text-sm font-semibold text-accent">
                            {t("blockRequests.liftRequested")}
                            {a.aufhebung_grund ? `: ${a.aufhebung_grund}` : ""}
                          </span>
                        )}
                        {a.bestellte_leistungen.length > 0 ? (
                          <span className="text-sm">
                            {t("blockRequests.servicesOrdered")}:{" "}
                            {a.bestellte_leistungen
                              .map((b) => b.name)
                              .join(", ")}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {t("blockRequests.servicesNone")}
                          </span>
                        )}
                        {/* Eine Kündigung ist etwas anderes als eine Sperre und
                            muss in der Warteschlange auf den ersten Blick als
                            solche erkennbar sein — sonst wird sie wie ein
                            Sperrwunsch abgearbeitet. */}
                        {a.vertragsende_gesetzt_auf ? (
                          <span className="text-sm">
                            {t("blockRequests.terminationSet", {
                              datum: a.vertragsende_gesetzt_auf,
                            })}
                          </span>
                        ) : (
                          a.ist_kuendigung && (
                            <span className="text-sm">
                              {t("blockRequests.terminationRequested")}
                            </span>
                          )
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
                              onClick={() => anstossen(a, aktion)}
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

      {/* Der Prüf-Dialog. Er schließt NUR bei Erfolg — scheitert die
          Genehmigung (409, weil zwischen Anzeige und Klick eine Buchung
          eingegangen ist), bleibt er offen: der Server-Grund steht dann direkt
          neben dem Befund, statt hinter einem geschlossenen Fenster. */}
      {pruefung && (
        <SperrantragPruefungDialog
          antrag={pruefung}
          open
          laeuft={laeuft === pruefung.id}
          fehler={pruefFehler}
          onClose={() => setPruefung(null)}
          onGenehmigen={(kuendigung) => {
            const antrag = pruefung;
            setPruefFehler(null);
            void (async () => {
              const ergebnis = await entscheiden(
                antrag,
                "approve",
                kuendigung,
              );
              if (ergebnis.ok) setPruefung(null);
              else setPruefFehler(ergebnis.error);
            })();
          }}
        />
      )}
    </div>
  );
}
