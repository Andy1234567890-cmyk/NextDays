"use client";

// Der Hinweis „anderswo geändert" — ein Baustein für alle Reiter des Baukastens.
//
// Er erscheint NUR, wenn hier etwas Ungespeichertes offen ist. Ist nichts offen,
// aktualisiert sich die Ansicht von selbst und es gibt nichts zu fragen.
//
// Warum überhaupt gefragt wird, statt einfach neu zu laden: das Neuladen holt
// den Serverstand und ersetzt damit, woran gerade jemand tippt. Diese
// Entscheidung gehört dem, der schreibt — nicht dem, der zufällig als Zweiter
// gespeichert hat.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";

export function FremdeAenderung({
  sichtbar,
  onUebernehmen,
}: {
  sichtbar: boolean;
  onUebernehmen: () => void;
}) {
  const t = useTranslations("website");
  if (!sichtbar) return null;
  return (
    <button
      type="button"
      onClick={onUebernehmen}
      className="flex items-center gap-1.5 rounded-full bg-orange-500 px-3 py-1 text-sm font-medium text-white transition hover:bg-orange-600"
    >
      <Icon icon="ph:arrows-clockwise" className="size-4" />
      {t("editor.fremdeAenderung")}
    </button>
  );
}
