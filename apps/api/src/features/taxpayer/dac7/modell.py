"""Das format-neutrale Meldemodell — die Hierarchie einer DAC7-Meldung.

WARUM FORMATNEUTRAL: Dänemark verlangt für das Meldejahr 2025 eine CSV, ab
2026 XML. Beide beschreiben dieselbe Hierarchie:

    Meldung (Message)
      └─ Plattformbetreiber (Platform Operator)
           └─ Anbieter (Reportable Seller)          — Person oder Gesellschaft
                └─ Tätigkeit (Relevant Activity)    — hier: Vermietung

Die 89 CSV-Spalten sind die flachgeklopfte Fassung genau dieses Baumes; das
DPI-XML ist seine verschachtelte Fassung. Deshalb wird der Baum EINMAL
gerechnet und je Zielformat nur noch serialisiert. Kein Feld dieses Modells
existiert, weil eine CSV-Spalte es verlangt — jedes existiert, weil die
Richtlinie es verlangt.

WARUM UNVERÄNDERLICH (`frozen=True`): Eine Meldung, die zwischen Berechnung
und Ausgabe noch verändert werden kann, ist nicht reproduzierbar. Derselbe
Lauf muss zweimal dieselbe Datei ergeben — das ist gegenüber einer
Steuerbehörde keine Bequemlichkeit, sondern Voraussetzung dafür, eine
Korrekturmeldung überhaupt begründen zu können.

WARUM `Decimal` UND KEIN `float`: Geldbeträge. Ein `float` verliert Cent.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal


@dataclass(frozen=True, slots=True)
class Anschrift:
    """Eine Anschrift, strukturiert erfasst.

    `art` ist die OECD-Anschriftsart (OECD301..305). Für den meldenden
    Plattformbetreiber verlangt die Vorlage mindestens eine Anschrift der Art
    OECD304 (eingetragener Sitz).
    """

    land: str
    strasse: str | None = None
    hausnummer: str | None = None
    plz: str | None = None
    ort: str | None = None
    art: str | None = None
    freitext: str | None = None
    """Die Anschrift in einer Zeile — `ADDR_FREE` der Vorlage.

    Der amtliche Ausweg für Anschriften, die strukturiert nicht abbildbar
    sind: Zellkommentar zu `ADDR_FREE` „Obligatorisk hvis de strukturerede
    adressefelter ikke kan udfyldes." Das Blatt `Eksempel 2.1 Initiel`
    führt ihn fünfmal vor (S6–S10), etwa „Budapest, Hős u. 8-10, 1087
    Ungarn" — eine ungarische Anschrift, die in Straße/PLZ/Ort nicht
    aufgeht.

    In allen fünf Beispielblättern steht er NIE allein: `ADDR_CITY` ist
    dort auch dann gesetzt, wenn `ADDR_FREE` gefüllt ist. Er ergänzt die
    strukturierte Fassung also, er ersetzt sie nicht.
    """

    @property
    def vollstaendig(self) -> bool:
        """Ob die Anschrift gemeldet werden kann.

        Die Vorlage verlangt Land und entweder Ort oder eine Freitextfassung.
        Eine Anschrift ohne beides wäre für die Behörde nicht zuordenbar.
        """
        return bool(self.land) and bool(self.ort or self.freitext)


@dataclass(frozen=True, slots=True)
class Steuernummer:
    """Eine Steuer-Identifikationsnummer samt ausstellendem Staat.

    Ein Anbieter kann mehrere haben — in jedem Staat, in dem er ansässig ist,
    eine. Deshalb eine eigene Klasse und keine Zeichenkette am Anbieter.

    `unbekannt` ist die zulässige Aussage "dieser Staat vergibt keine";
    sie ist etwas anderes als "wir haben keine erhoben" — Letzteres macht die
    Meldung unvollständig und muss vor der Erzeugung auffallen.
    """

    wert: str | None
    ausgestellt_von: str
    unbekannt: bool = False

    @property
    def meldefaehig(self) -> bool:
        return bool(self.ausgestellt_von) and (self.unbekannt or bool(self.wert))


@dataclass(frozen=True, slots=True)
class Finanzkonto:
    """Die Kennung des Kontos, auf das die Vergütung fließt.

    Die Richtlinie verlangt sie, damit die Behörde den Zahlungsempfänger
    zuordnen kann. `inhaber` wird nur gemeldet, wenn er vom Anbieter abweicht.
    """

    kennung: str
    art: str | None = None
    inhaber: str | None = None


@dataclass(frozen=True, slots=True)
class Quartalswerte:
    """Die vier Quartalswerte einer Größe.

    Die Richtlinie verlangt die Aufteilung auf Quartale; ein Jahreswert allein
    genügt nicht. Fehlende Quartale sind 0 und werden auch als 0 gemeldet —
    das ist die zutreffende Aussage "in diesem Quartal nichts", kein
    Ersatzwert.
    """

    q1: Decimal = Decimal(0)
    q2: Decimal = Decimal(0)
    q3: Decimal = Decimal(0)
    q4: Decimal = Decimal(0)

    def __getitem__(self, quartal: int) -> Decimal:
        return (self.q1, self.q2, self.q3, self.q4)[quartal - 1]

    @property
    def summe(self) -> Decimal:
        return self.q1 + self.q2 + self.q3 + self.q4

    def plus(self, quartal: int, betrag: Decimal) -> Quartalswerte:
        """Einen Betrag in ein Quartal legen; gibt eine neue Instanz zurück."""
        werte = [self.q1, self.q2, self.q3, self.q4]
        werte[quartal - 1] += betrag
        return Quartalswerte(*werte)


@dataclass(frozen=True, slots=True)
class Quartalszahlen:
    """Wie `Quartalswerte`, aber für Stückzahlen (Anzahl der Tätigkeiten)."""

    q1: int = 0
    q2: int = 0
    q3: int = 0
    q4: int = 0

    def __getitem__(self, quartal: int) -> int:
        return (self.q1, self.q2, self.q3, self.q4)[quartal - 1]

    @property
    def summe(self) -> int:
        return self.q1 + self.q2 + self.q3 + self.q4

    def plus(self, quartal: int, anzahl: int = 1) -> Quartalszahlen:
        werte = [self.q1, self.q2, self.q3, self.q4]
        werte[quartal - 1] += anzahl
        return Quartalszahlen(*werte)


@dataclass(frozen=True, slots=True)
class DaenischerAnhang:
    """Felder, die nur Dänemark verlangt.

    Sie stehen NICHT im gemeinsamen OECD-Kern. Getrennt gehalten, damit der
    Wechsel auf DPI-XML sie nicht in den Kern zieht.

    `brutto_mieteinnahme` ist nach der amtlichen Anleitung
    "ausgezahlte Vergütung + Gebühr − Provision" und zwingend in DKK.

    `bfe_nummer` ist NICHT die Matrikelnummer. Die Anleitung fuehrt beide
    getrennt:
      RS_ACT_LAND_REG_NUM           Matrikelnummer, Text,
                                    max 4 Ziffern + max 3 Buchstaben
      RS_ACT_DK_REAL_PROP_REG_NUM   BFE-Nummer, Integer,
                                    "unik forretningsvendt noegle"
    Im Beispiel der Behoerde steht dort "1234QJE" gegen "4560004" — zwei
    verschiedene Werte. Sie duerfen nicht aus derselben Quelle kommen.
    """

    brutto_mieteinnahme: Decimal | None = None
    brutto_mieteinnahme_waehrung: str | None = None
    bfe_nummer: str | None = None


@dataclass(frozen=True, slots=True)
class Vermietung:
    """Eine relevante Tätigkeit: die Vermietung einer inserierten Einheit.

    Die Vorlage fuehrt je vermieteter Immobilie eine
    ACT_Immovable_Property-Zeile unter dem Verkaeufer.

    `belege` nennt die Buchungen, aus denen die Zahlen entstanden sind. Sie
    gehen nicht in die Datei, sondern in den Prüfbericht: Eine Behörde, die
    fragt "woher kommt dieser Betrag", bekommt die Antwort aus dem System.
    """

    anschrift: Anschrift
    verguetung: Quartalswerte
    gebuehren: Quartalswerte
    steuern: Quartalswerte
    anzahl: Quartalszahlen
    waehrung: str

    objektart: str | None = None
    objektart_freitext: str | None = None
    vermietete_tage: int | None = None
    grundbuchnummer: str | None = None

    daenisch: DaenischerAnhang | None = None

    property_ids: tuple[str, ...] = ()
    belege: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class Anbieter:
    """Ein meldepflichtiger Anbieter (Reportable Seller).

    Entweder eine natürliche Person (`vorname`/`nachname`/`geburtsdatum`)
    oder eine Gesellschaft (`name`/`handelsregisternummer`) — nie beides.
    `ist_person` entscheidet, welcher Zeilentyp in der CSV entsteht
    (RS_IND_Individual_Seller bzw. RS_ENT_Entity_Seller).

    `doc_ref_id` ist die dauerhafte Kennung dieses Anbieters in dieser
    Meldung. Sie wird gespeichert, weil eine spätere Korrektur über
    CORR_DOC_REF_ID genau auf sie verweist — ohne sie ist keine Korrektur
    mehr möglich.
    """

    doc_ref_id: str
    ist_person: bool
    ansaessig_in: tuple[str, ...]
    steuernummern: tuple[Steuernummer, ...]
    anschrift: Anschrift

    # natürliche Person
    vorname: str | None = None
    zweitname: str | None = None
    nachname: str | None = None
    geburtsdatum: date | None = None
    geburtsort: str | None = None
    geburtsland: str | None = None

    # Gesellschaft
    name: str | None = None
    handelsregisternummer: str | None = None
    handelsregister_land: str | None = None
    handelsregister_art: str | None = None
    umsatzsteuer_id: str | None = None
    betriebsstaette_in: str | None = None

    finanzkonto: Finanzkonto | None = None
    satzart: str = "OECD1"
    korrigiert_doc_ref_id: str | None = None

    taetigkeiten: tuple[Vermietung, ...] = ()

    # Wer dieser Anbieter in unseren Daten ist (Prüfbericht, nicht Datei).
    quelle_id: str | None = None


@dataclass(frozen=True, slots=True)
class Plattformbetreiber:
    """Der meldende Plattformbetreiber.

    Bei der Meldung des Marktplatzes sind wir das selbst; bei der Meldung
    eines Betriebs ist es der Betrieb. Dieselbe Klasse, zwei Befüllungen.
    """

    doc_ref_id: str
    name: str
    ansaessig_in: tuple[str, ...]
    steuernummern: tuple[Steuernummer, ...]
    anschrift: Anschrift
    nexus: str

    geschaeftsname: str | None = None
    umsatzsteuer_id: str | None = None
    identifikationsnummer: str | None = None
    identifikationsnummer_land: str | None = None
    identifikationsnummer_art: str | None = None
    satzart: str = "OECD1"
    korrigiert_doc_ref_id: str | None = None
    # True nur, wenn ein anderer Betreiber für uns meldet.
    meldung_uebernommen: bool = False


@dataclass(frozen=True, slots=True)
class Meldung:
    """Die vollständige Meldung eines Meldezeitraums.

    `melde_ref_id` ist die eindeutige Kennung der Nachricht; alle Zeilen der
    Datei tragen sie. `meldeart` steuert, welche Satzarten die Datei
    enthalten darf (DPI401 neu, DPI402 Korrektur, DPI403 Nullmeldung).

    Der Zeitraum ist stets ein Kalenderjahr — die Richtlinie kennt keinen
    anderen Zuschnitt.
    """

    melde_ref_id: str
    jahr: int
    meldeart: str
    betreiber: Plattformbetreiber
    anbieter: tuple[Anbieter, ...] = ()
    kontakt: str | None = None
    absender_kennung: str | None = None
    hinweis: str | None = None
    fassung: str = "1.0"

    @property
    def ist_nullmeldung(self) -> bool:
        return self.meldeart == "DPI403"

    @property
    def zeitraum_ende(self) -> date:
        """Das Datum, das die Vorlage als Meldezeitraum erwartet."""
        return date(self.jahr, 12, 31)


@dataclass
class Befund:
    """Ein Grund, warum etwas nicht gemeldet werden kann.

    Bewusst veränderlich und einfach: Befunde werden gesammelt, nicht
    gerechnet. `betrifft` benennt die Stelle in unseren Daten, damit der
    Nutzer sie findet — eine Fehlermeldung ohne Fundort ist wertlos.
    """

    betrifft: str
    feld: str
    grund: str


@dataclass
class Pruefbericht:
    """Was bei der Erzeugung auffiel.

    Trennt scharf zwischen `fehler` (die Datei darf nicht entstehen) und
    `hinweise` (die Datei entsteht, aber jemand sollte hinsehen). Diese
    Trennung ist der Kern des fail-closed-Verhaltens: Eine Steuermeldung mit
    geratenen Werten ist schlimmer als keine.
    """

    fehler: list[Befund] = field(default_factory=list)
    hinweise: list[Befund] = field(default_factory=list)
    einbezogene_buchungen: int = 0
    ausgeschlossene_buchungen: dict[str, int] = field(default_factory=dict)

    @property
    def darf_melden(self) -> bool:
        return not self.fehler

    def fehler_melden(self, betrifft: str, feld: str, grund: str) -> None:
        self.fehler.append(Befund(betrifft=betrifft, feld=feld, grund=grund))

    def hinweis_melden(self, betrifft: str, feld: str, grund: str) -> None:
        self.hinweise.append(Befund(betrifft=betrifft, feld=feld, grund=grund))

    def ausschluss_zaehlen(self, grund: str, anzahl: int = 1) -> None:
        self.ausgeschlossene_buchungen[grund] = (
            self.ausgeschlossene_buchungen.get(grund, 0) + anzahl
        )
