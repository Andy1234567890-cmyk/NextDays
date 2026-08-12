"use client";

// Was steht der Genehmigung eines Sperrantrags im Weg? — die Prüfung VOR dem
// Klick.
//
// WARUM DIESER DIALOG EXISTIERT: Bis hierher war „Genehmigen" ein Knopf, der
// entweder wirkte oder mit „Zeitraum enthält bereits belegte/gesperrte Tage"
// abwies. Bei einem Jahresantrag (live vorhanden: 01.01.–31.12.2027) ist dieser
// Satz die gesamte Information — welche Buchung im Weg steht, von wem, an
// welchen Tagen, ob überhaupt eine Einheit frei ist, stand nirgends. Die
// Entscheiderin musste im Kalender suchen.
//
// Hier steht jetzt der Befund, bevor etwas passiert: kollidierende Buchungen
// mit Gast/Kanal/Zeitraum/Betrag, gesperrte Nächte, Stop-Sell-Tage und die
// Zahl freier Einheiten.
//
// ES WIRD NICHTS AUTOMATISCH STORNIERT (Entscheidung 12.08.2026): eine echte
// Gastbuchung zu stornieren, weil ein Eigentümer sperren will, hat
// Außenwirkung (Gast-Mail, Rückzahlung, OTA-Meldung) und keinen Rückweg. Der
// Dialog ZEIGT die Buchungen und verlinkt sie; die Agentur storniert bewusst
// einzeln. Solange eine im Weg steht, bleibt „Genehmigen" gesperrt — der
// Server würde ohnehin mit 409 abweisen (dieselbe Prüfung), und ein Knopf, der
// sicher scheitert, ist eine Falle.
//
// Die Vorschau ist KEIN Anspruch: zwischen Anzeige und Klick kann eine
// OTA-Buchung eingehen. Der Server prüft beim Genehmigen erneut und gewinnt.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Button } from "@nextdays/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@nextdays/ui/dialog";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import { formatCurrency } from "@/lib/currency";
import {
  type Sperrantrag,
  type SperrantragKollisionen,
  blockRequestKollisionen,
} from "@/lib/calendar";

/** Ladezustand der Prüfung. `null` = noch nicht geladen. */
type Stand =
  | { art: "laedt" }
  | { art: "fehler"; text: string }
  | { art: "befund"; k: SperrantragKollisionen };

