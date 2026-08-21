// Hilfe, Änderungen, Werkzeuge.
//
// Drei Dinge, die ein Dev-Portal braucht und die beide Wettbewerber verstreut
// haben: wohin mit einer Frage, wie erfahre ich von Änderungen, was hilft beim
// Bauen. Der Änderungs-Abschnitt ist bewusst eine ZUSAGE (wie wir mit
// brechenden Änderungen umgehen) und keine leere Liste — v1 ist neu, es gibt
// noch nichts zu berichten, und eine erfundene Historie wäre eine Lüge.
import { useTranslations } from "next-intl";

import { SectionHeading } from "@/components/marketing/section-kit";
import { API_LINKS } from "@/content/api/referenz";
import { ANBIETER } from "@/content/legal/anbieter";
import { Icon, type IconName } from "@/components/ui/icon";

const ZUSAGEN = ["pfad", "additiv", "frist", "changelog"] as const;

export function ApiHilfe() {
  const t = useTranslations("entwickler.hilfe");

  const wege: readonly {
    key: string;
    icon: IconName;
    href: string;
    extern: boolean;
  }[] = [
    {
      key: "entwicklerMail",
      icon: "ph:envelope-simple",
      // Das technische Postfach steht in den Anbieterdaten (EINE Quelle) — ein
      // hier hartcodierter Mailkontakt würde beim Domainwechsel still falsch.
      href: `mailto:${ANBIETER.emailTechnik}`,
      extern: false,
    },
    {
      key: "hilfeCenter",
      icon: "ph:lifebuoy",
      href: "/hilfe",
      extern: false,
    },
    {
      key: "schema",
      icon: "ph:code",
      href: API_LINKS.schema,
      extern: true,
    },
  ];

  return (
    <section id="hilfe" className="scroll-mt-24 bg-background">
      <div className="mx-auto max-w-7xl px-6 py-20">
        <SectionHeading
          eyebrow={t("eyebrow")}
          heading={t("heading")}
          sub={t("sub")}
          align="left"
        />

        <div className="mt-12 grid gap-10 lg:grid-cols-2">
          {/* -- Wege ------------------------------------------------------ */}
          <div>
            <h3 className="font-display text-xl font-semibold">
              {t("wege.titel")}
            </h3>
            <ul className="mt-5 space-y-3">
              {wege.map((w) => (
                <li key={w.key}>
                  <a
                    href={w.href}
                    {...(w.extern
                      ? { target: "_blank", rel: "noreferrer noopener" }
                      : {})}
                    className="flex items-start gap-4 rounded-2xl border border-border p-5 transition-colors hover:bg-surface-warm"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-accent text-accent">
                      <Icon icon={w.icon} className="size-5" />
                    </span>
                    <span>
                      <span className="block font-medium">
                        {t(`wege.${w.key}.titel`)}
                      </span>
                      <span className="mt-1 block text-sm text-muted-foreground">
                        {t(`wege.${w.key}.text`)}
                      </span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* -- Zusagen zur Versionierung -------------------------------- */}
          <div>
            <h3 className="font-display text-xl font-semibold">
              {t("versionen.titel")}
            </h3>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              {t("versionen.text")}
            </p>
            <ul className="mt-5 space-y-3">
              {ZUSAGEN.map((z) => (
                <li key={z} className="flex gap-3">
                  <Icon
                    icon="ph:check-circle-fill"
                    className="mt-0.5 size-5 shrink-0 text-accent"
                  />
                  <span className="text-muted-foreground">
                    {t(`versionen.zusagen.${z}`)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
