"""Das Zusammenspiel der Automail-Planung — nicht die Einzelteile.

`test_inbox.py` prüft die Rechenstücke (`_compute_send_at`, `_versandstatus`,
`_automation_matches`) einzeln. Was dort nicht geprüft wurde, ist die KETTE:
planen → Gegenzustand pflegen → stilllegen → versenden. Genau in ihr lagen die
Fehler, die live aufgefallen sind — eine Regel, die nicht mehr passt, deren
eingeplante Nachricht aber stehen bleibt (Wurzel 1), oder eine bereits
versendete Zeile, die eine Neuplanung wiederbelebt (Wurzel 2).

Die Fake-DB hier hält echte Zeilen und wendet Filter wirklich an. Ein Double,
das `update()` nur entgegennimmt, hätte jeden dieser Fehler mitgemacht.
"""
from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

import pytest

from src.core.security import AuthContext
from src.features.inbox import mail_versand
from src.features.inbox.errors import InboxError
from src.features.inbox.service import InboxService


class _Res:
    def __init__(self, data: list[dict]) -> None:
        self.data = data
        self.count = len(data)


class FakeDB:
    """Kleine In-Memory-DB: Tabellen als Listen, Filter werden angewandt.

    Bewusst NICHT das `_FakeDB` aus `test_inbox.py` wiederverwendet: das
    verteilt Zeilen nach Tabellenname auf zwei feste Listen und kennt weder
    `upsert` noch mehrere frei befüllbare Tabellen. Hier braucht jede Prüfung
    ihre eigene Tabellenlandschaft (Regeln, geplante Zeilen, Threads, Objekte).
    """

    def __init__(self, **tabellen: list[dict]) -> None:
        self.tabellen: dict[str, list[dict]] = {k: v for k, v in tabellen.items()}
        self.aufrufe: list[tuple[str, str, Any]] = []

    def rows(self, name: str) -> list[dict]:
        return self.tabellen.setdefault(name, [])

    def table(self, name: str) -> _FakeQuery:
        return _FakeQuery(self, name)


