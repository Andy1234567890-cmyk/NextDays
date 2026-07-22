"use client";

// Sprachumschalter für die Topbar. Setzt das Locale-Cookie via Server-Action
// und lädt die Seite serverseitig neu (router.refresh), damit next-intl die neue
// Sprache anwendet. Icons via Iconify (ph:*).
import { Icon } from "@iconify/react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { setLocale } from "@/i18n/actions";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/i18n/locales";
import { Button } from "@nextdays/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@nextdays/ui/dropdown-menu";

export function LanguageToggle() {
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

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
          aria-label="Sprache wählen"
          disabled={pending}
        >
          <Icon icon="ph:translate" className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
        {LOCALES.map((code) => (
          <DropdownMenuItem
            key={code}
            onClick={() => choose(code)}
            className={code === locale ? "font-semibold" : undefined}
          >
            <span className="mr-2 text-xs uppercase text-muted-foreground">
              {code}
            </span>
            {LOCALE_LABELS[code]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
