// Footer — dunkler Block mit Link-Spalten, App-Store-Badges, Sprache,
// Rechtshinweisen und Social-Links. Figma: schwarzer Footer am Seitenende.
import { Icon } from "@/components/ui/icon";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo } from "@/components/logo";
import { RECHTSDOKUMENTE } from "@/content/legal";
import { AGB_URL, HILFE_URL } from "@/lib/app-url";

// Spalten: Übersetzungsschlüssel, keine fertigen Texte. `href` nur, wo es ein
// echtes Ziel gibt — der Rest bleibt bewusst Platzhalter (#).
const FOOTER_COLUMNS = [
  {
    key: "produkt",
    links: ["pms", "channelManager", "direktbuchung", "zahlungen", "mobileApp"],
  },
  {
    key: "loesungen",
    links: ["hotels", "bnb", "gaestehaeuser", "ferienwohnungen", "campingplaetze"],
  },
  {
    key: "ressourcen",
    links: ["blog", "hilfeCenter", "webinare", "leitfaeden", "api"],
  },
  {
    key: "unternehmen",
    links: ["ueberUns", "karriere", "partner", "kontakt", "presse"],
  },
] as const;

const SOCIALS = [
  { icon: "ph:facebook-logo", label: "Facebook" },
  { icon: "ph:instagram-logo", label: "Instagram" },
  { icon: "ph:youtube-logo", label: "YouTube" },
  { icon: "ph:linkedin-logo", label: "LinkedIn" },
] as const;

// Übersetzungsschlüssel je Rechtsdokument — die Registry liefert die Route,
// der Anzeigetext kommt aus messages/<locale>.json (footer.*).
const RECHTS_KEYS: Record<string, string> = {
  datenschutz: "datenschutz",
  impressum: "impressum",
  "cookie-richtlinie": "cookies",
  auftragsverarbeitung: "avv",
};

export function MarketingFooter() {
  const t = useTranslations("footer");

  // Die AGB sind eine eigene Route IN dieser App (app/agb) — nicht mehr ein
  // absoluter Link ins Dashboard: der Google-OAuth-Zustimmungsbildschirm
  // verlangt sie als öffentlich erreichbare Adresse auf dieser Domain und
  // prüft sie automatisiert. Sie stehen NICHT in RECHTSDOKUMENTE, weil sie
  // sprachweise geladen werden (content/legal/agb-laden) statt als ein Modul.
  // Hilfe liegt weiter in der web-App → absoluter Link (lib/app-url), und
  // entfällt, solange das Dashboard nicht öffentlich ist.
  const rechtlich = [
    { label: t("agb"), href: AGB_URL },
    ...RECHTSDOKUMENTE.map((eintrag) => ({
      label: t(RECHTS_KEYS[eintrag.doc.slug]),
      href: `/${eintrag.doc.slug}`,
    })),
  ];

  return (
    <footer id="ressourcen" className="bg-primary text-primary-foreground">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-10 lg:grid-cols-[1.5fr_repeat(4,1fr)]">
          <div>
            <Logo heightRem={2.25} dark />
            <p className="mt-4 max-w-xs text-sm text-primary-foreground/70">
              {t("claim")}
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <p className="text-sm font-medium">{t("appLaden")}</p>
              <div className="flex flex-wrap gap-3">
                <span className="flex items-center gap-2 rounded-lg border border-primary-foreground/20 px-3 py-2 text-xs">
                  <Icon icon="ph:apple-logo-fill" className="size-5" />
                  App Store
                </span>
                <span className="flex items-center gap-2 rounded-lg border border-primary-foreground/20 px-3 py-2 text-xs">
                  <Icon icon="ph:google-play-logo-fill" className="size-5" />
                  Google Play
                </span>
              </div>
            </div>
          </div>

          {FOOTER_COLUMNS.map((col) => (
            <div key={col.key}>
              <p className="text-sm font-semibold">{t(`spalten.${col.key}`)}</p>
              <ul className="mt-4 flex flex-col gap-3">
                {col.links.map((link) => {
                  // Nur echte Ziele verlinken; alles andere bleibt Platzhalter (#).
                  // HILFE_URL ist vor dem Start leer (Dashboard nicht öffentlich).
                  const href =
                    link === "hilfeCenter" && HILFE_URL ? HILFE_URL : "#";
                  return (
                    <li key={link}>
                      <Link
                        href={href}
                        className="text-sm text-primary-foreground/70 transition-colors hover:text-primary-foreground"
                      >
                        {t(`${col.key}.${link}`)}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-6 border-t border-primary-foreground/15 pt-8 sm:flex-row">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-primary-foreground/60">
            <span>{t("copyright")}</span>
            {rechtlich.map((r) => (
              <span key={r.href} className="flex items-center gap-2">
                <span aria-hidden>·</span>
                <Link
                  href={r.href}
                  className="transition-colors hover:text-primary-foreground hover:underline"
                >
                  {r.label}
                </Link>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-5">
            <LanguageSwitcher dark />
            <div className="flex items-center gap-3">
              {SOCIALS.map((s) => (
                <Link
                  key={s.label}
                  href="#"
                  aria-label={s.label}
                  className="text-primary-foreground/70 transition-colors hover:text-primary-foreground"
                >
                  <Icon icon={s.icon} className="size-5" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
