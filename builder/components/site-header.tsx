// Kopfzeile einer Kunden-Site — vier Skelette, ein Datensatz.
//
// Das Theme bestimmt AUSSCHLIESSLICH die Anordnung von Logo, Menü und Knopf:
//   klar     Logo links,  Menü rechts (Standard)
//   mitte    Logo zentriert, Menü darunter
//   karte    Kopfzeile als abgesetzte Karte über dem Inhalt
//   seitlich vertikale Leiste links (auf schmalen Schirmen wieder waagerecht)
// Farben, Schriften und Button-Form kommen unabhängig davon aus den Tokens
// (lib/theme) — genau deshalb kann der Kunde ein Theme wechseln, ohne seine
// Marke neu einstellen zu müssen.
//
// Die Navigation kommt aus `nav.header` des Resolvers. Vorher zeigte diese
// Kopfzeile nur das Logo und einen fest eincodierten Knopf: jede Unterseite, die
// der Kunde anlegte, war für Gäste unerreichbar. Fehlt ein Menü, entfällt es —
// es wird KEIN Platzhalter-Eintrag erfunden (Wurzel 4).
//
// Bewusst KEINE Marktplatz-Elemente (keine globale Suchpille, kein „myBestDays
// für Gastgeber") — die Seite gehört dem Betrieb, nicht dem Marktplatz.
import Link from "next/link";

import type { NavItem, SiteBranding } from "@/lib/site-context";
import { mitSprache } from "@/lib/sprache";
import { texte } from "@/lib/texte";
import { BUTTON_KLASSEN, themeOf } from "@/lib/theme";

import { Logo } from "./logo";
import { SprachWaehler } from "./sprach-waehler";

/** Menü-Slug → Pfad. Leerer Slug ist die Startseite. */
function pfad(slug: string, sprache?: string, standard?: string | null): string {
  const ziel = slug ? `/${slug}` : "/";
  // Die Sprachwahl MIT ins Ziel. Ohne sie hielt die Wahl genau einen
  // Seitenaufruf: der Gast stellte oben auf Dänisch, klickte einen Menüpunkt,
  // und die Zielseite fiel auf die Standardsprache zurück — der Wähler in
  // derselben Kopfzeile war damit eine Attrappe.
  return mitSprache(ziel, sprache, standard);
}

/** Das Menü auf schmalen Schirmen: ein Burger, der eine Liste ausklappt.
 *
 *  ES GAB KEINES. Die Menüpunkte standen auf dem Handy als `flex-wrap`
 *  untereinander neben dem Logo, in einer Kopfzeile mit FESTER Höhe (`h-20`) —
 *  sie liefen also aus ihr heraus, und der letzte Punkt saß auf der Unterkante.
 *  Mit drei Einträgen fiel das kaum auf, mit fünf ist die Kopfzeile kaputt
 *  (Prüfbericht B9). Nur das Theme „seitlich" hatte überhaupt eine Schwelle.
 *
 *  `<details>` und kein Zustand: diese Kopfzeile ist eine SERVER-Komponente
 *  (die ganze Datei trägt kein `"use client"`), und ein Menü, das ohne ein Byte
 *  JavaScript aufklappt, ist auf einer Gästeseite die robustere Antwort —
 *  dasselbe Muster wie im Sprachwähler.
 *
 *  Es rendert NUR unter `md`; darüber steht die waagerechte Liste wie bisher.
 *  Beide gleichzeitig zu zeigen wäre dieselbe Navigation doppelt im Markup. */
