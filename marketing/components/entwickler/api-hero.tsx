// Kopf der Entwickler-Dokumentation.
//
// Referenz-UX (live abgelesen 21.08.2026): docs.lodgify.com und
// api.hostaway.com/documentation beginnen beide mit derselben Dramaturgie —
// eine Zeile, was die API ist, dann SOFORT die Basis-Adresse und der Weg zum
// Schlüssel. Kein Marketing-Vorspann; wer hier landet, will anfangen.
//
// Übernommen ist diese Kürze. Nicht übernommen: Lodgify versteckt die
// Basis-Adresse in einem Fließtext-Absatz und Hostaway nennt sie erst im
// Auth-Kapitel. Sie steht hier im Kopf, kopierbar.
import { useTranslations } from "next-intl";

import { API_BASIS, API_LINKS, API_VERSION } from "@/content/api/referenz";
import { Icon } from "@/components/ui/icon";

export function ApiHero() {
  const t = useTranslations("entwickler.hero");

  return (
    <section className="bg-primary text-primary-foreground">
      <div className="mx-auto max-w-7xl px-6 py-20 sm:py-24">
        <p className="eyebrow text-primary-foreground/60">{t("eyebrow")}</p>
        <h1 className="mt-4 max-w-3xl font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          {t("titel")}
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-primary-foreground/75">
          {t("unterzeile")}
        </p>

        {/* Basis-Adresse und Version: die zwei Angaben, die jeder zuerst
            braucht. Als Monospace, damit sie als Vertrag lesbar sind. */}
        <dl className="mt-10 grid gap-4 sm:grid-cols-2 lg:max-w-2xl">
          <div className="rounded-2xl border border-primary-foreground/20 px-5 py-4">
            <dt className="text-xs uppercase tracking-wide text-primary-foreground/55">
              {t("basisLabel")}
            </dt>
            <dd className="mt-1 break-all font-mono text-sm">{API_BASIS}</dd>
          </div>
          <div className="rounded-2xl border border-primary-foreground/20 px-5 py-4">
            <dt className="text-xs uppercase tracking-wide text-primary-foreground/55">
              {t("versionLabel")}
            </dt>
            <dd className="mt-1 font-mono text-sm">
              {API_VERSION} · {t("versionHinweis")}
            </dd>
          </div>
        </dl>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <a
            href={API_LINKS.konsole}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-2 rounded-full bg-primary-foreground px-5 py-2.5 text-sm font-medium text-primary transition-opacity hover:opacity-90"
          >
            <Icon icon="ph:play-circle" className="size-4" />
            {t("konsole")}
          </a>
          <a
            href={API_LINKS.schema}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/30 px-5 py-2.5 text-sm transition-colors hover:bg-primary-foreground/10"
          >
            <Icon icon="ph:code" className="size-4" />
            {t("schema")}
          </a>
          <a
            href={API_LINKS.referenz}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/30 px-5 py-2.5 text-sm transition-colors hover:bg-primary-foreground/10"
          >
            <Icon icon="ph:book-open" className="size-4" />
            {t("referenz")}
          </a>
        </div>
      </div>
    </section>
  );
}
