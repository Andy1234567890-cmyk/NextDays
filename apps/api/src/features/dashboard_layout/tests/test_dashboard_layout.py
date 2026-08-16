"""Tests des dashboard_layout-Slice.

Drei Dinge werden hier festgenagelt, weil genau sie beim naechsten Umbau
stillschweigend kippen koennten:

1. **Die Guard-Verdrahtung.** Die Rollen-Standards sind eine tenant-weite
   Vorgabe fuer FREMDE Konten. Haengt so ein Endpunkt versehentlich nur an
   `CurrentUser`, kann jeder cleaner die Startseite des Betriebs umschreiben —
   derselbe Fehler wie beim Onboarding (Wurzel 9). Deshalb wird nicht nur der
   Guard geprueft, sondern die Signatur der echten Routen.
2. **Die Eingabegrenzen.** `layout` ist jsonb aus Client-Hand; ohne harte
   Grenzen ist es ein unbegrenzter Bereich (Wurzel 8).
3. **Die Zusammenfuehrungs-Reihenfolge** Benutzer → Rolle → Katalog, samt der
   Frage, was mit einem unlesbar gewordenen gespeicherten Layout passiert.
"""
from typing import Any

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from src.core.security import AuthContext, get_current_user
from src.features.auth.dependencies import require_permission
from src.features.auth.permissions import Capability
from src.features.dashboard_layout import router as router_modul
from src.features.dashboard_layout.schemas import (
    MAX_KACHELN,
    DashboardLayout,
)
from src.features.dashboard_layout.service import (
    DashboardLayoutError,
    DashboardLayoutService,
)

_GUARD = require_permission(Capability.MANAGE_TENANT)

# Ein gueltiges Minimal-Layout, das in mehreren Tests gebraucht wird.
_LAYOUT = {
    "schema_version": 1,
    "kacheln": [{"id": "kpi:checkins", "x": 0, "y": 0, "groesse": "s"}],
    "ausgeblendet": [],
}


# --- Testdoppel ------------------------------------------------------------


class _Abfrage:
    """Minimaler Supabase-Query-Builder: sammelt Filter, liefert vorgegebene
    Zeilen und protokolliert Schreibzugriffe."""

    def __init__(self, tabelle: str, db: "_DbDoppel") -> None:
        self._tabelle = tabelle
        self._db = db
        self._filter: dict[str, Any] = {}

    def select(self, *_args: str, **_kw: Any) -> "_Abfrage":
        return self

    def eq(self, spalte: str, wert: Any) -> "_Abfrage":
        self._filter[spalte] = wert
        return self

    def limit(self, _n: int) -> "_Abfrage":
        return self

    def upsert(self, daten: dict[str, Any], **_kw: Any) -> "_Abfrage":
        self._db.geschrieben.append((self._tabelle, daten))
        return self

    def delete(self) -> "_Abfrage":
        self._db.geloescht.append(self._tabelle)
        return self

    def execute(self) -> Any:
        zeilen = self._db.zeilen.get(self._tabelle, [])
        passend = [
            z
            for z in zeilen
            if all(z.get(k) == v for k, v in self._filter.items())
        ]
        return type("Antwort", (), {"data": passend, "count": len(passend)})()


class _DbDoppel:
    def __init__(self, zeilen: dict[str, list[dict[str, Any]]] | None = None) -> None:
        self.zeilen = zeilen or {}
        self.geschrieben: list[tuple[str, dict[str, Any]]] = []
        self.geloescht: list[str] = []

    def table(self, name: str) -> _Abfrage:
        return _Abfrage(name, self)


def _service(zeilen: dict[str, list[dict[str, Any]]] | None = None) -> DashboardLayoutService:
    return DashboardLayoutService(db=_DbDoppel(zeilen))  # type: ignore[arg-type]


# --- 1. Guard-Matrix und Verdrahtung ---------------------------------------


@pytest.mark.parametrize("role", ["owner", "staff", "cleaner", "co_admin"])
def test_rollen_standard_nur_fuer_die_betriebsfuehrung(role: str) -> None:
    """Ein Standard fuer eine ganze Rolle ist eine Vorgabe fuer fremde Konten —
    das gehoert der Betriebsfuehrung, nicht jedem eingeloggten Nutzer."""
    ctx = AuthContext(user_id="u", tenant_id="t1", role=role)
    with pytest.raises(HTTPException) as exc:
        _GUARD(ctx)
    assert exc.value.status_code == 403


def test_admin_darf_rollen_standards_setzen() -> None:
    """Gegenprobe: der Guard sperrt den legitimen Weg nicht aus."""
    ctx = AuthContext(user_id="u", tenant_id="t1", role="admin")
    assert _GUARD(ctx) is ctx


@pytest.mark.parametrize("role", [None, "", "phantasie_rolle"])
def test_fehlende_rolle_faellt_zu_403(role: str | None) -> None:
    """Fail-CLOSED (Wurzel 5): keine bekannte Rolle heisst keine Faehigkeit."""
    ctx = AuthContext(user_id="u", tenant_id="t1", role=role)
    with pytest.raises(HTTPException) as exc:
        _GUARD(ctx)
    assert exc.value.status_code == 403


