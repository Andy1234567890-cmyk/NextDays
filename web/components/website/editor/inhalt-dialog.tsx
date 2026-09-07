"use client";

// Der INHALT eines Bausteins als Dialog — nicht in der rechten Leiste.
//
// Die rechte Leiste ist Framers Style-Panel und trägt ausschließlich Stil
// (Auftrag 05.09.2026: „ich will dieselbe Sidebar mit allem genau so wie
// Framer"). Texte tippt man auf der Fläche (`contentEditable` über die
// Brücke). Was sich dort nicht tippen lässt — Bilder, Listen, Formularfelder,
// Objektauswahl, die Sprachfassung — steht hier, geöffnet über den
// „Inhalt"-Knopf an der Auswahl und über das Kontextmenü.
//
// Es ist DERSELBE `AbschnittInspektor` wie bisher, nur an anderem Ort: ein
// zweites Formular für dieselben Felder wäre zwei Wahrheiten.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

import type { BlockType } from "@/lib/site-pages";

import { AbschnittInspektor } from "./abschnitt-inspektor";

export function InhaltDialog({
  typ,
  titel,
  content,
  settings,
  sprache,
  onChange,
  onSettings,
  onSprache,
  onZu,
}: {
  typ: BlockType;
  titel: string;
  content: Record<string, unknown>;
  settings: Record<string, unknown>;
  sprache: string;
  onChange: (content: Record<string, unknown>) => void;
  onSettings: (settings: Record<string, unknown>) => void;
  onSprache: (sprache: string) => void;
  onZu: () => void;
}) {
  const t = useTranslations("website");

  useEffect(() => {
    function drauf(e: KeyboardEvent) {
      if (e.key === "Escape") onZu();
    }
    document.addEventListener("keydown", drauf);
    return () => document.removeEventListener("keydown", drauf);
  }, [onZu]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titel}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onZu();
      }}
    >
      <div className="flex max-h-full w-[36rem] max-w-full flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
            {t("arbeitsflaeche.inhaltBearbeiten", { abschnitt: titel })}
          </span>
          <button
            type="button"
            onClick={onZu}
            aria-label={t("editor.schliessen")}
            className="rounded p-1 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <Icon icon="ph:x" className="size-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <AbschnittInspektor
            typ={typ}
            content={content}
            settings={settings}
            onChange={onChange}
            onSettings={onSettings}
            inhaltsSprache={sprache}
            onInhaltsSprache={onSprache}
          />
        </div>
      </div>
    </div>
  );
}
