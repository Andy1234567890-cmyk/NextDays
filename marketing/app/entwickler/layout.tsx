// Rahmen der Entwickler-Doku: eigene Kopfzeile mit zwei Bereichs-Tabs, feste
// Sidebar, Inhalt daneben.
//
// Referenz-UX: docs.lodgify.com (ReadMe.io), live abgelesen am 22.08.2026.
// Übernommen sind die vier Merkmale, die eine API-Doku von einer Produktseite
// unterscheiden:
//   1. EIGENE, schmale Kopfzeile — nicht die Marketing-Navigation. Wer hier
//      liest, sucht Endpunkte, nicht „Preise" und „Über uns".
//   2. ZWEI Bereiche als Tabs: Leitfaden und Referenz, jeder mit eigener
//      Sidebar. Man liest oder man schlägt nach.
//   3. Eine feste, scrollende Sidebar. Sie ist auf jeder Seite des Bereichs
//      dieselbe, damit man ohne Umweg weiterkommt.
//   4. Volle Bildschirmbreite statt zentrierter Textspalte: die Referenz
//      braucht drei Spalten (Navigation · Beschreibung · Code).
//
// Der Marketing-Footer bleibt bewusst WEG. Er ist 400 Pixel hoch und stört
// unter einer Doku-Seite, die man scrollt; die Rechtslinks stehen in der
// Kopfzeile.
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import type { ReactNode } from "react";

import { DokuBereiche } from "@/components/entwickler/doku-bereiche";
import { DokuSidebarRahmen } from "@/components/entwickler/doku-sidebar-rahmen";
import { Logo } from "@/components/logo";
import { Icon } from "@/components/ui/icon";
import { KAPITEL_GRUPPEN } from "@/lib/entwickler-navigation";
import { API_INFO, gruppen } from "@/lib/openapi";

export default async function EntwicklerLayout({
  children,
}: {
  children: ReactNode;
}) {
  const t = await getTranslations("entwickler");

  // Nur das Nötige an die Client-Sidebar: Slug, Methode, Pfad, Titel. Die
  // 120 kB der Spec bleiben auf dem Server.
  const baum = gruppen().map((g) => ({
    name: g.name,
    endpunkte: g.endpunkte.map((e) => ({
      slug: e.slug,
      methode: e.methode,
      pfad: e.pfad,
      titel: e.titel,
    })),
  }));

  const kapitelGruppen = KAPITEL_GRUPPEN.map((g) => ({
    label: t(`gruppen.${g.labelKey}`),
    kapitel: g.kapitel.map((k) => ({
      slug: k.slug,
      label: t(`inhalt.${k.labelKey}`),
    })),
  }));

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
      {/* ── Kopfzeile ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex h-14 items-center gap-3 px-4 sm:gap-5 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <Logo heightRem={1.6} />
          </Link>
          <span className="hidden shrink-0 rounded-full bg-surface-warm px-2.5 py-0.5 font-mono text-[0.6875rem] text-muted-foreground sm:inline">
            {API_INFO.version}
          </span>

          <DokuBereiche
            leitfaden={t("bereiche.leitfaden")}
            referenz={t("bereiche.referenz")}
          />

          {/* Nebenziele erst ab `md`. Bei 390 px war diese Kopfzeile 533 px
              breit: die Seite scrollte quer und „openapi.json" wie „Zur
              Website" lagen ausserhalb des Bildschirms. Beide Ziele bleiben
              mobil erreichbar — das Logo links führt auf die Website, und
              openapi.json steht im Text der Doku-Startseite. Die zwei
              Bereichs-Reiter bleiben dagegen sichtbar: die Sidebar zeigt
              immer nur den GEÖFFNETEN Bereich, ohne die Reiter käme man vom
              Leitfaden nie zur Referenz. */}
          <div className="ml-auto hidden shrink-0 items-center gap-1 text-sm md:flex">
            <a
              href={`${API_INFO.basis}/openapi.json`}
              target="_blank"
              rel="noreferrer noopener"
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-muted-foreground transition-colors hover:bg-surface-warm hover:text-foreground"
            >
              <Icon icon="ph:code" className="size-4" />
              <span className="hidden sm:inline">openapi.json</span>
            </a>
            <Link
              href="/hilfe"
              className="hidden rounded-lg px-3 py-1.5 text-muted-foreground transition-colors hover:bg-surface-warm hover:text-foreground sm:block"
            >
              {t("kopf.hilfe")}
            </Link>
            <Link
              href="/"
              className="rounded-full bg-primary px-3.5 py-1.5 text-primary-foreground transition-opacity hover:opacity-90"
            >
              {t("kopf.zurueck")}
            </Link>
          </div>
        </div>
      </header>

      {/* ── Sidebar + Inhalt ───────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
        {/* Auf kleinen Geräten steht die Navigation oben und scrollt mit; ein
            ausklappbares Menü wäre hier der falsche Aufwand, weil eine Doku am
            Telefon ohnehin selten durchgeblättert wird. */}
        <aside className="lg:sticky lg:top-14 lg:h-[calc(100vh-3.5rem)]">
          <DokuSidebarRahmen
            kapitelGruppen={kapitelGruppen}
            gruppen={baum}
            labels={{
              sprung: t("sidebar.sprung"),
              keineTreffer: t("sidebar.keineTreffer"),
              version: t("sidebar.version"),
            }}
          />
        </aside>

        <main className="min-w-0 px-5 py-8 sm:px-8 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
