// Webhooks: Ereignisse, Signatur, Wiederholungen.
//
// Der Signatur-Abschnitt ist der wichtigste der ganzen Seite: eine falsch
// geprüfte Signatur ist keine Fehlermeldung, sondern ein offener Endpunkt, an
// den jeder erfundene Buchungen schicken kann. Deshalb steht hier nicht nur das
// Verfahren, sondern fertiger Prüfcode samt der beiden Fallen (rohen Body
// verwenden, zeitkonstant vergleichen).
import { useTranslations } from "next-intl";

import { CodeBlock } from "@/components/entwickler/code-block";
import { SectionHeading } from "@/components/marketing/section-kit";
import {
  BEISPIEL_SIGNATUR_PRUEFEN,
  BEISPIEL_WEBHOOK_ANLEGEN,
  BEISPIEL_WEBHOOK_NUTZLAST,
  EREIGNISSE,
} from "@/content/api/referenz";

export function ApiWebhooks() {
  const t = useTranslations("entwickler.webhooks");
  const tc = useTranslations("entwickler.code");

  return (
    <section id="webhooks" className="scroll-mt-24 bg-background">
      <div className="mx-auto max-w-7xl px-6 py-20">
        <SectionHeading
          eyebrow={t("eyebrow")}
          heading={t("heading")}
          sub={t("sub")}
          align="left"
        />

        {/* -- Ereignis-Katalog -------------------------------------------- */}
        <div className="mt-12 overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="border-b border-border">
              <tr>
                <th className="py-2 pr-4 font-medium">{t("tabelle.ereignis")}</th>
                <th className="py-2 font-medium">{t("tabelle.wann")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {EREIGNISSE.map((e) => (
                <tr key={e.name}>
                  <td className="py-2.5 pr-4 align-top font-mono text-xs">
                    {e.name}
                  </td>
                  <td className="py-2.5 text-muted-foreground">
                    {t(`ereignisse.${e.key}`)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-2">
          <div>
            <h3 className="font-display text-xl font-semibold">
              {t("anlegen.titel")}
            </h3>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              {t("anlegen.text")}
            </p>
            <div className="mt-5">
              <CodeBlock
                code={BEISPIEL_WEBHOOK_ANLEGEN}
                titel={tc("anfrage")}
                kopierenLabel={tc("kopieren")}
                kopiertLabel={tc("kopiert")}
              />
            </div>
            <p className="mt-4 border-l-2 border-accent pl-4 text-sm font-medium">
              {t("anlegen.secret")}
            </p>
          </div>

          <div>
            <h3 className="font-display text-xl font-semibold">
              {t("nutzlast.titel")}
            </h3>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              {t("nutzlast.text")}
            </p>
            <div className="mt-5">
              <CodeBlock
                code={BEISPIEL_WEBHOOK_NUTZLAST}
                titel={tc("zustellung")}
                kopierenLabel={tc("kopieren")}
                kopiertLabel={tc("kopiert")}
              />
            </div>
          </div>
        </div>

        {/* -- Signatur ---------------------------------------------------- */}
        <div id="signatur" className="mt-16 scroll-mt-24">
          <h3 className="font-display text-xl font-semibold">
            {t("signatur.titel")}
          </h3>
          <p className="mt-3 max-w-3xl leading-relaxed text-muted-foreground">
            {t("signatur.text")}
          </p>
          <p className="mt-4 max-w-3xl rounded-xl bg-surface-warm px-4 py-3 font-mono text-sm">
            MyNextDays-Signature: t=&lt;unix-sekunden&gt;,v1=&lt;hmac-sha256&gt;
          </p>
          <ol className="mt-5 max-w-3xl space-y-2 text-muted-foreground">
            {["roh", "alter", "vergleich"].map((k) => (
              <li key={k} className="flex gap-3">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
                <span>{t(`signatur.schritte.${k}`)}</span>
              </li>
            ))}
          </ol>
          <div className="mt-6 max-w-4xl">
            <CodeBlock
              code={BEISPIEL_SIGNATUR_PRUEFEN}
              titel={tc("pruefcode")}
              kopierenLabel={tc("kopieren")}
              kopiertLabel={tc("kopiert")}
            />
          </div>
        </div>

        {/* -- Zustellverhalten -------------------------------------------- */}
        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {["wiederholung", "reihenfolge", "doppelt"].map((k) => (
            <div key={k} className="rounded-2xl border border-border p-6">
              <h4 className="font-display font-semibold">
                {t(`verhalten.${k}.titel`)}
              </h4>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {t(`verhalten.${k}.text`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