class _FakeQuery:  # pylint: disable=too-many-instance-attributes
    def __init__(self, db: FakeDB, name: str) -> None:
        self._db = db
        self._name = name
        self._eq: list[tuple[str, Any]] = []
        self._in: tuple[str, list] | None = None
        self._bereich: list[tuple[str, str, str]] = []
        self._patch: dict | None = None
        self._insert: dict | None = None
        self._upsert: dict | None = None
        self._konflikt: str | None = None
        self._sort: list[tuple[str, bool]] = []

    # -- Aufbau ------------------------------------------------------------
    def select(self, *_a: Any, **_k: Any) -> _FakeQuery:
        return self

    def update(self, patch: dict) -> _FakeQuery:
        self._patch = patch
        return self

    def insert(self, payload: dict) -> _FakeQuery:
        self._insert = payload
        return self

    def upsert(
        self, payload: dict | list[dict], *, on_conflict: str | None = None
    ) -> _FakeQuery:
        # PostgREST nimmt beides: eine Zeile oder viele (`_spiegel_schreiben`
        # schickt eine Liste). Ein Double, das nur dict kennt, lässt den
        # Spiegel-Pfad still ins Leere laufen.
        self._upsert = payload
        self._konflikt = on_conflict
        return self

    def or_(self, _ausdruck: str) -> _FakeQuery:
        return self

    def eq(self, col: str, val: Any) -> _FakeQuery:
        self._eq.append((col, val))
        return self

    def in_(self, col: str, vals: list) -> _FakeQuery:
        self._in = (col, list(vals))
        return self

    def lt(self, col: str, val: str) -> _FakeQuery:
        self._bereich.append((col, str(val), "lt"))
        return self

    def lte(self, col: str, val: str) -> _FakeQuery:
        self._bereich.append((col, str(val), "lte"))
        return self

    def gte(self, col: str, val: str) -> _FakeQuery:
        self._bereich.append((col, str(val), "gte"))
        return self

    def order(self, col: str | None = None, *, desc: bool = False, **_k: Any) -> _FakeQuery:
        if col:
            self._sort.append((col, desc))
        return self

    def limit(self, *_a: Any, **_k: Any) -> _FakeQuery:
        return self

    # -- Ausführung --------------------------------------------------------
    def _treffer(self) -> list[dict]:
        rows = self._db.rows(self._name)
        if self._in:
            col, vals = self._in
            rows = [r for r in rows if str(r.get(col)) in {str(v) for v in vals}]
        for col, val in self._eq:
            rows = [r for r in rows if r.get(col) == val]
        for col, wert, art in self._bereich:
            rows = [
                r
                for r in rows
                if r.get(col) is not None
                and (
                    str(r[col]) >= wert
                    if art == "gte"
                    else str(r[col]) <= wert
                    if art == "lte"
                    else str(r[col]) < wert
                )
            ]
        for col, desc in reversed(self._sort):
            rows = sorted(
                rows, key=lambda r, c=col: (r.get(c) is None, str(r.get(c) or "")),
                reverse=desc,
            )
        return rows

    def execute(self) -> _Res:
        if self._patch is not None:
            getroffen = self._treffer()
            for r in getroffen:
                r.update(self._patch)
            self._db.aufrufe.append((self._name, "update", self._patch))
            return _Res(getroffen)
        if self._insert is not None:
            zeile = {"id": f"{self._name}-{len(self._db.rows(self._name)) + 1}",
                     **self._insert}
            self._db.rows(self._name).append(zeile)
            self._db.aufrufe.append((self._name, "insert", zeile))
            return _Res([zeile])
        if self._upsert is not None:
            nutzlast = (
                self._upsert
                if isinstance(self._upsert, list)
                else [self._upsert]
            )
            return _Res([self._eine_zeile_upserten(p) for p in nutzlast])
        return _Res(self._treffer())

    def _eine_zeile_upserten(self, payload: dict) -> dict:
        # Nur der ERSTE Schlüssel von `on_conflict` wird verglichen — er ist in
        # allen hier geprüften Pfaden eindeutig genug.
        schluessel = (self._konflikt or "id").split(",")[0]
        wert = payload.get(schluessel)
        for r in self._db.rows(self._name):
            if r.get(schluessel) == wert:
                r.update(payload)
                self._db.aufrufe.append((self._name, "upsert", r))
                return r
        zeile = {
            "id": f"{self._name}-{len(self._db.rows(self._name)) + 1}",
            **payload,
        }
        self._db.rows(self._name).append(zeile)
        self._db.aufrufe.append((self._name, "upsert", zeile))
        return zeile


# --- Bausteine ---------------------------------------------------------------
def regel(**felder: Any) -> dict:
    """Eine aktive Datums-Regel mit brauchbaren Vorgaben."""
    return {
        "id": "a1",
        "tenant_id": "t1",
        "name": "Anreise-Info",
        "trigger": "before_checkin",
        "anchor": "arrival",
        "offset_days": 3,
        "offset_unit": "days",
        "offset_value": 3,
        "send_time": "10:00",
        "property_ids": None,
        "channels": None,
        "template_id": None,
        "message": "Hallo!",
        "subject": "",
        "is_active": True,
        "use_property_timezone": False,
        "only_first_message": False,
        "window_days": None,
        "window_from": None,
        "window_to": None,
        **felder,
    }


def thread(**felder: Any) -> dict:
    return {
        "id": "th1",
        "tenant_id": "t1",
        "property_id": "p1",
        "property_map_id": None,
        "ota_name": "Direkt",
        "arrival_date": "2026-10-10",
        "departure_date": "2026-10-14",
        "booked_at": "2026-09-01T08:00:00+00:00",
        "status": "new",
        # Ein eigener Thread (Direkt) braucht die Gast-Mail als Versandweg —
        # ohne sie legt die Planung mit 'keine_gastadresse' still.
        "gast_mail": "gast@example.com",
        **felder,
    }


def _dienst(db: FakeDB) -> InboxService:
    return InboxService(service_client=db, channex=object())


_JETZT = datetime(2026, 10, 1, 9, 0, tzinfo=UTC)


