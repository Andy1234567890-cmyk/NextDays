"""Entitlement-Gate für Modul 3 (Buchhaltung).

`modul3_buchhaltung` ist kaufbar (PLAN-stripe-preisliste.md Z. 94) und muss
serverseitig erzwungen werden (Z. 142-144) — vorher erreichte jeder
admin/co_admin den vollen Slice, auch ohne gekauftes Modul.

Drei Ebenen bleiben getrennt: Rolle (403) → Entitlement (402) → Daten.
"""

import pytest
from fastapi import HTTPException

from src.core.security import AuthContext

# Die Guards leben seit dem 12.09.2026 in `guards.py` (Bereiche importieren sie
# ohne Zirkel); gepatcht wird deshalb dort, nicht im Router.
from src.features.buchhaltung import guards as buchhaltung_guards
from src.features.buchhaltung import router as buchhaltung_router
from src.features.buchhaltung.guards import (
    BUCHHALTUNG_MODULE_KEY,
    _require_buchhaltung_modul,
)


class _FakeDb:
    """Minimaler Supabase-Doppelgänger: liefert genau die eine Entitlement-Zeile."""

    def __init__(self, rows: list[dict]) -> None:
        self._rows = rows
        self.gefragt: dict[str, str] = {}

    def table(self, name: str) -> "_FakeDb":
        self.gefragt["table"] = name
        return self

    def select(self, _cols: str) -> "_FakeDb":
        return self

    def eq(self, spalte: str, wert: str) -> "_FakeDb":
        self.gefragt[spalte] = wert
        return self

    def limit(self, _n: int) -> "_FakeDb":
        return self

    def execute(self) -> "_FakeDb":
        return self

    @property
    def data(self) -> list[dict]:
        return self._rows


@pytest.fixture(name="db_setzen")
def _db_setzen(monkeypatch: pytest.MonkeyPatch):  # noqa: ANN202
    """Ersetzt den Service-Client in den Guards durch den Doppelgänger."""

    def _setzen(rows: list[dict]) -> _FakeDb:
        fake = _FakeDb(rows)
        monkeypatch.setattr(buchhaltung_guards, "get_service_client", lambda: fake)
        return fake

    return _setzen


def test_aktives_modul_laesst_durch(db_setzen) -> None:  # noqa: ANN001
    fake = db_setzen([{"active": True}])
    ctx = AuthContext(user_id="u", tenant_id="t1", role="admin")
    assert _require_buchhaltung_modul(ctx) is ctx
    # Gefragt wurde nach genau diesem Tenant und diesem Modul (kein Leak).
    assert fake.gefragt["table"] == "tenant_module_entitlement"
    assert fake.gefragt["tenant_id"] == "t1"
    assert fake.gefragt["module_key"] == BUCHHALTUNG_MODULE_KEY


@pytest.mark.parametrize(
    "rows",
    [
        pytest.param([], id="keine_zeile"),
        pytest.param([{"active": False}], id="gekuendigt"),
        pytest.param([{"active": None}], id="unklar"),
        pytest.param([{}], id="spalte_fehlt"),
    ],
)
def test_ohne_modul_402(db_setzen, rows: list[dict]) -> None:  # noqa: ANN001
    """Fail-CLOSED: jede Form von „nicht aktiv" gibt 402, nie Zugriff."""
    db_setzen(rows)
    ctx = AuthContext(user_id="u", tenant_id="t1", role="admin")
    with pytest.raises(HTTPException) as exc:
        _require_buchhaltung_modul(ctx)
    assert exc.value.status_code == 402


def test_ohne_tenant_402(db_setzen) -> None:  # noqa: ANN001
    """Kein Tenant im Kontext → kein Modul (fail-CLOSED), nicht 500."""
    db_setzen([{"active": True}])
    ctx = AuthContext(user_id="u", tenant_id=None, role="admin")
    with pytest.raises(HTTPException) as exc:
        _require_buchhaltung_modul(ctx)
    assert exc.value.status_code == 402


