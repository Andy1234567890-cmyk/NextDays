"""Pydantic-Schemas für den owners-Slice (verwaltete Eigentümer).

Die verwaltete Eigentümer-PARTEI (Stammdaten, Bankverbindung, Default-Provision)
getrennt vom Owner-Login-User. Objekt-Zuordnung mit Anteil + Provisions-Override.
"""
import re
from enum import StrEnum

from pydantic import BaseModel, Field, field_validator

from src.features.auth.schemas import pruefe_sprache

# --- Dänische Kennungen (0127 CPR, 0581 Bank) ------------------------------
# Die drei Formate stehen HIER und in den CHECKs der DB (0581); beide Stellen
# müssen deckungsgleich bleiben, sonst nimmt die API an, was die DB ablehnt.
_CPR = re.compile(r"^\d{6}-?\d{4}$")
_BANK_REG_NR = re.compile(r"^\d{4}$")
_BANK_KONTO_NR = re.compile(r"^\d{1,10}$")


def _leer_zu_none(v: str | None) -> str | None:
    """Leeres Eingabefeld = kein Wert. Sonst getrimmt zurück."""
    if v is None:
        return None
    v = v.strip()
    return v or None


def pruefe_cpr(v: str | None) -> str | None:
    """CPR-Nummer (dänische Personennummer): TTMMJJ-XXXX.

    Angenommen wird die Form mit und ohne Bindestrich, GESPEICHERT wird immer
    mit — das ist Normalisierung derselben Eingabe, kein Ersatzwert. Alles
    andere ist ein Datenfehler → 422 (Wurzel 4/5).
    """
    v = _leer_zu_none(v)
    if v is None:
        return None
    if not _CPR.match(v):
        raise ValueError("CPR-Nummer im Format TTMMJJ-XXXX (6 Ziffern, Bindestrich, 4 Ziffern).")
    ziffern = v.replace("-", "")
    return f"{ziffern[:6]}-{ziffern[6:]}"


def pruefe_bank_reg_nr(v: str | None) -> str | None:
    """Dänische Bank-Registrierungsnummer: genau 4 Ziffern."""
    v = _leer_zu_none(v)
    if v is None:
        return None
    if not _BANK_REG_NR.match(v):
        raise ValueError("Reg.-Nr. besteht aus genau 4 Ziffern.")
    return v


def pruefe_bank_konto_nr(v: str | None) -> str | None:
    """Dänische Kontonummer: 1–10 Ziffern (ohne Leerzeichen/Punkte)."""
    v = _leer_zu_none(v)
    if v is None:
        return None
    v = v.replace(" ", "")
    if not _BANK_KONTO_NR.match(v):
        raise ValueError("Kontonummer besteht aus bis zu 10 Ziffern.")
    return v


class StatementFrequency(StrEnum):
    # public.owners.statement_frequency (Migration 0063, um 'yearly' erweitert
    # in 0331). Der CHECK in der DB und dieses Enum müssen deckungsgleich
    # bleiben — sonst nimmt die API einen Wert an, den die DB ablehnt.
    none = "none"
    monthly = "monthly"
    yearly = "yearly"


