"use client";

// Zustand EINER Automatisierung als Chip-Zeile — dieselbe Anzeige im
// Automatisierungen-Tab und im Panel aus dem Posteingang-Kopf.
//
// Warum das überhaupt nötig war: eine Regel ließ sich beschreiben (Auslöser,
// Zeitplan, Zuweisung), aber nirgends ablesen, OB sie je gefeuert hat. Eine
// Regel, die seit Wochen an einem fehlenden Platzhalter scheitert, sah genauso
// aus wie eine, die täglich zustellt — der Fehlschlag stand allein in
// `automation_scheduled_message.last_error` und wurde von keiner Oberfläche
// gelesen (Wurzel 5: ein Fehler, den niemand sieht, ist ein verschluckter).
//
// EIN Baustein und nicht zwei: Tab und Panel zeigen denselben Zustand
// derselben Regel. Zwei Kopien liefen unweigerlich auseinander — genau so ist
// aus einer Zeitplan-Zeile zweimal eine unterschiedliche geworden.
import type React from "react";
import { useTranslations } from "next-intl";

import type { AutomationStand } from "@/lib/inbox";

/** Die Zustände des Protokolls (0316) in der Reihenfolge des Ablaufs. */
export const STAND_ZUSTAENDE = [
  "pending",
  "sending",
  "sent",
  "failed",
  "skipped",
  "cancelled",
] as const;

/** Beschriftung eines Protokoll-Zustands. Ein UNBEKANNTER Wert wird roh
 *  angezeigt, nicht auf einen bekannten geraten (Wurzel 4) — sonst sähe ein
 *  neuer Serverzustand aus wie „gesendet". */
export function zustandName(status: string, t: (k: string) => string): string {
  return (STAND_ZUSTAENDE as readonly string[]).includes(status)
    ? t(`autoStandStatus_${status}`)
    : status;
}

function Chip({
  text,
  ton = "still",
  titel,
}: {
  text: string;
  ton?: "still" | "gut" | "schlecht";
  titel?: string;
}) {
  const farbe =
    ton === "schlecht"
      ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400"
      : ton === "gut"
        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
        : "bg-muted text-muted-foreground";
  return (
    <span title={titel} className={`rounded-full px-2 py-0.5 text-xs ${farbe}`}>
      {text}
    </span>
  );
}

/**
 * Chips „geplant N · gesendet N · fehlgeschlagen N · übersprungen N".
 *
 * `stand === undefined` heißt: der Zustand ist noch nicht geladen oder der
 * Aufruf ist gescheitert. Dann steht hier NICHTS — vier Nullen wären eine
 * Aussage („nichts passiert"), die wir gar nicht geprüft haben.
 *
 * Ist der Stand geladen und leer, steht das ausdrücklich da: „Noch nichts
 * eingeplant" ist die ehrliche Auskunft, eine leere Zeile wäre keine.
 */
export function AutomationStandChips({
  stand,
  zeitpunktText,
  onOeffnen,
}: {
  stand?: AutomationStand;
  /** Formatierer für ISO-Zeitstempel (Ortsformat des Nutzers). */
  zeitpunktText: (iso: string) => string;
  /** Klick auf die Chips öffnet das Versandprotokoll der Regel (14.09.2026):
   *  dort steht, WELCHE Buchung betroffen ist, und Fehlgeschlagenes lässt sich
   *  erneut senden. Ohne Handler sind die Chips reine Anzeige. */
  onOeffnen?: () => void;
}) {
  const t = useTranslations("inbox");
  if (!stand) return null;
  const huelle = (kinder: React.ReactNode) =>
    onOeffnen ? (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOeffnen();
        }}
        title={t("autoProtokollOeffnenHint")}
        className="flex flex-wrap items-center gap-1 rounded-md text-left hover:bg-muted/60"
      >
        {kinder}
      </button>
    ) : (
      <span className="flex flex-wrap items-center gap-1">{kinder}</span>
    );
  if (stand.gesamt === 0) {
    return huelle(<Chip text={t("autoStandNever")} />);
  }
  // „geplant" umfasst `sending`: eine Zeile im Versand-Claim ist noch nicht
  // draußen. Sie als eigenen Chip zu führen hieße, einen Sekundenzustand zu
  // erklären, den niemand bedienen kann.
  const geplant = stand.pending + stand.sending;
  return huelle(
    <>
      <Chip text={t("autoStandPlanned", { count: geplant })} />
      <Chip
        text={t("autoStandSent", { count: stand.sent })}
        ton={stand.sent > 0 ? "gut" : "still"}
      />
      {stand.failed > 0 && (
        <Chip
          text={t("autoStandFailed", { count: stand.failed })}
          ton="schlecht"
        />
      )}
      {stand.skipped > 0 && (
        <Chip text={t("autoStandSkipped", { count: stand.skipped })} />
      )}
      {stand.naechster_versand && (
        <Chip
          text={t("autoStandNext", {
            zeit: zeitpunktText(stand.naechster_versand),
          })}
        />
      )}
    </>,
  );
}

/**
 * Der letzte Fehlergrund im Klartext — rot, unter den Chips.
 *
 * Der Grund kommt aus `last_error` und wird UNVERÄNDERT gezeigt. Ihn zu
 * verallgemeinern („Versand fehlgeschlagen") nähme dem Betrieb genau die
 * Angabe, mit der er es beheben kann (meist ein fehlender Platzhalter).
 */
export function AutomationStandFehler({
  stand,
  zeitpunktText,
}: {
  stand?: AutomationStand;
  zeitpunktText: (iso: string) => string;
}) {
  const t = useTranslations("inbox");
  if (!stand?.letzter_fehler) return null;
  const wann = stand.letzter_fehler_am
    ? ` (${zeitpunktText(stand.letzter_fehler_am)})`
    : "";
  return (
    <span className="mt-1 block text-xs text-destructive">
      {t("autoStandLastError", { grund: stand.letzter_fehler })}
      {wann}
    </span>
  );
}
