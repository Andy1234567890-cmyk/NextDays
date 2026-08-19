"use client";

// Suchfeld des Hilfe-Centers. Übergibt die Anfrage per Navigation an /hilfe/suche.
// Texte aus next-intl (Namespace "help"). Icons via Iconify (ph:*).
import { Icon } from "@/components/ui/icon";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function HelpSearchBox({
  autoFocus = false,
  size = "md",
  defaultValue = "",
}: {
  autoFocus?: boolean;
  size?: "md" | "lg";
  defaultValue?: string;
}) {
  const t = useTranslations("help");
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim();
    if (q) router.push(`/hilfe/suche?q=${encodeURIComponent(q)}`);
  }

  const tall = size === "lg";

  return (
    <form onSubmit={submit} className="w-full" role="search">
      <div className="relative flex items-center">
        <Icon
          icon="ph:magnifying-glass"
          className={`pointer-events-none absolute size-5 text-muted-foreground ${tall ? "left-4" : "left-3.5 size-4"}`}
        />
        <input
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          // Autofokus nur, wo der Aufrufer ihn ausdrücklich anfordert (Suchseite,
          // wo das Eingabefeld der Zweck der Seite ist) — nie auf der
          // Hilfe-Startseite, deren Text man zuerst lesen soll.
          autoFocus={autoFocus}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchAria")}
          className={`w-full rounded-full border border-border bg-card text-foreground placeholder:text-muted-foreground shadow-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30 ${
            tall ? "h-14 pl-12 pr-5 text-base" : "h-11 pl-10 pr-4 text-sm"
          }`}
        />
      </div>
    </form>
  );
}
