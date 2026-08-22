// Grenzen von v1 — was die API NICHT kann, und warum.
//
// Dieser Abschnitt hat bei keinem Wettbewerber eine Entsprechung, und genau das
// ist der Grund für ihn: was eine API nicht kann, findet ein Entwickler sonst
// erst heraus, nachdem er einen halben Tag danach gesucht hat.
//
// Jede Grenze nennt den Weg, der stattdessen funktioniert. Eine Grenze ohne
// Ausweg ist eine Sackgasse.
import { useTranslations } from "next-intl";

import { DokuAbschnitt, DokuKopf, Prosa } from "@/components/entwickler/doku";

/** Reihenfolge = Ehrlichkeit zuerst: die häufigste Erwartung steht oben.
 *
 * Hier standen einmal fünf Punkte. `storno`, `quote` und `verschieben` sind
 * gebaut: Storno und Verschieben als Auftrag an die EINE Kette (202), die
 * Preisvorschau über die byte-identisch geteilte Preisberechnung. Eine Grenze,
 * die nicht mehr gilt, gehört gestrichen — sonst hält die Doku Kunden von
 * etwas ab, das es gibt.
 *
 * Was bleibt, bleibt aus einem Grund im Datenmodell: ein Gesprächsfaden
 * gehört einem Marktplatz-Gastkonto, und der Zahlungseinzug läuft über die
 * Buchungsstrecke des Gastes. */
const GRENZEN = ["gaeste", "nachrichten", "finanzen"] as const;

export function ApiGrenzen() {
  const t = useTranslations("entwickler.grenzen");

  return (
    <div className="max-w-3xl pb-16">
      <DokuKopf eyebrow={t("eyebrow")} titel={t("heading")} lead={t("sub")} />
      {GRENZEN.map((g) => (
        <DokuAbschnitt key={g} id={g} titel={t(`${g}.titel`)}>
          <p>
            <Prosa>{t(`${g}.text`)}</Prosa>
          </p>
          <p className="text-sm">
            <span className="font-medium text-foreground">{t("stattdessen")}</span>{" "}
            <Prosa>{t(`${g}.ausweg`)}</Prosa>
          </p>
        </DokuAbschnitt>
      ))}
    </div>
  );
}
