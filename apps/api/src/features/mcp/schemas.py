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
