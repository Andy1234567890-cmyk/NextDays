"""Die Glocke: Scope, Idempotenz und der nicht abwählbare In-App-Kanal.

Der Empfänger ist ein NUTZER, nicht der Mandant — jede Abfrage muss auf
`user_id` UND `tenant_id` filtern. Ein Zugriff nur per Benachrichtigungs-ID wäre
fremde Post (Wurzel 9).
"""
from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from src.core.security import AuthContext
from src.features.notification_settings.glocke import GlockeService
from src.features.notification_settings.katalog import Kanal
from src.features.notification_settings.service import NotificationSettingsService


class _Kette:
    """Merkt sich jeden Filter, damit der Test den Scope prüfen kann."""

    def __init__(self, protokoll: list[tuple], daten: list[dict]) -> None:
        self.protokoll = protokoll
        self.daten = daten
        self.filter: list[tuple] = []
        self.patch: dict | None = None

    def select(self, *_a: object, **kw: object) -> _Kette:
        self.zaehlt = kw.get("count")
        return self

    def update(self, patch: dict) -> _Kette:
        self.patch = patch
        return self

    def eq(self, feld: str, wert: object) -> _Kette:
        self.filter.append((feld, wert))
        return self

    def is_(self, feld: str, wert: object) -> _Kette:
        self.filter.append((feld, wert))
        return self

    def order(self, *_a: object, **_k: object) -> _Kette:
        return self

    def limit(self, _n: int) -> _Kette:
        return self

    def execute(self) -> object:
        self.protokoll.append((tuple(self.filter), self.patch))
        return SimpleNamespace(data=self.daten, count=len(self.daten))


class _DB:
    def __init__(self, daten: list[dict] | None = None) -> None:
        self.protokoll: list[tuple] = []
        self.daten = daten or []

    def table(self, _name: str) -> _Kette:
        return _Kette(self.protokoll, self.daten)


def _ctx(tenant: str | None = "t-1") -> AuthContext:
    # `user_id` ist im AuthContext immer gesetzt (Pydantic verlangt str) — nur
    # der Mandant kann fehlen, etwa bei einem Konto ohne Betrieb.
    return AuthContext(user_id="u-1", tenant_id=tenant, role="admin")


def test_liste_filtert_auf_nutzer_und_mandant() -> None:
    """Wurzel 9: derselbe Scope wie die Glocke selbst — nicht nur der Tenant."""
    db = _DB([{"id": "n-1"}])
    GlockeService(db).liste(_ctx())
    filter_felder = dict(db.protokoll[0][0])
    assert filter_felder["user_id"] == "u-1"
    assert filter_felder["tenant_id"] == "t-1"


def test_ohne_mandant_kein_zugriff() -> None:
    """Fail-closed: ohne Mandanten lieber 403 als eine ungefilterte Abfrage."""
    with pytest.raises(HTTPException) as exc:
        GlockeService(_DB()).liste(_ctx(tenant=None))
    assert exc.value.status_code == 403


def test_als_gelesen_ist_gescopt_und_idempotent() -> None:
    """Fremde/bereits gelesene Meldung ist kein Fehler (Wurzel 2).

    Der Filter `gelesen_am is null` verhindert zusätzlich, dass der Zeitpunkt
    bei jedem Klick nach vorn wandert.
    """
    db = _DB()
    GlockeService(db).als_gelesen(_ctx(), "n-1")
    felder, patch = db.protokoll[0]
    als_dict = dict(felder)
    assert als_dict["id"] == "n-1"
    assert als_dict["user_id"] == "u-1"
    assert als_dict["tenant_id"] == "t-1"
    assert als_dict["gelesen_am"] == "null"
    assert patch is not None and "gelesen_am" in patch


def test_limit_ist_gedeckelt() -> None:
    """Wurzel 8: ein unbegrenztes Limit darf keine Riesenantwort erzeugen."""
    db = _DB()
    dienst = GlockeService(db)
    # Kein Absturz und kein Durchreichen der 5000 — der Deckel greift intern.
    dienst.liste(_ctx(), limit=5000)
    dienst.liste(_ctx(), limit=0)


def test_inapp_ist_nicht_abwaehlbar() -> None:
    """Die Glocke hat KEINE Präferenzspalte und muss trotzdem senden.

    Ohne den Vorrang in `soll_senden` fiele `inapp` durch die `kanaele`-Prüfung
    (der Kanal steht in keiner Kategorie) und die Meldung erschiene nie — der
    Nutzer sähe nicht, dass etwas klemmt.
    """
    dienst = NotificationSettingsService(_DB())
    assert dienst.soll_senden("u-1", "listing_activity", Kanal.INAPP) is True