export function SperrantragPruefungDialog({
  antrag,
  open,
  onClose,
  onGenehmigen,
  laeuft,
  fehler,
}: {
  antrag: Sperrantrag;
  open: boolean;
  onClose: () => void;
  /** `kuendigung` gesetzt → als Vertragskündigung genehmigen (Vertragsende
   *  setzen statt Nächte sperren). `null` → normale Sperrung. */
  onGenehmigen: (kuendigung: { vertragsende: string | null } | null) => void;
  laeuft: boolean;
  /** Der Grund, aus dem der Server die Genehmigung eben abgelehnt hat. Er
   *  gehört HIER hin und nicht nur in die Liste hinter dem Dialog: wer gerade
   *  auf „Genehmigen" gedrückt hat, schaut hierhin. */
  fehler: string | null;
}) {
  const t = useTranslations("calendar");
  const [stand, setStand] = useState<Stand>({ art: "laedt" });
  // Hat der Eigentümer selbst gekündigt, steht der Modus fest und ist nicht
  // abwählbar — seine Erklärung deutet die Agentur nicht um.
  //
  // `Boolean(...)` ist hier nicht Kosmetik: der Wert kommt aus einer
  // HTTP-Antwort, und der TypeScript-Typ ist dafür nur eine Behauptung. Fehlt
  // das Feld (Antwort aus einem Cache/Payload von vor 0377), wäre der
  // Anfangswert `undefined` — React behandelt `checked={undefined}` als
  // UNKONTROLLIERTES Feld und warnt beim ersten Klick „changing an
  // uncontrolled input to be controlled". Genau das ist live passiert.
  const [alsKuendigung, setAlsKuendigung] = useState(
    Boolean(antrag.ist_kuendigung),
  );
  // Das Vertragsende. Leer = der Server nimmt den Antragsbeginn; ein eigener
  // Wert wird ausdrücklich gesetzt (der Vertrag läuft z. B. bis Monatsende).
  const [ende, setEnde] = useState("");

  useEffect(() => {
    if (!open) return;
    let aktuell = true;
    setStand({ art: "laedt" });
    void (async () => {
      const res = await blockRequestKollisionen(antrag.id, alsKuendigung);
      if (!aktuell) return;
      setStand(
        res.ok
          ? { art: "befund", k: res.data }
          : // Ein Ladefehler ist NICHT „frei" — sonst genehmigt jemand auf
            // Basis einer Prüfung, die nie gelaufen ist (Wurzel 5,
            // fail-closed). Der Knopf bleibt gesperrt.
            { art: "fehler", text: res.error },
      );
    })();
    return () => {
      aktuell = false;
    };
    // `alsKuendigung` gehört in die Abhängigkeiten: das Umschalten stellt eine
    // ANDERE Frage an den Server (ein Vertragsende ist dann Zielzustand statt
    // Hindernis) und muss die Prüfung neu laden.
  }, [open, antrag.id, alsKuendigung]);

  const befund = stand.art === "befund" ? stand.k : null;
  // Genehmigen ist NUR erlaubt, wenn die Prüfung gelaufen ist UND nichts im
  // Weg steht. Nicht geladen / Fehler → gesperrt.
  const darfGenehmigen = befund !== null && !befund.blockiert && !laeuft;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogTitle>{t("blockRequests.check.title")}</DialogTitle>

        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            {t("blockRequests.check.subtitle", {
              objekt: antrag.property_title ?? antrag.property_id,
              von: antrag.start_date,
              bis: antrag.end_date,
            })}
          </p>

          {stand.art === "laedt" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon icon="ph:circle-notch" className="size-4 animate-spin" />
              {t("blockRequests.check.loading")}
            </div>
          )}

          {stand.art === "fehler" && (
            <div className="rounded-(--radius) border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {stand.text}
            </div>
          )}

          {/* Der Umschalter „ist eine Vertragskündigung". Er steht ÜBER dem
              Befund, weil er die Frage ändert, die darunter beantwortet wird.
              Hat der Eigentümer selbst gekündigt, ist er festgestellt und nicht
              abwählbar — seine Erklärung deutet die Agentur nicht um. */}
          <div className="flex flex-col gap-2 rounded-(--radius) border border-border p-3">
            <label className="flex items-start gap-2.5 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4 shrink-0"
                checked={alsKuendigung}
                disabled={Boolean(antrag.ist_kuendigung) || laeuft}
                onChange={(e) => setAlsKuendigung(e.target.checked)}
              />
              <span className="flex flex-col gap-0.5">
                <span className="font-medium">
                  {t("blockRequests.check.isTermination")}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t(
                    antrag.ist_kuendigung
                      ? "blockRequests.check.terminationByOwner"
                      : "blockRequests.check.terminationHint",
                  )}
                </span>
              </span>
            </label>
            {alsKuendigung && (
              <div className="flex flex-col gap-1.5 pl-6.5">
                <Label htmlFor={`ende-${antrag.id}`} className="text-xs">
                  {t("blockRequests.check.contractEndLabel")}
                </Label>
                <Input
                  id={`ende-${antrag.id}`}
                  type="date"
                  className="max-w-48"
                  value={ende}
                  disabled={laeuft}
                  onChange={(e) => setEnde(e.target.value)}
                />
                <span className="text-xs text-muted-foreground">
                  {t("blockRequests.check.contractEndHint", {
                    datum: antrag.start_date,
                  })}
                </span>
              </div>
            )}
          </div>

          {befund && <Befund k={befund} antrag={antrag} />}

          {/* Die Ablehnung des Servers — sie steht UNTER dem Befund, weil sie
              jünger ist als er: zwischen Prüfung und Klick ist etwas
              hinzugekommen. */}
          {fehler && (
            <div className="rounded-(--radius) border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {fehler}
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              {t("blockRequests.check.close")}
            </Button>
            <Button
              type="button"
              disabled={!darfGenehmigen}
              onClick={() =>
                onGenehmigen(
                  alsKuendigung ? { vertragsende: ende || null } : null,
                )
              }
            >
              {laeuft
                ? t("blockRequests.working")
                : t(
                    alsKuendigung
                      ? "blockRequests.check.approveTermination"
                      : "blockRequests.action.approve",
                  )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Der Befund selbst — Ampel, Zahlen, dann die Aufzählung. */
function Befund({
  k,
  antrag,
}: {
  k: SperrantragKollisionen;
  antrag: Sperrantrag;
}) {
  const t = useTranslations("calendar");
  return (
    <div className="flex flex-col gap-4">
      {/* Die Ampel: das Erste, was gelesen wird. */}
      <div
        className={
          k.blockiert
            ? "flex items-start gap-3 rounded-(--radius) border border-destructive/40 bg-destructive/10 p-3"
            : "flex items-start gap-3 rounded-(--radius) border border-border bg-secondary p-3"
        }
      >
        <Icon
          icon={k.blockiert ? "ph:warning" : "ph:check-circle"}
          className={
            k.blockiert
              ? "mt-0.5 size-5 shrink-0 text-destructive"
              : "mt-0.5 size-5 shrink-0 text-muted-foreground"
          }
        />
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-sm font-medium">
            {k.blockiert
              ? t(`blockRequests.check.blocked.${k.grund ?? "belegt"}`)
              : t(
                  // Bei einer Kündigung ist „der Zeitraum ist verfügbar" die
                  // falsche Aussage: sie belegt nichts, es geht um das
                  // Vertragsende. Sonst stünde da eine Bestätigung, die zur
                  // Handlung nicht passt.
                  k.als_kuendigung
                    ? "blockRequests.check.terminationReady"
                    : "blockRequests.check.free",
                )}
          </span>
          {/* Freie Einheiten sind bei einer Kündigung keine Information: sie
              belegt nichts. Dort zählt das Datum. */}
          <span className="text-xs text-muted-foreground">
            {k.als_kuendigung
              ? t("blockRequests.check.terminationSummary", {
                  datum: k.start_date,
                })
              : t("blockRequests.check.summary", {
                  naechte: k.naechte,
                  einheiten: k.einheiten_gesamt,
                  frei: k.min_freie_einheiten,
                })}
          </span>
          {/* Der Vorschlag: was ginge stattdessen. Nur bei Blockade und nur,
              wenn es überhaupt eine freie Spanne gibt. */}
          {/* Vertragsende ist die einzige Ursache, die man nicht durch
              Stornieren/Aufheben löst — sie braucht einen eigenen Hinweis,
              sonst sucht man im Kalender nach etwas, das dort nicht steht. */}
          {k.grund === "vertragsende" && (
            <span className="text-xs text-muted-foreground">
              {t("blockRequests.check.contractHint")}
            </span>
          )}
          {k.blockiert && k.grund !== "vertragsende" && k.frei_von && k.frei_bis && (
            <span className="text-xs text-muted-foreground">
              {t("blockRequests.check.suggestion", {
                von: k.frei_von,
                bis: k.frei_bis,
              })}
            </span>
          )}
          {/* Bei mehreren Einheiten ist wichtig, WELCHE belegt würde — sonst
              bleibt unklar, was die Genehmigung eigentlich zumacht. */}
          {!k.blockiert && k.freie_einheit_name && (
            <span className="text-xs text-muted-foreground">
              {t("blockRequests.check.willUse", {
                einheit: k.freie_einheit_name,
              })}
            </span>
          )}
        </div>
      </div>

      {k.buchungen_gesamt > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">
            {t(
              k.als_kuendigung
                ? "blockRequests.check.bookingsAfterEnd"
                : "blockRequests.check.bookings",
              { anzahl: k.buchungen_gesamt },
            )}
          </h3>
          {/* Zwei verschiedene Aussagen: Bei einer SPERRE müssen die Buchungen
              weg, damit genehmigt werden kann. Bei einer KÜNDIGUNG bleiben sie
              gültig und werden bedient — der Vertrag läuft für sie aus (0359).
              Hier „bitte stornieren" zu schreiben, wäre falsch. */}
          <p className="text-xs text-muted-foreground">
            {t(
              k.als_kuendigung
                ? "blockRequests.check.bookingsAfterEndHint"
                : "blockRequests.check.bookingsHint",
            )}
          </p>
          <ul className="flex flex-col divide-y divide-border rounded-(--radius) border border-border">
            {k.buchungen.map((b) => (
              <li
                key={b.reservation_id}
                className="flex flex-wrap items-center gap-3 p-3"
              >
                <Icon
                  icon={b.is_owner_stay ? "ph:house" : "ph:suitcase-rolling"}
                  className="size-4 shrink-0 text-muted-foreground"
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">
                    {b.bezeichnung}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {b.check_in} – {b.check_out}
                    {b.unit_name ? ` · ${b.unit_name}` : ""}
                    {b.ota_name ? ` · ${b.ota_name}` : ` · ${b.channel}`}
                  </span>
                </div>
                {/* Betrag über formatCurrency: fehlt die Währung, wird
                    symbollos gerendert statt „€" behauptet (Wurzel 4). */}
                {b.total_amount !== null && (
                  <span className="shrink-0 text-sm tabular-nums">
                    {formatCurrency(b.total_amount, b.currency)}
                  </span>
                )}
                {/* Neuer Tab bewusst: die Prüfung bleibt offen, während die
                    Buchung storniert wird — sonst müsste man den Antrag danach
                    wieder suchen. */}
                <a
                  href={`/reservierungen/${b.reservation_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 text-sm underline underline-offset-4"
                >
                  {t(
                    b.is_owner_stay
                      ? "blockRequests.check.openStay"
                      : "blockRequests.check.openBooking",
                  )}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Gesperrte Nächte und Stop-Sell sind bei einer Kündigung kein
          Hindernis, das man auflösen müsste — 365 Datums-Chips, die niemand
          braucht, verdeckten die eine Information, die zählt (die Buchungen
          dahinter). Live gesehen: bei Kornblomst waren das 365 + 223 Chips. */}
      {!k.als_kuendigung && k.sperrtage_gesamt > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">
            {t("blockRequests.check.blockedNights", {
              anzahl: k.sperrtage_gesamt,
            })}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t("blockRequests.check.blockedNightsHint")}
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {k.sperrtage.map((s) => (
              <li
                key={`${s.datum}-${s.unit_id ?? "typ"}`}
                className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground"
              >
                {s.datum}
                {s.unit_name ? ` · ${s.unit_name}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      {!k.als_kuendigung && k.stop_sell_gesamt > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">
            {t("blockRequests.check.stopSell", { anzahl: k.stop_sell_gesamt })}
          </h3>
          <ul className="flex flex-wrap gap-1.5">
            {k.stop_sell_tage.map((tag) => (
              <li
                key={tag}
                className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground"
              >
                {tag}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Gekürzt: die ZAHLEN oben sind vollständig, die Listen nicht. Das muss
          dastehen, sonst hält jemand die Liste für alles. Bei einer Kündigung
          sind die gekürzten Listen ausgeblendet — dann sagt der Hinweis nichts. */}
      {!k.als_kuendigung && k.gekuerzt && (
        <p className="text-xs text-muted-foreground">
          {t("blockRequests.check.truncated")}
        </p>
      )}

      {/* Ein Antrag auf eine bestimmte Einheit wird hier benannt: „Studio 3"
          zu sperren ist etwas anderes als den ganzen Typ. */}
      {antrag.unit_name && (
        <p className="text-xs text-muted-foreground">
          {t("blockRequests.check.unitScope", { einheit: antrag.unit_name })}
        </p>
      )}
    </div>
  );
}
