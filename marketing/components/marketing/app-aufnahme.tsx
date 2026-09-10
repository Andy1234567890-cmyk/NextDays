"use client";

// Echter Screenshot der App, gerahmt wie ein Programmfenster.
//
// Die Bilder entstehen mit `web/scripts/marketing-aufnahmen.mjs` aus einem
// geseedeten Demo-Betrieb — belegte Kalender, Buchungen aus allen Kanälen,
// echte Objektfotos. Deshalb steht hier ein Foto der Software und keine aus
// <div>s nachgebaute Attrappe.
//
// Der Rahmen ist Gestaltung, kein abfotografiertes Browserfenster: die Aufnahme
// selbst zeigt weder Tabs noch Adresszeile noch „localhost".
import Image from "next/image";
import { useLocale } from "next-intl";

import VORHANDEN from "@/lib/app-aufnahmen.json";

// Reihenfolge der Ersatzsprachen: erst die Sprache des Besuchers, dann
// Englisch, dann Deutsch. Ein englischer Screenshot ist verständlich; ein
// fehlendes Bild ist ein Loch in der Seite.
const ERSATZSPRACHEN = ["en", "de"];

// Die echten Pixelmaße stehen JE DATEI im Katalog — nicht als zwei
// Konstanten hier. Der Grund ist gemessen: `mobil-kalender` ist 860 × 1864,
// und eine nachträglich beschnittene Aufnahme (Rollbalken entfernt) ist
// niedriger als 2000. Mit einem festen Maß reserviert Next den falschen Platz,
// und die Seite springt beim Laden.
type Aufnahme = { breite: number; hoehe: number };
const KATALOG = VORHANDEN as Record<string, Aufnahme>;

/** Beste tatsächlich vorhandene Datei für Motiv/Thema/Sprache, sonst null.
 *
 * Die Liste entsteht beim Aufnahmelauf aus dem Verzeichnis
 * (`web/scripts/marketing-aufnahmen.mjs`). Fehlt eine Kombination — etwa weil
 * ein Lauf abgebrochen ist —, weicht die Seite auf eine vorhandene aus, statt
 * ein 404-Bild zu rendern. */
function datei(
  name: string,
  thema: "light" | "dark",
  sprache: string,
): { pfad: string; breite: number; hoehe: number } | null {
  const gegenthema = thema === "light" ? "dark" : "light";
  const kandidaten = [
    ...[sprache, ...ERSATZSPRACHEN].map((s) => `${name}-${thema}-${s}@2x.webp`),
    // Erst wenn es das Motiv im gewünschten Thema in KEINER Sprache gibt, das
    // andere Thema nehmen — lieber die falsche Helligkeit als kein Bild.
    ...[sprache, ...ERSATZSPRACHEN].map((s) => `${name}-${gegenthema}-${s}@2x.webp`),
  ];
  const treffer = kandidaten.find((k) => k in KATALOG);
  if (!treffer) return null;
  const { breite, hoehe } = KATALOG[treffer];
  return { pfad: `/marketing/app/${treffer}`, breite, hoehe };
}

export function AppAufnahme({
  name,
  alt,
  priority = false,
  className = "",
  // Wie breit das Bild TATSÄCHLICH steht. Der Wert entscheidet, welche
  // Auflösung Next ausliefert — zu klein heißt sichtbar weich auf jedem
  // Retina-Schirm.
  //
  // Gemessen am 10.09.2026: der Standard `55vw` war für jede Aufnahme falsch,
  // die in einer gedeckelten Spalte steht. Im Hero ist die Bildspalte ab
  // 1280 px Fensterbreite konstant 620 px breit (max-w-7xl 1280 − 48 Rand −
  // 48 Spalt = 1184, davon 1.1/2.1), `55vw` verlangte bei 2560 px aber 1408 px
  // — der Browser wählte daraufhin eine Stufe, die für die echten 620 px × 2
  // nicht reichte. Ergebnis auf ALLEN geprüften Breiten (1280–2560): geliefert
  // 704–1173 px statt der nötigen 1236.
  sizes = "(min-width: 1280px) 620px, (min-width: 1024px) 48vw, 100vw",
}: {
  name: string;
  alt: string;
  priority?: boolean;
  className?: string;
  sizes?: string;
}) {
  const locale = useLocale();
  const hell = datei(name, "light", locale);
  const dunkel = datei(name, "dark", locale);
  // Kein Bild vorhanden → gar nichts rendern statt eines kaputten Rahmens.
  if (!hell && !dunkel) {
    return null;
  }

  return (
    <figure
      className={`overflow-hidden rounded-2xl border border-border bg-card shadow-soft ${className}`}
    >
      {/* Fensterleiste — reine Gestaltung, damit das Bild als Anwendung liest. */}
      <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
        <span className="size-2.5 rounded-full bg-accent" />
        <span className="size-2.5 rounded-full bg-muted" />
        <span className="size-2.5 rounded-full bg-muted" />
        <div className="ml-3 h-2.5 w-28 rounded-full bg-muted" />
      </div>

      {/* Zwei Aufnahmen, eine je Farbschema: die Marketing-Seite folgt dem
          Systemthema (.dark auf <html>), und ein heller Screenshot in einer
          dunklen Seite sticht wie ein Fehler heraus. */}
      {hell ? (
        <Image
          src={hell.pfad}
          alt={alt}
          width={hell.breite}
          height={hell.hoehe}
          priority={priority}
          sizes={sizes}
          className={dunkel ? "block h-auto w-full dark:hidden" : "block h-auto w-full"}
        />
      ) : null}
      {dunkel ? (
        <Image
          src={dunkel.pfad}
          alt={alt}
          width={dunkel.breite}
          height={dunkel.hoehe}
          priority={priority}
          sizes={sizes}
          className={hell ? "hidden h-auto w-full dark:block" : "block h-auto w-full"}
        />
      ) : null}
    </figure>
  );
}
