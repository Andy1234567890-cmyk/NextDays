"""Regression: das Betriebs-Onboarding gehört der Betriebsführung (Wurzel 9).

LIVE BEOBACHTET (09.08.2026): Ein eingeloggter Eigentümer sah den Setup-
Assistenten „Willkommen bei myNextDays — Zuerst legen wir dein Unternehmen an …
Schritt 1 von 5". Die Messung gegen die laufende API zeigte, dass das kein
Anzeigefehler war: `GET /api/v1/dashboard/onboarding` antwortete einem `owner`
mit 200, und `PATCH` schaltete `company_data_set` des BETRIEBS tatsächlich um.

Ursache: Beide Endpunkte hingen nur an `CurrentUser` — das ist
AUTHENTIFIZIERUNG (ist jemand eingeloggt?), nicht AUTORISIERUNG (darf er das?).
Damit konnte jede Rolle des Mandanten den Einrichtungsstand des Betriebs lesen
und umschreiben; das Frontend leitet aus diesen Flags ab, ob der Assistent
erscheint.

Der Fix hängt beide Endpunkte an `MANAGE_TENANT` — die Fähigkeit besitzt
ausschliesslich `admin`. Diese Tests stellen den Angriff nach, damit die
Autorisierung nicht unbemerkt wieder auf `CurrentUser` zurückfällt.
"""
import pytest
from fastapi import HTTPException

from src.core.security import AuthContext, get_current_user
from src.features.auth.dependencies import require_permission
from src.features.auth.permissions import Capability

# Der Guard, der an beiden Onboarding-Endpunkten hängt.
_GUARD = require_permission(Capability.MANAGE_TENANT)


@pytest.mark.parametrize("role", ["owner", "staff", "cleaner", "co_admin"])
def test_nicht_betriebsfuehrung_kommt_nicht_ans_onboarding(role: str) -> None:
    """owner/staff/cleaner/co_admin bekommen 403 — der gemessene Angriff.

    `owner` ist der live beobachtete Fall; die übrigen Rollen stehen hier, weil
    sie denselben Weg gehen könnten und das Onboarding niemanden ausser die
    Betriebsführung angeht.
    """
    ctx = AuthContext(user_id="u", tenant_id="t1", role=role)
    with pytest.raises(HTTPException) as exc:
        _GUARD(ctx)
    assert exc.value.status_code == 403


def test_admin_darf_das_onboarding_weiterhin() -> None:
    """Gegenprobe: der Fix sperrt nicht den legitimen Weg aus."""
    ctx = AuthContext(user_id="u", tenant_id="t1", role="admin")
    assert _GUARD(ctx) is ctx


@pytest.mark.parametrize("role", [None, "", "phantasie_rolle"])
def test_fehlende_oder_unbekannte_rolle_faellt_zu_403(role: str | None) -> None:
    """Fail-CLOSED (Wurzel 5): keine Rolle heisst keine Fähigkeit.

    Ohne diese Zusicherung wäre ein Tippfehler in der DB oder ein Token ohne
    Rollen-Claim ein stiller Freifahrtschein.
    """
    ctx = AuthContext(user_id="u", tenant_id="t1", role=role)
    with pytest.raises(HTTPException) as exc:
        _GUARD(ctx)
    assert exc.value.status_code == 403


def test_endpunkte_haengen_wirklich_am_guard_nicht_nur_an_currentuser() -> None:
    """Die Verdrahtung selbst prüfen, nicht nur den Guard.

    Der eigentliche Fehler war nicht ein kaputter Guard, sondern ein FEHLENDER:
    die Route hing an `get_current_user`. Ein Test, der nur `_GUARD` prüft,
    würde einen Rückfall auf `CurrentUser` nicht bemerken — deshalb hier die
    Signatur der echten Routen abklopfen.
    """
    from src.features.dashboard import router as dashboard_router

    routen = {
        r.name: r
        for r in dashboard_router.router.routes
        if getattr(r, "name", None) in {"get_onboarding", "update_onboarding"}
    }
    assert set(routen) == {"get_onboarding", "update_onboarding"}

    for name, route in routen.items():
        abhaengigkeiten = [
            d.call for d in route.dependant.dependencies if d.call is not None
        ]
        assert get_current_user not in abhaengigkeiten, (
            f"{name} hängt wieder direkt an get_current_user — "
            "das ist Authentifizierung ohne Autorisierung (Wurzel 9)."
        )
        # Der MANAGE_TENANT-Guard ist eine Closure aus require_permission; er
        # ist daran erkennbar, dass er get_current_user als Unter-Dependency
        # führt und selbst nicht get_current_user ist.
        unter = [
            u.call
            for d in route.dependant.dependencies
            for u in d.dependencies
            if u.call is not None
        ]
        assert get_current_user in unter, (
            f"{name} hat keinen Guard, der die Rolle prüft."
        )
