// Footer — dunkler Block mit Link-Spalten, App-Store-Badges, Sprache,
// Rechtshinweisen und Social-Links. Figma: schwarzer Footer am Seitenende.
import { Icon } from "@/components/ui/icon";
import { useTranslations } from "next-intl";

import { FUNKTIONEN } from "@/content/funktionen";
import Link from "next/link";

import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo } from "@/components/logo";
import { ANBIETER } from "@/content/legal/anbieter";
import { RECHTSDOKUMENTE } from "@/content/legal";
import { AGB_URL, STATUS_URL } from "@/lib/app-url";
import { SystemStatus } from "./system-status";

// Spalten: Übersetzungsschlüssel, keine fertigen Texte. `href` nur, wo es ein
// echtes Ziel gibt — der Rest bleibt bewusst Platzhalter (#).
const FOOTER_COLUMNS = [
  {
    key: "produkt",
    links: ["pms", "channelManager", "direktbuchung", "zahlungen", "mobileApp"],
  },
  {
    key: "loesungen",
    links: [
      "hotels",
      "bnb",
      "gaestehaeuser",
      "ferienwohnungen",
      "campingplaetze",
    ],
  },
  {
    key: "ressourcen",
    links: ["blog", "hilfeCenter", "status", "leitfaeden", "api"],
  },
  {
    key: "unternehmen",
    links: ["ueberUns", "karriere", "partner", "kontakt", "presse"],
  },
] as const;

// Footer-Schlüssel der Produkt-Spalte → Funktions-Unterseite. Aus FUNKTIONEN
// abgeleitet, damit ein geänderter Slug nicht hier vergessen wird.
const PRODUKT_ZIELE: Record<string, string> = {
  pms: `/funktionen/${FUNKTIONEN.find((f) => f.key === "pms")?.slug ?? ""}`,
  channelManager: `/funktionen/${FUNKTIONEN.find((f) => f.key === "channel")?.slug ?? ""}`,
  direktbuchung: `/funktionen/${FUNKTIONEN.find((f) => f.key === "direkt")?.slug ?? ""}`,
  zahlungen: `/funktionen/${FUNKTIONEN.find((f) => f.key === "zahlungen")?.slug ?? ""}`,
  mobileApp: `/funktionen/${FUNKTIONEN.find((f) => f.key === "app")?.slug ?? ""}`,
};

// Unternehmens-Spalte → echte Seite. Bis eben zeigte „Über uns" auf „#";
// die Seite gibt es jetzt (app/ueber-uns), „Kontakt" seit 0414 auch
// (app/kontakt). Karriere, Partner und Presse noch nicht.
const UNTERNEHMEN_ZIELE: Record<string, string> = {
  ueberUns: "/ueber-uns",
  kontakt: "/kontakt",
};

// Ressourcen-Spalte → echte Seite. Das Hilfe-Center liegt seit dem Umzug in
// DIESER App (`app/hilfe`) und ist damit ein normaler interner Link. Vorher
// hing er an `HILFE_URL`, also an `NEXT_PUBLIC_APP_URL` — der Variable, die
// den Start der Registrierung schaltet. Weil die leer ist, zeigte der Link
// auf "#": das Hilfe-Center war 24-sprachig fertig und aus dem Footer nicht
// erreichbar. Zwei verschiedene Dinge an einem Schalter, deshalb jetzt
// getrennt.
const RESSOURCEN_ZIELE: Record<string, string> = {
  hilfeCenter: "/hilfe",
  // „API-Dokumentation" zeigte auf „#", obwohl der Eintrag in allen 24
  // Sprachen übersetzt war — der Link war da, das Ziel nicht. Seit die
  // öffentliche API existiert (eigener Service `apps/public-api`), führt er auf
  // die Entwickler-Seite dieser App. Die interaktive Referenz liegt NICHT hier,
  // sondern beim Service selbst (api.mynextdays.dk/docs); diese Seite ist die
  // Anleitung und verweist dorthin.
  api: "/entwickler",
};

// Social-Profile aus den Anbieterdaten (EINE Quelle, `content/legal/anbieter`)
// — vorher zeigten alle vier Symbole auf „#". YouTube ist raus: den Kanal gibt
// es nicht.
const SOCIALS = [
  {
    icon: "ph:facebook-logo",
    label: "Facebook",
    href: ANBIETER.social.facebook,
  },
  {
    icon: "ph:instagram-logo",
    label: "Instagram",
    href: ANBIETER.social.instagram,
  },
  {
    icon: "ph:linkedin-logo",
    label: "LinkedIn",
    href: ANBIETER.social.linkedin,
  },
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
    // Konto-Löschung (0413). Steht NICHT in RECHTSDOKUMENTE, weil das kein
    // Rechtsdokument ist, sondern ein Formular — hängt aber hier, weil Google
    // Play verlangt, dass der Weg „prominently featured and easily
    // discoverable" ist. Der Footer ist auf jeder Seite; ein Link, den man
    // nur über die Suche findet, erfüllt die Anforderung nicht.
    { label: t("kontoLoeschen"), href: "/konto-loeschen" },
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
                  // Die Produkt-Spalte zeigt seit den Funktions-Unterseiten auf
                  // echte Seiten — vorher stand dort fünfmal „#", also fünf
                  // Links, die nichts taten.
                  // Der Systemstatus ist kein normaler Link: er zeigt einen
                  // Live-Punkt und fuehrt auf eine FREMDE Adresse (Kuma).
                  // Ohne gesetzte STATUS_URL entfaellt der Eintrag ganz,
                  // statt als "#" dazustehen.
                  if (link === "status") {
                    return STATUS_URL ? (
                      <li key={link}>
                        <SystemStatus label={t("ressourcen.status")} />
                      </li>
                    ) : null;
                  }
                  const href =
                    PRODUKT_ZIELE[link] ??
                    UNTERNEHMEN_ZIELE[link] ??
                    RESSOURCEN_ZIELE[link] ??
                    "#";
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
                <a
                  key={s.label}
                  href={s.href}
                  aria-label={s.label}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-primary-foreground/70 transition-colors hover:text-primary-foreground"
                >
                  <Icon icon={s.icon} className="size-5" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
