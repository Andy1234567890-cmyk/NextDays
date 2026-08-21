"use client";

// Code-Block mit Kopier-Knopf.
//
// Client-Komponente, weil das Kopieren die Zwischenablage braucht. Der Inhalt
// kommt als Text-Prop aus `content/api/referenz.ts` — es wird KEIN HTML
// eingesetzt und kein `dangerouslySetInnerHTML` verwendet: alles, was hier
// landet, ist eingecheckter Text, und so bleibt es auch, wenn irgendwann ein
// Beispiel aus einer Antwort generiert wird (Wurzel 8).
import { useState } from "react";

import { Icon } from "@/components/ui/icon";

type Props = {
  code: string;
  /** Kopfzeile, z. B. „Anfrage" oder „Antwort". */
  titel?: string;
  /** Beschriftung des Kopier-Knopfs (übersetzt). */
  kopierenLabel: string;
  /** Bestätigung nach dem Kopieren (übersetzt). */
  kopiertLabel: string;
};

export function CodeBlock({ code, titel, kopierenLabel, kopiertLabel }: Props) {
  const [kopiert, setKopiert] = useState(false);

  async function kopieren() {
    try {
      await navigator.clipboard.writeText(code);
      setKopiert(true);
      // Nach zwei Sekunden zurück auf „Kopieren" — ohne Rücksetzen bliebe der
      // Knopf für immer auf „Kopiert" stehen und wäre beim zweiten Mal eine
      // Falschaussage.
      setTimeout(() => setKopiert(false), 2000);
    } catch {
      // Zwischenablage verweigert (fehlende Berechtigung, unsicherer Kontext).
      // Kein Alarm: der Code steht sichtbar da und lässt sich markieren. Ein
      // Fehlerdialog wäre hier lauter als das Problem.
      setKopiert(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-primary text-primary-foreground">
      <div className="flex items-center justify-between gap-4 border-b border-primary-foreground/15 px-4 py-2.5">
        <span className="font-mono text-xs uppercase tracking-wide text-primary-foreground/60">
          {titel ?? ""}
        </span>
        <button
          type="button"
          onClick={kopieren}
          className="flex items-center gap-1.5 rounded-full border border-primary-foreground/25 px-3 py-1 text-xs transition-colors hover:bg-primary-foreground/10"
        >
          <Icon
            icon={kopiert ? "ph:check-bold" : "ph:share-network"}
            className="size-3.5"
          />
          {kopiert ? kopiertLabel : kopierenLabel}
        </button>
      </div>
      {/* `overflow-x-auto`: lange curl-Zeilen dürfen die Seite nicht breiter
          machen — sonst scrollt das ganze Layout waagerecht. */}
      <pre className="overflow-x-auto px-4 py-4 text-[0.8125rem] leading-relaxed">
        <code className="font-mono">{code}</code>
      </pre>
    </div>
  );
}
