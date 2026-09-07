"""Tests des booking_offers-Slices (0586).

Was hier geprüft wird — und warum genau das:

* **Der Preis kommt vom Server.** Ein Angebot, dessen Betrag der Client
  bestimmt, wäre ein Rabattgenerator (Wurzel 3).
* **Der Token ist der ganze Zugang.** Ein unbekannter oder unsinniger Token
  gibt 404, nie einen 500 und nie ein fremdes Angebot (Wurzel 5).
* **Die Annahme prüft die Verfügbarkeit ERNEUT** und scheitert mit 409, BEVOR
  ein Zahlungslink entsteht — das Angebot hat nichts reserviert (Wurzel 1).
* **Zweimal annehmen erzeugt keine zweite Zahlung** (Wurzel 2).
* **Der Webhook ist idempotent** und lässt fremde Sessions unberührt.
* **Rollen-Gate:** Eigentümer und Mitarbeiter haben mit dem Vertrieb nichts zu
  tun (§4.2/§4.3).
"""
from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient

from src.core.security import AuthContext, get_current_user
from src.features.booking_offers.common import BookingOfferError, token_hash
from src.features.booking_offers.dependencies import get_booking_offers_service
from src.features.booking_offers.schemas import BookingOfferCreate
from src.features.booking_offers.service import BookingOffersService
from src.main import create_app

client = TestClient(create_app())


def test_health() -> None:
    resp = client.get("/api/v1/booking-offers/health")
    assert resp.status_code == 200
    assert resp.json() == {"slice": "booking_offers", "status": "ok"}


# --- Fake-DB ----------------------------------------------------------------


class _Res:
    def __init__(self, data: list[dict], count: int | None = None) -> None:
        self.data = data
        self.count = count


class _Query:
    def __init__(self, store: dict, name: str) -> None:
        self._store = store
        self._name = name
        self._eq: dict = {}
        self._in: dict = {}
        self._lt: dict = {}
        self._gte: dict = {}
        self._op = "select"
        self._payload: dict | None = None
        self._count = False
        self._range: tuple[int, int] | None = None

    def select(self, *_a: Any, **kw: Any) -> _Query:
        self._count = kw.get("count") == "exact"
        return self

    def eq(self, col: str, val: Any) -> _Query:
        self._eq[col] = val
        return self

    def in_(self, col: str, werte: list) -> _Query:
        self._in[col] = list(werte)
        return self

    def lt(self, col: str, val: Any) -> _Query:
        self._lt[col] = val
        return self

    def gte(self, col: str, val: Any) -> _Query:
        self._gte[col] = val
        return self

    def order(self, *_a: Any, **_k: Any) -> _Query:
        return self

    def limit(self, *_a: Any, **_k: Any) -> _Query:
        return self

    def range(self, start: int, end: int) -> _Query:
        self._range = (start, end)
        return self

    def insert(self, payload: dict) -> _Query:
        self._op, self._payload = "insert", payload
        return self

    def update(self, payload: dict) -> _Query:
        self._op, self._payload = "update", payload
        return self

    def execute(self) -> _Res:
        rows = self._store.setdefault(self._name, [])
        if self._op == "insert":
            row = {
                "id": f"{self._name}-{len(rows) + 1}",
                "created_at": datetime.now(UTC).isoformat(),
                "updated_at": datetime.now(UTC).isoformat(),
                **(self._payload or {}),
            }
            rows.append(row)
            return _Res([dict(row)])
        passend = [r for r in rows if self._matches(r)]
        if self._op == "update":
            for r in passend:
                r.update(self._payload or {})
                r["updated_at"] = datetime.now(UTC).isoformat()
            return _Res([dict(r) for r in passend])
        gesamt = len(passend)
        if self._range:
            passend = passend[self._range[0] : self._range[1] + 1]
        return _Res([dict(r) for r in passend], gesamt if self._count else None)

    def _matches(self, row: dict) -> bool:
        if not all(row.get(c) == v for c, v in self._eq.items()):
            return False
        if not all(row.get(c) in werte for c, werte in self._in.items()):
            return False
        if any(str(row.get(c) or "") >= str(v) for c, v in self._lt.items()):
            return False
        return all(str(row.get(c) or "") >= str(v) for c, v in self._gte.items())


class _FakeDB:
    def __init__(self, store: dict) -> None:
        self._store = store

    def table(self, name: str) -> _Query:
        return _Query(self._store, name)


