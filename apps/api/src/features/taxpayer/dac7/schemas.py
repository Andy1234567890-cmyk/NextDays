"""Ein- und Ausgabemodelle der DAC7-Endpunkte."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class BefundAusgabe(BaseModel):
    """Ein Grund, warum etwas nicht gemeldet werden kann.

    `betrifft` benennt die Stelle in den Daten, damit der Nutzer sie findet.
    Eine Fehlermeldung ohne Fundort ist bei hunderten Objekten wertlos.
    """

    betrifft: str
    feld: str
    grund: str


class PruefberichtAusgabe(BaseModel):
    """Was bei der Erzeugung auffiel.

    `fehler` verhindert die Datei, `hinweise` nicht. Die
    `ausgeschlossenen_buchungen` erklären, warum die Zahl der gemeldeten
    Buchungen kleiner ist als der Gesamtbestand — ohne diese Aufstellung
    wirkt jede Meldung unvollständig.
    """

    fehler: list[BefundAusgabe] = Field(default_factory=list)
    hinweise: list[BefundAusgabe] = Field(default_factory=list)
    einbezogene_buchungen: int = 0
    ausgeschlossene_buchungen: dict[str, int] = Field(default_factory=dict)
    darf_melden: bool = False


class QuartalswerteAusgabe(BaseModel):
    q1: str
    q2: str
    q3: str
    q4: str
    summe: str


class TaetigkeitAusgabe(BaseModel):
    """EIN OBJEKT — genau eine Zeile der Meldedatei.

    Die Vorlage verlangt fuer Immobilien eine Zeile je Objekt
    ("Gentages for hver ejendom", Entscheidungsbaum der Vorlage). Was hier
    steht, ist deshalb eins zu eins der Inhalt einer
    `ACT_Immovable_Property`-Zeile — damit der Kunde sieht, was fuer sein
    Objekt uebermittelt wird, ohne die Rohdatei lesen zu muessen.
    """

    anschrift: str
    land: str
    objektart: str | None = None
    vermietete_tage: int | None = None
    grundbuchnummer: str | None = None
    bfe_nummer: str | None = None
    brutto_mieteinnahme: str | None = None
    brutto_waehrung: str | None = None
    waehrung: str
    verguetung: QuartalswerteAusgabe
    gebuehren: QuartalswerteAusgabe
    steuern: QuartalswerteAusgabe
    anzahl_buchungen: int
    property_ids: list[str] = Field(default_factory=list)


class DateibefundAusgabe(BaseModel):
    """Ein Regelverstoss in der fertigen Datei, mit Fundort."""

    zeile: int
    zeilentyp: str
    spalte: str
    regel: str
    grund: str
    wert: str = ""


class DateipruefungAusgabe(BaseModel):
    """Das Ergebnis der Pruefung der FERTIGEN Datei.

    Getrennt vom Pruefbericht: Jener prueft die Daten, bevor die Datei
    entsteht. Dieser liest die fertige Datei zurueck und misst sie an den
    Regeln der amtlichen Vorlage — so, wie die Behoerde es tun wuerde.
    """

    besteht: bool
    zeilen: int
    zeilentypen: dict[str, int] = Field(default_factory=dict)
    fehler: list[DateibefundAusgabe] = Field(default_factory=list)
    hinweise: list[DateibefundAusgabe] = Field(default_factory=list)


class AnbieterAusgabe(BaseModel):
    """Ein gemeldeter Anbieter samt seiner Tätigkeiten.

    Die Steuernummer wird MASKIERT ausgegeben: Die Vorschau dient der
    Kontrolle, nicht der Weitergabe. Wer die vollständige Nummer braucht,
    lädt die Datei herunter.
    """

    doc_ref_id: str
    ist_person: bool
    anzeigename: str
    ansaessig_in: list[str]
    steuernummer_maskiert: str | None = None
    taetigkeiten: list[TaetigkeitAusgabe] = Field(default_factory=list)


class MeldungVorschau(BaseModel):
    """Die vollständige Vorschau einer Meldung vor der Abgabe."""

    jahr: int
    meldeart: str
    melde_ref_id: str
    betreiber_name: str
    anbieter: list[AnbieterAusgabe] = Field(default_factory=list)
    bericht: PruefberichtAusgabe
    lauf_id: str | None = None
    # Nur gesetzt, wenn die Meldung erzeugt werden durfte.
    datei_verfuegbar: bool = False
    # True, wenn nichts abgelegt wurde. Die Oberflaeche muss den
    # Unterschied zeigen: Ein Probelauf, der wie eine gespeicherte Meldung
    # aussieht, waere eine Falschaussage ueber den Stand der Dinge.
    probelauf: bool = False
    # Die ersten Zeilen der erzeugten Datei — nur beim Probelauf, wo es
    # keine `lauf_id` zum Herunterladen gibt. Damit sieht man, dass die
    # Datei wirklich entsteht und wie sie aussieht, ohne etwas abzulegen.
    datei_anfang: str | None = None
    datei_zeilen: int | None = None
    # Die vollstaendige Datei im Klartext — damit der Kunde vor der Abgabe
    # sieht, was uebermittelt wird, und es der Behoerde vorlegen kann.
    datei_inhalt: str | None = None
    # Was die Pruefung der fertigen Datei ergeben hat.
    dateipruefung: DateipruefungAusgabe | None = None


class MeldelaufAusgabe(BaseModel):
    """Ein gespeicherter Meldelauf in der Übersicht."""

    id: str
    jahr: int
    art: str
    status: str
    meldeart: str
    melde_ref_id: str
    behoerde_land: str
    anzahl_anbieter: int
    anzahl_einheiten: int
    anzahl_buchungen: int
    datei_name: str | None = None
    datei_pruefsumme: str | None = None
    abgegeben_am: datetime | None = None
    created_at: datetime


class ErzeugenAnfrage(BaseModel):
    """Anfrage zum Erzeugen einer Meldung."""

    jahr: int = Field(ge=2023, le=2100)
    # 'betrieb' = der Betrieb meldet seine Verkaeufer (der Regelfall).
    # 'marktplatz' bleibt dem Betreiber des Marktplatzes vorbehalten.
    art: str = "betrieb"
    # Probelauf: rechnen und pruefen, aber NICHTS ablegen. Damit laesst
    # sich vor der ersten echten Meldung sehen, ob die Daten tragen.
    probelauf: bool = False
