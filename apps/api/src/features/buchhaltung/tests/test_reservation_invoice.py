"""Tests für den Booking→Invoice-Builder (reservation_invoice).

build_positions ist pure (DB-frei); für die DB-Pfade wird ein leichter
Chain-Mock genutzt (jede Query-Kette endet in execute() → hinterlegte Daten,
Muster analog zu den MagicMock-Ketten in reservations/tests).
"""
from collections import deque
from decimal import Decimal
from types import SimpleNamespace

import pytest

from src.features.buchhaltung.reservation_invoice import (
    build_positions,
    create_from_reservation,
    ensure_customer_for_guest,
    preview_for_reservation,
)
from src.features.buchhaltung.service import BuchhaltungError

TENANT = "t1"


class _Chain:
    """PostgREST-Query-Ketten-Mock: jede Methode/Attribut gibt die Kette selbst
    zurück, execute() liefert die hinterlegten Daten (deque = Antwort-Queue).
    insert(...)-Payloads werden mitgeschnitten (Assertions auf Schreibdaten)."""

    def __init__(self, data: object, calls: list[str], inserts: list) -> None:
        self._data = data
        self.calls = calls
        self.inserts = inserts
        self._last_attr = ""

    def __getattr__(self, name: str) -> "_Chain":
        self.calls.append(name)
        object.__setattr__(self, "_last_attr", name)
        return self

    def __call__(self, *args: object, **kwargs: object) -> "_Chain":
        if self._last_attr == "insert" and args:
            self.inserts.append(args[0])
        return self

    def execute(self) -> SimpleNamespace:
        data = self._data
        if isinstance(data, deque):
            data = data.popleft() if data else []
        return SimpleNamespace(data=data)


class _DB:
    """Supabase-Client-Mock: table(name) → _Chain mit den Daten je Tabelle."""

    def __init__(self, tables: dict[str, object]) -> None:
        self._tables = tables
        self.calls: dict[str, list[str]] = {}
        self.inserts: dict[str, list] = {}

    def table(self, name: str) -> _Chain:
        calls = self.calls.setdefault(name, [])
        inserts = self.inserts.setdefault(name, [])
        return _Chain(self._tables.get(name, []), calls, inserts)

    def rpc(self, name: str, params: dict) -> _Chain:
        return _Chain(
            [{"sequential_number": 7, "formatted_number": "RE-0007"}],
            self.calls.setdefault(f"rpc:{name}", []),
            self.inserts.setdefault(f"rpc:{name}", []),
        )


def _reservation(**overrides: object) -> dict:
    base = {
        "id": "r1",
        "tenant_id": TENANT,
        "property_id": "p1",
        "guest_id": "g1",
        "status": "confirmed",
        "checked_in_at": "2026-07-01T14:00:00+00:00",
        "checked_out_at": None,
        "check_in": "2026-07-01",
        "check_out": "2026-07-04",
        "currency": "EUR",
        "total_amount": 300.0,
        "paid_amount": 0,
        "quote_items": [
            {"label": "Übernachtung (3 Nächte)", "amount": 280.0, "kind": "lodging"},
            {"label": "Kurtaxe", "amount": 20.0, "kind": "tax"},
        ],
        "guest_country": "DE",
        "guests": {"name": "Max Muster"},
    }
    base.update(overrides)
    return base


# --- build_positions (pure) --------------------------------------------------

def test_gross_to_net_split_7_percent() -> None:
    """100,00 brutto @7 % → 93,46 netto / 6,54 Steuer (ROUND_HALF_UP)."""
    res = _reservation(
        total_amount=100.0,
        quote_items=[{"label": "Übernachtung (1 Nacht)", "amount": 100.0,
                      "kind": "lodging"}],
    )
    pos = build_positions(res, [], [], Decimal("7"), False, "Zimmer 1")
    assert len(pos) == 1
    assert pos[0]["net_amount"] == Decimal("93.46")
    assert pos[0]["tax_amount"] == Decimal("6.54")
    assert pos[0]["gross_amount"] == Decimal("100.00")


def test_tax_kind_line_gets_zero_rate() -> None:
    pos = build_positions(_reservation(), [], [], Decimal("7"), False, "")
    by_label = {p["description"]: p for p in pos}
    assert by_label["Kurtaxe"]["tax_rate"] == Decimal("0")
    assert by_label["Kurtaxe"]["gross_amount"] == Decimal("20.00")
    assert by_label["Übernachtung (3 Nächte)"]["tax_rate"] == Decimal("7")


