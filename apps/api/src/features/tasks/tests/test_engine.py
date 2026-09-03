"""Tests der Regel-Engine (0272).

Geprüft wird das, was ohne DB entscheidbar ist und wo die teuren Fehler sitzen:
die Zeitanker der planmäßigen Regeln und das Ausrollen der Wiederholungsmuster.
Die Idempotenz selbst hängt am UNIQUE-Index der Live-DB — sie wird gegen die
echte Datenbank verifiziert, nicht gegen einen Mock (der bewiese nur den Mock).
"""
from datetime import UTC, date, datetime, time
from zoneinfo import ZoneInfo

import pytest

from src.features.tasks.engine import (
    RuleEngineError,
    _monthly_day,
    _occurrences,
    _parse_clock,
    _regel_anwenden,
    _reservation_anchors,
    _trigger_time,
    sync_for_reservation,
)

_RESERVATION = {
    "id": "r1",
    "check_in": "2026-08-10",
    "check_out": "2026-08-14",
    "checkin_time": "16:00",
    "checkout_time": "10:00",
    "created_at": "2026-07-01T09:30:00+00:00",
}


def _anchors() -> tuple[datetime, datetime]:
    anchors = _reservation_anchors(_RESERVATION)
    assert anchors is not None
    return anchors


# --- Uhrzeiten ------------------------------------------------------------


def test_parse_clock_erfindet_keine_uhrzeit() -> None:
    assert _parse_clock("16:00") == time(16, 0)
    assert _parse_clock("16:00:00") == time(16, 0)
    # Unlesbares bleibt None statt still auf eine Standardstunde zu fallen.
    assert _parse_clock("nachmittags") is None
    assert _parse_clock("") is None
    assert _parse_clock(None) is None


def test_reservation_ohne_zeitraum_hat_keine_anker() -> None:
    assert _reservation_anchors({"id": "r1", "check_in": None, "check_out": None}) is None


# --- Trigger --------------------------------------------------------------


def test_check_in_und_check_out_nutzen_die_zeiten_der_buchung() -> None:
    anchors = _anchors()
    assert _trigger_time("check_in", 0, _RESERVATION, anchors) == datetime(
        2026, 8, 10, 16, 0, tzinfo=UTC
    )
    assert _trigger_time("check_out", 0, _RESERVATION, anchors) == datetime(
        2026, 8, 14, 10, 0, tzinfo=UTC
    )


def test_offset_verschiebt_mit_vorzeichen() -> None:
    anchors = _anchors()
    # „2 Tage vor Anreise" = −2880 Minuten.
    assert _trigger_time(
        "days_before_check_in", -2880, _RESERVATION, anchors
    ) == datetime(2026, 8, 8, 16, 0, tzinfo=UTC)
    assert _trigger_time(
        "days_after_check_out", 1440, _RESERVATION, anchors
    ) == datetime(2026, 8, 15, 10, 0, tzinfo=UTC)


def test_after_check_in_24h_endet_spaetestens_zum_check_out() -> None:
    kurz = {**_RESERVATION, "check_out": "2026-08-11", "checkout_time": "10:00"}
    anchors = _reservation_anchors(kurz)
    assert anchors is not None
    # Check-in 10.8. 16:00 + 24 h wäre der 11.8. 16:00 — der Gast ist aber um
    # 10:00 weg. Die Aufgabe endet mit der Abreise, nicht danach.
    assert _trigger_time("after_check_in_24h", 0, kurz, anchors) == datetime(
        2026, 8, 11, 10, 0, tzinfo=UTC
    )


def test_tages_anker_ignorieren_die_uhrzeit_der_buchung() -> None:
    """Der Unterschied zu `check_in`/`check_out` (0535): NUR das Datum zaehlt.

    Der Gast checkt um 16:00 ein und um 10:00 aus. Eine Regel „Am Anreisetag
    ab 09:00" muss trotzdem um 09:00 stehen — sonst waere der Empfang erst
    fertig, wenn der Gast schon da ist.
    """
    anchors = _anchors()
    assert _trigger_time(
        "arrival_day", 0, _RESERVATION, anchors, time(9, 0)
    ) == datetime(2026, 8, 10, 9, 0, tzinfo=UTC)
    assert _trigger_time(
        "departure_day", 0, _RESERVATION, anchors, time(14, 30)
    ) == datetime(2026, 8, 14, 14, 30, tzinfo=UTC)