class OwnerBase(BaseModel):
    """Gemeinsame, bearbeitbare Stammdaten eines Eigentümers."""

    name: str = Field(min_length=1, max_length=200)
    company: str | None = None
    email: str | None = None
    phone: str | None = None

    # Strukturierte Adresse.
    street: str | None = None
    house_number: str | None = None
    postal_code: str | None = None
    city: str | None = None
    country: str | None = None

    tax_id: str | None = None
    vat_id: str | None = None

    # Auszahlungs-Bankdaten.
    iban: str | None = None
    bic: str | None = None
    bank_name: str | None = None
    account_holder: str | None = None
    # Dänische Bankverbindung (0581): Reg.-Nr. (4 Ziffern, die Bank) + Konto-
    # Nr. (bis 10 Ziffern). Ergänzt IBAN/BIC — ein Eigentümer führt je nach
    # Bank das eine oder das andere. Formatfehler → 422.
    bank_reg_nr: str | None = None
    bank_konto_nr: str | None = None
    # Dänische Personennummer (0127). Nur admin/co_admin sehen sie: sie läuft
    # ausschließlich über MANAGE_OWNERS (dieser Slice) und MANAGE_PROPERTIES
    # (Kartei Stufe 1); `OwnerKontakt` leitet sie bewusst nicht aus (Wurzel 9).
    cpr_number: str | None = None

    # Provision + Auszahlungs-/Statement-Konfig.
    #
    # NULL = noch nicht vereinbart, NICHT 0 %. Bis 09.08.2026 stand hier
    # `default=0`: wer einen Eigentümer anlegte, ohne einen Satz einzugeben,
    # schickte damit eine echte 0 an die DB und der Betrieb bekam bei jeder
    # Abrechnung dieses Eigentümers 0,00 — der Eigentümer 100 %. Live belegt
    # (AirSmil, 8 Booking-Buchungen): Gesamt-Auszahlung 32.120,45 DKK,
    # Verwaltungs-Auszahlung 0,00 DKK. Ein fehlender Satz ist ein Datenfehler
    # und muss als solcher sichtbar werden (Wurzel 4), kein bequemer Nullwert.
    default_commission_pct: float | None = Field(default=None, ge=0, le=100)
    default_payout_method: str | None = None
    statement_frequency: StatementFrequency = StatementFrequency.none
    notes: str | None = None

    # Optionale Verknüpfung zum Owner-Login-User (Self-Service-Portal).
    user_id: str | None = None

    # Korrespondenzsprache der PARTEI (`owners.language`, 0335). Sie hängt am
    # Stammdatensatz und nicht am Login, weil ein Eigentümer Abrechnungs- und
    # Buchungsmails auch OHNE Zugang bekommt: `user_id` darf leer bleiben, die
    # Mails gehen trotzdem raus. Ohne diese Spalte gäbe es für genau diese
    # Empfänger keine Sprachauskunft.
    # NULL = nicht erfasst → Kette Betriebssprache → Englisch. Kein Default
    # „de": das behauptete von jedem Eigentümer, er sei deutschsprachig.
    language: str | None = Field(default=None, max_length=10)

    @field_validator("language")
    @classmethod
    def _sprache_pruefen(cls, v: str | None) -> str | None:
        return pruefe_sprache(v)

    @field_validator("cpr_number")
    @classmethod
    def _cpr_pruefen(cls, v: str | None) -> str | None:
        return pruefe_cpr(v)

    @field_validator("bank_reg_nr")
    @classmethod
    def _reg_nr_pruefen(cls, v: str | None) -> str | None:
        return pruefe_bank_reg_nr(v)

    @field_validator("bank_konto_nr")
    @classmethod
    def _konto_nr_pruefen(cls, v: str | None) -> str | None:
        return pruefe_bank_konto_nr(v)


