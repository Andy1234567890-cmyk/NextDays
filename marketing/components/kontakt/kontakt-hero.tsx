// Hero der Kontaktseite — dunkle Fläche wie auf Preis- und Über-uns-Seite.
//
// Referenz-UX (live angesehen am 19.08.2026): lodgify.com/contact,
// smoobu.com/de/kontakt und mews.com/en/contact-us öffnen alle drei mit EINER
// Zusage („Wir helfen Ihnen gerne! Sprechen wir darüber.") und schicken den
// Besucher direkt danach in die Themenwahl — kein Formular ganz oben. Der Grund
// ist einleuchtend: die häufigste Kontaktabsicht ist nicht „Formular ausfüllen",
// sondern „den richtigen Ansprechpartner finden".
//
// Die Chips tragen nur nachprüfbare Angaben: Sitz und Telefonnummer aus
// `ANBIETER`, Sprachzahl und EU-Hosting sind dieselben Aussagen wie auf der
// Startseite. Keine Antwortzeit-Versprechen und keine Bewertungssterne — beides
// hätten wir nicht belegt (Wurzel 4).
import { useTranslations } from "next-intl";

import { Icon, type IconName } from "@/components/ui/icon";
import { ANBIETER } from "@/content/legal/anbieter";

const CHIPS: readonly { key: string; icon: IconName }[] = [
  { key: "sitz", icon: "ph:map-pin" },
  { key: "sprachen", icon: "ph:globe-hemisphere-west" },
  { key: "eu", icon: "ph:shield-check" },
];

export function KontaktHero() {
  const t = useTranslations("kontakt.hero");

  return (
    <section className="relative overflow-hidden bg-primary pb-24 pt-16 text-primary-foreground">
      {/* Gleiches Ring-Wasserzeichen wie auf der Über-uns-Seite — der Kopf der
          Unterseiten soll als eine Familie lesen. */}
      <svg
        aria-hidden
        viewBox="0 0 200 200"
        className="pointer-events-none absolute -right-24 -top-24 hidden size-[32rem] text-primary-foreground lg:block"
      >
        <circle
          cx="100"
          cy="100"
          r="80"
          fill="none"
          stroke="currentColor"
          strokeWidth="14"
          opacity="0.06"
        />
        <circle cx="100" cy="100" r="40" fill="currentColor" opacity="0.05" />
      </svg>

      <div className="relative mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="eyebrow">{t("eyebrow")}</p>
          <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            {t("headlinePre")}{" "}
            <span className="relative text-accent">
              {t("headlineHighlight")}
              <svg
                aria-hidden
                viewBox="0 0 300 20"
                className="absolute -bottom-3 left-0 w-full text-accent"
                preserveAspectRatio="none"
              >
                <path
                  d="M2 14 C 80 4, 220 4, 298 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </h1>
          <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-primary-foreground/70">
            {t("sub")}
          </p>
        </div>

        <ul className="mt-9 flex flex-wrap items-center justify-center gap-2.5">
          {CHIPS.map((c) => (
            <li
              key={c.key}
              className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/10 px-4 py-2 text-sm font-medium"
            >
              <Icon icon={c.icon} className="size-4 text-accent" />
              {t(c.key)}
            </li>
          ))}
        </ul>

        {/* Die Telefonnummer steht im Kopf und nicht erst unten: bei Mews und
            Lodgify ist sie der auffälligste Kontaktweg der Seite, und wer
            anrufen will, sucht nicht erst ein Formular. */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm">
          <a
            href={`tel:${ANBIETER.telefonE164}`}
            className="inline-flex items-center gap-2 font-medium transition-colors hover:text-accent"
          >
            <Icon icon="ph:phone" className="size-4 text-accent" />
            {ANBIETER.telefon}
          </a>
          <a
            href={`mailto:${ANBIETER.email}`}
            className="inline-flex items-center gap-2 font-medium transition-colors hover:text-accent"
          >
            <Icon icon="ph:envelope-simple" className="size-4 text-accent" />
            {ANBIETER.email}
          </a>
        </div>
      </div>
    </section>
  );
}
