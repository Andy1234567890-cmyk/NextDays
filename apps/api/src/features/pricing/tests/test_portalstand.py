"""Portalstand: Soll = dieselbe Rechnung wie der Push.

Live am 05.09.2026: Aktion „Winterrabatt −20 %" auf 111 Tage. Der Push senkte
korrekt auf 80 %, der Portalstand verglich den Listenpreis und meldete 111
Abweichungen — der Abgleich konnte nie „abschließen".
"""
from datetime import date
from types import SimpleNamespace

from src.core.security import AuthContext
from src.features.pricing import portalstand as ps


class _Q:
    def __init__(self, rows: list[dict]) -> None:
        self._rows = rows

    def __getattr__(self, _name: str):  # noqa: ANN204 — jede Filtermethode kettet
        return lambda *_a, **_k: self

    def execute(self) -> SimpleNamespace:
        return SimpleNamespace(data=self._rows)


class _DB:
    def __init__(self, tables: dict[str, list[dict]]) -> None:
        self.tables = tables

    def table(self, name: str) -> _Q:
        return _Q(self.tables.get(name, []))


def _ctx() -> AuthContext:
    return AuthContext(
        user_id="u1", tenant_id="t1", role="admin", email=None, permissions=[]
    )


def _stand(monkeypatch, *, faktoren: dict[str, float], gesperrt: set[str]) -> ps.Portalstand:  # noqa: ANN001
    db = _DB(
        {
            "properties": [{"id": "p1", "tenant_id": "t1"}],
            "dp_settings": [{"rate_plan_id": "rp1"}],
            "rate_plans": [{"id": "rp1", "currency": "DKK"}],
            "channex_ari_shadow": [
                {"date": "2026-10-23", "rate_cents": 74053, "updated_at": "2026-09-05T07:00:00Z"},
                {"date": "2026-10-24", "rate_cents": 59106, "updated_at": "2026-09-05T07:00:00Z"},
                {"date": "2026-10-25", "rate_cents": 50000, "updated_at": "2026-09-05T07:00:00Z"},
            ],
        }
    )

    class _Resolver:
        def __init__(self, **_k: object) -> None: ...

        def effective_prices(self, *_a: object, **_k: object) -> list:
            return [
                SimpleNamespace(date=date(2026, 10, 23), price=740.53),
                SimpleNamespace(date=date(2026, 10, 24), price=738.82),
                SimpleNamespace(date=date(2026, 10, 25), price=643.94),
            ]

    monkeypatch.setattr(ps, "PricingResolver", _Resolver)
    monkeypatch.setattr(ps, "aktionsfaktor_je_tag", lambda *_a, **_k: faktoren)
    monkeypatch.setattr(ps, "gesperrte_tage", lambda *_a, **_k: gesperrt)
    monkeypatch.setattr(ps, "is_owner", lambda _c: False)
    monkeypatch.setattr(ps, "fetch_all_rows", lambda q: q.execute().data)
    return ps.PortalstandService(service_client=db).stand(  # type: ignore[arg-type]
        _ctx(), "p1", date(2026, 10, 23), date(2026, 10, 25)
    )


def test_aktionstag_ist_keine_abweichung(monkeypatch) -> None:  # noqa: ANN001
    stand = _stand(monkeypatch, faktoren={"2026-10-24": 0.8, "2026-10-25": 0.8}, gesperrt=set())
    je_tag = {t.date.isoformat(): t for t in stand.tage}
    # 738,82 × 0,8 = 591,06 — steht so im Schatten: kein Drift.
    assert je_tag["2026-10-24"].berechnet == 591.06
    assert je_tag["2026-10-24"].aktion_pct == -20.0
    assert je_tag["2026-10-24"].abweichung_pct == 0.0
    # 643,94 × 0,8 = 515,15, im Schatten 500: echter Drift.
    assert je_tag["2026-10-25"].berechnet == 515.15
    assert je_tag["2026-10-23"].aktion_pct is None
    assert stand.abweichend == 1


def test_freigabe_wartende_tage_zaehlen_nicht(monkeypatch) -> None:  # noqa: ANN001
    stand = _stand(monkeypatch, faktoren={}, gesperrt={"2026-10-25"})
    je_tag = {t.date.isoformat(): t for t in stand.tage}
    assert je_tag["2026-10-25"].berechnet is None
    assert je_tag["2026-10-25"].abweichung_pct is None
    # 24.10.: 738,82 gegen 591,06 ohne Aktion = echte Abweichung.
    assert stand.abweichend == 1
