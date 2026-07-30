// Stats-Sektion (Figma 3-1109) — zweispaltig: links Überschrift + Sterne +
// 4 Review-Plattform-Logos, rechts 5 weiße Karten mit Kennzahlen.
// Look ans NextDays-System angepasst (Akzent-Rot statt Glade-Green).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import Image from "next/image";

const REVIEW_LOGOS = [
  { name: "HotelTechReport", src: "/marketing/reviews/hoteltechreport.png" },
  { name: "Software Advice", src: "/marketing/reviews/software-advice.png" },
  { name: "Capterra", src: "/marketing/reviews/capterra.png" },
  { name: "Trustpilot", src: "/marketing/reviews/trustpilot.png" },
];

// Schlüssel + Darstellung; Zahl, Label und Text kommen aus messages (stats.*).
// `inline` = Zahl und Label in einer Zeile (Figma).
const STATS = [
  { key: "laender", inline: false },
  { key: "kanaele", inline: false },
  { key: "zufriedenheit", inline: false },
  { key: "stunden", inline: true },
  { key: "jahre", inline: true },
] as const;

export function MarketingStats() {
  const t = useTranslations("stats");

  return (
    <section className="bg-secondary/40">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-20 lg:grid-cols-2">
        {/* Links: Überschrift, Sterne, Review-Logos */}
        <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
          <h2 className="font-display text-3xl font-semibold tracking-tight">
            {t("heading")}
          </h2>

          <div className="mt-6 flex text-accent">
            {[0, 1, 2, 3].map((i) => (
              <Icon key={i} icon="ph:star-fill" className="size-7" />
            ))}
            <Icon icon="ph:star-half-fill" className="size-7" />
          </div>

          <div className="mt-8 grid grid-cols-2 gap-x-10 gap-y-6">
            {REVIEW_LOGOS.map((logo) => (
              <Image
                key={logo.name}
                src={logo.src}
                alt={logo.name}
                width={148}
                height={41}
                className="h-7 w-auto opacity-80"
              />
            ))}
          </div>
        </div>

        {/* Rechts: Karten-Raster */}
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
          {STATS.map((s) => (
            <div
              key={s.key}
              className="flex flex-col justify-center rounded-2xl bg-card p-5 shadow-[0_8px_8px_rgba(0,0,0,0.08)]"
            >
              {s.inline ? (
                <p className="flex items-baseline gap-2">
                  <span className="font-display text-4xl font-semibold text-accent">
                    {t(`${s.key}.value`)}
                  </span>
                  <span className="text-base font-medium">{t(`${s.key}.label`)}</span>
                </p>
              ) : (
                <>
                  <p className="font-display text-4xl font-semibold text-accent">
                    {t(`${s.key}.value`)}
                  </p>
                  <p className="mt-1 text-base font-medium">{t(`${s.key}.label`)}</p>
                </>
              )}
              <p className="mt-2 text-sm text-muted-foreground">{t(`${s.key}.text`)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