class _FakeMail:
    """Mailer, der nur mitschreibt — kein Versand in Tests."""

    def __init__(self, *, fehler: Exception | None = None) -> None:
        self.gesendet: list[Any] = []
        self._fehler = fehler

    def send(self, msg: Any) -> None:  # noqa: ANN401
        if self._fehler:
            raise self._fehler
        self.gesendet.append(msg)


MORGEN = date.today() + timedelta(days=10)
UEBERMORGEN = MORGEN + timedelta(days=3)


def _store(**tabellen: list[dict]) -> dict:
    basis: dict = {
        "properties": [
            {
                "id": "p1",
                "tenant_id": "t1",
                "title": "Haus Nordlicht",
                "city": "Skagen",
                "currency": "DKK",
                "max_guests": 6,
                "status": "active",
            }
        ],
        "tenants": [{"id": "t1", "name": "Nordlicht ApS"}],
        "availability": [],
        "stop_sell": [],
        "booking_offers": [],
        "booking_intent": [],
        "users": [],
    }
    basis.update(tabellen)
    return basis


def _service(
    store: dict, *, mail: _FakeMail | None = None
) -> tuple[BookingOffersService, _FakeMail]:
    mailer = mail or _FakeMail()
    svc = BookingOffersService(service_client=_FakeDB(store))
    svc._mail = mailer  # noqa: SLF001 — Testdouble statt echtem Versand
    return svc, mailer


def _ctx(tenant: str = "t1") -> AuthContext:
    return AuthContext(user_id="u1", tenant_id=tenant, role="admin")


def _req(**kw: Any) -> BookingOfferCreate:
    daten: dict[str, Any] = {
        "property_id": "p1",
        "check_in": MORGEN,
        "check_out": UEBERMORGEN,
        "adults": 2,
        "guest_name": "Ida Jensen",
        "guest_email": "ida@example.com",
    }
    daten.update(kw)
    return BookingOfferCreate(**daten)


@pytest.fixture
def quote(monkeypatch: pytest.MonkeyPatch) -> dict:
    """Den zentralen Resolver ersetzen — hier wird das Angebot geprüft, nicht die Preislogik."""
    antwort = {
        "property_id": "p1",
        "check_in": MORGEN.isoformat(),
        "check_out": UEBERMORGEN.isoformat(),
        "nights": 3,
        "guests": 2,
        "channel": "website",
        "currency": "DKK",
        "nightly_total": 3000.0,
        "lines": [
            {"label": "3 Nächte", "amount": 3000.0, "kind": "nightly"},
            {"label": "Endreinigung", "amount": 500.0, "kind": "fee"},
        ],
        "total": 3500.0,
    }

    def fake_quote(self: BookingOffersService, req: BookingOfferCreate) -> dict:  # noqa: ARG001
        return dict(antwort)

    monkeypatch.setattr(BookingOffersService, "_quote", fake_quote)
    return antwort


# --- Anlegen ----------------------------------------------------------------


def test_preis_kommt_vom_server(quote: dict) -> None:
    """Der Betrag stammt aus dem Resolver, nicht aus der Anfrage (Wurzel 3)."""
    store = _store()
    svc, _ = _service(store)
    out = svc.anlegen(_ctx(), _req())
    assert out.total_amount == quote["total"]
    assert out.currency == "DKK"
    assert out.status == "draft"
    assert [z.label for z in out.lines] == ["3 Nächte", "Endreinigung"]


def test_token_wird_nur_als_hash_gespeichert(quote: dict) -> None:
    """In der Zeile steht der Hash, nie der Token (Wurzel 3)."""
    store = _store()
    svc, _ = _service(store)
    out = svc.anlegen(_ctx(), _req())
    zeile = store["booking_offers"][0]
    assert len(zeile["token_hash"]) == 64
    klartext = svc._token_cache[out.id]  # noqa: SLF001 — genau das ist zu prüfen
    assert token_hash(klartext) == zeile["token_hash"]
    assert klartext not in str(zeile)


def test_fremdes_objekt_ist_404(quote: dict) -> None:
    """Die Objekt-ID kommt vom Client und wird auf den Mandanten gescopt."""
    store = _store()
    svc, _ = _service(store)
    with pytest.raises(BookingOfferError) as exc:
        svc.anlegen(_ctx(tenant="t2"), _req())
    assert exc.value.status_code == 404


