// Zugang und Rechte — bei Lodgify „Authorization", die zweite Seite des
// Leitfadens.
//
// Eigene Seite und nicht ein Absatz im Schnellstart, weil hier drei Dinge
// zusammenkommen, die man später einzeln nachschlägt: der Token-Ablauf, die
// Rechte je Zugang und die Beschränkung auf einzelne Objekte.
import { useTranslations } from "next-intl";

import { CodeBlock } from "@/components/entwickler/code-block";
import {
  DokuAbschnitt,
  DokuKopf,
  DokuListe,
  Merksatz,
  Prosa,
} from "@/components/entwickler/doku";
import { BEISPIEL_TOKEN, BEISPIEL_TOKEN_ANTWORT } from "@/content/api/referenz";
import { alleEndpunkte } from "@/lib/openapi";

export function ApiZugang() {
  const t = useTranslations("entwickler.zugang");
  const tc = useTranslations("entwickler.code");

  // Die Rechte-Liste kommt aus der Spezifikation, nicht aus einer gepflegten
  // Aufzählung: ein neuer Endpunkt mit neuem Scope erscheint damit von selbst.
  const scopes = Array.from(
    new Set(alleEndpunkte().flatMap((e) => e.scopes)),
  ).sort();

  return (
    <div className="max-w-3xl pb-16">
      <DokuKopf eyebrow={t("eyebrow")} titel={t("heading")} lead={t("sub")} />

      <DokuAbschnitt id="ablauf" titel={t("ablauf.titel")}>
        <p>
          <Prosa>{t("ablauf.text")}</Prosa>
        </p>
        <DokuListe
          punkte={["anlegen", "tauschen", "senden"].map((k) =>
            t(`ablauf.schritte.${k}`),
          )}
        />
        <CodeBlock
          code={BEISPIEL_TOKEN}
          titel={tc("anfrage")}
          kopierenLabel={tc("kopieren")}
          kopiertLabel={tc("kopiert")}
        />
        <CodeBlock
          code={BEISPIEL_TOKEN_ANTWORT}
          titel={tc("antwort")}
          kopierenLabel={tc("kopieren")}
          kopiertLabel={tc("kopiert")}
        />
        <Merksatz>
          <Prosa>{t("ablauf.merksatz")}</Prosa>
        </Merksatz>
      </DokuAbschnitt>

      <DokuAbschnitt id="rechte" titel={t("rechte.titel")}>
        <p>
          <Prosa>{t("rechte.text")}</Prosa>
        </p>
        <ul className="flex flex-wrap gap-2">
          {scopes.map((s) => (
            <li
              key={s}
              className="rounded-full bg-surface-warm px-3 py-1 font-mono text-xs"
            >
              {s}
            </li>
          ))}
        </ul>
        <Merksatz>
          <Prosa>{t("rechte.merksatz")}</Prosa>
        </Merksatz>
      </DokuAbschnitt>

      <DokuAbschnitt id="objekte" titel={t("objekte.titel")}>
        <p>
          <Prosa>{t("objekte.text")}</Prosa>
        </p>
      </DokuAbschnitt>

      <DokuAbschnitt id="selbstauskunft" titel={t("selbstauskunft.titel")}>
        <p>
          <Prosa>{t("selbstauskunft.text")}</Prosa>
        </p>
      </DokuAbschnitt>
    </div>
  );
}
