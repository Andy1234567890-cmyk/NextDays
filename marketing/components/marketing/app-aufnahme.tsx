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

// Aufnahmemaß aus dem Skript (1600 × 1000 bei Faktor 2).
const BREITE = 3200;
const HOEHE = 2000;

/** Beste tatsächlich vorhandene Datei für Motiv/Thema/Sprache, sonst null.
 *
 * Die Liste entsteht beim Aufnahmelauf aus dem Verzeichnis
 * (`web/scripts/marketing-aufnahmen.mjs`). Fehlt eine Kombination — etwa weil
 * ein Lauf abgebrochen ist —, weicht die Seite auf eine vorhandene aus, statt
 * ein 404-Bild zu rendern. */
function datei(name: string, thema: "light" | "dark", sprache: string): string | null {
  const gegenthema = thema === "light" ? "dark" : "light";
  const kandidaten = [
    ...[sprache, ...ERSATZSPRACHEN].map((s) => `${name}-${thema}-${s}@2x.png`),
    // Erst wenn es das Motiv im gewünschten Thema in KEINER Sprache gibt, das
    // andere Thema nehmen — lieber die falsche Helligkeit als kein Bild.
    ...[sprache, ...ERSATZSPRACHEN].map((s) => `${name}-${gegenthema}-${s}@2x.png`),
  ];
  const treffer = kandidaten.find((k) => (VORHANDEN as string[]).includes(k));
  return treffer ? `/marketing/app/${treffer}` : null;
}

export function AppAufnahme({
  name,
  alt,
  priority = false,
  className = "",
}: {
  name: string;
  alt: string;
  priority?: boolean;
  className?: string;
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
          src={hell}
          alt={alt}
          width={BREITE}
          height={HOEHE}
          priority={priority}
          sizes="(min-width: 1024px) 55vw, 100vw"
          className={dunkel ? "block h-auto w-full dark:hidden" : "block h-auto w-full"}
        />
      ) : null}
      {dunkel ? (
        <Image
          src={dunkel}
          alt={alt}
          width={BREITE}
          height={HOEHE}
          priority={priority}
          sizes="(min-width: 1024px) 55vw, 100vw"
          className={hell ? "hidden h-auto w-full dark:block" : "block h-auto w-full"}
        />
      ) : null}
    </figure>
  );
}