def test_rollen_standard_routen_haengen_wirklich_am_guard() -> None:
    """Die Verdrahtung selbst pruefen, nicht nur den Guard.

    Der teure Fehler ist nicht ein kaputter Guard, sondern ein FEHLENDER: eine
    Route, die nur an `get_current_user` haengt. Ein Test, der ausschliesslich
    `_GUARD` prueft, wuerde diesen Rueckfall nicht bemerken.
    """
    namen = {"get_rollen_standard", "put_rollen_standard", "delete_rollen_standard"}
    routen = {
        r.name: r
        for r in router_modul.router.routes
        if getattr(r, "name", None) in namen
    }
    assert set(routen) == namen

    for name, route in routen.items():
        direkt = [d.call for d in route.dependant.dependencies if d.call is not None]
        assert get_current_user not in direkt, (
            f"{name} haengt wieder direkt an get_current_user — "
            "Authentifizierung ohne Autorisierung (Wurzel 9)."
        )
        unter = [
            u.call
            for d in route.dependant.dependencies
            for u in d.dependencies
            if u.call is not None
        ]
        assert get_current_user in unter, f"{name} hat keinen rollenpruefenden Guard."


def test_eigenes_layout_haengt_bewusst_nur_an_currentuser() -> None:
    """Gegenprobe zur Regel: das EIGENE Layout ist keine Autorisierungsfrage.

    Jeder eingeloggte Nutzer darf seine eigene Startseite anordnen; der Scope
    ist die eigene user_id. Waeren hier zusaetzliche Rechte noetig, koennte ein
    cleaner seine Kacheln nicht sortieren — das ist ausdruecklich gewollt so.
    """
    routen = {
        r.name
        for r in router_modul.router.routes
        if getattr(r, "name", None)
        in {"get_dashboard_layout", "put_dashboard_layout", "delete_dashboard_layout"}
    }
    assert routen == {
        "get_dashboard_layout",
        "put_dashboard_layout",
        "delete_dashboard_layout",
    }


# --- 2. Eingabegrenzen (Wurzel 8) ------------------------------------------


def test_unbekannte_kachel_id_wird_abgewiesen() -> None:
    """Der Katalog ist die Wahrheit — eine erfundene ID kommt nicht in die DB."""
    with pytest.raises(ValidationError):
        DashboardLayout.model_validate(
            {"kacheln": [{"id": "kpi:erfunden", "x": 0, "y": 0, "groesse": "s"}]}
        )


def test_zu_viele_kacheln_werden_abgewiesen() -> None:
    """Harte Obergrenze statt eines unbegrenzten Bereichs."""
    zu_viele = [
        {"id": "kpi:checkins", "x": 0, "y": i, "groesse": "s"}
        for i in range(MAX_KACHELN + 1)
    ]
    with pytest.raises(ValidationError):
        DashboardLayout.model_validate({"kacheln": zu_viele})


@pytest.mark.parametrize("koordinate", [-1, 201])
def test_koordinaten_ausserhalb_der_grenzen_werden_abgewiesen(koordinate: int) -> None:
    with pytest.raises(ValidationError):
        DashboardLayout.model_validate(
            {"kacheln": [{"id": "kpi:checkins", "x": koordinate, "y": 0, "groesse": "s"}]}
        )


def test_unbekannte_groesse_wird_abgewiesen() -> None:
    with pytest.raises(ValidationError):
        DashboardLayout.model_validate(
            {"kacheln": [{"id": "kpi:checkins", "x": 0, "y": 0, "groesse": "xxl"}]}
        )


def test_unbekanntes_feld_wird_nicht_still_geschluckt() -> None:
    """`extra="forbid"`: ein Tippfehler im Client faellt auf, statt Daten zu
    verlieren."""
    with pytest.raises(ValidationError):
        DashboardLayout.model_validate({"kacheln": [], "kachelnn": []})


def test_hoehere_schema_version_wird_abgewiesen() -> None:
    """Ein Layout aus einer neueren App-Version darf nicht halb uebernommen
    werden."""
    with pytest.raises(ValidationError):
        DashboardLayout.model_validate({"schema_version": 2, "kacheln": []})


# --- 3. Zusammenfuehrung: Benutzer → Rolle → Katalog -----------------------


def test_ohne_alles_kommt_der_katalog_standard() -> None:
    """Kein eigenes Layout, kein Rollen-Standard → `quelle="standard"` und
    `layout=None`. Der Server baut KEIN Ersatz-Layout (Wurzel 4) — der Katalog
    lebt im Frontend und waere hier ein zweiter Wahrheitsort."""
    ctx = AuthContext(user_id="u", tenant_id="t1", role="admin")
    antwort = _service().get(ctx)
    assert antwort.quelle == "standard"
    assert antwort.layout is None


