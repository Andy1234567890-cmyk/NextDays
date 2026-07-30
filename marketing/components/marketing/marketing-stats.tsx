// Stats — die belegbaren Zahlen als große Kacheln.
//
// Referenz-UX (hostaway.com): ein zentrierter Eyebrow-Heading-Block, darunter
// Kacheln in hell getönter Akzentfarbe mit EINER sehr großen Zahl in
// Akzentfarbe und einer kurzen Erklärzeile darunter. Bewusst ohne
// Review-Plattform-Badges und Bewertungssterne: zum Launch (01.09.2026)
// existieren keine Profile/Reviews, die man zeigen dürfte.
import { useTranslations } from "next-intl";

import { SectionHeading } from "@/components/marketing/section-kit";

// Schlüssel + Darstellung; Zahl, Label und Text kommen aus messages (stats.*).
// `value: false` = Kachel ohne Kennzahl (reine Aussage).
const STATS = [
  { key: "laender", value: true },
  { key: "sprachen", value: true },
  { key: "kanaele", value: true },
  { key: "hosting", value: true },
  { key: "vermieter", value: false },
] as const;

export function MarketingStats() {
  const t = useTranslations("stats");

  return (
    <section className="bg-background">
      <div className="mx-auto max-w-7xl px-6 py-24">
        <SectionHeading eyebrow={t("eyebrow")} heading={t("heading")} sub={t("sub")} />

        {/* Eine Reihe für alle fünf Werte — kein 3+2-Rest, der optisch kippt. */}
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {STATS.map((s) => (
            <div
              key={s.key}
              className="flex flex-col items-center justify-center rounded-3xl bg-surface-accent px-6 py-9 text-center"
            >
              {s.value ? (
                <>
                  <p className="font-display text-4xl font-extrabold text-accent">
                    {t(`${s.key}.value`)}
                  </p>
                  <p className="mt-2 font-display text-base font-semibold">
                    {t(`${s.key}.label`)}
                  </p>
                </>
              ) : (
                <p className="font-display text-base font-semibold">
                  {t(`${s.key}.label`)}
                </p>
              )}
              <p className="mt-2 text-sm text-muted-foreground">{t(`${s.key}.text`)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
