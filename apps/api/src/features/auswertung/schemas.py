"""Schemas der Auswertung — Kennzahlen, Buchungen, Auslastung, Kanäle, Gäste.

WARUM DIESER SLICE:
`/auswertung` bündelt, was bisher an vier Stellen als ComingSoon-Attrappe lag
oder ganz fehlte. Vorbild ist Hostaways `Financial Reporting` (Analytics ·
Rental Activity · Occupancy Report), ergänzt um die Kanal- und Gästesicht.
Recherche: `docs/MONATSBERICHT-WETTBEWERBSANALYSE.md`.

Die Buchhaltung (`/buchhaltung`) bleibt bewusst außen vor — sie wird später ein
eigenes, kostenpflichtiges Modul.
"""
from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, Field


class Bezug(StrEnum):
    """Welcher Buchung welcher Zeitraum zugerechnet wird.

    DIE zentrale Entscheidung eines Zeitraumberichts, und deshalb eine SICHTBARE
    Wahl in der Oberfläche — nicht eine Voreinstellung, die niemand kennt.

    Alle vier Wettbewerber führen sie (Beds24 `average over stay`/`by check-in`/
    `by check-out`/`by booking date`, Hostaway als „Event-Filter"). Hostaway
    beschreibt im Update 09/2025 selbst, was ohne sie passiert: „Bisher wurden
    Kennzahlen anhand unterschiedlicher Logiken berechnet, was einen Vergleich
    der Ergebnisse erschwerte."
    """

    ANREISE = "anreise"       # Buchungen, deren check_in im Zeitraum liegt
    ABREISE = "abreise"       # ... deren check_out im Zeitraum liegt
    BUCHUNG = "buchung"       # ... die im Zeitraum GEBUCHT wurden (booked_at)
    UEBERNACHTUNG = "uebernachtung"  # anteilig, je Nacht im Zeitraum


class Vergleich(StrEnum):
    """Mit welchem früheren Zeitraum verglichen wird.

    DATUMSGLEICH, nicht wochentagsgleich (Entscheidung des Betreibers,
    03.09.2026): 31.08.–29.09.2026 wird zu 31.08.–29.09.2025. Der Vorwert steht
    damit auf denselben Kalendertagen — gleiche Feiertage, gleiche Schulferien,
    gleiche Saisonlage. Die Alternative (Verschiebung um 52 Wochen, damit
    Wochenenden aufeinanderfallen) lässt das Datum um bis zu drei Tage wandern
    und verschiebt Monatsgrenzen; für einen Bericht, der nach Monaten gegliedert
    ist, wäre das die schlechtere Wahl.

    Der 29.02. hat keinen datumsgleichen Partner in einem Nicht-Schaltjahr. Er
    wird auf den 28.02. gelegt (`_jahre_zurueck`) — die einzige Stelle, an der
    „datumsgleich" nicht wörtlich gelten kann.
    """

    KEINER = "keiner"
    JAHR_1 = "1j"
    JAHR_2 = "2j"
    JAHR_5 = "5j"


#: Wie viele Jahre der jeweilige Vergleich zurückgeht. `KEINER` fehlt hier
#: bewusst: er ist kein Zeitraum, sondern seine Abwesenheit.
VERGLEICH_JAHRE: dict[Vergleich, int] = {
    Vergleich.JAHR_1: 1,
    Vergleich.JAHR_2: 2,
    Vergleich.JAHR_5: 5,
}


class Kennzahlen(BaseModel):
    """Die Kachelreihe oben — der Kern jeder Auswertung."""

    currency: str | None = None
    umsatz: float = 0.0
    naechte: int = 0
    buchungen: int = 0
    gaeste: int = 0
    # Auslastung: gebuchte Nächte / BUCHBARE Nächte (nicht / alle Tage).
    # Guestys Nenner, bewusst gegen Hostaway gewählt: eine Wartungssperre darf
    # die Auslastung nicht drücken, sie war ja nie im Verkauf.
    naechte_buchbar: int = 0
    auslastung_pct: float | None = None
    # ADR = Umsatz / gebuchte Nächte. RevPAR = Umsatz / buchbare Nächte.
    # Beide `None`, wenn der Nenner 0 ist — kein 0.0, das wäre eine Aussage
    # („Preis null") statt „keine Grundlage" (Wurzel 4).
    adr: float | None = None
    revpar: float | None = None
    aufenthalt_schnitt: float | None = None
    vorlauf_tage: float | None = None
    stornoquote_pct: float | None = None
    stornos: int = 0