def test_label_heuristic_for_legacy_items_without_kind() -> None:
    """Bestands-Snapshots ohne kind: Label = additiver taxes[].name → 0 %."""
    res = _reservation(
        quote_items=[
            {"label": "Übernachtung (3 Nächte)", "amount": 280.0},
            {"label": "City Tax", "amount": 20.0},
        ],
    )
    taxes = [{"name": "City Tax", "includedInPrice": False}]
    pos = build_positions(res, [], taxes, Decimal("7"), False, "")
    by_label = {p["description"]: p for p in pos}
    assert by_label["City Tax"]["tax_rate"] == Decimal("0")
    assert by_label["Übernachtung (3 Nächte)"]["tax_rate"] == Decimal("7")


def test_fee_line_uses_own_tax_rate_snapshot() -> None:
    """Gebühr mit eigenem Satz-Snapshot (Frühstück 19 %) neben Logis 7 %."""
    res = _reservation(
        total_amount=320.0,
        quote_items=[
            {"label": "Übernachtung (3 Nächte)", "amount": 280.0, "kind": "lodging"},
            {"label": "Frühstück", "amount": 40.0, "kind": "fee", "tax_rate": 19.0},
        ],
    )
    pos = build_positions(res, [], [], Decimal("7"), False, "")
    by_label = {p["description"]: p for p in pos}
    assert by_label["Frühstück"]["tax_rate"] == Decimal("19")
    # 40,00 brutto @19 % → 33,61 netto / 6,39 Steuer.
    assert by_label["Frühstück"]["net_amount"] == Decimal("33.61")
    assert by_label["Frühstück"]["tax_amount"] == Decimal("6.39")
    assert by_label["Übernachtung (3 Nächte)"]["tax_rate"] == Decimal("7")


def test_fee_line_without_snapshot_falls_back_to_lodging_rate() -> None:
    """Bestands-/Channex-Fees ohne tax_rate → Übernachtungssatz (alter Pfad)."""
    res = _reservation(
        total_amount=320.0,
        quote_items=[
            {"label": "Übernachtung (3 Nächte)", "amount": 280.0, "kind": "lodging"},
            {"label": "Reinigung", "amount": 40.0, "kind": "fee"},
        ],
    )
    pos = build_positions(res, [], [], Decimal("7"), False, "")
    by_label = {p["description"]: p for p in pos}
    assert by_label["Reinigung"]["tax_rate"] == Decimal("7")


def test_kleinunternehmer_overrides_fee_tax_rate_snapshot() -> None:
    res = _reservation(
        total_amount=320.0,
        quote_items=[
            {"label": "Übernachtung (3 Nächte)", "amount": 280.0, "kind": "lodging"},
            {"label": "Frühstück", "amount": 40.0, "kind": "fee", "tax_rate": 19.0},
        ],
    )
    pos = build_positions(res, [], [], None, True, "")
    assert all(p["tax_rate"] == Decimal("0") for p in pos)


def test_tax_line_with_snapshot_rate_uses_snapshot() -> None:
    """Zeilen-Satz schlägt auch die Abgaben-0%-Logik — der Snapshot ist die
    Kaufzeitpunkt-Wahrheit (gesetzt wird er heute nur für Gebühren)."""
    res = _reservation(
        quote_items=[
            {"label": "Übernachtung (3 Nächte)", "amount": 280.0, "kind": "lodging"},
            {"label": "Kurtaxe", "amount": 20.0, "kind": "tax", "tax_rate": 7.0},
        ],
    )
    pos = build_positions(res, [], [], Decimal("7"), False, "")
    by_label = {p["description"]: p for p in pos}
    assert by_label["Kurtaxe"]["tax_rate"] == Decimal("7")


def test_missing_lodging_tax_rate_raises_422() -> None:
    with pytest.raises(BuchhaltungError) as exc:
        build_positions(_reservation(), [], [], None, False, "")
    assert exc.value.status_code == 422
    assert "Übernachtungs-Steuersatz" in exc.value.message