def test_ueberbelegung_wird_abgelehnt(quote: dict) -> None:
    store = _store()
    svc, _ = _service(store)
    with pytest.raises(BookingOfferError) as exc:
        svc.anlegen(_ctx(), _req(adults=5, children=4))
    assert exc.value.status_code == 422


def test_vergangene_anreise_wird_abgelehnt(quote: dict) -> None:
    store = _store()
    svc, _ = _service(store)
    with pytest.raises(BookingOfferError) as exc:
        svc.anlegen(
            _ctx(),
            _req(
                check_in=date.today() - timedelta(days=1),
                check_out=date.today() + timedelta(days=2),
            ),
        )
    assert exc.value.status_code == 422


def test_anzahlung_groesser_als_summe_wird_abgelehnt(quote: dict) -> None:
    store = _store()
    svc, _ = _service(store)
    with pytest.raises(BookingOfferError) as exc:
        svc.anlegen(_ctx(), _req(deposit_amount=9999.0))
    assert exc.value.status_code == 422


def test_ohne_preis_kein_angebot(monkeypatch: pytest.MonkeyPatch) -> None:
    """Ein Angebot über 0 wäre nicht bezahlbar — 422 statt Ersatzwert (Wurzel 4)."""
    monkeypatch.setattr(
        BookingOffersService,
        "_quote",
        lambda self, req: {"currency": "DKK", "total": 0.0, "lines": []},  # noqa: ARG005
    )
    svc, _ = _service(_store())
    with pytest.raises(BookingOfferError) as exc:
        svc.anlegen(_ctx(), _req())
    assert exc.value.status_code == 422


def test_ohne_waehrung_kein_angebot(monkeypatch: pytest.MonkeyPatch) -> None:
    """Fehlende Objektwährung ist ein Datenfehler, kein EUR-Default (Wurzel 4)."""
    def kaputt(self: BookingOffersService, req: BookingOfferCreate) -> dict:  # noqa: ARG001
        raise BookingOfferError(
            "Für dieses Objekt ist keine Währung hinterlegt.", status_code=422
        )

    monkeypatch.setattr(BookingOffersService, "_quote", kaputt)
    svc, _ = _service(_store())
    with pytest.raises(BookingOfferError) as exc:
        svc.anlegen(_ctx(), _req())
    assert exc.value.status_code == 422


def test_einheit_muss_zum_objekt_gehoeren(quote: dict) -> None:
    store = _store(property_units=[{"id": "e9", "property_id": "p-anders"}])
    svc, _ = _service(store)
    with pytest.raises(BookingOfferError) as exc:
        svc.anlegen(_ctx(), _req(unit_id="e9"))
    assert exc.value.status_code == 422


# --- Senden -----------------------------------------------------------------


def _mit_basis_url(monkeypatch: pytest.MonkeyPatch, svc: BookingOffersService) -> None:
    monkeypatch.setattr(
        svc._settings, "app_base_url", "https://app.test", raising=False  # noqa: SLF001
    )


def test_senden_verschickt_mail_mit_link(
    quote: dict, monkeypatch: pytest.MonkeyPatch
) -> None:
    store = _store()
    svc, mailer = _service(store)
    _mit_basis_url(monkeypatch, svc)
    out = svc.anlegen(_ctx(), _req())
    token = svc._token_cache[out.id]  # noqa: SLF001
    gesendet = svc.senden(_ctx(), out.id)
    assert gesendet.status == "sent"
    assert len(mailer.gesendet) == 1
    msg = mailer.gesendet[0]
    assert msg.to == "ida@example.com"
    assert f"/angebot/{token}" in msg.text


def test_senden_ohne_basis_url_schlaegt_fehl(quote: dict) -> None:
    """Eine Mail mit kaputtem Link ist schlimmer als keine (Wurzel 4)."""
    store = _store()
    svc, mailer = _service(store)
    svc._settings = type(svc._settings)(app_base_url="")  # noqa: SLF001
    out = svc.anlegen(_ctx(), _req())
    with pytest.raises(BookingOfferError) as exc:
        svc.senden(_ctx(), out.id)
    assert exc.value.status_code == 500
    assert mailer.gesendet == []


