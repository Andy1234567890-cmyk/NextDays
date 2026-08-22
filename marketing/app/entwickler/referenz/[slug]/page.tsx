// Eine Seite je Endpunkt — der Kern der Referenz.
//
// Aufbau wie docs.lodgify.com/reference/<operation> (live 22.08.2026):
//   Überschrift = der Zweck des Endpunkts
//   darunter Methoden-Abzeichen + die VOLLE Adresse (kopierbar)
//   Beschreibung
//   Pfad- / Query- / Header-Parameter mit Typ, Pflicht, Standard, erlaubten
//   Werten — und einem Eingabefeld je Parameter
//   Anfrage-Körper und Antworten als Feldbaum
//   rechts: Sprachwahl, Zugang, fertiger Code, „Ausprobieren", Antwort
//
// Jeder Endpunkt hat eine eigene Adresse (`/entwickler/referenz/<slug>`), damit
// man ihn verlinken kann — der Grund, warum die Referenz nicht eine einzige
// lange Seite ist.
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { Prosa } from "@/components/entwickler/doku";
import { RefKonsole } from "@/components/entwickler/ref-konsole";
import { RefMethode } from "@/components/entwickler/ref-methode";
import { RefSchema } from "@/components/entwickler/ref-schema";
import { API_INFO, alleEndpunkte, endpunktMitSlug } from "@/lib/openapi";

import type { Metadata } from "next";

export function generateStaticParams() {
  return alleEndpunkte().map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const endpunkt = endpunktMitSlug(slug);
  if (!endpunkt) return {};
  return {
    // Titel wie in der Sidebar plus Methode und Pfad: so ist ein Suchtreffer
    // ohne Klick einzuordnen.
    title: `${endpunkt.titel} — ${endpunkt.methode.toUpperCase()} ${endpunkt.pfad}`,
    description: endpunkt.beschreibung?.split("\n")[0],
    alternates: { canonical: `/entwickler/referenz/${endpunkt.slug}` },
  };
}

export default async function EndpunktSeite({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const endpunkt = endpunktMitSlug(slug);
  if (!endpunkt) notFound();

  const t = await getTranslations("entwickler.referenz");
  // Dieselben drei Beschriftungen im ganzen Feldbaum — einmal gelesen,
  // überall durchgegeben.
  const schemaLabels = {
    pflicht: t("pflicht"),
    standard: t("standard"),
    erlaubt: t("erlaubt"),
  };

  const kopf = (
    <header>
        <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
          {endpunkt.gruppe}
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
          {endpunkt.titel}
        </h1>

        {/* Methode + volle Adresse. Waagerecht scrollbar, damit ein langer Pfad
            die Seite nicht breiter macht. */}
        <div className="mt-4 flex items-center gap-3 overflow-x-auto rounded-xl border border-border bg-surface-warm/60 px-3 py-2.5">
          <RefMethode methode={endpunkt.methode} gross />
          <code className="whitespace-nowrap font-mono text-sm">{endpunkt.url}</code>
        </div>

        {endpunkt.scopes.length ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">{t("scope")}</span>
            {endpunkt.scopes.map((s) => (
              <code
                key={s}
                className="rounded-full bg-surface-accent px-2 py-0.5 font-mono text-[0.6875rem] text-accent"
              >
                {s}
              </code>
            ))}
          </div>
        ) : null}

        {endpunkt.beschreibung ? (
          <div className="mt-5 max-w-3xl space-y-3 leading-relaxed text-muted-foreground">
            {endpunkt.beschreibung.split("\n\n").map((absatz, i) => (
              <p key={i} className="whitespace-pre-line">
                <Prosa>{absatz}</Prosa>
              </p>
            ))}
          </div>
        ) : null}
    </header>
  );

  return (
    <article className="pb-16">
      <RefKonsole
        endpunkt={endpunkt}
        basis={API_INFO.basis}
        kopf={kopf}
        labels={{
          pfadParameter: t("pfadParameter"),
          queryParameter: t("queryParameter"),
          headerParameter: t("headerParameter"),
          koerper: t("koerper"),
          antworten: t("antworten"),
          erlaubt: t("erlaubt"),
          pflicht: t("pflicht"),
          standard: t("standard"),
          sprache: t("sprache"),
          zugang: t("zugang"),
          tokenHinweis: t("tokenHinweis"),
          ausprobieren: t("ausprobieren"),
          laeuft: t("laeuft"),
          anfrage: t("anfrage"),
          antwort: t("antwort"),
          beispiel: t("beispiel"),
          kopieren: t("kopieren"),
          kopiert: t("kopiert"),
          fehlerNetz: t("fehlerNetz"),
          keinToken: t("keinToken"),
        }}
      >
        {/* Server-gerendert und als `children` hereingegeben: der Feldbaum
            bleibt damit auf dem Server und ist ohne JavaScript lesbar. */}
        {endpunkt.koerper ? (
          <section className="mt-8">
            <h2 className="font-display text-lg font-semibold">
              {t("koerper")}
              {endpunkt.koerperPflicht ? (
                <span className="ml-2 font-mono text-xs font-semibold text-destructive">
                  {t("pflicht")}
                </span>
              ) : null}
            </h2>
            <div className="mt-2">
              <RefSchema schema={endpunkt.koerper} labels={schemaLabels} />
            </div>
          </section>
        ) : null}

        <section className="mt-8">
          <h2 className="font-display text-lg font-semibold">{t("antworten")}</h2>
          <div className="mt-3 space-y-4">
            {endpunkt.antworten.map((a) => (
              <div key={a.code} className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span
                    className={
                      "rounded px-1.5 py-0.5 font-mono text-xs font-semibold " +
                      (Number(a.code) < 400
                        ? "bg-success/10 text-success"
                        : "bg-destructive/10 text-destructive")
                    }
                  >
                    {a.code}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {a.beschreibung}
                  </span>
                </div>
                {a.schema ? (
                  <div className="mt-3">
                    <RefSchema schema={a.schema} labels={schemaLabels} />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      </RefKonsole>
    </article>
  );
}
