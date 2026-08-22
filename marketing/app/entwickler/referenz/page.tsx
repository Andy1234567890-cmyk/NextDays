// Einstieg in die API-Referenz: alle Endpunkte, nach Bereich gruppiert.
//
// Das Ziel des Kopfzeilen-Tabs „API-Referenz". Bei Lodgify landet man dort auf
// dem ersten Endpunkt; eine Übersicht ist besser, weil man beim ersten Besuch
// nicht weiß, was es überhaupt gibt — und weil eine Seite mit 18 Zeilen
// schneller zu überblicken ist als eine Sidebar mit acht zugeklappten Gruppen.
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { RefMethode } from "@/components/entwickler/ref-methode";
import { gruppen } from "@/lib/openapi";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("entwickler.referenzUebersicht");
  return {
    title: t("titel"),
    description: t("sub"),
    alternates: { canonical: "/entwickler/referenz" },
  };
}

export default async function ReferenzUebersicht() {
  const t = await getTranslations("entwickler.referenzUebersicht");
  const bereiche = gruppen();

  return (
    <div className="max-w-4xl pb-16">
      <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
        {t("eyebrow")}
      </p>
      <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
        {t("titel")}
      </h1>
      <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
        {t("sub")}
      </p>

      <div className="mt-10 space-y-8">
        {bereiche.map((g) => (
          <section key={g.name}>
            <h2 className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
              {g.name}
            </h2>
            <ul className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border">
              {g.endpunkte.map((e) => (
                <li key={e.slug}>
                  <Link
                    href={`/entwickler/referenz/${e.slug}`}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-surface-warm/60"
                  >
                    <RefMethode methode={e.methode} />
                    <span className="min-w-0 flex-1 truncate">{e.titel}</span>
                    <code className="hidden truncate font-mono text-xs text-muted-foreground sm:block sm:max-w-[20rem]">
                      {e.pfad}
                    </code>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