function BurgerMenue({
  nav,
  aktiverSlug,
  sprache,
  standard,
  beschriftung,
  breiteSchwelle = false,
  mittig = false,
}: {
  nav: NavItem[];
  aktiverSlug?: string;
  sprache?: string;
  standard?: string | null;
  beschriftung: string;
  /** Bis zu welcher Breite der Burger steht. „seitlich" klappt erst bei
   *  1090 px in seine Leiste um, alle anderen Themes bei `md`. */
  breiteSchwelle?: boolean;
  /** true = der Burger sitzt MITTIG in seiner Zeile (Theme „mitte"). Dann geht
   *  die Klappe zu beiden Seiten auf statt nach links. */
  mittig?: boolean;
}) {
  if (nav.length === 0) return null;
  return (
    <details
      className={`group/burger relative ${
        breiteSchwelle ? "min-[68.125rem]:hidden" : "md:hidden"
      }`}
    >
      <summary
        aria-label={beschriftung}
        title={beschriftung}
        className="flex size-9 cursor-pointer list-none items-center justify-center rounded-(--radius) border border-border [&::-webkit-details-marker]:hidden"
      >
        {/* Zwei Zustände aus CSS statt aus JavaScript: `group-open` schaltet
            die Striche auf ein Kreuz. */}
        <span aria-hidden className="relative block h-3 w-4">
          <span className="absolute inset-x-0 top-0 h-0.5 bg-current transition group-open/burger:top-1/2 group-open/burger:rotate-45" />
          <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-current transition group-open/burger:opacity-0" />
          <span className="absolute inset-x-0 bottom-0 h-0.5 bg-current transition group-open/burger:bottom-1/2 group-open/burger:-rotate-45" />
        </span>
      </summary>
      {/* WOHIN die Klappe aufgeht, entscheidet das Theme.
          Sie war fest `right-0` und 208 px breit (`min-w-52`), also rechtsbündig
          an der rechten Kante des Burgers. Sitzt der Burger nicht rechts, lief
          sie damit nach LINKS aus dem Bild: bei Theme „mitte" war sie eine leere
          weiße Fläche, weil alle drei Punkte außerhalb standen, bei „karte"
          fehlten die ersten Buchstaben (Nachprüfung B9, gemessen bei 390 px; ab
          etwa 500 px passte es zufällig wieder — ein echtes Telefon liegt mit
          375–430 px darunter).
          Ein `fixed` gegen das Fenster wäre hier NICHT die Lösung: jede
          Kopfzeile trägt `backdrop-blur`, und `backdrop-filter` erzeugt einen
          eigenen Bezugsrahmen — `fixed` hinge dann doch an der Kopfzeile.
          Also sagt der Aufrufer, wo sein Burger steht. */}
      <div
        className={
          "absolute z-50 mt-2 min-w-52 max-w-[calc(100vw-1.5rem)] rounded-(--radius) border border-border bg-background p-3 shadow-lg " +
          (mittig ? "left-1/2 -translate-x-1/2" : "right-0")
        }
      >
        <NavLinks
          nav={nav}
          aktiverSlug={aktiverSlug}
          senkrecht
          sprache={sprache}
          standard={standard}
        />
      </div>
    </details>
  );
}

export type SiteHeaderProps = {
  branding: SiteBranding | null | undefined;
  nav: NavItem[];
  /** Slug der aktuell gezeigten Seite — markiert den Menüpunkt. */
  aktiverSlug?: string;
  /** Sprache, in der gerendert wird. */
  sprache: string;
};

/** Eigene Kopfzeilen-Farben, wenn der Kunde sie gesetzt hat (0426).
 *
 *  Als Inline-Style und nicht als Tailwind-Klasse, weil die Werte aus der DB
 *  kommen (Repo-Regel: keine arbitrary Hex-Werte im Markup). Ist keine Farbe
 *  gesetzt, bleibt das Objekt LEER und die vorhandenen Klassen
 *  (`bg-background/90`) gelten weiter — kein erfundener Ersatzwert, und
 *  insbesondere kein deckendes Weiß, das die Transparenz der Kopfzeile
 *  stillschweigend abschaltet. */
function kopfStil(branding: SiteBranding | null | undefined) {
  const stil: Record<string, string> = {};
  if (branding?.header_background) {
    stil.backgroundColor = branding.header_background;
  }
  if (branding?.header_link_color) stil.color = branding.header_link_color;
  return stil;
}

