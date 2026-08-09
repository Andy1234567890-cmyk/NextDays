"""Pydantic-Schemas für den owners-Slice (verwaltete Eigentümer).

Die verwaltete Eigentümer-PARTEI (Stammdaten, Bankverbindung, Default-Provision)
getrennt vom Owner-Login-User. Objekt-Zuordnung mit Anteil + Provisions-Override.
"""
from enum import StrEnum

from pydantic import BaseModel, Field, field_validator

from src.features.auth.schemas import pruefe_sprache


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

    # Provision + Auszahlungs-/Statement-Konfig.
    default_commission_pct: float = Field(default=0, ge=0, le=100)
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


class OwnerPropertyLink(BaseModel):
    """Ein Objekt-Zuordnungs-Eintrag eines Eigentümers."""

    property_id: str
    ownership_share: float = Field(default=100, ge=0, le=100)
    commission_override_pct: float | None = Field(default=None, ge=0, le=100)


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


class OwnerListItem(OwnerBase):
    """Listen-Eintrag: Stammdaten + Anzahl zugeordneter Objekte (ohne Detail)."""

    id: str
    tenant_id: str
    property_count: int = 0
    # Effektive Provisions-Spanne über die Objekte: je Objekt der Override, sonst
    # der Owner-Default. Bei Gleichheit zeigt die UI einen Wert, sonst eine Spanne.
    # None, wenn (noch) keine Objekte zugeordnet sind.
    commission_min: float | None = None
    commission_max: float | None = None
    created_at: str | None = None
    updated_at: str | None = None


class OwnerListResponse(BaseModel):
    items: list[OwnerListItem]
    total: int


class OwnerPropertyAssign(BaseModel):
    """Objekt einem Eigentümer zuordnen (mit Anteil + Provisions-Override)."""

    property_id: str
    ownership_share: float = Field(default=100, ge=0, le=100)
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


class AvailableProperty(BaseModel):
    """Objekt, das einem Eigentümer zugeordnet werden darf: entweder frei (keinem
    Owner zugeordnet) oder bereits diesem Owner. So bleibt ein Objekt exklusiv
    bei einem Eigentümer (kein Mehrfach-Owner)."""

    id: str
    title: str
    # Adresse und Vorschaubild für die Mehrfachauswahl: bei 18 ähnlich
    # benannten Objekten ist die Adresse das Unterscheidungsmerkmal. Beide
    # optional — fehlen sie, zeigt die Zeile schlicht weniger statt eines
    # erfundenen Platzhalters (Wurzel 4).
    subtitle: str | None = None
    photo: str | None = None


class AvailablePropertiesResponse(BaseModel):
    items: list[AvailableProperty]


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
