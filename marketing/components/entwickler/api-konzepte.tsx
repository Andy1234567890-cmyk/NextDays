// Die vier Begriffe, ohne die jede Integration schiefgeht.
//
// Weder Lodgify noch Hostaway erklären ihr Datenmodell an einer Stelle — man
// leitet es aus den Feldnamen ab. Bei uns ist das nicht möglich: „ein Objekt ist
// ein Einheiten-TYP" widerspricht der ersten Vermutung („ein Objekt ist ein
// Haus"), und wer das falsch versteht, baut eine Integration, die Kapazitäten
// verwechselt.
//
// Darstellung: Prosa mit H2 je Begriff (siehe `doku.tsx`). Die frühere Fassung
// setzte vier Kacheln mit Icon-Quadraten in ein Grid — das las sich wie eine
// Produktseite und nicht wie eine Doku.
import { useTranslations } from "next-intl";

import { DokuAbschnitt, DokuKopf, Merksatz, Prosa } from "@/components/entwickler/doku";

const KONZEPTE = ["objekt", "waehrung", "zeit", "kanaele"] as const;

export function ApiKonzepte() {
  const t = useTranslations("entwickler.konzepte");

  return (
    <div className="max-w-3xl pb-16">
      <DokuKopf eyebrow={t("eyebrow")} titel={t("heading")} lead={t("sub")} />
      {KONZEPTE.map((k) => (
        <DokuAbschnitt key={k} id={k} titel={t(`${k}.titel`)}>
          <p>
            <Prosa>{t(`${k}.text`)}</Prosa>
          </p>
          <Merksatz>
            <Prosa>{t(`${k}.folge`)}</Prosa>
          </Merksatz>
        </DokuAbschnitt>
      ))}
    </div>
  );
}
