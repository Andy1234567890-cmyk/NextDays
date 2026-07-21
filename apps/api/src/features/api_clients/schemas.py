"""Schemas für den Entwickler-API-Zugang (Booking-„Machine Account"-Modell).

Ein Tenant erzeugt API-Clients (Client-ID + Secret) mit funktionsgebundenen
Scopes + Objekt-Beschränkung, Test/Live getrennt. Das Secret wird genau EINMAL
bei der Erzeugung zurückgegeben (danach nur noch der Hash in der DB).
"""
from __future__ import annotations

from pydantic import BaseModel, Field, field_validator


class SliceHealth(BaseModel):
    status: str
    slice: str = "api_clients"


# Funktionsgebundene Ressourcen-Scopes (Booking-„Connection Type"-Prinzip):
# je öffentlicher API-Domäne ein Read- und ein Write-Scope. Write schließt Read
# NICHT automatisch ein — beide müssen explizit gewählt werden (kein impliziter
# Rechte-Zuwachs). Der Katalog ist die Quelle der Wahrheit für die Validierung.
API_SCOPES: frozenset[str] = frozenset({
    "reservations:read",
    "reservations:write",
    "availability:read",
    "availability:write",
    "properties:read",
    "properties:write",
    "calendar_sync:read",
    "calendar_sync:write",
})


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
        unknown = [s for s in v if s not in API_SCOPES]
        if unknown:
            raise ValueError(f"Unbekannte Scopes: {', '.join(sorted(unknown))}")
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


class TokenRequest(BaseModel):
    """Client-Credentials-Token-Tausch (Booking-artig)."""
    grant_type: str = "client_credentials"
    client_id: str
    client_secret: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"  # noqa: S105 — OAuth-Token-Typ, kein Secret
    expires_in: int  # Sekunden (1 h)
    scope: str       # space-separierte gewährte Scopes