def _guard_kette(pfad: str, methode: str = "GET") -> set[str]:
    """Namen aller Guards, die FastAPI fuer diese Route wirklich aufruft.

    Bewusst ueber den echten Dependency-Graphen statt durch direkten Aufruf des
    Guards: `_require_agency_finance_with_modul(ctx)` von Hand aufzurufen
    ueberspringt die Injektion und damit den Rollen-Guard — ein Test, der so
    prueft, wuerde gruen bleiben, auch wenn die Kette gar nicht haengt.
    """
    routen = [
        r
        for r in buchhaltung_router.router.routes
        if getattr(r, "path", "") == pfad and methode in getattr(r, "methods", set())
    ]
    assert len(routen) == 1, pfad
    namen: set[str] = set()

    def _lauf(dep) -> None:  # noqa: ANN001
        for sub in dep.dependencies:
            namen.add(getattr(sub.call, "__name__", str(sub.call)))
            _lauf(sub)

    _lauf(routen[0].dependant)
    return namen


def test_gate_ersetzt_rollen_guard_nicht() -> None:
    """Das Entitlement kommt ZUSAETZLICH zum Rollen-Guard, nicht statt ihm:
    an jeder gegateten Route haengen beide."""
    kette = _guard_kette("/buchhaltung/customers")
    assert "_require_agency_finance_with_modul" in kette
    assert "_require_agency_finance" in kette
    assert "get_current_user" in kette


def test_alle_datenrouten_gegated() -> None:
    """Keine Datenroute des Slice ohne Entitlement — ausser den bewusst
    ausgenommenen: /health (Ping), das Firmenprofil (/konto-Stammdaten,
    Onboarding) und die Nutzer-Praeferenzen-Leseroute."""
    ausnahmen = {
        ("/buchhaltung/health", "GET"),
        ("/buchhaltung/companies/{company_id}", "GET"),
        ("/buchhaltung/companies/{company_id}", "PATCH"),
        ("/buchhaltung/companies/{company_id}/stripe-sync", "POST"),
        ("/buchhaltung/companies/{company_id}/logo", "POST"),
        ("/buchhaltung/users/{user_id}/preferences", "GET"),
        ("/buchhaltung/users/{user_id}/preferences", "PATCH"),
    }
    offen: list[tuple[str, str]] = []
    for route in buchhaltung_router.router.routes:
        pfad = getattr(route, "path", "")
        for methode in sorted(getattr(route, "methods", set())):
            if (pfad, methode) in ausnahmen:
                continue
            if "_require_agency_finance_with_modul" not in _guard_kette(pfad, methode):
                offen.append((pfad, methode))
    assert not offen, f"ungegatete Datenrouten: {offen}"


def test_health_bleibt_ungegated() -> None:
    """/health ist der Slice-Ping — er darf kein Entitlement verlangen."""
    kette = _guard_kette("/buchhaltung/health")
    assert "_require_agency_finance_with_modul" not in kette
    assert "_require_buchhaltung_modul" not in kette


def test_firmenprofil_ohne_entitlement_erreichbar() -> None:
    """Firmen-/Rechnungsprofil ist Konto-Stammdatum (Onboarding, /konto): es
    darf NICHT hinter Modul 3 liegen, sonst kommt kein Neukunde durch das
    Onboarding. Der Rollen-Guard bleibt aber bestehen."""
    for pfad, methode, rollen_guard in (
        ("/buchhaltung/companies/{company_id}", "GET", "_require_company_profile_read"),
        ("/buchhaltung/companies/{company_id}", "PATCH", "_require_agency_finance"),
        ("/buchhaltung/companies/{company_id}/stripe-sync", "POST", "_require_agency_finance"),
        ("/buchhaltung/companies/{company_id}/logo", "POST", "_require_agency_finance"),
    ):
        kette = _guard_kette(pfad, methode)
        assert "_require_agency_finance_with_modul" not in kette, (pfad, methode)
        assert rollen_guard in kette, (pfad, methode)
