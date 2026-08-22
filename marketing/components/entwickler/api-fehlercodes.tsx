// Anhang: die vollständige Liste der `code`-Werte.
//
// Eigene Seite, weil die `type`-Adresse JEDER Fehlerantwort hierher zeigt
// (`…/entwickler/fehlercodes#fehler-<code>`, Unterstriche als Bindestriche).
// Eine Tabelle mitten in einem längeren Kapitel wäre für diesen Sprung die
// falsche Adresse — RFC 9457 verlangt eine Seite, die den Fehlertyp beschreibt,
// und der Leser landet dann auf seiner Zeile statt am Seitenanfang.
import { useTranslations } from "next-intl";

import {
  DokuKopf,
  DokuTabelle,
  Prosa,
} from "@/components/entwickler/doku";
import { FEHLER_CODES } from "@/content/api/referenz";

export function ApiFehlercodes() {
  const t = useTranslations("entwickler.fehlercodes");
  const tk = useTranslations("entwickler.konventionen");

  return (
    <div className="max-w-3xl pb-16">
      <DokuKopf eyebrow={t("eyebrow")} titel={t("heading")} lead={t("sub")} />
      <div className="mt-8">
        <DokuTabelle
          kopf={[
            tk("tabelle.code"),
            tk("tabelle.status"),
            tk("tabelle.bedeutung"),
          ]}
        >
          {FEHLER_CODES.map((f) => (
            <tr
              key={f.code}
              id={`fehler-${f.code.replace(/_/g, "-")}`}
              className="scroll-mt-24 target:bg-surface-accent"
            >
              <td className="py-2.5 pr-4 align-top font-mono text-xs text-foreground">
                {f.code}
              </td>
              <td className="py-2.5 pr-4 align-top font-mono text-xs">
                {f.status}
              </td>
              <td className="py-2.5 text-muted-foreground">
                <Prosa>{tk(`fehler.codes.${f.key}`)}</Prosa>
              </td>
            </tr>
          ))}
        </DokuTabelle>
      </div>
    </div>
  );
}