/** Hat die Kopfzeile eine eigene Hintergrundfarbe? Dann darf die
 *  Tailwind-Hintergrundklasse nicht dagegen anlaufen. */
function eigenerKopfGrund(branding: SiteBranding | null | undefined): boolean {
  return Boolean(branding?.header_background);
}

function LogoBlock({
  branding,
  hoehe,
  sprache,
}: {
  branding: SiteBranding | null | undefined;
  hoehe: number;
  /** Die gewählte Sprache — nur für ein INTERNES Logo-Ziel. Zeigt das Logo auf
   *  eine fremde Domain, bleibt sie weg: die kennt unseren Parameter nicht. */
  sprache?: string;
}) {
  // Klickziel des Logos. Normalerweise die Startseite; ein Betrieb mit mehreren
  // Sites kann auf seine Hauptseite zeigen (0426). Die Adresse ist beim
  // Speichern gegen die Schema-Allowlist geprüft.
  const ziel = branding?.logo_link_url?.trim() || "/";
  const extern = /^https?:\/\//i.test(ziel);
  const inhalt = (
    <>
      <Logo
        src={branding?.logo_url}
        alt={branding?.site_name}
        heightRem={hoehe * (branding?.logo_scale ?? 1)}
      />
      {/* Ohne Logo trägt der Name die Kopfzeile. Fehlt beides, bleibt die
          Stelle leer — es wird KEINE fremde Marke eingesetzt. */}
      {!branding?.logo_url && branding?.site_name ? (
        <span
          className="font-semibold tracking-tight"
          // Eigene Familie, Größe und Farbe, falls gesetzt (0426). Die
          // Variablen sind nur dann definiert, wenn der Kunde sie gewählt hat
          // — der zweite Wert in var() ist deshalb kein Ersatzwert, sondern der
          // vorherige Zustand dieser Stelle.
          style={{
            fontFamily: "var(--font-logo-name, var(--font-display))",
            fontSize: "var(--logo-name-size, 1.125rem)",
            color: "var(--brand-name, inherit)",
          }}
        >
          {branding.site_name}
        </span>
      ) : null}
    </>
  );
  const klasse = "flex shrink-0 items-center gap-3";
  // Ein externes Ziel ist kein Next-Route-Wechsel: `Link` würde versuchen, es
  // clientseitig zu übernehmen, und `prefetch` liefe gegen eine fremde Domain.
  return extern ? (
    <a href={ziel} className={klasse} rel="noopener">
      {inhalt}
    </a>
  ) : (
    <Link
      href={mitSprache(ziel, sprache, branding?.default_language)}
      className={klasse}
    >
      {inhalt}
    </Link>
  );
}

function NavLinks({
  nav,
  aktiverSlug,
  senkrecht = false,
  nurAbMd = false,
  nurAbBreit = false,
  sprache,
  standard,
}: {
  nav: NavItem[];
  aktiverSlug?: string;
  senkrecht?: boolean;
  /** Erst ab `md` zeigen — darunter übernimmt `BurgerMenue` (B9). */
  nurAbMd?: boolean;
  /** Wie `nurAbMd`, aber mit der eigenen Schwelle des Themes „seitlich"
   *  (1090 px = Hostaways Wert, siehe unten). Zwei Namen und kein freier
   *  Klassen-String: Tailwind erkennt zusammengesetzte Klassen beim Bauen
   *  nicht, und die Klasse fehlte dann im CSS. */
  nurAbBreit?: boolean;
  sprache?: string;
  standard?: string | null;
}) {
  if (nav.length === 0) return null;
  return (
    <nav
      className={
        senkrecht
          ? `${nurAbBreit ? "hidden min-[68.125rem]:flex" : "flex"} flex-col gap-1 text-sm`
          : `${nurAbMd ? "hidden md:flex" : "flex"} flex-wrap items-center gap-x-6 gap-y-2 text-sm`
      }
    >
      {nav.map((item) => (
        <NavEintrag
          key={item.external_url ?? item.slug}
          item={item}
          aktiverSlug={aktiverSlug}
          sprache={sprache}
          standard={standard}
        />
      ))}
    </nav>
  );
}