class Punkt(BaseModel):
    """Ein Punkt der Zeitreihe (Monat oder Tag)."""

    period: str
    umsatz: float = 0.0
    naechte: int = 0
    buchungen: int = 0
    #: NUR im Vergleichsbericht gesetzt: `period`, um die Vergleichsjahre nach
    #: VORN gerechnet — „2025-08-03" wird zu „2026-08-03".
    #:
    #: Damit kann die Oberfläche die beiden Zeitreihen über den SCHLÜSSEL
    #: zusammenführen. Über die Position ginge es nicht: `_verlauf` legt nur
    #: Eimer an, in denen etwas liegt, die Reihen sind also verschieden lang.
    #: Live gemessen (03.09.2026): drei Buchungstage 2026 gegen zwei 2025
    #: ergaben per Index „3. August 2026 gegen 1. August 2025" und „10. August
    #: gegen 25. August" — eine Kurve, die plausibel aussieht und falsche Tage
    #: gegenüberstellt.
    period_normal: str | None = None


class KanalZeile(BaseModel):
    """Eine Zeile je Vertriebskanal.

    `provision` ist die vom Portal einbehaltene Provision aus
    `reservations.ota_commission` — NICHT geschätzt. Liefert das Portal sie
    nicht (Booking.com tut es meist nicht), bleibt sie `None`. Hostaway
    empfiehlt an dieser Stelle eine Schätzung (`Gesamtpreis * 0,15`); das wäre
    bei uns ein erfundener Ersatzwert (Wurzel 4).
    """

    channel: str
    ota_name: str | None = None
    buchungen: int = 0
    naechte: int = 0
    umsatz: float = 0.0
    provision: float | None = None
    netto: float | None = None
    anteil_pct: float = 0.0
    # Wie viele dieser Buchungen Eigennutzung sind (kein Umsatz).
    #
    # Live bei AirSmil: ALLE 39 „Direkt"-Buchungen sind Eigennutzung — 187
    # Nächte, 0,00 DKK. Ohne diese Zahl liest sich die Zeile wie ein Kanal,
    # der nichts einbringt. Hostaway zählt Owner Stays stumm als
    # Direktbuchung mit und verwässert damit den Kanalumsatz; hier steht es
    # dran.
    eigennutzung: int = 0


class ObjektZeile(BaseModel):
    """Eine Zeile je Objekt — die Auslastungstabelle."""

    property_id: str
    title: str
    naechte_buchbar: int = 0
    naechte_gebucht: int = 0
    naechte_gesperrt: int = 0
    # Tage mit Verkaufssperre (`stop_sell`, scope='all'). Eigene Spalte, weil
    # es etwas Drittes ist: weder belegt noch verkaufbar. Ohne sie
    # verschwänden diese Tage unerklärt aus dem Nenner.
    naechte_stop_sell: int = 0
    # Nächte, die der Eigentümer selbst belegt hat (Hostaway „Owner-stay
    # nights"). Sie zählen als belegt, tragen aber keinen Umsatz — ohne diese
    # Spalte sähe ein Haus mit 30 % Eigennutzung aus wie eines, das schlecht
    # verkauft.
    naechte_eigennutzung: int = 0
    auslastung_pct: float | None = None
    anreisen: int = 0
    umsatz: float = 0.0
    adr: float | None = None
    revpar: float | None = None
    stornos: int = 0


class ObjektMonatZeile(ObjektZeile):
    """Eine Zeile je Objekt UND Monat (Hostaway „By month" im Occupancy Report).

    Dieselben Spalten wie `ObjektZeile`, zusätzlich der Monat („YYYY-MM").
    Die Monatszeilen eines Objekts summieren sich zur Objektzeile — dieselbe
    Rechnung, nur feiner geschnitten; eine eigene Logik wäre eine zweite
    Wahrheit.
    """

    monat: str


