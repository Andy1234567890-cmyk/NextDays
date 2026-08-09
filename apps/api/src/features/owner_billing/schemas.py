"""Pydantic-Schemas für owner_billing (Klassifikation + Abrechnungsvertrag).

Wurzel 4 zieht sich durch alle Modelle: es gibt KEINE Default-Werte für
Entscheidungen. ``gehoert_zu``, ``provisionspflichtig`` und ``provisions_pct``
sind Pflichtfelder ohne Vorbelegung — ein Default wäre eine Annahme, die als
Entscheidung der Agentur aussieht.
"""
from __future__ import annotations

from datetime import date
from enum import StrEnum

from pydantic import BaseModel, Field, field_validator, model_validator


class GehoertZu(StrEnum):
    """Achse 1 — wem der Gebührenbetrag gehört.

    Deckungsgleich mit dem CHECK auf ``fee_classification.gehoert_zu`` (0343).
    Ein Wert, den dieses Enum kennt und die DB nicht, wäre eine 500 statt einer
    sauberen 422.
    """

    betrieb = "betrieb"
    eigentuemer = "eigentuemer"
    durchlauf = "durchlauf"


class PauschaleBasis(StrEnum):
    """Bezugsgröße der Pauschale — je Buchung oder je Nacht (0343)."""

    je_buchung = "je_buchung"
    je_nacht = "je_nacht"


class PauschaleZeitpunkt(StrEnum):
    """Wann die Pauschale abgezogen wird (0343).

    ``vor_provision`` verkleinert die Bemessungsgrundlage und damit auch die
    Provision; ``nach_provision`` wird erst vom fertigen Eigentümer-Betrag
    abgezogen. Dieselbe Pauschale ergibt je nach Zeitpunkt zwei verschiedene
    Zahlen — deshalb ist der Zeitpunkt Teil der Vereinbarung und keine
    Konvention im Code.
    """

    vor_provision = "vor_provision"
    nach_provision = "nach_provision"


# --------------------------------------------------------------------------
# Gebühren-Klassifikation
# --------------------------------------------------------------------------


class FeeClassificationBase(BaseModel):
    """Die zwei Achsen einer Gebührenart — beide ohne Default.

    Ein ``provisionspflichtig: bool = True`` wäre bequem und genau der stille
    Ersatzwert aus Wurzel 4: die Maske zeigte einen Haken, den niemand gesetzt
    hat, und die Agentur bestätigte eine Annahme, die sie nie getroffen hat.
    """

    gehoert_zu: GehoertZu
    provisionspflichtig: bool
    notiz: str | None = Field(default=None, max_length=2000)


class FeeClassificationUpsert(FeeClassificationBase):
    """Eine Zuordnung setzen (anlegen oder ändern) — der Schreib-Eingang."""

    fee_type: str = Field(min_length=1, max_length=100)
    # NULL = Regel des Betriebs (Normalfall). Gesetzt = Ausnahme für genau
    # dieses Objekt, schlägt die Betriebsregel.
    property_id: str | None = None


class FeeClassificationBatchUpsert(BaseModel):
    """Die Zuordnungsmaske speichert mehrere Arten in einem Zug.

    Die Maske zeigt alle im Bestand vorhandenen Arten nebeneinander; sie
    einzeln zu senden hieße, dass ein Abbruch in der Mitte eine halb
    zugeordnete Konfiguration hinterlässt. Obergrenze, weil jede unbegrenzte
    Liste ein offener Bereich ist (Wurzel 8) — 200 liegt weit über den 54
    überhaupt möglichen Arten und ist damit nie eine echte Schranke.
    """

    items: list[FeeClassificationUpsert] = Field(min_length=1, max_length=200)


class FeeClassificationResponse(FeeClassificationBase):
    """Eine gespeicherte Zuordnung."""

    id: str
    fee_type: str
    property_id: str | None = None
    zugeordnet_von: str | None = None
    zugeordnet_am: str
    created_at: str
    updated_at: str


class FeeTypeZuordnung(BaseModel):
    """Eine Gebührenart im Zuordnungs-Überblick der Maske.

    Trägt drei Dinge zusammen, die die Agentur zum Entscheiden braucht: WAS es
    ist (``fee_type``/``label``), WIE OFT es im Bestand vorkommt (``anzahl``,
    damit klar ist, ob die Entscheidung eine oder neunzehn Gebühren betrifft)
    und WAS bereits entschieden wurde (``klassifikation``).
    """

    fee_type: str
    label: str
    # Wie viele Gebühren-Zeilen dieser Art im Bestand des Betriebs stehen.
    anzahl: int
    # Namen der Gebühren, wie der Betrieb sie genannt hat — die Art allein
    # ("resort") sagt der Agentur nicht, welche Gebühr gemeint ist.
    beispiel_namen: list[str] = Field(default_factory=list)
    # Die gespeicherte Betriebsregel; None = noch NICHT zugeordnet.
    klassifikation: FeeClassificationResponse | None = None
    # Objekt-Ausnahmen zu dieser Art.
    ausnahmen: list[FeeClassificationResponse] = Field(default_factory=list)


