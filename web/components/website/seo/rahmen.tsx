"use client";

// Der SEO-Reiter des Baukastens (0430): Unterpunkt-Liste links, Inhalt rechts.
//
// Aufbau identisch zum Einstellungen-Reiter — bewusst, nicht aus Bequemlichkeit:
// zwei Bereiche mit derselben Aufgabe (viele Unterpunkte, jeder mit eigener
// Adresse) sollen sich gleich anfühlen. Eine zweite Anordnung wäre nur eine
// zweite Sache, die man lernen muss.
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import type { CustomDomain } from "@/lib/site-config";
import type { Page } from "@/lib/site-pages";

import { BaukastenRahmen } from "../rahmen";
import { BAUKASTEN_BASIS, SEO_UNTERPUNKTE } from "../reiter";

export function SeoRahmen({
  pages,
  domains,
  children,
}: {
  pages: Page[];
  domains: CustomDomain[];
  children: ReactNode;
}) {
  const t = useTranslations("website");
  const pfad = usePathname();

  return (
    <BaukastenRahmen
      pages={pages}
      domains={domains}
      breit
      inhalt={
        <div className="flex min-h-full flex-col gap-6 p-4 md:flex-row md:gap-8 md:p-6">
          <nav className="flex shrink-0 gap-1 overflow-x-auto md:w-56 md:flex-col md:overflow-visible">
            {SEO_UNTERPUNKTE.map((u) => {
              // Der erste Unterpunkt liegt auf der Reiter-Wurzel `/website/seo`
              // und nicht auf `/website/seo/uebersicht`: der Reiter muss ein
              // Ziel haben, und eine sofortige Weiterleitung auf einen
              // Unterpunkt wäre ein zusätzlicher Ladeschritt für nichts.
              const href =
                u === "uebersicht"
                  ? `${BAUKASTEN_BASIS}/seo`
                  : `${BAUKASTEN_BASIS}/seo/${u}`;
              const aktiv = pfad === href;
              return (
                <Link
                  key={u}
                  href={href}
                  aria-current={aktiv ? "page" : undefined}
                  className={
                    "shrink-0 rounded-(--radius) px-3 py-2 text-sm transition " +
                    (aktiv
                      ? "bg-secondary font-semibold text-foreground"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground")
                  }
                >
                  {t(`seo.${u}.titel`)}
                </Link>
              );
            })}
          </nav>
          <div className="min-w-0 flex-1 md:max-w-3xl">{children}</div>
        </div>
      }
    />
  );
}