class BuchungZeile(BaseModel):
    """Eine Buchung in der Tabelle (Hostaways `Rental Activity`)."""

    id: str
    property_title: str | None = None
    guest_name: str | None = None
    channel: str
    ota_name: str | None = None
    check_in: str
    check_out: str
    naechte: int
    gaeste: int | None = None
    status: str
    umsatz: float = 0.0
    provision: float | None = None
    currency: str | None = None
    # Wurzel 5b: der ECHTE Buchungszeitpunkt der Quelle, nie unsere Uhr.
    # Fehlt er (CSV-Import, Lodgify-Migration, manuell), bleibt er leer.
    booked_at: str | None = None
    is_owner_stay: bool = False
    # ---- Finanzfelder (Hostaway „Rental Activity": Base rate, Guest fees,
    # Tax, Rental revenue, Owner payout) ----
    #
    # Quelle ist die gespeicherte Portal-Zerlegung (`reservation_portal_finanzen`
    # + `reservation_portal_gebuehren`, 0366) und die Zusatzleistungen
    # (`reservation_addons`). Fehlt die Zerlegung, bleiben die Felder `None` —
    # der Gesamtpreis `umsatz` steht trotzdem da. NIE wird der Grundpreis aus
    # dem Gesamtpreis „zurückgerechnet" (Wurzel 4).
    uebernachtung: float | None = None
    reinigung: float | None = None
    # Alle übrigen Gebührenposten des Portals (Bettwäsche, Strom, Kurtaxe, …)
    # als Summe; die Einzelposten stehen in `gebuehren_je_art`.
    sonstige_gebuehren: float | None = None
    gebuehren_je_art: dict[str, float] = Field(default_factory=dict)
    # Gebuchte Zusatzleistungen (nicht Teil des Portal-Gastpreises).
    zusatzleistungen: float | None = None
    # Der Gastpreis laut Portal (Übernachtung + Gebühren).
    brutto: float | None = None
    # `True`, wenn das Portal die Provision GEMELDET hat; `False`, wenn sie aus
    # dem hinterlegten Satz errechnet ist. Ohne diese Kennzeichnung sähe eine
    # Rekonstruktion aus wie ein Beleg (Wurzel 5b).
    provision_gemeldet: bool | None = None
    zahlungsgebuehr: float | None = None
    # Brutto − Provision − Zahlungsgebühr: was nach dem Portal beim Betrieb
    # ankommt. Nicht die Eigentümer-Auszahlung — die hängt am
    # Abrechnungsvertrag und steht in der Eigentümer-Abrechnung.
    netto: float | None = None
    # 'ota' = Aufstellung des Portals, 'stammdaten' = aus den Objekt-Gebühren
    # rekonstruiert (begründete Schätzung, so gekennzeichnet).
    finanz_quelle: str | None = None
    # Storno-Daten, nur bei stornierten Buchungen gesetzt.
    cancelled_at: str | None = None
    cancel_reason: str | None = None


class ObjektFinanzZeile(BaseModel):
    """Finanzfelder je Objekt summiert (Hostaway „Per listing")."""

    property_id: str
    title: str
    buchungen: int = 0
    naechte: int = 0
    umsatz: float = 0.0
    uebernachtung: float | None = None
    reinigung: float | None = None
    sonstige_gebuehren: float | None = None
    zusatzleistungen: float | None = None
    brutto: float | None = None
    provision: float | None = None
    zahlungsgebuehr: float | None = None
    netto: float | None = None
    # Wie viele Buchungen dieses Objekts KEINE Zerlegung tragen. Steht sie über
    # 0, sind die Summen unvollständig — und das gehört daneben.
    ohne_zerlegung: int = 0


class WochentagZeile(BaseModel):
    """Leistung je Wochentag (SiteMinder „Day of week performance").

    `wochentag` 0 = Montag … 6 = Sonntag (ISO). Umsatz und ADR je Wochentag
    verteilen den Buchungsbetrag GLEICHMÄSSIG auf die Nächte der Buchung — die
    Portale liefern keinen Preis je Nacht. Das steht in der Oberfläche dran.
    """

    wochentag: int
    naechte_buchbar: int = 0
    naechte_gebucht: int = 0
    auslastung_pct: float | None = None
    anreisen: int = 0
    umsatz: float = 0.0
    adr: float | None = None


