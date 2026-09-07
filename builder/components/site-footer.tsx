// Fußzeile einer Kunden-Site: Marke, Fußzeilen-Menü, Social-Links.
//
// Das Fußzeilen-Menü ist eine EIGENE Achse (`nav.footer`, 0421) — Impressum,
// Datenschutz und AGB gehören dorthin und nicht in die Kopfzeile. Vorher gab es
// diese Achse nicht: rechtliche Seiten waren entweder in der Hauptnavigation
// oder unerreichbar.
//
// KEIN myBestDays-Marktplatz-Inhalt, keine festen Reiseziele. Inhalte gehören in
// einen Abschnitt der Seite.
import Link from "next/link";
import type { ReactNode } from "react";

import {
  regionLesen,
  sichtbarkeitKlassen,
  teilStand,
  teileReihenfolge,
} from "@nextdays/baukasten-stil";
import { mitSprache } from "@/lib/sprache";

import type { NavItem, SiteBranding } from "@/lib/site-context";
import { BildnachweisListe } from "./blocks/bildnachweis";
import { themeOf } from "@/lib/theme";

// Social-Netzwerke, die wir in der Fußzeile zeigen. Reihenfolge = Anzeigeordnung;
// nur Schlüssel aus dieser Liste werden gerendert, damit ein beliebiger Eintrag
// in `social_links` keinen unbekannten Link in die Seite schreibt.
const SOCIAL: Array<{ key: string; label: string }> = [
  { key: "instagram", label: "Instagram" },
  { key: "facebook", label: "Facebook" },
  { key: "youtube", label: "YouTube" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "pinterest", label: "Pinterest" },
  { key: "tiktok", label: "TikTok" },
];

/** Nur http(s) durchlassen. Die Werte stammen aus Kundeneingabe und landen in
 *  einem href — ein `javascript:`-Schema darf hier nicht ankommen (Wurzel 8).
 *  Das Backend validiert beim Speichern; dies ist der Backstop beim Rendern. */
function sichereUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim();
  return /^https?:\/\//i.test(v) ? v : null;
}

function pfad(slug: string, sprache?: string, standard?: string | null): string {
  // Die Sprachwahl MIT ins Ziel — dieselbe Regel wie in der Kopfzeile. Ohne
  // sie fiel jeder Fußzeilen-Link auf die Standardsprache zurück.
  return mitSprache(slug ? `/${slug}` : "/", sprache, standard);
}

export function SiteFooter({
  branding,
  nav,
  jahr,
  sprache,
  editor = false,
}: {
  branding: SiteBranding | null | undefined;
  nav: NavItem[];
  /** Anzeigejahr. Wird vom Aufrufer übergeben, damit der Renderer keine eigene
   *  Uhr befragt und der Wert im Server-Render stabil bleibt. */
  jahr: number;
  /** Sprache der Site — nur für die Überschrift über den Bildnachweisen. */
  sprache: string;
  /** Im Editor-iframe (0570): Fußzeile und Teile tragen `data-region`/
   *  `data-teil`, ausgeblendete Teile stehen durchscheinend statt weg. */
  editor?: boolean;
}) {
  const theme = themeOf(branding);
  // Fußzeile als Ebene (0570): Sichtbarkeit, Sperre, Reihenfolge der Teile.
  const teile = regionLesen("fusszeile", branding?.footer_teile);
  const social = SOCIAL.map((s) => ({
    ...s,
    url: sichereUrl(branding?.social_links?.[s.key]),
  })).filter((s) => s.url);

  // Beim seitlichen Skelett steht der Inhalt in einer Spalte rechts — die
  // Fußzeile bleibt linksbündig statt zentriert, sonst kippt die Optik.
  const zentriert = theme !== "seitlich";

  // Die vier Teile der Fußzeile. Ein Teil ohne Inhalt (kein Menü, keine
  // Social-Links) rendert `null` — und bekommt dann auch keinen Rahmen, sonst
  // stünde im Editor ein leeres, anklickbares Nichts.
  const teilInhalt: Record<string, ReactNode> = {
    navigation:
      nav.length > 0 ? (
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
          {nav.map((item) => (
            <Link
              key={item.slug}
              href={pfad(item.slug, sprache, branding?.default_language)}
              className="font-medium text-foreground/80 transition hover:text-primary"
            >
              {item.title}
            </Link>
          ))}
        </nav>
      ) : null,
    social:
      social.length > 0 ? (
        <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
          {social.map((s) => (
            <li key={s.key}>
              <a
                href={s.url as string}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="text-muted-foreground transition hover:text-primary"
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      ) : null,
    // Die Bildnachweise der Stock-Fotos (Unsplash/Pexels).
    // Sie stehen hier ZUSÄTZLICH zur Nennung am jeweiligen Bild, und das
    // mit Absicht: die Nennung am Bild ist die richtige Stelle, aber sie
    // hängt an jeder einzelnen Anzeigestelle des Baukastens — eine, die
    // sie vergisst, macht die Kundenseite vertragsbrüchig, ohne dass man
    // der Seite etwas ansieht. Diese Liste hängt dagegen am RAHMEN und
    // kann von einem neuen Blocktyp nicht vergessen werden. Ohne
    // nachweispflichtige Bilder rendert sie nichts.
    bildnachweise: <BildnachweisListe branding={branding} sprache={sprache} />,
    copyright: (
      <div className="text-sm text-muted-foreground">
        <p>
          © {jahr} {branding?.site_name ?? ""}
        </p>
        <p className="text-xs">Powered by myNextDays</p>
      </div>
    ),
  };

  return (
    <footer
      data-region={editor ? "fusszeile" : undefined}
      // Eigene Fußzeilen-Farbe, falls gesetzt (0426). Ist keine gesetzt, bleibt
      // `bg-secondary/30`; beides gleichzeitig würde um dieselbe Eigenschaft
      // streiten, deshalb fällt die Klasse dann weg.
      style={
        branding?.footer_background
          ? { backgroundColor: branding.footer_background }
          : undefined
      }
      className={
        "mt-auto border-t border-border" +
        (branding?.footer_background ? "" : " bg-secondary/30") +
        " " +
        sichtbarkeitKlassen(teile.hidden_on, editor)
      }
    >
      <div
        className={
          "mx-auto flex max-w-7xl flex-col gap-4 px-6 py-10 " +
          (zentriert ? "items-center text-center" : "items-start text-left")
        }
      >
        {/* Die Teile in der eingestellten Reihenfolge (`footer_teile`). Jeder
            ist ein eigener Rahmen mit Marker für den Ebenen-Baum und seinen
            Sichtbarkeitsklassen — live weg, im Editor durchscheinend. */}
        {teileReihenfolge(teile).map((name) => {
          const inhalt = teilInhalt[name];
          if (!inhalt) return null;
          return (
            <div
              key={name}
              data-teil={editor ? name : undefined}
              className={sichtbarkeitKlassen(teilStand(teile, name).hidden_on, editor)}
            >
              {inhalt}
            </div>
          );
        })}
      </div>
    </footer>
  );
}