/** Ein Menüpunkt: Seite, externer Link oder Ordner (0433).
 *
 *  Drei Formen, weil es drei Dinge sind — und die Unterschiede sind für den Gast
 *  sichtbar:
 *
 *  * Eine SEITE ist ein `Link` (Next-Navigation, kein Neuladen).
 *  * Ein EXTERNER Punkt ist ein `<a>` mit `target="_blank"` und
 *    `rel="noopener noreferrer"`. Ohne `noopener` kann die fremde Seite über
 *    `window.opener` auf die Kundenseite zugreifen; ohne `noreferrer` erfährt
 *    sie, von welcher Unterseite der Gast kam. Das kleine Symbol daneben ist
 *    keine Zierde: es sagt vorher, dass ein neues Fenster aufgeht.
 *  * Ein ORDNER ist kein Link, sondern eine Gruppe. `<details>`/`<summary>`
 *    statt eines Hover-Menüs: das bringt Tastaturbedienung und
 *    Screenreader-Ansage mit und funktioniert auf dem Telefon, wo es kein
 *    Hover gibt. */
function NavEintrag({
  item,
  aktiverSlug,
  sprache,
  standard,
}: {
  item: NavItem;
  aktiverSlug?: string;
  /** Die gewählte Sprache — wandert an jedes INTERNE Ziel mit. Externe Links
   *  bekommen sie nicht: eine fremde Seite kennt unseren Parameter nicht. */
  sprache?: string;
  standard?: string | null;
}) {
  const klasse =
    "font-medium transition hover:text-primary " +
    (item.slug === aktiverSlug ? "text-primary" : "text-foreground/80");

  if (item.is_folder) {
    const kinder = item.children ?? [];
    if (kinder.length === 0) return null;
    return (
      <details className="group relative">
        <summary className={`${klasse} cursor-pointer list-none`}>
          {item.title}
          <span aria-hidden className="pl-1 text-xs">
            ▾
          </span>
        </summary>
        <div className="absolute left-0 top-full z-20 mt-2 flex min-w-44 flex-col gap-1 rounded-xl border border-border bg-background p-2 shadow-lg">
          {kinder.map((kind) => (
            <NavEintrag
              key={kind.external_url ?? kind.slug}
              item={kind}
              aktiverSlug={aktiverSlug}
              sprache={sprache}
              standard={standard}
            />
          ))}
        </div>
      </details>
    );
  }

  if (item.external_url) {
    return (
      <a
        href={item.external_url}
        target="_blank"
        rel="noopener noreferrer"
        className={klasse}
      >
        {item.title}
        <span aria-hidden className="pl-1 text-xs">
          ↗
        </span>
      </a>
    );
  }

  return (
    <Link
      href={pfad(item.slug, sprache, standard)}
      aria-current={item.slug === aktiverSlug ? "page" : undefined}
      className={klasse}
    >
      {item.title}
    </Link>
  );
}

function BuchenKnopf({
  sprache,
  standard,
}: {
  sprache: string;
  standard?: string | null;
}) {
  // Der Text gehört zum Skelett, nicht zum Kundeninhalt — und steht deshalb im
  // Katalog des Renderers (lib/texte.ts), in der Sprache der Website. Vorher
  // stand hier ein festes „Jetzt buchen", auf jeder Kundenseite, auch der
  // dänischen.
  return (
    <Link href={mitSprache("/", sprache, standard)} className={BUTTON_KLASSEN}>
      {texte(sprache).jetztBuchen}
    </Link>
  );
}