class VerteilungZeile(BaseModel):
    """Ein Eimer einer Verteilung (Buchungsfenster, Aufenthaltsdauer)."""

    schluessel: str
    von: int
    # `None` = offen nach oben („91+ Tage").
    bis: int | None = None
    buchungen: int = 0
    naechte: int = 0
    umsatz: float = 0.0
    anteil_pct: float = 0.0


class StornoKanalZeile(BaseModel):
    """Stornierungen je Kanal."""

    channel: str
    ota_name: str | None = None
    stornos: int = 0
    naechte: int = 0
    # Der Umsatz, der mit den Stornos wegfiel (Gesamtpreis der stornierten
    # Buchungen). Kein „Verlust": ein Teil der Nächte wurde neu verkauft.
    umsatz_entgangen: float = 0.0
    # Ø Tage zwischen Storno und geplanter Anreise — nur wo `cancelled_at`
    # vorliegt.
    vorlauf_tage: float | None = None
    stornoquote_pct: float | None = None


class StornoGrundZeile(BaseModel):
    grund: str | None = None
    anzahl: int = 0


class StornoBericht(BaseModel):
    """Der Storno-Bericht — Kanal, Vorlauf, Grund."""

    stornos: int = 0
    naechte: int = 0
    umsatz_entgangen: float = 0.0
    stornoquote_pct: float | None = None
    vorlauf_tage: float | None = None
    # Wie viele Stornos ein `cancelled_at` tragen — die Grundlage des Vorlaufs.
    mit_zeitpunkt: int = 0
    kanaele: list[StornoKanalZeile] = Field(default_factory=list)
    gruende: list[StornoGrundZeile] = Field(default_factory=list)
    # Stornos je Vorlauf-Eimer (Tage vor Anreise).
    vorlauf: list[VerteilungZeile] = Field(default_factory=list)


class AusgabePosten(BaseModel):
    """Ein Posten im Zeitraum — Verrechnungsposten (`owner_expenses`) ODER
    gebuchte Zusatzleistung (`reservation_addons`, Kategorie `addon`)."""

    id: str
    date: str
    name: str
    # Zusatzleistungen tragen ihren Namen als Sprach-Snapshot (jsonb je
    # Locale). Die Oberfläche wählt daraus in der Sprache des Nutzers; `name`
    # ist dann nur der Ersatz für Aufrufer ohne Locale (CSV/PDF-Export).
    name_i18n: dict[str, str] | None = None
    kategorie: str | None = None
    property_id: str | None = None
    property_title: str | None = None
    reservation_id: str | None = None
    # 'ausgabe' (zulasten des Eigentümers, `from_owner`) oder 'extra'
    # (zugunsten, `to_owner`) — Hostaways Aufteilung „Ausgaben = negative
    # Werte, Extras = positive Werte".
    art: str
    betrag: float
    currency: str | None = None
    hat_beleg: bool = False


class AusgabeGruppe(BaseModel):
    """Summe je Kategorie oder je Objekt."""

    schluessel: str | None = None
    title: str | None = None
    anzahl: int = 0
    ausgaben: float = 0.0
    extras: float = 0.0
    saldo: float = 0.0


class AusgabenBericht(BaseModel):
    """Hostaways „Expenses & Extras" — aus den Verrechnungsposten der
    Eigentümer-Abrechnung (nach Datum des Postens) UND den gebuchten
    Zusatzleistungen der Buchungen im Zeitraum (nach dem Bezug der Buchung,
    wie der Rest der Auswertung).

    `currency` ist gesetzt, wenn ALLE Posten dieselbe Währung tragen; sonst
    `None`, und die Oberfläche addiert nicht (Wurzel 4).
    """

    currency: str | None = None
    waehrungen: list[str] = Field(default_factory=list)
    anzahl: int = 0
    ausgaben: float = 0.0
    extras: float = 0.0
    saldo: float = 0.0
    kategorien: list[AusgabeGruppe] = Field(default_factory=list)
    objekte: list[AusgabeGruppe] = Field(default_factory=list)
    posten: list[AusgabePosten] = Field(default_factory=list)


