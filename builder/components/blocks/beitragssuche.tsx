// Die Beitragssuche (0458).
//
// Ein Suchfeld, das in den TITELN der Beiträge sucht — nicht im Inhalt. Das ist
// keine Sparversion, sondern dieselbe Grenze, die auch Hostaway zieht, und sie
// hat zwei handfeste Gründe: der Inhalt liegt als Abschnitts-JSONB je Sprache
// (eine Volltextsuche wäre ein Scan über alle Blöcke aller Beiträge), und ein
// Treffer mitten im Text zeigt in der Ergebnisliste trotzdem nur den Titel.
//
// Ein echtes `<form method="get">` und kein Feld mit JavaScript-Handler: die
// Suche funktioniert damit ohne einen einzigen Byte JavaScript, die Eingabe
// landet in der Adresse, und ein Ergebnis lässt sich verschicken. Ziel ist
// `/blog`, weil der Blog dort seine Liste hat — eine zweite Ergebnisliste im
// Abschnitt wäre eine zweite Wahrheit über dieselben Beiträge.
import { type EditierModus, NICHT_EDITIERBAR, editierbar } from "@/lib/editier-kontext";
import { pickText } from "@/lib/i18n";
import { texte } from "@/lib/texte";

export function BeitragssucheBlock({
  content,
  modus = NICHT_EDITIERBAR,
}: {
  content: Record<string, unknown>;
  modus?: EditierModus;
}) {
  const t = texte(modus.locale);
  const platzhalter =
    pickText(content.placeholder, modus.locale) || t.blogSuchePlatzhalter;

  return (
    <section className="mx-auto max-w-3xl px-6 py-10">
      <form action="/blog" method="get" role="search" className="flex gap-2">
        {/* Die Sprache als VERSTECKTES FELD, nicht als `?lang=` in der
            `action`: bei `method="get"` verwirft der Browser die Query des
            Ziels und baut sie neu aus den Feldern. Ein Parameter dort wäre
            stumm verschwunden — dasselbe Muster wie in `objekt-blocks.tsx`.
            Ohne das fiel die Ergebnisliste auf die Standardsprache zurück. */}
        <input type="hidden" name="lang" value={modus.locale} />
        <input
          type="search"
          name="q"
          // Der Deckel ist derselbe wie im Backend (60 Zeichen). Er steht hier
          // zusätzlich, damit der Gast gar nicht erst tippt, was ohnehin
          // abgelehnt würde.
          maxLength={60}
          placeholder={platzhalter}
          aria-label={platzhalter}
          {...editierbar(modus, "placeholder")}
          className="w-full rounded-full border border-border bg-transparent px-5 py-2.5 text-sm outline-none focus:border-foreground"
        />
        <button
          type="submit"
          className="shrink-0 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition hover:opacity-90"
        >
          {t.sucheSuchen}
        </button>
      </form>
    </section>
  );
}
