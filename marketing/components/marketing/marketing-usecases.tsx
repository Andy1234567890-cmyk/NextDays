// „Für wen wir bauen" — drei Foto-Karten über der Gründerin-Stimme.
//
// Referenz-UX (hostaway.com): an dieser Stelle steht dort ein Karussell mit
// Kundenstimmen (Foto, Name, Firma, Sterne, Zitat), die mittlere Karte
// hervorgehoben. Die FORM ist übernommen, der INHALT nicht: myNextDays startet
// erst am 01.09.2026 und hat keine Kunden, die zitiert werden könnten —
// erfundene Stimmen mit Stockfoto-Porträts wären als Werbung angreifbar.
// Stattdessen zeigen die Karten die drei Betriebsarten, für die die Plattform
// gebaut ist, und was sie dort konkret übernimmt.
//
// Fotos: Unsplash-Lizenz, lokal unter public/marketing/usecases/ abgelegt
// (kein Laufzeit-Request an ein fremdes CDN — wie bei Schriften und Icons).
import { useTranslations } from "next-intl";
import Image from "next/image";

import { SectionHeading } from "@/components/marketing/section-kit";
import { Icon } from "@/components/ui/icon";

const USECASES = [
  {
    key: "ferienobjekt",
    src: "/marketing/usecases/ferienobjekt.jpg",
    punkte: ["kanaele", "kalender", "gaeste"],
    hervorgehoben: false,
  },
  {
    key: "hotel",
    src: "/marketing/usecases/hotelzimmer.jpg",
    punkte: ["zimmer", "raten", "rezeption"],
    hervorgehoben: true,
  },
  {
    key: "agentur",
    src: "/marketing/usecases/agentur.jpg",
    punkte: ["portfolio", "eigentuemer", "abrechnung"],
    hervorgehoben: false,
  },
] as const;

export function MarketingUsecases() {
  const t = useTranslations("usecases");

  return (
    <section className="bg-surface-warm">
      <div className="mx-auto max-w-7xl px-6 pt-24">
        <SectionHeading eyebrow={t("eyebrow")} heading={t("heading")} sub={t("sub")} />

        <div className="mt-14 grid items-center gap-6 lg:grid-cols-3">
          {USECASES.map((u) => (
            // Schwebend: kein Rahmen (der klebt die Karte an die Fläche),
            // stattdessen zweistufiger Schatten, eine leichte Anhebung und ein
            // stärkeres Abheben beim Zeigen. Die mittlere Karte liegt höher.
            <article
              key={u.key}
              className={
                "flex h-full flex-col overflow-hidden rounded-3xl bg-card transition-all duration-300 hover:-translate-y-2 hover:shadow-float-lg " +
                (u.hervorgehoben
                  ? "shadow-float-lg lg:-my-6 lg:-translate-y-1"
                  : "shadow-float")
              }
            >
              {/* Getönte Fläche unter dem Foto + eager: sonst steht beim
                  Hereinscrollen kurz eine weiße, halbleere Karte da. */}
              <div className="relative aspect-[16/10] w-full bg-surface-accent">
                <Image
                  src={u.src}
                  alt=""
                  fill
                  loading="eager"
                  sizes="(min-width: 1024px) 33vw, 100vw"
                  className="object-cover"
                />
              </div>
              <div className="flex flex-1 flex-col p-7">
                <p className="eyebrow">{t(`${u.key}.label`)}</p>
                <h3 className="mt-3 font-display text-xl font-semibold">
                  {t(`${u.key}.title`)}
                </h3>
                <p className="mt-3 text-muted-foreground">{t(`${u.key}.text`)}</p>
                <ul className="mt-5 flex flex-col gap-2.5">
                  {u.punkte.map((p) => (
                    <li key={p} className="flex items-start gap-2.5 text-sm">
                      <Icon
                        icon="ph:check-circle-fill"
                        className="mt-0.5 size-4 shrink-0 text-accent"
                      />
                      {t(`${u.key}.punkte.${p}`)}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