class HerkunftZeile(BaseModel):
    """Gästeherkunft nach Land."""

    land: str | None = None
    gaeste: int = 0
    buchungen: int = 0
    naechte: int = 0
    anteil_pct: float = 0.0


class GaesteBericht(BaseModel):
    """Der Gäste-Teil — das, was kein Wettbewerber so führt."""

    gaeste_gesamt: int = 0
    wiederkehrer: int = 0
    wiederkehrer_pct: float | None = None
    # Auf WIE VIELEN zuordenbaren Personen die Wiederkehrer-Quote beruht.
    #
    # Ohne diese Zahl behauptet „0 %" etwas, das die Daten nicht hergeben.
    # Live bei AirSmil: nur 46 von 334 Buchungen tragen überhaupt eine
    # Mailadresse — die Portale geben sie nicht heraus —, und Airbnb wie
    # Booking legen je Buchung einen NEUEN Gastdatensatz an, derselbe Mensch
    # bekommt also verschiedene `guest_id`. Über den ganzen Bestand sind so
    # nur 5 Wiederkehrer erkennbar. „0 %" heißt hier fast immer „wir können
    # es nicht sehen", nicht „es gibt keine" (Wurzel 4).
    personen_zuordenbar: int = 0
    buchungen_zuordenbar: int = 0
    aufenthalt_schnitt: float | None = None
    gaeste_je_buchung: float | None = None
    herkunft: list[HerkunftZeile] = Field(default_factory=list)


class VergleichBericht(BaseModel):
    """Der Vorzeitraum — dieselbe Rechnung, andere Daten.

    ENTHÄLT KEINE BUCHUNGSLISTE. Der Reiter „Buchungen" zeigt vom Vorjahr nur
    die Summenzeile; die einzelnen Buchungen von damals gehören nicht in eine
    Tabelle des laufenden Zeitraums — sie wären dort nicht unterscheidbar und
    verdoppelten die Ladelast des größten Reiters.

    `kanaele` und `objekte` sind je Schlüssel (channel bzw. property_id) mit dem
    laufenden Zeitraum zusammenzuführen. Ein Kanal, den es NUR im Vorjahr gab,
    steht deshalb trotzdem hier — die Oberfläche zeigt ihn als Zeile ohne
    aktuellen Wert, statt ihn verschwinden zu lassen.
    """

    vergleich: Vergleich
    von: str
    bis: str
    # Die Währung des VORZEITRAUMS. Sie kann von der aktuellen abweichen (der
    # Betrieb hat gewechselt, oder damals lagen mehrere vor). Dann sind
    # Beträge NICHT vergleichbar und die Oberfläche sagt das, statt eine
    # Veränderung in Prozent zu behaupten (Wurzel 4).
    currency: str | None = None
    waehrungen: list[str] = Field(default_factory=list)
    kennzahlen: Kennzahlen
    verlauf: list[Punkt] = Field(default_factory=list)
    kanaele: list[KanalZeile] = Field(default_factory=list)
    objekte: list[ObjektZeile] = Field(default_factory=list)
    gaeste: GaesteBericht = Field(default_factory=GaesteBericht)
    # Wie viele Buchungen der Vorzeitraum hatte (die Summenzeile des
    # Buchungen-Reiters). Die Liste selbst fehlt bewusst, siehe oben.
    buchungen_gesamt: int = 0
    wochentage: list[WochentagZeile] = Field(default_factory=list)
    buchungsfenster: list[VerteilungZeile] = Field(default_factory=list)
    aufenthaltsdauer: list[VerteilungZeile] = Field(default_factory=list)
    stornos: StornoBericht = Field(default_factory=StornoBericht)


