# Airbnbs Hilfe-Artikel — Aufbau und Inhalt

Am 06.09.2026 ausgelesen (Claude Chrome, nur lesend). Anlass: unsere Hilfe soll
denselben Aufbau bekommen, und die Storno-Richtlinien im Kalender-Panel brauchen
einen Artikel, auf den sie verweisen.

Gelesen wurden `/help/article/2600`, `475`, `3045`, `3030`, `1320`, `2701`.

## A. Aufbau einer Artikelseite (`/help/article/{nr}`)

| Element | Wert (gemessen) |
| --- | --- |
| Inhaltsspalte | 632 px breit, linker Rand x = 188 |
| Brotkrumen | 14 px / 20 px, grau; Kette: Startseite › Alle Themen › Bereich › Thema › Unterthema |
| Kategorie-Zeile über dem Titel | 14 px, Gewicht 500, `#6C6C6C`; Form: „So funktioniert es • Gastgeber:in einer Unterkunft" |
| Artikeltitel (H1) | 32 px / 36 px, Gewicht 500, `#222` |
| Übersetzungshinweis | „Original anzeigen (Englisch)" + „Dieser Artikel wurde automatisch übersetzt." |
| Fließtext | 16 px / 24 px, Gewicht 400, `#222` |
| Zwischenüberschrift (H2) | 22 px / 26 px, Gewicht 500 |
| Aufzählungen | 16 px / 24 px, Punkte |
| Fuß | „Hat dir dieser Artikel weitergeholfen? Ja / Nein" |
| Danach | „Verwandte Themen" (Karten mit Kategorie-Zeile, Titel, Anriss) |
| Ganz unten | „Möchtest du Kontakt aufnehmen?" + Knopf „Kontaktiere uns" |

Die Kategorie-Zeile ist keine Zierde: sie sagt, für WEN der Artikel gilt
(Gast oder Gastgeber) und welcher Art er ist („So funktioniert es",
„Community-Richtlinien").

## B. Inhalt: die Stornierungsbedingungen (Artikel 475)

Ein Inserat hat ZWEI Bedingungen: eine für kurze, eine für lange Aufenthalte.
Die Grenze liegt bei 28 Nächten.

### Kurze Aufenthalte (bis 27 Nächte)

Für alle gilt zusätzlich eine 24-Stunden-Frist: Storno bis 24 Stunden nach der
Bestätigung ist voll erstattet, sofern die Buchung mindestens 7 Tage vor der
Anreise bestätigt wurde.

| Bedingung | Volle Erstattung bis | Danach |
| --- | --- | --- |
| Flexibel | 24 Stunden vor Check-in | verbrachte Nächte + 1 weitere |
| Moderat | 5 Tage vor Check-in | verbrachte Nächte + 1 weitere + 50 % der restlichen |
| Eingeschränkt (ab Buchungen vom 01.10.2025) | 14 Tage vor Check-in | 7–14 Tage: 50 %; unter 7 Tagen: 0 % |
| Moderat-streng | 30 Tage vor Check-in | 7–30 Tage: 50 %; unter 7 Tagen: 0 % |
| Streng | 60 Tage vor Check-in | danach: 0 % |

### Lange Aufenthalte (ab 28 Nächten)

| Bedingung | Volle Erstattung | Danach |
| --- | --- | --- |
| Moderat-streng | bis 30 Tage vor Check-in | 100 % für verbrachte Nächte + 30 weitere |
| Streng | nur binnen 48 Stunden nach Buchung UND mindestens 28 Tage vor Check-in | 100 % für verbrachte + die nächsten 30 Nächte |

### Nicht erstattungsfähige Option (Artikel 2600 / 3045)

Ein ZUSÄTZLICHER Preis, kein Ersatz der Bedingung: in der Regel 10 % unter dem
Basispreis. Der Gast wählt beim Bezahlen zwischen dem normalen Preis (mit
Stornobedingung) und dem ermäßigten ohne Erstattung. Sie erscheint nur, wenn
der Aufenthalt unter 60 Nächte hat und nicht über eine Vorabgenehmigung oder
ein Sonderangebot gebucht wird. Die 24-Stunden-Frist gilt weiterhin.

### Wann die Bedingung nicht greift (Artikel 1320 / 2701)

Die „Richtlinien für schwerwiegende Beeinträchtigungen": bei Ereignissen, die
die Buchung verhindern oder rechtlich untersagen, wird unabhängig von der
Bedingung erstattet.

## C. Was davon zu uns passt — und was nicht

Unsere Buchungsbedingung (`booking_conditions`, 0165) trägt eine STAFFEL:
„X % zurück ab Y Tagen vor Anreise". Damit sind abbildbar:

* volle Erstattung bis zu einem Stichtag,
* eine oder mehrere Zwischenstufen (z. B. 50 % zwischen 7 und 14 Tagen),
* keine Erstattung danach.

NICHT abbildbar ist Airbnbs Rechenweise „verbrachte Nächte + 1 weitere Nacht":
sie bezieht sich auf den Aufenthaltsverlauf, nicht auf einen Stichtag vor der
Anreise. Unsere Richtlinien-Texte beschreiben deshalb, was UNSERE Staffel tut —
sie kopieren nicht Airbnbs Sätze, deren Rechenweg wir gar nicht fahren
(Wurzel 4: keine Zusage, die das System nicht einlöst).

Ebenfalls nicht übernommen: der 10-%-Rabatt der nicht erstattungsfähigen
Option. Bei uns ist „Nicht erstattungsfähig" eine Bedingung, kein zweiter Preis
im Bezahlvorgang — ein Rabatt, den niemand berechnet, wäre eine Falschaussage.