def test_tages_anker_ohne_uhrzeit_bleibt_der_tagesbeginn() -> None:
    """Keine erfundene Standardstunde (Wurzel 4) — 00:00 des Ankertags."""
    anchors = _anchors()
    assert _trigger_time("arrival_day", 0, _RESERVATION, anchors, None) == datetime(
        2026, 8, 10, 0, 0, tzinfo=UTC
    )


def test_tages_anker_nimmt_den_versatz_weiterhin_mit() -> None:
    anchors = _anchors()
    assert _trigger_time(
        "departure_day", 60, _RESERVATION, anchors, time(10, 0)
    ) == datetime(2026, 8, 14, 11, 0, tzinfo=UTC)


def test_uhrzeit_wirkt_nicht_auf_die_uhrzeit_anker() -> None:
    """Eine Regel-Uhrzeit an `check_in` waere eine zweite Wahrheit — der Motor
    ignoriert sie, und der Service raeumt sie beim Speichern ohnehin weg."""
    anchors = _anchors()
    assert _trigger_time(
        "check_in", 0, _RESERVATION, anchors, time(9, 0)
    ) == datetime(2026, 8, 10, 16, 0, tzinfo=UTC)


def test_regel_zeitfenster_nimmt_die_uhrzeiten_der_regel() -> None:
    """Von-bis am selben Tag: „Am Anreisetag 10:00 bis 14:00"."""
    from src.features.tasks.engine import _regel_zeitfenster

    regel = {
        "id": "rule1",
        "start_trigger": "arrival_day",
        "end_trigger": "arrival_day",
        "start_offset_minutes": 0,
        "end_offset_minutes": 0,
        "start_clock": "10:00",
        "end_clock": "14:00",
    }
    fenster = _regel_zeitfenster(regel, _RESERVATION, _anchors())
    assert fenster == (
        datetime(2026, 8, 10, 10, 0, tzinfo=UTC),
        datetime(2026, 8, 10, 14, 0, tzinfo=UTC),
    )


def test_regel_ohne_endzeit_endet_zur_startzeit_nicht_um_mitternacht() -> None:
    """Ohne eigene Endzeit gilt die Startzeit weiter. Faellt das Ende sonst auf
    00:00, laege es VOR dem Start und der Motor wuerfe es stumm weg."""
    from src.features.tasks.engine import _regel_zeitfenster

    regel = {
        "id": "rule1",
        "start_trigger": "arrival_day",
        "end_trigger": "departure_day",
        "start_offset_minutes": 0,
        "end_offset_minutes": 0,
        "start_clock": "10:00",
        "end_clock": None,
    }
    fenster = _regel_zeitfenster(regel, _RESERVATION, _anchors())
    assert fenster == (
        datetime(2026, 8, 10, 10, 0, tzinfo=UTC),
        datetime(2026, 8, 14, 10, 0, tzinfo=UTC),
    )


def test_anker_ohne_uhrzeit_ist_mitternacht_vor_ort() -> None:
    """DER HAEUFIGSTE FALL, und lange falsch: 351 von 536 Live-Buchungen tragen
    gar keine `checkin_time` (03.09.2026). Ohne Zone landete die Aufgabe auf
    00:00 UTC, was der Kalender in Daenemark als „02:00" zeigte."""
    ohne_zeit = {**_RESERVATION, "checkin_time": None, "checkout_time": None}
    kopenhagen = ZoneInfo("Europe/Copenhagen")
    anchors = _reservation_anchors(ohne_zeit, kopenhagen)
    assert anchors is not None
    assert anchors[0] == datetime(2026, 8, 9, 22, 0, tzinfo=UTC)  # 10.8. 00:00 lokal


