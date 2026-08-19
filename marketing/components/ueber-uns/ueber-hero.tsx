// Hero der Über-uns-Seite — dunkle Fläche, wie auf der Preisseite.
//
// Referenz-UX (lodgify.com/about-us, guesty.com/about-us, mews.com/en/about,
// alle live angesehen am 19.08.2026): Alle drei öffnen mit EINER Aussage über
// die Herkunft („Empowering independent hosts since 2012", „Pioneering the
// future of short-term rentals") statt mit einer Produktbeschreibung — die
// Über-uns-Seite beantwortet „wer seid ihr", nicht „was könnt ihr".
//
// Lodgify legt darunter ein Foto-Hero; hier bleibt es beim dunklen Grund mit
// dem Ring-Wasserzeichen des Hauses: ein gekauftes Stock-Foto würde genau das
// behaupten, was diese Seite gerade NICHT tut — eine Bildwelt, die es so nicht
// gibt. Das echte Foto der Gründerin steht weiter unten, wo es hingehört.
import { useTranslations } from "next-intl";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { SIGNUP_URL } from "@/lib/app-url";

// Die vier Belege über der Überschrift — jeder ist an anderer Stelle im Repo
// nachweisbar (Sitz aus anbieter.ts, Hosting/Start/Sprachen aus den Claims der
// Startseite). Keine Auszeichnungen, keine Bewertungssterne: es gibt sie nicht.
const CHIPS: readonly { key: string; icon: IconName }[] = [
  { key: "sitz", icon: "ph:map-pin" },
  { key: "eu", icon: "ph:shield-check" },
  { key: "start", icon: "ph:calendar-check" },
  { key: "sprachen", icon: "ph:globe-hemisphere-west" },
];

export function UeberHero() {
  const t = useTranslations("ueberUns.hero");

  return (
    <section className="relative overflow-hidden bg-primary pb-24 pt-16 text-primary-foreground">
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
              {/* Tiefer gesetzt als auf der Preisseite: „myNextDays" hat mit
                  dem y eine Unterlänge, durch die der Strich sonst läuft. */}
              <svg
                aria-hidden
                viewBox="0 0 300 20"
                className="absolute -bottom-4 left-0 w-full text-accent"
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

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Button asChild variant="accent" size="lg">
            <Link href={SIGNUP_URL}>{t("ctaTrial")}</Link>
          </Button>
          {/* Zweiter Weg bewusst der direkte Draht statt einer zweiten
              Verkaufsschaltfläche: wer die Über-uns-Seite liest, will oft
              jemanden sprechen, nicht sofort ein Konto anlegen.
              Ziel ist seit 0414 die Kontaktseite und nicht mehr ein `mailto:` —
              dort steht die Themenwahl, die die Anfrage ins richtige Postfach
              lenkt. Ein blanker mailto-Link landete immer bei info@, auch bei
              einer technischen Frage. */}
          <Button
            asChild
            variant="outline"
            size="lg"
            className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
          >
            <Link href="/kontakt">{t("ctaKontakt")}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
