"""Ein LEERES Objekt darf nicht veroeffentlicht werden.

ANLASS (29.08.2026): Das Airbnb-Geruest „Airbnb-Uebernahme laeuft" — ein
Entwurf ohne Foto, ohne Beschreibung, ohne Adresse — liess sich im Dialog
„Objekt veroeffentlichen" bestaetigen und stand danach zur Freigabe auf dem
eigenen Marktplatz an.

URSACHE: `publish()` prueft nur, ob ein Preisplan existiert. Alles andere, was
ein Gast zum Buchen braucht, war ungeprueft.

Diese Tests halten fest, WAS mindestens da sein muss — und dass der Fehler die
fehlenden Felder BEIM NAMEN nennt statt pauschal abzulehnen.
"""
from __future__ import annotations

import contextlib

import pytest

from src.features.properties.service import PropertiesService, PropertyError
from src.features.properties.tests.test_properties import (
    _BILLING_READY,
    _ctx,
    _PublishDB,
    _row,
)

# Ein Objekt, das ALLE Bedingungen erfuellt. Die Tests nehmen davon jeweils
# eine weg — so steht in jedem Test genau die eine gepruefte Bedingung.
_FERTIG = {
    "title": "Feriehus Kornblomst",
    "description": "Ruhiges Haus am Waldrand.",
    "photos": [{"id": "f1", "url": "https://example.test/1.jpg"}],
    "street": "Tolstrupvej",
    "city": "Hjoerring",
    "max_guests": 4,
}


def _svc(**ohne: object) -> PropertiesService:
    """Dienst mit einem fertigen Objekt, bei dem `ohne` ueberschrieben wird."""
    return PropertiesService(
        service_client=_PublishDB({
            "properties": [_row(**{**_FERTIG, **ohne})],
            "rate_plans": [{"id": "r-1", "currency": "DKK", "min_stay": 1}],
            "tenant_billing_profile": _BILLING_READY,
            # Das Abo-Gate greift VOR der Vollstaendigkeit — ohne diese Zeile
            # scheitert jeder Test schon dort und prueft nichts.
            "tenant_subscription": [
                {"status": "active", "reported_property_count": 10}
            ],
        })
    )


@pytest.mark.parametrize(
    ("feld", "wert", "erwartet"),
    [
        ("description", None, "Beschreibung"),
        ("description", "   ", "Beschreibung"),
        ("photos", [], "Foto"),
        ("max_guests", None, "Gaeste"),
        ("max_guests", 0, "Gaeste"),
        ("title", "  ", "Name"),
    ],
)
def test_fehlendes_feld_verhindert_veroeffentlichen(
    feld: str, wert: object, erwartet: str
) -> None:
    """Fehlt eine Angabe, ist es 422 — und die Meldung NENNT sie."""
    with pytest.raises(PropertyError) as exc:
        _svc(**{feld: wert}).publish(_ctx(), "p-1")
    assert exc.value.status_code == 422
    assert erwartet in exc.value.message, (
        f"Die Meldung nennt '{erwartet}' nicht: {exc.value.message}"
    )


def test_fehlende_adresse_verhindert_veroeffentlichen() -> None:
    """Ohne Strasse UND Ort geht es nicht — ein Gast muss hinfinden."""
    with pytest.raises(PropertyError) as exc:
        _svc(street=None, city=None, address=None).publish(_ctx(), "p-1")
    assert exc.value.status_code == 422
    assert "Adresse" in exc.value.message


def test_altes_adressfeld_genuegt() -> None:
    """`address` ist das Altfeld — ein Bestandsobjekt darf nicht scheitern.

    Geprueft wird nur, dass die VOLLSTAENDIGKEIT nicht meckert. Ob der Aufruf
    danach durchlaeuft, haengt am Channex-Sync und gehoert nicht hierher.
    """
    dienst = _svc(street=None, city=None, address="Tolstrupvej 18B")
    with contextlib.suppress(Exception):
        # Was NACH der Vollstaendigkeitspruefung passiert (Channex-Sync), ist
        # hier egal — geprueft wird nur, dass die Adresse nicht bemaengelt wird.
        dienst.publish(_ctx(), "p-1")
        return
    try:
        dienst.publish(_ctx(), "p-1")
    except PropertyError as exc:
        assert "Adresse" not in exc.message, (
            "Das Altfeld `address` wird nicht anerkannt — Bestandsobjekte "
            "koennten nicht mehr veroeffentlicht werden."
        )
    except Exception as exc:  # noqa: BLE001 - kein Vollstaendigkeitsfehler
        assert "Adresse" not in str(exc)


def test_alle_fehlenden_felder_stehen_in_EINER_meldung() -> None:
    """Nicht eins nach dem anderen: der Kunde soll alles auf einmal sehen."""
    with pytest.raises(PropertyError) as exc:
        _svc(
            description=None, photos=[], max_guests=None,
            street=None, city=None, address=None,
        ).publish(_ctx(), "p-1")
    meldung = exc.value.message
    for erwartet in ("Beschreibung", "Foto", "Adresse", "Gaeste"):
        assert erwartet in meldung, f"'{erwartet}' fehlt in: {meldung}"


def test_geruest_objekt_wird_abgelehnt() -> None:
    """Der Live-Fall: das Airbnb-Geruest, so wie es in der DB stand."""
    with pytest.raises(PropertyError) as exc:
        PropertiesService(
            service_client=_PublishDB({
                "properties": [_row(
                    title="Airbnb-Übernahme läuft",
                    status="draft",
                    description=None,
                    photos=[],
                    max_guests=None,
                )],
                "rate_plans": [{"id": "r-1", "currency": "DKK", "min_stay": 1}],
                "tenant_billing_profile": _BILLING_READY,
                "tenant_subscription": [
                    {"status": "active", "reported_property_count": 10}
                ],
            })
        ).publish(_ctx(), "p-1")
    assert exc.value.status_code == 422
