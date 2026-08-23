"use client";

// Der Einstellungen-Reiter: Unterpunkt-Liste links, Inhalt rechts.
//
// Zwei Ebenen, weil Einstellungen sich nicht in eine schmale Leiste pressen
// lassen (Domains brauchen eine Tabelle, Social sieben Felder). Lodgify löst es
// identisch: Reiterleiste oben, darunter links eine Liste der Unterpunkte, jeder
// mit eigener Adresse (`/settings/domain`, `/settings/contact`; live abgelesen
// am 23.08.2026).
//
// Die Unterpunkt-Liste ist KEINE zweite Reiterleiste in der Kopfzeile: dort
// stünden dann zwei Reihen Reiter übereinander, und man müsste raten, welche
// Ebene welche ist.
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import type { CustomDomain } from "@/lib/site-config";
import type { Page } from "@/lib/site-pages";

import { BaukastenRahmen } from "../rahmen";
import { BAUKASTEN_BASIS, EINSTELLUNGEN_UNTERPUNKTE } from "../reiter";

export function EinstellungenRahmen({
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
            {EINSTELLUNGEN_UNTERPUNKTE.map((u) => {
              const href = `${BAUKASTEN_BASIS}/einstellungen/${u}`;
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
                  {t(`einstellungen.${u}.titel`)}
                </Link>
              );
            })}
          </nav>
          {/* Die Inhaltsspalte begrenzt ihre Breite: ein Formular über 1600px
              ist unlesbar, weil Beschriftung und Feld weit auseinanderliegen. */}
          <div className="min-w-0 flex-1 md:max-w-3xl">{children}</div>
        </div>
      }
    />
  );
}

/** Kopf eines Einstellungs-Unterpunkts: Titel + Erklärung, was hier passiert. */
export function EinstellungenKopf({
  titel,
  beschreibung,
  aktion,
}: {
  titel: string;
  beschreibung: string;
  aktion?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 pb-6">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-extrabold">{titel}</h1>
        <p className="pt-1 text-sm text-muted-foreground">{beschreibung}</p>
      </div>
      {aktion ? <div className="shrink-0">{aktion}</div> : null}
    </div>
  );
}
