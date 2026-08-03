"use client";

// Filterleiste des Aufgaben-Moduls: „Ausgewählte Aufgabe · Ausgewählte Benutzer ·
// Ausgewählte Unterkünfte · Alles zurücksetzen".
//
// Warum ein Dialog und kein Dropdown: die Listen werden lang (bei 25 Objekten
// scrollt ein Dropdown ins Nichts). Der Dialog hat ein Suchfeld, ein
// Checkbox-Raster und die beiden Sammelknöpfe „Alle selektieren" / „Nichts
// selektieren" — und er übernimmt die Auswahl erst beim Speichern, sodass nicht
// jede einzelne Checkbox eine Serverrunde auslöst.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";

export type FilterOption = { value: string; label: string; group?: string };

/** Ein Filter der Leiste. `selected` leer = „alle" (kein Filter aktiv). */
export type FilterSpec = {
  key: string;
  /** Beschriftung über dem Knopf. */
  caption: string;
  /** Knopftext, wenn nichts gewählt ist („Alle Unterkünfte"). */
  allLabel: string;
  /** Titel des Auswahldialogs. */
  dialogTitle: string;
  searchPlaceholder: string;
  options: FilterOption[];
  selected: string[];
  onChange: (values: string[]) => void;
};

export function AufgabenFilter({
  filters,
  zusatzReset,
}: {
  filters: FilterSpec[];
  /** Wird beim Zurücksetzen mit ausgeführt (im Kalender: zurück auf heute).
   *  So gibt es EIN „Alles zurücksetzen", nicht zwei nebeneinander. */
  zusatzReset?: () => void;
}) {
  const t = useTranslations("reservations");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const active = filters.find((f) => f.key === openKey) ?? null;
  const anySelected = filters.some((f) => f.selected.length > 0);

  return (
    <div className="flex flex-wrap items-end justify-end gap-3">
      {filters.map((filter) => (
        <div key={filter.key} className="flex flex-col items-start gap-1">
          <span className="text-xs text-muted-foreground">{filter.caption}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOpenKey(filter.key)}
          >
            {filter.selected.length === 0
              ? filter.allLabel
              : t("aufgabenFilter.selectedCount", {
                  count: filter.selected.length,
                })}
          </Button>
        </div>
      ))}

      <div className="flex flex-col items-start gap-1">
        <span className="text-xs text-muted-foreground">
          {t("aufgabenFilter.resetCaption")}
        </span>
        <button
          type="button"
          disabled={!anySelected && !zusatzReset}
          onClick={() => {
            filters.forEach((f) => f.onChange([]));
            zusatzReset?.();
          }}
          className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-40"
          aria-label={t("aufgabenFilter.resetCaption")}
        >
          <Icon icon="ph:x" className="size-4" />
        </button>
      </div>

      {active && (
        <AuswahlDialog
          spec={active}
          onClose={() => setOpenKey(null)}
          onSave={(values) => {
            active.onChange(values);
            setOpenKey(null);
          }}
        />
      )}
    </div>
  );
}

function AuswahlDialog({
  spec,
  onClose,
  onSave,
}: {
  spec: FilterSpec;
  onClose: () => void;
  onSave: (values: string[]) => void;
}) {
  const t = useTranslations("reservations");
  const [suche, setSuche] = useState("");
  // Der Dialog arbeitet auf einer KOPIE: „Schließen" verwirft, „Speichern"
  // übernimmt. Sonst wäre jedes Häkchen sofort ein Server-Roundtrip.
  const [entwurf, setEntwurf] = useState<string[]>(spec.selected);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const sichtbar = useMemo(() => {
    const needle = suche.trim().toLowerCase();
    if (!needle) return spec.options;
    return spec.options.filter(
      (o) =>
        o.label.toLowerCase().includes(needle) ||
        (o.group ?? "").toLowerCase().includes(needle),
    );
  }, [spec.options, suche]);

  const toggle = (value: string) =>
    setEntwurf((alt) =>
      alt.includes(value) ? alt.filter((v) => v !== value) : [...alt, value],
    );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-24">
      <div
        className="absolute inset-0 bg-black/40"
        role="presentation"
        onClick={onClose}
      />
      <div
        className="relative z-10 flex max-h-[70vh] w-full max-w-3xl flex-col rounded-2xl bg-card shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label={spec.dialogTitle}
      >
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="font-display text-lg font-bold">{spec.dialogTitle}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full hover:bg-secondary"
            aria-label={t("aufgabenFilter.close")}
          >
            <Icon icon="ph:x" className="size-4" />
          </button>
        </div>

        <div className="flex flex-col gap-3 overflow-y-auto px-6 py-4">
          <Input
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
            placeholder={spec.searchPlaceholder}
          />
          {sichtbar.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("aufgabenFilter.noMatch")}
            </p>
          ) : (
            <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
              {sichtbar.map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={entwurf.includes(option.value)}
                    onChange={() => toggle(option.value)}
                    className="size-4 rounded-sm accent-primary"
                  />
                  <span className="truncate">{option.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => setEntwurf(spec.options.map((o) => o.value))}
          >
            {t("aufgabenFilter.selectAll")}
          </Button>
          <Button type="button" variant="outline" onClick={() => setEntwurf([])}>
            {t("aufgabenFilter.selectNone")}
          </Button>
          <Button
            type="button"
            onClick={() =>
              // „Alles gewählt" ist dasselbe wie „kein Filter" — sonst stünde
              // im Knopf „25 gewählt", obwohl nichts eingeschränkt ist.
              onSave(
                entwurf.length === spec.options.length ? [] : entwurf,
              )
            }
          >
            {t("aufgabenFilter.save")}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            {t("aufgabenFilter.close")}
          </Button>
        </div>
      </div>
    </div>
  );
}