def test_kleinunternehmer_zeroes_all_rates_without_config() -> None:
    addons = [{"status": "pending", "total": 30.0, "tax_rate": 19.0, "qty": 1,
               "name": {"de": "Frühstück"}}]
    pos = build_positions(_reservation(), addons, [], None, True, "")
    assert all(p["tax_rate"] == Decimal("0") for p in pos)
    assert all(p["tax_amount"] == Decimal("0.00") for p in pos)


def test_addons_added_without_dedup_and_cancelled_excluded() -> None:
    """quote_items enthalten NIE Addon-Zeilen (Invariante) → Addons werden
    zusätzlich fakturiert; stornierte Addons nicht."""
    addons = [
        {"status": "paid", "total": 30.0, "tax_rate": 19.0, "qty": 2,
         "name": {"de": "Frühstück"}},
        {"status": "cancelled", "total": 99.0, "tax_rate": 19.0, "qty": 1,
         "name": {"de": "Storniert"}},
    ]
    pos = build_positions(_reservation(), addons, [], Decimal("7"), False, "")
    labels = [p["description"] for p in pos]
    assert "Frühstück ×2" in labels
    assert all("Storniert" not in label for label in labels)
    breakfast = next(p for p in pos if p["description"] == "Frühstück ×2")
    assert breakfast["tax_rate"] == Decimal("19.00")
    assert breakfast["gross_amount"] == Decimal("30.00")


def test_addon_null_tax_rate_stays_zero() -> None:
    """Snapshot-tax_rate NULL = 0 % (Kaufzeitpunkt-Wahrheit, kein Default)."""
    addons = [{"status": "pending", "total": 10.0, "tax_rate": None, "qty": 1,
               "name": {"de": "Parkplatz"}}]
    pos = build_positions(_reservation(), addons, [], Decimal("7"), False, "")
    parking = next(p for p in pos if p["description"] == "Parkplatz")
    assert parking["tax_rate"] == Decimal("0")
    assert parking["net_amount"] == Decimal("10.00")


def test_empty_quote_items_creates_collective_position() -> None:
    res = _reservation(quote_items=[], total_amount=450.0)
    pos = build_positions(res, [], [], Decimal("7"), False, "Ferienhaus Ost")
    assert len(pos) == 1
    assert "Aufenthalt Ferienhaus Ost" in pos[0]["description"]
    assert "(3 Nächte)" in pos[0]["description"]
    assert pos[0]["gross_amount"] == Decimal("450.00")


def test_overridden_total_replaces_breakdown() -> None:
    """Manuell überschriebener Gesamtpreis ≠ Zeilensumme → ehrliche
    Sammelposition über den vereinbarten Betrag statt falscher Aufschlüsselung."""
    res = _reservation(total_amount=250.0)  # Zeilen summieren auf 300
    pos = build_positions(res, [], [], Decimal("7"), False, "Zimmer 2")
    assert len(pos) == 1
    assert pos[0]["gross_amount"] == Decimal("250.00")


def test_zero_total_creates_zero_position() -> None:
    """0 € ist ein gültiger vereinbarter Preis (Comp-Aufenthalt) — der
    Check-out darf nie an der Pflicht-Rechnung scheitern → 0-Beleg."""
    res = _reservation(quote_items=[], total_amount=0)
    pos = build_positions(res, [], [], None, False, "Zimmer 3")
    assert len(pos) == 1
    assert pos[0]["gross_amount"] == Decimal("0.00")
    assert pos[0]["tax_rate"] == Decimal("0")


def test_gross_sum_matches_booking_total_exactly() -> None:
    """Keine Rundungsdrift: Σ Brutto der Positionen = Buchungssumme + Addons."""
    res = _reservation(
        total_amount=123.45,
        quote_items=[
            {"label": "Übernachtung (2 Nächte)", "amount": 101.11, "kind": "lodging"},
            {"label": "Reinigung", "amount": 22.34, "kind": "fee"},
        ],
    )
    addons = [{"status": "pending", "total": 17.89, "tax_rate": 19.0, "qty": 1,
               "name": {"de": "Spätanreise"}}]
    pos = build_positions(res, addons, [], Decimal("7"), False, "")
    gross = sum(p["gross_amount"] for p in pos)
    assert gross == Decimal("123.45") + Decimal("17.89")


# --- DB-Pfade ----------------------------------------------------------------

