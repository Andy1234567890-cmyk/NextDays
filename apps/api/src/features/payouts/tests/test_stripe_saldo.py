"""Tests für Guthaben + Auszahlung des verbundenen Stripe-Kontos (Abrechnung).

Kein Netz: der Stripe-Client ist gepatcht. Geprüft wird vor allem, dass keine
Auszahlung entsteht, die nicht gedeckt/erlaubt ist — und dass ein fehlender
Saldo NICHT als „0" ausgegeben wird (das wäre eine Falschaussage über fremdes
Geld).
"""
from __future__ import annotations

import pytest

from src.core.security import AuthContext
from src.features.payouts import stripe_saldo as st
from src.features.payouts.schemas import StripeRhythmusUpdate
from src.features.payouts.stripe_saldo import StripeSaldoFehler, StripeSaldoService

CTX = AuthContext(user_id="user-1", tenant_id="t1", role="admin")


class _Result:
    def __init__(self, data: list[dict]) -> None:
        self.data = data


class _Query:
    def __init__(self, rows: list[dict]) -> None:
        self._rows = rows
        self._filters: list[tuple[str, object]] = []
        self._in: tuple[str, list[str]] | None = None

    def select(self, *_c: object) -> _Query:
        return self

    def eq(self, col: str, val: object) -> _Query:
        self._filters.append((col, val))
        return self

    def limit(self, _n: int) -> _Query:
        return self

    def order(self, *_a: object, **_k: object) -> _Query:
        return self

    def in_(self, col: str, werte: list) -> _Query:
        self._in = (col, [str(w) for w in werte])
        return self

    def execute(self) -> _Result:
        treffer = [
            r
            for r in self._rows
            if all(str(r.get(c)) == str(v) for c, v in self._filters)
        ]
        if self._in:
            col, werte = self._in
            treffer = [r for r in treffer if str(r.get(col)) in werte]
        return _Result(treffer)


class _DB:
    def __init__(self, profile: list[dict], **weitere: list[dict]) -> None:
        self.tables: dict[str, list[dict]] = {"tenant_billing_profile": profile}
        self.tables.update(weitere)

    def table(self, name: str) -> _Query:
        return _Query(self.tables.get(name, []))


def _db(acct: str | None = "acct_1") -> _DB:
    return _DB([{"tenant_id": "t1", "stripe_account_id": acct}])


class _StripeFake:
    def __init__(
        self,
        *,
        interval: str = "manual",
        payouts_enabled: bool = True,
        verfuegbar: int = 50000,
    ) -> None:
        self.interval = interval
        self.payouts_enabled = payouts_enabled
        self.verfuegbar = verfuegbar
        self.payouts: list[dict] = []
        self.schedules: list[dict] = []

    def balance(self, **_kw: object) -> dict:
        return {
            "available": [{"currency": "dkk", "amount_cents": self.verfuegbar}],
            "pending": [{"currency": "dkk", "amount_cents": 12500}],
        }

    def schedule(self, **_kw: object) -> dict:
        return {
            "payouts_enabled": self.payouts_enabled,
            "interval": self.interval,
            "weekly_anchor": None,
            "monthly_anchor": None,
            "delay_days": 7,
        }

    def payouts_list(self, **_kw: object) -> list[dict]:
        return [
            {
                "id": "po_1",
                "amount_cents": 10000,
                "currency": "dkk",
                "status": "paid",
                "automatic": True,
                "created": 1754000000,
                "arrival_date": 1754200000,
                "failure_message": None,
            }
        ]

    def create_payout(self, **kw: object) -> dict:
        self.payouts.append(dict(kw))
        return {
            "id": f"po_neu_{len(self.payouts)}",
            "amount_cents": kw["amount_cents"],
            "currency": kw["currency"],
            "status": "pending",
            "arrival_date": 1754300000,
        }

    def update_schedule(self, **kw: object) -> dict:
        self.schedules.append(dict(kw))
        self.interval = str(kw["interval"])
        return self.schedule()


