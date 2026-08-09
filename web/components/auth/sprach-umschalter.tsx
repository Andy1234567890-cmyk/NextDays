"use client";

// Sprachumschalter für die ÖFFENTLICHEN Auth-Seiten (Einladung, Passwort
// vergessen, neues Passwort, Anmeldung, Registrierung).
//
// WARUM ER HIER SEIN MUSS: Die Sprache dieser Seiten wird automatisch
// aufgelöst (Token → Accept-Language → Englisch, siehe `i18n/aufloesung.ts`).
// Automatik liegt daneben, sobald die Wirklichkeit von den Daten abweicht: ein
// Eigentümer, dem der Betrieb bei der Anlage die falsche Sprache eingetragen
// hat; ein Gerät, das auf die Sprache eines Kollegen eingestellt ist; ein
// Hotelrechner in der Lobby. Ohne Korrekturmöglichkeit steht der Betroffene
// vor einer Seite, die er nicht liest — und anders als im Dashboard kann er
// sich nicht einloggen und es dort umstellen. Der Umschalter im Dashboard
// (`language-toggle.tsx`) hilft ihm nicht, denn er hat noch kein Konto.
//
// Warum eine EIGENE Komponente statt `language-toggle.tsx`: jener sitzt in der
// Topbar des Dashboards, hängt an dessen `common`-Namespace und ist ein
// Icon-Button ohne sichtbaren Text. Hier steht der Umschalter allein auf einer
// leeren Seite und muss auch dann erkennbar sein, wenn der Betrachter die
// aktuelle Sprache NICHT versteht — deshalb ein sichtbares Globus-Symbol mit
// dem Endonym der aktiven Sprache („Dansk", nicht „Dänisch") daneben. Die 24
// Endonyme kommen aus `i18n/locales.ts` (LOCALE_LABELS), es gibt keine zweite
// Liste. Keine Flaggen: eine Flagge ist ein LAND, keine Sprache.
//
// Die Wahl landet im Cookie `nd_locale` und gewinnt danach dauerhaft gegen die
// Automatik (erste Stufe der Kette) — wer einmal korrigiert hat, wird nicht bei
// jedem Aufruf erneut überstimmt.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useTransition } from "react";

import { setLocale } from "@/i18n/actions";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/i18n/locales";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@nextdays/ui/dropdown-menu";

export function SprachUmschalter() {
  const t = useTranslations("auth");
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

  function waehlen(next: Locale) {
    if (next === locale) return;
    startTransition(async () => {
      await setLocale(next);
      // Serverseitig neu rendern: die Sprache wird in `i18n/request.ts`
      // entschieden, nicht im Client. So bleibt auch `<html lang>` korrekt.
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("languageChange")}
        disabled={pending}
        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
      >
        <Icon icon="ph:globe" className="size-4" aria-hidden />
        {LOCALE_LABELS[locale]}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
        {optionen.map((o) => (
          <DropdownMenuItem
            key={o.code}
            onSelect={() => waehlen(o.code)}
            className={o.code === locale ? "font-semibold" : undefined}
          >
            {o.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
