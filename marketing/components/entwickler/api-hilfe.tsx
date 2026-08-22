// Hilfe, Änderungen, Werkzeuge.
//
// Drei Dinge, die ein Dev-Portal braucht und die beide Wettbewerber verstreut
// haben: wohin mit einer Frage, wie erfahre ich von Änderungen, was hilft beim
// Bauen. Der Änderungs-Abschnitt ist bewusst eine ZUSAGE (wie wir mit
// brechenden Änderungen umgehen) und keine leere Liste — v1 ist neu, es gibt
// noch nichts zu berichten, und eine erfundene Historie wäre eine Lüge.
import { useTranslations } from "next-intl";

import {
  DokuAbschnitt,
  DokuKopf,
  DokuListe,
  Prosa,
} from "@/components/entwickler/doku";
import { API_LINKS } from "@/content/api/referenz";
import { ANBIETER } from "@/content/legal/anbieter";

const ZUSAGEN = ["pfad", "additiv", "frist", "changelog"] as const;

export function ApiHilfe() {
  const t = useTranslations("entwickler.hilfe");

  const wege: readonly { key: string; href: string; extern: boolean }[] = [
    {
      key: "entwicklerMail",
      // Das technische Postfach steht in den Anbieterdaten (EINE Quelle) — ein
      // hier hartcodierter Mailkontakt würde beim Domainwechsel still falsch.
      href: `mailto:${ANBIETER.emailTechnik}`,
      extern: false,
    },
    { key: "hilfeCenter", href: "/hilfe", extern: false },
    { key: "schema", href: API_LINKS.schema, extern: true },
  ];

  return (
    <div className="max-w-3xl pb-16">
      <DokuKopf eyebrow={t("eyebrow")} titel={t("heading")} lead={t("sub")} />

      <DokuAbschnitt id="wege" titel={t("wege.titel")}>
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {wege.map((w) => (
            <li key={w.key}>
              <a
                href={w.href}
                {...(w.extern
                  ? { target: "_blank", rel: "noreferrer noopener" }
                  : {})}
                className="block px-4 py-3 transition-colors hover:bg-surface-warm"
              >
                <span className="block font-medium text-foreground">
                  {t(`wege.${w.key}.titel`)}
                </span>
                <span className="mt-0.5 block text-sm">
                  <Prosa>{t(`wege.${w.key}.text`)}</Prosa>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </DokuAbschnitt>

      <DokuAbschnitt id="versionen" titel={t("versionen.titel")}>
        <p>
          <Prosa>{t("versionen.text")}</Prosa>
        </p>
        <DokuListe punkte={ZUSAGEN.map((z) => t(`versionen.zusagen.${z}`))} />
      </DokuAbschnitt>
    </div>
  );
}
