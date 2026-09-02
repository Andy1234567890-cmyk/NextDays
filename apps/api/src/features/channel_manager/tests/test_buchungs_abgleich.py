"""Selbstheilung Feed-Staging ↔ Reservierungen (`buchungs_abgleich`).

Geprueft wird, WELCHE Staging-Zeilen der Abgleich erneut projiziert und welche
er in Ruhe laesst — nicht die Projektion selbst (die hat ihre eigenen Tests).
"""
from __future__ import annotations

from typing import Any

from src.features.channel_manager.buchungs_abgleich import (
    BuchungsAbgleichMixin,
    _anreise_vorbei,
)

_TENANT = "a25577cf-c941-45c4-8d23-008887e631aa"


class _Query:
    def __init__(self, tabelle: str, rows: dict[str, list[dict[str, Any]]]) -> None:
        self._tabelle = tabelle
        self._rows = rows

    def __getattr__(self, name: str):
        if name.startswith("_"):
            raise AttributeError(name)
        return lambda *_a, **_k: self

    def execute(self):
        return type("R", (), {"data": self._rows.get(self._tabelle, [])})()


class _Db:
    def __init__(self, rows: dict[str, list[dict[str, Any]]]) -> None:
        self._rows = rows

    def table(self, name: str) -> _Query:
        return _Query(name, self._rows)


class _Dienst(BuchungsAbgleichMixin):
    def __init__(self, db: _Db) -> None:
        self._db = db
        self.projiziert: list[tuple[str, str | None, bool]] = []
        self.wirft_bei: set[str] = set()

    def _require_db(self) -> _Db:
        return self._db

    def _project_booking_to_reservation(  # noqa: PLR0913
        self, _db, _tenant, raw, guest_id=None, *, bestandsimport=False, **_k
    ) -> bool:
        code = str(raw.get("ota_reservation_code"))
        if code in self.wirft_bei:
            raise RuntimeError("Nachlauf kaputt")
        self.projiziert.append((code, guest_id, bestandsimport))
        return True


def _staging(code: str, cbid: str, status: str = "new", anreise: str = "2030-01-01") -> dict:
    return {
        "channex_booking_id": cbid,
        "ota_reservation_code": code,
        "status": status,
        "guest_id": f"g-{code}",
        "raw": {"booking_id": cbid, "ota_reservation_code": code, "arrival_date": anreise},
    }


def test_abgleich_heilt_genau_die_zwei_faelle() -> None:
    """CSV-ueberschrieben → zurueck; ohne Reservierung → projiziert; Rest in Ruhe."""
    db = _Db({
        "channex_booking": [
            _staging("A", "chx-a"),                       # korrekt projiziert
            _staging("B", "chx-b"),                       # von CSV ueberschrieben
            _staging("C", "chx-c"),                       # gar keine Reservierung
            _staging("D", "chx-d", status="cancelled"),   # Storno ohne Zeile: ok
            _staging("E", "chx-e"),                       # Airbnb-Historie traegt den Code
        ],
        "reservations": [
            {"id": "r-a", "source_channex_booking_id": "chx-a", "external_ref": "A"},
            {"id": "r-b", "source_channex_booking_id": "csv:B", "external_ref": "B"},
            {"id": "r-e", "source_channex_booking_id": "E", "external_ref": "E"},
        ],
    })
    dienst = _Dienst(db)

    res = dienst.feed_buchungen_abgleichen(_TENANT)

    assert [p[0] for p in dienst.projiziert] == ["B", "C"]
    assert res["csv_zurueckgeholt"] == 1
    assert res["fehlend_projiziert"] == 1
    assert res["fehler"] == []
    # Der Gast der Staging-Zeile geht mit — kein zweites Resolve.
    assert dienst.projiziert[0][1] == "g-B"


def test_eine_kaputte_zeile_kippt_den_lauf_nicht() -> None:
    db = _Db({
        "channex_booking": [_staging("B", "chx-b"), _staging("C", "chx-c")],
        "reservations": [
            {"id": "r-b", "source_channex_booking_id": "csv:B", "external_ref": "B"},
        ],
    })
    dienst = _Dienst(db)
    dienst.wirft_bei = {"B"}

    res = dienst.feed_buchungen_abgleichen(_TENANT)

    assert res["csv_zurueckgeholt"] == 0
    assert res["fehlend_projiziert"] == 1
    assert len(res["fehler"]) == 1 and res["fehler"][0].startswith("B:")


def test_vergangene_anreise_ist_bestand_kuenftige_ein_ereignis() -> None:
    """Nur fuer kuenftige Aufenthalte laeuft der volle Nachlauf (Glocke, Aufgaben)."""
    db = _Db({
        "channex_booking": [
            _staging("ALT", "chx-alt", anreise="2020-01-01"),
            _staging("NEU", "chx-neu", anreise="2030-01-01"),
        ],
        "reservations": [],
    })
    dienst = _Dienst(db)

    dienst.feed_buchungen_abgleichen(_TENANT)

    assert dict((p[0], p[2]) for p in dienst.projiziert) == {"ALT": True, "NEU": False}
    assert _anreise_vorbei({"arrival_date": "kaputt"}) is False
    assert _anreise_vorbei({}) is False


def test_worker_kennt_den_job_und_reiht_ihn_am_tagestick_ein() -> None:
    from pathlib import Path

    src = Path(__file__).resolve().parents[3]
    quelle = (src / "worker.py").read_text(encoding="utf-8")
    assert '"abgleich_feed_buchungen": feed_abgleich_tick.handle' in quelle
    assert "feed_abgleich_tick.einreihen(self._db, bucket)" in quelle
    # Kein Channex-Call → darf NICHT im Token-Budget stehen, sonst blockiert
    # ein erschoepftes Budget die reine DB-Heilung. Die einzige Nennung in
    # Anfuehrungszeichen ist die Registry.
    assert quelle.count('"abgleich_feed_buchungen"') == 1
    tick = (src / "jobs" / "feed_abgleich_tick.py").read_text(encoding="utf-8")
    assert 'dedup_key=f"feed_abgleich_tick:{tid}:{bucket}"' in tick
