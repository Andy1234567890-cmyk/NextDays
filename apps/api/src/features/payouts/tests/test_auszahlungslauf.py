"""Tests des Auszahlungslaufs — Schwerpunkt: es fließt nie doppelt.

Der teuerste denkbare Fehler dieses Slices ist ein Transfer für eine Buchung,
deren Geld bereits beim Betrieb liegt (Destination Charge). Diese Datei hält
die Sperre dagegen fest — für BEIDE Geschäftsmodelle und über Ländergrenzen.
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import pytest

from src.features.payouts.faelligkeit import transfer_group
from src.features.payouts.service import PayoutsService, _Uebersprungen

JETZT = datetime(2026, 7, 26, 12, 0, tzinfo=UTC)


class _FakeQuery:
    """Minimaler Supabase-Query-Stub: merkt sich Aufrufe, liefert feste Daten."""

    def __init__(self, tabelle: str, store: dict[str, Any]) -> None:
        self._tabelle = tabelle
        self._store = store
        self._payload: dict[str, Any] | None = None

    def select(self, *_a: Any, **_k: Any) -> _FakeQuery:
        return self

    def insert(self, payload: dict[str, Any]) -> _FakeQuery:
        self._store.setdefault("inserts", []).append((self._tabelle, payload))
        return self

    def update(self, payload: dict[str, Any]) -> _FakeQuery:
        self._payload = payload
        self._store.setdefault("updates", []).append((self._tabelle, payload))
        return self

    def eq(self, *_a: Any, **_k: Any) -> _FakeQuery:
        return self

    def in_(self, *_a: Any, **_k: Any) -> _FakeQuery:
        return self

    def lte(self, *_a: Any, **_k: Any) -> _FakeQuery:
        return self

    def order(self, *_a: Any, **_k: Any) -> _FakeQuery:
        return self

    def limit(self, *_a: Any, **_k: Any) -> _FakeQuery:
        return self

    def execute(self) -> Any:
        rows = self._store.get("rows", {}).get(self._tabelle, [])
        return type("R", (), {"data": rows})()


class _FakeDb:
    def __init__(self, rows: dict[str, list[dict[str, Any]]]) -> None:
        self.store: dict[str, Any] = {"rows": rows, "inserts": [], "updates": []}

    def table(self, name: str) -> _FakeQuery:
        return _FakeQuery(name, self.store)


# Feste UUIDs statt "p1"/"t1": Die echte DB weist Nicht-UUIDs mit
# `invalid input syntax for type uuid` ab — das frühere Fake hat das verdeckt.
_PAYOUT_ID = "11111111-1111-4111-8111-111111111111"
_TENANT_ID = "22222222-2222-4222-8222-222222222222"
_RESERVATION_ID = "33333333-3333-4333-8333-333333333333"


def _zeile(**over: Any) -> dict[str, Any]:
    basis = {
        "id": _PAYOUT_ID,
        "tenant_id": _TENANT_ID,
        "reservation_id": _RESERVATION_ID,
        "net_amount_cents": 92000,
        "currency": "eur",
        "status": "due",
        "source_charge_id": "ch_1",
        # Standard: Zeile aus der Zielwelt. Der Altfall hat eigene Tests.
        "charge_modell": "separate",
    }
    basis.update(over)
    return basis


# --- Die Sperre gegen Doppelzahlung ----------------------------------------


def test_lauf_steht_still_solange_destination_charge(monkeypatch) -> None:
    """Kernschutz: Bei Destination Charges darf KEIN Transfer entstehen.

    Das Geld ist nach dem Charge bereits beim Betrieb; ein Transfer hier wäre
    die zweite Zahlung derselben Buchung zu Lasten des Plattform-Saldos.
    """
    monkeypatch.setattr(
        PayoutsService, "_trennt_charge_und_transfer", staticmethod(lambda: False)
    )
    svc = PayoutsService(db=_FakeDb({}))
    with pytest.raises(_Uebersprungen):
        svc._verarbeite_zeile(_zeile())


def test_sperre_greift_vor_jeder_anderen_pruefung(monkeypatch) -> None:
    """Die Sperre muss ZUERST greifen — auch wenn Konto und Posten in Ordnung
    wären. Sonst hinge der Schutz an der Reihenfolge anderer Prüfungen."""
    monkeypatch.setattr(
        PayoutsService, "_trennt_charge_und_transfer", staticmethod(lambda: False)
    )
    gerufen: list[str] = []
    monkeypatch.setattr(
        PayoutsService,
        "_ziel_konto",
        lambda self, t: gerufen.append("konto") or "acct_x",
    )
    svc = PayoutsService(db=_FakeDb({}))
    with pytest.raises(_Uebersprungen):
        svc._verarbeite_zeile(_zeile())
    assert not gerufen, "Sperre muss vor dem Kontozugriff greifen"


def test_default_ist_gesperrt() -> None:
    """Ohne gesetzte Env steht der Lauf still (fail-closed, Wurzel 5)."""
    assert PayoutsService._trennt_charge_und_transfer() is False


def test_lauf_zaehlt_gesperrte_zeilen_als_uebersprungen(monkeypatch) -> None:
    """Gesperrte Zeilen dürfen nicht als Fehler gelten — sie bleiben fällig."""
    monkeypatch.setattr(
        PayoutsService, "_trennt_charge_und_transfer", staticmethod(lambda: False)
    )
    db = _FakeDb({"payouts": [_zeile(), _zeile(id="p2", reservation_id="r2")]})
    bilanz = PayoutsService(db=db).fuehre_lauf_aus(jetzt=JETZT)
    assert bilanz["uebersprungen"] == 2
    assert bilanz["ausgezahlt"] == 0
    assert bilanz["fehler"] == 0
    assert not db.store["updates"], "gesperrte Zeile darf nicht umgeschrieben werden"


# --- Altzeilen aus der Destination-Charge-Ära (0220) ------------------------


def test_altzeile_wird_nie_ausgezahlt(monkeypatch) -> None:
    """DER GEFÄHRLICHSTE FALL.

    Eine Zeile aus der Destination-Charge-Welt darf auch dann nicht ausgezahlt
    werden, wenn das Flag inzwischen umgelegt wurde — ihr Geld ist längst beim
    Betrieb. Der globale Flag-Guard allein würde sie durchlassen.
    """
    monkeypatch.setattr(
        PayoutsService, "_trennt_charge_und_transfer", staticmethod(lambda: True)
    )
    svc = PayoutsService(db=_FakeDb({}))
    with pytest.raises(_Uebersprungen):
        svc._verarbeite_zeile(_zeile(charge_modell="destination"))


def test_fehlendes_modell_gilt_als_altzeile(monkeypatch) -> None:
    """Unbekannte Herkunft → nicht auszahlen (fail-closed, Wurzel 5)."""
    monkeypatch.setattr(
        PayoutsService, "_trennt_charge_und_transfer", staticmethod(lambda: True)
    )
    svc = PayoutsService(db=_FakeDb({}))
    zeile = _zeile()
    del zeile["charge_modell"]
    with pytest.raises(_Uebersprungen):
        svc._verarbeite_zeile(zeile)


def test_altzeile_bleibt_unveraendert_liegen(monkeypatch) -> None:
    """Übersprungen heißt: kein Fehler, keine Statusänderung, kein Verlust."""
    monkeypatch.setattr(
        PayoutsService, "_trennt_charge_und_transfer", staticmethod(lambda: True)
    )
    db = _FakeDb({"payouts": [_zeile(charge_modell="destination")]})
    bilanz = PayoutsService(db=db).fuehre_lauf_aus(jetzt=JETZT)
    assert bilanz["uebersprungen"] == 1
    assert bilanz["ausgezahlt"] == 0
    assert bilanz["fehler"] == 0
    assert not db.store["updates"]


# --- Erfolgspfad: was nach dem Umlegen des Flags wirklich passiert ----------


@pytest.fixture
def _entsperrt(monkeypatch) -> None:
    """Zielwelt: Charge und Transfer sind getrennt."""
    monkeypatch.setattr(
        PayoutsService, "_trennt_charge_und_transfer", staticmethod(lambda: True)
    )


@pytest.fixture
def _sauberer_betrieb() -> Any:
    """Ein Betrieb OHNE laufenden Steuer-Mahnvorgang, am echten Client.

    Bewusst kein Fake mehr: Das frühere `_FakeDb` kannte nur die zufällig
    genutzten Query-Methoden. Als der Lauf um die Steuer-Sperre (§ 23 PStTG)
    erweitert wurde, brach es an `is_()` — einer Methode, die der echte Client
    hat. Das Double hat den Fehler also ERZEUGT, nicht gefunden.

    Die Steuer-Sperre wird hier NICHT weggepatcht: Der Service fragt die echte
    Tabelle, und der Test stellt nur sicher, dass für diesen Betrieb kein
    Einbehalt läuft. So bleibt die Sperre auch in diesen Tests scharf.
    """
    from src.core.supabase import get_service_client  # noqa: PLC0415

    db = get_service_client()
    rows = (db.table("tenants").select("id").limit(1).execute()).data
    if not rows:
        pytest.skip("Kein Betrieb in der DB.")
    tenant_id = rows[0]["id"]
    laufend = (
        db.table("taxpayer_enforcement")
        .select("id")
        .eq("tenant_id", tenant_id)
        .is_("resolved_at", "null")
        .not_.is_("enforced_at", "null")
        .execute()
    ).data
    if laufend:
        pytest.skip("Betrieb hat einen laufenden Steuer-Einbehalt.")
    return db, tenant_id


@pytest.mark.integration
def test_transfer_geht_in_buchungswaehrung_raus(
    monkeypatch, _entsperrt, _sauberer_betrieb
) -> None:
    """Der Betrieb bekommt seine Währung — nicht die der Plattform."""
    db, tenant_id = _sauberer_betrieb
    svc = PayoutsService(db=db)
    monkeypatch.setattr(PayoutsService, "_ziel_konto", lambda self, t: "acct_x")
    monkeypatch.setattr(PayoutsService, "_pausiert", lambda self, t: False)
    monkeypatch.setattr(PayoutsService, "_offene_posten", lambda self, t, c: [])
    monkeypatch.setattr(
        PayoutsService,
        "_in_saldo_waehrung",
        lambda self, **kw: (kw["betrag_cents"], kw["currency"]),
    )
    gerufen: dict[str, Any] = {}

    def _transfer(**kw: Any) -> dict[str, str]:
        gerufen.update(kw)
        return {"id": "tr_1"}

    monkeypatch.setattr(
        "src.features.payouts.service.sc.create_transfer", _transfer
    )
    assert svc._verarbeite_zeile(_zeile(currency="sek", tenant_id=tenant_id)) is True
    assert gerufen["amount_cents"] == 92000
    assert gerufen["currency"] == "sek"
    assert gerufen["destination_acct"] == "acct_x"
    assert gerufen["transfer_group"] == f"reservation:{_RESERVATION_ID}"
    # Wurzel 2: Retry darf nicht ein zweites Mal auszahlen.
    assert gerufen["idempotency_key"] == f"payout-{_PAYOUT_ID}"


@pytest.mark.integration
def test_offene_posten_kuerzen_den_transfer(
    monkeypatch, _entsperrt, _sauberer_betrieb
) -> None:
    """Airbnb-Modell: Storno wird verrechnet, nicht zurückgeholt."""
    db, tenant_id = _sauberer_betrieb
    svc = PayoutsService(db=db)
    monkeypatch.setattr(PayoutsService, "_ziel_konto", lambda self, t: "acct_x")
    monkeypatch.setattr(PayoutsService, "_pausiert", lambda self, t: False)
    monkeypatch.setattr(
        PayoutsService,
        "_offene_posten",
        lambda self, t, c: [{"amount_cents": 30000, "settled_cents": 0}],
    )
    monkeypatch.setattr(
        PayoutsService, "_verrechne_posten", lambda self, p, b, pid: None
    )
    monkeypatch.setattr(
        PayoutsService,
        "_in_saldo_waehrung",
        lambda self, **kw: (kw["betrag_cents"], kw["currency"]),
    )
    gerufen: dict[str, Any] = {}
    monkeypatch.setattr(
        "src.features.payouts.service.sc.create_transfer",
        lambda **kw: (gerufen.update(kw), {"id": "tr_1"})[1],
    )
    assert svc._verarbeite_zeile(_zeile(tenant_id=tenant_id)) is True
    assert gerufen["amount_cents"] == 62000  # 92000 − 30000


@pytest.mark.integration
def test_voll_verrechnet_zahlt_gar_nicht_aus(
    monkeypatch, _entsperrt, _sauberer_betrieb
) -> None:
    """Deckt der offene Posten alles, fließt kein Geld — die Zeile ist erledigt."""
    db, tenant_id = _sauberer_betrieb
    svc = PayoutsService(db=db)
    monkeypatch.setattr(PayoutsService, "_ziel_konto", lambda self, t: "acct_x")
    monkeypatch.setattr(PayoutsService, "_pausiert", lambda self, t: False)
    monkeypatch.setattr(
        PayoutsService,
        "_offene_posten",
        lambda self, t, c: [{"amount_cents": 99000, "settled_cents": 0}],
    )
    monkeypatch.setattr(
        PayoutsService, "_verrechne_posten", lambda self, p, b, pid: None
    )
    gerufen: list[Any] = []
    monkeypatch.setattr(
        "src.features.payouts.service.sc.create_transfer",
        lambda **kw: gerufen.append(kw),
    )
    # Echte Zeile anlegen, damit das Status-Update auch wirklich eine Zeile
    # trifft — gegen die echte DB ist „update lief" nur beweisbar, wenn die
    # Zeile danach gelesen werden kann. Die Reservierung muss dabei existieren:
    # payouts.reservation_id hat einen Fremdschlüssel (das Fake kannte den nicht).
    res = (
        db.table("reservations")
        .select("id")
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    ).data
    if not res:
        pytest.skip("Betrieb hat keine Reservierung.")
    reservation_id = res[0]["id"]
    db.table("payouts").delete().eq("id", _PAYOUT_ID).execute()
    db.table("payouts").insert(
        {
            "id": _PAYOUT_ID,
            "tenant_id": tenant_id,
            "reservation_id": reservation_id,
            "gross_amount_cents": 100000,
            "net_amount_cents": 92000,
            "platform_fee_cents": 8000,
            "currency": "eur",
            "status": "due",
            "due_at": JETZT.isoformat(),
            "charge_modell": "separate",
        }
    ).execute()
    try:
        assert svc._verarbeite_zeile(_zeile(tenant_id=tenant_id)) is False
        assert not gerufen, "kein Transfer, wenn alles verrechnet ist"
        danach = (
            db.table("payouts").select("status").eq("id", _PAYOUT_ID).execute()
        ).data
        assert danach and danach[0]["status"] == "paid"
    finally:
        db.table("payouts").delete().eq("id", _PAYOUT_ID).execute()


def test_pausierter_betrieb_wird_uebersprungen(monkeypatch, _entsperrt) -> None:
    svc = PayoutsService(db=_FakeDb({}))
    monkeypatch.setattr(PayoutsService, "_pausiert", lambda self, t: True)
    with pytest.raises(_Uebersprungen):
        svc._verarbeite_zeile(_zeile())


@pytest.mark.integration
def test_ohne_auszahlungskonto_kein_transfer(
    monkeypatch, _entsperrt, _sauberer_betrieb
) -> None:
    """Kein Konto = liegen lassen, nicht als Fehler werten."""
    db, tenant_id = _sauberer_betrieb
    svc = PayoutsService(db=db)
    monkeypatch.setattr(PayoutsService, "_pausiert", lambda self, t: False)
    monkeypatch.setattr(PayoutsService, "_ziel_konto", lambda self, t: None)
    with pytest.raises(_Uebersprungen):
        svc._verarbeite_zeile(_zeile(tenant_id=tenant_id))


# --- transfer_group: die Klammer zwischen Charge und Transfer ---------------


def test_transfer_group_ist_stabil() -> None:
    assert transfer_group("abc-123") == "reservation:abc-123"


def test_transfer_group_identisch_zu_payments_seite() -> None:
    """Charge und Transfer MÜSSEN denselben Wert tragen, sonst ordnet Stripe
    sie nicht zu. Eine Quelle für beide Slices."""
    from src.features.payments.service import _transfer_group

    for rid in ("r1", "abc-123", "0" * 36):
        assert _transfer_group(rid) == transfer_group(rid)
