"use client";

// Übersetzung des Nachrichtenverlaufs (Google Cloud Translation über den
// content-Slice).
//
// WARUM: Gäste schreiben in ihrer Sprache, der Betrieb liest in seiner. Live am
// 07.08.2026 im Posteingang: „Hei, tusen takk for et veldig fint opphold.
// Desverre var det en potteskjuler i 2. Etg som knuste på grunn av vind" — auf
// Norwegisch, an einen dänischen Betrieb. Dass hier ein Blumentopf zu Bruch
// ging, war ohne Übersetzung nicht zu erkennen.
//
// FORM (Vorbild Airbnb/Booking, beide gleich): unter der fremdsprachigen Blase
// steht ein Schalter „Übersetzen". Ein Klick ersetzt den Text, ein zweiter holt
// das Original zurück. Nie automatisch beim Öffnen — das kostet je Zeichen und
// übersetzt Nachrichten, die niemand liest.
//
// Die Übersetzung wird NICHT gespeichert. Sie ist eine Lesehilfe, keine
// Tatsache: was der Gast geschrieben hat, ist sein Originaltext, und der bleibt
// die Quelle (Wurzel 4). Gespeichert würde sie außerdem veralten, sobald jemand
// die Oberflächensprache wechselt.

import { useCallback, useState } from "react";

import { translateText } from "@/lib/translate";

/** Zustand einer Nachricht im Übersetzungs-Wechsel. */
export interface UebersetzungsStand {
  /** Übersetzter Text, sobald geholt. */
  text?: string;
  /** Sprache, die Google im Original erkannt hat (z. B. „no"). */
  quelle?: string;
  /** Läuft gerade ein Aufruf? */
  laeuft?: boolean;
  /** Zeigt die Blase gerade die Übersetzung statt des Originals? */
  sichtbar?: boolean;
  /** Fehlertext, falls der Aufruf misslang — nie stillschweigend verschlucken. */
  fehler?: string;
}

/**
 * Übersetzungen je Nachricht verwalten.
 *
 * Der Zwischenspeicher liegt bewusst hier und nicht in der Nachricht selbst:
 * ein zweiter Klick auf „Original anzeigen" und wieder zurück darf Google nicht
 * erneut kosten. Er lebt so lange wie der geöffnete Thread.
 */
export function useUebersetzung(zielsprache: string) {
  const [stand, setStand] = useState<Record<string, UebersetzungsStand>>({});

  const umschalten = useCallback(
    async (id: string, text: string) => {
      const vorher = stand[id];

      // Schon geholt → nur die Ansicht wechseln, kein zweiter Aufruf.
      if (vorher?.text !== undefined) {
        setStand((s) => ({
          ...s,
          [id]: { ...vorher, sichtbar: !vorher.sichtbar, fehler: undefined },
        }));
        return;
      }
      if (vorher?.laeuft) return;

      setStand((s) => ({ ...s, [id]: { laeuft: true } }));
      // `fmt: "text"` — die Blase zeigt reinen Text. Mit „html" lieferte Google
      // Entities („&#39;" statt „'"), die hier sichtbar blieben.
      const res = await translateText(text, zielsprache, undefined, "text");
      setStand((s) => ({
        ...s,
        [id]: res.ok
          ? {
              text: res.data.text,
              quelle: res.data.detected_source ?? undefined,
              sichtbar: true,
            }
          : { fehler: res.error },
      }));
    },
    [stand, zielsprache],
  );

  return { stand, umschalten };
}

/**
 * Lohnt sich der Schalter an dieser Nachricht?
 *
 * Nein bei leerem Text (reine Bildnachricht) und nein an eigenen Nachrichten —
 * die hat der Betrieb selbst in seiner Sprache geschrieben.
 *
 * Die SPRACHE prüfen wir hier absichtlich nicht: Es gibt keinen verlässlichen
 * Weg, sie im Browser zu erkennen, und ein geratener Vergleich („sieht deutsch
 * aus") würde den Schalter genau dort verstecken, wo er gebraucht wird. Google
 * erkennt die Quellsprache beim Übersetzen selbst; ist sie gleich, kommt der
 * Text unverändert zurück — sichtbar an „erkannt: de".
 */
export function uebersetzbar(sender: string, text: string): boolean {
  return sender === "guest" && text.trim().length > 0;
}

/**
 * Sprachcode als Name in der Oberflächensprache: „no" → „Norwegisch".
 *
 * `Intl.DisplayNames` kennt jede Sprache und übersetzt den Namen selbst mit —
 * eine eigene Tabelle wäre in 24 Oberflächensprachen zu pflegen und beim
 * nächsten Gast wieder unvollständig. Kennt der Browser den Code nicht, bleibt
 * der Code stehen: besser eine rohe Kennung als ein geratener Name (Wurzel 4).
 */
export function sprachName(code: string, locale: string): string {
  try {
    return (
      new Intl.DisplayNames([locale], { type: "language" }).of(code) ?? code
    );
  } catch {
    return code;
  }
}