# --- _plan_thread ------------------------------------------------------------
def test_plan_thread_kanalfilter_laesst_fremden_kanal_aus() -> None:
    """Eine Regel „nur Booking.com" darf an einer Direktbuchung nichts planen —
    und damit auch keine Zeile hinterlassen, die der Aufrufer für gepflegt hält."""
    db = FakeDB(automation_scheduled_message=[], message_automation_text=[])
    geplant = _dienst(db)._plan_thread(
        db, "t1", thread(), "p1", None, [regel(channels=["Booking.com"])], _JETZT
    )
    assert geplant == set()
    assert db.rows("automation_scheduled_message") == []


def test_plan_thread_objektfilter_trifft_nur_sein_objekt() -> None:
    db = FakeDB(automation_scheduled_message=[], message_automation_text=[])
    dienst = _dienst(db)
    assert dienst._plan_thread(
        db, "t1", thread(), "p1", None, [regel(property_ids=["p9"])], _JETZT
    ) == set()
    assert dienst._plan_thread(
        db, "t1", thread(), "p1", None, [regel(property_ids=["p1"])], _JETZT
    ) == {"a1"}


def test_plan_thread_stornierte_buchung_bekommt_nichts() -> None:
    """Wurzel 1: eine Absage ist der Gegenzustand der Buchung."""
    db = FakeDB(automation_scheduled_message=[], message_automation_text=[])
    assert _dienst(db)._plan_thread(
        db, "t1", thread(status="cancelled"), "p1", None, [regel()], _JETZT
    ) == set()
    assert db.rows("automation_scheduled_message") == []


def test_plan_thread_ohne_zeitzone_legt_still_und_meldet_den_grund() -> None:
    """Die Regel verlangt Ortszeit, das Objekt hat keine: nicht planen, aber den
    GRUND festhalten — „skipped" ohne Grund war eine Aussage ohne Inhalt."""
    db = FakeDB(
        automation_scheduled_message=[
            {
                "id": "s1", "tenant_id": "t1", "automation_id": "a1",
                "thread_id": "th1", "status": "pending", "last_error": None,
            }
        ],
        message_automation_text=[],
    )
    gesammelt: set[str] = set()
    geplant = _dienst(db)._plan_thread(
        db, "t1", thread(), "p1", None,
        [regel(use_property_timezone=True)], _JETZT,
        ohne_zeitzone=gesammelt,
    )
    # „konnte gerade nicht rechnen" zählt als gepflegt — sonst nähme der
    # Aufrufer die Zeile als „passt nicht mehr" zurück.
    assert geplant == {"a1"}
    assert gesammelt == {"p1"}
    zeile = db.rows("automation_scheduled_message")[0]
    assert zeile["status"] == "skipped"
    assert zeile["last_error"] == "zeitzone_fehlt"


def test_plan_thread_ohne_text_legt_still_mit_grund() -> None:
    db = FakeDB(
        automation_scheduled_message=[
            {
                "id": "s1", "tenant_id": "t1", "automation_id": "a1",
                "thread_id": "th1", "status": "pending", "last_error": None,
            }
        ],
        message_automation_text=[],
        tenant_message_language=[],
    )
    _dienst(db)._plan_thread(
        db, "t1", thread(), "p1", "Europe/Copenhagen", [regel(message=None)], _JETZT
    )
    assert db.rows("automation_scheduled_message")[0]["last_error"] == "kein_text"


def test_plan_thread_ohne_anker_legt_still_mit_grund() -> None:
    """Eine Buchung ohne Ankerdatum (hier: ohne Anreise) kann nichts rechnen."""
    db = FakeDB(
        automation_scheduled_message=[
            {
                "id": "s1", "tenant_id": "t1", "automation_id": "a1",
                "thread_id": "th1", "status": "pending", "last_error": None,
            }
        ],
        message_automation_text=[],
    )
    _dienst(db)._plan_thread(
        db, "t1", thread(arrival_date=None), "p1", "Europe/Copenhagen", [regel()], _JETZT
    )
    assert db.rows("automation_scheduled_message")[0]["last_error"] == "anker_fehlt"