class OwnerCreate(OwnerBase):
    """Anlage eines Eigentümers. tenant_id kommt aus dem eingeloggten Nutzer.

    `portalzugang` schaltet zusätzlich den LOGIN dazu (siehe unten). Ohne das
    Flag entsteht wie bisher nur die Abrechnungspartei — das bleibt der
    Normalfall, weil ein Eigentümer seine Abrechnungsmails auch ganz ohne
    Zugang bekommt.
    """

    # Portalzugang gleich mit einrichten: Login-Nutzer mit Rolle `owner`
    # anlegen, Einladungsmail verschicken und `owners.user_id` verknüpfen.
    #
    # WARUM OPT-IN UND NICHT AUTOMATISCH: die Eigentümer-PARTEI und der
    # Portal-LOGIN sind zwei Dinge, die auseinanderlaufen dürfen. Eine
    # Erbengemeinschaft, ein Eigentümer ohne E-Mail, ein Verwalter, der die
    # Abrechnung selbst weiterreicht — für die alle wäre ein erzwungener
    # Zugang falsch. Umgekehrt zwingt das Flag den Betreiber nicht mehr, die
    # SELBE Person ein zweites Mal unter /konto/nutzer anzulegen.
    #
    # Ohne `email` ist der Zugang unmöglich (der Einmal-Link braucht ein
    # Postfach) → 422 statt stillem Überspringen (Wurzel 4/5).
    portalzugang: bool = False

    # Objekte, die diesem Eigentümer SOFORT beim Anlegen gehören sollen.
    #
    # WARUM IM SELBEN AUFRUF: bis hierher ging die Zuordnung nur nachträglich
    # über `POST /owners/{id}/properties` — ein Objekt je Klick. Bei 18 Objekten
    # waren das 18 Aufrufe nach dem Anlegen, und jeder einzelne konnte
    # scheitern; zurück blieb ein Eigentümer mit einem Teil seiner Objekte, ohne
    # dass irgendwo stünde, welche fehlen. Hier ist es EIN Vorgang: entweder der
    # Eigentümer steht mit allen genannten Objekten, oder der Aufruf schlägt fehl
    # und hinterlässt gar nichts (Wurzel 1 — jede Aktion hat einen Gegenzustand,
    # der mitgepflegt wird).
    #
    # Leer bleiben ist der Normalfall und ausdrücklich erlaubt: ein Eigentümer
    # darf angelegt werden, bevor sein Objekt erfasst ist.
    #
    # Die Obergrenze ist kein Geschmack, sondern Wurzel 8: eine unbegrenzte
    # Liste wäre ein Hebel, mit dem ein Aufruf beliebig viele Zeilen schreibt.
    # 500 liegt weit über jedem realen Bestand eines Betriebs.
    property_ids: list[str] = Field(default_factory=list, max_length=500)

    @field_validator("property_ids")
    @classmethod
    def _objekte_pruefen(cls, v: list[str]) -> list[str]:
        """Leere IDs abweisen, Duplikate zusammenfassen.

        Eine leere ID wäre eine Zuordnung, die niemals passt und im Insert als
        Fremdschlüsselfehler landet — hier klar mit 422 abweisen statt später
        als 500. Duplikate sind kein Fehler des Betreibers (ein Doppelklick in
        der Liste), aber sie doppelt zu schreiben, wäre einer: Reihenfolge
        erhaltend zusammenfassen (Wurzel 2).
        """
        if any(not str(pid).strip() for pid in v):
            raise ValueError("Leere Objekt-ID in der Auswahl.")
        return list(dict.fromkeys(str(pid).strip() for pid in v))


class OwnerUpdate(BaseModel):
    """Partielle Aktualisierung — nur gesetzte Felder werden übernommen."""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    company: str | None = None
    email: str | None = None
    phone: str | None = None
    street: str | None = None
    house_number: str | None = None
    postal_code: str | None = None
    city: str | None = None
    country: str | None = None
    tax_id: str | None = None
    vat_id: str | None = None
    iban: str | None = None
    bic: str | None = None
    bank_name: str | None = None
    account_holder: str | None = None
    bank_reg_nr: str | None = None
    bank_konto_nr: str | None = None
    cpr_number: str | None = None
    default_commission_pct: float | None = Field(default=None, ge=0, le=100)
    default_payout_method: str | None = None
    statement_frequency: StatementFrequency | None = None
    notes: str | None = None
    user_id: str | None = None
    # Korrespondenzsprache nachtragen/ändern (Eigentümer-Stammdaten).
    language: str | None = Field(default=None, max_length=10)

    @field_validator("language")
    @classmethod
    def _sprache_pruefen(cls, v: str | None) -> str | None:
        return pruefe_sprache(v)

    @field_validator("cpr_number")
    @classmethod
    def _cpr_pruefen(cls, v: str | None) -> str | None:
        return pruefe_cpr(v)

    @field_validator("bank_reg_nr")
    @classmethod
    def _reg_nr_pruefen(cls, v: str | None) -> str | None:
        return pruefe_bank_reg_nr(v)

    @field_validator("bank_konto_nr")
    @classmethod
    def _konto_nr_pruefen(cls, v: str | None) -> str | None:
        return pruefe_bank_konto_nr(v)


