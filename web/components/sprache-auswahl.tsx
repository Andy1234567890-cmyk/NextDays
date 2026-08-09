"use client";

// Sprachauswahl für E-Mail-Empfänger (Nutzer + Eigentümer) — EINE Komponente
// für alle Stellen (Benutzer-Wizard, Nutzer bearbeiten, Eigentümer-Stammdaten,
// Eigentümer anlegen). Keine zweite Kopie anlegen.
//
// Fachlich: das hier ist NICHT die Sprache der Oberfläche (die schaltet
// `language-toggle.tsx` per Cookie), sondern die Sprache, in der diese Person
// ihre E-MAILS bekommt. Ein Eigentümer ohne Login bekommt Abrechnungsmails —
// deshalb hängt der Wert am Stammdatensatz, nicht am Login.
//
// Recherche (Smashing Magazine, SimpleLocalize, Smartling, Localizely):
//   * Endonyme — die Sprache in ihrer EIGENEN Schreibweise („Čeština", nicht
//     „Tschechisch"). Wer nur Tschechisch liest, erkennt „Tschechisch" nicht.
//     Die 24 Endonyme liegen bereits zentral in `i18n/locales.ts`
//     (LOCALE_LABELS) — genau die werden hier benutzt, keine zweite Liste.
//   * KEINE Flaggen. Eine Flagge ist ein LAND, keine Sprache (Deutsch: DE/AT/CH,
//     Französisch: FR/BE/LU/CA). Gilt durchgehend als Antipattern.
//   * Sortierung alphabetisch NACH DEM ENDONYM mit `Intl.Collator` der aktiven
//     Oberflächensprache — sonst landet „Ελληνικά" nach ASCII-Bytes irgendwo
//     hinter „Svenska".
//   * 24 Einträge sind für ein natives <select> unkritisch (Suchfeld wird ab
//     grob 25–30 empfohlen). Das native Element bringt Tastaturbedienung,
//     Typeahead und die mobile Systemauswahl gratis mit — deshalb bewusst
//     `NativeSelect` statt eines eigenen Combobox-Nachbaus.
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";

import { LOCALES, LOCALE_LABELS, type Locale } from "@/i18n/locales";
import { Label } from "@nextdays/ui/label";
import { NativeSelect } from "@nextdays/ui/native-select";

/**
 * Die 24 Locales, alphabetisch nach ihrem Endonym in der Sortierordnung der
 * aktiven Oberflächensprache. Als Hook, damit die Reihenfolge der Sprache des
 * Betrachters folgt und nicht einmal hart in Deutsch einfriert.
 */
export function useSprachOptionen(): { code: Locale; label: string }[] {
  const locale = useLocale();
  return useMemo(() => {
    const collator = new Intl.Collator(locale);
    return LOCALES.map((code) => ({ code, label: LOCALE_LABELS[code] })).sort(
      (a, b) => collator.compare(a.label, b.label),
    );
  }, [locale]);
}

type SprachAuswahlProps = {
  /** ISO-639-1 der gewählten Sprache, "" = keine Angabe. */
  value: string;
  /** "" wenn der Platzhalter gewählt wurde (nur mit `allowEmpty`). */
  onChange: (locale: string) => void;
  /** id für das <select>; das Label zeigt darauf. */
  id: string;
  /** Eigene Beschriftung; Standard ist „Sprache für E-Mails". */
  label?: string;
  /** Erklärtext unter dem Feld. `null` blendet ihn aus. */
  hint?: string | null;
  /** Leerauswahl („— nicht gesetzt") erlauben. */
  allowEmpty?: boolean;
  /** Text der Leerauswahl; Standard aus i18n. */
  emptyLabel?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
};

/**
 * Sprachauswahl inklusive Label und Hilfetext.
 *
 * Barrierefrei: echtes <label for> auf ein natives <select> (Tastatur,
 * Typeahead, Screenreader, mobile Systemauswahl ohne Zutun).
 * `autoComplete="language"` ist bewusst NICHT gesetzt: der Browser würde die
 * Sprache des BEDIENERS vorschlagen — hier wird aber die Sprache einer DRITTEN
 * Person erfasst (Betreiber legt Eigentümer an). Ein Autofill wäre hier falsch.
 */
export function SprachAuswahl({
  value,
  onChange,
  id,
  label,
  hint,
  allowEmpty = false,
  emptyLabel,
  required = false,
  disabled = false,
  className,
}: SprachAuswahlProps) {
  const t = useTranslations("sprache");
  const optionen = useSprachOptionen();
  const hintId = `${id}-hint`;
  const hinweis = hint === null ? null : (hint ?? t("hint"));

  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <Label htmlFor={id}>
        {label ?? t("label")}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      <NativeSelect
        id={id}
        value={value}
        disabled={disabled}
        required={required}
        aria-describedby={hinweis ? hintId : undefined}
        onChange={(e) => onChange(e.target.value)}
      >
        {allowEmpty && <option value="">{emptyLabel ?? t("none")}</option>}
        {optionen.map((o) => (
          <option key={o.code} value={o.code}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
      {hinweis && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hinweis}
        </p>
      )}
    </div>
  );
}

/**
 * Endonym zu einem Code — für reine Anzeigestellen (Listen, Karten).
 * Unbekannter/leerer Code → `null`. KEIN Fallback auf „Deutsch": ein fehlender
 * Wert ist ein fehlender Wert und darf nicht als gesetzte Sprache erscheinen
 * (Wurzel 4).
 */
export function sprachLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  return LOCALE_LABELS[code as Locale] ?? null;
}