def _tables(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "reservations": [_reservation()],
        "tenant_billing_profile": [
            {"legal_name": "Hotel X", "is_kleinunternehmer": False,
             "lodging_tax_rate": 7.0, "default_payment_days": 14}
        ],
        "properties": [{"title": "Zimmer 1"}],
        "property_pricing_config": [{"taxes": []}],
        "reservation_addons": [],
        "customers": [{"id": "c1", "name": "Max Muster", "email": "m@x.de",
                       "customer_number": "KD-0001"}],
        "invoices": [],
    }
    base.update(overrides)
    return base


def test_preview_is_read_only_without_existing_customer() -> None:
    """Vorschau legt KEINEN Debitor an (kein GET-Schreibeffekt, keine
    KD-Nummer) — Kundendaten kommen dann aus dem Gast."""
    db = _DB(_tables(customers=[]))
    preview = preview_for_reservation(db, TENANT, "r1")
    assert preview["customerId"] is None
    assert preview["customerName"] == "Max Muster"
    assert "insert" not in db.calls.get("customers", [])
    assert "rpc:next_document_number" not in db.calls


def test_preview_includes_guest_master_data_and_company() -> None:
    """Gästemappen-Stammdaten fürs Empfänger-Formular: Vorname/Nachname,
    Adresse und (bei Geschäftsreisenden) Firma + USt-IdNr."""
    db = _DB(
        _tables(
            customers=[],
            guests=[{"company": "ACME GmbH", "vat_id": "DE123456789"}],
            guest_addresses=[{
                "street": "Musterweg", "house_no": "6",
                "postal_code": "15749", "city": "Mittenwalde",
                "country": "Deutschland",
            }],
            reservations=[_reservation(
                guests={"name": "Max Muster", "first_name": "Max",
                        "last_name": "Muster"},
            )],
        )
    )
    preview = preview_for_reservation(db, TENANT, "r1")
    assert preview["customerFirstName"] == "Max"
    assert preview["customerLastName"] == "Muster"
    assert preview["company"] == "ACME GmbH"
    assert preview["companyVatId"] == "DE123456789"
    assert preview["address"] == {
        "street": "Musterweg", "houseNo": "6", "postalCode": "15749",
        "city": "Mittenwalde", "country": "Deutschland",
    }


def test_preview_returns_net_items_and_customer() -> None:
    db = _DB(_tables())
    preview = preview_for_reservation(db, TENANT, "r1")
    assert preview["customerId"] == "c1"
    assert preview["currency"] == "EUR"
    assert preview["stay"] == {"from": "2026-07-01", "to": "2026-07-04", "nights": 3}
    lodging = next(
        i for i in preview["items"] if i["description"].startswith("Übernachtung")
    )
    assert lodging["unitPrice"] == 261.68  # 280 / 1.07
    assert lodging["taxRate"] == 7.0
    assert lodging["total"] == 280.0


def test_preview_rejects_existing_invoice_with_409() -> None:
    db = _DB(_tables(invoices=[{"id": "i1", "invoice_number": "RE-0001",
                                "status": "finalized"}]))
    with pytest.raises(BuchhaltungError) as exc:
        preview_for_reservation(db, TENANT, "r1")
    assert exc.value.status_code == 409
    assert "RE-0001" in exc.value.message


def test_not_checked_in_raises_409() -> None:
    db = _DB(_tables(reservations=[_reservation(checked_in_at=None)]))
    with pytest.raises(BuchhaltungError) as exc:
        preview_for_reservation(db, TENANT, "r1")
    assert exc.value.status_code == 409


def test_cancelled_reservation_raises_409() -> None:
    db = _DB(_tables(reservations=[_reservation(status="cancelled")]))
    with pytest.raises(BuchhaltungError) as exc:
        preview_for_reservation(db, TENANT, "r1")
    assert exc.value.status_code == 409


def test_missing_currency_everywhere_raises_422() -> None:
    """Weder Buchungs-Snapshot noch Preiskonfig/Rate-Plan haben eine Währung
    → klarer Fehler, kein erfundener Standard."""
    db = _DB(_tables(reservations=[_reservation(currency=None)]))
    with pytest.raises(BuchhaltungError) as exc:
        preview_for_reservation(db, TENANT, "r1")
    assert exc.value.status_code == 422
    assert "Währung" in exc.value.message