# --- Zeitfenster bei Datums-Triggern (A4) ------------------------------------
def test_zeitfenster_verschiebt_datumsregel_auf_den_fensterbeginn() -> None:
    """Das Fenster war für Datums-Regeln eine Attrappe: sichtbar einstellbar,
    aber nur von der Abwesenheitsantwort gelesen. Wer „08:00–20:00" wählte,
    bekam die Nachricht trotzdem um 03:00."""
    verschoben = InboxService._ins_zeitfenster(
        regel(window_from="08:00", window_to="20:00"),
        datetime(2026, 10, 10, 3, 0, tzinfo=UTC),
        None,
    )
    assert verschoben == datetime(2026, 10, 10, 8, 0, tzinfo=UTC)


def test_zeitfenster_laesst_passenden_zeitpunkt_unberuehrt() -> None:
    drin = datetime(2026, 10, 10, 9, 0, tzinfo=UTC)
    assert InboxService._ins_zeitfenster(
        regel(window_from="08:00", window_to="20:00"), drin, None
    ) == drin


def test_zeitfenster_verschiebt_nur_nach_vorn() -> None:
    """Nie zurück: früher zu senden verletzte den Anker (bei „vor Anreise"
    schriebe es den Gast vor seiner Buchung an)."""
    spaet = datetime(2026, 10, 10, 22, 0, tzinfo=UTC)
    verschoben = InboxService._ins_zeitfenster(
        regel(window_from="08:00", window_to="20:00"), spaet, None
    )
    assert verschoben > spaet
    assert verschoben == datetime(2026, 10, 11, 8, 0, tzinfo=UTC)


def test_zeitfenster_ohne_angabe_aendert_nichts() -> None:
    wann = datetime(2026, 10, 10, 3, 0, tzinfo=UTC)
    assert InboxService._ins_zeitfenster(regel(), wann, None) == wann


def test_nur_erste_nachricht_bei_datumsregel_wird_abgewiesen() -> None:
    """„Nur bei der ersten Gastnachricht" zählt Nachrichten — eine Datums-Regel
    hat keine. Bisher wurde die Einstellung gespeichert und nie gelesen."""
    from src.features.inbox.schemas import AutomationUpsert

    with pytest.raises(InboxError) as fehler:
        _dienst(FakeDB())._automation_pruefen(
            AutomationUpsert(
                name="X", trigger="before_checkin", message="Hallo",
                only_first_message=True,
            )
        )
    assert fehler.value.status_code == 422


# --- _einplanen --------------------------------------------------------------
def test_einplanen_belebt_versendete_zeile_nicht_wieder() -> None:
    """Wurzel 2: eine Neuplanung darf eine bereits versendete Automail nicht auf
    'pending' zurücksetzen — der Gast bekäme sie ein zweites Mal."""
    db = FakeDB(
        automation_scheduled_message=[
            {
                "id": "s1", "tenant_id": "t1", "automation_id": "a1",
                "thread_id": "th1", "status": "sent", "body": "alt",
            }
        ]
    )
    InboxService._einplanen(
        db, "t1", regel(), "th1", "neu", datetime(2026, 10, 7, 10, 0, tzinfo=UTC)
    )
    zeilen = db.rows("automation_scheduled_message")
    # Die alte bleibt 'sent'; der Insert-Versuch legt die zweite Zeile an, die
    # in der echten DB der Unique-Index abfängt.
    assert zeilen[0]["status"] == "sent"
    assert zeilen[0]["body"] == "alt"


def test_einplanen_ohne_wiederbelebung_laesst_storniertes_liegen() -> None:
    """Die Abwesenheitsantwort ist eine QUITTUNG, keine Vorausplanung: wird sie
    storniert, darf die nächste Gastnachricht sie nicht zurückholen."""
    db = FakeDB(
        automation_scheduled_message=[
            {
                "id": "s1", "tenant_id": "t1", "automation_id": "a1",
                "thread_id": "th1", "status": "cancelled", "body": "alt",
            }
        ]
    )
    InboxService._einplanen(
        db, "t1", regel(), "th1", "neu", datetime(2026, 10, 7, 10, 0, tzinfo=UTC),
        wiederbeleben=False,
    )
    assert db.rows("automation_scheduled_message")[0]["status"] == "cancelled"