class OwnerMiteigentuemer(BaseModel):
    """Ein ANDERER Eigentümer am selben Objekt (0601, ADR-0028).

    Nur Name und Anteil: die Stammdatenseite soll zeigen, WER sonst an dem
    Objekt haengt und mit WELCHEM Anteil — mehr braucht sie nicht, und ein
    vollstaendiger Eigentuemer-Datensatz an dieser Stelle waere Recon ueber
    fremde Bankverbindungen (Wurzel 9).
    """

    owner_id: str
    name: str
    ownership_share: float = Field(ge=0, le=100)


class OwnerPropertyLink(BaseModel):
    """Ein Objekt-Zuordnungs-Eintrag eines Eigentümers."""

    property_id: str
    ownership_share: float = Field(default=100, ge=0, le=100)
    commission_override_pct: float | None = Field(default=None, ge=0, le=100)
    # Die ANDEREN Eigentuemer dieses Objekts. Leer = Alleineigentum.
    # Ohne diese Angabe war ein Anteil von 60 % auf der Stammdatenseite eine
    # Zahl ohne Gegenueber: man sah, dass 40 % fehlen, aber nicht bei wem.
    miteigentuemer: list[OwnerMiteigentuemer] = Field(default_factory=list)


class OwnerResponse(OwnerBase):
    id: str
    tenant_id: str
    properties: list[OwnerPropertyLink] = Field(default_factory=list)
    created_at: str | None = None
    updated_at: str | None = None

    # True, wenn im selben Aufruf ein Portalzugang eingerichtet UND die
    # Einladungsmail zugestellt wurde. Die UI meldet dann „Einladung an
    # <Adresse> verschickt" statt nur „angelegt" — der Betreiber soll sehen,
    # dass wirklich etwas rausging, statt es zu vermuten.
    # Bei `portalzugang=false` bleibt das Feld False; es ist keine Aussage
    # über einen späteren, getrennt ausgelösten Versand.
    einladung_versendet: bool = False

    # Gesetzt, wenn dieser Aufruf die E-Mail-Adresse geändert hat UND der
    # Eigentümer einen Portalzugang hat: dann läuft ein Doppel-Opt-in, die
    # Bestätigung ging an DIESE Adresse, und bis zum Klick meldet sich der
    # Eigentümer weiter mit der BISHERIGEN Adresse an.
    #
    # Der Zwischenzustand MUSS sichtbar sein (Wurzel 5b): ohne dieses Feld
    # zeigte die Maske nach dem Speichern die neue Adresse und verschwiege,
    # dass die Anmeldung noch auf der alten läuft — eine Aussage über den
    # Zustand, die schlicht nicht stimmt.
    #
    # None heisst „kein laufender Wechsel": entweder wurde die Adresse nicht
    # geändert, oder es gibt keinen Login, dessen Anmeldeadresse mitzuziehen
    # wäre (dann ist die Adresse reine Korrespondenzadresse und sofort gültig).
    email_bestaetigung_an: str | None = None


