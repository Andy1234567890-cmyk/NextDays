"""Selbstheilung Feed-Staging ↔ Reservierungen (`buchungs_abgleich`).

Geprueft wird, WELCHE Staging-Zeilen der Abgleich erneut projiziert und welche
er in Ruhe laesst — nicht die Projektion selbst (die hat ihre eigenen Tests).
"""
from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from src.features.channel_manager.buchungs_abgleich import (
    BESTAND_AB_STUNDEN,
    BuchungsAbgleichMixin,
    _bestand,
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


def _staging(
    code: str,
    cbid: str,
    status: str = "new",
    anreise: str = "2030-01-01",
    booked_at: str | None = None,
) -> dict:
    """Eine Staging-Zeile. `booked_at` ist der QUELL-Buchungszeitpunkt.

    Vorgabe ist ein alter Wert: dieser Job findet per Definition Altbestand,
    und ohne echten Buchungszeitpunkt gilt eine Zeile ohnehin als Bestand
    (fail-closed, siehe `_bestand`).
    """
    return {
        "channex_booking_id": cbid,
        "ota_reservation_code": code,
        "status": status,
        "guest_id": f"g-{code}",
        "raw": {
            "booking_id": cbid,
            "ota_reservation_code": code,
            "arrival_date": anreise,
            "booked_at": booked_at or "2020-01-01T10:00:00Z",
        },
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


def test_bestand_haengt_am_buchungszeitpunkt_nicht_an_der_anreise() -> None:
    """Was der Gast LANGE gebucht hat, ist Bestand — auch bei kuenftiger Anreise.

    DER FEHLER, DEN DAS ABSICHERT (live gemeldet 09.09.2026): Die
    Vorgaenger-Fassung fragte `arrival_date < heute`. Eine im Vorjahr gebuchte
    Reise mit Anreise 2030 galt damit als frisches Ereignis und meldete bei
    JEDEM Tageslauf „Neue Buchung" an Eigentuemer und Betriebsleitung, plus
    Mail. Genau dieses Muster stand in der Glocke: ausschliesslich kuenftige
    Anreisen, weil vergangene korrekt unterdrueckt wurden.
    """
    db = _Db({
        "channex_booking": [
            # Kuenftige Anreise, aber vor Jahren gebucht → Bestand.
            _staging(
                "ALTGEBUCHT", "chx-alt",
                anreise="2030-01-01", booked_at="2020-01-01T10:00:00Z",
            ),
            # Vergangene Anreise, aber gerade gebucht → Ereignis.
            _staging(
                "FRISCH", "chx-neu",
                anreise="2020-01-01",
                booked_at=datetime.now(UTC).isoformat(),
            ),
        ],
        "reservations": [],
    })
    dienst = _Dienst(db)

    dienst.feed_buchungen_abgleichen(_TENANT)

    assert dict((p[0], p[2]) for p in dienst.projiziert) == {
        "ALTGEBUCHT": True, "FRISCH": False,
    }


def test_bestand_prueft_die_grenze_beidseitig() -> None:
    """Die 48-Stunden-Grenze selbst — nicht nur der Codepfad daneben.

    WARUM DIESER TEST NOETIG WURDE: Der Test oben arbeitet mit
    `datetime.now(UTC)` und einem Datum von 2020. Beide Werte liegen so weit
    von der Grenze entfernt, dass er gruen bleibt, wenn jemand
    `BESTAND_AB_STUNDEN` auf 1 oder auf 500 setzt. Er prueft, DASS am
    Buchungszeitpunkt entschieden wird — nicht, WO die Grenze liegt. Eine
    verschobene Grenze ist aber genau der stille Rueckfall: bei 500 Stunden
    meldet der Tageslauf wieder Wochen alte Buchungen als neu.

    Die Stuetzwerte sind aus der Konstante ABGELEITET, nicht hartkodiert —
    sonst prueft der Test nach der naechsten Aenderung wieder etwas anderes als
    die geltende Grenze.
    """
    fenster = timedelta(hours=BESTAND_AB_STUNDEN)
    knapp_drinnen = _jetzt() - (fenster - timedelta(minutes=5))
    knapp_draussen = _jetzt() - (fenster + timedelta(minutes=5))

    # Innerhalb des Fensters gebucht → frisches Ereignis, KEIN Bestand.
    assert _bestand({"booked_at": knapp_drinnen.isoformat()}) is False
    # Fuenf Minuten aelter → Bestand, keine Meldung.
    assert _bestand({"booked_at": knapp_draussen.isoformat()}) is True


def test_zukunftszeitpunkt_gilt_als_bestand_nicht_als_ewig_frisch() -> None:
    """Ein Portal mit falsch gestellter Uhr darf nicht dauerhaft melden.

    Die Vorgaenger-Fassung verglich einseitig (`jetzt - zeitpunkt <= fenster`).
    Fuer einen Zeitstempel in der ZUKUNFT — falscher Offset, vertauschtes
    Tag/Monat, falsch gestellte Uhr beim Portal — ist das DAUERHAFT wahr: die
    Buchung galt fuer immer als frisch und meldete bei jedem Tageslauf erneut.
    `ist_frisch` gibt fuer solche Werte `None` und loggt sie laut; hier faellt
    das fail-closed auf Bestand.
    """
    weit_voraus = _jetzt() + timedelta(days=30)
    assert _bestand({"booked_at": weit_voraus.isoformat()}) is True


def _jetzt() -> datetime:
    """Jetzt in UTC — eine Stelle, damit die Grenzwerte oben vergleichbar sind."""
    return datetime.now(UTC)


def test_ohne_buchungszeitpunkt_gilt_bestand_fail_closed() -> None:
    """Fehlt der Quell-Zeitstempel, wird NICHT gemeldet (Wurzel 5).

    Die alte Vorgabe war die umgekehrte („lieber eine Meldung zu viel") und
    genau darin lag der Fehler: eine falsche Meldung ist fuer den Empfaenger
    nicht als falsch erkennbar, eine fehlende ueber eine korrekt im Kalender
    stehende Buchung ist folgenlos.
    """
    assert _bestand({}) is True
    assert _bestand({"booked_at": "kaputt"}) is True
    assert _bestand({"arrival_date": "2030-01-01"}) is True


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