@pytest.fixture(name="stripe")
def _stripe(monkeypatch: pytest.MonkeyPatch) -> _StripeFake:
    fake = _StripeFake()
    monkeypatch.setattr(st.sc, "retrieve_balance", lambda **kw: fake.balance(**kw))
    monkeypatch.setattr(
        st.sc, "retrieve_payout_schedule", lambda **kw: fake.schedule(**kw)
    )
    monkeypatch.setattr(st.sc, "list_payouts", lambda **kw: fake.payouts_list(**kw))
    monkeypatch.setattr(st.sc, "create_payout", lambda **kw: fake.create_payout(**kw))
    monkeypatch.setattr(
        st.sc, "update_payout_schedule", lambda **kw: fake.update_schedule(**kw)
    )
    return fake


# --- Lesen -------------------------------------------------------------------

def test_guthaben_ohne_konto_ist_ein_zustand_kein_fehler(stripe: _StripeFake) -> None:
    res = StripeSaldoService(_db(acct=None)).guthaben(CTX)
    assert res.konto_verbunden is False
    assert res.verfuegbar == []


def test_guthaben_liefert_saldo_rhythmus_und_historie(stripe: _StripeFake) -> None:
    res = StripeSaldoService(_db()).guthaben(CTX)
    assert res.konto_verbunden is True
    assert res.interval == "manual"
    assert res.verfuegbar[0].currency == "dkk"
    assert res.verfuegbar[0].amount_cents == 50000
    assert res.ausstehend[0].amount_cents == 12500
    assert res.letzte_auszahlungen[0].id == "po_1"
    # Stripe-Zeitstempel werden übersetzt, nicht durch unsere Uhr ersetzt.
    assert res.letzte_auszahlungen[0].created is not None
    assert res.letzte_auszahlungen[0].created.startswith("2025-")


