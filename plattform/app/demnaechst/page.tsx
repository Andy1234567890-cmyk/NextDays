// Vorab-Seite des Marktplatzes. Alles, was das Vorstart-Tor abfängt, landet
// per `rewrite` hier (middleware.ts) — die angefragte Adresse bleibt dabei
// stehen, der Besucher sieht diese Seite.
//
// Absichtlich karg: kein Markenname, kein Logo, keine Inserate, kein
// Anmeldeweg. Vor dem Start soll die Domain nicht verraten, was dahinter
// entsteht — eine „Coming soon"-Seite mit Marke und Produktversprechen wäre
// genau der öffentliche Auftritt, den wir gerade vermeiden. Der einzige Ausweg
// ist das Rechtliche (Impressumspflicht gilt auch vor dem Start).
//
// SPRACHE: Die App wählt die Sprache normalerweise per Cookie (i18n/request.ts).
// Ein Erstbesucher hat dieses Cookie nicht und sähe Deutsch. Hier wird deshalb
// zusätzlich `Accept-Language` gelesen — ein französischer Besucher bekommt
// Französisch, ohne vorher irgendwo geklickt zu haben.
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";

import { DEFAULT_LOCALE, LOCALES, type Locale, bcp47 } from "@/i18n/locales";
import { load } from "@/i18n/request";
import { VOR_DEM_START } from "@/lib/vorstart";

/** Erste Sprache aus `Accept-Language`, die wir wirklich haben.
 *
 *  Bewusst simpel geparst: der Header ist eine nach `q` gewichtete Liste
 *  („fr-CH,fr;q=0.9,en;q=0.8"). Wir nehmen die Einträge in der genannten
 *  Reihenfolge und schneiden die Region ab (`fr-CH` → `fr`), weil unsere
 *  Sprachdateien nach Sprache und nicht nach Region liegen. Kein Treffer →
 *  Basissprache.
 */
function spracheAusHeader(header: string | null): Locale {
  if (!header) return DEFAULT_LOCALE;
  for (const teil of header.split(",")) {
    const tag = teil.split(";")[0]?.trim().toLowerCase();
    if (!tag) continue;
    const sprache = tag.split("-")[0];
    if ((LOCALES as readonly string[]).includes(sprache)) return sprache as Locale;
  }
  return DEFAULT_LOCALE;
}

async function texte() {
  const kopf = await headers();
  const locale = spracheAusHeader(kopf.get("accept-language"));
  // `load` aus i18n/request statt getTranslations: diese Seite wird per
  // `rewrite` ausgeliefert und waehlt ihre Sprache aus dem Header, nicht aus dem
  // Cookie. Ein eigener `import()` waere der naheliegende Weg und war der
  // falsche — aus dieser Verzeichnistiefe zeigte der relative Pfad ins Leere,
  // und weil es ein dynamischer Template-Import ist, faellt das weder `tsc`
  // noch dem Lint auf, sondern erst dem Docker-Build.
  const vorstartAus = (m: Record<string, unknown>) =>
    (m.vorstart ?? undefined) as Record<string, string> | undefined;

  const gewaehlt = vorstartAus(await load(locale));
  if (gewaehlt) return { locale, t: gewaehlt };
  // Faellt die gewaehlte Datei aus, greift die Basissprache. Hier ist der stille
  // Rueckfall richtig: es sind vier Saetze, und die Seite muss stehen.
  return { locale: DEFAULT_LOCALE, t: vorstartAus(await load(DEFAULT_LOCALE)) ?? {} };
}

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await texte();
  return {
    // Kein Markenname im Titel — er stünde im Browser-Tab und in jeder
    // Vorschau, die jemand teilt.
    title: t.titel ?? "Demnächst verfügbar",
    robots: { index: false, follow: false, nocache: true },
  };
}

export default async function DemnaechstSeite() {
  const { locale, t } = await texte();

  // Nach dem Start hat diese Seite keinen Zweck mehr. Sie dann leer zu lassen
  // wäre eine Adresse, die 200 mit nichts antwortet — deshalb ein klarer Zeiger
  // zurück auf die Startseite.
  if (!VOR_DEM_START) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6">
        <Link href="/" className="underline">
          {t.titel ?? "Start"}
        </Link>
      </main>
    );
  }

  return (
    <main
      lang={bcp47(locale)}
      className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center"
    >
      <h1 className="max-w-xl text-balance text-3xl font-semibold sm:text-4xl">
        {t.ueberschrift ?? "Wir sind noch nicht offen."}
      </h1>
      <p className="max-w-md text-balance text-lg text-muted-foreground">
        {t.text ?? ""}
      </p>
      {/* Der einzige Link: Rechtliches. Er bleibt auch im Tor offen
          (VORSTART_FREI in lib/vorstart.ts). */}
      <Link
        href="/rechtliches"
        className="text-sm underline underline-offset-4 hover:no-underline"
      >
        {t.rechtliches ?? "Rechtliches"}
      </Link>
    </main>
  );
}
