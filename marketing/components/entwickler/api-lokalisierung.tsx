// Anhang: Sprachen und Währungen — bei Lodgify „Localization".
//
// Bei ihnen geht es um Sprachcodes in Inhalten; bei uns zusätzlich um die
// Währung, weil sie in dieser API nie erfunden wird. Genau das erwartet ein
// Integrator an dieser Stelle nicht, und genau deshalb steht es hier.
import { useTranslations } from "next-intl";

import {
  DokuAbschnitt,
  DokuKopf,
  Merksatz,
  Prosa,
} from "@/components/entwickler/doku";

export function ApiLokalisierung() {
  const t = useTranslations("entwickler.lokalisierung");

  return (
    <div className="max-w-3xl pb-16">
      <DokuKopf eyebrow={t("eyebrow")} titel={t("heading")} lead={t("sub")} />

      <DokuAbschnitt id="waehrung" titel={t("waehrung.titel")}>
        <p>
          <Prosa>{t("waehrung.text")}</Prosa>
        </p>
        <Merksatz>
          <Prosa>{t("waehrung.merksatz")}</Prosa>
        </Merksatz>
      </DokuAbschnitt>

      <DokuAbschnitt id="sprache" titel={t("sprache.titel")}>
        <p>
          <Prosa>{t("sprache.text")}</Prosa>
        </p>
      </DokuAbschnitt>

      <DokuAbschnitt id="texte" titel={t("texte.titel")}>
        <p>
          <Prosa>{t("texte.text")}</Prosa>
        </p>
      </DokuAbschnitt>
    </div>
  );
}
