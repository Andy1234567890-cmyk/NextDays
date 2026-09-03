"use client";

// Filterleiste der Auswertung — Hostaways Muster: ganz oben, über allem.
//
// Der BEZUGSZEITPUNKT steht hier gleichrangig neben dem Zeitraum, nicht in
// einem Einstellungsmenü. Er entscheidet, welcher Buchung welcher Monat
// zugerechnet wird, und ändert damit JEDE Zahl auf dieser Seite. Alle vier
// Wettbewerber führen ihn sichtbar (Beds24 mit vier Werten, Hostaway als
// „Event-Filter"); Hostaway musste 09/2025 nachbessern, weil vorher jede
// Kennzahl still nach eigener Logik rechnete.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";

import { DatePicker } from "@nextdays/ui/date-picker";
import { MultiSelect } from "@nextdays/ui/multi-select";
import { NativeSelect } from "@nextdays/ui/native-select";
import type { Bezug, Vergleich } from "@/lib/auswertung-typen";
import { VERGLEICHE } from "@/lib/auswertung-typen";

export type FilterStand = {
  von: string;
  bis: string;
  bezug: Bezug;
  propertyIds: string[];
  channels: string[];
  vergleich: Vergleich;
};

/** Ab welcher Zeitraumlänge das Backend den Vergleich ablehnt (422).
 *
 *  Muss zu `MAX_TAGE_VERGLEICH` in `apps/api/.../auswertung/service.py`
 *  passen: ein Vergleich rechnet den ganzen Bericht zweimal, ein 5-Jahres-
 *  Zeitraum wäre damit der doppelte Vollscan. Die Oberfläche sperrt die
 *  Auswahl deshalb VORHER und sagt warum — einen 422 abzuwarten hieße, den
 *  Nutzer gegen eine Wand laufen zu lassen. */
const MAX_TAGE_VERGLEICH = 366;

