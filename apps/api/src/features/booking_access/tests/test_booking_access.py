"""Tests der Buchungsberechtigungen (Airbnb „Voraussetzungen für Gäste").

Die teuerste Verwechslung an dieser Stelle wäre, eine nicht erfüllte
Voraussetzung als ABLEHNUNG zu behandeln. Airbnb tut das ausdrücklich nicht:
wer sie nicht erfüllt, kann weiterhin anfragen. Der Dienst gibt deshalb
`False` für „wird eine Anfrage" zurück, nie einen Fehler — und die Tests
prüfen beides: dass die Hürde greift UND dass sie niemanden aussperrt.
"""
from __future__ import annotations

import pytest

from src.features.booking_access.schemas import (
    Buchungsberechtigung,
    BuchungsberechtigungUpdate,
    Buchungsmodus,
    Zielgruppe,
)
from src.features.booking_access.service import (
    BookingAccessError,
    BookingAccessService,
)

from ._fake import FakeDB, ctx

GAST = "gast@example.com"
GESTERN = "2020-01-02"
MORGEN = "2999-01-02"


def _svc(**tabellen: list[dict]) -> tuple[BookingAccessService, FakeDB]:
    tabellen.setdefault("tenants", [])
    tabellen.setdefault("properties", [])
    tabellen.setdefault("portal_guests", [])
    tabellen.setdefault("guest_reviews_by_host", [])
    tabellen.setdefault("reservations", [])
    db = FakeDB(**tabellen)
    return BookingAccessService(db=db), db


def _erlaubt(svc: BookingAccessService, zielgruppe: str, email: str = GAST) -> bool:
    return svc.sofortbuchung_erlaubt(
        booking_mode="instant", zielgruppe=zielgruppe, email=email
    )


def _aufenthalt(email: str = GAST, *, status: str = "completed", bis: str = GESTERN) -> dict:
    return {"id": "r-1", "guest_email": email, "status": status, "check_out": bis}


def _betrieb(*, modus: str = "instant", ziel: str = "everyone") -> dict:
    return {"id": "t-1", "booking_mode": modus, "instant_booking_audience": ziel}


def _objekt(
    pid: str, *, tenant: str = "t-1", modus: str = "instant", ziel: str = "everyone"
) -> dict:
    return {
        "id": pid,
        "tenant_id": tenant,
        "booking_mode": modus,
        "instant_booking_audience": ziel,
    }


def _bewertung(email: str = GAST, *, rating: int, veroeffentlicht: bool = True) -> dict:
    return {
        "id": "gr-1",
        "guest_email": email,
        "rating": rating,
        "published_at": "2026-01-01T00:00:00+00:00" if veroeffentlicht else None,
    }


# --- Modus ------------------------------------------------------------------


def test_anfrage_modus_erlaubt_nie_sofort() -> None:
    svc, _ = _svc()
    assert (
        svc.sofortbuchung_erlaubt(
            booking_mode="request", zielgruppe="everyone", email=GAST
        )
        is False
    )


def test_alle_duerfen_sofort_ohne_jede_pruefung() -> None:
    """Bei „alle" darf nichts über den Gast nachgeschlagen werden."""
    svc, db = _svc()
    assert _erlaubt(svc, "everyone") is True
    # Kein Gast, keine Buchung, keine Bewertung in der Fake-DB — hätte der
    # Dienst nachgesehen, wäre das Ergebnis False gewesen.
    assert db.tables["portal_guests"] == []


def test_unbekannte_zielgruppe_ist_fail_closed() -> None:
    """Ein importierter Wert, den wir nicht kennen, darf nicht als „alle
    dürfen" durchgehen (Wurzel 5)."""
    svc, _ = _svc()
    assert _erlaubt(svc, "nur_vip_gaeste") is False
    assert _erlaubt(svc, None) is False  # type: ignore[arg-type]


# --- Geprüfte Identität -----------------------------------------------------


