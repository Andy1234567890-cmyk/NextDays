// Das Band einer angekündigten Zugangssperre (0724).
//
// Warum es das braucht: Endet der Zugang zu einem festen Zeitpunkt, darf das
// den Betrieb nicht unvorbereitet treffen. Eine Mail erreicht den, der Mail
// liest — dieses Band erreicht den, der gerade im Dashboard arbeitet. Dieselbe
// Trennung wie beim `TestphaseBand` (0488).
//
// Warum kein „Schließen"-Knopf: dieselbe Begründung wie bei `DemoBand` und
// `TestphaseBand` — geschlossen wäre es genau in der Sitzung weg, in der es
// gebraucht wird. Es verschwindet von selbst, sobald `zugang_gesperrt_ab`
// geleert wird.
//
// Warum nur Datum und Uhrzeit und sonst nichts: ausdrückliche Vorgabe. Kein
// Link, kein Knopf, keine Begründung, keine Handlungsaufforderung. Ein Band,
// das erklärt oder anbietet, lädt zur Diskussion ein; dieses stellt einen
// Zeitpunkt fest. Wer mehr wissen will, fragt — dafür gibt es den Support-Knopf,
// der ohnehin auf jeder Seite schwebt.
//
// Warum `destructive` und nicht `secondary` wie die beiden Geschwister: die
// anderen beiden beschreiben einen Zustand, der von selbst endet (Vorführung,
// Testphase). Dieses Band beschreibt einen Verlust. Wäre es genauso flach,
// liest es sich wie ein Hinweis und nicht wie eine Frist.
"use client";

import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";

export function ZugangssperreBand({ gesperrtAb }: { gesperrtAb: string }) {
  const t = useTranslations("account.zugangssperre");
  const locale = useLocale();

  const stichtag = new Date(gesperrtAb);
  // Ein unlesbares Datum ergibt KEIN gerechnetes Ersatzdatum und kein stilles
  // Verschwinden des Bandes (Wurzel 4/5): ein Datenfehler darf eine Frist nicht
  // unsichtbar machen. Stattdessen bleibt das Band stehen und nennt den
  // Zeitpunkt nicht — falsch wäre gefährlicher als unvollständig.
  const lesbar = !Number.isNaN(stichtag.getTime());
  const datum = lesbar
    ? stichtag.toLocaleString(locale, {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div
      // `role="note"`, nicht `alert`: eine stehende Frist, keine Meldung auf ein
      // Ereignis. Ein `alert` unterbräche Screenreader bei jedem Seitenwechsel —
      // dieselbe Begründung wie bei den beiden Geschwister-Bändern.
      role="note"
      className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-center text-sm font-medium text-destructive"
    >
      <Icon
        icon="ph:lock-key"
        className="size-4 shrink-0"
        aria-hidden="true"
      />
      <span>{datum ? t("band", { datum }) : t("bandOhneDatum")}</span>
    </div>
  );
}
