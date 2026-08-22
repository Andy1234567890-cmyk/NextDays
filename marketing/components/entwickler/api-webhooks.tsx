// Webhooks: Ereignisse, Signatur, Wiederholungen.
//
// Der Signatur-Abschnitt ist der wichtigste des Leitfadens: eine falsch
// geprüfte Signatur ist keine Fehlermeldung, sondern ein offener Endpunkt, an
// den jeder erfundene Buchungen schicken kann. Deshalb steht hier nicht nur das
// Verfahren, sondern fertiger Prüfcode samt der beiden Fallen (rohen Body
// verwenden, zeitkonstant vergleichen).
import { useTranslations } from "next-intl";

import { CodeBlock } from "@/components/entwickler/code-block";
import {
  DokuAbschnitt,
  DokuKopf,
  DokuListe,
  DokuTabelle,
  DokuTitel,
  Merksatz,
  Prosa,
} from "@/components/entwickler/doku";
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
    <div className="max-w-3xl pb-16">
      <DokuKopf eyebrow={t("eyebrow")} titel={t("heading")} lead={t("sub")} />

      <DokuAbschnitt id="katalog" titel={t("tabelle.ereignis")}>
        <DokuTabelle kopf={[t("tabelle.ereignis"), t("tabelle.wann")]}>
          {EREIGNISSE.map((e) => (
            <tr key={e.name}>
              <td className="py-2.5 pr-4 align-top font-mono text-xs text-foreground">
                {e.name}
              </td>
              <td className="py-2.5">
                <Prosa>{t(`ereignisse.${e.key}`)}</Prosa>
              </td>
            </tr>
          ))}
        </DokuTabelle>
      </DokuAbschnitt>

      <DokuAbschnitt id="anlegen" titel={t("anlegen.titel")}>
        <p>
          <Prosa>{t("anlegen.text")}</Prosa>
        </p>
        <CodeBlock
          code={BEISPIEL_WEBHOOK_ANLEGEN}
          titel={tc("anfrage")}
          kopierenLabel={tc("kopieren")}
          kopiertLabel={tc("kopiert")}
        />
        <Merksatz>
          <Prosa>{t("anlegen.secret")}</Prosa>
        </Merksatz>
      </DokuAbschnitt>

      <DokuAbschnitt id="nutzlast" titel={t("nutzlast.titel")}>
        <p>
          <Prosa>{t("nutzlast.text")}</Prosa>
        </p>
        <CodeBlock
          code={BEISPIEL_WEBHOOK_NUTZLAST}
          titel={tc("zustellung")}
          kopierenLabel={tc("kopieren")}
          kopiertLabel={tc("kopiert")}
        />
      </DokuAbschnitt>

      <DokuAbschnitt id="signatur" titel={t("signatur.titel")}>
        <p>
          <Prosa>{t("signatur.text")}</Prosa>
        </p>
        <p className="rounded-lg bg-surface-warm px-4 py-2.5 font-mono text-sm text-foreground">
          MyNextDays-Signature: t=&lt;unix-sekunden&gt;,v1=&lt;hmac-sha256&gt;
        </p>
        <DokuListe
          punkte={["roh", "alter", "vergleich"].map((k) =>
            t(`signatur.schritte.${k}`),
          )}
        />
        <CodeBlock
          code={BEISPIEL_SIGNATUR_PRUEFEN}
          titel={tc("pruefcode")}
          kopierenLabel={tc("kopieren")}
          kopiertLabel={tc("kopiert")}
        />
      </DokuAbschnitt>

      {/* „nachholen" steht bewusst hier und nicht in einer Fußnote: es ist die
          Antwort auf die Frage, die jeden Integrator irgendwann trifft („mein
          Server war zwei Stunden weg — was jetzt?"). Ohne sie ist der
          Abruf-Endpunkt für Kunden unsichtbar. */}
      <DokuAbschnitt id="zustellung" titel={t("verhalten.wiederholung.titel")}>
        {(["wiederholung", "reihenfolge", "doppelt", "nachholen"] as const).map(
          (k) => (
            <div key={k}>
              <DokuTitel>{t(`verhalten.${k}.titel`)}</DokuTitel>
              <p className="mt-1.5">
                <Prosa>{t(`verhalten.${k}.text`)}</Prosa>
              </p>
            </div>
          ),
        )}
      </DokuAbschnitt>
    </div>
  );
}
