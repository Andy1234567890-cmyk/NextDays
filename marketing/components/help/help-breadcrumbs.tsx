"use client";

// Breadcrumb-Pfad des Hilfe-Centers (Start > Kategorie > Artikel).
//
// Das Markup steht hier direkt, statt aus einer Breadcrumb-Bibliothek zu
// kommen: In der web-App kam es aus `@tasko/ui` — einem tsconfig-Alias auf
// `web/vendor/tasko-ui`, der Altlast eines Vorgängerprojekts. Diese
// Marketing-App hat bewusst keine Workspace-Pakete (eigenes bun.lock), und ein
// Vendor-Ordner mit sieben Breadcrumb-Bausteinen wäre für die EINE Nutzung
// hier unverhältnismäßig. Semantik (nav[aria-label], ol/li, aria-current) ist
// dieselbe.
import { useTranslations } from "next-intl";
import Link from "next/link";

import { Icon } from "@/components/ui/icon";

export type Crumb = { label: string; href?: string };

export function HelpBreadcrumbs({ items }: { items: Crumb[] }) {
  const t = useTranslations("help");
  return (
    <nav aria-label="breadcrumb">
      <ol className="flex flex-wrap items-center gap-1.5 break-words text-sm text-muted-foreground sm:gap-2.5">
        <li className="inline-flex items-center gap-1.5">
          <Link
            href="/hilfe"
            aria-label={t("home")}
            className="transition-colors hover:text-foreground"
          >
            <Icon icon="ph:house" className="size-4" />
          </Link>
        </li>
        {items.map((item) => (
          <span key={item.label} className="contents">
            <li role="presentation" aria-hidden className="[&>svg]:size-3.5">
              <Icon icon="ph:caret-right" />
            </li>
            <li className="inline-flex items-center gap-1.5">
              {item.href ? (
                <Link
                  href={item.href}
                  className="transition-colors hover:text-foreground"
                >
                  {item.label}
                </Link>
              ) : (
                // Die aktuelle Seite ist kein Link, wird Screenreadern aber als
                // Position im Pfad angekündigt.
                <span aria-current="page" className="font-normal text-foreground">
                  {item.label}
                </span>
              )}
            </li>
          </span>
        ))}
      </ol>
    </nav>
  );
}