def test_rollen_standard_greift_ohne_eigenes_layout() -> None:
    ctx = AuthContext(user_id="u", tenant_id="t1", role="admin")
    service = _service(
        {
            "dashboard_role_defaults": [
                {"tenant_id": "t1", "role": "admin", "layout": _LAYOUT}
            ]
        }
    )
    antwort = service.get(ctx)
    assert antwort.quelle == "rolle"
    assert antwort.layout is not None
    assert antwort.layout.kacheln[0].id == "kpi:checkins"


def test_eigenes_layout_schlaegt_den_rollen_standard() -> None:
    """Und der Rollen-Standard kommt trotzdem mit — die UI muss zeigen koennen,
    worauf „Zuruecksetzen" zurueckfaellt, ohne einen zweiten Aufruf."""
    eigen = {
        "schema_version": 1,
        "kacheln": [{"id": "objekt:gesamt", "x": 3, "y": 1, "groesse": "m"}],
        "ausgeblendet": ["kpi:revenue"],
    }
    ctx = AuthContext(user_id="u", tenant_id="t1", role="admin")
    service = _service(
        {
            "dashboard_layouts": [{"user_id": "u", "layout": eigen}],
            "dashboard_role_defaults": [
                {"tenant_id": "t1", "role": "admin", "layout": _LAYOUT}
            ],
        }
    )
    antwort = service.get(ctx)
    assert antwort.quelle == "benutzer"
    assert antwort.layout is not None
    assert antwort.layout.kacheln[0].id == "objekt:gesamt"
    assert antwort.rollen_standard is not None
    assert antwort.rollen_standard.kacheln[0].id == "kpi:checkins"


def test_fremdes_layout_wird_nicht_geliefert() -> None:
    """Wurzel 3: service_role umgeht RLS, der Scope kommt aus dem Service.
    Das Layout eines anderen Nutzers darf nicht durchschlagen."""
    ctx = AuthContext(user_id="ich", tenant_id="t1", role="admin")
    service = _service({"dashboard_layouts": [{"user_id": "jemand_anders", "layout": _LAYOUT}]})
    assert service.get(ctx).quelle == "standard"


def test_rollen_standard_eines_fremden_betriebs_wird_nicht_geliefert() -> None:
    """Derselbe Scope-Beweis fuer die tenant-gebundene Tabelle."""
    ctx = AuthContext(user_id="u", tenant_id="meiner", role="admin")
    service = _service(
        {
            "dashboard_role_defaults": [
                {"tenant_id": "fremder", "role": "admin", "layout": _LAYOUT}
            ]
        }
    )
    assert service.get(ctx).quelle == "standard"


def test_unlesbares_gespeichertes_layout_faellt_auf_die_naechste_quelle() -> None:
    """Eine entfernte Kachel-ID macht ein altes Layout ungueltig. Es wird
    VERWORFEN, nicht halb uebernommen — sonst stuende die Startseite mit einer
    zufaelligen Teilmenge da."""
    kaputt = {"kacheln": [{"id": "kpi:gibt_es_nicht_mehr", "x": 0, "y": 0, "groesse": "s"}]}
    ctx = AuthContext(user_id="u", tenant_id="t1", role="admin")
    service = _service(
        {
            "dashboard_layouts": [{"user_id": "u", "layout": kaputt}],
            "dashboard_role_defaults": [
                {"tenant_id": "t1", "role": "admin", "layout": _LAYOUT}
            ],
        }
    )
    antwort = service.get(ctx)
    assert antwort.quelle == "rolle"
    assert antwort.layout is not None
    assert antwort.layout.kacheln[0].id == "kpi:checkins"


def test_speichern_schreibt_auf_die_eigene_user_id() -> None:
    ctx = AuthContext(user_id="u", tenant_id="t1", role="cleaner")
    db = _DbDoppel()
    service = DashboardLayoutService(db=db)  # type: ignore[arg-type]
    service.speichern(ctx, DashboardLayout.model_validate(_LAYOUT))
    tabelle, daten = db.geschrieben[0]
    assert tabelle == "dashboard_layouts"
    assert daten["user_id"] == "u"


def test_zuruecksetzen_ist_idempotent() -> None:
    """Ohne gespeichertes Layout kein 404 — das Ziel „kein eigenes Layout" ist
    danach erreicht."""
    ctx = AuthContext(user_id="u", tenant_id="t1", role="admin")
    db = _DbDoppel()
    service = DashboardLayoutService(db=db)  # type: ignore[arg-type]
    antwort = service.zuruecksetzen(ctx)
    assert antwort.quelle == "standard"
    assert db.geloescht == ["dashboard_layouts"]


def test_rollen_standard_ohne_tenant_schlaegt_klar_fehl() -> None:
    """Ohne Betrieb ist der Schreibzugriff nicht scopebar. Lieber 422 als eine
    Zeile ohne Mandanten (Wurzel 3/4)."""
    ctx = AuthContext(user_id="u", tenant_id=None, role="admin")
    service = _service()
    with pytest.raises(DashboardLayoutError) as exc:
        service.rollen_standard_setzen(
            ctx, "admin", DashboardLayout.model_validate(_LAYOUT)
        )
    assert exc.value.status_code == 422
