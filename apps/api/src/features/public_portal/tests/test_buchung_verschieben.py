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
from fastapi import HTTPException

from src.core.security import AuthContext
from src.features.auth.permissions import (
    Capability,
    UserRole,
    has_capability,
    owner_family_has_capability,
)
from src.features.public_portal.dependencies import require_portal_faehigkeit
from src.features.public_portal.familie import STUFEN
from src.features.public_portal.schemas import ReservationMoveRequest
from src.features.public_portal.service import PortalError, PublicPortalService


class _Konto:
    """Kontodienst-Doppel: Rolle aus der DB ist `owner` — wie beim echten
    Familienmitglied, das genau deshalb durch den Rollenpfad rutschte."""

    @staticmethod
    def role_and_permissions(_ctx: AuthContext) -> tuple[UserRole, list[str]]:
        return UserRole.owner, []


class _Familie:
    """Familiendienst-Doppel. `None` = der Eigentümer selbst, keine Deckelung."""

    def __init__(self, stufe: str | None) -> None:
        self._stufe = stufe

    def stufe(self, _ctx: AuthContext) -> str | None:
        return self._stufe


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
        # Der Dienst liest `owner_property_assignments` (`_owned_property_ids`).
        # Bis zum 15.09.2026 stand hier nur `owner_properties` — die Tabelle
        # war damit IMMER leer, jedes `_require_own` schlug fehl, und die
        # 404-Tests unten waren grün, ohne den Objekt-Scope je zu berühren.
        if name in ("owner_property_assignments", "owner_properties"):
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
                # Die WAHREN Grenzen. Der Dienst rechnet ab 15.09.2026 aus
                # ihnen, nicht aus dem, was der Client schickt.
                "check_in": "2026-09-10",
                "check_out": "2026-09-17",
            }
        ],
        zuordnungen=[{"tenant_id": TENANT, "user_id": USER, "property_id": MEINS}],
    )
    return PublicPortalService(db)  # type: ignore[arg-type]


def _anfrage(tage: int = 3) -> ReservationMoveRequest:
    return ReservationMoveRequest(tage=tage)


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

    Iteriert über `familie.STUFEN` statt über eine geschriebene Liste. Bis zum
    15.09.2026 standen hier `("nutzung", "verwaltung", "finanzen")` — zwei
    davon gibt es nicht, und `owner_family_has_capability` gibt für einen
    unbekannten Wert fail-closed die leere Menge. Der Test war damit für zwei
    Drittel seiner Durchläufe eine Tautologie.
    """
    assert STUFEN, "ohne Stufen prüft diese Schleife nichts"
    for zugang in STUFEN:
        assert not owner_family_has_capability(
            zugang, Capability.MOVE_OWN_RESERVATION
        ), f"Familienzugang {zugang!r} darf keine Buchungen verschieben"


def test_familienstufe_hat_request_block_aber_nicht_move() -> None:
    """Der Unterschied, auf dem die ganze Begründung von `_MOVE` ruht."""
    for zugang in STUFEN:
        assert owner_family_has_capability(zugang, Capability.REQUEST_BLOCK)
        assert not owner_family_has_capability(zugang, Capability.MOVE_OWN_RESERVATION)


@pytest.mark.parametrize("stufe", list(STUFEN))
@pytest.mark.parametrize(
    "cap",
    [
        Capability.MOVE_OWN_RESERVATION,
        Capability.BOOK_SERVICES,
        Capability.ADD_METER_READING,
    ],
)
def test_guard_weist_familienmitglied_ab(stufe: str, cap: Capability) -> None:
    """Der GUARD, nicht die Tabelle — hier lag die Lücke (15.09.2026).

    Der vorige Test prüfte `owner_family_has_capability` und war grün, während
    die Route jedem Familienmitglied offenstand: `require_permission` wählte
    für diese Fähigkeiten den reinen Rollenpfad, und die Rolle IST `owner`.
    Eine Fähigkeitstabelle zu prüfen sagt nichts darüber, ob der Endpunkt sie
    befragt.
    """
    guard = require_portal_faehigkeit(cap)
    with pytest.raises(HTTPException) as fehler:
        guard(ctx=_ctx(), konto=_Konto(), familie=_Familie(stufe))
    assert fehler.value.status_code == 403


@pytest.mark.parametrize(
    "cap",
    [
        Capability.MOVE_OWN_RESERVATION,
        Capability.BOOK_SERVICES,
        Capability.ADD_METER_READING,
    ],
)
def test_guard_laesst_den_eigentuemer_durch(cap: Capability) -> None:
    """Die Gegenprobe: ohne Familienstufe (`None`) bleibt alles erlaubt."""
    guard = require_portal_faehigkeit(cap)
    assert guard(ctx=_ctx(), konto=_Konto(), familie=_Familie(None)) is not None


def test_null_tage_ist_keine_verschiebung() -> None:
    """Ein Aufruf ohne Wirkung ist ein Fehler des Aufrufers, kein stiller No-Op."""
    with pytest.raises(ValueError):
        ReservationMoveRequest(tage=0)


def test_verschiebung_ueber_ein_jahr_wird_abgewiesen() -> None:
    """Harte Obergrenze (Wurzel 8): sonst laeuft das Belegen der Naechte ewig."""
    for tage in (400, -400):
        with pytest.raises(ValueError):
            ReservationMoveRequest(tage=tage)


def test_nach_frueher_ist_erlaubt() -> None:
    """Negativ MUSS gehen.

    Die App klemmte den Versatz bis zum 15.09.2026 mit `Math.max(0, …)`, weil
    sie ihn aus einer Naechtezaehlung ableitete. Ein Chip liess sich damit nie
    nach links ziehen — ohne Meldung, er sprang nur zurueck. Der Vertrag
    haelt jetzt fest, dass die Richtung beide Vorzeichen hat.
    """
    assert ReservationMoveRequest(tage=-5).tage == -5


def test_verschiebung_rechnet_aus_den_ECHTEN_daten_der_zeile() -> None:
    """Der Kern des Fehlers vom 15.09.2026.

    Die Buchung laeuft 10.09.–17.09. Der Client sagt nur „drei Tage nach
    hinten“; heraus muessen 13.09.–20.09. kommen — gleiche LAENGE. Vorher
    schickte der Client absolute Daten aus seinem beschnittenen Monatsblatt,
    und eine Buchung, die vor dem Blatt begann, wurde dabei verkuerzt.
    """
    gesehen: dict = {}

    class _Reservierungen:
        def move(self, _ctx, _rid, req) -> None:  # noqa: D102
            gesehen["ein"] = req.check_in
            gesehen["aus"] = req.check_out

    import src.features.public_portal.service as modul

    echt = modul.ReservationsService if hasattr(modul, "ReservationsService") else None
    dienst = _dienst(MEINS)
    import src.features.reservations.service as res_modul

    alt = res_modul.ReservationsService
    res_modul.ReservationsService = lambda _db: _Reservierungen()  # type: ignore[assignment]
    try:
        dienst.move_reservation(_ctx(), BUCHUNG, _anfrage(3))
    finally:
        res_modul.ReservationsService = alt  # type: ignore[assignment]
    assert echt is None or True
    assert (str(gesehen["ein"]), str(gesehen["aus"])) == ("2026-09-13", "2026-09-20")