def test_anker_mit_uhrzeit_meint_ortszeit() -> None:
    """Auch mit gepflegter Uhrzeit: „Check-in 16:00" heisst 16:00 vor Ort."""
    anchors = _reservation_anchors(_RESERVATION, ZoneInfo("Europe/Copenhagen"))
    assert anchors is not None
    assert anchors[0] == datetime(2026, 8, 10, 14, 0, tzinfo=UTC)  # 16:00 lokal


def test_anker_ohne_zone_bleibt_utc() -> None:
    """Der Altbestand ohne gepflegte Objektzeitzone rechnet unveraendert weiter."""
    anchors = _reservation_anchors(_RESERVATION)
    assert anchors is not None
    assert anchors[0] == datetime(2026, 8, 10, 16, 0, tzinfo=UTC)


def test_tages_anker_rechnet_in_der_zeitzone_des_objekts() -> None:
    """„10:00 am Anreisetag" meint 10:00 VOR ORT.

    In UTC gerechnet stuende die Reinigung in Daenemark im Sommer um 12:00 vor
    der Tuer. Gemeldet wurde der Fall an seiner sichtbaren Seite (03.09.2026):
    eine Aufgabe ohne Uhrzeit zeigte „02:00" statt Tagesbeginn.
    """
    anchors = _anchors()
    kopenhagen = ZoneInfo("Europe/Copenhagen")
    # 10.08.2026 ist Sommerzeit: Europe/Copenhagen = UTC+2.
    assert _trigger_time(
        "arrival_day", 0, _RESERVATION, anchors, time(10, 0), kopenhagen
    ) == datetime(2026, 8, 10, 8, 0, tzinfo=UTC)
    # Ohne Uhrzeit ist es der TAGESBEGINN vor Ort, nicht 00:00 UTC.
    assert _trigger_time(
        "arrival_day", 0, _RESERVATION, anchors, None, kopenhagen
    ) == datetime(2026, 8, 9, 22, 0, tzinfo=UTC)


def test_unbekannte_zeitzone_bleibt_utc_statt_geraten() -> None:
    """Eine erfundene Zone verschoebe jede Aufgabe still um Stunden (Wurzel 4)."""
    from src.features.tasks.engine import _zone

    assert _zone("Europe/Copenhagen") is not None
    assert _zone("Mars/Olympus") is None
    assert _zone("") is None
    assert _zone(None) is None


def test_ohne_trigger_gibt_es_keinen_zeitpunkt() -> None:
    assert _trigger_time(None, 0, _RESERVATION, _anchors()) is None


def test_unbekannter_trigger_faellt_hart_durch() -> None:
    with pytest.raises(RuleEngineError):
        _trigger_time("irgendwann", 0, _RESERVATION, _anchors())


# --- Wiederholungsmuster --------------------------------------------------


def test_taeglich_rastet_auf_das_anfangsdatum_ein() -> None:
    days = _occurrences(
        {"frequency": "daily", "interval": 3},
        date(2026, 8, 1),
        None,
        date(2026, 8, 5),
        date(2026, 8, 14),
    )
    # Raster ab 1.8.: 1, 4, 7, 10, 13 — im Fenster ab dem 5.8. bleiben 7/10/13.
    assert days == [date(2026, 8, 7), date(2026, 8, 10), date(2026, 8, 13)]


def test_woechentlich_nur_die_markierten_tage() -> None:
    mask = (1 << 0) | (1 << 4)  # Montag + Freitag
    days = _occurrences(
        {"frequency": "weekly", "interval": 1, "weekday_mask": mask},
        date(2026, 8, 1),
        None,
        date(2026, 8, 1),
        date(2026, 8, 14),
    )
    assert days == [
        date(2026, 8, 3),
        date(2026, 8, 7),
        date(2026, 8, 10),
        date(2026, 8, 14),
    ]


def test_woechentlich_ohne_maske_ergibt_nichts() -> None:
    # Unfertiges Muster → keine Aufgabe. Lieber gar keine als eine geratene.
    assert (
        _occurrences(
            {"frequency": "weekly", "interval": 1},
            date(2026, 8, 1),
            None,
            date(2026, 8, 1),
            date(2026, 8, 31),
        )
        == []
    )


