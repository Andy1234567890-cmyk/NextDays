"use client";

// Werkzeugleiste des WhatsApp-Schreibfeldes.
//
// Sie sieht aus wie die im Posteingang, arbeitet aber anders — und das hat
// einen Grund, den man kennen muss, bevor man hier etwas „vereinheitlicht":
//
// Der OTA-Composer schreibt HTML (TipTap) und der Server macht daraus Klartext.
// WhatsApp kennt kein HTML. Es hat eine EIGENE, zeichenbasierte Auszeichnung:
//   *fett*  _kursiv_  ~durchgestrichen~  ```Monospace```
// Diese Zeichen stehen im Text und werden erst in WhatsApp selbst gerendert.
// Deshalb setzt die Leiste hier Zeichen um die Auswahl, statt Formatierung an
// einen Rich-Text-Editor zu melden. Ein TipTap an dieser Stelle würde Markup
// erzeugen, das Meta als Text überträgt — der Gast läse dann „<b>Hallo</b>".
//
// Aufzählungen kennt WhatsApp seit 2023 ebenfalls („- " und „1. " am
// Zeilenanfang); sie werden hier je markierter Zeile vorangestellt.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import type { RefObject } from "react";

/** Was WhatsApp an Auszeichnung versteht, mit dem jeweiligen Zeichenpaar. */
const UMSCHLIESSEND = {
  bold: "*",
  italic: "_",
  strike: "~",
  code: "```",
} as const;

type Auszeichnung = keyof typeof UMSCHLIESSEND;

export function WhatsAppComposerLeiste({
  feld,
  wert,
  onWert,
  zusatz,
}: {
  feld: RefObject<HTMLTextAreaElement | null>;
  wert: string;
  onWert: (neu: string) => void;
  /** Weitere Knöpfe (Vorlagen, Platzhalter) — sie stehen rechts der
   *  Auszeichnung, wie im Posteingang. */
  zusatz?: React.ReactNode;
}) {
  const t = useTranslations("inbox");

  /** Auswahl mit den Zeichen umschliessen; ohne Auswahl das Paar einsetzen und
   *  den Cursor dazwischen stellen — sonst müsste man ihn selbst zurückbewegen. */
  function umschliessen(art: Auszeichnung) {
    const el = feld.current;
    if (!el) return;
    const zeichen = UMSCHLIESSEND[art];
    const start = el.selectionStart ?? wert.length;
    const ende = el.selectionEnd ?? start;
    const markiert = wert.slice(start, ende);
    const neu =
      wert.slice(0, start) + zeichen + markiert + zeichen + wert.slice(ende);
    onWert(neu);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + zeichen.length + markiert.length;
      el.setSelectionRange(
        markiert ? pos + zeichen.length : pos,
        markiert ? pos + zeichen.length : pos,
      );
    });
  }

  /** Jeder markierten Zeile ein Aufzählungszeichen voranstellen. */
  function liste(nummeriert: boolean) {
    const el = feld.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const ende = el.selectionEnd ?? start;
    // Auf ganze Zeilen ausdehnen: eine Aufzählung mitten im Wort gibt es nicht.
    const zeilenStart = wert.lastIndexOf("\n", start - 1) + 1;
    const zeilenEndeRoh = wert.indexOf("\n", ende);
    const zeilenEnde = zeilenEndeRoh === -1 ? wert.length : zeilenEndeRoh;
    const zeilen = wert.slice(zeilenStart, zeilenEnde).split("\n");
    const neueZeilen = zeilen.map((z, i) =>
      nummeriert ? `${i + 1}. ${z}` : `- ${z}`,
    );
    const neu =
      wert.slice(0, zeilenStart) + neueZeilen.join("\n") + wert.slice(zeilenEnde);
    onWert(neu);
    requestAnimationFrame(() => el.focus());
  }

  const knopf =
    "flex size-7 items-center justify-center rounded-full text-muted-foreground " +
    "transition-colors hover:bg-secondary hover:text-foreground";

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border px-2 py-1.5">
      <button
        type="button"
        className={knopf}
        title={t("formatBold")}
        onClick={() => umschliessen("bold")}
      >
        <Icon icon="ph:text-b" className="size-4" />
      </button>
      <button
        type="button"
        className={knopf}
        title={t("formatItalic")}
        onClick={() => umschliessen("italic")}
      >
        <Icon icon="ph:text-italic" className="size-4" />
      </button>
      <button
        type="button"
        className={knopf}
        title={t("formatStrike")}
        onClick={() => umschliessen("strike")}
      >
        <Icon icon="ph:text-strikethrough" className="size-4" />
      </button>
      <button
        type="button"
        className={knopf}
        title={t("waFormatMono")}
        onClick={() => umschliessen("code")}
      >
        <Icon icon="ph:code" className="size-4" />
      </button>
      <span className="mx-1 h-4 w-px bg-border" />
      <button
        type="button"
        className={knopf}
        title={t("formatBulletList")}
        onClick={() => liste(false)}
      >
        <Icon icon="ph:list-bullets" className="size-4" />
      </button>
      <button
        type="button"
        className={knopf}
        title={t("formatOrderedList")}
        onClick={() => liste(true)}
      >
        <Icon icon="ph:list-numbers" className="size-4" />
      </button>
      {zusatz && (
        <>
          <span className="mx-1 h-4 w-px bg-border" />
          {zusatz}
        </>
      )}
    </div>
  );
}
