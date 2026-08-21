// Die vier Begriffe, ohne die jede Integration schiefgeht.
//
// Weder Lodgify noch Hostaway erklären ihr Datenmodell an einer Stelle — man
// leitet es aus den Feldnamen ab. Bei uns ist das nicht möglich: „ein Objekt ist
// ein Einheiten-TYP" widerspricht der ersten Vermutung („ein Objekt ist ein
// Haus"), und wer das falsch versteht, baut eine Integration, die Kapazitäten
// verwechselt. Deshalb dieser Abschnitt VOR der Endpunktliste.
//
// Ebenso die drei Regeln, die bei anderen APIs stille Fehler erzeugen:
// Währung ohne Standardwert, Zeitpunkt aus der Quelle, Kanal-Sichtbarkeit pro
// Kanal.
import { useTranslations } from "next-intl";

import { SectionHeading } from "@/components/marketing/section-kit";
import { Icon, type IconName } from "@/components/ui/icon";

const KONZEPTE: readonly { key: string; icon: IconName }[] = [
  { key: "objekt", icon: "ph:house-line" },
  { key: "waehrung", icon: "ph:tag" },
  { key: "zeit", icon: "ph:clock" },
  { key: "kanaele", icon: "ph:storefront" },
];

export function ApiKonzepte() {
  const t = useTranslations("entwickler.konzepte");

  return (
    <section id="konzepte" className="scroll-mt-24 bg-surface-warm">
      <div className="mx-auto max-w-7xl px-6 py-20">
        <SectionHeading
          eyebrow={t("eyebrow")}
          heading={t("heading")}
          sub={t("sub")}
          align="left"
        />

        <div className="mt-12 grid gap-8 md:grid-cols-2">
          {KONZEPTE.map((k) => (
            <div
              key={k.key}
              className="rounded-3xl border border-border bg-background p-7"
            >
              <span className="flex size-11 items-center justify-center rounded-2xl bg-surface-accent text-accent">
                <Icon icon={k.icon} className="size-5" />
              </span>
              <h3 className="mt-5 font-display text-lg font-semibold">
                {t(`${k.key}.titel`)}
              </h3>
              <p className="mt-2 leading-relaxed text-muted-foreground">
                {t(`${k.key}.text`)}
              </p>
              {/* Die Konsequenz für den Client — der Satz, der die Integration
                  richtig macht. Bewusst hervorgehoben: er ist der Grund, warum
                  der Abschnitt existiert. */}
              <p className="mt-4 border-l-2 border-accent pl-4 text-sm font-medium">
                {t(`${k.key}.folge`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