function spanneTage(von: string, bis: string): number {
  const a = Date.parse(von);
  const b = Date.parse(bis);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/** Ob der Zeitraum kurz genug für einen Vergleich ist.
 *
 *  Exportiert, weil die SEITE sie ebenfalls braucht: sie muss den Vergleich
 *  zurücksetzen, wenn der Zeitraum wächst — sonst zeigt die Leiste „kein
 *  Vergleich" und gesendet wird trotzdem „1j". */
export function vergleichMoeglich(von: string, bis: string): boolean {
  return spanneTage(von, bis) <= MAX_TAGE_VERGLEICH;
}

/** Schnellwahl-Zeiträume. `monat` ist die Vorgabe — die Seite heißt
 *  „Auswertung", der Regelfall ist der laufende Monat. */
function zeitraum(art: string): { von: string; bis: string } | null {
  const heute = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const ersterVon = (versatz: number) =>
    new Date(heute.getFullYear(), heute.getMonth() + versatz, 1);
  switch (art) {
    case "monat":
      return { von: iso(ersterVon(0)), bis: iso(new Date(heute.getFullYear(), heute.getMonth() + 1, 0)) };
    case "vormonat":
      return { von: iso(ersterVon(-1)), bis: iso(new Date(heute.getFullYear(), heute.getMonth(), 0)) };
    case "quartal": {
      const q = Math.floor(heute.getMonth() / 3) * 3;
      return { von: iso(new Date(heute.getFullYear(), q, 1)), bis: iso(new Date(heute.getFullYear(), q + 3, 0)) };
    }
    case "jahr":
      return { von: iso(new Date(heute.getFullYear(), 0, 1)), bis: iso(new Date(heute.getFullYear(), 11, 31)) };
    default:
      return null;
  }
}

export function Filterleiste({
  stand,
  setzen,
  objekte,
  kanaele,
  laedt,
}: {
  stand: FilterStand;
  setzen: (s: FilterStand) => void;
  objekte: readonly { value: string; label: string }[];
  kanaele: readonly { value: string; label: string }[];
  laedt: boolean;
}) {
  const t = useTranslations("analysis");

  const schnell = ["monat", "vormonat", "quartal", "jahr"] as const;
  // Welcher Schnellzeitraum passt auf den aktuellen Stand? Ohne diesen
  // Abgleich zeigte das Feld nach einer Handeingabe weiter „Dieser Monat" an,
  // während die Datumsfelder etwas anderes sagen — eine Anzeige, die dem
  // eigenen Inhalt widerspricht.
  const erkannt =
    schnell.find((s) => {
      const z = zeitraum(s);
      return z && z.von === stand.von && z.bis === stand.bis;
    }) ?? "frei";
  // Über einem Jahr Zeitraum lehnt das Backend den Vergleich ab (doppelter
  // Vollscan). Die Auswahl wird dann gesperrt UND begründet, statt den 422
  // erst nach dem Klick zu zeigen.
  const vergleichGesperrt = !vergleichMoeglich(stand.von, stand.bis);

  const BEZUEGE: readonly Bezug[] = [
    "anreise",
    "abreise",
    "buchung",
    "uebernachtung",
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        {/* Schnellwahl als Auswahlfeld, nicht als Knopfreihe: vier Knöpfe
            kosten dauerhaft Platz für etwas, das eine Auswahl ist, und
            konkurrieren optisch mit den Feldern daneben. Der aktuell gewählte
            Zeitraum ist hier ablesbar — bei Knöpfen war er es nicht.

            „Frei" ist der Zustand, sobald jemand die Datumsfelder von Hand
            anfasst: er lässt sich nicht auswählen (es gibt nichts zu setzen),
            steht aber als Anzeige zur Verfügung, damit das Feld nicht einen
            Zeitraum behauptet, der nicht mehr gilt. */}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            {t("filter.range")}
          </span>
          <NativeSelect
            value={erkannt}
            disabled={laedt}
            onChange={(e) => {
              const z = zeitraum(e.target.value);
              if (z) setzen({ ...stand, ...z });
            }}
          >
            {erkannt === "frei" && (
              <option value="frei">{t("range.frei")}</option>
            )}
            {schnell.map((s) => (
              <option key={s} value={s}>
                {t(`range.${s}`)}
              </option>
            ))}
          </NativeSelect>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            {t("filter.from")}
          </span>
          <DatePicker
            value={stand.von}
            onChange={(v) => setzen({ ...stand, von: v })}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            {t("filter.to")}
          </span>
          <DatePicker
            value={stand.bis}
            onChange={(v) => setzen({ ...stand, bis: v })}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <Icon icon="ph:target" className="size-3.5" />
            {t("filter.basis")}
          </span>
          <NativeSelect
            value={stand.bezug}
            onChange={(e) =>
              setzen({ ...stand, bezug: e.target.value as Bezug })
            }
          >
            {BEZUEGE.map((b) => (
              <option key={b} value={b}>
                {t(`basis.${b}`)}
              </option>
            ))}
          </NativeSelect>
        </label>

        {/* Der Vergleichszeitraum. Steht neben dem Bezug, weil beide
            dasselbe tun: sie ändern, WORAUF sich jede Zahl der Seite
            bezieht — nur der eine zeitlich innerhalb, der andere über Jahre
            hinweg. */}
        <label className="flex flex-col gap-1">
          <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <Icon icon="ph:chart-line" className="size-3.5" />
            {t("filter.compare")}
          </span>
          <NativeSelect
            value={vergleichGesperrt ? "keiner" : stand.vergleich}
            disabled={vergleichGesperrt}
            onChange={(e) =>
              setzen({ ...stand, vergleich: e.target.value as Vergleich })
            }
          >
            {VERGLEICHE.map((v) => (
              <option key={v} value={v}>
                {t(`compare.${v}`)}
              </option>
            ))}
          </NativeSelect>
        </label>

        <div className="flex min-w-48 flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            {t("filter.properties")}
          </span>
          <MultiSelect
            options={[...objekte]}
            selected={stand.propertyIds}
            onChange={(next) => setzen({ ...stand, propertyIds: next })}
            allLabel={t("filter.allProperties")}
          />
        </div>

        <div className="flex min-w-44 flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            {t("filter.channels")}
          </span>
          <MultiSelect
            options={[...kanaele]}
            selected={stand.channels}
            onChange={(next) => setzen({ ...stand, channels: next })}
            allLabel={t("filter.allChannels")}
          />
        </div>
      </div>

      {/* Was der gewählte Bezug bedeutet — ausgeschrieben, nicht als Tooltip.
          Wer „Buchungsdatum" wählt, muss wissen, dass Buchungen ohne echten
          Quell-Zeitstempel dann fehlen (Wurzel 5b). */}
      <p className="text-xs text-muted-foreground">
        {t(`basisHint.${stand.bezug}`)}
      </p>
      {vergleichGesperrt && (
        <p className="text-xs text-muted-foreground">{t("compareLocked")}</p>
      )}
    </div>
  );
}