class FeeClassificationUebersicht(BaseModel):
    """Die Zuordnungsmaske in einer Antwort.

    ``offen`` ist bewusst eine eigene Zahl und nicht etwas, das das Frontend
    aus der Liste zählt: sie ist die Aussage „so viele Arten würden die
    Abrechnung heute noch scheitern lassen" und gehört deshalb an die Stelle,
    die die Regel kennt.
    """

    items: list[FeeTypeZuordnung]
    offen: int


# --------------------------------------------------------------------------
# Abrechnungsvertrag
# --------------------------------------------------------------------------


def _pruefe_currency(value: str | None) -> str | None:
    """ISO-4217-Code normalisieren; leer bleibt leer.

    Kein Default und keine Ergänzung: fehlt die Währung dort, wo ein Betrag
    steht, ist das ein Datenfehler und wird vom Modell-Validator zu 422 —
    nie ein ``or "EUR"`` (Wurzel 4).
    """
    if value is None:
        return None
    code = value.strip().upper()
    if not code:
        return None
    if len(code) != 3 or not code.isalpha():
        raise ValueError("Währung muss ein ISO-4217-Code sein (drei Buchstaben).")
    return code


class OwnerBillingTermsBase(BaseModel):
    """Die Vereinbarung selbst — ohne Geltung und ohne Kennung."""

    # Kein Default: fehlt der Satz, gibt es keinen Vertrag. Ein `= 0` wäre
    # „der Betrieb arbeitet umsonst" (genau der Fehler, den
    # owners.default_commission_pct heute noch macht).
    provisions_pct: float = Field(ge=0, le=100)

    # Zeitachse. `gueltig_ab` ist Pflicht — ein Vertrag ohne Beginn ließe
    # sich keinem Abrechnungszeitraum zuordnen.
    gueltig_ab: date
    # None = unbefristet. Das ist ein echter Zustand, kein fehlender Wert.
    gueltig_bis: date | None = None

    # Mindestprovision je Buchung. Beide Felder oder keines.
    min_provision_betrag: float | None = Field(default=None, ge=0)
    min_provision_currency: str | None = None

    # Pauschale je Buchung — vollständig oder gar nicht.
    pauschale_betrag: float | None = Field(default=None, ge=0)
    pauschale_currency: str | None = None
    pauschale_basis: PauschaleBasis | None = None
    pauschale_zeitpunkt: PauschaleZeitpunkt | None = None

    notiz: str | None = Field(default=None, max_length=2000)

    @field_validator("min_provision_currency", "pauschale_currency")
    @classmethod
    def _currency(cls, value: str | None) -> str | None:
        return _pruefe_currency(value)

    @model_validator(mode="after")
    def _pruefe_zusammenhaenge(self) -> OwnerBillingTermsBase:
        """Die Zusammenhänge, die ein einzelnes Feld nicht prüfen kann.

        Sie stehen zusätzlich als CHECK in der DB (0343). Beides ist Absicht:
        der CHECK ist der Backstop, der auch bei einem künftigen zweiten
        Schreibweg greift, dieses Modell liefert die Meldung, die der Agentur
        sagt, WAS fehlt — ein DB-CHECK-Fehler wäre eine 500 mit
        Constraint-Namen.
        """
        if self.gueltig_bis is not None and self.gueltig_bis <= self.gueltig_ab:
            raise ValueError(
                "„Gültig bis“ muss nach „Gültig ab“ liegen. Der Zeitraum ist "
                "halb offen: der Endtag gehört bereits zum Folgevertrag."
            )

        # Betrag und Währung sind untrennbar: eine Zahl ohne Währung ist kein
        # Geldbetrag, eine Währung ohne Zahl ist keine Vereinbarung.
        if (self.min_provision_betrag is None) != (
            self.min_provision_currency is None
        ):
            raise ValueError(
                "Mindestprovision braucht Betrag UND Währung — ein Betrag ohne "
                "Währung ist kein Geldbetrag."
            )

        # Pauschale: alles oder nichts. Ein Betrag ohne Zeitpunkt wäre nicht
        # ausrechenbar, und die Rechenkette müsste sich einen aussuchen.
        pauschale_felder = (
            self.pauschale_betrag,
            self.pauschale_currency,
            self.pauschale_basis,
            self.pauschale_zeitpunkt,
        )
        gesetzt = [f is not None for f in pauschale_felder]
        if any(gesetzt) and not all(gesetzt):
            raise ValueError(
                "Die Pauschale je Buchung braucht Betrag, Währung, Basis und "
                "Zeitpunkt — oder gar nichts. Eine halbe Angabe lässt sich "
                "nicht abrechnen."
            )
        return self