class OwnerListItem(OwnerBase):
    """Listen-Eintrag: Stammdaten + Anzahl zugeordneter Objekte (ohne Detail)."""

    id: str
    tenant_id: str
    property_count: int = 0
    # Effektive Provisions-Spanne über die Objekte: je Objekt der Override, sonst
    # der Owner-Default. Bei Gleichheit zeigt die UI einen Wert, sonst eine Spanne.
    # None, wenn (noch) keine Objekte zugeordnet sind.
    # None, wenn (noch) keine Objekte zugeordnet sind ODER für KEINES ein Satz
    # feststeht — eine Spanne aus lauter unbekannten Sätzen gibt es nicht.
    commission_min: float | None = None
    commission_max: float | None = None
    # Wie viele der zugeordneten Objekte KEINEN Satz haben (weder Override noch
    # Owner-Default). > 0 heißt: die Spanne oben beschreibt nur einen Teil, für
    # den Rest ist die Provision offen. Ohne diese Zahl sähe eine Karte mit
    # teils ungeklärten Sätzen genauso aus wie eine vollständig gepflegte
    # (Wurzel 4 — die Lücke muss sichtbar sein, nicht weggerundet).
    commission_missing_count: int = 0
    created_at: str | None = None
    updated_at: str | None = None


class OwnerListResponse(BaseModel):
    items: list[OwnerListItem]
    total: int


class OwnerPropertyAssign(BaseModel):
    """Objekt einem Eigentümer zuordnen (mit Anteil + Provisions-Override)."""

    property_id: str
    # KEIN Default 100 mehr (Befund 07.09.2026): bei einem Objekt, an dem schon
    # jemand mit 100 % haengt, ergab der Default zwangslaeufig 200 % — die
    # Zuordnung war also nur an unberuehrten Objekten moeglich, und genau das
    # machte Miteigentum ueber die Oberflaeche unerreichbar.
    #
    # `None` heisst jetzt „den freien Rest nehmen" und wird im Service
    # aufgeloest (er kennt die schon vergebenen Anteile). Ein fester Wert hier
    # waere ein erfundener Anteil (Wurzel 4).
    ownership_share: float | None = Field(default=None, ge=0, le=100)
    commission_override_pct: float | None = Field(default=None, ge=0, le=100)


class OwnerPropertiesAssign(BaseModel):
    """Mehrere Objekte auf einmal zuordnen (Mehrfachauswahl der Detailseite).

    Kein Anteil/Override je Objekt: die Mehrfachauswahl ist der schnelle Weg
    („diese 18 gehören ihm"), die Feinjustierung bleibt bei `assign_property`
    pro Objekt. Die Grenze von 500 ist dieselbe wie bei `OwnerCreate` — ein
    unbegrenzter Bereich wäre ein Schreib-Hebel (Wurzel 8).
    """

    property_ids: list[str] = Field(min_length=1, max_length=500)

    @field_validator("property_ids")
    @classmethod
    def _objekte_pruefen(cls, v: list[str]) -> list[str]:
        if any(not str(pid).strip() for pid in v):
            raise ValueError("Leere Objekt-ID in der Auswahl.")
        return list(dict.fromkeys(str(pid).strip() for pid in v))


class EmailBestaetigungResponse(BaseModel):
    """Antwort auf „Bestätigung erneut senden": WOHIN sie ging.

    Die Adresse gehört in die Antwort, nicht nur in einen pauschalen Erfolg:
    der Betreiber soll in der Meldung lesen, an welches Postfach die
    Bestätigung ging — genau der Wert, an dem sich bei einem Adresswechsel der
    Tippfehler zeigt.
    """

    email: str