def test_property_vat_beats_tenant_default() -> None:
    """27-EU-Länder-Fall: Beherbergung wird am Objektstandort besteuert —
    die Objekt-USt (Preis-Setup, kind='vat', im Preis enthalten) gewinnt
    über den Tenant-Standard (z. B. AT-Objekt 10 % bei DE-Tenant 7 %)."""
    db = _DB(
        _tables(
            property_pricing_config=[{
                "currency": "EUR",
                "taxes": [{"kind": "vat", "name": "USt", "mode": "percent",
                           "value": 10, "includedInPrice": True}],
            }],
        )
    )
    preview = preview_for_reservation(db, TENANT, "r1")
    lodging = next(
        i for i in preview["items"] if i["description"].startswith("Übernachtung")
    )
    assert lodging["taxRate"] == 10.0


def test_tenant_default_used_without_property_vat() -> None:
    """Ohne Objekt-USt greift der Konto-Standard (Profil: 7 %)."""
    db = _DB(_tables())
    preview = preview_for_reservation(db, TENANT, "r1")
    lodging = next(
        i for i in preview["items"] if i["description"].startswith("Übernachtung")
    )
    assert lodging["taxRate"] == 7.0


def test_additive_vat_entry_does_not_become_lodging_rate() -> None:
    """Additive USt (includedInPrice=false) ist eine Konfigurations-Grenze
    (Doku-Hinweis) — sie darf NICHT als Objektsatz greifen."""
    db = _DB(
        _tables(
            property_pricing_config=[{
                "currency": "EUR",
                "taxes": [{"kind": "vat", "name": "USt", "mode": "percent",
                           "value": 20, "includedInPrice": False}],
            }],
        )
    )
    preview = preview_for_reservation(db, TENANT, "r1")
    lodging = next(
        i for i in preview["items"] if i["description"].startswith("Übernachtung")
    )
    assert lodging["taxRate"] == 7.0  # Tenant-Standard, nicht 20


def test_currency_resolved_from_pricing_config() -> None:
    """Bestandsbuchung ohne Währungs-Snapshot (nullable seit 0078): Währung
    kommt deterministisch aus property_pricing_config (Resolver-Quelle)."""
    db = _DB(
        _tables(
            reservations=[_reservation(currency=None)],
            property_pricing_config=[{"taxes": [], "currency": "CHF"}],
        )
    )
    preview = preview_for_reservation(db, TENANT, "r1")
    assert preview["currency"] == "CHF"


def test_currency_resolved_from_rate_plan_as_last_source() -> None:
    db = _DB(
        _tables(
            reservations=[_reservation(currency=None)],
            property_pricing_config=[],
            rate_plans=[{"currency": "SEK"}],
        )
    )
    preview = preview_for_reservation(db, TENANT, "r1")
    assert preview["currency"] == "SEK"


def test_missing_profile_raises_422() -> None:
    db = _DB(_tables(tenant_billing_profile=[]))
    with pytest.raises(BuchhaltungError) as exc:
        preview_for_reservation(db, TENANT, "r1")
    assert exc.value.status_code == 422


def test_ensure_customer_reuses_existing_by_guest_id() -> None:
    db = _DB(_tables())
    customer = ensure_customer_for_guest(db, TENANT, _reservation())
    assert customer["id"] == "c1"


def test_ensure_customer_requires_guest() -> None:
    db = _DB(_tables())
    with pytest.raises(BuchhaltungError) as exc:
        ensure_customer_for_guest(db, TENANT, _reservation(guest_id=None))
    assert exc.value.status_code == 422


def test_create_is_idempotent_for_existing_invoice() -> None:
    db = _DB(_tables(invoices=[{"id": "i1", "invoice_number": "RE-0001",
                                "status": "finalized"}]))
    result = create_from_reservation(db, TENANT, "r1")
    assert result == {"id": "i1", "invoice_number": "RE-0001",
                      "already_existed": True}


def test_create_inserts_invoice_and_lines() -> None:
    # invoices: 1. Antwort = find_active (leer), 2. Antwort = Insert-Ergebnis,
    # danach Line-Insert auf invoice_line_items.
    db = _DB(_tables(invoices=deque([[], [{"id": "i9"}]])))
    result = create_from_reservation(db, TENANT, "r1")
    assert result == {"id": "i9", "invoice_number": "RE-0007",
                      "already_existed": False}
    assert "insert" in db.calls["invoices"]
    assert "insert" in db.calls["invoice_line_items"]