def test_monatlich_erster_montag() -> None:
    rec = {
        "frequency": "monthly",
        "interval": 1,
        "weekday_pattern_position": "first",
        "weekday_pattern_weekday": 0,
    }
    days = _occurrences(rec, date(2026, 8, 1), None, date(2026, 8, 1), date(2026, 10, 31))
    assert days == [date(2026, 8, 3), date(2026, 9, 7), date(2026, 10, 5)]


def test_monatstag_31_rutscht_auf_den_monatsletzten() -> None:
    # Sonst hätte die Regel in jedem kurzen Monat eine stumme Lücke.
    assert _monthly_day(2026, 9, {"day_of_month": 31}) == date(2026, 9, 30)
    assert _monthly_day(2026, 2, {"day_of_month": 30}) == date(2026, 2, 28)


def test_enddatum_schneidet_das_fenster() -> None:
    days = _occurrences(
        {"frequency": "daily", "interval": 1},
        date(2026, 8, 1),
        date(2026, 8, 3),
        date(2026, 8, 1),
        date(2026, 8, 31),
    )
    assert days == [date(2026, 8, 1), date(2026, 8, 2), date(2026, 8, 3)]


def test_jaehrlich_haelt_den_monat_des_anfangsdatums() -> None:
    days = _occurrences(
        {"frequency": "yearly", "interval": 1, "day_of_month": 15},
        date(2026, 4, 15),
        None,
        date(2026, 1, 1),
        date(2028, 12, 31),
    )
    assert days == [date(2026, 4, 15), date(2027, 4, 15), date(2028, 4, 15)]


# --- Endzustände und Nachzug (0272 / Anreise-Aufgabe fehlte live) ----------


class _KeineDb:
    """Client, der jeden Zugriff verbietet.

    Für die Zweige, die GAR NICHT in die DB gehen dürfen: eine offene Anfrage
    plant keine Reinigung, und ein Nachzug rührt eine vorhandene Aufgabe nicht
    an. Ein Mock, der Zugriffe still zulässt, würde beides nicht beweisen.
    """

    def table(self, name: str) -> object:  # pragma: no cover - darf nie laufen
        raise AssertionError(f"unerwarteter DB-Zugriff auf {name}")


def test_offene_anfrage_erzeugt_keine_aufgabe() -> None:
    """`requested` ist noch kein Verkauf — nichts anlegen, nichts wegräumen.

    Die Aufgaben entstehen erst mit dem Annehmen (`accept_request`), das erneut
    hier hereinkommt, dann mit `confirmed`.
    """
    res = {**_RESERVATION, "status": "requested"}
    assert sync_for_reservation(_KeineDb(), "t1", res) == 0


