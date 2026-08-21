// Grenzen von v1 — was die API NICHT kann, und warum.
//
// Dieser Abschnitt hat bei keinem Wettbewerber eine Entsprechung, und genau das
// ist der Grund für ihn: was eine API nicht kann, findet ein Entwickler sonst
// erst heraus, nachdem er einen halben Tag danach gesucht hat. Eine ehrliche
// Liste ist billiger als jede Support-Anfrage — und billiger als ein halb
// gebauter Endpunkt, der die Wahrheit über Storno oder Preisberechnung
// verdoppelt.
import { useTranslations } from "next-intl";

import { SectionHeading } from "@/components/marketing/section-kit";
import { Icon } from "@/components/ui/icon";

/** Reihenfolge = Ehrlichkeit zuerst: die häufigste Erwartung steht oben. */
const GRENZEN = ["storno", "quote", "gaeste", "nachrichten", "finanzen"] as const;

export function ApiGrenzen() {
  const t = useTranslations("entwickler.grenzen");

  return (
    <section id="grenzen" className="scroll-mt-24 bg-surface-warm">
      <div className="mx-auto max-w-7xl px-6 py-20">
        <SectionHeading
          eyebrow={t("eyebrow")}
          heading={t("heading")}
          sub={t("sub")}
          align="left"
        />

        <ul className="mt-12 grid gap-6 md:grid-cols-2">
          {GRENZEN.map((g) => (
            <li
              key={g}
              className="rounded-3xl border border-border bg-background p-7"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-surface-warm text-muted-foreground">
                <Icon icon="ph:info" className="size-5" />
              </span>
              <h3 className="mt-4 font-display text-lg font-semibold">
                {t(`${g}.titel`)}
              </h3>
              <p className="mt-2 leading-relaxed text-muted-foreground">
                {t(`${g}.text`)}
              </p>
              {/* Der Weg, der stattdessen funktioniert. Eine Grenze ohne
                  Ausweg ist eine Sackgasse. */}
              <p className="mt-4 text-sm">
                <span className="font-medium">{t("stattdessen")}</span>{" "}
                <span className="text-muted-foreground">
                  {t(`${g}.ausweg`)}
                </span>
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
