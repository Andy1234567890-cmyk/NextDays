// Konventionen: Blättern, Fehler, Rate-Limits, Idempotenz.
//
// Das sind die vier Dinge, die in jeder API anders sind und die jeder
// Integrator zuerst nachschlägt. Hier stehen sie mit Zahlen und Beispielen,
// nicht als Prosa.
//
// Erklärt wird auch, WARUM etwas so ist, wo es von den Wettbewerbern abweicht:
// ein Entwickler, der Lodgify oder Hostaway kennt, sucht sonst nach Feldern,
// die es hier nicht gibt (`page`/`size`, `{"status":"success"}`).
import { useTranslations } from "next-intl";

import { CodeBlock } from "@/components/entwickler/code-block";
import { SectionHeading } from "@/components/marketing/section-kit";
import {
  BEISPIEL_BUCHUNG,
  BEISPIEL_FEHLER,
  FEHLER_CODES,
  LIMIT_HEADER,
  RATE_LIMITS,
} from "@/content/api/referenz";

export function ApiKonventionen() {
  const t = useTranslations("entwickler.konventionen");
  const tc = useTranslations("entwickler.code");

  return (
    <section id="konventionen" className="scroll-mt-24 bg-background">
      <div className="mx-auto max-w-7xl px-6 py-20">
        <SectionHeading
          eyebrow={t("eyebrow")}
          heading={t("heading")}
          sub={t("sub")}
          align="left"
        />

        <div className="mt-12 space-y-16">
          {/* -- Blättern ------------------------------------------------- */}
          <div id="blaettern" className="scroll-mt-24">
            <h3 className="font-display text-xl font-semibold">
              {t("blaettern.titel")}
            </h3>
            <p className="mt-3 max-w-3xl leading-relaxed text-muted-foreground">
              {t("blaettern.text")}
            </p>
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[34rem] text-left text-sm">
                <thead className="border-b border-border">
                  <tr>
                    <th className="py-2 pr-4 font-medium">{t("tabelle.feld")}</th>
                    <th className="py-2 font-medium">{t("tabelle.bedeutung")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {["limit", "offset", "include_total", "has_more"].map((f) => (
                    <tr key={f}>
                      <td className="py-2.5 pr-4 align-top font-mono text-xs">
                        {f}
                      </td>
                      <td className="py-2.5 text-muted-foreground">
                        {t(`blaettern.felder.${f}`)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* -- Fehler --------------------------------------------------- */}
          <div id="fehler" className="scroll-mt-24">
            <h3 className="font-display text-xl font-semibold">
              {t("fehler.titel")}
            </h3>
            <p className="mt-3 max-w-3xl leading-relaxed text-muted-foreground">
              {t("fehler.text")}
            </p>
            <div className="mt-6 grid gap-8 lg:grid-cols-2">
              <CodeBlock
                code={BEISPIEL_FEHLER}
                titel={tc("antwort")}
                kopierenLabel={tc("kopieren")}
                kopiertLabel={tc("kopiert")}
              />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[26rem] text-left text-sm">
                  <thead className="border-b border-border">
                    <tr>
                      <th className="py-2 pr-4 font-medium">
                        {t("tabelle.code")}
                      </th>
                      <th className="py-2 pr-4 font-medium">
                        {t("tabelle.status")}
                      </th>
                      <th className="py-2 font-medium">
                        {t("tabelle.bedeutung")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {FEHLER_CODES.map((f) => (
                      <tr key={f.code}>
                        <td className="py-2.5 pr-4 align-top font-mono text-xs">
                          {f.code}
                        </td>
                        <td className="py-2.5 pr-4 align-top font-mono text-xs">
                          {f.status}
                        </td>
                        <td className="py-2.5 text-muted-foreground">
                          {t(`fehler.codes.${f.key}`)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* -- Rate-Limits ---------------------------------------------- */}
          <div id="limits" className="scroll-mt-24">
            <h3 className="font-display text-xl font-semibold">
              {t("limits.titel")}
            </h3>
            <p className="mt-3 max-w-3xl leading-relaxed text-muted-foreground">
              {t("limits.text")}
            </p>
            <div className="mt-6 grid gap-6 md:grid-cols-3">
              {RATE_LIMITS.map((l) => (
                <div
                  key={l.eimer}
                  className="rounded-2xl border border-border p-5"
                >
                  <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                    {l.eimer}
                  </p>
                  <p className="mt-2 font-display text-2xl font-semibold">
                    {l.wert}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t(`limits.eimer.${l.key}`)}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-6 max-w-3xl leading-relaxed text-muted-foreground">
              {t("limits.header")}
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {[...LIMIT_HEADER, "Retry-After"].map((h) => (
                <li
                  key={h}
                  className="rounded-full bg-surface-warm px-3 py-1 font-mono text-xs"
                >
                  {h}
                </li>
              ))}
            </ul>
          </div>

          {/* -- Idempotenz ----------------------------------------------- */}
          <div id="idempotenz" className="scroll-mt-24">
            <h3 className="font-display text-xl font-semibold">
              {t("idempotenz.titel")}
            </h3>
            <p className="mt-3 max-w-3xl leading-relaxed text-muted-foreground">
              {t("idempotenz.text")}
            </p>
            <ul className="mt-4 max-w-3xl space-y-2 text-muted-foreground">
              {["wiederholung", "abweichend", "laufend"].map((k) => (
                <li key={k} className="flex gap-3">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
                  <span>{t(`idempotenz.faelle.${k}`)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 max-w-3xl">
              <CodeBlock
                code={BEISPIEL_BUCHUNG}
                titel={tc("anfrage")}
                kopierenLabel={tc("kopieren")}
                kopiertLabel={tc("kopiert")}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
