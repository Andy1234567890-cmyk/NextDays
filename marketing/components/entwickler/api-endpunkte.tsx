// Endpunkt-Übersicht mit den zugehörigen Scopes.
//
// BEWUSST eine Übersicht und keine vollständige Referenz: die Details (jeder
// Parameter, jedes Feld, jeder Beispielkörper) liefert die OpenAPI-Datei des
// Service, und die entsteht aus dem Code. Eine zweite, handgepflegte Referenz
// hier wäre binnen Wochen falsch — und zwar an der schlimmsten Stelle, weil
// Entwickler ihr glauben. Sichtbar ist deshalb, was sich selten ändert (welche
// Bereiche es gibt, welcher Scope wofür nötig ist), plus der Weg ins Schema.
import { useTranslations } from "next-intl";

import { SectionHeading } from "@/components/marketing/section-kit";
import { API_LINKS, ENDPUNKT_GRUPPEN } from "@/content/api/referenz";
import { Icon } from "@/components/ui/icon";

// Farbe je HTTP-Methode — aus den Design-Tokens, nicht aus der Tailwind-Palette:
// die Seite hat eigene Farben (`success`, `warning`, `destructive`, `accent`),
// und ein direktes `emerald-50` wäre eine zweite Palette daneben. Rein visuell;
// die Methode steht immer auch als Text da, damit sie ohne Farbe lesbar bleibt.
const METHODE_STIL: Record<string, string> = {
  GET: "bg-surface-accent text-accent",
  POST: "bg-success/10 text-success",
  PUT: "bg-warning/15 text-warning",
  PATCH: "bg-warning/15 text-warning",
  DELETE: "bg-destructive/10 text-destructive",
};

export function ApiEndpunkte() {
  const t = useTranslations("entwickler.endpunkte");

  return (
    <section id="endpunkte" className="scroll-mt-24 bg-surface-warm">
      <div className="mx-auto max-w-7xl px-6 py-20">
        <SectionHeading
          eyebrow={t("eyebrow")}
          heading={t("heading")}
          sub={t("sub")}
          align="left"
        />

        <div className="mt-12 space-y-6">
          {ENDPUNKT_GRUPPEN.map((g) => (
            <div
              key={g.key}
              className="rounded-3xl border border-border bg-background p-7"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h3 className="font-display text-lg font-semibold">
                  {t(`gruppen.${g.key}.titel`)}
                </h3>
                {g.scopes.length > 0 ? (
                  <ul className="flex flex-wrap gap-2">
                    {g.scopes.map((s) => (
                      <li
                        key={s}
                        className="rounded-full bg-surface-warm px-2.5 py-0.5 font-mono text-[0.6875rem]"
                      >
                        {s}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {t("ohneScope")}
                  </span>
                )}
              </div>
              <p className="mt-2 max-w-3xl text-muted-foreground">
                {t(`gruppen.${g.key}.text`)}
              </p>

              <ul className="mt-5 divide-y divide-border border-t border-border">
                {g.endpunkte.map((e) => (
                  <li
                    key={`${e.methode} ${e.pfad}`}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5"
                  >
                    <span
                      className={`rounded px-2 py-0.5 font-mono text-[0.6875rem] font-semibold ${
                        METHODE_STIL[e.methode] ?? "bg-surface-warm"
                      }`}
                    >
                      {e.methode}
                    </span>
                    <code className="font-mono text-sm">{e.pfad}</code>
                    <span className="text-sm text-muted-foreground">
                      {e.zweck}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-3xl border border-accent/30 bg-surface-accent p-7">
          <h3 className="font-display text-lg font-semibold">
            {t("schema.titel")}
          </h3>
          <p className="mt-2 max-w-3xl leading-relaxed">{t("schema.text")}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href={API_LINKS.konsole}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Icon icon="ph:play-circle" className="size-4" />
              {t("schema.konsole")}
            </a>
            <a
              href={API_LINKS.schema}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-5 py-2.5 text-sm transition-colors hover:bg-surface-warm"
            >
              <Icon icon="ph:code" className="size-4" />
              {t("schema.datei")}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
