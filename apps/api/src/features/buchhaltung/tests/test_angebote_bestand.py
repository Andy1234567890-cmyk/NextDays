"""Angebote in Bestandsform (`angebote_bestand.py`).

Zwei Client-Formen (Cent-Payload aus `quoteService.createQuote`, camelCase aus
dem Editor) müssen auf denselben Schreibpfad laufen und in der Form zurückkommen,
die `parseQuoteResponse`/Detailansicht lesen. Vorher: 404 auf der Liste, 422 auf
jedem Anlegen.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from types import SimpleNamespace

import pytest

from src.core.security import AuthContext
from src.features.buchhaltung.angebote_bestand import AngeboteBestand
from src.features.buchhaltung.service import BuchhaltungError, BuchhaltungService

TENANT = "t1"
_CTX = AuthContext(user_id="u", tenant_id=TENANT, role="admin")


class _Chain:
    """Supabase-Doppelgänger: filtert Zeilen, spiegelt Inserts, wendet Updates an."""

    def __init__(self, table: _Table) -> None:
        self._t = table
        self._eq: list[tuple[str, object]] = []
        self._in: list[tuple[str, list]] = []
        self._pred: list = []
        self._op: str | None = None
        self._payload: object = None

    def select(self, *_a: object, **_k: object) -> _Chain:
        return self

    def limit(self, *_a: object, **_k: object) -> _Chain:
        return self

    def order(self, *_a: object, **_k: object) -> _Chain:
        return self

    def is_(self, feld: str, wert: object) -> _Chain:
        # Nur "null"/"not null" werden gebraucht.
        self._pred.append(
            (lambda r, f=feld: r.get(f) is None) if wert == "null"
            else (lambda r, f=feld: r.get(f) is not None)
        )
        return self

    def eq(self, feld: str, wert: object) -> _Chain:
        self._eq.append((feld, wert))
        return self

    def neq(self, feld: str, wert: object) -> _Chain:
        self._pred.append(lambda r, f=feld, w=wert: r.get(f) != w)
        return self

    def ilike(self, feld: str, wert: object) -> _Chain:
        gesucht = str(wert).lower()
        self._pred.append(lambda r, f=feld, w=gesucht: str(r.get(f) or "").lower() == w)
        return self

    def in_(self, feld: str, werte: list) -> _Chain:
        self._in.append((feld, list(werte)))
        return self

    def insert(self, payload: object) -> _Chain:
        self._op, self._payload = "insert", payload
        return self

    def update(self, payload: dict) -> _Chain:
        self._op, self._payload = "update", payload
        return self

    def delete(self) -> _Chain:
        self._op = "delete"
        return self

    def _treffer(self) -> list[dict]:
        return [
            r
            for r in self._t.rows
            if all(r.get(f) == v for f, v in self._eq)
            and all(r.get(f) in v for f, v in self._in)
            and all(p(r) for p in self._pred)
        ]

    def execute(self) -> SimpleNamespace:
        if self._op == "insert":
            payloads = self._payload if isinstance(self._payload, list) else [self._payload]
            neu = []
            for i, p in enumerate(payloads):
                zeile = {**p, "id": p.get("id") or f"{self._t.name}-{len(self._t.rows) + i + 1}"}
                zeile.setdefault("created_at", "2026-09-13T08:00:00Z")
                zeile.setdefault("updated_at", "2026-09-13T08:00:00Z")
                self._t.rows.append(zeile)
                neu.append(zeile)
            self._t.inserts.extend(payloads)
            return SimpleNamespace(data=neu)
        if self._op == "update":
            treffer = self._treffer()
            for r in treffer:
                r.update(self._payload)  # type: ignore[arg-type]
            self._t.updates.append(dict(self._payload))  # type: ignore[arg-type]
            return SimpleNamespace(data=treffer)
        if self._op == "delete":
            treffer = self._treffer()
            self._t.rows[:] = [r for r in self._t.rows if r not in treffer]
            return SimpleNamespace(data=treffer)
        return SimpleNamespace(data=self._treffer())


class _Table:
    def __init__(self, name: str, rows: list[dict]) -> None:
        self.name = name
        self.rows = rows
        self.inserts: list = []
        self.updates: list[dict] = []


class _DB:
    def __init__(self, **tables: list[dict]) -> None:
        self.tables = {n: _Table(n, r) for n, r in tables.items()}
        self.rpc_calls: list[dict] = []

    def table(self, name: str) -> _Chain:
        return _Chain(self.tables.setdefault(name, _Table(name, [])))

    def rpc(self, name: str, params: dict) -> SimpleNamespace:
        assert name == "next_document_number"
        self.rpc_calls.append(params)
        n = len(self.rpc_calls)
        return SimpleNamespace(
            execute=lambda: SimpleNamespace(
                data=[{"sequential_number": n, "formatted_number": f"{params['p_prefix']}{n:04d}"}]
            )
        )


def _bestand(**tables: list[dict]) -> tuple[AngeboteBestand, _DB]:
    tables.setdefault("tenant_billing_profile", [])
    db = _DB(
        tenants=[{"id": TENANT, "currency": "DKK"}],
        customers=[
            {
                "id": "k1", "tenant_id": TENANT, "name": "Hansen ApS",
                "email": "hansen@example.dk", "customer_number": "KD-0001",
                "address": {"street": "Havnegade 1", "postalCode": "6700", "city": "Esbjerg"},
                "deleted_at": None,
            },
            {"id": "fremd", "tenant_id": "t2", "name": "Fremd", "deleted_at": None},
        ],
        quotes=[],
        quote_line_items=[],
        **tables,
    )
    svc = BuchhaltungService(service_client=db)  # type: ignore[arg-type]
    return AngeboteBestand(svc), db


_CENT_PAYLOAD = {
    "customer_id": "k1",
    "quote_date": "2026-09-13",
    "valid_until": "2026-10-13",
    "tax_rate": "25",
    "notes": "Danke",
    "internal_notes": "Fußzeile",
    "items": [
        {"position": 1, "description": "Reinigung", "quantity": "2",
         "unit": "Std", "unit_price_cents": 1250, "tax_rate": "25"},
    ],
}

_EDITOR_PAYLOAD = {
    "customerName": "Hansen ApS",
    "invoiceDate": "2026-09-13",
    "validUntil": "2026-10-13",
    "title": "Sommerreinigung",
    "customerOrderNumber": "PO-77",
    "headTextHtml": "<p>Hallo</p>",
    "footerText": "Fuß",
    "notes": "",
    "currency": "DKK",
    "taxRule": "DE_TAXABLE",
    "template": "TEMPLATE_NEUTRAL",
    "color": "#14ad9f",
    "items": [
        {"description": "Reinigung", "quantity": 2, "unitPrice": 12.5,
         "taxRate": 25, "unit": "Std"},
        {"description": "", "quantity": 1, "unitPrice": 0, "taxRate": 25},
    ],
}


def test_cent_payload_laeuft_ueber_create_quote() -> None:
    b, db = _bestand()
    out = b.anlegen(_CTX, _CENT_PAYLOAD)
    assert db.rpc_calls[0]["p_doc_type"] == "quote"
    assert out["quote_number"] == "AN-0001"
    assert out["customer_name"] == "Hansen ApS"
    assert out["customer_address"] == "Havnegade 1\n6700 Esbjerg"
    assert out["internal_notes"] == "Fußzeile"
    pos = out["items"][0]
    assert pos["unit_price_cents"] == 1250
    assert pos["total_cents"] == 2500
    # 2 × 12,50 netto, 25 % → 6,25 Steuer, 31,25 brutto
    assert out["subtotal_cents"] == 2500
    assert out["tax_cents"] == 625
    assert out["total_cents"] == 3125
    assert out["currency"] == "DKK"


def test_editor_payload_loest_kunden_per_name_und_speichert_bestandsfelder() -> None:
    b, db = _bestand()
    out = b.anlegen(_CTX, _EDITOR_PAYLOAD)
    zeile = db.tables["quotes"].rows[0]
    assert zeile["customer_id"] == "k1"
    assert zeile["head_text"] == "<p>Hallo</p>"
    assert zeile["footer_text"] == "Fuß"
    assert zeile["title"] == "Sommerreinigung"
    assert zeile["customer_order_number"] == "PO-77"
    assert zeile["design"] == {"template": "TEMPLATE_NEUTRAL", "color": "#14ad9f"}
    # Die leere Editor-Zeile ist keine Position.
    assert len(out["items"]) == 1
    assert out["template"] == "TEMPLATE_NEUTRAL"
    assert out["title"] == "Sommerreinigung"


def test_fehlender_steuersatz_422_ohne_nummer_zu_verbrennen() -> None:
    b, db = _bestand()
    payload = {
        **_CENT_PAYLOAD,
        "items": [{"description": "X", "quantity": "1", "unit_price_cents": 100}],
    }
    with pytest.raises(BuchhaltungError) as exc:
        b.anlegen(_CTX, payload)
    assert exc.value.status_code == 422
    assert db.rpc_calls == []


def test_fremder_kunde_404() -> None:
    b, db = _bestand()
    with pytest.raises(BuchhaltungError) as exc:
        b.anlegen(_CTX, {**_CENT_PAYLOAD, "customer_id": "fremd"})
    assert exc.value.status_code == 404
    assert db.rpc_calls == []


def test_status_sent_setzt_sent_at_nur_einmal() -> None:
    b, _db = _bestand()
    q = b.anlegen(_CTX, _CENT_PAYLOAD)
    out = b.aendern(_CTX, q["id"], {"status": "sent", "skontoEnabled": False})
    assert out["status"] == "sent"
    erster = out["sent_at"]
    assert erster
    out2 = b.aendern(_CTX, q["id"], {"status": "sent", "sentAt": "2020-01-01T00:00:00Z"})
    assert out2["sent_at"] == erster


def test_angenommen_friert_inhalt_ein_erlaubt_tags_und_vorlage() -> None:
    b, _db = _bestand()
    q = b.anlegen(_CTX, _CENT_PAYLOAD)
    b.aendern(_CTX, q["id"], {"status": "accepted"})
    with pytest.raises(BuchhaltungError) as exc:
        b.aendern(_CTX, q["id"], {"notes": "neu"})
    assert exc.value.status_code == 409
    out = b.aendern(
        _CTX, q["id"], {"tags": ["Sommer", "Sommer", " VIP "], "templateId": "TEMPLATE_MODERN"}
    )
    assert out["tags"] == ["Sommer", "VIP"]
    assert out["template"] == "TEMPLATE_MODERN"
    assert out["accepted_at"]


def test_umgewandeltes_angebot_ist_gesperrt() -> None:
    b, db = _bestand()
    q = b.anlegen(_CTX, _CENT_PAYLOAD)
    db.tables["quotes"].rows[0]["converted_invoice_id"] = "inv-1"
    with pytest.raises(BuchhaltungError) as exc:
        b.aendern(_CTX, q["id"], {"status": "cancelled"})
    assert exc.value.status_code == 409


def test_unbekannter_status_422() -> None:
    b, _db = _bestand()
    q = b.anlegen(_CTX, _CENT_PAYLOAD)
    with pytest.raises(BuchhaltungError) as exc:
        b.aendern(_CTX, q["id"], {"status": "converted"})
    assert exc.value.status_code == 422


def test_liste_traegt_kundennamen_und_filtert_status() -> None:
    b, _db = _bestand()
    b.anlegen(_CTX, _CENT_PAYLOAD)
    b.anlegen(_CTX, {**_CENT_PAYLOAD, "status": "sent"})
    alle = b.liste(_CTX)
    assert len(alle) == 2
    assert {q["customer_name"] for q in alle} == {"Hansen ApS"}
    nur_sent = b.liste(_CTX, "sent")
    assert len(nur_sent) == 1
    assert nur_sent[0]["sent_at"]
    with pytest.raises(BuchhaltungError) as exc:
        b.liste(_CTX, "kaputt")
    assert exc.value.status_code == 422


def test_positionen_aendern_rechnet_summen_neu() -> None:
    b, _db = _bestand()
    q = b.anlegen(_CTX, _CENT_PAYLOAD)
    out = b.aendern(_CTX, q["id"], {"items": [
        {"description": "Neu", "quantity": 1, "unitPrice": 100, "taxRate": 25},
    ]})
    assert out["subtotal_cents"] == 10000
    assert out["tax_cents"] == 2500
    assert out["total_cents"] == 12500
    assert len(out["items"]) == 1


def test_fremdes_angebot_404() -> None:
    b, db = _bestand()
    db.tables["quotes"].rows.append({"id": "q-fremd", "tenant_id": "t2", "status": "draft"})
    with pytest.raises(BuchhaltungError) as exc:
        b.einzeln(_CTX, "q-fremd")
    assert exc.value.status_code == 404


# --- Abrechnungsbasis + Kopfdaten (0698) -------------------------------------

def test_basis_und_kopfdaten_werden_gespeichert() -> None:
    b, db = _bestand()
    payload = {
        **_EDITOR_PAYLOAD,
        "stayFrom": "2026-07-01",
        "stayTo": "2026-07-04",
        "guestCount": 2,
        "items": [
            {"description": "Übernachtung", "quantity": 3, "unitPrice": 120,
             "taxRate": 25, "unit": "Nacht", "basis": "per_night"},
            {"description": "Kurtaxe", "quantity": 6, "unitPrice": 2.5,
             "taxRate": 0, "unit": "Person × Nacht", "basis": "per_guest_night"},
        ],
    }
    out = b.anlegen(_CTX, payload)
    zeile = db.tables["quotes"].rows[0]
    assert zeile["stay_from"] == "2026-07-01"
    assert zeile["stay_to"] == "2026-07-04"
    assert zeile["guest_count"] == 2
    assert [p["basis"] for p in out["items"]] == ["per_night", "per_guest_night"]
    assert out["stay_from"] == "2026-07-01"
    assert out["guest_count"] == 2
    # 3 × 120 + 6 × 2,50 = 375 netto; Steuer nur auf die Übernachtung (25 %)
    assert out["subtotal_cents"] == 37500
    assert out["tax_cents"] == 9000


def test_unbekannte_basis_422() -> None:
    b, db = _bestand()
    payload = {**_CENT_PAYLOAD, "items": [
        {"description": "X", "quantity": "1", "unit_price_cents": 100, "tax_rate": "25",
         "basis": "per_moon"},
    ]}
    with pytest.raises(BuchhaltungError) as exc:
        b.anlegen(_CTX, payload)
    assert exc.value.status_code == 422
    assert db.rpc_calls == []


# --- Preisliste (Artikelstamm + Zusatzleistungen) ----------------------------

def test_preisliste_fuehrt_artikel_und_zusatzleistungen_zusammen() -> None:
    from src.features.buchhaltung.preisliste import preisliste

    _b, db = _bestand(
        billing_items=[
            {"id": "a1", "tenant_id": TENANT, "name": "Endreinigung", "description": "",
             "unit": "pauschal", "basis": "per_stay", "unit_price": "80.00", "tax_rate": "25.00",
             "currency": "DKK", "category": "Service", "is_active": True, "is_favorite": True,
             "usage_count": 3},
            {"id": "a2", "tenant_id": TENANT, "name": "Alt", "unit": "Stk", "unit_price": "1",
             "tax_rate": "25", "currency": "DKK", "is_active": False, "is_favorite": False},
            {"id": "fremd", "tenant_id": "t2", "name": "Fremd", "unit": "Stk", "unit_price": "1",
             "tax_rate": "25", "currency": "EUR", "is_active": True, "is_favorite": False},
        ],
        properties=[{"id": "p1", "tenant_id": TENANT, "title": "Strandhus", "currency": "DKK"},
                    {"id": "p9", "tenant_id": "t2", "title": "Fremd", "currency": "EUR"}],
        property_pricing_config=[{
            "property_id": "p1", "currency": "DKK",
            "fees": [
                {"id": "f1", "name": "Endreinigung", "names": {"en": "Final cleaning"},
                 "amount": 60, "mode": "amount", "basis": "per_stay", "taxRate": 25,
                 "feeType": "cleaning"},
                {"id": "f2", "name": "Servicegebühr", "amount": 3, "mode": "percent",
                 "basis": "per_stay", "optional": True},
                {"id": "f3", "name": "Old fee", "amount": 5, "mode": "amount",
                 "basis": "per_stay", "validUntil": "2020-01-01"},
            ],
            "taxes": [
                {"id": "t1", "kind": "vat", "name": "USt", "mode": "percent", "value": 25,
                 "includedInPrice": True},
                {"id": "t2", "kind": "local", "name": "Kurtaxe", "names": {"en": "Tourist tax"},
                 "mode": "amount", "value": 2.5, "chargeBasis": "PerPerson", "period": "PerNight",
                 "includedInPrice": False},
            ],
        }],
        property_addons=[
            {"id": "z1", "property_id": "p1", "name": {"de": "Frühstück", "en": "Breakfast"},
             "description": {}, "price": 12.5, "basis": "per_guest", "tax_rate": None,
             "active": True, "sort_order": 1},
            {"id": "z9", "property_id": "p9", "name": {"de": "Fremd"}, "price": 1,
             "basis": "per_stay", "active": True, "sort_order": 1},
        ],
    )
    out = preisliste(db, TENANT, sprache="en")  # type: ignore[arg-type]
    assert [o["id"] for o in out["objekte"]] == ["p1"]
    liste = out["eintraege"]
    # Reihenfolge wie Hostaway: Gebühren, Zusatzleistungen, Abgaben, dann Artikel.
    assert [e["quelle"] for e in liste] == [
        "gebuehr", "gebuehr", "zusatzleistung", "abgabe", "artikel",
    ]
    reinigung, prozent, zusatz, kurtaxe, artikel = liste
    assert reinigung["name"] == "Final cleaning" and reinigung["basis"] == "per_stay"
    assert reinigung["unitPrice"] == "60.00" and reinigung["taxRate"] == "25.00"
    assert reinigung["optional"] is False
    # Prozent-Gebühr: kein Betrag, sondern Prozent — der Editor rechnet aus den Übernachtungszeilen.
    assert prozent["unitPrice"] is None and prozent["percent"] == "3.00"
    # Gäste-Basis des Objekts wird zur Positionsbasis „je Person" übersetzt.
    assert zusatz["quelle"] == "zusatzleistung" and zusatz["name"] == "Breakfast"
    assert zusatz["basis"] == "per_guest" and zusatz["taxRate"] is None
    assert zusatz["propertyTitle"] == "Strandhus" and zusatz["currency"] == "DKK"
    # Kurtaxe: Betrag je Gast und Nacht, 0 % USt (durchlaufender Posten).
    assert kurtaxe["name"] == "Tourist tax" and kurtaxe["basis"] == "per_guest_night"
    assert kurtaxe["unitPrice"] == "2.50" and kurtaxe["taxRate"] == "0.00"
    assert artikel["quelle"] == "artikel" and artikel["basis"] == "per_stay"
    assert artikel["unitPrice"] == "80.00" and artikel["taxRate"] == "25.00"
    # Abgelaufene Gebühr und USt-Eintrag (im Preis enthalten) fehlen bewusst.
    assert all(e["name"] != "Old fee" for e in liste)


def test_preisliste_filtert_auf_ein_objekt() -> None:
    from src.features.buchhaltung.preisliste import preisliste

    _b, db = _bestand(
        properties=[{"id": "p1", "tenant_id": TENANT, "title": "A", "currency": "DKK"},
                    {"id": "p2", "tenant_id": TENANT, "title": "B", "currency": "DKK"}],
        property_addons=[
            {"id": "z1", "property_id": "p1", "name": {"de": "A-Extra"}, "price": 1,
             "basis": "per_stay", "active": True, "sort_order": 1},
            {"id": "z2", "property_id": "p2", "name": {"de": "B-Extra"}, "price": 1,
             "basis": "per_stay", "active": True, "sort_order": 1},
        ],
    )
    out = preisliste(db, TENANT, property_id="p2")  # type: ignore[arg-type]
    assert [o["id"] for o in out["objekte"]] == ["p1", "p2"]
    assert [e["name"] for e in out["eintraege"]] == ["B-Extra"]


# --- Brücke Kalender-Angebot → Buchhaltungs-Angebot (0699) --------------------

_OFFER = {
    "id": "o1", "tenant_id": TENANT, "property_id": "p1", "status": "draft",
    "check_in": "2026-07-01", "check_out": "2026-07-04", "adults": 2, "children": 1,
    "guest_name": "Lise Hansen", "guest_email": "lise@example.dk", "guest_phone": None,
    "language": "da", "currency": "DKK", "total_amount": 3000.0,
    "expires_at": "2026-06-20T10:00:00+00:00",
    "quote_snapshot": {"lines": [
        {"label": "Ophold 3 nætter", "amount": 2700.0, "kind": "stay"},
        {"label": "Slutrengøring", "amount": 250.0, "kind": "fee"},
        {"label": "Turistskat", "amount": 50.0, "kind": "tax"},
    ]},
    "internal_note": "Stammgast",
}


def _bruecke_db(*, modul: bool = True, text_templates: list[dict] | None = None) -> _DB:
    _b, db = _bestand(
        text_templates=text_templates or [],
        tenant_module_entitlement=(
            [{"tenant_id": TENANT, "module_key": "modul3_buchhaltung", "active": True}]
            if modul else []
        ),
        properties=[{"id": "p1", "tenant_id": TENANT, "title": "Strandhus", "currency": "DKK"}],
        property_pricing_config=[{"property_id": "p1", "taxes": [
            {"kind": "vat", "mode": "percent", "value": 25, "includedInPrice": True},
        ]}],
        tenant_billing_profile=[{"tenant_id": TENANT, "is_kleinunternehmer": False,
                                 "lodging_tax_rate": None}],
    )
    return db


def test_bruecke_ohne_modul_spiegelt_nicht() -> None:
    from src.features.buchhaltung.angebot_bruecke import spiegel_anlegen

    db = _bruecke_db(modul=False)
    assert spiegel_anlegen(db, _CTX, _OFFER, "Strandhus") is None  # type: ignore[arg-type]
    assert db.tables["quotes"].rows == []
    assert db.rpc_calls == []


def test_bruecke_legt_angebot_mit_debitor_und_positionen_an() -> None:
    from src.features.buchhaltung.angebot_bruecke import spiegel_anlegen

    db = _bruecke_db()
    quote_id = spiegel_anlegen(db, _CTX, _OFFER, "Strandhus")  # type: ignore[arg-type]
    assert quote_id
    q = db.tables["quotes"].rows[0]
    assert q["booking_offer_id"] == "o1"
    assert q["quote_number"].startswith("AN-")
    assert q["stay_from"] == "2026-07-01" and q["guest_count"] == 3
    assert q["valid_until"] == "2026-06-20"
    # Debitor per E-Mail neu angelegt (es gab ihn noch nicht)
    kunde = next(k for k in db.tables["customers"].rows if k.get("email") == "lise@example.dk")
    assert q["customer_id"] == kunde["id"]
    # Positionen: Übernachtung 25 %, Reinigung 25 %, Kurtaxe 0 % — Brutto bleibt 3000
    zeilen = db.tables["quote_line_items"].rows
    assert [Decimal(z["tax_rate"]) for z in zeilen] == [Decimal(25), Decimal(25), Decimal(0)]
    assert sum(Decimal(z["gross_amount"]) for z in zeilen) == Decimal("3000.00")
    # Zweiter Aufruf (Retry) legt keinen zweiten Spiegel an
    assert spiegel_anlegen(db, _CTX, _OFFER, "Strandhus") == quote_id  # type: ignore[arg-type]
    assert len(db.tables["quotes"].rows) == 1


def test_bruecke_zieht_status_nach() -> None:
    from src.features.buchhaltung.angebot_bruecke import spiegel_anlegen, spiegel_status

    db = _bruecke_db()
    spiegel_anlegen(db, _CTX, _OFFER, "Strandhus")  # type: ignore[arg-type]
    spiegel_status(db, {**_OFFER, "status": "sent"})  # type: ignore[arg-type]
    q = db.tables["quotes"].rows[0]
    assert q["status"] == "sent" and q["sent_at"]
    spiegel_status(db, {**_OFFER, "status": "declined"})  # type: ignore[arg-type]
    assert q["status"] == "rejected" and q["rejected_at"]
    # Umgewandelter Spiegel bleibt unberührt
    q["converted_invoice_id"] = "inv-1"
    spiegel_status(db, {**_OFFER, "status": "cancelled"})  # type: ignore[arg-type]
    assert q["status"] == "rejected"


def test_bruecke_zieht_inhalt_nach() -> None:
    from src.features.buchhaltung.angebot_bruecke import spiegel_aktualisieren, spiegel_anlegen

    db = _bruecke_db()
    quote_id = spiegel_anlegen(db, _CTX, _OFFER, "Strandhus")  # type: ignore[arg-type]
    geaendert = {
        **_OFFER, "quote_id": quote_id, "check_out": "2026-07-05", "adults": 3,
        "expires_at": "2026-06-25T10:00:00+00:00", "internal_note": "Neu",
        "quote_snapshot": {"lines": [
            {"label": "Ophold 4 nætter", "amount": 3600.0, "kind": "stay"},
        ]},
        "total_amount": 3600.0,
    }
    spiegel_aktualisieren(db, _CTX, geaendert, "Strandhus")  # type: ignore[arg-type]
    q = db.tables["quotes"].rows[0]
    assert q["stay_to"] == "2026-07-05" and q["guest_count"] == 4
    assert q["valid_until"] == "2026-06-25" and q["notes"] == "Neu"
    zeilen = [z for z in db.tables["quote_line_items"].rows if z["quote_id"] == quote_id]
    assert len(zeilen) == 1
    assert Decimal(zeilen[0]["gross_amount"]) == Decimal("3600.00")
    assert zeilen[0]["basis"] == "per_night" and Decimal(zeilen[0]["quantity"]) == 4
    # Angenommener Spiegel ist eingefroren: kein Fehler, keine Änderung
    q["status"] = "accepted"
    spiegel_aktualisieren(db, _CTX, {**geaendert, "internal_note": "Noch neuer"}, "Strandhus")  # type: ignore[arg-type]
    assert q["notes"] == "Neu"


def test_bruecke_setzt_sprache_betreff_und_texte() -> None:
    from src.features.buchhaltung.angebot_bruecke import spiegel_anlegen

    db = _bruecke_db()
    spiegel_anlegen(db, _CTX, {**_OFFER, "deposit_amount": 1000.0}, "Strandhus")  # type: ignore[arg-type]
    q = db.tables["quotes"].rows[0]
    assert q["language"] == "da"
    assert q["title"].startswith("Tilbud: ophold i Strandhus")
    assert "Kære Lise Hansen" in q["head_text"]
    assert "3 " in q["head_text"] and "Strandhus" in q["head_text"]
    assert "forudbetaling" in q["footer_text"] and "[%" not in q["footer_text"]


def test_bruecke_nimmt_textvorlage_des_betriebs() -> None:
    from src.features.buchhaltung.angebot_bruecke import spiegel_anlegen

    db = _bruecke_db(text_templates=[{
        "tenant_id": TENANT, "category": "DOCUMENT", "object_type": "QUOTE",
        "text_type": "HEAD", "is_default": True, "is_private": False, "language": None,
        "text": "Hej [%KUNDENNAME%] — [%OBJEKT%] [%ANREISE%]",
    }])
    spiegel_anlegen(db, _CTX, _OFFER, "Strandhus")  # type: ignore[arg-type]
    q = db.tables["quotes"].rows[0]
    assert q["head_text"].startswith("Hej Lise Hansen — Strandhus ")


def test_editor_aenderung_fliesst_ins_kalender_angebot() -> None:
    from src.features.buchhaltung.angebot_bruecke import spiegel_anlegen

    db = _bruecke_db()
    db.table("booking_offers")  # Tabelle anlegen
    db.tables["booking_offers"].rows.append({**_OFFER})
    quote_id = spiegel_anlegen(db, _CTX, _OFFER, "Strandhus")  # type: ignore[arg-type]
    bestand = AngeboteBestand(BuchhaltungService(service_client=db))  # type: ignore[arg-type]
    bestand.aendern(_CTX, str(quote_id), {
        "stayFrom": "2026-07-01", "stayTo": "2026-07-06", "guestCount": 4,
        "validUntil": "2026-06-28",
        "items": [
            {"description": "Ophold 5 nætter", "quantity": "5", "unit": "nat",
             "unitPrice": "800", "taxRate": "25", "basis": "per_night"},
            {"description": "Turistskat", "quantity": "1", "unitPrice": "60", "taxRate": "0"},
        ],
    })
    offer = db.tables["booking_offers"].rows[0]
    assert offer["check_in"] == "2026-07-01" and offer["check_out"] == "2026-07-06"
    assert offer["adults"] == 3  # 4 Gäste − 1 Kind
    assert offer["expires_at"].startswith("2026-06-28")
    assert offer["total_amount"] == 5060.0
    kinds = [ln["kind"] for ln in offer["quote_snapshot"]["lines"]]
    assert kinds == ["lodging", "tax"]
    assert offer["quote_snapshot"]["total"] == 5060.0
    # Angenommenes Angebot bleibt unberührt
    offer["status"] = "accepted"
    bestand.aendern(_CTX, str(quote_id), {"guestCount": 2})
    assert offer["adults"] == 3


def test_aufenthalt_kontext_liefert_objekt_zeiten_plan_und_storno() -> None:
    from src.features.buchhaltung.aufenthalt_kontext import aufenthalt_kontext

    objekt = {
        "id": "p1", "tenant_id": TENANT, "title": "Strandhus", "city": "Blåvand",
        "street": "Strandvej", "house_number": "9", "postal_code": "6857", "country": "DK",
        "type_attributes": {"policies": {"checkInTime": "15:00", "checkOutTime": "10:00"}},
    }
    fotos = [
        {"property_id": "p1", "url": "https://x/a.jpg", "is_cover": False, "sort_order": 2},
        {"property_id": "p1", "url": "https://x/cover.jpg", "is_cover": True, "sort_order": 5},
    ]
    kondition = {
        "id": "bc1", "tenant_id": TENANT, "is_default": True, "installments": 2,
        "first_payment_percent": 30, "balance_days_before_arrival": 14,
        "cancellation_mode": "partial",
    }
    staffel = [
        {"condition_id": "bc1", "days_before_arrival": 30, "refund_percent": 100},
        {"condition_id": "bc1", "days_before_arrival": 7, "refund_percent": 50},
    ]
    _b, db = _bestand(
        properties=[objekt],
        property_photos=fotos,
        booking_conditions=[kondition],
        booking_condition_refund_rules=staffel,
        content_assignments=[{"block_id": "b1", "property_id": "p1"}],
        content_blocks=[{"id": "b1", "tenant_id": TENANT, "kind": "house_rules",
                         "body_i18n": {"de": "Keine Partys.", "en": "No parties."}}],
    )
    anreise = date(2026, 7, 1)
    k = aufenthalt_kontext(db, TENANT, "p1", lang="en", total=1000, check_in=anreise)  # type: ignore[arg-type]
    assert k and k["title"] == "Strandhus" and k["cover_url"] == "https://x/cover.jpg"
    assert k["check_in_time"] == "15:00" and k["address"] == "Strandvej 9"
    assert k["house_rules"] == "No parties."
    assert k["payment_plan"] == {
        "due_now": 300.0, "due_later": 700.0, "balance_due_date": "2026-06-17",
    }
    assert k["cancellation"]["mode"] == "partial"
    assert [r["days_before_arrival"] for r in k["cancellation"]["rules"]] == [30, 7]
    # Anzahlung am Angebot gewinnt gegen den Plan der Kondition
    k2 = aufenthalt_kontext(
        db, TENANT, "p1", lang="en", total=1000, check_in=anreise, deposit=400,  # type: ignore[arg-type]
    )
    assert k2 and k2["payment_plan"]["due_now"] == 400.0
    assert k2["payment_plan"]["due_later"] == 600.0
    assert aufenthalt_kontext(db, TENANT, None, lang="en", total=1, check_in=None) is None  # type: ignore[arg-type]


def test_bruecke_traegt_objekt_und_anzahlung_in_den_spiegel() -> None:
    from src.features.buchhaltung.angebot_bruecke import spiegel_anlegen

    db = _bruecke_db()
    spiegel_anlegen(db, _CTX, {**_OFFER, "deposit_amount": 1000.0}, "Strandhus")  # type: ignore[arg-type]
    q = db.tables["quotes"].rows[0]
    assert q["property_id"] == "p1" and Decimal(q["deposit_amount"]) == Decimal("1000.00")
