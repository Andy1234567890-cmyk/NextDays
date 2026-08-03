"""Tests für den property_discounts-Slice (Promotions).

Geprüft wird, was ohne Live-DB prüfbar ist und fachlich weh tut: die Schemas
(Bedingungen, Codes, Pflichtangaben) und die Auswahlliste („bestehende Promotion
hinzufügen") mit ihren zwei Filtern.
"""
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from src.features.property_discounts.schemas import DiscountCreate
from src.features.property_discounts.service import (
    PropertyDiscountsService,
    _aktion_signatur,
)
from src.main import create_app

client = TestClient(create_app())


def test_property_discounts_health() -> None:
    resp = client.get("/api/v1/pricing/discounts/health")
    assert resp.status_code == 200
    assert resp.json() == {"slice": "property_discounts", "status": "ok"}


def test_prozent_aktion_braucht_einen_satz() -> None:
    """`discount_bps` hat einen Default (die Spalte ist NOT NULL und wird bei
    einer Pauschale nicht gelesen). Bei PROZENT wäre dieser Default 0,01 % — ein
    stiller Fantasiewert (Wurzel 4), deshalb Pflicht."""
    with pytest.raises(ValidationError):
        DiscountCreate(discount_type="promotion", discount_kind="percent")
    ok = DiscountCreate(
        discount_type="promotion", discount_kind="percent", discount_bps=2000
    )
    assert ok.discount_bps == 2000


def test_pauschale_braucht_einen_betrag_und_keinen_satz() -> None:
    with pytest.raises(ValidationError):
        DiscountCreate(discount_type="promotion", discount_kind="fixed")
    with pytest.raises(ValidationError):
        DiscountCreate(
            discount_type="promotion",
            discount_kind="percent",
            discount_bps=1000,
            discount_amount=50,
        )
    ok = DiscountCreate(
        discount_type="promotion", discount_kind="fixed", discount_amount=50
    )
    assert ok.discount_amount == 50


def test_angebotscodes_werden_normalisiert() -> None:
    """Der Gast tippt „sommer26", der Betrieb legte „SOMMER26" an — ohne
    Normalisierung greift die Aktion nicht und niemand findet den Grund."""
    d = DiscountCreate(
        discount_type="promotion",
        discount_kind="percent",
        discount_bps=1000,
        promo_codes=[" sommer26 ", "SOMMER26", "winter26", ""],
    )
    assert d.promo_codes == ["SOMMER26", "WINTER26"]
    with pytest.raises(ValidationError):
        DiscountCreate(
            discount_type="promotion",
            discount_kind="percent",
            discount_bps=1000,
            promo_codes=["VIEL-ZU-LANGER-CODE"],
        )


def test_kurven_typen_verlangen_ihre_achse() -> None:
    """Ein Längenrabatt ohne Nächtegrenze wäre ein Rabatt auf alles."""
    for typ, feld in (
        ("length_of_stay", "min_nights"),
        ("early_booker", "lead_min_days"),
        ("last_minute", "lead_max_days"),
    ):
        with pytest.raises(ValidationError):
            DiscountCreate(discount_type=typ, discount_kind="percent", discount_bps=500)
        assert DiscountCreate(
            discount_type=typ,
            discount_kind="percent",
            discount_bps=500,
            **{feld: 7},
        ).discount_type == typ


def test_days_before_wird_nach_typ_auf_die_achse_gehoben() -> None:
    """Altform der Bestandsclients (`gastgeber`): nach Typ auf lead_min/lead_max,
    NICHT als zweite Speicherung."""
    frueh = DiscountCreate(
        discount_type="early_booker", discount_kind="percent",
        discount_bps=500, days_before=60,
    )
    assert frueh.lead_min_days == 60 and frueh.lead_max_days is None
    last = DiscountCreate(
        discount_type="last_minute", discount_kind="percent",
        discount_bps=500, days_before=7,
    )
    assert last.lead_max_days == 7 and last.lead_min_days is None


class _Q:
    def __init__(self, data: list[dict]) -> None:
        self._data = data

    def select(self, *_a: object, **_k: object) -> "_Q":
        return self

    def eq(self, *_a: object, **_k: object) -> "_Q":
        return self

    def order(self, *_a: object, **_k: object) -> "_Q":
        return self

    def limit(self, *_a: object, **_k: object) -> "_Q":
        return self

    def execute(self) -> object:
        return type("R", (), {"data": self._data})()


class _DB:
    def __init__(self, tables: dict[str, list[dict]]) -> None:
        self._tables = tables

    def table(self, name: str) -> _Q:
        return _Q(self._tables.get(name, []))


def _aktion(**kw: object) -> dict:
    basis = {
        "id": "a", "property_id": "p2", "discount_type": "promotion",
        "discount_kind": "percent", "discount_bps": 2000, "discount_amount": None,
        "active": True, "min_nights": None, "lead_min_days": None,
        "lead_max_days": None, "stay_ranges": [], "booked_from": None,
        "booked_to": None, "promo_codes": [], "portal_scope": [],
        "name": {"de": "Sommer"}, "description_html": None, "photo_url": None,
    }
    basis.update(kw)
    return basis


def test_library_dedupliziert_und_filtert_pauschalen_ohne_waehrung() -> None:
    """Dieselbe Aktion auf zehn Objekten erscheint EINMAL. Eine Pauschale kommt
    nur aus Objekten derselben Objektwährung — „200" von einem DKK- auf ein
    EUR-Objekt wäre eine stille Preisänderung um den Faktor 7,5."""
    from src.core.security import AuthContext

    db = _DB({
        "properties": [
            {"id": "p1", "title": "Ziel", "currency": "EUR"},
            {"id": "p2", "title": "Quelle EUR", "currency": "EUR"},
            {"id": "p3", "title": "Quelle DKK", "currency": "DKK"},
        ],
        "property_discounts": [
            # Zweimal fachlich dieselbe Aktion (p2 und p3) → EIN Eintrag.
            _aktion(id="a1", property_id="p2"),
            _aktion(id="a2", property_id="p3"),
            # Pauschale aus dem DKK-Objekt → fällt raus (Zielwährung EUR).
            _aktion(id="a3", property_id="p3", discount_kind="fixed",
                    discount_amount=200, name={"de": "200 kr"}),
            # Pauschale aus dem EUR-Objekt → bleibt.
            _aktion(id="a4", property_id="p2", discount_kind="fixed",
                    discount_amount=50, name={"de": "50 €"}),
        ],
    })
    svc = PropertyDiscountsService(service_client=db)
    # `load_scoped` liest über dieselbe Stub-Tabelle; p1 ist die erste Zeile.
    res = svc.library(AuthContext(user_id="u", tenant_id="t", role="admin"), "p1")
    assert res["currency"] == "EUR"
    namen = [e["promotion"].name.get("de") for e in res["items"]]
    assert namen == ["Sommer", "50 €"]


def test_signatur_unterscheidet_wirkende_felder_und_ignoriert_kennungen() -> None:
    a = _aktion(id="x", property_id="p2")
    b = _aktion(id="y", property_id="p9")
    assert _aktion_signatur(a) == _aktion_signatur(b)
    assert _aktion_signatur(a) != _aktion_signatur(_aktion(discount_bps=1000))