def test_einplanen_hebt_offene_zeile_und_loescht_den_alten_grund() -> None:
    db = FakeDB(
        automation_scheduled_message=[
            {
                "id": "s1", "tenant_id": "t1", "automation_id": "a1",
                "thread_id": "th1", "status": "skipped",
                "body": "alt", "last_error": "zeitzone_fehlt",
            }
        ]
    )
    InboxService._einplanen(
        db, "t1", regel(), "th1", "neu", datetime(2026, 10, 7, 10, 0, tzinfo=UTC)
    )
    zeile = db.rows("automation_scheduled_message")[0]
    assert (zeile["status"], zeile["body"], zeile["last_error"]) == (
        "pending", "neu", None,
    )


def test_einplanen_schluckt_nur_den_dublettenfehler() -> None:
    """Der Konflikt wird am CODE erkannt, nicht am Text. Ein anderer DB-Fehler
    muss durchschlagen — sonst gilt „nichts geschrieben" still als erledigt."""
    from postgrest.exceptions import APIError

    class _Kippt(FakeDB):
        def __init__(self, code: str) -> None:
            super().__init__(automation_scheduled_message=[])
            self._code = code

        def table(self, name: str) -> Any:
            query = super().table(name)
            echt = query.execute

            def execute() -> Any:
                if query._insert is not None:  # noqa: SLF001 — Testdouble
                    raise APIError({"code": self._code, "message": "x"})
                return echt()

            query.execute = execute  # type: ignore[method-assign]
            return query

    InboxService._einplanen(
        _Kippt("23505"), "t1", regel(), "th1", "x",
        datetime(2026, 10, 7, 10, 0, tzinfo=UTC),
    )
    with pytest.raises(APIError):
        InboxService._einplanen(
            _Kippt("42703"), "t1", regel(), "th1", "x",
            datetime(2026, 10, 7, 10, 0, tzinfo=UTC),
        )


# --- schedule_automations_for_thread ----------------------------------------
def test_schedule_fuer_thread_plant_und_raeumt_unpassendes_ab() -> None:
    """Beide Richtungen in einem Aufruf (Wurzel 1): was passt, wird geplant; was
    nicht mehr passt, wird zurückgenommen."""
    db = FakeDB(
        channex_booking=[thread()],
        properties=[{"id": "p1", "tenant_id": "t1", "timezone": "Europe/Berlin"}],
        message_automation=[regel(), regel(id="a2", channels=["Booking.com"])],
        message_automation_text=[],
        tenant_message_language=[],
        automation_scheduled_message=[
            {
                "id": "s2", "tenant_id": "t1", "automation_id": "a2",
                "thread_id": "th1", "status": "pending",
            }
        ],
    )
    anzahl = _dienst(db).schedule_automations_for_thread("t1", "th1")
    assert anzahl == 1
    zeilen = {z["automation_id"]: z for z in db.rows("automation_scheduled_message")}
    assert zeilen["a1"]["status"] == "pending"
    # a2 passt nicht mehr (Kanal) → die anstehende Zeile ist zurückgenommen.
    assert zeilen["a2"]["status"] == "cancelled"


def test_schedule_fuer_stornierten_thread_nimmt_alles_zurueck() -> None:
    db = FakeDB(
        channex_booking=[thread(status="cancelled")],
        properties=[{"id": "p1", "tenant_id": "t1", "timezone": None}],
        message_automation=[regel()],
        message_automation_text=[],
        tenant_message_language=[],
        automation_scheduled_message=[
            {
                "id": "s1", "tenant_id": "t1", "automation_id": "a1",
                "thread_id": "th1", "status": "pending",
            }
        ],
    )
    assert _dienst(db).schedule_automations_for_thread("t1", "th1") == 0
    assert db.rows("automation_scheduled_message")[0]["status"] == "cancelled"


# --- replan_tenant -----------------------------------------------------------
def _replan_db(**extra: list[dict]) -> FakeDB:
    morgen = (datetime.now(UTC) + timedelta(days=9)).date().isoformat()
    uebermorgen = (datetime.now(UTC) + timedelta(days=13)).date().isoformat()
    basis: dict[str, list[dict]] = {
        "channex_booking": [
            thread(arrival_date=morgen, departure_date=uebermorgen)
        ],
        "properties": [{"id": "p1", "tenant_id": "t1", "timezone": "Europe/Berlin"}],
        "message_automation": [regel()],
        "message_automation_text": [],
        "tenant_message_language": [],
        "automation_scheduled_message": [],
        "users": [],
    }
    basis.update(extra)
    return FakeDB(**basis)


