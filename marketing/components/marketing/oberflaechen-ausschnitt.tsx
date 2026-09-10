// Ein Ausschnitt aus der Oberfläche — eine Karte, kein Programmfenster.
//
// WOFÜR, UND WARUM NICHT `AppAufnahme`:
// `AppAufnahme` rahmt eine 16:10-Vollbildaufnahme wie ein Programmfenster. Die
// Aufnahmen hier sind etwas anderes: einzelne Karten aus der Oberfläche
// (Abrechnungsvertrag, Portal-Abzugssätze, Beleg-Vorschau, Objektzuweisung),
// hochformatig und zwischen 650 und 980 px breit. In einem Fensterrahmen
// säßen sie als schmaler Streifen in der Mitte einer leeren Fläche — das liest
// sich als Fehler, nicht als Beleg.
//
// Deshalb: eigene Darstellung, die zeigt, was sie sind — ein Stück Oberfläche,
// freigestellt auf der warmen Fläche, mit weichem Schatten und Rundung wie die
// Karte im Produkt selbst.
//
// Es gibt hier KEINE Sprach- oder Themavarianten (anders als bei
// `lib/app-aufnahmen.json`): von diesen Ausschnitten existiert genau eine
// Aufnahme, deutsch und hell. Ein Ersatzpfad für eine Variante, die es nicht
// gibt, wäre ein 404-Bild statt eines fehlenden.
import Image from "next/image";

/** Die vorhandenen Ausschnitte. Eine Liste, damit ein Tippfehler `tsc` bricht
 *  statt still ein fehlendes Bild in die Seite zu stellen (Wurzel 4). */
// Die Maße sind die ECHTEN Pixelmaße der Dateien — Next rechnet daraus das
// Seitenverhältnis. Stimmen sie nicht, reserviert der Browser den falschen
// Platz und die Seite springt beim Laden.
export const AUSSCHNITTE = {
  vertrag: { datei: "vertrag", breite: 1304, hoehe: 1758 },
  abzugssaetze: { datei: "abzugssaetze", breite: 1338, hoehe: 1298 },
  zuweisung: { datei: "zuweisung", breite: 1338, hoehe: 1692 },
  beleg: { datei: "beleg", breite: 1682, hoehe: 1960 },
} as const;

export type AusschnittName = keyof typeof AUSSCHNITTE;

export function OberflaechenAusschnitt({
  name,
  alt,
  className = "",
  // `sizes` bestimmt, welche Bildbreite Next ausliefert. Zu klein geraten
  // heißt: ein 120-px-Bild auf 700 px gezogen, also ein verwaschener Fleck —
  // genau das war am 10.09.2026 am Telefon zu sehen. Die Werte müssen die
  // TATSÄCHLICHE Anzeigebreite treffen, nicht die Spaltenzahl.
  sizes = "(min-width: 1024px) 45vw, 92vw",
}: {
  name: AusschnittName;
  alt: string;
  className?: string;
  sizes?: string;
}) {
  const { datei, breite, hoehe } = AUSSCHNITTE[name];
  // Höhendeckel am RAHMEN, nicht am Bild: Ein `max-h` direkt auf dem <img>
  // wirkt gegen Next' eigene Höhenangabe nicht zuverlässig. Der Rahmen
  // schneidet stattdessen ab (`overflow-hidden`), das Bild bleibt
  // unverzerrt. Am Telefon nötig, weil ein Hochformat auf voller Breite dort
  // 700–900 px hoch wird und Überschrift und Text unter die Falz schiebt —
  // man sieht ein Bild ohne die Erklärung, zu der es gehört.
  return (
    <div
      className={`relative max-h-[24rem] overflow-hidden rounded-2xl shadow-float ring-1 ring-border/60 sm:max-h-[32rem] lg:max-h-none ${className}`}
    >
      <Image
        src={`/marketing/eigentuemer/${datei}@2x.webp`}
        alt={alt}
        width={breite}
        height={hoehe}
        // `h-auto` hält das Seitenverhältnis; `max-w-full` verhindert, dass die
        // Aufnahme über ihre Spalte hinauswächst (Querlauf-Riegel).
        className="h-auto w-full max-w-full"
        sizes={sizes}
      />
      {/* Weicher Auslauf an der Schnittkante, damit das Abschneiden gewollt
          aussieht und nicht wie ein abgerissenes Bild. Nur dort, wo überhaupt
          geschnitten wird (unter `lg`). */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card to-transparent lg:hidden"
      />
    </div>
  );
}

/** Zwei Ausschnitte nebeneinander, der zweite leicht versetzt.
 *
 *  Für Reiter, deren Aussage aus zwei Karten besteht (etwa „was der Vertrag
 *  regelt" und „was das Portal abzieht"). Auf schmalen Flächen stehen sie
 *  untereinander — nebeneinander wären zwei Hochformate je 45 % breit und
 *  damit unlesbar. */
export function AusschnittPaar({
  namen,
  alt,
}: {
  namen: readonly [AusschnittName, AusschnittName];
  alt: string;
}) {
  // `min-w-0` auf den Spalten UND `basis-0 grow` statt der vollen Bildbreite:
  // ohne das behalten beide Kinder ihre 100-%-Breite, ergeben zusammen 200 %
  // und schieben die Seite in den Querlauf. Genau so ist es am 10.09.2026
  // live aufgefallen — der Vertrags-Reiter ragte rechts aus dem Fenster.
  return (
    <div className="flex min-w-0 flex-col gap-6 sm:flex-row sm:items-start sm:gap-5">
      <div className="min-w-0 sm:mt-6 sm:basis-0 sm:grow">
        <OberflaechenAusschnitt
          name={namen[0]}
          alt={alt}
          sizes="(min-width: 1024px) 23vw, (min-width: 640px) 45vw, 92vw"
        />
      </div>
      <div className="min-w-0 sm:basis-0 sm:grow">
        <OberflaechenAusschnitt
          name={namen[1]}
          alt={alt}
          sizes="(min-width: 1024px) 23vw, (min-width: 640px) 45vw, 92vw"
        />
      </div>
    </div>
  );
}
