// Kopfzeile des Hilfe-Centers — Logo, zentrale Suche, Kontakt-Button, Sprache.
// Sticky, im myNextDays-Look. Server-Komponente mit Client-Inseln (Suche/Sprache).
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

import { HeaderSearchSlot } from "./header-search-slot";

export async function HelpHeader() {
  const t = await getTranslations("help");
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-6">
        <Link href="/hilfe" aria-label={t("brandTitle")} className="flex shrink-0 items-center">
          {/* Hilfe-Center ist immer hell → dunkles Logo auf hellem Header. */}
          <Logo heightRem={2} />
        </Link>
        <HeaderSearchSlot />
        {/* „Kontakt" erst ab `sm`: bei 320 px passten Logo + Knopf + Sprache
            nicht in die Zeile (58 px Überhang, Querscroll). Der Weg zum
            Kontakt bleibt auf jeder Seite über den Footer offen, die
            Sprachwahl hat mobil kein zweites Ziel. */}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Button asChild variant="accent" size="sm" className="hidden sm:inline-flex">
            <Link href="/kontakt">{t("contact")}</Link>
          </Button>
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
