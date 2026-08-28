"use client";

// Sprachwahl auf einer Kunden-Website (0426).
//
// ZWEI Formen, je nach Anzahl:
//
//   bis 6 Sprachen → LINKS. Die Wahl steht danach in der Adresse
//     (`/da/kontakt`), lässt sich weitergeben, funktioniert ohne JavaScript,
//     und der Zurück-Knopf tut das Erwartbare. Für zwei oder drei Sprachen sind
//     die Kürzel nebeneinander auch die schnellere Wahl.
//   ab 7 Sprachen → AUSWAHLFELD. Bei 24 geführten Sprachen wären 24 Pillen eine
//     Wand, die Logo, Navigation und Buchen-Knopf verdrängt.
//
// DIE ADRESSE IST EIN PFAD, KEIN PARAMETER (0476).
//
// Hier stand `?lang=da`. Für den Besucher funktionierte das — für
// Suchmaschinen nicht: Google listet URL-Parameter ausdrücklich als nicht
// empfohlene Form für Sprachfassungen und indexiert sie nicht als eigene
// Seite. Und weil DIESER Wähler die einzige Stelle ist, an der eine
// Sprachadresse im HTML verlinkt wird, hätte ein Crawler die Präfix-Adressen
// nie zu sehen bekommen: hreflang deklariert sie, aber kein Link führt dorthin.
// Der ganze Umbau wäre an der wichtigsten Stelle nicht angekommen.
//
// Beide Formen wechseln NUR das Sprachsegment, der Rest der Adresse bleibt —
// samt Suchbegriff und Datumsangaben in der Query.
//
// Kein Cookie: die Website hat keinen Anmeldezustand, in dem eine Vorliebe
// hinterlegt wäre. Ein Cookie für die Sprachwahl wäre außerdem ein weiterer
// Grund für einen Cookie-Hinweis.
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { Icon } from "@iconify/react";

import { mitSprache } from "@/lib/sprache";
import { SPRACH_FLAGGEN_ICON, SPRACH_NAMEN } from "@/lib/texte";

