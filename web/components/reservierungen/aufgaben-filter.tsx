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
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import { LEERER_ZEITRAUM, type Zeitraum } from "@/lib/aufgaben-konstanten";

export type FilterOption = { value: string; label: string; group?: string };

/** Der Datumsfilter der Leiste („von–bis"). */
export type ZeitraumSpec = {
  wert: Zeitraum;
  onChange: (zeitraum: Zeitraum) => void;
};

/** Ein Filter der Leiste. `selected` leer = „alle" (kein Filter aktiv). */
export type FilterSpec = {
  key: string;
  /** Ehemalige Beschriftung ÜBER dem Knopf. Seit dem 31.08.2026 ungenutzt: sie
   *  wiederholte nur, was im Knopf steht. Als optionales Feld belassen, damit
   *  die vier Aufrufer nicht angefasst werden müssen — sie dürfen es weiter
   *  übergeben, es wird nur nicht mehr gerendert. */
  caption?: string;
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
  zeitraum,
  zusatzReset,
}: {
  filters: FilterSpec[];
  /** Datumsfilter. Weggelassen = die Ansicht hat keinen (im Kalender bestimmt
   *  der angezeigte Monat den Zeitraum, ein zweites Datumsfeld daneben wäre
   *  eine zweite Wahrheit über denselben Zeitraum). */
  zeitraum?: ZeitraumSpec;
  /** Wird beim Zurücksetzen mit ausgeführt (im Kalender: zurück auf heute).
   *  So gibt es EIN „Alles zurücksetzen", nicht zwei nebeneinander. */
  zusatzReset?: () => void;
}) {
  const t = useTranslations("reservations");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const active = filters.find((f) => f.key === openKey) ?? null;
  const zeitraumAktiv = Boolean(zeitraum?.wert.von || zeitraum?.wert.bis);
  const anySelected =
    filters.some((f) => f.selected.length > 0) || zeitraumAktiv;

  // AUFGERÄUMT AM 31.08.2026. Vorher trug JEDER Filter eine eigene Überschrift
  // („Ausgewählte Aufgabe", „Ausgewählte Benutzer", „Ausgewählte Unterkünfte")
  // über einem Knopf, dessen Beschriftung dasselbe schon sagte („Alle
  // Aufgaben"). Drei Kleintexte über drei Knöpfen, dazu ein viertes
  // „Alles zurücksetzen" über einem nackten ×: eine zerfledderte Zeile aus
  // acht Elementen für drei Auswahlen. Gemeldet als „die Filterleiste muss
  // überarbeitet werden, das sieht ja durcheinander aus, kein UI-Design".
  //
  // Jetzt EINE Zeile gleichartiger Knöpfe. Was gewählt ist, steht IM Knopf und
  // ist am Logo-Rot erkennbar — die Überschrift war ohnehin nur die Wiederholung
  // dessen, was darunter stand.
  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.map((filter) => {
        const aktiv = filter.selected.length > 0;
        return (
          <Button
            key={filter.key}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOpenKey(filter.key)}
            // Ein gesetzter Filter ist der wichtigste Zustand dieser Leiste:
            // Wer ihn übersieht, hält eine gefilterte Liste für die ganze.
            // Deshalb Rahmen und Schrift in Logo-Rot statt einer stillen
            // Textänderung.
            className={
              aktiv ? "border-accent text-accent hover:text-accent" : undefined
            }
          >
            <Icon
              icon={aktiv ? "ph:funnel-fill" : "ph:funnel"}
              className="size-3.5"
            />
            {filter.selected.length === 0
              ? filter.allLabel
              : `${filter.allLabel} · ${filter.selected.length}`}
          </Button>
        );
      })}

      {/* Der Datumsfilter steht als Knopf in derselben Zeile wie die anderen:
          zwei nackte Datumsfelder daneben hätten die am 31.08.2026 bewusst
          vereinheitlichte Leiste wieder zerfledert. Seine Beschriftung zeigt
          den gewählten Zeitraum, damit man ihn nicht übersieht. */}
      {zeitraum && (
        <ZeitraumKnopf
          spec={zeitraum}
          offen={openKey === _ZEITRAUM_KEY}
          onOeffnen={() => setOpenKey(_ZEITRAUM_KEY)}
          onSchliessen={() => setOpenKey(null)}
        />
      )}

      {(anySelected || zusatzReset) && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!anySelected && !zusatzReset}
          onClick={() => {
            filters.forEach((f) => f.onChange([]));
            zeitraum?.onChange(LEERER_ZEITRAUM);
            zusatzReset?.();
          }}
          className="text-muted-foreground"
        >
          <Icon icon="ph:x" className="size-3.5" />
          {t("aufgabenFilter.resetCaption")}
        </Button>
      )}

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

const _ZEITRAUM_KEY = "__zeitraum";