def test_stripe_ausfall_wird_nicht_als_null_saldo_ausgegeben(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def _kaputt(**_kw: object) -> dict:
        raise RuntimeError("Stripe down")

    monkeypatch.setattr(st.sc, "retrieve_balance", _kaputt)
    with pytest.raises(StripeSaldoFehler) as exc:
        StripeSaldoService(_db()).guthaben(CTX)
    assert exc.value.status_code == 502


# --- Auszahlung beantragen ---------------------------------------------------

def test_auszahlung_ohne_betrag_nimmt_das_verfuegbare_guthaben(
    stripe: _StripeFake,
) -> None:
    res = StripeSaldoService(_db()).auszahlung_anfordern(
        CTX, currency="DKK", amount_cents=None
    )
    assert res.amount_cents == 50000
    assert stripe.payouts[0]["amount_cents"] == 50000
    assert stripe.payouts[0]["currency"] == "dkk"
    # Geldbewegung immer mit Idempotency-Key (Doppelklick).
    assert stripe.payouts[0]["idempotency_key"].startswith("payout:acct_1:dkk:50000:")


def test_auszahlung_bei_automatischem_rhythmus_409(stripe: _StripeFake) -> None:
    stripe.interval = "weekly"
    with pytest.raises(StripeSaldoFehler) as exc:
        StripeSaldoService(_db()).auszahlung_anfordern(
            CTX, currency="DKK", amount_cents=None
        )
    assert exc.value.status_code == 409
    assert not stripe.payouts


def test_auszahlung_ueber_dem_guthaben_422(stripe: _StripeFake) -> None:
    with pytest.raises(StripeSaldoFehler) as exc:
        StripeSaldoService(_db()).auszahlung_anfordern(
            CTX, currency="DKK", amount_cents=60000
        )
    assert exc.value.status_code == 422
    assert not stripe.payouts


def test_auszahlung_ohne_guthaben_409(stripe: _StripeFake) -> None:
    stripe.verfuegbar = 0
    with pytest.raises(StripeSaldoFehler) as exc:
        StripeSaldoService(_db()).auszahlung_anfordern(
            CTX, currency="DKK", amount_cents=None
        )
    assert exc.value.status_code == 409


def test_auszahlung_ohne_freischaltung_409(stripe: _StripeFake) -> None:
    stripe.payouts_enabled = False
    with pytest.raises(StripeSaldoFehler) as exc:
        StripeSaldoService(_db()).auszahlung_anfordern(
            CTX, currency="DKK", amount_cents=None
        )
    assert exc.value.status_code == 409
    assert not stripe.payouts


def test_auszahlung_ohne_konto_409(stripe: _StripeFake) -> None:
    with pytest.raises(StripeSaldoFehler) as exc:
        StripeSaldoService(_db(acct=None)).auszahlung_anfordern(
            CTX, currency="DKK", amount_cents=None
        )
    assert exc.value.status_code == 409


def test_pending_zaehlt_nicht_als_verfuegbar(stripe: _StripeFake) -> None:
    stripe.verfuegbar = 0
    with pytest.raises(StripeSaldoFehler):
        StripeSaldoService(_db()).auszahlung_anfordern(
            CTX, currency="DKK", amount_cents=12500
        )


# --- Rhythmus ----------------------------------------------------------------

def test_rhythmus_setzen_geht_an_stripe_und_liest_zurueck(stripe: _StripeFake) -> None:
    res = StripeSaldoService(_db()).rhythmus_setzen(
        CTX, StripeRhythmusUpdate(interval="weekly", weekly_anchor="thursday")
    )
    assert stripe.schedules[0]["interval"] == "weekly"
    assert stripe.schedules[0]["weekly_anchor"] == "thursday"
    assert res.interval == "weekly"


def test_rhythmus_manual_erlaubt_danach_die_auszahlung(stripe: _StripeFake) -> None:
    svc = StripeSaldoService(_db())
    stripe.interval = "daily"
    svc.rhythmus_setzen(CTX, StripeRhythmusUpdate(interval="manual"))
    res = svc.auszahlung_anfordern(CTX, currency="DKK", amount_cents=None)
    assert res.amount_cents == 50000


# --- Protokoll ---------------------------------------------------------------
# „Damit der Kunde alles nachvollziehen kann": jede Bewegung, richtig sortiert
# nach Richtung, mit der offenen Seite daneben.

def _protokoll_db() -> _DB:
    return _DB(
        [{"tenant_id": "t1", "stripe_account_id": "acct_1"}],
        addon_payment_links=[
            {
                "id": "lnk-1",
                "tenant_id": "t1",
                "reservation_id": "res-1",
                "status": "paid",
                "payment_intent_id": "pi_1",
                "checkout_session_id": "cs_1",
                "amount_cents": 30000,
                "currency": "dkk",
                "url": "https://buy.stripe.com/x",
                "created_at": "2026-08-13T09:00:00Z",
            },
            {
                "id": "lnk-2",
                "tenant_id": "t1",
                "reservation_id": "res-2",
                "status": "open",
                "amount_cents": 12500,
                "currency": "dkk",
                "url": "https://buy.stripe.com/offen",
                "created_at": "2026-08-13T10:00:00Z",
            },
            {
                "id": "lnk-fremd",
                "tenant_id": "t2",
                "reservation_id": "res-9",
                "status": "open",
                "amount_cents": 99900,
                "currency": "dkk",
                "url": "https://buy.stripe.com/fremd",
                "created_at": "2026-08-13T10:00:00Z",
            },
        ],
        addon_payment_link_items=[
            {"link_id": "lnk-1", "reservation_addon_id": "ra-1"},
            {"link_id": "lnk-2", "reservation_addon_id": "ra-2"},
        ],
        reservation_addons=[
            {"id": "ra-1", "name": {"de": "Wäschepaket"}},
            {"id": "ra-2", "name": {"de": "Frühstück"}},
        ],
    )


_BEWEGUNGEN = [
    {
        "id": "txn_1", "typ": "charge", "amount_cents": 30000, "fee_cents": 800,
        "net_cents": 29200, "currency": "dkk", "status": "available",
        "created": 1754000000, "available_on": 1754200000,
        "beschreibung": None, "quelle": {"id": "pi_1", "beschreibung": "Wäschepaket"},
    },
    {
        "id": "txn_2", "typ": "payout", "amount_cents": -20000, "fee_cents": 0,
        "net_cents": -20000, "currency": "dkk", "status": "paid",
        "created": 1754100000, "available_on": None,
        "beschreibung": "STRIPE PAYOUT", "quelle": {"id": "po_1", "beschreibung": None},
    },
    {
        "id": "txn_3", "typ": "application_fee", "amount_cents": -1500,
        "fee_cents": 0, "net_cents": -1500, "currency": "dkk",
        "status": "available", "created": 1754050000, "available_on": None,
        "beschreibung": None, "quelle": {"id": "fee_1", "beschreibung": None},
    },
]


def test_protokoll_trennt_richtungen(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(st.sc, "list_balance_transactions", lambda **_k: _BEWEGUNGEN)
    res = StripeSaldoService(_protokoll_db()).protokoll(CTX)
    assert [e.id for e in res.eingang] == ["txn_1"]
    # Auszahlung UND einbehaltene Plattform-Provision sind Ausgänge.
    assert sorted(a.id for a in res.ausgang) == ["txn_2", "txn_3"]


def test_protokoll_ordnet_zusatzleistung_zu(monkeypatch: pytest.MonkeyPatch) -> None:
    """Die Zeile muss beantworten „wofür war das?", nicht nur einen Betrag zeigen."""
    monkeypatch.setattr(st.sc, "list_balance_transactions", lambda **_k: _BEWEGUNGEN)
    res = StripeSaldoService(_protokoll_db()).protokoll(CTX)
    eingang = res.eingang[0]
    assert eingang.zusatzleistungen == ["Wäschepaket"]
    assert eingang.reservation_id == "res-1"
    # Gebühr und Netto stehen daneben — sonst stimmt die Summe nie mit dem Saldo.
    assert (eingang.amount_cents, eingang.fee_cents, eingang.net_cents) == (
        30000, 800, 29200
    )


def test_protokoll_zeigt_offene_forderungen_des_eigenen_betriebs(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(st.sc, "list_balance_transactions", lambda **_k: _BEWEGUNGEN)
    res = StripeSaldoService(_protokoll_db()).protokoll(CTX)
    assert [o.id for o in res.offen] == ["lnk-2"]  # kein fremder Tenant, kein bezahlter
    assert res.offen[0].positionen == ["Frühstück"]
    assert res.offen[0].url.endswith("/offen")


def test_protokoll_ohne_konto_zeigt_trotzdem_offene_posten(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Offene Forderungen stehen in UNSEREN Daten — sie hängen nicht am Konto."""
    db = _protokoll_db()
    db.tables["tenant_billing_profile"] = [{"tenant_id": "t1", "stripe_account_id": None}]
    res = StripeSaldoService(db).protokoll(CTX)
    assert res.konto_verbunden is False
    assert [o.id for o in res.offen] == ["lnk-2"]


def test_protokoll_stripe_ausfall_wird_nicht_verschluckt(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def _kaputt(**_k: object) -> list:
        raise RuntimeError("Stripe down")

    monkeypatch.setattr(st.sc, "list_balance_transactions", _kaputt)
    with pytest.raises(StripeSaldoFehler) as exc:
        StripeSaldoService(_protokoll_db()).protokoll(CTX)
    assert exc.value.status_code == 502


def test_protokoll_unbekannter_typ_landet_im_eingang(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Positivliste für Ausgänge: ein neuer Stripe-Typ bleibt sichtbar, statt
    aus dem Protokoll zu verschwinden."""
    neu = [{**_BEWEGUNGEN[0], "id": "txn_neu", "typ": "irgendwas_neues"}]
    monkeypatch.setattr(st.sc, "list_balance_transactions", lambda **_k: neu)
    res = StripeSaldoService(_protokoll_db()).protokoll(CTX)
    assert [e.id for e in res.eingang] == ["txn_neu"]
