"""Regression: Struktur-Änderungen am Bestand sind Sache des Betriebs (Wurzel 9).

GEMESSEN (09.08.2026): `POST /api/v1/properties/buildings` antwortete einem
eingeloggten `owner` mit 201 — der Eigentümer legte ein Gebäude im Mandanten
der Agentur an. Dieselbe Lücke hatte `PUT /properties/{id}/units`.

Beide Endpunkte hingen nur an `CurrentUser` (Authentifizierung) statt an einem
Permission-Guard (Autorisierung), während der Nachbar-Endpunkt
`POST /properties` längst `MANAGE_PROPERTY_SETTINGS` verlangt. Genau diese
Ungleichbehandlung ist die Fehlerklasse: Ein Endpunkt der gleichen Wirkung wird
beim Nachrüsten der Rechte übersehen.

Warum das zählt: Das Gebäude entscheidet, welche Objekte bei den Portalen unter
EINER Kennung stehen; die Einheiten-Stückzahl IST die Verfügbarkeit, die nach
draussen gemeldet wird. Beides greift in den Verkauf ein.
"""
import pytest
from fastapi import HTTPException

from src.core.security import AuthContext, get_current_user
from src.features.auth.dependencies import require_granular_permission
from src.features.auth.granular_permissions import Permission
from src.features.auth.schemas import UserRole

_GUARD = require_granular_permission(Permission.MANAGE_PROPERTY_SETTINGS)

# Die Endpunkte, die diese Befugnis verlangen MÜSSEN.
_GESCHUETZT = {"create_building", "set_unit_count", "create_property"}


class _KontoStub:
    """Minimaler Ersatz für den AccountService.

    Der Guard liest Rolle + permissions bewusst aus der DB statt aus dem JWT
    (Wurzel 7: eine entzogene Rolle würde sonst bis zum Token-Ablauf gelten).
    Der Stub liefert genau diese Auskunft, ohne DB.
    """

    def __init__(self, role: str | None, stored: list[str] | None = None) -> None:
        self._role = role
        self._stored = stored or []

    def role_and_permissions(
        self, _ctx: AuthContext
    ) -> tuple[UserRole | None, list[str]]:
        try:
            return UserRole(self._role), self._stored
        except ValueError:
            # Unbekannte/fehlende Rolle: der Guard muss damit fail-closed
            # umgehen, nicht mit einem Ersatzwert (Wurzel 4).
            return None, self._stored


@pytest.mark.parametrize("role", ["owner", "staff", "cleaner"])
def test_owner_und_personal_duerfen_die_struktur_nicht_aendern(role: str) -> None:
    """Der gemessene Angriff: `owner` legte ein Gebäude an (201) — jetzt 403."""
    ctx = AuthContext(user_id="u", tenant_id="t1", role=role)
    with pytest.raises(HTTPException) as exc:
        _GUARD(ctx, _KontoStub(role))
    assert exc.value.status_code == 403


def test_admin_darf_weiterhin() -> None:
    """Gegenprobe: der legitime Weg bleibt offen."""
    ctx = AuthContext(user_id="u", tenant_id="t1", role="admin")
    assert _GUARD(ctx, _KontoStub("admin")) is ctx


def test_entzogene_rolle_wirkt_sofort_trotz_alten_jwt() -> None:
    """Wurzel 7: die DB entscheidet, nicht der Token.

    Das JWT trägt noch `admin`, in der DB ist der Nutzer längst `owner` —
    der Guard muss der DB folgen und sperren.
    """
    ctx = AuthContext(user_id="u", tenant_id="t1", role="admin")
    with pytest.raises(HTTPException) as exc:
        _GUARD(ctx, _KontoStub("owner"))
    assert exc.value.status_code == 403


@pytest.mark.parametrize("role", [None, "", "phantasie_rolle"])
def test_unbekannte_rolle_faellt_zu_403(role: str | None) -> None:
    """Fail-CLOSED (Wurzel 5): keine Rolle heisst keine Befugnis."""
    ctx = AuthContext(user_id="u", tenant_id="t1", role=role)
    with pytest.raises(HTTPException) as exc:
        _GUARD(ctx, _KontoStub(role))
    assert exc.value.status_code == 403


def test_struktur_endpunkte_haengen_nicht_an_currentuser() -> None:
    """Die Verdrahtung prüfen, nicht nur den Guard.

    Der Fehler war ein FEHLENDER Guard, kein kaputter. Ein Test gegen `_GUARD`
    allein würde einen Rückfall auf `CurrentUser` nicht bemerken.
    """
    from src.features.properties import router as properties_router

    routen = {
        r.name: r
        for r in properties_router.router.routes
        if getattr(r, "name", None) in _GESCHUETZT
    }
    assert set(routen) == _GESCHUETZT, f"Endpunkt fehlt/umbenannt: {set(routen)}"

    for name, route in routen.items():
        direkt = [d.call for d in route.dependant.dependencies if d.call is not None]
        assert get_current_user not in direkt, (
            f"{name} hängt wieder direkt an get_current_user — "
            "Authentifizierung ohne Autorisierung (Wurzel 9)."
        )
        unter = [
            u.call
            for d in route.dependant.dependencies
            for u in d.dependencies
            if u.call is not None
        ]
        assert get_current_user in unter, f"{name} prüft die Rolle nicht."
