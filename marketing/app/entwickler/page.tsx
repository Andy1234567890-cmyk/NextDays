// Startseite des Leitfadens (/entwickler) — bei Lodgify „Getting started".
//
// Sie ist bewusst KURZ: was diese API ist, die Basis-Adresse, das Schema, und
// der Weg weiter. Die Endpunktliste steht nicht mehr hier, sondern im zweiten
// Bereich („API-Referenz") — man liest oder man schlägt nach.
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { DokuWeiter } from "@/components/entwickler/doku-weiter";
import { Icon } from "@/components/ui/icon";
import {
  KAPITEL_GRUPPEN,
  kapitelPfad,
  naechstesKapitel,
} from "@/lib/entwickler-navigation";
import { API_INFO, alleEndpunkte } from "@/lib/openapi";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("entwickler.meta");
  return {
    title: t("titel"),
    description: t("beschreibung"),
    alternates: { canonical: "/entwickler" },
  };
}

export default async function EntwicklerStartSeite() {
  const t = await getTranslations("entwickler");
  const anzahl = alleEndpunkte().length;
  const naechstes = naechstesKapitel("start");

  return (
    <div className="max-w-3xl pb-16">
      <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
        {t("start.eyebrow")}
      </p>
      <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
        {t("start.titel")}
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
        {t("start.unterzeile")}
      </p>

      {/* Die drei Angaben, die man zuerst braucht — als Monospace, weil sie ein
          Vertrag sind und kein Fließtext. */}
      <dl className="mt-8 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface-warm/50 px-4 py-3">
          <dt className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">
            {t("start.basisLabel")}
          </dt>
          <dd className="mt-1 break-all font-mono text-sm">{API_INFO.basis}</dd>
        </div>
        <div className="rounded-xl border border-border bg-surface-warm/50 px-4 py-3">
          <dt className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">
            {t("start.versionLabel")}
          </dt>
          <dd className="mt-1 font-mono text-sm">
            v1 · {t("start.versionHinweis")}
          </dd>
        </div>
        <a
          href={`${API_INFO.basis}/openapi.json`}
          target="_blank"
          rel="noreferrer noopener"
          className="group rounded-xl border border-border bg-surface-warm/50 px-4 py-3 transition-colors hover:border-accent"
        >
          <dt className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">
            {t("start.schemaTitel")}
          </dt>
          <dd className="mt-1 flex items-center gap-1.5 font-mono text-sm text-accent">
            openapi.json
            <Icon
              icon="ph:arrow-up-right"
              className="size-3.5 transition-transform group-hover:translate-x-0.5"
            />
          </dd>
        </a>
      </dl>
      <p className="mt-2 text-xs text-muted-foreground">{t("start.schemaText")}</p>

      {/* Der Leseweg als Ganzes — dieselben Gruppen wie in der Sidebar, damit
          man einmal sieht, was es überhaupt gibt. */}
      {KAPITEL_GRUPPEN.map((gruppe) => (
        <section key={gruppe.labelKey} className="mt-10">
          <h2 className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
            {t(`gruppen.${gruppe.labelKey}`)}
          </h2>
          <ul className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border">
            {gruppe.kapitel
              .filter((k) => k.slug)
              .map((k) => (
                <li key={k.slug}>
                  <Link
                    href={kapitelPfad(k.slug)}
                    className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm transition-colors hover:bg-surface-warm/60"
                  >
                    {t(`inhalt.${k.labelKey}`)}
                    <Icon
                      icon="ph:arrow-right"
                      className="size-4 shrink-0 text-muted-foreground"
                    />
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      ))}

      <section className="mt-10">
        <Link
          href="/entwickler/referenz"
          className="group flex items-center justify-between gap-4 rounded-xl border border-border px-5 py-4 transition-colors hover:border-accent hover:bg-surface-warm/50"
        >
          <span>
            <span className="block text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("bereiche.referenz")}
            </span>
            <span className="mt-0.5 block font-medium">
              {t("referenzUebersicht.titel")}
            </span>
          </span>
          <span className="flex items-center gap-2 font-mono text-sm text-muted-foreground">
            {anzahl}
            <Icon
              icon="ph:arrow-right"
              className="size-5 transition-transform group-hover:translate-x-0.5"
            />
          </span>
        </Link>
      </section>

      {naechstes ? (
        <DokuWeiter
          label={t("weiter.naechste")}
          titel={t(`inhalt.${naechstes.labelKey}`)}
          href={kapitelPfad(naechstes.slug)}
        />
      ) : null}
    </div>
  );
}
