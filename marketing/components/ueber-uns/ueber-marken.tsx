// Die zwei Marken — myNextDays (Betrieb) und myBestDays (Gast).
//
// Diese Sektion hat keine Entsprechung bei den Wettbewerbern, und das ist
// Absicht: Lodgify, Guesty und Mews verkaufen EIN Produkt an EINE Seite. Wir
// betreiben zwei Marken (CLAUDE.md, „Zwei Marken (UNVERHANDELBAR)"), und wer
// auf der Über-uns-Seite landet, stolpert sonst später über den zweiten Namen,
// ohne zu wissen, wie er dazugehört.
//
// Die Grenze wird hier auch sprachlich gehalten: links steht ausschließlich,
// was der BETRIEB sieht, rechts ausschließlich, was der GAST sieht.
import { useTranslations } from "next-intl";
import Image from "next/image";

import { SectionHeading } from "@/components/marketing/section-kit";
import { Icon, type IconName } from "@/components/ui/icon";

const NEXTDAYS_PUNKTE: readonly { key: string; icon: IconName }[] = [
  { key: "kalender", icon: "ph:calendar-check" },
  { key: "portale", icon: "ph:share-network" },
  { key: "geld", icon: "ph:credit-card" },
  { key: "team", icon: "ph:device-mobile" },
];

const BESTDAYS_PUNKTE: readonly { key: string; icon: IconName }[] = [
  { key: "direkt", icon: "ph:storefront" },
  { key: "provision", icon: "ph:trend-up" },
  { key: "app", icon: "ph:device-mobile-camera" },
];

export function UeberMarken() {
  const t = useTranslations("ueberUns.marken");

  return (
    <section className="bg-surface-warm">
      <div className="mx-auto max-w-7xl px-6 py-24">
        <SectionHeading
          eyebrow={t("eyebrow")}
          heading={t("heading")}
          sub={t("sub")}
        />

        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          <MarkenKarte
            logo="/marketing/brand/mnd_lockup.svg"
            logoAlt="myNextDays"
            rolle={t("nextdays.rolle")}
            text={t("nextdays.text")}
            punkte={NEXTDAYS_PUNKTE.map((p) => ({
              icon: p.icon,
              text: t(`nextdays.punkte.${p.key}`),
            }))}
          />
          <MarkenKarte
            logo="/marketing/brand/mybestdays-logo.png"
            logoAlt="myBestDays"
            rolle={t("bestdays.rolle")}
            text={t("bestdays.text")}
            punkte={BESTDAYS_PUNKTE.map((p) => ({
              icon: p.icon,
              text: t(`bestdays.punkte.${p.key}`),
            }))}
          />
        </div>

        <p className="mx-auto mt-8 max-w-3xl text-center text-sm leading-relaxed text-muted-foreground">
          {t("hinweis")}
        </p>
      </div>
    </section>
  );
}

function MarkenKarte({
  logo,
  logoAlt,
  rolle,
  text,
  punkte,
}: {
  logo: string;
  logoAlt: string;
  rolle: string;
  text: string;
  punkte: readonly { icon: IconName; text: string }[];
}) {
  return (
    <article className="flex flex-col rounded-3xl bg-card p-8 shadow-card sm:p-10">
      {/* Das Logo trägt den Namen — deshalb steht der Markenname NICHT
          zusätzlich als Überschrift daneben.
          Die Karte liegt auf heller Fläche (bg-card): myNextDays kommt daher
          als Standard-Lockup (Rot #B82028), nicht als Negativ-Variante.
          width/height sind nur das Seitenverhältnis für den Platzhalter — die
          beiden Marken-Assets haben unterschiedliche Proportionen, gerendert
          wird ohnehin auf feste Höhe (h-9) mit object-contain. */}
      <Image
        src={logo}
        alt={logoAlt}
        width={640}
        height={160}
        className="h-9 w-auto object-contain object-left"
      />
      <p className="mt-6 text-sm font-semibold uppercase tracking-wide text-accent">
        {rolle}
      </p>
      <p className="mt-3 leading-relaxed text-muted-foreground">{text}</p>

      <ul className="mt-6 flex flex-col gap-3 border-t border-border pt-6">
        {punkte.map((p) => (
          <li key={p.text} className="flex items-start gap-3 text-sm">
            <Icon
              icon={p.icon}
              className="mt-0.5 size-5 shrink-0 text-accent"
            />
            <span>{p.text}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
