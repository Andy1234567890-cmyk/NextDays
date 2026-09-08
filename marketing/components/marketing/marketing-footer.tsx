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
import { AGB_URL, STATUS_URL, VORANMELDUNG_ZIEL } from "@/lib/app-url";
import { APP_STORE_LINKS, STORE_KNOEPFE } from "@/lib/app-mobil";
import { SystemStatus } from "./system-status";

// Spalten: Übersetzungsschlüssel, keine fertigen Texte. `href` gibt es nur,
// wo ein echtes Ziel existiert (siehe PRODUKT_ZIELE/UNTERNEHMEN_ZIELE/
// RESSOURCEN_ZIELE) — ein Eintrag ohne Ziel gehört NICHT hier hinein, siehe
// Render-Logik unten.
//
// Live verifiziert am 24.08.2026: zehn Einträge zeigten auf "#" und taten
// nichts — ein Link, der nichts tut, ist schlechter als kein Link (dieselbe
// Entscheidung steht schon zweimal in dieser Datei: YouTube-Symbol entfernt,
// Systemstatus entfällt ohne STATUS_URL). Entfernt statt verlinkt, weil es
// die Seiten dahinter schlicht nicht gibt — es wird hier NICHTS erfunden:
//   Spalte „Lösungen" (hotels, bnb, gaestehaeuser, ferienwohnungen,
//     campingplaetze) — bräuchte fünf Objekttyp-Landingpages; die Spalte
//     ist damit KOMPLETT entfallen (eine Spaltenüberschrift ohne Einträge
//     wäre selbst wieder ein Fehler), inklusive footer.spalten.loesungen.
//   Spalte „Ressourcen": blog, leitfaeden — bräuchten einen echten Blog
//     bzw. Leitfäden-Bereich; gibt es nicht, deshalb raus.
//   Spalte „Unternehmen": karriere, partner, presse — bräuchten eine
//     Stellenseite, ein Partnerprogramm und einen Presse-Bereich; alle drei
//     nicht vorhanden, deshalb raus.
// Kommen diese Seiten später dazu, gehört der jeweilige Eintrag hier wieder
// rein UND ein Ziel in eine der *_ZIELE-Tabellen unten — nie zurück auf "#".
const FOOTER_COLUMNS = [
  {
    key: "produkt",
    links: ["pms", "channelManager", "direktbuchung", "zahlungen", "mobileApp"],
  },
  {
    key: "ressourcen",
    links: ["hilfeCenter", "status", "api"],
  },
  {
    key: "unternehmen",
    links: ["ueberUns", "partner", "kontakt"],
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
  // Partnerprogramm (0517): Programmseite mit Staffel und Bewerbung.
  partner: "/partner",
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
  // sondern beim Service selbst (open-api.mynextdays.com/docs); diese Seite ist die
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
  // sprachweise über content/legal/laden.ts geladen werden, wie inzwischen
  // alle Rechtsdokumente.
  // Hilfe liegt weiter in der web-App → absoluter Link (lib/app-url), und
  // entfällt, solange das Dashboard nicht öffentlich ist.
  const rechtlich = [
    { label: t("agb"), href: AGB_URL },
    // Partner-AGB (0517/0520): eigene Route app/partner/agb, Loader-Slug "partner-agb".
    { label: t("partnerAgb"), href: "/partner/agb" },
    ...RECHTSDOKUMENTE.map((eintrag) => ({
      label: t(RECHTS_KEYS[eintrag.slug]),
      href: `/${eintrag.slug}`,
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
        {/* Vier Link-Spalten: drei aus FOOTER_COLUMNS (die Spalte „Lösungen"
            ist am 24.08.2026 entfallen) plus „Rechtliches" ganz rechts. Die
            Rechtslinks standen bis dahin als Punkt-getrennte Kette in der
            Fußzeile unter dem Trennstrich — sechs Links in einer Reihe, auf dem
            Telefon über drei Zeilen umgebrochen. Als Spalte sind sie gleich
            gebaut wie alles andere im Footer und lesen sich als Liste. */}
        <div className="grid gap-10 lg:grid-cols-[1.5fr_repeat(4,1fr)]">
          <div>
            <Logo heightRem={2.25} dark />

            <div className="mt-5 flex flex-col gap-3">
              <p className="text-sm font-medium">{t("appLaden")}</p>
              {/* Verlinkt nur, was wirklich im Store steht: ein Knopf ohne
                  Adresse bleibt ein `<span>`, statt auf eine leere Seite zu
                  führen. Die Adressen stehen in `lib/app-mobil.ts`. */}
              <div className="flex flex-wrap gap-3">
                {STORE_KNOEPFE.map(({ store, icon, label }) => {
                  const ziel = APP_STORE_LINKS[store];
                  const klasse =
                    "flex items-center gap-2 rounded-lg border border-primary-foreground/20 px-3 py-2 text-xs";
                  const inhalt = (
                    <>
                      <Icon icon={icon} className="size-5" />
                      {label}
                    </>
                  );
                  return ziel ? (
                    <Link
                      key={store}
                      href={ziel}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${klasse} transition-opacity hover:opacity-80`}
                    >
                      {inhalt}
                    </Link>
                  ) : (
                    <span key={store} className={klasse}>
                      {inhalt}
                    </span>
                  );
                })}
              </div>
            </div>
            <p className="mt-4 max-w-xs text-sm text-primary-foreground/70">
              {t("claim")}
            </p>
            {/* Newsletter — der einzige Handlungsaufruf im Footer, deshalb
                als gefuellter Knopf in der Akzentfarbe. `#voranmeldung` oeffnet
                das Popup, das die Adresse aufnimmt (Brevo, Double-Opt-in);
                bleibt das JavaScript aus, passiert nichts Schlimmeres als ein
                Anker, der auf der Seite bleibt. */}
            <Link
              href={VORANMELDUNG_ZIEL}
              data-cta="newsletter"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
            >
              <Icon icon="ph:envelope-simple" className="size-4" />
              {t("newsletterKnopf")}
            </Link>
          </div>

          {FOOTER_COLUMNS.map((col) => (
            <div key={col.key}>
              <p className="text-sm font-semibold">{t(`spalten.${col.key}`)}</p>
              <ul className="mt-4 flex flex-col gap-3">
                {col.links.map((link) => {
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
                  // Bewusst KEIN `?? "#"` mehr: ein Eintrag ohne echtes Ziel
                  // in einer der drei *_ZIELE-Tabellen wird nicht gerendert,
                  // statt strukturell auf "#" zu landen. Damit kann FOOTER_COLUMNS
                  // künftig keinen toten Link mehr erzeugen, selbst wenn jemand
                  // dort einen Schlüssel ergänzt, für den noch kein Ziel existiert.
                  const href =
                    PRODUKT_ZIELE[link] ??
                    UNTERNEHMEN_ZIELE[link] ??
                    RESSOURCEN_ZIELE[link];
                  if (!href) {
                    return null;
                  }
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

          {/* Rechtliches — dieselbe Machart wie die Spalten darüber. Die Liste
              kommt aus `rechtlich`, also aus derselben Registry, die auch
              Sitemap und llms.txt lesen; sie wird hier nicht zweitens
              aufgeschrieben. */}
          <div>
            <p className="text-sm font-semibold">{t("spalten.rechtliches")}</p>
            <ul className="mt-4 flex flex-col gap-3">
              {rechtlich.map((r) => (
                <li key={r.href}>
                  <Link
                    href={r.href}
                    className="text-sm text-primary-foreground/70 transition-colors hover:text-primary-foreground"
                  >
                    {r.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-6 border-t border-primary-foreground/15 pt-8 sm:flex-row">
          {/* Nur noch der Copyright-Hinweis. Die Rechtslinks stehen jetzt in
              ihrer eigenen Spalte oben — hier wären sie ein zweites Mal
              dasselbe Ziel, und doppelte Links auf einer Seite sind für
              Screenreader wie für Suchmaschinen Rauschen. */}
          <div className="text-sm text-primary-foreground/60">
            <span>{t("copyright")}</span>
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
