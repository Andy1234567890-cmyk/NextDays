"use client";

// Suchfeld der Lieferanten-Seite: schreibt `?search=` in die URL, die Server
// Component lädt dann serverseitig gefiltert (Filter wirkt in der DB, nicht
// im Browser — dieselbe Suche wie /customers).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";

import { Input } from "@nextdays/ui/input";

export function LieferantenSuche() {
  const t = useTranslations("finance");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [wert, setWert] = useState(params.get("search") ?? "");

  function absenden(e: FormEvent) {
    e.preventDefault();
    const q = wert.trim();
    router.push(q ? `${pathname}?search=${encodeURIComponent(q)}` : pathname);
  }

  return (
    <form onSubmit={absenden} className="relative w-full sm:max-w-xs">
      <Icon
        icon="ph:magnifying-glass"
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        value={wert}
        onChange={(e) => setWert(e.target.value)}
        placeholder={t("lieferantenPage.searchPlaceholder")}
        className="pl-9"
        aria-label={t("lieferantenPage.searchPlaceholder")}
      />
    </form>
  );
}
