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
import Link from "next/link";
import { useTranslations } from "next-intl";

import type { AutomationLuecke, AutomationStand } from "@/lib/inbox";

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
        // Rot nur, solange es GILT. Ein seit Wochen behobener Stand sah sonst
        // aus wie ein laufender Ausfall (15.09.2026).
        <Chip
          text={t("autoStandFailed", { count: stand.failed })}
          ton={stand.erledigt ? "still" : "schlecht"}
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
 * Woran die Regel gescheitert ist — als SICHT auf die betroffenen Objekte.
 *
 * Bis zum 15.09.2026 stand hier ein Satz: „Letzter Fehler: Diese Felder haben
 * für diese Reservierung keinen Wert: door_code, wifi_password, wifi_ssid".
 * Er nannte weder das Haus noch, ob die Angabe heute noch fehlt — der Betrieb
 * musste sie erst irgendwo nachschlagen und fragte zu Recht: „wir sehen hier
 * immer noch nicht, warum fehlgeschlagen". Jetzt steht je Objekt eine Zeile
 * mit den Feldern, rot solange sie leer sind, und der Name springt in die
 * Kartei.
 *
 * Der Ton hängt daran, ob es NOCH gilt (`erledigt`): wurde danach wieder
 * zugestellt oder sind die betroffenen Aufenthalte vorbei, ist die Zahl
 * Vergangenheit und wird ruhig gezeigt. Sonst rot. Vorher sah ein seit einem
 * Monat erledigter Stand genauso alarmierend aus wie ein laufender Ausfall.
 */
/** DREI Fälle, drei Sätze. Sie zu zweien zusammenzuziehen war falsch: ein
 *  „Forbidden" von Booking.com bekam den Satz „Die Angaben stehen inzwischen",
 *  obwohl es nie um eine fehlende Angabe ging (15.09.2026). */
type FehlerFall = "offen" | "nachtrag" | "grund";

const KOPFTEXT: Record<FehlerFall, string> = {
  // Angaben fehlen weiterhin → nachtragen.
  offen: "autoStandFehlerOffen",
  // Angaben stehen, die Nachricht ging nie hinaus → erneut senden.
  nachtrag: "autoStandFehlerNachtrag",
  // Gar kein Platzhalter-Fehler → der Wortlaut des Portals zählt.
  grund: "autoStandFehlerGrund",
};

function fehlerFall(luecken: number, offene: number): FehlerFall {
  if (offene > 0) return "offen";
  return luecken > 0 ? "nachtrag" : "grund";
}

export function AutomationStandFehler({
  stand,
  zeitpunktText,
}: {
  stand?: AutomationStand;
  zeitpunktText: (iso: string) => string;
}) {
  const t = useTranslations("inbox");
  if (!stand?.letzter_fehler) return null;
  // Objekte, an denen die Angabe HEUTE noch fehlt — nur sie sind Arbeit.
  const offene = stand.luecken.filter((l) => l.heute_leer.length > 0);
  // Erledigt und nichts mehr offen: die Karte schweigt. Die Zahlen stehen in
  // den Chips, die Historie im Protokoll — eine Liste von neun Häusern, an
  // denen nichts zu tun ist, ist Lärm („warum wird es angezeigt, wenn es
  // behoben wurde", 15.09.2026).
  if (stand.erledigt && offene.length === 0) return null;
  const wann = stand.letzter_fehler_am ? zeitpunktText(stand.letzter_fehler_am) : null;
  const fall = fehlerFall(stand.luecken.length, offene.length);
  const ton = fall === "nachtrag" ? "text-amber-600 dark:text-amber-400" : "text-destructive";
  return (
    <div className={`mt-1 flex flex-col gap-1 text-xs ${ton}`}>
      <span>{t(KOPFTEXT[fall], { zeit: wann ?? "—" })}</span>
      {fall === "grund" ? (
        // Kein Platzhalter-Fehler (z. B. „Forbidden", „Service Temporary
        // Unavailable") — der Grund bleibt im Wortlaut stehen, statt ihn zu
        // glätten. Nur er sagt dem Betrieb, was das Portal abgelehnt hat.
        <span>{t("autoStandLastError", { grund: stand.letzter_fehler })}</span>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {(fall === "offen" ? offene : stand.luecken).map((l) => (
            <LueckeZeile key={l.property_id} luecke={l} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** Ein betroffenes Objekt: Name (führt in die Kartei), Zahl, Felder. */
function LueckeZeile({ luecke }: { luecke: AutomationLuecke }) {
  const t = useTranslations("inbox");
  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
      <Link
        href={`/objekte/${luecke.property_id}/kartei`}
        onClick={(e) => e.stopPropagation()}
        className="font-medium underline-offset-2 hover:underline"
      >
        {luecke.objekt ?? luecke.property_id}
      </Link>
      <span className="text-muted-foreground">
        {t("autoStandLueckeAnzahl", { count: luecke.anzahl })}
      </span>
      <span className="flex flex-wrap gap-1">
        {luecke.felder.map((f) => {
          const offen = luecke.heute_leer.includes(f);
          return (
            <span
              key={f}
              title={offen ? t("autoProtokollHeuteLeer") : t("autoProtokollInzwischenGepflegt")}
              className={`rounded px-1.5 py-0.5 font-mono text-[0.68rem] ${
                offen
                  ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400"
                  : "bg-emerald-100 text-emerald-700 line-through dark:bg-emerald-500/15 dark:text-emerald-400"
              }`}
            >
              {f}
            </span>
          );
        })}
      </span>
    </li>
  );
}
