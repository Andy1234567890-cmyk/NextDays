"""Welche Meldung eine Buchung betrifft — und warum der Kanal dabei egal ist.

DIE WICHTIGSTE REGEL DES MODULS. Wer eine Buchung doppelt meldet, laesst den
Vermieter doppelt veranlagen; wer eine auslaesst, meldet unvollstaendig.
Beides ist bussgeldbewehrt, und beides faellt niemandem auf, der nur die
Datei ansieht.

MASSGEBLICH IST DER VERMITTLUNGSVERTRAG, NICHT DER BUCHUNGSKANAL.

Woertlich in der DAC7-Anleitung fuer daenische Ferienhausvermittler
(feriehusudlejerne.dk, abgestimmt mit der Skattestyrelsen, S. 2):

    „I de tilfaelde, hvor der er to eller flere formidlere involveret i
     processen, dvs. hvor et bureau ud over egen hjemmeside ogsaa har huset
     liggende paa andre formidleres platforme, er det den formidler, der har
     formidlingsaftale og foretager afregning med husejer, der er
     indberetningspligtig for den paagaeldende nettolejeindtaegt."

Der Betrieb hat den Vermittlungsvertrag mit dem Hauseigentuemer und rechnet
mit ihm ab — bei einer Buchung ueber Booking, ueber Airbnb und am Telefon
gleichermassen. Booking hat keinen Vertrag mit dem Hauseigentuemer, sondern
mit dem Betrieb: Booking meldet den BETRIEB als Verkaeufer, der Betrieb
meldet SEINE Eigentuemer. Zwei verschiedene Beziehungen, zwei Meldungen —
die eine ersetzt die andere nicht.

WAS HIER FRUEHER STAND UND FALSCH WAR
=====================================
Bis zum 10.09.2026 siebte dieses Modul nach `channel` aus, mit Begruendungen
wie „Booking.com meldet als Plattformbetreiber selbst" und „Direktbuchung
ohne Plattform (kein meldepflichtiger Vorgang)". Beides ist frei erfunden
gewesen; keine Fundstelle traegt es.

Die Wirkung war die denkbar schlimmste: Bei einem realen Betrieb fielen
463 von 694 Buchungen aus der Meldung (255 Booking, 181 Airbnb, 27 direkt),
waehrend seine tatsaechlich abgegebene Meldung 231 Buchungen enthaelt. Die
Datei haette ordentlich ausgesehen — der Pruefbericht zaehlte die
Ausschluesse ja mit einer plausibel klingenden Begruendung.

Drei Belege gegen den alten Stand:
  * Die 89 Spalten der amtlichen Vorlage enthalten KEIN Feld fuer den
    Buchungskanal. Die Behoerde fragt nicht danach.
  * Die echte Meldung im Blatt `Indberetning` derselben Vorlage meldet
    231 Buchungen eines Betriebs, dessen Gaeste ueber Booking, Airbnb und
    direkt kommen.
  * Die Anleitung oben nennt als Kriterium ausschliesslich
    `formidlingsaftale` + `afregning med husejer`.

WARUM ES DAFUER KEINE PRUEFUNG MEHR GIBT
========================================
Der Vermittlungsvertrag ist bei einer Agentur keine Eigenschaft der
einzelnen BUCHUNG, sondern des Verhaeltnisses zum Eigentuemer: Er ist
genau dann gegeben, wenn das Objekt in `owner_properties` einem
Eigentuemer zugeordnet ist — und diese Zuordnung entscheidet ohnehin schon
darueber, ob eine Zeile entsteht (`aufbau._verkaeufer_je_objekt`).

Eine zusaetzliche Bedingung, die immer wahr ist, waere keine Sicherung,
sondern eine Attrappe: Sie suggeriert eine Pruefung, die nichts prueft, und
verleitet den naechsten Leser dazu, sie „nur noch schnell" um eine
Kanal-Ausnahme zu erweitern. Deshalb steht hier keine.

WAS BLEIBT: DIE TRENNUNG DER BEIDEN MELDUNGEN
=============================================
Es gibt zwei verschiedene Meldepflichtige mit je eigener Meldung:

  MARKTPLATZ   myBestDays meldet die BETRIEBE als seine Verkaeufer.
               Betroffen sind Buchungen ueber den eigenen Marktplatz
               (`channel='portal'`), denn dort hat myBestDays das
               Vermittlungsverhaeltnis zum Betrieb.

  BETRIEB      Der Betrieb meldet SEINE Eigentuemer als Verkaeufer.
               Betroffen ist jede Vermietung eines Objekts, das einem
               Eigentuemer zugeordnet ist — unabhaengig vom Kanal.

Die Marktplatz-Meldung braucht die Kanaleinschraenkung, weil myBestDays
nur fuer die ueber ihn gelaufenen Buchungen Vermittler des Betriebs ist.
Die Betriebs-Meldung braucht sie nicht.
"""
from __future__ import annotations

from enum import Enum


class Meldungsart(Enum):
    """Welche der beiden Meldungen erzeugt wird."""

    # myBestDays meldet als Marktplatzbetreiber; Anbieter sind die Betriebe.
    MARKTPLATZ = "marktplatz"
    # Der Betrieb meldet; Anbieter sind seine Eigentuemer.
    BETRIEB = "betrieb"


# Kanaele, ueber die myBestDays selbst vermittelt hat. NUR fuer die
# Marktplatz-Meldung von Belang: Fuer eine Buchung, die ueber Booking beim
# Betrieb einging, ist myBestDays kein Vermittler und meldet sie nicht.
_MARKTPLATZ_KANAELE = frozenset({"portal"})


def gehoert_zu(kanal: str | None, art: Meldungsart) -> bool:
    """Ob eine Buchung in diese Meldung gehoert.

    Fuer die Meldung des BETRIEBS immer `True`: Er hat den
    Vermittlungsvertrag mit dem Eigentuemer und rechnet mit ihm ab, egal
    ueber welchen Kanal der Gast kam. Ob ueberhaupt eine Zeile entsteht,
    entscheidet die Eigentuemer-Zuordnung des Objekts, nicht dieser Filter.

    Fuer die MARKTPLATZ-Meldung nur die ueber den Marktplatz gelaufenen
    Buchungen — nur dort ist myBestDays der Vermittler des Betriebs.
    """
    if art is Meldungsart.BETRIEB:
        return True
    return bool(kanal) and kanal in _MARKTPLATZ_KANAELE


def ausschlussgrund(kanal: str | None, art: Meldungsart) -> str:
    """Warum eine Buchung nicht in DIESE Meldung eingeht.

    Immer eine benannte Begruendung, nie ein stilles Verwerfen: Der
    Pruefbericht muss jede nicht gemeldete Buchung erklaeren koennen.
    """
    if art is Meldungsart.BETRIEB:
        # Kommt nicht vor — `gehoert_zu` schliesst hier nichts aus. Der Zweig
        # steht, damit ein kuenftiger Aufrufer keine irrefuehrende Begruendung
        # aus dem Marktplatz-Zweig erbt.
        return "gehoert in die Meldung des Betriebs"
    if kanal in _MARKTPLATZ_KANAELE:
        return "gehoert in die Meldung des Marktplatzes"
    return (
        f"Buchung ueber '{kanal or 'ohne Kanal'}' — nicht ueber den "
        "Marktplatz vermittelt, gehoert in die Meldung des Betriebs"
    )
