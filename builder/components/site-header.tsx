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
import { sprachenDerSite } from "@/lib/sprache";
import { texte } from "@/lib/texte";
import { BUTTON_KLASSEN, themeOf } from "@/lib/theme";

import { Logo } from "./logo";
import { SprachWaehler } from "./sprach-waehler";

/** Menü-Slug → Pfad. Leerer Slug ist die Startseite. */
function pfad(slug: string): string {
  return slug ? `/${slug}` : "/";
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
}: {
  branding: SiteBranding | null | undefined;
  hoehe: number;
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
    <Link href={ziel} className={klasse}>
      {inhalt}
    </Link>
  );
}

function NavLinks({
  nav,
  aktiverSlug,
  senkrecht = false,
}: {
  nav: NavItem[];
  aktiverSlug?: string;
  senkrecht?: boolean;
}) {
  if (nav.length === 0) return null;
  return (
    <nav
      className={
        senkrecht
          ? "flex flex-col gap-1 text-sm"
          : "flex flex-wrap items-center gap-x-6 gap-y-2 text-sm"
      }
    >
      {nav.map((item) => (
        <NavEintrag
          key={item.external_url ?? item.slug}
          item={item}
          aktiverSlug={aktiverSlug}
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
}: {
  item: NavItem;
  aktiverSlug?: string;
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
      href={pfad(item.slug)}
      aria-current={item.slug === aktiverSlug ? "page" : undefined}
      className={klasse}
    >
      {item.title}
    </Link>
  );
}

function BuchenKnopf({ sprache }: { sprache: string }) {
  // Der Text gehört zum Skelett, nicht zum Kundeninhalt — und steht deshalb im
  // Katalog des Renderers (lib/texte.ts), in der Sprache der Website. Vorher
  // stand hier ein festes „Jetzt buchen", auf jeder Kundenseite, auch der
  // dänischen.
  return (
    <Link href="/" className={BUTTON_KLASSEN}>
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
      sprachen={sprachenDerSite(branding)}
      aktiv={sprache}
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
          <LogoBlock branding={branding} hoehe={2.5} />
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
            <NavLinks nav={nav} aktiverSlug={aktiverSlug} />
            {waehler}
            <BuchenKnopf sprache={sprache} />
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
          <LogoBlock branding={branding} hoehe={2.25} />
          <div className="flex items-center gap-6">
            <NavLinks nav={nav} aktiverSlug={aktiverSlug} />
            {waehler}
            <BuchenKnopf sprache={sprache} />
          </div>
        </div>
      </header>
    );
  }

  if (theme === "seitlich") {
    // Auf schmalen Schirmen wird die Leiste wieder waagerecht — ein zweiter,
    // von Hand gepflegter Mobil-Entwurf wäre doppelte Arbeit und die häufigste
    // Ursache für „sieht auf dem Handy kaputt aus".
    return (
      <header
        style={stil}
        className={`border-b border-border ${eigenerKopfGrund(branding) ? "" : "bg-background "}md:sticky md:top-0 md:z-50 md:h-screen md:w-64 md:shrink-0 md:border-b-0 md:border-r`}
      >
        <div className="flex items-center justify-between gap-4 px-6 py-4 md:h-full md:flex-col md:items-start md:justify-start md:gap-8 md:py-8">
          <LogoBlock branding={branding} hoehe={2.25} />
          <div className="flex items-center gap-6 md:flex-1 md:flex-col md:items-start md:gap-8">
            <NavLinks nav={nav} aktiverSlug={aktiverSlug} senkrecht />
            {waehler}
            <BuchenKnopf sprache={sprache} />
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
        <LogoBlock branding={branding} hoehe={2.25} />
        <div className="flex items-center gap-6">
          <NavLinks nav={nav} aktiverSlug={aktiverSlug} />
          {waehler}
          <BuchenKnopf sprache={sprache} />
        </div>
      </div>
    </header>
  );
}