/**
 * Der Datumsfilter: ein Knopf wie die anderen, der ein kleines Feld mit „von"
 * und „bis" aufklappt.
 *
 * Kein Dialog wie bei den Listenfiltern — dort ist er nötig, weil die Listen
 * lang werden; hier sind es zwei Felder, und ein Modal über der halben Seite
 * für zwei Datumseingaben wäre unangemessen.
 *
 * Bewusst OHNE „Speichern": jede Änderung wirkt sofort. Die Begründung der
 * Listendialoge (nicht jede Checkbox soll eine Serverrunde auslösen) greift
 * hier nicht — es gibt genau zwei Felder, und ein Datum tippt man einmal.
 */
function ZeitraumKnopf({
  spec,
  offen,
  onOeffnen,
  onSchliessen,
}: {
  spec: ZeitraumSpec;
  offen: boolean;
  onOeffnen: () => void;
  onSchliessen: () => void;
}) {
  const t = useTranslations("reservations");
  const kurz = useKurzesDatum();
  const aktiv = Boolean(spec.wert.von || spec.wert.bis);

  useEffect(() => {
    if (!offen) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSchliessen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [offen, onSchliessen]);

  // Im Knopf steht der gewählte Zeitraum, nicht bloß „Zeitraum · 2": ein Datum
  // ist die Angabe selbst, und eine Anzahl wäre hier ohne Aussage. Ist nur eine
  // Grenze gesetzt, ist der Zeitraum offen — das sagt „ab …" / „bis …".
  const beschriftung = (() => {
    const { von, bis } = spec.wert;
    if (von && bis) return `${kurz(von)} – ${kurz(bis)}`;
    if (von) return t("aufgabenFilter.dateFrom", { datum: kurz(von) });
    if (bis) return t("aufgabenFilter.dateUntil", { datum: kurz(bis) });
    return t("aufgabenFilter.allDates");
  })();

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => (offen ? onSchliessen() : onOeffnen())}
        className={
          aktiv ? "border-accent text-accent hover:text-accent" : undefined
        }
      >
        <Icon
          icon={aktiv ? "ph:calendar-blank-fill" : "ph:calendar-blank"}
          className="size-3.5"
        />
        {beschriftung}
      </Button>

      {offen && (
        <>
          {/* Klick daneben schließt. Ein unsichtbarer Vollflächen-Knopf statt
              eines Dokument-Listeners: so schließt der Klick das Feld, ohne
              zusätzlich das Element darunter zu betätigen. */}
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label={t("aufgabenFilter.close")}
            onClick={onSchliessen}
          />
          <div className="absolute right-0 z-50 mt-2 w-72 rounded-2xl border bg-card p-4 shadow-xl">
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                {t("aufgabenFilter.dateFromLabel")}
                <Input
                  type="date"
                  value={spec.wert.von}
                  // `max`/`min` halten die beiden Felder zueinander stimmig:
                  // ein Startdatum nach dem Enddatum kann der Nutzer so nicht
                  // eintippen, statt dass der Server es mit 422 ablehnt.
                  max={spec.wert.bis || undefined}
                  onChange={(e) =>
                    spec.onChange({ ...spec.wert, von: e.target.value })
                  }
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                {t("aufgabenFilter.dateUntilLabel")}
                <Input
                  type="date"
                  value={spec.wert.bis}
                  min={spec.wert.von || undefined}
                  onChange={(e) =>
                    spec.onChange({ ...spec.wert, bis: e.target.value })
                  }
                />
              </label>
              {aktiv && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="self-start text-muted-foreground"
                  onClick={() => spec.onChange(LEERER_ZEITRAUM)}
                >
                  <Icon icon="ph:x" className="size-3.5" />
                  {t("aufgabenFilter.dateClear")}
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * `2026-08-20` → in der Sprache des Nutzers („20. Aug. 2026", „Aug 20, 2026").
 *
 * Kein festes `TT.MM.JJJJ`: die Oberfläche läuft in 24 Sprachen, und die
 * Aufgabentabelle daneben schreibt ihre Termine ebenfalls über `locale`
 * (`aufgaben-tabelle.tsx::useTermin`) — zwei Datumsformate auf einer Seite
 * wären ein Bruch.
 *
 * Der Wert ist ein reines KALENDERDATUM. Deshalb `Date.UTC` plus `timeZone:
 * "UTC"` statt `new Date("2026-08-20")`: letzteres liegt in Zonen westlich von
 * Greenwich einen Tag daneben, und der Knopf zeigte dann ein anderes Datum als
 * im Feld darunter steht.
 */
function useKurzesDatum(): (iso: string) => string {
  const locale = useLocale();
  return (iso) => {
    const [jahr, monat, tag] = iso.split("-").map(Number);
    if (!jahr || !monat || !tag) return iso;
    return new Date(Date.UTC(jahr, monat - 1, tag)).toLocaleDateString(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  };
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
          <Button
            type="button"
            variant="outline"
            onClick={() => setEntwurf([])}
          >
            {t("aufgabenFilter.selectNone")}
          </Button>
          <Button
            type="button"
            onClick={() =>
              // „Alles gewählt" ist dasselbe wie „kein Filter" — sonst stünde
              // im Knopf „25 gewählt", obwohl nichts eingeschränkt ist.
              onSave(entwurf.length === spec.options.length ? [] : entwurf)
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
