"use client";

// Auswahl der GESPROCHENEN Sprachen einer Person (Chips + Suchfeld + Liste).
//
// EINE Quelle für den Anlege-Wizard (Schritt 2) und die Detailseite („Zusätzliche
// Informationen"). Vorher lag dieselbe Liste nur im Wizard; die Detailseite hätte
// sie kopieren müssen, und die zweite Kopie wäre beim nächsten Feld
// auseinandergelaufen.
//
// NICHT zu verwechseln mit `SprachAuswahl`: das ist die Sprache der E-MAILS an
// diese Person (eine der 24 Oberflächen-Locales). Hier geht es darum, welche
// Sprachen sie SPRICHT — dafür gibt es mehr Einträge als Oberflächen, und eine
// Mehrfachauswahl.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Checkbox } from "@nextdays/ui/checkbox";
import { Label } from "@nextdays/ui/label";
import { useLanguageOptions } from "@/lib/use-language-options";

export function GesprocheneSprachen({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const t = useTranslations("account");
  const sprachen = useLanguageOptions();
  const [suche, setSuche] = useState("");

  const umschalten = (lang: string) =>
    onChange(
      value.includes(lang)
        ? value.filter((l) => l !== lang)
        : [...value, lang],
    );

  const gefiltert = sprachen.filter((l) =>
    l.label.toLowerCase().includes(suche.trim().toLowerCase()),
  );
  // Anzeige über die Oberflächensprache, gespeichert wird der Wert selbst.
  // Fehlt ein gespeicherter Wert im Katalog (Altbestand, freie Eingabe), zeigt
  // der Chip ihn unverändert — statt ihn zu verschweigen.
  const beschriftung = (wert: string) =>
    sprachen.find((l) => l.value === wert)?.label ?? wert;

  return (
    <div className="flex flex-col gap-1.5">
      <Label>{t("userWizard.spokenLanguages")}</Label>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => umschalten(l)}
              className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs"
            >
              <Icon icon="ph:x" className="size-3" />
              {beschriftung(l)}
            </button>
          ))}
        </div>
      )}
      <div className="rounded-(--radius) border border-input">
        <div className="flex items-center gap-2 border-b border-input px-3">
          <Icon
            icon="ph:magnifying-glass"
            className="size-4 shrink-0 text-muted-foreground"
          />
          <input
            type="text"
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
            placeholder={t("userWizard.searchLanguage")}
            className="w-full bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-48 overflow-y-auto">
          {gefiltert.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              {t("userWizard.noLanguageFound")}
            </p>
          ) : (
            gefiltert.map((l) => (
              <label
                key={l.value}
                className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-secondary/50"
              >
                <Checkbox
                  checked={value.includes(l.value)}
                  onCheckedChange={() => umschalten(l.value)}
                />
                {l.label}
              </label>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
