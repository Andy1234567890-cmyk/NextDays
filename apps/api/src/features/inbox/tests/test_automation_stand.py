"""Zustand der Automatisierungen (`automation_stand`).

Eigenes Double statt des großen `_FakeDB` aus `test_inbox.py`: geprüft wird
hier genau eine Tabelle plus die Regelliste, und die Abfrage lebt von zwei
Dingen, die das große Double nicht nachbildet — echtem Sortieren nach
`updated_at` und einem wirksamen `limit`. Ohne ein wirksames `limit` wäre
`gekappt` immer False und der Deckel (Wurzel 8) ungeprüft.
"""
from datetime import UTC, datetime, timedelta

import pytest

from src.core.security import AuthContext
from src.features.inbox.automation_stand import (
    MAX_NACHRICHTEN,
    erneut_alle_fehlgeschlagenen,
    erneut_einplanen,
    nachrichten_laden,
    stand_laden,
)
from src.features.inbox.errors import InboxError

_CTX = AuthContext(user_id="u", tenant_id="t1", role="admin")
_CTX_FREMD = AuthContext(user_id="u", tenant_id="t2", role="admin")
_CTX_OHNE_TENANT = AuthContext(user_id="u", tenant_id=None, role="admin")


class _Res:
    def __init__(self, data) -> None:  # noqa: ANN001
        self.data = data


