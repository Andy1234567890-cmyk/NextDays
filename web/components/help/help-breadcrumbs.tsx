"use client";

// Breadcrumb-Pfad des Hilfe-Centers (Start > Kategorie > Artikel).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import Link from "next/link";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@tasko/ui";

export type Crumb = { label: string; href?: string };

export function HelpBreadcrumbs({ items }: { items: Crumb[] }) {
  const t = useTranslations("help");
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/hilfe" aria-label={t("home")}>
              <Icon icon="ph:house" className="size-4" />
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {items.map((item) => (
          <span key={item.label} className="contents">
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {item.href ? (
                <BreadcrumbLink asChild>
                  <Link href={item.href}>{item.label}</Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage>{item.label}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </span>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