class OwnerBillingTermsCreate(OwnerBillingTermsBase):
    """Einen Vertrag anlegen.

    ``owner_id`` steht im Pfad, nicht im Rumpf — sonst gäbe es zwei Quellen
    für dieselbe Angabe und die Frage, welche gilt.
    """

    # None = gilt für alle Objekte des Eigentümers.
    property_id: str | None = None


class OwnerBillingTermsUpdate(BaseModel):
    """Einen Vertrag ändern.

    Bewusst OHNE ``property_id``: die Geltung eines bestehenden Vertrags zu
    verschieben, hieße rückwirkend zu behaupten, er habe schon immer für ein
    anderes Objekt gegolten. Wer die Geltung ändern will, beendet den
    Vertrag und legt einen neuen an — das ist die Zeitachse, und sie bleibt
    dabei nachvollziehbar.

    Alle Felder optional (echtes PATCH), aber die Zusammenhänge werden nach
    dem Zusammenführen mit dem Bestand erneut geprüft (Service).
    """

    provisions_pct: float | None = Field(default=None, ge=0, le=100)
    gueltig_ab: date | None = None
    # Wichtig: ein gesetztes `gueltig_bis: None` ist nicht von „nicht gesendet"
    # zu unterscheiden. Zum Aufheben einer Befristung gibt es deshalb den
    # eigenen Schalter `unbefristet` — sonst könnte man eine Befristung
    # anlegen, aber nie wieder entfernen.
    gueltig_bis: date | None = None
    unbefristet: bool = False
    min_provision_betrag: float | None = Field(default=None, ge=0)
    min_provision_currency: str | None = None
    # Gegenstück zu `unbefristet` für die beiden optionalen Blöcke: ohne sie
    # ließe sich eine einmal vereinbarte Mindestprovision/Pauschale nicht
    # wieder abschaffen.
    ohne_min_provision: bool = False
    pauschale_betrag: float | None = Field(default=None, ge=0)
    pauschale_currency: str | None = None
    pauschale_basis: PauschaleBasis | None = None
    pauschale_zeitpunkt: PauschaleZeitpunkt | None = None
    ohne_pauschale: bool = False
    notiz: str | None = Field(default=None, max_length=2000)

    @field_validator("min_provision_currency", "pauschale_currency")
    @classmethod
    def _currency(cls, value: str | None) -> str | None:
        return _pruefe_currency(value)


class OwnerBillingTermsResponse(BaseModel):
    """Ein gespeicherter Vertrag.

    Die Enum-Felder kommen als ``str`` zurück, nicht als Enum-Instanz: die
    Antwort ist JSON, und ein Enum-Wert, den die DB kennt und dieses Modul
    (noch) nicht, soll die Antwort nicht sprengen.
    """

    id: str
    owner_id: str
    property_id: str | None = None
    gueltig_ab: date
    gueltig_bis: date | None = None
    provisions_pct: float
    min_provision_betrag: float | None = None
    min_provision_currency: str | None = None
    pauschale_betrag: float | None = None
    pauschale_currency: str | None = None
    pauschale_basis: str | None = None
    pauschale_zeitpunkt: str | None = None
    notiz: str | None = None
    erstellt_von: str | None = None
    created_at: str
    updated_at: str
    # Gilt dieser Vertrag heute? Vom Server berechnet, nicht vom Client aus
    # den Daten abgeleitet: „heute" ist die Uhr des Servers, und zwei Clients
    # in verschiedenen Zeitzonen kämen sonst zu verschiedenen Aussagen.
    aktuell: bool


class OwnerBillingTermsListResponse(BaseModel):
    """Die vollständige Historie einer Geltung, nicht nur der aktuelle Stand.

    Die Oberfläche muss zeigen, was WANN galt — sonst ist eine Abrechnung aus
    dem Juli nicht nachvollziehbar, wenn im September ein anderer Satz gilt.
    """

    items: list[OwnerBillingTermsResponse]


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