@pytest.mark.parametrize(
    ("stand", "erwartet"),
    [
        ("verified", True),
        ("processing", False),
        ("requires_input", False),
        ("unverified", False),
    ],
)
def test_identitaet_gilt_nur_als_geprueft_wenn_sie_es_ist(
    stand: str, erwartet: bool
) -> None:
    """„In Prüfung" ist nicht geprüft."""
    svc, _ = _svc(
        portal_guests=[{"id": "g-1", "email": GAST, "identity_status": stand}]
    )
    assert _erlaubt(svc, "guests_with_verified_identity") is erwartet


def test_ohne_konto_keine_gepruefte_identitaet() -> None:
    """Der Normalfall der Buchungsstrecke ohne Anmeldung — kein Sonderfall."""
    svc, _ = _svc()
    assert _erlaubt(svc, "guests_with_verified_identity") is False


def test_identitaet_trifft_nicht_die_falsche_adresse() -> None:
    """`_` ist ein ILIKE-Platzhalter.

    Ohne `escape_like` fände die Suche nach `max_muster@example.com` das Konto
    von `maxamuster@example.com` — ein fremder Prüfstand ginge als eigener
    durch und der Gast käme an der Hürde des Gastgebers vorbei (Wurzel 8).
    """
    svc, _ = _svc(
        portal_guests=[
            {"id": "g-1", "email": "maxamuster@example.com", "identity_status": "verified"}
        ]
    )
    assert (
        _erlaubt(svc, "guests_with_verified_identity", "max_muster@example.com")
        is False
    )


# --- Gute Vorgeschichte -----------------------------------------------------


def test_abgeschlossener_aufenthalt_ohne_negative_bewertung() -> None:
    svc, _ = _svc(reservations=[_aufenthalt()])
    assert _erlaubt(svc, "well_reviewed_guests") is True


def test_ohne_jede_historie_keine_gute_vorgeschichte() -> None:
    """Ein unbekannter Gast ist nicht „gut bewertet", er ist unbekannt."""
    svc, _ = _svc()
    assert _erlaubt(svc, "well_reviewed_guests") is False


@pytest.mark.parametrize(("rating", "erwartet"), [(1, False), (2, False), (3, True), (5, True)])
def test_negative_bewertung_schliesst_aus(rating: int, erwartet: bool) -> None:
    """3 von 5 ist keine Beschwerde und darf niemanden aussperren."""
    svc, _ = _svc(
        reservations=[_aufenthalt()],
        guest_reviews_by_host=[_bewertung(rating=rating)],
    )
    assert _erlaubt(svc, "well_reviewed_guests") is erwartet


def test_unveroeffentlichte_bewertung_zaehlt_nicht() -> None:
    """Ein Entwurf ist noch keine Aussage über den Gast."""
    svc, _ = _svc(
        reservations=[_aufenthalt()],
        guest_reviews_by_host=[_bewertung(rating=1, veroeffentlicht=False)],
    )
    assert _erlaubt(svc, "well_reviewed_guests") is True


def test_kuenftiger_aufenthalt_ist_kein_abgeschlossener() -> None:
    svc, _ = _svc(reservations=[_aufenthalt(bis=MORGEN)])
    assert _erlaubt(svc, "well_reviewed_guests") is False


@pytest.mark.parametrize("status", ["cancelled", "declined", "expired", "requested", "pending"])
def test_nicht_stattgefundene_buchung_zaehlt_nicht(status: str) -> None:
    """Sonst genügte eine stornierte Buchung als Vorgeschichte."""
    svc, _ = _svc(reservations=[_aufenthalt(status=status)])
    assert _erlaubt(svc, "well_reviewed_guests") is False


def test_bewertung_trifft_nicht_die_falsche_adresse() -> None:
    """Dieselbe ILIKE-Falle auf der Bewertungsseite — hier andersherum
    gefährlich: eine FREMDE schlechte Bewertung würde den Gast aussperren."""
    svc, _ = _svc(
        reservations=[_aufenthalt("max_muster@example.com")],
        guest_reviews_by_host=[_bewertung("maxamuster@example.com", rating=1)],
    )
    assert _erlaubt(svc, "well_reviewed_guests", "max_muster@example.com") is True