def test_fully_paid_reservation_creates_paid_invoice() -> None:
    reservation = _reservation(paid_amount=300.0)
    db = _DB(_tables(reservations=[reservation],
                     invoices=deque([[], [{"id": "i9"}]])))
    result = create_from_reservation(db, TENANT, "r1")
    assert result["already_existed"] is False


def test_cash_payment_marks_invoice_paid() -> None:
    """Zahlart bar/Karte (Rezeptions-Abfrage): Rechnung sofort 'paid' mit
    vollem Betrag + persistierter Zahlart (0097)."""
    db = _DB(_tables(invoices=deque([[], [{"id": "i9"}]])))
    create_from_reservation(db, TENANT, "r1", payment_method="cash")
    row = db.inserts["invoices"][0]
    assert row["status"] == "paid"
    assert row["payment_method"] == "cash"
    assert "card_brand" not in row  # None-Werte werden nicht mitgesendet
    assert row["paid_amount"] == "300.00"
    assert "paid_at" in row


def test_card_payment_persists_brand() -> None:
    db = _DB(_tables(invoices=deque([[], [{"id": "i9"}]])))
    create_from_reservation(
        db, TENANT, "r1", payment_method="card", card_brand="Visa"
    )
    row = db.inserts["invoices"][0]
    assert row["status"] == "paid"
    assert row["payment_method"] == "card"
    assert row["card_brand"] == "Visa"


def test_invoice_payment_stays_finalized_with_due_date() -> None:
    """„Auf Rechnung": kein Sofort-Bezahlt — finalized mit Zahlungsziel."""
    db = _DB(_tables(invoices=deque([[], [{"id": "i9"}]])))
    create_from_reservation(db, TENANT, "r1", payment_method="invoice")
    row = db.inserts["invoices"][0]
    assert row["status"] == "finalized"
    assert row["payment_method"] == "invoice"
    assert row["paid_amount"] == "0.00"


# --- Dokumentsprache = Gastsprache (doc_i18n, 0099) ---------------------------

def test_collective_position_in_guest_language() -> None:
    """Sammelposition + Einheit entstehen in der Gastsprache (it)."""
    res = _reservation(guest_language="it", quote_items=[])
    pos = build_positions(res, [], [], Decimal("7"), False, "Villa", "it")
    assert pos[0]["description"] == "Soggiorno Villa 01/07/2026 – 04/07/2026 (3 notti)"
    assert pos[0]["unit"] == "forfettario"


def test_addon_label_prefers_guest_language() -> None:
    addons = [{"status": "pending", "total": 30.0, "tax_rate": 19.0, "qty": 1,
               "name": {"de": "Frühstück", "it": "Colazione"}}]
    pos = build_positions(_reservation(), addons, [], Decimal("7"), False, "", "it")
    assert any(p["description"] == "Colazione" for p in pos)


def test_created_invoice_stores_language_and_localized_head_text() -> None:
    reservation = _reservation(guest_language="it")
    db = _DB(_tables(reservations=[reservation],
                     invoices=deque([[], [{"id": "i9"}]])))
    create_from_reservation(db, TENANT, "r1")
    row = db.inserts["invoices"][0]
    assert row["language"] == "it"
    assert row["head_text"] == "Soggiorno 01/07/2026 – 04/07/2026 (3 notti), Zimmer 1"


def test_unknown_guest_language_falls_back_to_german() -> None:
    reservation = _reservation(guest_language="xx")
    db = _DB(_tables(reservations=[reservation],
                     invoices=deque([[], [{"id": "i9"}]])))
    create_from_reservation(db, TENANT, "r1")
    row = db.inserts["invoices"][0]
    assert row["language"] == "de"
    assert row["head_text"] == "Aufenthalt 01.07.2026 – 04.07.2026 (3 Nächte), Zimmer 1"


def test_preview_returns_guest_language() -> None:
    reservation = _reservation(guest_language="it")
    db = _DB(_tables(reservations=[reservation], customers=[]))
    preview = preview_for_reservation(db, TENANT, "r1")
    assert preview["guestLanguage"] == "it"