def test_replan_tenant_storniert_veraltete_zeilen() -> None:
    """Der `veraltet`-Sweep: was über einen Tag überfällig ist, käme nur noch
    verspätet beim Gast an."""
    alt = (datetime.now(UTC) - timedelta(days=5)).isoformat()
    db = _replan_db(
        automation_scheduled_message=[
            {
                "id": "s9", "tenant_id": "t1", "automation_id": "a1",
                "thread_id": "alt-thread", "status": "pending", "send_at": alt,
            }
        ]
    )
    ergebnis = _dienst(db).replan_tenant("t1")
    veraltet = [
        z for z in db.rows("automation_scheduled_message") if z["id"] == "s9"
    ]
    assert veraltet[0]["status"] == "cancelled"
    assert ergebnis["storniert"] >= 1


def test_replan_tenant_storniert_stillgelegte_regel() -> None:
    """Eine pausierte Regel ist erst dann pausiert, wenn ihre bereits
    eingeplanten Nachrichten weg sind — der Versand kennt nur die Zeile."""
    db = _replan_db(
        message_automation=[regel(), regel(id="a_aus", is_active=False)],
        automation_scheduled_message=[
            {
                "id": "s5", "tenant_id": "t1", "automation_id": "a_aus",
                "thread_id": "th1", "status": "pending",
                "send_at": (datetime.now(UTC) + timedelta(days=2)).isoformat(),
            }
        ],
    )
    _dienst(db).replan_tenant("t1")
    aus = [z for z in db.rows("automation_scheduled_message") if z["id"] == "s5"]
    assert aus[0]["status"] == "cancelled"


def test_replan_all_tenants_nimmt_betriebe_mit_offenen_zeilen_mit() -> None:
    """Wer seine letzte Datums-Regel LÖSCHT, verschwand aus der Tenant-Liste —
    und seine eingeplanten Automails gingen weiter raus."""
    db = FakeDB(
        message_automation=[],
        automation_scheduled_message=[
            {
                "id": "s1", "tenant_id": "t9", "automation_id": "weg",
                "thread_id": "th1", "status": "pending",
                "send_at": (datetime.now(UTC) + timedelta(days=1)).isoformat(),
            }
        ],
        channex_booking=[],
        properties=[],
        message_automation_text=[],
        tenant_message_language=[],
        users=[],
    )
    ergebnis = _dienst(db).replan_all_tenants()
    assert ergebnis["tenants"] == 1
    assert db.rows("automation_scheduled_message")[0]["status"] == "cancelled"


# --- Versand: Nachzügler-Schranke -------------------------------------------
def test_dispatch_setzt_nachzuegler_auf_skipped_statt_sie_zu_senden() -> None:
    """Die Grenze stand nur im Docstring. Fiel der Neuplanungs-Lauf aus, ging
    „Ihre Anreise ist in 3 Tagen" an jemanden, der gestern abgereist ist."""
    alt = (datetime.now(UTC) - timedelta(days=3)).isoformat()
    db = FakeDB(
        automation_scheduled_message=[
            {
                "id": "s1", "tenant_id": "t1", "automation_id": "a1",
                "thread_id": "th1", "status": "pending", "send_at": alt,
                "body": "zu spät",
            }
        ]
    )
    ergebnis = _dienst(db).dispatch_due_automations()
    zeile = db.rows("automation_scheduled_message")[0]
    assert (zeile["status"], zeile["last_error"]) == ("skipped", "nachzuegler")
    assert ergebnis == {"sent": 0, "failed": 0, "considered": 0}


# --- Fehlerzustand -----------------------------------------------------------
def test_fehlerzustand_db_und_netzfehler_bleiben_wiederholbar() -> None:
    """Ein Fehler ohne `status_code` ist kein Urteil über die Nachricht. Vorher
    löschte eine DB-Störung von Sekunden die Automail endgültig."""
    from httpx import ConnectError
    from postgrest.exceptions import APIError

    assert InboxService._fehlerzustand(APIError({"message": "weg"}))["status"] == (
        "pending"
    )
    assert InboxService._fehlerzustand(ConnectError("weg"))["status"] == "pending"
    # Ein 4xx bleibt endgültig — auch beim zehnten Versuch.
    assert InboxService._fehlerzustand(
        InboxError("keine Adresse", status_code=422)
    )["status"] == "failed"


