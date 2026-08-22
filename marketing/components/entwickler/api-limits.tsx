// Ratenbegrenzung — eigene Seite, wie bei Lodgify („Rate limits").
//
// Die drei Eimer und ihre Werte stehen in `content/api/referenz.ts`, damit die
// Zahlen an einer Stelle stehen und nicht in einem Übersetzungstext, in dem sie
// 24-mal veralten können.
import { useTranslations } from "next-intl";

import {
  DokuAbschnitt,
  DokuKopf,
  DokuTabelle,
  Prosa,
} from "@/components/entwickler/doku";
import { LIMIT_HEADER, RATE_LIMITS } from "@/content/api/referenz";

export function ApiLimits() {
  const t = useTranslations("entwickler.limits");
  const tk = useTranslations("entwickler.konventionen");

  return (
    <div className="max-w-3xl pb-16">
      <DokuKopf eyebrow={t("eyebrow")} titel={t("heading")} lead={t("sub")} />

      <DokuAbschnitt id="eimer" titel={tk("limits.titel")}>
        <p>
          <Prosa>{tk("limits.text")}</Prosa>
        </p>
        <DokuTabelle kopf={[tk("tabelle.feld"), tk("tabelle.bedeutung")]}>
          {RATE_LIMITS.map((l) => (
            <tr key={l.eimer}>
              <td className="py-2.5 pr-4 align-top font-mono text-xs text-foreground">
                {l.eimer}
                <span className="ml-2 font-sans text-muted-foreground">
                  {l.wert}
                </span>
              </td>
              <td className="py-2.5">
                <Prosa>{tk(`limits.eimer.${l.key}`)}</Prosa>
              </td>
            </tr>
          ))}
        </DokuTabelle>
      </DokuAbschnitt>

      <DokuAbschnitt id="header" titel={tk("tabelle.feld")}>
        <p>
          <Prosa>{tk("limits.header")}</Prosa>
        </p>
        <ul className="flex flex-wrap gap-2">
          {[...LIMIT_HEADER, "Retry-After"].map((h) => (
            <li
              key={h}
              className="rounded-full bg-surface-warm px-3 py-1 font-mono text-xs"
            >
              {h}
            </li>
          ))}
        </ul>
      </DokuAbschnitt>
    </div>
  );
}