def test_mailfehler_markiert_nicht_als_verschickt(
    quote: dict, monkeypatch: pytest.MonkeyPatch
) -> None:
    """„Verschickt" ohne Mail wäre eine Falschaussage (Wurzel 5)."""
    from src.core.mail import MailError

    store = _store()
    svc, _ = _service(store, mail=_FakeMail(fehler=MailError("SMTP tot")))
    _mit_basis_url(monkeypatch, svc)
    out = svc.anlegen(_ctx(), _req())
    with pytest.raises(BookingOfferError) as exc:
        svc.senden(_ctx(), out.id)
    assert exc.value.status_code == 502
    assert store["booking_offers"][0]["status"] == "draft"


# --- Öffentlich lesen -------------------------------------------------------


def test_unbekannter_token_ist_404() -> None:
    svc, _ = _service(_store())
    with pytest.raises(BookingOfferError) as exc:
        svc.oeffentlich_lesen("voelligUnbekannterTokenWert123456")
    assert exc.value.status_code == 404


def test_leerer_token_wirft_keinen_500() -> None:
    """Angreiferkontrollierter Input darf keinen 500 erzeugen (Wurzel 5)."""
    svc, _ = _service(_store())
    with pytest.raises(BookingOfferError) as exc:
        svc.oeffentlich_lesen("")
    assert exc.value.status_code == 404


def test_lesen_setzt_viewed(quote: dict, monkeypatch: pytest.MonkeyPatch) -> None:
    store = _store()
    svc, _ = _service(store)
    _mit_basis_url(monkeypatch, svc)
    out = svc.anlegen(_ctx(), _req())
    token = svc._token_cache[out.id]  # noqa: SLF001
    svc.senden(_ctx(), out.id)
    oeffentlich = svc.oeffentlich_lesen(token)
    assert oeffentlich.status == "viewed"
    assert oeffentlich.acceptable is True
    assert oeffentlich.amount_due_now == 3500.0
    assert oeffentlich.property_title == "Haus Nordlicht"