# --- Beides zusammen --------------------------------------------------------


def test_beides_verlangt_auch_beides() -> None:
    svc, _ = _svc(reservations=[_aufenthalt()])
    # Vorgeschichte gut, Identität fehlt.
    assert _erlaubt(svc, "well_reviewed_guests_with_verified_identity") is False

    svc, _ = _svc(
        reservations=[_aufenthalt()],
        portal_guests=[{"id": "g-1", "email": GAST, "identity_status": "verified"}],
    )
    assert _erlaubt(svc, "well_reviewed_guests_with_verified_identity") is True


def test_identitaet_allein_genuegt_nicht_wenn_vorgeschichte_verlangt_ist() -> None:
    svc, _ = _svc(
        portal_guests=[{"id": "g-1", "email": GAST, "identity_status": "verified"}]
    )
    assert _erlaubt(svc, "well_reviewed_guests_with_verified_identity") is False


# --- Entscheidung des Betriebs ----------------------------------------------


def test_setzen_schreibt_betrieb_und_objekte() -> None:
    """Nur eines von beidem wäre halb: der Betriebswert ist die Vorlage für
    neue Objekte, die Objektspalte gilt für die einzelne Buchung (Wurzel 1)."""
    svc, db = _svc(
        tenants=[_betrieb()],
        properties=[
            _objekt("p-1"),
            _objekt("p-2"),
            _objekt("p-fremd", tenant="t-2"),
        ],
    )
    ergebnis = svc.setzen(
        ctx(),
        BuchungsberechtigungUpdate(
            modus=Buchungsmodus.instant, zielgruppe=Zielgruppe.well_reviewed_guests
        ),
    )
    assert db.schreibzugriffe == ["tenants", "properties"]
    assert db.tables["tenants"][0]["instant_booking_audience"] == "well_reviewed_guests"
    assert all(
        p["instant_booking_audience"] == "well_reviewed_guests"
        for p in db.tables["properties"]
        if p["tenant_id"] == "t-1"
    )
    # Der fremde Betrieb bleibt unberührt (Wurzel 3).
    assert db.tables["properties"][2]["instant_booking_audience"] == "everyone"
    assert ergebnis.objekte_gesamt == 2
    assert ergebnis.objekte_abweichend == 0


def test_abweichende_objekte_werden_gemeldet() -> None:
    """Ein im Assistenten anders eingestelltes Objekt darf nicht unsichtbar
    bleiben — sonst zeigt die Seite eine Entscheidung, die nicht überall gilt."""
    svc, _ = _svc(
        tenants=[_betrieb()],
        properties=[
            _objekt("p-1"),
            _objekt("p-2", modus="request"),
        ],
    )
    stand = svc.einstellung(ctx())
    assert isinstance(stand, Buchungsberechtigung)
    assert stand.objekte_gesamt == 2
    assert stand.objekte_abweichend == 1


def test_zielgruppe_zaehlt_nicht_als_abweichung_bei_anfrage() -> None:
    """Bei „Anfrage" ist die Zielgruppe bedeutungslos. Sie dort als Abweichung
    zu melden, wäre eine Falschmeldung."""
    svc, _ = _svc(
        tenants=[_betrieb(modus="request")],
        properties=[
            _objekt("p-1", modus="request", ziel="well_reviewed_guests"),
        ],
    )
    assert svc.einstellung(ctx()).objekte_abweichend == 0


def test_ohne_betrieb_kein_zugriff() -> None:
    svc, _ = _svc()
    with pytest.raises(BookingAccessError) as exc:
        svc.einstellung(ctx(tenant_id=None))
    assert exc.value.status_code == 403


def test_unbekannter_betrieb_ist_404() -> None:
    svc, _ = _svc()
    with pytest.raises(BookingAccessError) as exc:
        svc.einstellung(ctx())
    assert exc.value.status_code == 404
