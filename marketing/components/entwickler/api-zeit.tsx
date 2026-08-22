// Anhang: Zeit und Zeitzonen.
//
// Lodgify hat hier eine Zeitzonen-Tabelle, weil ihre API Zeitzonen-Namen als
// Eingabe nimmt. Unsere nimmt keine — eine abgeschriebene Tabelle wäre eine
// Zusage über ein Feld, das es nicht gibt (Wurzel 4). Stattdessen steht hier die
// Regel, die man wirklich braucht: welche Felder Kalendertage sind, welche
// Zeitpunkte, und warum `booked_at` und `received_at` nie dasselbe sind.
import { useTranslations } from "next-intl";

import {
  DokuAbschnitt,
  DokuKopf,
  Merksatz,
  Prosa,
} from "@/components/entwickler/doku";

export function ApiZeit() {
  const t = useTranslations("entwickler.zeit");

  return (
    <div className="max-w-3xl pb-16">
      <DokuKopf eyebrow={t("eyebrow")} titel={t("heading")} lead={t("sub")} />

      <DokuAbschnitt id="tage" titel={t("tage.titel")}>
        <p>
          <Prosa>{t("tage.text")}</Prosa>
        </p>
        <Merksatz>
          <Prosa>{t("tage.merksatz")}</Prosa>
        </Merksatz>
      </DokuAbschnitt>

      <DokuAbschnitt id="zeitpunkte" titel={t("zeitpunkte.titel")}>
        <p>
          <Prosa>{t("zeitpunkte.text")}</Prosa>
        </p>
      </DokuAbschnitt>

      <DokuAbschnitt id="quelle" titel={t("quelle.titel")}>
        <p>
          <Prosa>{t("quelle.text")}</Prosa>
        </p>
        <Merksatz>
          <Prosa>{t("quelle.merksatz")}</Prosa>
        </Merksatz>
      </DokuAbschnitt>

      <DokuAbschnitt id="filter" titel={t("filter.titel")}>
        <p>
          <Prosa>{t("filter.text")}</Prosa>
        </p>
      </DokuAbschnitt>
    </div>
  );
}
