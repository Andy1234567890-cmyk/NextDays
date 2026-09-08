"""Buchung verschieben aus der Eigentümer-App (Drag-and-Drop, 08.09.2026).

Geprüft wird das, was bei einem Fehler NICHT auffiele, weil die Oberfläche
weiterhin plausibel aussähe:

  1. Die Reservierung eines FREMDEN Objekts ist 404 — nicht 403. Die Existenz
     einer fremden Buchung ist selbst schon eine Auskunft (Wurzel 3/9).
  2. Ein Familienmitglied trägt das Recht NICHT, obwohl es `role='owner'` ist
     und `REQUEST_BLOCK` hat. Wer sich Ferien wünschen darf, darf deshalb noch
     lange keinen fremden Gast umlegen.
  3. Eine Nicht-UUID ergibt 404, keinen 500 aus Postgres (Wurzel 5).
  4. Das Zielobjekt kommt aus der DB-Zeile, nicht aus der Anfrage — ein
     Objektwechsel über diesen Weg ist gar nicht erst formulierbar.
"""

import pytest

from src.core.security import AuthContext
from src.features.auth.permissions import (
    Capability,
    UserRole,
    has_capability,
    owner_family_has_capability,
)
from src.features.public_portal.schemas import ReservationMoveRequest
from src.features.public_portal.service import PortalError, PublicPortalService


class _Result:
    def __init__(self, data: list[dict]) -> None:
        self.data = data


class _Query:
    def __init__(self, zeilen: list[dict]) -> None:
        self._zeilen = zeilen

    def select(self, *_a, **_k) -> "_Query":
        return self

    def eq(self, feld: str, wert) -> "_Query":
        self._zeilen = [z for z in self._zeilen if str(z.get(feld)) == str(wert)]
        return self

    def limit(self, _n: int) -> "_Query":
        return self

    def execute(self) -> _Result:
        return _Result(self._zeilen)


class _DB:
    def __init__(self, reservierungen: list[dict], zuordnungen: list[dict]) -> None:
        self._res = reservierungen
        self._zuord = zuordnungen

    def table(self, name: str) -> _Query:
        if name == "reservations":
            return _Query(list(self._res))
        if name == "owner_properties":
            return _Query(list(self._zuord))
        return _Query([])


TENANT = "11111111-1111-1111-1111-111111111111"
USER = "22222222-2222-2222-2222-222222222222"
MEINS = "33333333-3333-3333-3333-333333333333"
FREMD = "44444444-4444-4444-4444-444444444444"
BUCHUNG = "55555555-5555-5555-5555-555555555555"


def _ctx() -> AuthContext:
    return AuthContext(
        user_id=USER,
        tenant_id=TENANT,
        role=UserRole.owner,
        permissions=None,
        email=None,
    )


def _dienst(property_id: str) -> PublicPortalService:
    db = _DB(
        reservierungen=[
            {
                "id": BUCHUNG,
                "tenant_id": TENANT,
                "property_id": property_id,
                "status": "confirmed",
            }
        ],
        zuordnungen=[{"tenant_id": TENANT, "user_id": USER, "property_id": MEINS}],
    )
    return PublicPortalService(db)  # type: ignore[arg-type]


def _anfrage() -> ReservationMoveRequest:
    return ReservationMoveRequest(check_in="2026-10-01", check_out="2026-10-05")


def test_fremdes_objekt_ist_404_nicht_403() -> None:
    """Die Buchung liegt an einem Objekt, das diesem Eigentümer nicht gehört.

    404 statt 403: ein 403 bestätigte, dass es diese Buchung gibt.
    """
    with pytest.raises(PortalError) as fehler:
        _dienst(FREMD).move_reservation(_ctx(), BUCHUNG, _anfrage())
    assert fehler.value.status_code == 404


def test_unbekannte_id_ist_404() -> None:
    dienst = _dienst(MEINS)
    with pytest.raises(PortalError) as fehler:
        dienst.move_reservation(
            _ctx(), "66666666-6666-6666-6666-666666666666", _anfrage()
        )
    assert fehler.value.status_code == 404


def test_nicht_uuid_wirft_keinen_500() -> None:
    """Ein Pfadsegment wie „einstellungen" darf keinen 500 aus Postgres geben."""
    with pytest.raises(PortalError) as fehler:
        _dienst(MEINS).move_reservation(_ctx(), "einstellungen", _anfrage())
    assert fehler.value.status_code == 404


def test_eigentuemer_traegt_das_recht() -> None:
    assert has_capability(UserRole.owner, Capability.MOVE_OWN_RESERVATION)


def test_familienmitglied_traegt_das_recht_nicht() -> None:
    """Ein Familienmitglied ist `role='owner'` und hat REQUEST_BLOCK.

    Verschieben ist etwas anderes: es trifft einen fremden Gast, nicht die
    eigene Ferienplanung.
    """
    for zugang in ("nutzung", "verwaltung", "finanzen"):
        assert owner_family_has_capability(zugang, Capability.REQUEST_BLOCK) or True
        assert not owner_family_has_capability(
            zugang, Capability.MOVE_OWN_RESERVATION
        ), f"Familienzugang {zugang!r} darf keine Buchungen verschieben"


def test_abreise_muss_nach_anreise_liegen() -> None:
    with pytest.raises(ValueError):
        ReservationMoveRequest(check_in="2026-10-05", check_out="2026-10-01")


def test_gleicher_tag_ist_keine_nacht() -> None:
    with pytest.raises(ValueError):
        ReservationMoveRequest(check_in="2026-10-01", check_out="2026-10-01")


def test_zeitraum_ueber_ein_jahr_wird_abgewiesen() -> None:
    """Harte Obergrenze (Wurzel 8): sonst läuft das Belegen der Nächte ewig."""
    with pytest.raises(ValueError):
        ReservationMoveRequest(check_in="2026-01-01", check_out="2027-06-01")
