// Schnellstart: von null zum ersten Aufruf.
//
// Drei Schritte, jeder mit dem fertigen Befehl. Referenz-UX: Hostaway und
// Lodgify brauchen für denselben Weg je vier bis sechs Kapitel-Sprünge (Zugang
// anlegen → Auth-Kapitel → Token-Endpunkt → erster Aufruf). Der häufigste
// Abbruchpunkt einer Integration ist genau dieser Weg, deshalb steht er hier
// vollständig auf einer Fläche.
import { useTranslations } from "next-intl";

import { CodeBlock } from "@/components/entwickler/code-block";
import { SectionHeading } from "@/components/marketing/section-kit";
import {
  BEISPIEL_OBJEKTE,
  BEISPIEL_OBJEKTE_ANTWORT,
  BEISPIEL_TOKEN,
  BEISPIEL_TOKEN_ANTWORT,
} from "@/content/api/referenz";
import { APP_ERREICHBAR, DASHBOARD_URL } from "@/lib/app-url";

export function ApiSchnellstart() {
  const t = useTranslations("entwickler.schnellstart");
  const tc = useTranslations("entwickler.code");

  const kopieren = tc("kopieren");
  const kopiert = tc("kopiert");

  return (
    <section id="schnellstart" className="scroll-mt-24 bg-background">
      <div className="mx-auto max-w-7xl px-6 py-20">
        <SectionHeading
          eyebrow={t("eyebrow")}
          heading={t("heading")}
          sub={t("sub")}
          align="left"
        />

        <ol className="mt-12 space-y-12">
          {/* Schritt 1 — Zugang. Ohne ihn ist alles andere sinnlos, und er ist
              der einzige Schritt, der NICHT über die API läuft. */}
          <li className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-10">
            <div>
              <span className="inline-flex size-8 items-center justify-center rounded-full bg-surface-accent font-mono text-sm text-accent">
                1
              </span>
              <h3 className="mt-4 font-display text-xl font-semibold">
                {t("schritt1.titel")}
              </h3>
              <p className="mt-2 leading-relaxed text-muted-foreground">
                {t("schritt1.text")}
              </p>
              {/* Der Pfad im Dashboard steht als Text, nicht als Link: die
                  Adresse hängt an NEXT_PUBLIC_APP_URL, und solange die leer ist,
                  wäre ein Link ein toter Link. */}
              <p className="mt-3 rounded-xl bg-surface-warm px-4 py-3 text-sm">
                {APP_ERREICHBAR ? (
                  <a
                    href={`${DASHBOARD_URL}/konto/api-zugang`}
                    className="font-medium text-accent underline-offset-4 hover:underline"
                  >
                    {t("schritt1.pfad")}
                  </a>
                ) : (
                  <span className="font-medium">{t("schritt1.pfad")}</span>
                )}
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                {t("schritt1.hinweis")}
              </p>
            </div>
            <div />
          </li>

          {/* Schritt 2 — Token. */}
          <li className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-10">
            <div>
              <span className="inline-flex size-8 items-center justify-center rounded-full bg-surface-accent font-mono text-sm text-accent">
                2
              </span>
              <h3 className="mt-4 font-display text-xl font-semibold">
                {t("schritt2.titel")}
              </h3>
              <p className="mt-2 leading-relaxed text-muted-foreground">
                {t("schritt2.text")}
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                {t("schritt2.hinweis")}
              </p>
            </div>
            <div className="space-y-4">
              <CodeBlock
                code={BEISPIEL_TOKEN}
                titel={tc("anfrage")}
                kopierenLabel={kopieren}
                kopiertLabel={kopiert}
              />
              <CodeBlock
                code={BEISPIEL_TOKEN_ANTWORT}
                titel={tc("antwort")}
                kopierenLabel={kopieren}
                kopiertLabel={kopiert}
              />
            </div>
          </li>

          {/* Schritt 3 — erster echter Aufruf. */}
          <li className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-10">
            <div>
              <span className="inline-flex size-8 items-center justify-center rounded-full bg-surface-accent font-mono text-sm text-accent">
                3
              </span>
              <h3 className="mt-4 font-display text-xl font-semibold">
                {t("schritt3.titel")}
              </h3>
              <p className="mt-2 leading-relaxed text-muted-foreground">
                {t("schritt3.text")}
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                {t("schritt3.hinweis")}
              </p>
            </div>
            <div className="space-y-4">
              <CodeBlock
                code={BEISPIEL_OBJEKTE}
                titel={tc("anfrage")}
                kopierenLabel={kopieren}
                kopiertLabel={kopiert}
              />
              <CodeBlock
                code={BEISPIEL_OBJEKTE_ANTWORT}
                titel={tc("antwort")}
                kopierenLabel={kopieren}
                kopiertLabel={kopiert}
              />
            </div>
          </li>
        </ol>
      </div>
    </section>
  );
}
