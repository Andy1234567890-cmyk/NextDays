// Kopfzeile des Hilfe-Centers — Logo, zentrale Suche, Kontakt-Button, Sprache.
// Sticky, im myNextDays-Look. Server-Komponente mit Client-Inseln (Suche/Sprache).
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { LanguageToggle } from "@/components/language-toggle";
import { Logo } from "@/components/logo";
import { Button } from "@nextdays/ui/button";

import { HeaderSearchSlot } from "./header-search-slot";

export async function HelpHeader() {
  const t = await getTranslations("help");
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-6">
        <Link href="/hilfe" aria-label="myNextDays Hilfe" className="flex shrink-0 items-center">
          {/* Hilfe-Center ist immer hell → dunkles Logo auf hellem Header. */}
          <Logo heightRem={2} />
        </Link>
        <HeaderSearchSlot />
        <div className="ml-auto flex items-center gap-2">
          <Button asChild variant="accent" size="sm">
            <Link href="/konto">{t("contact")}</Link>
          </Button>
          <LanguageToggle />
        </div>
      </div>
    </header>
  );
}
