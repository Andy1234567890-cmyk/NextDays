// Konventionen: Blättern und Idempotenz.
//
// Fehler und Ratenbegrenzung haben eigene Seiten — wie bei Lodgify, wo
// „Errors" und „Rate limits" nebeneinander im Leitfaden stehen. Hier bleiben
// die zwei Regeln, die jede Liste und jeden Schreibaufruf betreffen.
//
// Erklärt wird auch, WARUM etwas so ist, wo es von den Wettbewerbern abweicht:
// ein Entwickler, der Lodgify oder Hostaway kennt, sucht sonst nach Feldern,
// die es hier nicht gibt (`page`/`size`, `{"status":"success"}`).
import { useTranslations } from "next-intl";

import { CodeBlock } from "@/components/entwickler/code-block";
import {
  DokuAbschnitt,
  DokuKopf,
  DokuListe,
  DokuTabelle,
  Prosa,
} from "@/components/entwickler/doku";
import { BEISPIEL_BLAETTERN, BEISPIEL_BUCHUNG } from "@/content/api/referenz";

/** Reihenfolge = Empfehlung: der Cursor zuerst, Offset danach. */
const BLAETTER_FELDER = [
  "starting_after",
  "next_starting_after",
  "limit",
  "offset",
  "include_total",
  "has_more",
] as const;

export function ApiKonventionen() {
  const t = useTranslations("entwickler.konventionen");
  const tc = useTranslations("entwickler.code");

  return (
    <div className="max-w-3xl pb-16">
      <DokuKopf eyebrow={t("eyebrow")} titel={t("heading")} lead={t("sub")} />

      <DokuAbschnitt id="blaettern" titel={t("blaettern.titel")}>
        <p>
          <Prosa>{t("blaettern.text")}</Prosa>
        </p>
        <DokuTabelle kopf={[t("tabelle.feld"), t("tabelle.bedeutung")]}>
          {BLAETTER_FELDER.map((f) => (
            <tr key={f}>
              <td className="py-2.5 pr-4 align-top font-mono text-xs text-foreground">
                {f}
              </td>
              <td className="py-2.5">
                <Prosa>{t(`blaettern.felder.${f}`)}</Prosa>
              </td>
            </tr>
          ))}
        </DokuTabelle>
        <p>
          <Prosa>{t("blaettern.warumCursor")}</Prosa>
        </p>
        <CodeBlock
          code={BEISPIEL_BLAETTERN}
          titel={tc("anfrage")}
          kopierenLabel={tc("kopieren")}
          kopiertLabel={tc("kopiert")}
        />
      </DokuAbschnitt>

      <DokuAbschnitt id="idempotenz" titel={t("idempotenz.titel")}>
        <p>
          <Prosa>{t("idempotenz.text")}</Prosa>
        </p>
        <DokuListe
          punkte={["wiederholung", "abweichend", "laufend"].map((k) =>
            t(`idempotenz.faelle.${k}`),
          )}
        />
        <CodeBlock
          code={BEISPIEL_BUCHUNG}
          titel={tc("anfrage")}
          kopierenLabel={tc("kopieren")}
          kopiertLabel={tc("kopiert")}
        />
      </DokuAbschnitt>
    </div>
  );
}
