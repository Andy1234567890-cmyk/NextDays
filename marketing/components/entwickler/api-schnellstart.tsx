// Schnellstart: von null zum ersten Aufruf.
//
// Drei Schritte, jeder mit dem fertigen Befehl. Referenz-UX: Hostaway und
// Lodgify brauchen für denselben Weg je vier bis sechs Kapitel-Sprünge (Zugang
// anlegen → Auth-Kapitel → Token-Endpunkt → erster Aufruf). Der häufigste
// Abbruchpunkt einer Integration ist genau dieser Weg, deshalb steht er hier
// vollständig auf einer Seite — als numerierte Abschnitte, nicht als Karten.
import { useTranslations } from "next-intl";

import { CodeBlock } from "@/components/entwickler/code-block";
import { DokuAbschnitt, DokuKopf, Prosa } from "@/components/entwickler/doku";
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
    <div className="max-w-3xl pb-16">
      <DokuKopf eyebrow={t("eyebrow")} titel={t("heading")} lead={t("sub")} />

      {/* Schritt 1 — Zugang. Ohne ihn ist alles andere sinnlos, und er ist der
          einzige Schritt, der NICHT über die API läuft. */}
      <DokuAbschnitt id="zugang" titel={`1 · ${t("schritt1.titel")}`}>
        <p>
          <Prosa>{t("schritt1.text")}</Prosa>
        </p>
        {/* Der Pfad im Dashboard steht als Text, nicht als Link, solange
            NEXT_PUBLIC_APP_URL leer ist — sonst wäre es ein toter Link. */}
        <p className="rounded-lg bg-surface-warm px-4 py-2.5 text-sm">
          {APP_ERREICHBAR ? (
            <a
              href={`${DASHBOARD_URL}/konto/api-zugang`}
              className="font-medium text-accent underline-offset-4 hover:underline"
            >
              {t("schritt1.pfad")}
            </a>
          ) : (
            <span className="font-medium text-foreground">{t("schritt1.pfad")}</span>
          )}
        </p>
        <p className="text-sm">
          <Prosa>{t("schritt1.hinweis")}</Prosa>
        </p>
      </DokuAbschnitt>

      <DokuAbschnitt id="token" titel={`2 · ${t("schritt2.titel")}`}>
        <p>
          <Prosa>{t("schritt2.text")}</Prosa>
        </p>
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
        <p className="text-sm">
          <Prosa>{t("schritt2.hinweis")}</Prosa>
        </p>
      </DokuAbschnitt>

      <DokuAbschnitt id="erster-aufruf" titel={`3 · ${t("schritt3.titel")}`}>
        <p>
          <Prosa>{t("schritt3.text")}</Prosa>
        </p>
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
        <p className="text-sm">
          <Prosa>{t("schritt3.hinweis")}</Prosa>
        </p>
      </DokuAbschnitt>
    </div>
  );
}
