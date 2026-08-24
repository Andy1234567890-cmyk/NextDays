// Platzhalter für einen Abschnitt, der (noch) nichts zu zeigen hat.
//
// Sechs Abschnitts-Typen rendern `null`, wenn ihre Daten fehlen: Bewertungen
// ohne Bewertungen, Rich-Text ohne Text, Bild ohne Adresse, Galerie ohne
// Bilder, Button ohne Beschriftung oder Ziel, Featured ohne gewählte Objekte.
//
// LIVE ist das richtig — ein leerer Kasten auf der Gästeseite wäre schlechter
// als gar nichts. Im ENTWURF ist es ein Fehler: der Kunde legt einen Abschnitt
// an, füllt ihn halb, und sieht in der Vorschau nichts. Kein Hinweis, kein
// Grund, kein Weg, ihn anzuklicken — er hält den Baukasten für kaputt (live
// gemeldet am 24.08.2026 am Bewertungs-Abschnitt).
//
// Deshalb: im Entwurf ein Platzhalter, der den GRUND nennt. Live weiterhin
// nichts.
import type { EditierModus } from "@/lib/editier-kontext";

export function AbschnittLeer({
  modus,
  titel,
  grund,
}: {
  modus: EditierModus;
  /** Die Überschrift des Abschnitts, WENN der Kunde eine gesetzt hat. Sonst
   *  entfällt die Zeile — ein erfundener Abschnittsname wäre nur eine zweite
   *  Übersetzungsbaustelle, und der Grund benennt den Abschnitt ohnehin. */
  titel?: string;
  /** Was fehlt — in einem Satz, aus Sicht dessen, der es füllen soll. */
  grund: string;
}) {
  if (!modus.aktiv) return null;
  return (
    <section className="mx-auto max-w-5xl px-6 py-10">
      {/* Gestrichelter Rahmen und gedämpfte Farben: das ist erkennbar KEIN
          Inhalt der Seite, sondern ein Hinweis der Bearbeitung. */}
      <div className="rounded-2xl border-2 border-dashed border-border px-6 py-8 text-center">
        {titel ? (
          <p className="text-sm font-semibold text-foreground">{titel}</p>
        ) : null}
        <p className={`text-sm text-muted-foreground${titel ? " pt-1" : ""}`}>
          {grund}
        </p>
      </div>
    </section>
  );
}