class AvailableProperty(BaseModel):
    """Objekt, das einem Eigentümer zugeordnet werden darf.

    Drei Fälle seit 0601/ADR-0028: frei (keinem Eigentümer zugeordnet), bereits
    diesem Eigentümer, ODER teilweise vergeben — dann ist eine MITEIGENTUMS-
    Zuordnung über den freien Restanteil möglich. Vorher fiel der dritte Fall
    aus der Liste, und Miteigentum war in der Oberfläche nicht erreichbar,
    obwohl das Datenmodell es konnte.
    """

    id: str
    title: str
    # Adresse und Vorschaubild für die Mehrfachauswahl: bei 18 ähnlich
    # benannten Objekten ist die Adresse das Unterscheidungsmerkmal. Beide
    # optional — fehlen sie, zeigt die Zeile schlicht weniger statt eines
    # erfundenen Platzhalters (Wurzel 4).
    subtitle: str | None = None
    photo: str | None = None
    # Wie viel Anteil an diesem Objekt noch NICHT vergeben ist (0601).
    # 100 = frei, < 100 = Miteigentum moeglich, 0 kommt nicht in die Liste.
    # Die Oberflaeche braucht die Zahl, um den Anteil vorzubelegen und zu
    # begrenzen; ohne sie waere „Miteigentum" ein Feld, dessen Obergrenze der
    # Bediener raten muss und das der Trigger dann abweist.
    freier_anteil: float = Field(default=100, ge=0, le=100)
    # Die bereits Beteiligten — Name und Anteil, damit in der Auswahl steht,
    # WEM das Objekt schon zum Teil gehoert. Leer bei einem freien Objekt.
    beteiligte: list[OwnerMiteigentuemer] = Field(default_factory=list)


class AvailablePropertiesResponse(BaseModel):
    items: list[AvailableProperty]


class OwnerKontakt(BaseModel):
    """Der Eigentümer eines Objekts — NUR was ein Personenbezug braucht.

    BEWUSST NICHT von `OwnerBase` abgeleitet (Wurzel 9: keine Felder an eine
    Route, die sie nicht braucht). `OwnerBase` trägt IBAN/BIC/Kontoinhaber,
    Steuer-/USt-ID, den Provisionssatz, die Abrechnungsfrequenz und interne
    Notizen. Nichts davon wird gebraucht, um eine Eigennutzung anzulegen — und
    eine Route, die es trotzdem ausliefert, ist Recon-Material: sie erschließt
    die Bankverbindung und den Verwaltungsvertrag jedes Eigentümers über eine
    Objekt-ID. Ein späteres Feld an `OwnerBase` liefe hier sonst automatisch
    mit raus, ohne dass es jemand entscheidet.

    Was drin ist und warum:
      * `id` — der Wert, der als `reservations.owner_id` gespeichert wird.
      * `name`/`company` — die Anzeige („Eigennutzung: Herr Ohm").
      * `email`/`phone` — der Kontakt für Rückfragen zum Aufenthalt.
      * `country`/`language` — Anschreiben in SEINER Sprache (0335) statt in
        der des Betriebs.
    """

    id: str
    name: str
    company: str | None = None
    email: str | None = None
    phone: str | None = None
    country: str | None = None
    language: str | None = None


class OwnerByPropertyResponse(BaseModel):
    """Antwort auf „wem gehört dieses Objekt?".

    `owner` ist NULLABLE, und das ist der Kern dieser Antwortform: ein Objekt
    ohne zugeordneten Eigentümer ist ein gültiger Zustand (die Zuordnung ist
    optional, `owner_properties` ist nicht Pflicht), KEIN Fehler. Ein 404 hätte
    hier zwei Bedeutungen vermischt — „Objekt gibt es nicht / gehört einem
    fremden Mandanten" und „Objekt gibt es, hat aber keinen Eigentümer" — und
    der Aufrufer könnte „nachgesehen, keiner da" nicht von „Abruf
    fehlgeschlagen" unterscheiden (Wurzel 4/5).

    Deshalb die klare Trennung:
      * 200 mit `owner: null`  → nachgesehen, es ist keiner zugeordnet.
      * 404                    → das Objekt existiert nicht oder gehört einem
                                 anderen Mandanten (bewusst dieselbe Meldung,
                                 kein Existenz-Leak).
      * 4xx/5xx sonst          → der Abruf ist gescheitert.

    Genau EIN Eintrag, keine Liste: seit 0073 (`unique (property_id)`) gehört
    ein Objekt genau einem Eigentümer.
    """

    property_id: str
    owner: OwnerKontakt | None = None


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
