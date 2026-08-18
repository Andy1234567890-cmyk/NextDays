"use client";

/**
 * Anfrage-Karte über dem Chat (0398) — Airbnb-Voranfrage, Buchungsanfrage
 * oder Änderungswunsch.
 *
 * WOZU: Eine Anfrage ist keine Buchung. Der Gast wartet auf eine Entscheidung,
 * und Airbnb lehnt nach Ablauf der Frist SELBST ab — die Untätigkeit ist also
 * die Antwort. Deshalb steht hier beides an einem Ort: der Countdown und die
 * Knöpfe. Bis hierher konnte der Betrieb die Anfrage im PMS überhaupt nicht
 * sehen (der Chat lag ohne Thread in `portal_messages`) und musste sie in der
 * Channex-Oberfläche beantworten.
 *
 * WAS HIER BEWUSST NICHT PASSIERT:
 * - Keine Frist ausrechnen. Airbnb liefert `non_response_at`; fehlt der Wert,
 *   zeigt die Karte KEINEN Countdown statt „24 Stunden" zu raten.
 * - Keine Aktion erfinden. Welche Knöpfe es gibt, sagt der Server
 *   (`aktionen`) — eine Voranfrage kennt kein „annehmen", ein Änderungswunsch
 *   keinen Sonderpreis, und die Airbnb-Form ist je Art verschieden.
 * - Kein Währungssymbol raten: die Währung kommt aus der Payload, fehlt sie,
 *   steht der Betrag ohne Symbol da.
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Icon } from "@iconify/react";
import { Button } from "@nextdays/ui/button";
import { entscheideAnfrage, getAnfrage } from "@/lib/inbox";
import {
  ABLEHNUNGSGRUENDE,
  type AnfrageAktion,
  type AnfrageDetail,
} from "@/lib/inbox-anfrage-typen";

/** Aktionen, die vor dem Senden noch eine Eingabe brauchen. */
const BRAUCHT_GRUND: AnfrageAktion = "ablehnen";
const BRAUCHT_BETRAG: AnfrageAktion = "sonderpreis";

/**
 * Verbleibende Zeit bis zur Frist, in Minuten. `null`, wenn keine Frist
 * bekannt ist oder der Wert kein Datum ist — dann zeigt die Karte nichts.
 */
function minutenBis(frist: string | null): number | null {
  if (!frist) return null;
  const ziel = Date.parse(frist);
  if (Number.isNaN(ziel)) return null;
  return Math.round((ziel - Date.now()) / 60000);
}