export function SprachWaehler({
  sprachen,
  aktiv,
  standard,
  beschriftung,
}: {
  /** Sprachen, die diese Website führt. Bei einer einzigen entfällt der
   *  Wähler — eine Liste mit einem Eintrag ist keine Wahl. */
  sprachen: string[];
  aktiv: string;
  /** Die Standardsprache der Website. Sie bekommt KEIN Präfix — `/kontakt`
   *  bleibt die Adresse der Standardfassung, sonst gäbe es dieselbe Seite
   *  unter zwei Adressen. */
  standard?: string | null;
  beschriftung: string;
}) {
  // `usePathname()` liefert den Pfad NACH dem Rewrite der Middleware, also
  // `/kontakt` auch dann, wenn die Adresszeile `/da/kontakt` zeigt. Das ist
  // hier genau richtig: die Basis, auf die das neue Sprachsegment kommt.
  const pfad = usePathname();
  const query = useSearchParams().toString();
  const ziel = (code: string): string => {
    const mitQuery = query ? `${pfad}?${query}` : pfad;
    return mitSprache(mitQuery, code, standard);
  };
  if (sprachen.length < 2) return null;

  // Viele Sprachen: ein Auswahlfeld statt einer Reihe von Kürzeln.
  //
  // Bei 24 geführten Sprachen wären das 24 Pillen nebeneinander — sie
  // verdrängen Logo, Navigation und Buchen-Knopf und brechen auf dem Telefon
  // über vier Zeilen um. Ein `<select>` bleibt eine Zeile hoch, bringt
  // Tastatur, Typeahead und die Systemauswahl des Telefons mit und braucht
  // kein JavaScript: es steht in einem Formular mit `method="get"`, das
  // dieselbe Adresse mit `?lang=` neu aufruft. Ohne JS abgeschickt wird es
  // über den Absenden-Knopf, mit JS beim Wechsel.
  //
  // Die Schwelle liegt bei sechs, weil bis dahin die Kürzel selbst die
  // schnellere Wahl sind: „DA EN DE" liest man in einem Blick, ein
  // zugeklapptes Menü verlangt erst einen Klick.
  if (sprachen.length > 6) {
    // Ein `<details>` statt eines `<form method="get">`.
    //
    // Das Formular schrieb `?lang=` in die Adresse — es KANN nichts anderes:
    // bei `method="get"` baut der Browser die Query aus den Feldern und lässt
    // den Pfad unangetastet. Für Pfad-Adressen (0476) braucht es also echte
    // Links, und die Aufklapp-Liste ist die Form, die 24 davon aufnimmt, ohne
    // die Kopfzeile zu sprengen.
    //
    // `<details>` und nicht ein Menü aus JavaScript: es klappt ohne ein Byte
    // JavaScript auf, bringt Tastaturbedienung mit und schließt sich per Esc.
    // Was das `<select>` an Typeahead verliert, wiegt der Gewinn auf, dass
    // JEDER Eintrag jetzt eine echte, verschickbare Adresse ist — und für
    // Suchmaschinen ein Link, dem sie folgen können.
    return (
      <details className="group/sprachen relative text-xs">
        <summary
          aria-label={beschriftung}
          className="flex cursor-pointer list-none items-center gap-1 rounded-full px-2 py-1 uppercase text-foreground/70 transition hover:text-foreground"
        >
          {/* Die aktive Sprache als Flagge + Kürzel: „DA" allein ist ein
              Buchstabenpaar, die Flagge daneben erkennt der Gast, ohne zu
              lesen. */}
          {SPRACH_FLAGGEN_ICON[aktiv] ? (
            <Icon
              icon={SPRACH_FLAGGEN_ICON[aktiv]!}
              aria-hidden
              className="size-3.5 shrink-0"
            />
          ) : null}
          {aktiv.toUpperCase()}
          <span aria-hidden className="text-[0.625rem]">
            ▾
          </span>
        </summary>
        <div className="absolute right-0 top-full z-20 mt-2 grid max-h-80 grid-cols-2 gap-0.5 overflow-y-auto rounded-xl border border-border bg-background p-2 shadow-lg">
          {sprachen.map((code) => {
            const ist = code === aktiv;
            return (
              <Link
                key={code}
                href={ziel(code)}
                hrefLang={code}
                aria-current={ist ? "true" : undefined}
                className={
                  "whitespace-nowrap rounded-lg px-2 py-1 transition " +
                  (ist
                    ? "bg-secondary font-semibold text-foreground"
                    : "text-foreground/70 hover:bg-secondary/60 hover:text-foreground")
                }
              >
                {/* Flagge vor dem Namen, nie an seiner Stelle: eine Flagge
                    ist ein Land, keine Sprache (Deutsch: DE/AT/CH). Als
                    twemoji und nicht als Emoji — Regional-Indicator-Paare
                    haben unter Windows keine Glyphe, Chrome und Edge zeigen
                    dort nur den Ländercode in einem Kasten. */}
                {SPRACH_FLAGGEN_ICON[code] ? (
                  <Icon
                    icon={SPRACH_FLAGGEN_ICON[code]!}
                    aria-hidden
                    className="me-1.5 inline-block size-3.5 align-[-0.15em]"
                  />
                ) : null}
                {SPRACH_NAMEN[code] ?? code.toUpperCase()}
              </Link>
            );
          })}
        </div>
      </details>
    );
  }

  return (
    <nav aria-label={beschriftung} className="flex items-center gap-1 text-xs">
      {sprachen.map((code) => {
        const ist = code === aktiv;
        return (
          <Link
            key={code}
            // Das Sprachsegment wird getauscht, Pfad und Query bleiben:
            // wichtig auf der Objektliste, wo Suchbegriff und Daten in der
            // Adresse stehen — ein Sprachwechsel darf die Suche nicht
            // verwerfen.
            href={ziel(code)}
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
            {SPRACH_FLAGGEN_ICON[code] ? (
              <Icon
                icon={SPRACH_FLAGGEN_ICON[code]!}
                aria-hidden
                className="me-1 inline-block size-3.5 align-[-0.15em]"
              />
            ) : null}
            {code}
          </Link>
        );
      })}
    </nav>
  );
}