# --- E-Mail-Weg --------------------------------------------------------------
class _FakeMail:
    def __init__(self) -> None:
        self.gesendet: list[Any] = []

    def send(self, msg: Any) -> str:
        self.gesendet.append(msg)
        return "id-1"


def test_mailweg_ohne_gastadresse_schlaegt_fehl_statt_zu_schweigen() -> None:
    """Fail-closed (Wurzel 5): ohne Adresse gibt es keinen Weg zum Gast. Nicht
    so tun, als sei die Nachricht raus."""
    with pytest.raises(InboxError) as fehler:
        mail_versand.per_mail_senden(
            FakeDB(), "t1", customer={"name": "Ida"}, text="Hallo",
            automation_id=None, mail=_FakeMail(),
        )
    assert fehler.value.status_code == 422


def test_mailweg_nimmt_den_betreff_der_regel_in_der_gastsprache() -> None:
    db = FakeDB(
        message_automation=[regel(subject="Ihre Anreise")],
        message_automation_text=[
            {
                "tenant_id": "t1", "automation_id": "a1", "lang": "da",
                "subject": "Din ankomst", "message": "Hej",
            }
        ],
        tenant_message_language=[],
    )
    post = _FakeMail()
    nachricht = mail_versand.per_mail_senden(
        db, "t1",
        customer={"name": "Ida", "mail": "ida@example.dk", "language": "da-DK"},
        text="Hej Ida", automation_id="a1", mail=post,
    )
    assert post.gesendet[0].subject == "Din ankomst"
    assert post.gesendet[0].to == "ida@example.dk"
    assert nachricht.sender == "property"
    # Eigene ID und eigener Zeitpunkt: das Ereignis IST unser Versand.
    assert nachricht.id and nachricht.id.startswith("mail:")
    assert nachricht.sent_at


def test_mailweg_ohne_regelbetreff_nimmt_den_katalog_nicht_deutsch() -> None:
    """Kein hartes Deutsch (Wurzel 4): der Fallback-Betreff steht im
    Mail-Katalog und kommt in der Sprache des Gastes."""
    db = FakeDB(
        message_automation=[], message_automation_text=[],
        tenant_message_language=[],
    )
    post = _FakeMail()
    mail_versand.per_mail_senden(
        db, "t1",
        customer={"mail": "ida@example.dk", "language": "da"},
        text="Hej", automation_id=None, mail=post,
    )
    from src.core.mail_texte import text as mail_text

    assert post.gesendet[0].subject == mail_text(mail_versand.BETREFF_KEY, "da")
    assert post.gesendet[0].subject != mail_text(mail_versand.BETREFF_KEY, "de")


def test_mailweg_smtp_stoerung_ist_voruebergehend() -> None:
    """SMTP weg → 502 → `_fehlerzustand` hält die Zeile auf 'pending'. Eine
    Störung von Minuten darf die Automail nicht löschen."""
    from src.core.mail import MailError

    class _Kaputt:
        def send(self, _msg: Any) -> str:
            raise MailError("SMTP weg")

    with pytest.raises(InboxError) as fehler:
        mail_versand.per_mail_senden(
            FakeDB(tenant_message_language=[]), "t1",
            customer={"mail": "ida@example.dk"}, text="Hallo",
            automation_id=None, mail=_Kaputt(),
        )
    assert fehler.value.status_code == 502
    assert InboxService._fehlerzustand(fehler.value)["status"] == "pending"


