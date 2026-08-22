// Fehler — bei Lodgify eine eigene Leitfaden-Seite, und zu Recht: wie eine API
// scheitert, schlägt man häufiger nach als wie sie gelingt.
//
// Die Liste der Codes steht NICHT hier, sondern im Anhang („Fehlercodes"). So
// erklärt diese Seite den Aufbau, und die Nachschlagetabelle bleibt eine Seite,
// auf die die `type`-Adresse jeder Fehlerantwort zeigen kann.
import { useTranslations } from "next-intl";

import { CodeBlock } from "@/components/entwickler/code-block";
import {
  DokuAbschnitt,
  DokuKopf,
  DokuListe,
  DokuTabelle,
  Merksatz,
  Prosa,
} from "@/components/entwickler/doku";
import { BEISPIEL_FEHLER } from "@/content/api/referenz";

const FELDER = [
  "type",
  "title",
  "status",
  "detail",
  "code",
  "request_id",
] as const;

export function ApiFehler() {
  const t = useTranslations("entwickler.fehler");
  const tk = useTranslations("entwickler.konventionen");
  const tc = useTranslations("entwickler.code");

  return (
    <div className="max-w-3xl pb-16">
      <DokuKopf eyebrow={t("eyebrow")} titel={t("heading")} lead={t("sub")} />

      <DokuAbschnitt id="aufbau" titel={t("aufbau.titel")}>
        <p>
          <Prosa>{t("aufbau.text")}</Prosa>
        </p>
        <CodeBlock
          code={BEISPIEL_FEHLER}
          titel={tc("antwort")}
          kopierenLabel={tc("kopieren")}
          kopiertLabel={tc("kopiert")}
        />
        <DokuTabelle kopf={[tk("tabelle.feld"), tk("tabelle.bedeutung")]}>
          {FELDER.map((f) => (
            <tr key={f}>
              <td className="py-2.5 pr-4 align-top font-mono text-xs text-foreground">
                {f}
              </td>
              <td className="py-2.5">
                <Prosa>{t(`aufbau.felder.${f}`)}</Prosa>
              </td>
            </tr>
          ))}
        </DokuTabelle>
        <Merksatz>
          <Prosa>{t("aufbau.merksatz")}</Prosa>
        </Merksatz>
      </DokuAbschnitt>

      <DokuAbschnitt id="klassen" titel={t("klassen.titel")}>
        <DokuListe
          punkte={["vier", "fuenf", "neun"].map((k) => t(`klassen.${k}`))}
        />
      </DokuAbschnitt>
    </div>
  );
}
