"""``requirements.errors`` von Stripe lesen, ohne den Request zu sprengen.

Live gefunden am 16.09.2026 beim Anlegen eines Gastgeber-Kontos: der Sync
antwortete mit einem rohen 500, `AttributeError: get`. Ursache ist eine
Eigenheit des SDK, die man der Zeile nicht ansieht — `StripeObject` ist seit
stripe-python 12 KEINE dict-Unterklasse mehr. Es hat kein `.get`, und sein
`__getattr__` macht aus dem unbekannten Namen einen `AttributeError`.

Warum es so lange gut ging: `requirements.errors` ist fast immer leer. Die
Schleife lief dann ueber nichts, und die Stelle sah gesund aus. Kaputt war sie
genau dann, wenn Stripe etwas zu BEANSTANDEN hat — also in dem Moment, in dem
der Gastgeber die Meldung am dringendsten braucht.

Geprueft werden deshalb beide Formen: das SDK-Objekt (ohne `.get`) und das
rohe `dict`, das in anderen Tests steht.
"""

import pytest

from src.features.payments.service import PaymentsService

from .test_payments import _connect_db

ACCT = "acct_pruef"


class _SdkFeld:
    """Ein Stripe-Objekt, so streng wie das echte: KEIN `.get`, und ein
    unbekannter Name wirft `AttributeError` statt `None` zu liefern."""

    def __init__(self, **werte: str) -> None:
        self._werte = werte

    def __getattr__(self, name: str) -> str:
        try:
            return self._werte[name]
        except KeyError as exc:
            raise AttributeError(name) from exc


class _Anforderungen:
    currently_due = ["external_account"]
    past_due: list[str] = []
    eventually_due: list[str] = []
    pending_verification: list[str] = []
    current_deadline = None
    disabled_reason = "requirements.past_due"

    def __init__(self, errors: list[object]) -> None:
        self.errors = errors


class _Konto:
    id = ACCT
    charges_enabled = False
    payouts_enabled = False
    details_submitted = False

    def __init__(self, errors: list[object]) -> None:
        self.requirements = _Anforderungen(errors)


class _Stripe:
    def __init__(self, errors: list[object]) -> None:
        konto = _Konto(errors)

        class _Accounts:
            def retrieve(self, _id: str) -> _Konto:
                return konto

        self.v1 = type("_V1", (), {"accounts": _Accounts()})()


def _status(errors: list[object]):
    dienst = PaymentsService(
        service_client=_connect_db(ACCT), stripe=_Stripe(errors)
    )
    return dienst.get_connect_account_status("t-1", ACCT)


@pytest.mark.parametrize(
    "fehler",
    [
        _SdkFeld(
            requirement="individual.address.line1",
            code="invalid_street_address",
            reason="The street address is invalid.",
        ),
        {
            "requirement": "individual.address.line1",
            "code": "invalid_street_address",
            "reason": "The street address is invalid.",
        },
    ],
    ids=["sdk-objekt", "rohes-dict"],
)
def test_beanstandung_kommt_durch(fehler: object) -> None:
    """Der Kern: die Meldung erreicht den Gastgeber, statt 500 zu werfen."""
    status = _status([fehler])
    assert len(status.errors) == 1
    assert status.errors[0].requirement == "individual.address.line1"
    assert status.errors[0].code == "invalid_street_address"
    assert status.errors[0].reason == "The street address is invalid."


def test_unvollstaendige_beanstandung_kippt_nicht() -> None:
    """Fehlt Stripe ein Feld, bleibt es leer — der Rest der Meldung kommt
    trotzdem an. Ein Teil-Befund ist besser als gar keiner (Wurzel 5)."""
    status = _status([_SdkFeld(reason="Die Angabe passt nicht zum Register.")])
    assert status.errors[0].reason == "Die Angabe passt nicht zum Register."
    assert status.errors[0].requirement == ""
    assert status.errors[0].code == ""


def test_ohne_beanstandung_bleibt_die_liste_leer() -> None:
    assert _status([]).errors == []