class _Query:
    def __init__(self, rows) -> None:  # noqa: ANN001
        self._rows = rows
        self._eq: dict = {}
        self._in: tuple | None = None
        self._patch: dict | None = None
        self._sort: list = []
        self._limit: int | None = None

    def select(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    def eq(self, col, val):  # noqa: ANN001, ANN201
        self._eq[col] = val
        return self

    def order(self, col, *, desc=False, **_k):  # noqa: ANN001, ANN003, ANN201
        self._sort.append((col, desc))
        return self

    def limit(self, n):  # noqa: ANN001, ANN201
        self._limit = n
        return self

    def in_(self, col, vals):  # noqa: ANN001, ANN201
        self._in = (col, list(vals))
        return self

    def update(self, patch):  # noqa: ANN001, ANN201
        self._patch = patch
        return self

    def execute(self):  # noqa: ANN201
        rows = [
            r
            for r in self._rows
            if all(r.get(c) == v for c, v in self._eq.items())
            and (self._in is None or str(r.get(self._in[0])) in {str(v) for v in self._in[1]})
        ]
        if self._patch is not None:
            for r in rows:
                r.update(self._patch)
            return _Res(rows)
        for col, desc in reversed(self._sort):
            rows = sorted(
                rows,
                key=lambda r, c=col: (r.get(c) is None, str(r.get(c) or "")),
                reverse=desc,
            )
        if self._limit is not None:
            rows = rows[: self._limit]
        return _Res(rows)


class _DB:
    def __init__(self, regeln, protokoll, **weitere) -> None:  # noqa: ANN001, ANN003
        self._tabellen = {
            "message_automation": regeln,
            "automation_scheduled_message": protokoll,
            **weitere,
        }

    def table(self, name):  # noqa: ANN001, ANN201
        return _Query(self._tabellen.get(name, []))


def _zeile(**kw):  # noqa: ANN003, ANN201
    basis = {
        "id": "s1",
        "tenant_id": "t1",
        "automation_id": "a1",
        "status": "pending",
        "send_at": "2026-09-20T09:00:00+00:00",
        "updated_at": "2026-09-14T09:00:00+00:00",
        "last_error": None,
    }
    basis.update(kw)
    return basis


def test_stand_zaehlt_je_zustand_und_regel() -> None:
    db = _DB(
        [{"id": "a1", "tenant_id": "t1"}, {"id": "a2", "tenant_id": "t1"}],
        [
            _zeile(id="s1", status="sent", updated_at="2026-09-10T08:00:00+00:00"),
            _zeile(id="s2", status="sent", updated_at="2026-09-11T08:00:00+00:00"),
            _zeile(id="s3", status="skipped", updated_at="2026-09-12T08:00:00+00:00"),
            _zeile(id="s4", automation_id="a2", status="cancelled"),
        ],
    )
    out = stand_laden(db, _CTX)
    stand = {s.automation_id: s for s in out.items}
    assert out.total == 2
    assert stand["a1"].sent == 2
    assert stand["a1"].skipped == 1
    assert stand["a1"].gesamt == 3
    assert stand["a2"].cancelled == 1
    assert out.gekappt is False


def test_stand_zeigt_regel_ohne_protokoll_mit_nullen() -> None:
    """Eine nie eingeplante Regel bekommt einen Eintrag, keine Lücke.

    Sonst müsste sich die Oberfläche den Nullwert selbst ausdenken — genau die
    Sorte erfundener Ersatzwert, die Wurzel 4 verbietet.
    """
    db = _DB([{"id": "a1", "tenant_id": "t1"}], [])
    out = stand_laden(db, _CTX)
    assert out.total == 1
    assert out.items[0].automation_id == "a1"
    assert out.items[0].gesamt == 0
    assert out.items[0].naechster_versand is None


def test_stand_nimmt_den_juengsten_fehler() -> None:
    db = _DB(
        [{"id": "a1", "tenant_id": "t1"}],
        [
            _zeile(
                id="s1",
                status="failed",
                last_error="Feld {{guest_name}} fehlt",
                updated_at="2026-09-01T08:00:00+00:00",
            ),
            _zeile(
                id="s2",
                status="failed",
                last_error="Portal antwortet nicht",
                updated_at="2026-09-13T08:00:00+00:00",
            ),
        ],
    )
    out = stand_laden(db, _CTX)
    assert out.items[0].failed == 2
    assert out.items[0].letzter_fehler == "Portal antwortet nicht"
    assert out.items[0].letzter_fehler_am == "2026-09-13T08:00:00+00:00"


def test_stand_naechster_versand_ist_der_frueheste_offene() -> None:
    """Der frühere Termin gewinnt — auch wenn seine Zeile später geschrieben wurde."""
    db = _DB(
        [{"id": "a1", "tenant_id": "t1"}],
        [
            _zeile(id="s1", status="pending", send_at="2026-09-25T09:00:00+00:00"),
            _zeile(
                id="s2",
                status="sending",
                send_at="2026-09-18T09:00:00+00:00",
                updated_at="2026-09-01T08:00:00+00:00",
            ),
            # Gesendetes zählt NICHT als „nächster Versand" — es ist durch.
            _zeile(id="s3", status="sent", send_at="2026-01-01T09:00:00+00:00"),
        ],
    )
    out = stand_laden(db, _CTX)
    assert out.items[0].naechster_versand == "2026-09-18T09:00:00+00:00"
    assert out.items[0].pending == 1
    assert out.items[0].sending == 1


def test_stand_sieht_keine_fremden_zeilen() -> None:
    """Service-Role umgeht RLS — der Filter MUSS im Code stehen (Wurzel 3)."""
    db = _DB(
        [{"id": "a1", "tenant_id": "t1"}, {"id": "a9", "tenant_id": "t2"}],
        [
            _zeile(id="s1", status="sent"),
            _zeile(id="s9", tenant_id="t2", automation_id="a9", status="sent"),
        ],
    )
    out = stand_laden(db, _CTX)
    assert [s.automation_id for s in out.items] == ["a1"]
    assert out.items[0].sent == 1


def test_stand_meldet_die_kappung_statt_still_zu_kuerzen(monkeypatch) -> None:  # noqa: ANN001
    """Greift der Deckel, sagt die Antwort das — sonst wäre die Summe gelogen."""
    monkeypatch.setattr("src.features.inbox.automation_stand.MAX_ZEILEN", 2)
    db = _DB(
        [{"id": "a1", "tenant_id": "t1"}],
        [_zeile(id=f"s{i}", status="sent") for i in range(5)],
    )
    out = stand_laden(db, _CTX)
    assert out.gekappt is True
    assert out.items[0].sent == 2


def test_stand_ohne_tenant_403() -> None:
    with pytest.raises(InboxError) as exc:
        stand_laden(_DB([], []), _CTX_OHNE_TENANT)
    assert exc.value.status_code == 403


def test_nachrichten_liefern_die_juengsten_zeilen() -> None:
    jetzt = datetime(2026, 9, 14, tzinfo=UTC)
    protokoll = [
        _zeile(
            id=f"s{i}",
            status="sent",
            updated_at=(jetzt - timedelta(days=i)).isoformat(),
        )
        for i in range(20)
    ]
    db = _DB([{"id": "a1", "tenant_id": "t1"}], protokoll)
    out = nachrichten_laden(db, _CTX, "a1", limit=10)
    assert out.total == 10
    assert out.items[0].id == "s0"  # jüngste zuerst
    assert out.items[0].status == "sent"


def test_nachrichten_deckeln_das_limit() -> None:
    db = _DB(
        [{"id": "a1", "tenant_id": "t1"}],
        [_zeile(id=f"s{i}") for i in range(MAX_NACHRICHTEN + 10)],
    )
    out = nachrichten_laden(db, _CTX, "a1", limit=10_000)
    assert out.total == MAX_NACHRICHTEN


def test_nachrichten_fremde_regel_404() -> None:
    """Gleicher Scope wie die Liste (Wurzel 9) — kein Existenz-Leak."""
    db = _DB([{"id": "a1", "tenant_id": "t1"}], [_zeile()])
    with pytest.raises(InboxError) as exc:
        nachrichten_laden(db, _CTX_FREMD, "a1")
    assert exc.value.status_code == 404


def test_nachrichten_tragen_buchung_und_fehlende_felder() -> None:
    """Die Zeile nennt Gast, Objekt und die Platzhalter ohne Wert — und ob sie
    am Objekt HEUTE noch leer sind (14.09.2026: „wo kommen die Fehler her")."""
    db = _DB(
        [{"id": "a1", "tenant_id": "t1"}],
        [_zeile(
            status="failed", thread_id="th1",
            last_error=(
                "Diese Felder haben für diese Reservierung keinen Wert: door_code, wifi_ssid"
            ),
        )],
        channex_booking=[{
            "id": "th1", "tenant_id": "t1", "property_id": "p1", "ota_name": "BookingCom",
            "arrival_date": "2026-08-14", "departure_date": "2026-08-18",
            "customer": {"name": "Ida", "surname": "Jensen"},
        }],
        properties=[{"id": "p1", "tenant_id": "t1", "title": "Feriehus Line"}],
        property_guest_portal=[{"property_id": "p1", "door_code": "1411", "wifi_ssid": ""}],
    )
    out = nachrichten_laden(db, _CTX, "a1")
    z = out.items[0]
    assert (z.gast, z.objekt, z.ota_name) == ("Ida Jensen", "Feriehus Line", "BookingCom")
    assert z.fehlende_felder == ["door_code", "wifi_ssid"]
    assert z.heute_leer == ["wifi_ssid"]  # Türcode ist inzwischen gepflegt


def test_erneut_nur_aus_failed_skipped_cancelled() -> None:
    protokoll = [_zeile(id="f1", status="failed", last_error="x"), _zeile(id="ok", status="sent")]
    db = _DB([{"id": "a1", "tenant_id": "t1"}], protokoll, channex_booking=[])
    neu = erneut_einplanen(db, _CTX, "f1")
    assert (neu.status, neu.last_error) == ("pending", None)
    assert protokoll[0]["status"] == "pending" and protokoll[0]["send_at"] != _zeile()["send_at"]
    with pytest.raises(InboxError) as exc:
        erneut_einplanen(db, _CTX, "ok")
    assert exc.value.status_code == 409


def test_erneut_fremder_tenant_404() -> None:
    db = _DB([{"id": "a1", "tenant_id": "t1"}], [_zeile(id="f1", status="failed")])
    with pytest.raises(InboxError) as exc:
        erneut_einplanen(db, _CTX_FREMD, "f1")
    assert exc.value.status_code == 404


def test_erneut_alle_nur_failed() -> None:
    protokoll = [
        _zeile(id="f1", status="failed"), _zeile(id="f2", status="failed"),
        _zeile(id="s1", status="skipped"), _zeile(id="ok", status="sent"),
    ]
    db = _DB([{"id": "a1", "tenant_id": "t1"}], protokoll)
    assert erneut_alle_fehlgeschlagenen(db, _CTX, "a1") == 2
    assert [r["status"] for r in protokoll] == ["pending", "pending", "skipped", "sent"]


def test_stand_zeigt_betroffene_objekte_statt_nur_des_fehlersatzes() -> None:
    """Die Karte soll den Befund ZEIGEN: welches Objekt, welche Felder.

    Anlass 15.09.2026: „Letzter Fehler: Diese Felder haben für diese
    Reservierung keinen Wert: door_code, wifi_ssid" nannte weder das Haus noch,
    ob die Angabe heute noch fehlt.
    """
    fehlt = "Diese Felder haben für diese Reservierung keinen Wert: door_code, wifi_ssid"
    db = _DB(
        [{"id": "a1", "tenant_id": "t1"}],
        [
            _zeile(id="s1", status="failed", thread_id="b1", last_error=fehlt,
                   updated_at="2026-08-14T06:00:00+00:00"),
            _zeile(id="s2", status="failed", thread_id="b2", last_error=fehlt,
                   updated_at="2026-08-04T06:00:00+00:00"),
        ],
        channex_booking=[
            {"id": "b1", "tenant_id": "t1", "property_id": "p1"},
            {"id": "b2", "tenant_id": "t1", "property_id": "p1"},
        ],
        properties=[{"id": "p1", "tenant_id": "t1", "title": "Feriehus Line"}],
        # Türcode inzwischen gepflegt, WLAN-Name weiterhin leer.
        property_guest_portal=[
            {"property_id": "p1", "door_code": "1234", "wifi_ssid": "",
             "wifi_password": "geheim", "contact_phone": "+45"},
        ],
    )
    (stand,) = stand_laden(db, _CTX).items
    (luecke,) = stand.luecken
    assert luecke.objekt == "Feriehus Line"
    assert luecke.anzahl == 2
    assert sorted(luecke.felder) == ["door_code", "wifi_ssid"]
    # Nur das HEUTE noch leere Feld wird als offen geführt — der nachgetragene
    # Türcode darf nicht weiter rot stehen.
    assert luecke.heute_leer == ["wifi_ssid"]


def test_stand_meldet_erledigt_wenn_danach_wieder_zugestellt_wurde() -> None:
    """„fehlgeschlagen 14" ohne Zeitbezug liest sich wie ein laufender Ausfall.

    Wurde nach dem jüngsten Fehlschlag wieder zugestellt, ist die Zahl
    Vergangenheit — und die Oberfläche zeigt sie ruhig statt rot.
    """
    db = _DB(
        [{"id": "a1", "tenant_id": "t1"}, {"id": "a2", "tenant_id": "t1"}],
        [
            _zeile(id="s1", status="failed", updated_at="2026-08-14T06:00:00+00:00",
                   last_error="Service Temporary Unavailable"),
            _zeile(id="s2", status="sent", updated_at="2026-09-13T06:00:00+00:00"),
            # Zweite Regel: Fehlschlag NACH dem letzten Erfolg — bleibt offen.
            _zeile(id="s3", automation_id="a2", status="sent",
                   updated_at="2026-09-01T06:00:00+00:00"),
            _zeile(id="s4", automation_id="a2", status="failed",
                   updated_at="2026-09-12T06:00:00+00:00", last_error="Forbidden"),
        ],
    )
    stand = {s.automation_id: s for s in stand_laden(db, _CTX).items}
    assert stand["a1"].erledigt is True
    assert stand["a1"].letzter_erfolg_am == "2026-09-13T06:00:00+00:00"
    assert stand["a2"].erledigt is False
    # Ohne Platzhalter-Fehler gibt es keine Objekt-Lücken — der Grund bleibt
    # dann im Wortlaut stehen, statt ein leeres Objekt zu erfinden.
    assert stand["a1"].luecken == []


def test_stand_erledigt_wenn_der_aufenthalt_vorbei_ist() -> None:
    """Ein Fehlschlag zu einer abgereisten Buchung ist Historie.

    Live am 15.09.2026: „Forbidden" von Booking.com zu einem Aufenthalt vom
    August. Danach kam nie wieder ein Versand — also nie ein Erfolg, der ihn
    hätte ablösen können, und die Karte stand für immer rot („warum immer
    noch"). An eine abgereiste Buchung nimmt kein Portal eine Nachricht an:
    hier gibt es nichts zu tun.
    """
    db = _DB(
        [{"id": "a1", "tenant_id": "t1"}, {"id": "a2", "tenant_id": "t1"}],
        [
            _zeile(id="s1", status="failed", thread_id="b_alt", last_error="Forbidden",
                   updated_at="2026-09-15T05:27:37+00:00"),
            _zeile(id="s2", automation_id="a2", status="failed", thread_id="b_neu",
                   last_error="Forbidden", updated_at="2026-09-15T05:27:37+00:00"),
        ],
        channex_booking=[
            {"id": "b_alt", "tenant_id": "t1", "property_id": "p1",
             "departure_date": "2026-08-17"},
            # Aufenthalt liegt weit in der Zukunft — da ist noch etwas zu tun.
            {"id": "b_neu", "tenant_id": "t1", "property_id": "p1",
             "departure_date": "2099-01-01"},
        ],
        properties=[{"id": "p1", "tenant_id": "t1", "title": "Haus"}],
    )
    stand = {s.automation_id: s for s in stand_laden(db, _CTX).items}
    assert stand["a1"].erledigt is True
    assert stand["a2"].erledigt is False


def test_stand_haelt_fehlschlag_ohne_buchung_offen() -> None:
    """Keine auflösbare Buchung → offen lassen.

    Eine Panne stillzulegen, die niemand geprüft hat, wäre ein verschlucktes
    Signal (Wurzel 5).
    """
    db = _DB(
        [{"id": "a1", "tenant_id": "t1"}],
        [_zeile(id="s1", status="failed", thread_id=None, last_error="Forbidden")],
    )
    (eintrag,) = stand_laden(db, _CTX).items
    assert eintrag.erledigt is False


def test_stand_macht_aus_einem_portal_fehler_keine_objekt_luecke() -> None:
    """Ein 403 des Portals ist keine fehlende Angabe.

    Live am 15.09.2026: „Sommerhus Hjejlevej 1×" stand ohne ein einziges Feld
    unter dem Satz „Die Angaben stehen inzwischen" — der Fehler war ein
    Forbidden von Booking.com. `fehl` enthält solche Zeilen bewusst (die
    Buchung entscheidet, ob der Aufenthalt vorbei ist), sie dürfen aber keine
    Lücke erzeugen.
    """
    db = _DB(
        [{"id": "a1", "tenant_id": "t1"}],
        [
            _zeile(id="s1", status="failed", thread_id="b1", last_error="Forbidden",
                   updated_at="2026-09-15T05:27:37+00:00"),
        ],
        channex_booking=[
            {"id": "b1", "tenant_id": "t1", "property_id": "p1",
             "departure_date": "2099-01-01"},
        ],
        properties=[{"id": "p1", "tenant_id": "t1", "title": "Sommerhus Hjejlevej"}],
    )
    (eintrag,) = stand_laden(db, _CTX).items
    assert eintrag.luecken == []
    assert eintrag.letzter_fehler == "Forbidden"