@pytest.mark.parametrize("status", ["cancelled", "declined", "expired"])
def test_endzustaende_raeumen_die_aufgaben_weg(
    status: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Abgelehnt und abgelaufen sind derselbe Gegenzustand wie storniert.

    Bis hierher prüfte die Engine nur `cancelled`: eine abgelehnte Anfrage ließ
    ihre Reinigung stehen (Wurzel 1).
    """
    gerufen: list[str] = []
    monkeypatch.setattr(
        "src.features.tasks.engine._on_cancelled",
        lambda db, tenant_id, reservation_id: gerufen.append(reservation_id) or 1,
    )
    res = {**_RESERVATION, "status": status}
    assert sync_for_reservation(_KeineDb(), "t1", res) == 1
    assert gerufen == ["r1"]


def test_nachzug_ruehrt_vorhandene_aufgabe_nicht_an() -> None:
    """`verschieben=False`: der stündliche Abgleich legt nur Fehlendes an.

    Sonst schriebe jeder Lauf dieselben Werte erneut in jede Aufgabe — reine
    Schreiblast plus ein Realtime-Ereignis pro Aufgabe und Stunde, ohne dass
    sich etwas geändert hätte.
    """
    regel = {
        "id": "rule1",
        "name": "Anreise-Check",
        "start_trigger": "days_before_check_in",
        "start_offset_minutes": -1440,
        "end_trigger": "check_in",
        "end_offset_minutes": 0,
    }
    beruehrt = _regel_anwenden(
        _KeineDb(),
        "t1",
        regel,
        _RESERVATION,
        _anchors(),
        [],
        {"id": "task1", "status": "open"},
        verschieben=False,
    )
    assert beruehrt is False


def test_nachzug_legt_keine_laengst_faellige_aufgabe_mehr_an() -> None:
    """`nicht_vor`: ein Willkommens-Check für eine Anreise von vor drei Wochen
    nachträglich als OFFEN anzulegen wäre eine Falschmeldung, kein Fund.

    Der Rückblick des Nachzugs greift am Buchungs-Fenster (check_out); eine
    lange Buchung kann darin liegen und ihre Anreise-Aufgabe weit davor.
    """
    regel = {
        "id": "rule1",
        "name": "Velk T",
        "start_trigger": "days_before_check_in",
        "start_offset_minutes": -1440,
        "end_trigger": "check_in",
        "end_offset_minutes": 0,
    }
    # Anreise 10.08. → Aufgabe 09.–10.08.; die Grenze liegt am 20.08.
    frueh = {**_RESERVATION, "check_in": "2026-08-10", "check_out": "2026-08-23"}
    assert (
        _regel_anwenden(
            _KeineDb(),
            "t1",
            regel,
            frueh,
            _reservation_anchors(frueh) or (datetime.now(UTC), datetime.now(UTC)),
            [],
            None,
            verschieben=False,
            nicht_vor=datetime(2026, 8, 20, tzinfo=UTC),
        )
        is False
    )


# --- Eigentümersperrung (0510) -------------------------------------------
#
# Eine Eigennutzung lief bis 0510 durch dieselbe Regelkette wie eine
# Gastbuchung: Anreise-Vorbereitung, Endreinigung, Wäsche entstanden, obwohl
# niemand sie beauftragt hatte. Die Tests hier sind bewusst mit `_KeineDb`
# gebaut — sie beweisen nicht nur „keine Aufgabe", sondern dass die Engine dafür
# gar nicht erst zur Datenbank greift.

_EIGENNUTZUNG = {
    **_RESERVATION,
    "is_owner_stay": True,
    "block_request_id": "antrag1",
}

_REINIGUNG = {
    "id": "rule-reinigung",
    "name": "Endreinigung",
    "start_trigger": "check_out",
    "start_offset_minutes": 0,
    "end_trigger": "days_after_check_out",
    "end_offset_minutes": 1440,
}


def test_bestellte_regeln_zaehlt_nur_genehmigte() -> None:
    """Bestellt ist nicht genehmigt (0538). `angefragt` und `abgelehnt` bleiben
    draussen — fail-closed: eine offene Entscheidung ist keine Freigabe."""
    from unittest.mock import MagicMock

    from src.features.tasks.eigennutzung import bestellte_regeln

    db = MagicMock()
    db.table.return_value.select.return_value.in_.return_value.execute.return_value.data = [
        {"block_request_id": "br1", "rule_id": "r-ok", "status": "genehmigt"},
        {"block_request_id": "br1", "rule_id": "r-offen", "status": "angefragt"},
        {"block_request_id": "br1", "rule_id": "r-nein", "status": "abgelehnt"},
    ]
    res = bestellte_regeln(
        db, [{"id": "res1", "is_owner_stay": True, "block_request_id": "br1"}]
    )
    assert res == {"res1": {"r-ok"}}


def test_eigennutzung_ohne_bestellung_erzeugt_keine_aufgabe() -> None:
    """Der Kern: keine Bestellung, keine Aufgabe.

    `bestellt` kennt die Reservierung gar nicht — sie hat also nichts bestellt.
    Fail-closed (Wurzel 5): nicht „im Zweifel putzen", denn genau das ist der
    Zustand, der abgestellt wird.
    """
    assert not _regel_anwenden(
        _KeineDb(),
        "t1",
        _REINIGUNG,
        _EIGENNUTZUNG,
        _anchors(),
        [],
        None,
        bestellt={},
    )


def test_eigennutzung_mit_anderer_bestellung_erzeugt_keine_aufgabe() -> None:
    """Bestellt wurde eine ANDERE Leistung — diese Regel bleibt still.

    Der Unterschied zum Test darüber: die Reservierung IST in `bestellt`, sie
    hat nur diese eine Regel nicht angekreuzt. Ein Filter, der nur auf
    „überhaupt etwas bestellt" prüfte, ginge hier durch.
    """
    assert not _regel_anwenden(
        _KeineDb(),
        "t1",
        _REINIGUNG,
        _EIGENNUTZUNG,
        _anchors(),
        [],
        None,
        bestellt={"r1": {"rule-waesche"}},
    )


def test_gastbuchung_bleibt_von_der_sperre_unberuehrt() -> None:
    """Ohne `is_owner_stay` gilt die Bestellsperre nicht.

    Der teure Fehler wäre, die Regel versehentlich auf ALLE Buchungen zu legen
    — dann entstünde im ganzen Betrieb keine Reinigung mehr. `_KeineDb` wirft
    beim ersten Tabellenzugriff, der Insert-Versuch beweist also, dass die
    Regel greift.
    """
    with pytest.raises(AssertionError, match="unerwarteter DB-Zugriff auf tasks"):
        _regel_anwenden(
            _KeineDb(),
            "t1",
            _REINIGUNG,
            _RESERVATION,
            _anchors(),
            [],
            None,
            bestellt={},
        )


def test_eigennutzung_ohne_sperrantrag_faellt_zu() -> None:
    """Von Hand erfasste Eigennutzung ohne Antrag: keine Aufgabe.

    Sie trägt keine `block_request_id`, also gibt es keine Bestellung, die man
    nachschlagen könnte. Die Alternative wäre, sie wie eine Gastbuchung zu
    behandeln — dann bliebe die alte Lücke für genau den Fall offen, den ein
    Mitarbeiter von Hand anlegt.
    """
    ohne_antrag = {**_RESERVATION, "is_owner_stay": True}
    assert not _regel_anwenden(
        _KeineDb(),
        "t1",
        _REINIGUNG,
        ohne_antrag,
        _anchors(),
        [],
        None,
        bestellt={},
    )


def test_jeder_engine_pfad_liest_is_owner_stay() -> None:
    """Jede Stelle, die Reservierungen für die Engine lädt, MUSS die zwei
    Felder mitselektieren.

    Ohne sie sähe `ist_eigennutzung` ein fehlendes Feld und antwortete
    „gewöhnliche Buchung" — die Sperre wäre lautlos wirkungslos, und zwar genau
    an dem Pfad, den jemand später hinzufügt, ohne diesen Zusammenhang zu
    kennen. Der Test liest den Quelltext, weil sich das anders nicht prüfen
    lässt, ohne jeden Pfad gegen eine echte DB zu fahren.
    """
    from pathlib import Path

    wurzel = Path(__file__).resolve().parents[3]
    pfade = [
        wurzel / "features/tasks/engine.py",
        wurzel / "features/tasks/service.py",
        wurzel / "features/reservations/_base.py",
    ]
    for pfad in pfade:
        text = pfad.read_text(encoding="utf-8")
        # Jeder Select, der `checkin_time` für die Engine holt, gehört dazu.
        for stueck in text.split('"checkin_time, checkout_time, created_at')[1:]:
            kopf = stueck[:120]
            assert "is_owner_stay" in kopf, (
                f"{pfad.name}: Reservierungs-Select ohne is_owner_stay — "
                "eine Eigentümersperrung würde hier wie eine Gastbuchung "
                "behandelt (0510)."
            )
            assert "block_request_id" in kopf, (
                f"{pfad.name}: Reservierungs-Select ohne block_request_id — "
                "die Bestellung wäre nicht auffindbar (0510)."
            )