class AuswertungResponse(BaseModel):
    """Die ganze Auswertung eines Zeitraums — eine Abfrage, alle Reiter.

    Bewusst EIN Endpunkt statt fünf: alle Reiter teilen Zeitraum, Bezug und
    Objektfilter, und die Kennzahlen müssen über die Reiter hinweg
    ÜBEREINSTIMMEN. Genau daran ist Hostaway gescheitert und musste im
    September 2025 nachbessern („Einheitliche Zahlen auf allen Seiten").
    """

    von: str
    bis: str
    bezug: Bezug
    currency: str | None = None
    # Mehrere Währungen im Zeitraum: NICHT addieren (Wurzel 4). Dann ist
    # `currency` None und die Oberfläche weist den Zeitraum als uneindeutig aus.
    waehrungen: list[str] = Field(default_factory=list)
    kennzahlen: Kennzahlen
    verlauf: list[Punkt] = Field(default_factory=list)
    kanaele: list[KanalZeile] = Field(default_factory=list)
    objekte: list[ObjektZeile] = Field(default_factory=list)
    buchungen: list[BuchungZeile] = Field(default_factory=list)
    # Finanzfelder je Objekt summiert — Hostaways Umschalter „Per listing".
    objekte_finanzen: list[ObjektFinanzZeile] = Field(default_factory=list)
    # Auslastung je Objekt und Monat — Hostaways „By month".
    objekte_monatlich: list[ObjektMonatZeile] = Field(default_factory=list)
    gaeste: GaesteBericht = Field(default_factory=GaesteBericht)
    # Muster: Wochentag, Buchungsfenster, Aufenthaltsdauer.
    wochentage: list[WochentagZeile] = Field(default_factory=list)
    buchungsfenster: list[VerteilungZeile] = Field(default_factory=list)
    aufenthaltsdauer: list[VerteilungZeile] = Field(default_factory=list)
    stornos: StornoBericht = Field(default_factory=StornoBericht)
    ausgaben: AusgabenBericht = Field(default_factory=AusgabenBericht)
    # Zeitreihe je Kanal bzw. je Objekt (Hostaway „Gruppieren nach").
    verlauf_je_kanal: dict[str, list[Punkt]] = Field(default_factory=dict)
    verlauf_je_objekt: dict[str, list[Punkt]] = Field(default_factory=dict)
    # Der Vorzeitraum, wenn einer angefordert wurde. `None` bei
    # `Vergleich.KEINER` — ein leerer Bericht wäre etwas anderes als keiner
    # (er behauptete „Vorjahr: alles null").
    vorher: VergleichBericht | None = None


class PaceMonat(BaseModel):
    """Ein künftiger Monat im Pace-Bericht (SiteMinder „Pace").

    `jetzt_*` ist der heutige Buchungsstand (On the Books) für diesen Monat.
    `vorjahr_stichtag_*` ist, was für denselben Monat vor einem Jahr am
    gleichen Kalendertag bereits gebucht WAR — nur Buchungen mit echtem
    `booked_at`, sonst ließe sich der Stichtag nicht bestimmen (Wurzel 5b).
    `vorjahr_ende_*` ist, was der Monat am Ende tatsächlich brachte.
    """

    monat: str
    jetzt_naechte: int = 0
    jetzt_buchungen: int = 0
    jetzt_umsatz: float = 0.0
    vorjahr_stichtag_naechte: int = 0
    vorjahr_stichtag_buchungen: int = 0
    vorjahr_stichtag_umsatz: float = 0.0
    vorjahr_ende_naechte: int = 0
    vorjahr_ende_umsatz: float = 0.0
    # Abstand des heutigen Standes zum Vorjahres-Stichtag, in Nächten.
    delta_naechte_pct: float | None = None


class PaceBericht(BaseModel):
    stichtag: str
    currency: str | None = None
    waehrungen: list[str] = Field(default_factory=list)
    monate: list[PaceMonat] = Field(default_factory=list)
    # Vorjahresbuchungen OHNE `booked_at` — sie fehlen im Stichtags-Vergleich
    # und stehen deshalb als Zahl daneben, statt still zu fehlen.
    vorjahr_ohne_zeitstempel: int = 0


class AnsichtAnlegen(BaseModel):
    """Eine gespeicherte Ansicht (Hostaway „Custom View")."""

    name: str = Field(min_length=1, max_length=80)
    reiter: str = Field(min_length=1, max_length=40)
    filter: dict = Field(default_factory=dict)
    spalten: list[str] = Field(default_factory=list, max_length=60)
    optionen: dict = Field(default_factory=dict)


class Ansicht(AnsichtAnlegen):
    id: str
    created_at: str | None = None


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