export function SiteHeader({
  branding,
  nav,
  aktiverSlug,
  sprache,
}: SiteHeaderProps) {
  const theme = themeOf(branding);
  const stil = kopfStil(branding);
  // Die Hintergrundklasse fällt weg, sobald der Kunde eine eigene Farbe gesetzt
  // hat: `bg-background/90` und ein Inline-`backgroundColor` würden sonst um
  // dieselbe Eigenschaft streiten, und wer gewinnt, hängt an der Reihenfolge im
  // Stylesheet — also am Zufall.
  const grund = eigenerKopfGrund(branding) ? "" : "bg-background/90 ";
  const waehler = (
    <SprachWaehler
      // Die EINGERICHTETEN Sprachen, nicht der 24er-Rückfall aus
      // `sprachenDerSite`.
      //
      // Der Rückfall ist dort richtig — er beantwortet „was darf ein Besucher
      // überhaupt wählen". Hier wäre er falsch: seit 0476 leitet die
      // Middleware jede nicht geführte Sprachadresse per 301 auf den Pfad ohne
      // Präfix. Ein Wähler mit 24 Einträgen böte also 21 Klicks an, die
      // sichtbar nichts tun.
      sprachen={(branding?.languages ?? []).filter((l) => l.length === 2)}
      aktiv={sprache}
      standard={branding?.default_language}
      beschriftung={texte(sprache).spracheWaehlen}
    />
  );

  if (theme === "mitte") {
    return (
      <header
        style={stil}
        className={`sticky top-0 z-50 border-b border-border ${grund}backdrop-blur`}
      >
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 px-6 py-4">
          <LogoBlock branding={branding} hoehe={2.5} sprache={sprache} />
          {branding?.tagline ? (
            <p
              className="text-center text-sm text-muted-foreground"
              // Eigene Schrift für den Slogan, falls gewählt (0426).
              style={{ fontFamily: "var(--font-slogan, inherit)" }}
            >
              {branding.tagline}
            </p>
          ) : null}
          <div className="flex w-full items-center justify-center gap-6 border-t border-border pt-3">
            {/* Ab `md` die waagerechte Liste, darunter der Burger — die
                Liste lief auf dem Handy aus der Kopfzeile heraus (B9). */}
            <NavLinks
              nav={nav}
              aktiverSlug={aktiverSlug}
              sprache={sprache}
              standard={branding?.default_language}
              nurAbMd
            />
            <BurgerMenue
              nav={nav}
              aktiverSlug={aktiverSlug}
              sprache={sprache}
              standard={branding?.default_language}
              beschriftung={texte(sprache ?? "de").menueOeffnen}
              // Hier steht der Burger MITTIG (`justify-center`), nicht rechts.
              // Eine rechtsbündige Klappe lief von dort nach links aus dem
              // Bild und war bei 390 px eine leere weiße Fläche (B9).
              mittig
            />
            {waehler}
            <BuchenKnopf
              sprache={sprache}
              standard={branding?.default_language}
            />
          </div>
        </div>
      </header>
    );
  }

  if (theme === "karte") {
    return (
      <header className="sticky top-0 z-50 px-4 pt-4">
        <div
          style={stil}
          className={`mx-auto flex max-w-7xl items-center justify-between gap-4 rounded-3xl border border-border ${eigenerKopfGrund(branding) ? "" : "bg-background/95 "}px-6 py-3 shadow-sm backdrop-blur`}
        >
          <LogoBlock branding={branding} hoehe={2.25} sprache={sprache} />
          <div className="flex items-center gap-6">
            {/* Ab `md` die waagerechte Liste, darunter der Burger — die
                Liste lief auf dem Handy aus der Kopfzeile heraus (B9). */}
            <NavLinks
              nav={nav}
              aktiverSlug={aktiverSlug}
              sprache={sprache}
              standard={branding?.default_language}
              nurAbMd
            />
            <BurgerMenue
              nav={nav}
              aktiverSlug={aktiverSlug}
              sprache={sprache}
              standard={branding?.default_language}
              beschriftung={texte(sprache ?? "de").menueOeffnen}
            />
            {waehler}
            <BuchenKnopf
              sprache={sprache}
              standard={branding?.default_language}
            />
          </div>
        </div>
      </header>
    );
  }

  if (theme === "seitlich") {
    // Auf schmalen Schirmen wird die Leiste wieder waagerecht — ein zweiter,
    // von Hand gepflegter Mobil-Entwurf wäre doppelte Arbeit und die häufigste
    // Ursache für „sieht auf dem Handy kaputt aus".
    //
    // Die Schwelle ist 68.125rem (1090 px) und NICHT Tailwinds `md` (768 px):
    // eine senkrechte Leiste mit Menü UND Buchen-Knopf braucht mehr Breite als
    // ein waagerechtes Menü, sonst quetscht sie sich schon auf einem kleinen
    // Laptop zusammen. 1090 px ist Hostaways eigene Schwelle für sein
    // Seitenleisten-Layout (live abgelesen, 0468) — keine erfundene Zahl.
    return (
      <header
        style={stil}
        className={`border-b border-border ${eigenerKopfGrund(branding) ? "" : "bg-background "}min-[68.125rem]:sticky min-[68.125rem]:top-0 min-[68.125rem]:z-50 min-[68.125rem]:h-screen min-[68.125rem]:w-64 min-[68.125rem]:shrink-0 min-[68.125rem]:border-b-0 min-[68.125rem]:border-r`}
      >
        <div className="flex items-center justify-between gap-4 px-6 py-4 min-[68.125rem]:h-full min-[68.125rem]:flex-col min-[68.125rem]:items-start min-[68.125rem]:justify-start min-[68.125rem]:gap-8 min-[68.125rem]:py-8">
          <LogoBlock branding={branding} hoehe={2.25} sprache={sprache} />
          <div className="flex items-center gap-6 min-[68.125rem]:flex-1 min-[68.125rem]:flex-col min-[68.125rem]:items-start min-[68.125rem]:gap-8">
            {/* Ab 1090 px die senkrechte Leiste, darunter der Burger: bis
                dahin ist die Kopfzeile waagerecht, und eine senkrechte Liste
                darin schob Menüpunkte übereinander (B9). */}
            <NavLinks
              nav={nav}
              aktiverSlug={aktiverSlug}
              senkrecht
              nurAbBreit
              sprache={sprache}
              standard={branding?.default_language}
            />
            <BurgerMenue
              nav={nav}
              aktiverSlug={aktiverSlug}
              sprache={sprache}
              standard={branding?.default_language}
              beschriftung={texte(sprache ?? "de").menueOeffnen}
              breiteSchwelle
            />
            {waehler}
            <BuchenKnopf
              sprache={sprache}
              standard={branding?.default_language}
            />
          </div>
        </div>
      </header>
    );
  }

  // klar (Standard)
  return (
    <header
      style={stil}
      className={`sticky top-0 z-50 border-b border-border ${grund}backdrop-blur`}
    >
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-6">
        <LogoBlock branding={branding} hoehe={2.25} sprache={sprache} />
        <div className="flex items-center gap-6">
          {/* Ab `md` die waagerechte Liste, darunter der Burger (B9). */}
          <NavLinks
            nav={nav}
            aktiverSlug={aktiverSlug}
            sprache={sprache}
            standard={branding?.default_language}
            nurAbMd
          />
          <BurgerMenue
            nav={nav}
            aktiverSlug={aktiverSlug}
            sprache={sprache}
            standard={branding?.default_language}
            beschriftung={texte(sprache ?? "de").menueOeffnen}
          />
          {waehler}
          <BuchenKnopf
              sprache={sprache}
              standard={branding?.default_language}
            />
        </div>
      </div>
    </header>
  );
}
