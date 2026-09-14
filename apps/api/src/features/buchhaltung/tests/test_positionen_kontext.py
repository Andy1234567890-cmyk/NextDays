"""Objekt, Zeitraum und Elternzeile einer Beleg-Position (0702).

Drei Dinge, die kein bestehender Test abdeckte und die live still danebengehen
würden: ein verdrehter Zeitraum (Abreise ≤ Anreise), ein Objekt aus einem
FREMDEN Mandanten (die Service-Role umgeht RLS, Wurzel 3) und der Storno, der
die Zeilen kopiert und dabei die Zuordnung „Zusatzleistung → Übernachtung" auf
seine eigenen Zeilen umhängen muss.
"""

from __future__ import annotations

from collections import deque

import pytest

from src.features.buchhaltung.positionen_kontext import eltern_positionen
from src.features.buchhaltung.service import BuchhaltungError
from src.features.buchhaltung.storno import create_storno_invoice

from .test_angebote_bestand import _CTX, TENANT, _bestand
from .test_storno import _ORIGINAL, _service

_OBJEKTE = [
    {"id": "p1", "tenant_id": TENANT, "title": "Strandhaus"},
    {"id": "fremd", "tenant_id": "t2", "title": "Fremdes Haus"},
]


def _payload(**zeile: object) -> dict:
    return {
        "customerName": "Hansen ApS",
        "invoiceDate": "2026-09-13",
        "validUntil": "2026-10-13",
        "currency": "DKK",
        "items": [
            {
                "id": "c-1",
                "description": "Übernachtung",
                "quantity": 4,
                "unitPrice": 100,
                "taxRate": 25,
                "basis": "per_night",
                **zeile,
            }
        ],
    }


def test_verdrehter_zeitraum_422_ohne_nummer_zu_verbrennen() -> None:
    b, db = _bestand(properties=_OBJEKTE)
    with pytest.raises(BuchhaltungError) as exc:
        b.anlegen(_CTX, _payload(checkIn="2026-10-07", checkOut="2026-10-03"))
    assert exc.value.status_code == 422
    assert db.rpc_calls == []


def test_fremdes_objekt_404_ohne_nummer_zu_verbrennen() -> None:
    b, db = _bestand(properties=_OBJEKTE)
    with pytest.raises(BuchhaltungError) as exc:
        b.anlegen(_CTX, _payload(propertyId="fremd", checkIn="2026-10-03", checkOut="2026-10-07"))
    assert exc.value.status_code == 404
    assert db.rpc_calls == []


def test_eigenes_objekt_und_zeitraum_landen_an_der_zeile() -> None:
    b, db = _bestand(properties=_OBJEKTE)
    out = b.anlegen(_CTX, _payload(propertyId="p1", checkIn="2026-10-03", checkOut="2026-10-07"))
    zeile = db.tables["quote_line_items"].rows[0]
    assert zeile["property_id"] == "p1"
    assert zeile["check_in"] == "2026-10-03"
    assert zeile["check_out"] == "2026-10-07"
    # Titel für die Ausgabe („Objekt · Anreise – Abreise") wird aufgelöst.
    assert out["items"][0]["property_title"] == "Strandhaus"


def test_zusatzleistung_haengt_an_ihrer_uebernachtung() -> None:
    b, db = _bestand(properties=_OBJEKTE)
    payload = _payload(propertyId="p1", checkIn="2026-10-03", checkOut="2026-10-07")
    payload["items"].append({
        "id": "c-2",
        "parentItemId": "c-1",
        "description": "Frühstück",
        "quantity": 4,
        "unitPrice": 12,
        "taxRate": 25,
        "basis": "per_night",
    })
    b.anlegen(_CTX, payload)
    zeilen = db.tables["quote_line_items"].rows
    assert zeilen[1]["parent_line_id"] == zeilen[0]["id"]
    # Die Übernachtung selbst hängt an nichts.
    assert not zeilen[0].get("parent_line_id")


def test_eltern_positionen_verwirft_unaufloesbare_eltern() -> None:
    """Wurde die Übernachtung gelöscht, bleibt die Zusatzleistung eigenständig —
    statt auf eine Zeile zu zeigen, die nicht mitgeschickt wurde."""
    assert eltern_positionen([("a", None), ("b", "a")]) == [(2, 1)]
    assert eltern_positionen([("b", "weg")]) == []
    # Selbstbezug ist kein Elternteil.
    assert eltern_positionen([("a", "a")]) == []


_STORNO_ZEILEN = [
    {
        "id": "l1", "position": 1, "description": "Übernachtung", "quantity": 4,
        "unit": "Nacht", "basis": "per_night", "unit_price": 100, "tax_rate": 7,
        "discount_percent": 0, "net_amount": 400, "tax_amount": 28, "gross_amount": 428,
        "property_id": "p1", "check_in": "2026-10-03", "check_out": "2026-10-07",
        "parent_line_id": None,
    },
    {
        "id": "l2", "position": 2, "description": "Frühstück", "quantity": 4,
        "unit": "Nacht", "basis": "per_night", "unit_price": 12, "tax_rate": 7,
        "discount_percent": 0, "net_amount": 48, "tax_amount": 3.36, "gross_amount": 51.36,
        "property_id": None, "check_in": None, "check_out": None,
        "parent_line_id": "l1",
    },
]


def test_storno_kopiert_objekt_zeitraum_und_haengt_die_zuordnung_um() -> None:
    storno_row = {"id": "s9", "invoice_number": "ST-0003", "invoice_type": "storno"}
    # Reihenfolge der Abfragen wie in test_storno: Original → kein bestehender
    # Storno → eingefügter Kopf → Antwort; Zeilen: Original → Kopien.
    _, db = _service({
        "invoices": deque([[_ORIGINAL], [], [storno_row], [storno_row]]),
        # Abfragefolge: Original-Zeilen → Insert-Antwort → Rücklesen mit den
        # NEUEN Zeilen-IDs je Position (jedes execute() zieht einen Eintrag).
        "invoice_line_items": deque([
            _STORNO_ZEILEN,
            [],
            [{"id": "n1", "position": 1}, {"id": "n2", "position": 2}],
        ]),
        "customers": [],
    })
    create_storno_invoice(db, TENANT, "i1", "Falscher Betrag")  # type: ignore[arg-type]
    kopien = db.inserts["invoice_line_items"][0]
    assert kopien[0]["property_id"] == "p1"
    assert kopien[0]["check_in"] == "2026-10-03"
    assert kopien[0]["check_out"] == "2026-10-07"
    assert kopien[0]["basis"] == "per_night"
    # Die kopierte Zeile darf NICHT auf eine Zeile des Originals zeigen.
    assert "parent_line_id" not in kopien[1]
    # Stattdessen wird sie nach dem Insert über die Position umgehängt.
    assert "update" in db.calls["invoice_line_items"]
