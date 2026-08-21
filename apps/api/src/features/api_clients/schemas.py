"""Schemas für den Entwickler-API-Zugang (Booking-„Machine Account"-Modell).

Ein Tenant erzeugt API-Clients (Client-ID + Secret) mit funktionsgebundenen
Scopes + Objekt-Beschränkung, Test/Live getrennt. Das Secret wird genau EINMAL
bei der Erzeugung zurückgegeben (danach nur noch der Hash in der DB).
"""
from __future__ import annotations

from pydantic import BaseModel, Field, field_validator

# Funktionsgebundene Ressourcen-Scopes (Booking-„Connection Type"-Prinzip):
# je öffentlicher API-Domäne ein Read- und ein Write-Scope. Write schließt Read
# NICHT automatisch ein — beide müssen explizit gewählt werden (kein impliziter
# Rechte-Zuwachs).
#
# Der Katalog steht seit dem Bau der öffentlichen API in `scopes.py` — einer
# Schwesterdatei von `apps/public-api/src/core/scopes.py`. Grund: die Liste hier
# entschied, was das Dashboard vergeben darf, und der öffentliche Service
# entscheidet, was ein Endpunkt verlangt. Zwei Listen hätten bedeutet, dass ein
# im Dashboard angebotener Scope am Endpunkt nichts bewirkt (Dauer-403 beim
# Kunden, ohne dass irgendwo ein Fehler auftaucht).
from .scopes import API_SCOPES, SCOPE_KATALOG, unbekannte_scopes

__all__ = [
    "API_SCOPES",
    "SCOPE_KATALOG",
    "ApiClientCreate",
    "ApiClientCreated",
    "ApiClientResponse",
    "ScopeInfo",
    "SliceHealth",
]


class SliceHealth(BaseModel):
    status: str
    slice: str = "api_clients"


class ScopeInfo(BaseModel):
    """Ein vergebbarer Scope samt Beschreibung — für die Auswahl im Dashboard.

    Damit muss das Frontend die Liste nicht doppelt pflegen: es fragt sie ab.
    """

    scope: str
    beschreibung: str


class ApiClientCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    is_test: bool = False
    # Mindestens ein gültiger Scope (leer = nutzloser Client, fail-closed).
    scopes: list[str] = Field(min_length=1)
    # Leeres Array = alle Objekte des Tenants; sonst nur die gelisteten.
    property_ids: list[str] = Field(default_factory=list)

    @field_validator("scopes")
    @classmethod
    def _valid_scopes(cls, v: list[str]) -> list[str]:
        unknown = unbekannte_scopes(v)
        if unknown:
            raise ValueError(f"Unbekannte Scopes: {', '.join(unknown)}")
        # Duplikate entfernen, Reihenfolge stabil.
        return list(dict.fromkeys(v))


class ApiClientResponse(BaseModel):
    """Ein API-Client OHNE Secret (Listen-/Detailansicht)."""
    id: str
    client_id: str
    name: str
    is_test: bool
    scopes: list[str]
    property_ids: list[str]
    secret_last4: str
    revoked_at: str | None = None
    last_used_at: str | None = None
    created_at: str | None = None


class ApiClientCreated(ApiClientResponse):
    """Antwort NUR beim Erzeugen/Rotieren: enthält das Klartext-Secret EINMALIG.
    Es wird nie wieder ausgeliefert (nur der Hash bleibt in der DB)."""
    client_secret: str
