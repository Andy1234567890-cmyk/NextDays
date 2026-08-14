"""Schemas des MCP-Slice."""
from pydantic import BaseModel, Field

from .oauth_service import SCOPE_LESEN


class ConsentRequest(BaseModel):
    """Zustimmung des angemeldeten Nutzers zu einem MCP-Client."""

    client_id: str = Field(min_length=1, max_length=2048)
    redirect_uri: str = Field(min_length=1, max_length=2048)
    code_challenge: str = Field(min_length=1, max_length=256)
    scope: str = SCOPE_LESEN
    state: str = Field(default="", max_length=1024)
    resource: str = Field(default="", max_length=2048)


class ConsentResponse(BaseModel):
    """Wohin das Dashboard nach der Zustimmung weiterleitet."""

    weiter_zu: str


class Verbindung(BaseModel):
    """Eine erteilte Zustimmung (Konto → Verbindungen)."""

    client_id: str
    # Der HOST der client_id-URL — die einzige geprüfte Identität des Clients.
    host: str
    scope: str
    erteilt_am: str


class VerbindungListe(BaseModel):
    items: list[Verbindung] = []


class UmfangAenderung(BaseModel):
    """Umfang einer bestehenden Verbindung ändern (0389).

    Zwei zuschaltbare Achsen: Freitexte (Notizen/Nachrichteninhalte) und
    Schreiben (Änderungen am operativen Geschäft). Der Lese-Scope ist die
    Grundlage der Verbindung — wer den nicht mehr will, trennt sie.

    `schreiben=None` lässt die Schreib-Achse unverändert, damit ein Umschalten
    der Freitexte eine erteilte Schreibfreigabe nicht stillschweigend entzieht.
    """

    client_id: str
    freitexte: bool
    schreiben: bool | None = None


class Zugriff(BaseModel):
    """Ein protokollierter Abruf über eine Verbindung (0388).

    Ohne Inhalte — nur WAS abgerufen wurde. Der Betrieb braucht das, um eine
    Auskunft nach Art. 15 DSGVO erteilen zu können.
    """

    host: str
    werkzeug: str
    ziel_id: str | None = None
    anzahl: int = 0
    scopes: str = ""
    erfolg: bool = True
    zeitpunkt: str


class ZugriffListe(BaseModel):
    items: list[Zugriff] = []


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
