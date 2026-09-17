"""Ausweisdokument an den verbundenen Account uebergeben.

Der Weg, den Stripe in seiner eigenen Ablehnung nennt („provide additional
documentation to verify") und den es in der Oberflaeche bis zum 17.09.2026
nicht gab. Geprueft wird, was hier teuer waere, wenn es falsch ist:

  * Die Datei geht ins VERBUNDENE Konto (Stripe-Account-Header), nicht in die
    Dateiliste der Plattform. Ein Ausweis gehoert dem Gastgeber.
  * Zwei Schritte in der richtigen Reihenfolge: hochladen, dann die Kennung am
    Konto eintragen.
  * Typ und Groesse scheitern an UNSERER Grenze, mit einem Satz, der sagt was
    erlaubt ist — nicht als roher Stripe-Fehler nach dem Hochladen (Wurzel 8).
  * Der Mandanten-Guard sitzt VOR dem Hochladen: ein fremdes Konto darf nicht
    einmal eine Datei bekommen (Wurzel 3).
"""

import pytest

from src.features.payments import stripe_client as sc
from src.features.payments.service import PaymentsError, PaymentsService

from .test_payments import _connect_db

ACCT = "acct_eigen"
BILD = b"\x89PNG\r\n\x1a\n" + b"0" * 64


class _Aufzeichnend:
    """Faelscht Datei-Upload und Konto-Update und haelt die Reihenfolge fest."""

    def __init__(self) -> None:
        self.schritte: list[tuple[str, dict]] = []
        selbst = self

        class _Files:
            def create(self, params: dict, options: dict | None = None) -> object:
                selbst.schritte.append(
                    ("upload", {"params": params, "options": options or {}})
                )
                return type("_Datei", (), {"id": "file_123"})()

        class _Accounts:
            def update(self, acct: str, params: dict) -> object:
                selbst.schritte.append(("update", {"acct": acct, "params": params}))
                return None

            def retrieve(self, _acct: str) -> object:
                anforderungen = type(
                    "_R",
                    (),
                    {
                        "currently_due": [],
                        "past_due": [],
                        "eventually_due": [],
                        "pending_verification": ["individual.verification.document"],
                        "errors": [],
                        "current_deadline": None,
                        "disabled_reason": None,
                    },
                )()
                return type(
                    "_A",
                    (),
                    {
                        "id": ACCT,
                        "charges_enabled": False,
                        "payouts_enabled": False,
                        "details_submitted": True,
                        "requirements": anforderungen,
                    },
                )()

        self.v1 = type(
            "_V1", (), {"files": _Files(), "accounts": _Accounts()}
        )()


def _dienst(stripe: _Aufzeichnend, *, konto: str = ACCT) -> PaymentsService:
    return PaymentsService(service_client=_connect_db(konto), stripe=stripe)  # type: ignore[arg-type]


def test_datei_geht_ins_verbundene_konto() -> None:
    stripe = _Aufzeichnend()
    _dienst(stripe).set_identity_document(
        "t-1", ACCT, content=BILD, content_type="image/png"
    )
    weg, upload = stripe.schritte[0]
    assert weg == "upload"
    assert upload["params"]["purpose"] == "identity_document"
    # Der Header ist der Kern: ohne ihn liegt der Ausweis bei der Plattform.
    assert upload["options"]["stripe_account"] == ACCT


def test_reihenfolge_hochladen_dann_anhaengen() -> None:
    stripe = _Aufzeichnend()
    _dienst(stripe).set_identity_document(
        "t-1", ACCT, content=BILD, content_type="image/jpeg"
    )
    assert [w for w, _ in stripe.schritte][:2] == ["upload", "update"]
    _weg, update = stripe.schritte[1]
    assert update["acct"] == ACCT
    assert update["params"] == {
        "individual": {"verification": {"document": {"front": "file_123"}}}
    }


def test_rueckseite_landet_auf_back() -> None:
    stripe = _Aufzeichnend()
    _dienst(stripe).set_identity_document(
        "t-1", ACCT, content=BILD, content_type="image/png", rueckseite=True
    )
    _weg, update = stripe.schritte[1]
    assert update["params"]["individual"]["verification"]["document"] == {
        "back": "file_123"
    }


@pytest.mark.parametrize(
    "typ", ["application/pdf", "image/webp", "text/plain", "application/octet-stream"]
)
def test_falscher_dateityp_scheitert_vor_dem_hochladen(typ: str) -> None:
    """Stripe nimmt fuer AUSWEISE nur JPG und PNG — PDF gilt nur fuer Adress-
    und Firmennachweise. Die Grenze gehoert vor den Upload."""
    stripe = _Aufzeichnend()
    with pytest.raises(PaymentsError) as fehler:
        _dienst(stripe).set_identity_document(
            "t-1", ACCT, content=BILD, content_type=typ
        )
    assert fehler.value.status_code == 422
    assert "JPG" in fehler.value.message
    assert stripe.schritte == []


def test_zu_grosse_datei_scheitert_vor_dem_hochladen() -> None:
    stripe = _Aufzeichnend()
    with pytest.raises(PaymentsError) as fehler:
        _dienst(stripe).set_identity_document(
            "t-1",
            ACCT,
            content=b"0" * (sc.AUSWEIS_MAX_BYTES + 1),
            content_type="image/png",
        )
    assert fehler.value.status_code == 422
    assert stripe.schritte == []


def test_leere_datei_scheitert() -> None:
    stripe = _Aufzeichnend()
    with pytest.raises(PaymentsError):
        _dienst(stripe).set_identity_document(
            "t-1", ACCT, content=b"", content_type="image/png"
        )
    assert stripe.schritte == []


def test_fremdes_konto_bekommt_keine_datei() -> None:
    """Wurzel 3: der Guard sitzt VOR dem Hochladen. Ein Ausweis darf nicht
    einmal versuchsweise in einem fremden Konto landen."""
    stripe = _Aufzeichnend()
    dienst = _dienst(stripe, konto="acct_eigen")
    with pytest.raises(PaymentsError):
        dienst.set_identity_document(
            "t-1", "acct_fremd", content=BILD, content_type="image/png"
        )
    assert stripe.schritte == []


def test_mime_mit_parameter_wird_erkannt() -> None:
    """Browser senden gern `image/png; charset=binary` — das ist PNG."""
    stripe = _Aufzeichnend()
    _dienst(stripe).set_identity_document(
        "t-1", ACCT, content=BILD, content_type="image/png; charset=binary"
    )
    assert stripe.schritte[0][0] == "upload"
