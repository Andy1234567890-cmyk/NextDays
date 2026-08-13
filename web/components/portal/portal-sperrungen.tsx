"use client";

// Eigentümer-Portal · Sperrung beantragen + eigene Anträge mit Status.
//
// Der Eigentümer kann NICHT selbst sperren (§4.2). Diese Fläche ruft
// ausschließlich POST /public-portal/block-requests auf — es gibt hier keinen
// Pfad zu /calendar/block, weder als Knopf noch als Aufruf.
//
// Doppelklick-Schutz: der Sende-Knopf ist während des Sendens gesperrt
// (busy-Guard, Wurzel 2). Der eigentliche Idempotenz-Schutz gehört ins Backend
// — der Guard hier verhindert nur den offensichtlichen Doppelklick.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { PortalRealtime } from "@/components/portal/portal-realtime";
import { Button } from "@nextdays/ui/button";
import { Card, CardContent } from "@nextdays/ui/card";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import { NativeSelect } from "@nextdays/ui/native-select";
import { Textarea } from "@nextdays/ui/textarea";
import {
  type BlockRequest,
  type PortalProperty,
  createBlockRequest,
  getBlockRequests,
} from "@/lib/portal";

const DATUM_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Format UND echter Kalendertag (2026-02-31 wird abgelehnt). Kein
 *  „Reparieren", kein Default (Wurzel 4). */