export function AnfrageKarte({
  threadId,
  onEntschieden,
}: {
  threadId: string;
  /** Nach einer Entscheidung neu laden — die Anfrage verlässt die Liste. */
  onEntschieden: () => void;
}) {
  const t = useTranslations("inbox");
  const [detail, setDetail] = useState<AnfrageDetail | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [offeneAktion, setOffeneAktion] = useState<AnfrageAktion | null>(null);
  const [grund, setGrund] = useState<string>(ABLEHNUNGSGRUENDE[0]);
  const [betrag, setBetrag] = useState("");
  const [nachricht, setNachricht] = useState("");
  // Tickt den Countdown. Eine Minute reicht: die Frist läuft über Stunden.
  const [, setTick] = useState(0);

  useEffect(() => {
    let aktiv = true;
    // Beim Thread-Wechsel den alten Stand SOFORT verwerfen — sonst zeigt die
    // Karte kurz die Frist der vorigen Anfrage (Race beim schnellen Klicken).
    setDetail(null);
    setFehler(null);
    setOffeneAktion(null);
    getAnfrage(threadId).then((res) => {
      if (!aktiv) return;
      if (res.ok) setDetail(res.data);
      else setFehler(res.error);
    });
    return () => {
      aktiv = false;
    };
  }, [threadId]);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const senden = useCallback(
    (aktion: AnfrageAktion) => {
      if (laeuft) return;
      setFehler(null);

      // Der Sonderpreis geht in MINOR UNITS an Airbnb (10000 = 100,00). Die
      // Umrechnung passiert genau hier, einmal, mit Rundung auf die kleinste
      // Einheit — ein Betrag in Haupteinheiten wäre ein Faktor-100-Fehler zu
      // Lasten des Betriebs, und der Server weist ihn deshalb auch ab.
      let gesamtpreis_minor: number | undefined;
      if (aktion === BRAUCHT_BETRAG) {
        const zahl = Number(betrag.replace(",", "."));
        if (!Number.isFinite(zahl) || zahl <= 0) {
          setFehler(t("anfrageBetragUngueltig"));
          return;
        }
        gesamtpreis_minor = Math.round(zahl * 100);
      }

      setLaeuft(true);
      entscheideAnfrage(threadId, {
        aktion,
        grund: aktion === BRAUCHT_GRUND ? grund : undefined,
        nachricht_an_gast: nachricht.trim() || undefined,
        gesamtpreis_minor,
        // Bei einer Vorab-Genehmigung die Nächte für andere Gäste sperren:
        // der angefragte Gast bekommt sie damit wirklich reserviert. Ohne das
        // kann ihm jemand anders per Sofortbuchung zuvorkommen.
        sofortbuchung_sperren: aktion === "vorab_genehmigen",
      }).then((res) => {
        setLaeuft(false);
        if (!res.ok) {
          setFehler(res.error);
          return;
        }
        setOffeneAktion(null);
        onEntschieden();
      });
    },
    [betrag, grund, laeuft, nachricht, onEntschieden, t, threadId],
  );

  if (fehler && !detail) {
    return (
      <div className="border-b border-border bg-destructive/5 px-3 py-2 text-sm text-destructive">
        {fehler}
      </div>
    );
  }
  if (!detail) return null;

  const minuten = minutenBis(detail.frist);
  const abgelaufen = minuten !== null && minuten <= 0;
  // Unter zwei Stunden wird es dringend — dann fällt die Zeile rot aus.
  const knapp = minuten !== null && minuten > 0 && minuten < 120;

  return (
    <div
      className={
        "border-b border-border px-3 py-2.5 " +
        // Bernstein heißt „hier wartet etwas". Ist geantwortet, ist die Karte
        // nur noch Kontext zur Anfrage und darf nicht weiter Dringlichkeit
        // signalisieren.
        (detail.beantwortbar ? "bg-amber-500/5" : "bg-muted/30")
      }
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Icon
          icon={detail.beantwortbar ? "ph:question" : "ph:check-circle"}
          className={
            "size-4 shrink-0 " +
            (detail.beantwortbar
              ? "text-amber-600 dark:text-amber-400"
              : "text-muted-foreground")
          }
        />
        <span
          className={
            "font-semibold " +
            (detail.beantwortbar
              ? "text-amber-700 dark:text-amber-300"
              : "text-foreground")
          }
        >
          {t(`anfrageArt.${detail.art}`)}
        </span>
        {detail.anreise && detail.abreise && (
          <span className="text-sm text-muted-foreground">
            · {detail.anreise} – {detail.abreise}
            {detail.naechte ? ` · ${t("anfrageNaechte", { n: detail.naechte })}` : ""}
          </span>
        )}
        {detail.gaeste && (
          <span className="text-sm text-muted-foreground">
            · {t("anfrageGaeste", { n: detail.gaeste })}
          </span>
        )}
        {/* Netto-Auszahlbetrag, ausdrücklich so benannt: `payout_amount` ist
            bei Airbnb NICHT der Gastpreis. Ohne Währung kein Symbol raten. */}
        {detail.payout_betrag && (
          <span className="text-sm font-medium">
            · {t("anfragePayout")} {detail.payout_betrag}
            {detail.waehrung ? ` ${detail.waehrung}` : ""}
          </span>
        )}
      </div>

      {/* Die Frist: das Wichtigste an einer OFFENEN Anfrage — aber nur dann.
          Ist bereits geantwortet, wäre ein laufender Countdown eine
          Falschaussage über den Zustand beim Portal (der Aggregator zieht ihn
          nicht nach, siehe `anfragen.detail_lesen`). Fehlt die Frist ganz,
          steht hier nichts: nie eine 24-Stunden-Regel unterstellen. */}
      {detail.beantwortbar && minuten !== null && (
        <p
          className={
            "mt-1 flex items-center gap-1 text-sm " +
            (abgelaufen || knapp
              ? "font-medium text-destructive"
              : "text-muted-foreground")
          }
        >
          <Icon icon="ph:clock-countdown" className="size-4 shrink-0" />
          {abgelaufen
            ? t("anfrageFristAbgelaufen")
            : t("anfrageFristRest", {
                zeit:
                  minuten >= 60
                    ? t("anfrageStunden", { n: Math.floor(minuten / 60) })
                    : t("anfrageMinuten", { n: minuten }),
              })}
        </p>
      )}

      {fehler && <p className="mt-1 text-sm text-destructive">{fehler}</p>}

      {/* Gesperrt: den GRUND nennen, nicht nur den Knopf ausgrauen. */}
      {!detail.beantwortbar ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {/* Sagt das PORTAL den Zustand (System-Nachricht im Thread), steht
              hier sein Wort — „Angenommen", „Abgelehnt", „Abgelaufen". Sagt es
              nichts, steht da, was WIR wissen, und der Satz nennt das auch so.
              Beides zu vermischen hieße, eine Ableitung als Auskunft des
              Portals auszugeben. */}
          {detail.status_quelle === "portal" && detail.grund_gesperrt
            ? t(`anfrageStatus.${detail.grund_gesperrt}`)
            : detail.grund_gesperrt === "beantwortet"
              ? t("anfrageBeantwortet")
              : detail.grund_gesperrt === "erledigt"
                ? t("anfrageBereitsEntschieden")
                : t("anfrageOhneChannexId")}
        </p>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap gap-2">
            {detail.aktionen.map((aktion) => (
              <Button
                key={aktion}
                size="sm"
                variant={
                  aktion === "ablehnen" || aktion === "alteration_ablehnen"
                    ? "outline"
                    : "default"
                }
                disabled={laeuft}
                onClick={() => {
                  // Aktionen mit Pflichteingabe klappen erst ihr Feld auf,
                  // statt eine halb gefüllte Form zu senden.
                  if (aktion === BRAUCHT_GRUND || aktion === BRAUCHT_BETRAG) {
                    setOffeneAktion(
                      offeneAktion === aktion ? null : (aktion as AnfrageAktion),
                    );
                    return;
                  }
                  senden(aktion as AnfrageAktion);
                }}
              >
                {t(`anfrageAktion.${aktion}`)}
              </Button>
            ))}
          </div>

          {offeneAktion === BRAUCHT_GRUND && (
            <div className="mt-2 space-y-2 rounded-2xl border border-border bg-card p-2">
              <label className="block text-xs font-medium text-muted-foreground">
                {t("anfrageGrundLabel")}
              </label>
              {/* Nur die vier von Airbnb erlaubten Gründe — ein eigener
                  Freitext wäre ein 422, und die Anfrage bliebe offen. */}
              <select
                value={grund}
                onChange={(e) => setGrund(e.target.value)}
                className="w-full rounded-(--radius) border border-border bg-background px-2 py-1.5 text-sm"
              >
                {ABLEHNUNGSGRUENDE.map((g) => (
                  <option key={g} value={g}>
                    {t(`anfrageGrund.${g}`)}
                  </option>
                ))}
              </select>
              <textarea
                value={nachricht}
                onChange={(e) => setNachricht(e.target.value)}
                placeholder={t("anfrageNachrichtOptional")}
                rows={2}
                className="w-full rounded-(--radius) border border-border bg-background px-2 py-1.5 text-sm"
              />
              <Button
                size="sm"
                variant="destructive"
                disabled={laeuft}
                onClick={() => senden(BRAUCHT_GRUND)}
              >
                {t("anfrageAblehnenBestaetigen")}
              </Button>
            </div>
          )}

          {offeneAktion === BRAUCHT_BETRAG && (
            <div className="mt-2 space-y-2 rounded-2xl border border-border bg-card p-2">
              <label className="block text-xs font-medium text-muted-foreground">
                {t("anfrageBetragLabel")}
                {detail.waehrung ? ` (${detail.waehrung})` : ""}
              </label>
              <input
                value={betrag}
                onChange={(e) => setBetrag(e.target.value)}
                inputMode="decimal"
                placeholder={detail.payout_betrag ?? ""}
                className="w-full rounded-(--radius) border border-border bg-background px-2 py-1.5 text-sm"
              />
              <Button
                size="sm"
                disabled={laeuft}
                onClick={() => senden(BRAUCHT_BETRAG)}
              >
                {t("anfrageAngebotSenden")}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
