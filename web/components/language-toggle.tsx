"use client";

// Sprachumschalter für die Topbar. Setzt das Locale-Cookie via Server-Action
// und lädt die Seite serverseitig neu (router.refresh), damit next-intl die neue
// Sprache anwendet.
//
// ANZEIGE: die FLAGGE der aktiven Sprache, nicht mehr das neutrale
// Übersetzen-Symbol (`ph:translate`). Der Grund ist der Zustand, den der Knopf
// tragen muss: `ph:translate` sah bei allen 24 Sprachen gleich aus — man konnte
// die eingestellte Sprache nur erfahren, indem man das Menü aufklappte. Die
// Flagge beantwortet die Frage „welche Sprache ist gerade an?" im Vorbeigehen.
//
// In der aufgeklappten Liste steht die Flagge NEBEN Code und Endonym, nie an
// deren Stelle: eine Sprache deckt sich nicht mit einem Land (Deutsch ist
// DE/AT/CH, Französisch FR/BE/LU), deshalb bleibt das Wort die verbindliche
// Angabe und die Flagge die schnelle Wiedererkennung. Dasselbe Muster wie in
// der Baukasten-Kopfzeile (`components/website/kopfleiste.tsx`).
//
// Flaggen und Endonyme kommen aus `i18n/locales.ts` (LOCALE_FLAGS,
// LOCALE_LABELS) — es gibt keine zweite Liste.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useTransition } from "react";

import { setLocale } from "@/i18n/actions";
import {
  LOCALES,
  LOCALE_FLAGS,
  LOCALE_LABELS,
  type Locale,
} from "@/i18n/locales";
import { Button } from "@nextdays/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@nextdays/ui/dropdown-menu";

export function LanguageToggle() {
  const t = useTranslations("common");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Alphabetisch nach dem ENDONYM, sortiert in der Ordnung der aktiven
  // Sprache — sonst landet „Ελληνικά" nach ASCII-Bytes hinter „Svenska".
  const optionen = useMemo(() => {
    const collator = new Intl.Collator(locale);
    return LOCALES.map((code) => ({ code, label: LOCALE_LABELS[code] })).sort(
      (a, b) => collator.compare(a.label, b.label),
    );
  }, [locale]);

  function choose(next: Locale) {
    if (next === locale) return;
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          // Die Flagge allein ist kein lesbarer Name — der Knopf trägt deshalb
          // die aktive Sprache im Label, sonst hört ein Screenreader nur
          // „Schaltfläche".
          aria-label={`${t("chooseLanguage")}: ${LOCALE_LABELS[locale]}`}
          disabled={pending}
        >
          {/* `aria-hidden`, weil die Sprache schon im aria-label des Knopfes
              steht — sonst liest der Screenreader sie doppelt. */}
          <Icon
            icon={LOCALE_FLAGS[locale]}
            className="size-5 shrink-0"
            aria-hidden
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
        {optionen.map((o) => (
          <DropdownMenuItem
            key={o.code}
            onClick={() => choose(o.code)}
            className={o.code === locale ? "font-semibold" : undefined}
          >
            <Icon
              icon={LOCALE_FLAGS[o.code]}
              className="mr-2 size-4 shrink-0"
              aria-hidden
            />
            <span className="mr-2 text-xs uppercase text-muted-foreground">
              {o.code}
            </span>
            {o.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