function gueltigesDatum(s: string): boolean {
  if (!DATUM_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  return d.toISOString().slice(0, 10) === s;
}

// Die drei Werte des Enums `block_request_status` (0014). „cancelled" stand
// hier lange mit — den Wert gibt es weder in der DB noch in der Server-Whitelist
// (calendar/sperrantraege.py), der Zweig war also nie erreichbar. Ein
// unbekannter Status fällt unten ohnehin auf den Rohwert zurück.
//
// Die Freigabe-Stufe des Eigentümers (0389) steht bewusst NICHT hier: Sie ist
// eine eigene Spalte (`owner_freigabe`), kein Status — der Antrag ist in dieser
// Zeit ganz normal „offen", nur eben bei der Familie statt bei der Verwaltung.
const STATUS_KEYS: Record<string, string> = {
  pending: "block.status.pending",
  approved: "block.status.approved",
  rejected: "block.status.rejected",
};

export function PortalSperrungen({
  properties,
  requests,
  error,
}: {
  properties: PortalProperty[];
  requests: BlockRequest[];
  error: string | null;
}) {
  const t = useTranslations("portal");

  const [liste, setListe] = useState<BlockRequest[]>(requests);
  const [ladeFehler, setLadeFehler] = useState<string | null>(error);
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? "");
  const [von, setVon] = useState("");
  const [bis, setBis] = useState("");
  const [grund, setGrund] = useState("");
  // Ich will den Vertrag beenden, nicht nur Nächte sperren. Ein eigenes
  // Kästchen, weil beides verwechselt wurde: ein Antrag „ganzes Jahr sperren"
  // mit der Begründung „ich will nicht mehr vermieten" landete als Sperre, und
  // die Verwaltung musste den Freitext deuten.
  const [kuendigung, setKuendigung] = useState(false);
  const [sendet, setSendet] = useState(false);

  const neuLaden = useCallback(async () => {
    const res = await getBlockRequests();
    if (res.ok) {
      setListe(res.data.items);
      setLadeFehler(null);
    } else {
      // Ein Ladefehler darf nicht als „keine Anträge" erscheinen (Wurzel 4/5).
      setLadeFehler(res.error);
    }
  }, []);

  const senden = async () => {
    if (sendet) return;
    if (!propertyId) return;
    if (!gueltigesDatum(von) || !gueltigesDatum(bis)) {
      toast.error(t("block.invalidDate"));
      return;
    }
    // Beide Daten sind INKLUSIV („vom 1. bis zum 5."), ein eintägiger Antrag
    // ist also gültig. Nur ein Ende VOR dem Start ist falsch — dieselbe Regel
    // prüft das Backend (BlockRequestCreate._check_order).
    if (bis < von) {
      toast.error(t("block.invalidRange"));
      return;
    }
    setSendet(true);
    const res = await createBlockRequest({
      property_id: propertyId,
      start_date: von,
      end_date: bis,
      reason: grund.trim() || null,
      ist_kuendigung: kuendigung,
    });
    setSendet(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(t(kuendigung ? "block.terminationSent" : "block.requested"));
    setVon("");
    setBis("");
    setGrund("");
    setKuendigung(false);
    // Die ANTWORT ist der neue Antrag — sie wird der Liste vorangestellt.
    //
    // Hier stand vorher, das Realtime-Abo auf `block_requests` bringe ihn von
    // selbst herein. Dieses Abo gibt es nicht: `block_requests` hat seit 0332
    // kein SELECT-Grant fuer `authenticated` (die Zeilen tragen Begruendung
    // und interne Entscheidungsnotiz), portal-realtime.tsx laesst es bewusst
    // weg und hoert stattdessen auf `availability` — wohin ein neuer Antrag
    // aber gar nichts schreibt, denn er sperrt ja noch nichts. Der Eigentuemer
    // sah also den Erfolgs-Toast und danach eine unveraenderte Liste.
    //
    // Kein Refetch: das ist die eigene Antwort des Servers, nicht ein fremdes
    // Ereignis. Sie enthaelt bereits alles, was die Zeile braucht.
    setListe((alt) => [res.data, ...alt]);
  };

  return (
    <div className="flex flex-col gap-6">
      <PortalRealtime quellen={["block_requests"]} onChange={() => void neuLaden()} />

      <header className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-extrabold">
          {t("block.title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("block.hint")}</p>
      </header>

      {ladeFehler && (
        <div className="rounded-(--radius) border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {ladeFehler}
        </div>
      )}

      {properties.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
              <Icon icon="ph:house-line" className="size-6" />
            </span>
            <p className="text-sm text-muted-foreground">
              {t("properties.empty")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col gap-4 py-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sperr-objekt">{t("block.property")}</Label>
                <NativeSelect
                  id="sperr-objekt"
                  value={propertyId}
                  onChange={(e) => setPropertyId(e.target.value)}
                >
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sperr-von">{t("block.from")}</Label>
                <Input
                  id="sperr-von"
                  type="date"
                  value={von}
                  onChange={(e) => setVon(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sperr-bis">{t("block.to")}</Label>
                <Input
                  id="sperr-bis"
                  type="date"
                  value={bis}
                  onChange={(e) => setBis(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sperr-grund">{t("block.reason")}</Label>
              <Textarea
                id="sperr-grund"
                rows={2}
                value={grund}
                placeholder={t("block.reasonPlaceholder")}
                onChange={(e) => setGrund(e.target.value)}
              />
            </div>

            {/* Vertragskündigung: bewusst ein eigenes Kästchen und keine
                Auswertung des Begründungstextes. Wer „ich möchte 2027 nicht
                mehr vermieten" schreibt, meint die Kündigung — aber das aus
                Freitext in 24 Sprachen zu schließen, wäre geraten. */}
            <label className="flex items-start gap-2.5 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4 shrink-0"
                checked={kuendigung}
                onChange={(e) => setKuendigung(e.target.checked)}
              />
              <span className="flex flex-col gap-0.5">
                <span className="font-medium">{t("block.termination")}</span>
                <span className="text-xs text-muted-foreground">
                  {t("block.terminationHint")}
                </span>
              </span>
            </label>

            <p className="text-xs text-muted-foreground">
              {t("block.readOnlyHint")}
            </p>

            <div>
              <Button
                type="button"
                onClick={() => void senden()}
                disabled={sendet || !propertyId || !von || !bis}
              >
                {sendet ? t("block.sending") : t("block.submit")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-extrabold">
          {t("block.listTitle")}
        </h2>
        {liste.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                <Icon icon="ph:hand-palm" className="size-6" />
              </span>
              <p className="text-sm text-muted-foreground">
                {t("block.listEmpty")}
              </p>
            </CardContent>
          </Card>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-(--radius) border border-border">
            {liste.map((r) => {
              const objekt = properties.find((p) => p.id === r.property_id);
              // Stufe 1 (0389) hat Vorrang vor dem Status: Solange der Antrag
              // bei der Familie liegt, ist „offen" die falsche Auskunft — der
              // Antragsteller wartete sonst auf die Verwaltung, die den Antrag
              // noch gar nicht kennt.
              const statusKey =
                r.owner_freigabe === "offen"
                  ? "block.status.ownerPending"
                  : r.owner_freigabe === "abgelehnt"
                    ? "block.status.ownerDeclined"
                    : STATUS_KEYS[r.status];
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-4 p-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                    <Icon icon="ph:hand-palm" className="size-5" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">
                      {r.start_date} – {r.end_date}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {objekt?.title ?? r.property_id}
                      {r.reason ? ` · ${r.reason}` : ""}
                    </span>
                    {/* Die Entscheidung der Verwaltung: WANN und mit welcher
                        Anmerkung. Wer entschieden hat, steht bewusst nicht in
                        der Antwort (§4.3) und kann hier gar nicht auftauchen. */}
                    {r.decision_note && (
                      <span className="truncate text-xs text-muted-foreground">
                        {t("block.decisionNote")}: {r.decision_note}
                      </span>
                    )}
                    {/* Vertragsende: das WICHTIGSTE an so einem Antrag und
                        darum im Klartext. `als_kuendigung_gewertet` wird
                        ausdrücklich benannt — hat die Verwaltung meinen
                        Sperrantrag als Kündigung ausgelegt, muss ich das sehen
                        und widersprechen können. */}
                    {r.vertragsende_gesetzt_auf && (
                      <span className="text-xs font-medium">
                        {t(
                          r.als_kuendigung_gewertet && !r.ist_kuendigung
                            ? "block.terminationInterpreted"
                            : "block.terminationConfirmed",
                          { datum: r.vertragsende_gesetzt_auf },
                        )}
                      </span>
                    )}
                    {r.ist_kuendigung && !r.vertragsende_gesetzt_auf && (
                      <span className="text-xs text-muted-foreground">
                        {t("block.terminationPending")}
                      </span>
                    )}
                  </div>
                  {/* Unbekannter Status kommt vom Backend als Rohwert durch,
                      statt ihn zu erfinden oder zu verschlucken (Wurzel 4). */}
                  <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground">
                    {statusKey ? t(statusKey) : r.status}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
