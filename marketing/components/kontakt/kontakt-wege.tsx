// Die Wege zu uns — Themenwahl VOR dem Formular.
//
// Referenz-UX (live am 19.08.2026): Genau diesen Block haben alle drei
// Wettbewerber, und alle drei stellen ihn vor das Formular —
// lodgify.com/contact drei Spalten (Hilfezentrum · Vertrieb · Support),
// smoobu.com/de/kontakt sechs Karten, mews.com/en/contact-us fünf. Der Grund
// ist immer derselbe: Bestandskunden mit einem Problem und Interessenten mit
// einer Frage brauchen verschiedene Wege, und wer im falschen landet, wartet.
//
// Was wir NICHT übernehmen: Lodgifys „Support nur nach Login". Unser
// Hilfe-Center ist öffentlich und braucht kein Konto — die dritte Karte führt
// direkt hinein, zusätzlich nennt sie den Chat unten rechts, der auf jeder
// Seite dieser App läuft.
//
// Die beiden Postfächer stehen an der Karte, damit sichtbar ist, WOHIN die
// Anfrage geht — dasselbe, was das Formular unten serverseitig tut.
import { useTranslations } from "next-intl";
import Link from "next/link";

import { SectionHeading } from "@/components/marketing/section-kit";
import { Icon, type IconName } from "@/components/ui/icon";
import { ANBIETER } from "@/content/legal/anbieter";

type Weg = {
  key: string;
  icon: IconName;
  /** Mail-Adresse, wenn die Karte in ein Postfach führt. */
  email?: string;
  /** Telefonnummer, wenn die Karte auch angerufen werden kann. */
  telefon?: string;
  /** Sprungziel auf dieser Seite bzw. externes Ziel. */
  ziel?: string;
};

export function KontaktWege() {
  const t = useTranslations("kontakt.wege");

  const wege: readonly Weg[] = [
    {
      key: "allgemein",
      icon: "ph:storefront",
      email: ANBIETER.email,
      telefon: ANBIETER.telefon,
      ziel: "#formular",
    },
    {
      key: "technik",
      icon: "ph:code",
      email: ANBIETER.emailTechnik,
      ziel: "#formular",
    },
    {
      key: "hilfe",
      icon: "ph:lifebuoy",
      // Das Hilfe-Center liegt in dieser App (`app/hilfe`) — ein interner Link.
      // Vorher hing er an `HILFE_URL` und damit an der Dashboard-Adresse; weil
      // die vor dem Start leer ist, blieb die Karte ohne Ziel, obwohl es die
      // Artikel in 24 Sprachen längst gab.
      ziel: "/hilfe",
    },
  ];

  return (
    <section className="bg-surface-warm">
      <div className="mx-auto max-w-7xl px-6 py-24">
        <SectionHeading
          eyebrow={t("eyebrow")}
          heading={t("heading")}
          sub={t("sub")}
        />

        <ul className="mt-14 grid gap-6 md:grid-cols-3">
          {wege.map((weg) => (
            <li
              key={weg.key}
              className="flex flex-col rounded-3xl border border-border bg-card p-8 shadow-soft"
            >
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-accent text-accent">
                <Icon icon={weg.icon} className="size-6" />
              </span>
              <h3 className="mt-6 font-display text-xl font-semibold tracking-tight">
                {t(`${weg.key}.titel`)}
              </h3>
              <p className="mt-3 flex-1 leading-relaxed text-muted-foreground">
                {t(`${weg.key}.text`)}
              </p>

              <div className="mt-6 flex flex-col gap-2 text-sm">
                {weg.email ? (
                  <a
                    href={`mailto:${weg.email}`}
                    className="inline-flex items-center gap-2 font-medium transition-colors hover:text-accent"
                  >
                    <Icon
                      icon="ph:envelope-simple"
                      className="size-4 text-accent"
                    />
                    {weg.email}
                  </a>
                ) : null}
                {weg.telefon ? (
                  <a
                    href={`tel:${ANBIETER.telefonE164}`}
                    className="inline-flex items-center gap-2 font-medium transition-colors hover:text-accent"
                  >
                    <Icon icon="ph:phone" className="size-4 text-accent" />
                    {weg.telefon}
                  </a>
                ) : null}
                {weg.ziel ? (
                  <Link
                    href={weg.ziel}
                    className="mt-1 inline-flex items-center gap-2 font-medium text-accent underline-offset-4 hover:underline"
                  >
                    {t(`${weg.key}.aktion`)}
                    <Icon icon="ph:arrow-right" className="size-4" />
                  </Link>
                ) : (
                  <p className="mt-1 inline-flex items-center gap-2 text-muted-foreground">
                    <Icon
                      icon="ph:chat-circle-dots"
                      className="size-4 text-accent"
                    />
                    {t("hilfe.chatHinweis")}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