def test_oeffentliche_sicht_traegt_keine_ids(
    quote: dict, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Der Gast braucht keine IDs — jede ausgelieferte ist ein Ansatzpunkt."""
    store = _store()
    svc, _ = _service(store)
    _mit_basis_url(monkeypatch, svc)
    out = svc.anlegen(_ctx(), _req(internal_note="Stammgast, 5 % nachgelassen"))
    token = svc._token_cache[out.id]  # noqa: SLF001
    svc.senden(_ctx(), out.id)
    felder = svc.oeffentlich_lesen(token).model_dump()
    assert "id" not in felder
    assert "property_id" not in felder
    assert "internal_note" not in felder
    assert "Stammgast" not in str(felder)


def test_abgelaufenes_angebot_ist_nicht_annehmbar(
    quote: dict, monkeypatch: pytest.MonkeyPatch
) -> None:
    store = _store()
    svc, _ = _service(store)
    _mit_basis_url(monkeypatch, svc)
    out = svc.anlegen(_ctx(), _req())
    token = svc._token_cache[out.id]  # noqa: SLF001
    svc.senden(_ctx(), out.id)
    store["booking_offers"][0]["expires_at"] = (
        datetime.now(UTC) - timedelta(hours=1)
    ).isoformat()
    sicht = svc.oeffentlich_lesen(token)
    assert sicht.status == "expired"
    assert sicht.acceptable is False
    assert sicht.blocked_reason == "expired"


# --- Annehmen ---------------------------------------------------------------


def _annahmebereit(
    monkeypatch: pytest.MonkeyPatch, store: dict
) -> tuple[BookingOffersService, str, str]:
    svc, _ = _service(store)
    _mit_basis_url(monkeypatch, svc)
    out = svc.anlegen(_ctx(), _req())
    token = svc._token_cache[out.id]  # noqa: SLF001
    svc.senden(_ctx(), out.id)
    return svc, out.id, token


def test_annehmen_bei_belegtem_zeitraum_ist_409(
    quote: dict, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Kein Zahlungslink, wenn die Nächte weg sind (Wurzel 1)."""
    store = _store()
    svc, offer_id, token = _annahmebereit(monkeypatch, store)
    store["availability"] = [
        {
            "property_id": "p1",
            "date": MORGEN.isoformat(),
            "status": "booked",
            "source": "manual",
        }
    ]
    with pytest.raises(BookingOfferError) as exc:
        svc.annehmen(token)
    assert exc.value.status_code == 409
    assert store["booking_intent"] == []
    # Unverändert: der fehlgeschlagene Versuch setzt keinen Zustand.
    assert store["booking_offers"][0]["status"] == "sent"


def test_annehmen_bei_stop_sell_ist_409(
    quote: dict, monkeypatch: pytest.MonkeyPatch
) -> None:
    store = _store()
    svc, _offer_id, token = _annahmebereit(monkeypatch, store)
    store["stop_sell"] = [
        {"property_id": "p1", "date": MORGEN.isoformat(), "scope": "all", "channels": []}
    ]
    with pytest.raises(BookingOfferError) as exc:
        svc.annehmen(token)
    assert exc.value.status_code == 409


def test_ota_sperre_blockiert_das_angebot_nicht(
    quote: dict, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Eine aus Channex gespiegelte Portal-Sperre betrifft nur OTAs."""
    store = _store()
    svc, offer_id, token = _annahmebereit(monkeypatch, store)
    store["availability"] = [
        {
            "property_id": "p1",
            "date": MORGEN.isoformat(),
            "status": "blocked",
            "source": "portal",
        }
    ]
    _stripe_ersetzen(monkeypatch, store)
    antwort = svc.annehmen(token)
    assert antwort.payment_url.startswith("https://pay.test/")
    assert store["booking_offers"][0]["status"] == "accepted"


def _stripe_ersetzen(monkeypatch: pytest.MonkeyPatch, store: dict) -> list[dict]:
    """Stripe und die Kontoprüfung ersetzen; gibt die Aufrufe zurück."""
    aufrufe: list[dict] = []

    def fake_link(**kw: Any) -> dict:
        aufrufe.append(kw)
        return {
            "id": f"plink_{len(aufrufe)}",
            "url": f"https://pay.test/{len(aufrufe)}",
            "price_id": "price_1",
            "product_id": "prod_1",
        }

    import src.features.payments.service as pay_service
    import src.features.payments.stripe_client as sc

    monkeypatch.setattr(sc, "create_payment_link", fake_link)
    monkeypatch.setattr(pay_service, "connected_account", lambda _db, _t: "acct_test")
    return aufrufe


def test_annehmen_erzeugt_absicht_und_link(
    quote: dict, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Die Buchung entsteht NICHT hier — nur Absicht (0409) und Zahlung."""
    store = _store()
    svc, offer_id, token = _annahmebereit(monkeypatch, store)
    aufrufe = _stripe_ersetzen(monkeypatch, store)
    antwort = svc.annehmen(token)
    assert antwort.amount_due_now == 3500.0
    assert antwort.currency == "DKK"
    assert len(store["booking_intent"]) == 1
    absicht = store["booking_intent"][0]
    assert absicht["daten"]["booking_offer_id"] == offer_id
    assert absicht["status"] == "offen"
    # Provisionsfrei: ein Angebot ist ein Direktverkauf (ADR-0025).
    assert aufrufe[0]["application_fee_cents"] == 0
    assert aufrufe[0]["amount_cents"] == 350000
    # Keine Reservierung, kein availability-Schreiben in diesem Schritt.
    assert store.get("reservations", []) == []


def test_anzahlung_bestimmt_den_faelligen_betrag(
    quote: dict, monkeypatch: pytest.MonkeyPatch
) -> None:
    store = _store()
    svc, _ = _service(store)
    _mit_basis_url(monkeypatch, svc)
    out = svc.anlegen(_ctx(), _req(deposit_amount=1000.0))
    token = svc._token_cache[out.id]  # noqa: SLF001
    svc.senden(_ctx(), out.id)
    aufrufe = _stripe_ersetzen(monkeypatch, store)
    antwort = svc.annehmen(token)
    assert antwort.amount_due_now == 1000.0
    assert aufrufe[0]["amount_cents"] == 100000
    # Die Absicht trägt den GESAMTbetrag — die Buchung ist nicht billiger,
    # nur die erste Zahlung ist kleiner.
    assert float(store["booking_intent"][0]["total_amount"]) == 3500.0


def test_zweimal_annehmen_erzeugt_keine_zweite_zahlung(
    quote: dict, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Wurzel 2: derselbe Link, keine zweite Absicht."""
    store = _store()
    svc, _offer_id, token = _annahmebereit(monkeypatch, store)
    aufrufe = _stripe_ersetzen(monkeypatch, store)
    erste = svc.annehmen(token)
    zweite = svc.annehmen(token)
    assert erste.payment_url == zweite.payment_url
    assert len(aufrufe) == 1
    assert len(store["booking_intent"]) == 1


def test_zurueckgezogenes_angebot_kann_nicht_angenommen_werden(
    quote: dict, monkeypatch: pytest.MonkeyPatch
) -> None:
    store = _store()
    svc, offer_id, token = _annahmebereit(monkeypatch, store)
    svc.zurueckziehen(_ctx(), offer_id)
    with pytest.raises(BookingOfferError) as exc:
        svc.annehmen(token)
    assert exc.value.status_code == 409
    assert svc.oeffentlich_lesen(token).blocked_reason == "cancelled"


def test_ablehnen_setzt_declined(
    quote: dict, monkeypatch: pytest.MonkeyPatch
) -> None:
    store = _store()
    svc, _offer_id, token = _annahmebereit(monkeypatch, store)
    sicht = svc.ablehnen(token)
    assert sicht.status == "declined"
    assert sicht.acceptable is False
    assert store["booking_offers"][0]["declined_at"]


# --- Ablauf -----------------------------------------------------------------


def test_abgelaufene_schliessen(quote: dict, monkeypatch: pytest.MonkeyPatch) -> None:
    store = _store()
    svc, _offer_id, _token = _annahmebereit(monkeypatch, store)
    store["booking_offers"][0]["expires_at"] = (
        datetime.now(UTC) - timedelta(days=1)
    ).isoformat()
    assert svc.abgelaufene_schliessen() == 1
    assert store["booking_offers"][0]["status"] == "expired"
    # Zweiter Lauf findet nichts mehr (kein Dauerfeuer auf dieselbe Zeile).
    assert svc.abgelaufene_schliessen() == 0


def test_bezahltes_angebot_laeuft_nicht_ab(
    quote: dict, monkeypatch: pytest.MonkeyPatch
) -> None:
    store = _store()
    svc, offer_id, _token = _annahmebereit(monkeypatch, store)
    store["booking_offers"][0]["status"] = "paid"
    store["booking_offers"][0]["expires_at"] = (
        datetime.now(UTC) - timedelta(days=1)
    ).isoformat()
    assert svc.abgelaufene_schliessen() == 0
    assert store["booking_offers"][0]["status"] == "paid"


# --- Webhook ----------------------------------------------------------------


def test_webhook_ignoriert_fremde_session() -> None:
    from src.features.booking_offers.webhook import verbuche_angebots_session

    store = _store()
    verarbeitet = verbuche_angebots_session(
        _FakeDB(store),
        {"id": "cs_1", "metadata": {"nd_zweck": "nachberechnung"}},
        account=None,
    )
    assert verarbeitet is False


def test_webhook_unbezahlte_session_erzeugt_keine_buchung(
    quote: dict, monkeypatch: pytest.MonkeyPatch
) -> None:
    from src.features.booking_offers.webhook import verbuche_angebots_session

    store = _store()
    svc, offer_id, token = _annahmebereit(monkeypatch, store)
    _stripe_ersetzen(monkeypatch, store)
    svc.annehmen(token)
    verarbeitet = verbuche_angebots_session(
        _FakeDB(store),
        {
            "id": "cs_1",
            "payment_status": "unpaid",
            "metadata": {
                "nd_zweck": "angebot",
                "booking_offer_id": offer_id,
                "booking_intent_id": store["booking_intent"][0]["id"],
            },
        },
        account=None,
    )
    assert verarbeitet is True
    assert store["booking_offers"][0]["status"] == "accepted"


def test_webhook_bezahlt_verbucht_und_ist_idempotent(
    quote: dict, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Redelivery erzeugt keine zweite Buchung (Wurzel 2)."""
    import src.features.booking_engine.service as be_service
    from src.features.booking_offers.webhook import verbuche_angebots_session

    store = _store()
    svc, offer_id, token = _annahmebereit(monkeypatch, store)
    _stripe_ersetzen(monkeypatch, store)
    svc.annehmen(token)
    einloesungen: list[str] = []

    def fake_einloesen(self: Any, absicht_id: str) -> str:  # noqa: ANN401, ARG001
        einloesungen.append(absicht_id)
        return "res-1"

    monkeypatch.setattr(
        be_service.BookingEngineService, "absicht_einloesen", fake_einloesen
    )
    session = {
        "id": "cs_1",
        "payment_status": "paid",
        "payment_intent": "pi_1",
        "metadata": {
            "nd_zweck": "angebot",
            "booking_offer_id": offer_id,
            "booking_intent_id": store["booking_intent"][0]["id"],
        },
    }
    db = _FakeDB(store)
    assert verbuche_angebots_session(db, session, account=None) is True
    assert store["booking_offers"][0]["status"] == "paid"
    assert store["booking_offers"][0]["reservation_id"] == "res-1"
    # Zweite Zustellung: der Status-Guard hält.
    assert verbuche_angebots_session(db, session, account=None) is True
    assert len(einloesungen) == 2  # Absicht selbst ist ebenfalls idempotent
    assert store["booking_offers"][0]["status"] == "paid"


def test_webhook_erstattet_wenn_zeitraum_weg(
    quote: dict, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Bezahlt, aber keine Buchung → voll erstatten (Wurzel 1)."""
    import src.features.booking_engine.service as be_service
    import src.features.payments.stripe_client as sc
    from src.features.booking_offers.webhook import verbuche_angebots_session

    store = _store()
    svc, offer_id, token = _annahmebereit(monkeypatch, store)
    _stripe_ersetzen(monkeypatch, store)
    svc.annehmen(token)
    monkeypatch.setattr(
        be_service.BookingEngineService,
        "absicht_einloesen",
        lambda self, absicht_id: None,  # noqa: ARG005
    )
    erstattungen: list[dict] = []
    monkeypatch.setattr(
        sc,
        "refund",
        lambda intent, **kw: erstattungen.append({"intent": intent, **kw}),
    )
    verarbeitet = verbuche_angebots_session(
        _FakeDB(store),
        {
            "id": "cs_1",
            "payment_status": "paid",
            "payment_intent": "pi_1",
            "metadata": {
                "nd_zweck": "angebot",
                "booking_offer_id": offer_id,
                "booking_intent_id": store["booking_intent"][0]["id"],
            },
        },
        account="acct_test",
    )
    assert verarbeitet is True
    assert len(erstattungen) == 1
    assert erstattungen[0]["intent"] == "pi_1"
    # Direct Charge: der Refund läuft im Konto des Betriebs.
    assert erstattungen[0]["direct_acct"] == "acct_test"
    assert store["booking_offers"][0]["status"] != "paid"


def test_webhook_fremdes_konto_wird_abgelehnt(
    quote: dict, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Wurzel 3: eine Session aus fremdem Konto erzeugt keine Buchung hier."""
    from src.features.booking_offers.webhook import verbuche_angebots_session

    store = _store(
        tenant_billing_profile=[
            {"tenant_id": "t1", "stripe_account_id": "acct_richtig"}
        ]
    )
    svc, offer_id, token = _annahmebereit(monkeypatch, store)
    _stripe_ersetzen(monkeypatch, store)
    svc.annehmen(token)
    verarbeitet = verbuche_angebots_session(
        _FakeDB(store),
        {
            "id": "cs_1",
            "payment_status": "paid",
            "metadata": {
                "nd_zweck": "angebot",
                "booking_offer_id": offer_id,
                "booking_intent_id": store["booking_intent"][0]["id"],
            },
        },
        account="acct_fremd",
    )
    assert verarbeitet is False
    assert store["booking_offers"][0]["status"] == "accepted"


# --- Rollen-Gate am Router ---------------------------------------------------


@pytest.mark.parametrize("rolle", ["owner", "staff", "cleaner", "shift_lead"])
def test_ohne_kalenderrecht_kein_zugriff(rolle: str) -> None:
    """§4.2/§4.3: Eigentümer und Mitarbeiter sehen keine Angebote."""
    app = create_app()
    # Echte UUIDs: `require_permission` prüft die Rolle FRISCH in der DB
    # (Wurzel 7), und PostgREST lehnt eine Nicht-UUID mit 422 ab.
    app.dependency_overrides[get_current_user] = lambda: AuthContext(
        user_id="00000000-0000-4000-8000-000000000002",
        tenant_id="00000000-0000-4000-8000-000000000001",
        role=rolle,
    )
    app.dependency_overrides[get_booking_offers_service] = lambda: _service(_store())[0]
    with TestClient(app) as c:
        assert c.get("/api/v1/booking-offers").status_code == 403
        assert c.post("/api/v1/booking-offers", json={}).status_code == 403


def test_oeffentliche_route_prueft_das_tokenmuster() -> None:
    """Unsinn im Pfad gibt 422, nie einen 500 (Wurzel 8)."""
    assert client.get("/api/v1/public/offers/kurz").status_code == 422
    assert client.post("/api/v1/public/offers/kurz/accept").status_code == 422