def test_send_message_nimmt_bei_eigenem_thread_den_mailweg() -> None:
    """Die Weiche in `send_message`: ein Thread ohne Channex-Bezug geht per
    E-Mail raus, nicht gegen eine Buchungs-ID, hinter der nichts steht."""
    db = FakeDB(
        channex_booking=[
            thread(
                channex_booking_id="res-1",
                customer={"name": "Ida", "mail": "ida@example.dk"},
                raw={"source": "direkt"},
            )
        ],
        portal_messages=[],
        reservations=[],
        properties=[{"id": "p1", "tenant_id": "t1", "timezone": None}],
        message_automation=[],
        message_automation_text=[],
        tenant_message_language=[],
        users=[],
        automation_scheduled_message=[],
        ki_autoantwort=[],
    )
    post = _FakeMail()
    dienst = InboxService(service_client=db, channex=object(), mail=post)
    gesendet = dienst.send_message(
        AuthContext(user_id="cron", tenant_id="t1"), "th1", "Hallo Ida",
        enforce_reply=False, quelle="automation",
    )
    assert gesendet.message == "Hallo Ida"
    assert post.gesendet and post.gesendet[0].to == "ida@example.dk"
    # Der Spiegel bekommt die Zeile wie beim Portal-Echo — die `quelle` bleibt
    # der AUSLÖSER, nicht der Versandweg.
    spiegel = db.rows("portal_messages")
    assert spiegel and spiegel[0]["quelle"] == "automation"
    assert spiegel[0]["sender"] == "property"


def test_eigener_thread_ohne_gastmail_legt_still_und_meldet_einmal() -> None:
    """Direktbuchung ohne E-Mail: kein Versandweg → jede passende Regel wird mit
    Grund 'keine_gastadresse' stillgelegt, der Betrieb bekommt EINE Glocke —
    nicht vier 'failed' im Tick (14.09.2026)."""
    from unittest.mock import patch

    db = FakeDB(
        message_automation=[regel(id="a1"), regel(id="a2", trigger="on_checkin")],
        automation_scheduled_message=[
            {"id": "s1", "tenant_id": "t1", "automation_id": "a1", "thread_id": "th1",
             "status": "pending", "send_at": "2026-10-07T18:00:00+00:00", "body": "x"},
        ],
    )
    svc = _dienst(db)
    with patch("src.features.inbox.planung.melde_gast_unerreichbar") as melden:
        geplant = svc._plan_thread(
            db, "t1", thread(gast_mail=""), "p1", None,
            db.rows("message_automation"), _JETZT,
        )
    assert geplant == {"a1", "a2"}
    zeile = db.rows("automation_scheduled_message")[0]
    assert (zeile["status"], zeile["last_error"]) == ("skipped", "keine_gastadresse")
    melden.assert_called_once()


def test_uhrzeit_ohne_objektzeitzone_wird_nicht_in_utc_gedeutet() -> None:
    """Regel 06:00, Objekt ohne Zeitzone: KEIN stilles UTC (bis 14.09.2026 war
    06:00 dann 08:00 in Dänemark). Die Zeile wird mit 'zeitzone_fehlt' stillgelegt."""
    db = FakeDB(
        message_automation=[regel(id="a1", send_time="06:00")],
        automation_scheduled_message=[
            {"id": "s1", "tenant_id": "t1", "automation_id": "a1", "thread_id": "th1",
             "status": "pending", "send_at": "2026-10-10T06:00:00+00:00", "body": "x"},
        ],
    )
    _dienst(db)._plan_thread(db, "t1", thread(), "p1", None, db.rows("message_automation"), _JETZT)
    zeile = db.rows("automation_scheduled_message")[0]
    assert (zeile["status"], zeile["last_error"]) == ("skipped", "zeitzone_fehlt")


def test_kundenuhrzeit_wird_in_ortszeit_geplant() -> None:
    """Regel „Anreisetag 06:00" → geplant ist 06:00 Kopenhagen (= 04:00 UTC im Sommer)."""
    db = FakeDB(
        message_automation=[regel(id="a1", trigger="on_checkin", send_time="06:00",
                                  offset_value=0, offset_days=0)],
        automation_scheduled_message=[],
    )
    _dienst(db)._plan_thread(
        db, "t1", thread(arrival_date="2026-07-15"), "p1", "Europe/Copenhagen",
        db.rows("message_automation"), datetime(2026, 7, 1, tzinfo=UTC),
    )
    zeile = db.rows("automation_scheduled_message")[0]
    assert zeile["send_at"].startswith("2026-07-15T04:00:00")
