// Sprachwahl auf einer Kunden-Website (0426).
//
// Als LINKS und nicht als Auswahlfeld mit JavaScript: die Wahl steht danach in
// der Adresse (`?lang=da`), lässt sich weitergeben, funktioniert ohne
// JavaScript, und der Zurück-Knopf tut das Erwartbare. Ein `<select>` mit
// `onChange` hätte all das nicht — und wäre für zwei oder drei Sprachen
// zusätzlicher Client-Code für nichts.
//
// Kein Cookie: die Website hat keinen Anmeldezustand, in dem eine Vorliebe
// hinterlegt wäre. Ein Cookie für die Sprachwahl wäre außerdem ein weiterer
// Grund für einen Cookie-Hinweis.
import Link from "next/link";

import { SPRACH_NAMEN } from "@/lib/texte";

export function SprachWaehler({
  sprachen,
  aktiv,
  beschriftung,
}: {
  /** Sprachen, die diese Website führt. Bei einer einzigen entfällt der
   *  Wähler — eine Liste mit einem Eintrag ist keine Wahl. */
  sprachen: string[];
  aktiv: string;
  beschriftung: string;
}) {
  if (sprachen.length < 2) return null;
  return (
    <nav aria-label={beschriftung} className="flex items-center gap-1 text-xs">
      {sprachen.map((code) => {
        const ist = code === aktiv;
        return (
          <Link
            key={code}
            // Nur der Sprach-Parameter wird gesetzt; der Rest der Adresse
            // bleibt, weil ein relativer Query-Link den Pfad nicht anfasst.
            // Wichtig auf der Objektliste, wo Suchbegriff und Daten in der
            // Adresse stehen — ein Sprachwechsel darf die Suche nicht verwerfen.
            href={`?lang=${code}`}
            hrefLang={code}
            aria-current={ist ? "true" : undefined}
            className={
              "rounded-full px-2 py-1 uppercase transition " +
              (ist
                ? "bg-secondary font-semibold text-foreground"
                : "text-foreground/70 hover:text-foreground")
            }
            // Der volle Name als Titel, die zwei Buchstaben als Anzeige: in der
            // Kopfzeile ist kein Platz für „Slovenščina", aber wer zögert, soll
            // lesen können, was hinter „SL" steckt.
            title={SPRACH_NAMEN[code] ?? code}
          >
            {code}
          </Link>
        );
      })}
    </nav>
  );
}
