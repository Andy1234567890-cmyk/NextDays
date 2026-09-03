"""Tests für den tasks-Slice (Lastenheft §2.5 + §4.3)."""
from datetime import UTC, datetime, time
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from src.core.security import AuthContext
from src.features.tasks.schemas import (
    InventoryItemCreate,
    RuleCreate,
    SubstitutionRequest,
    TaskCreate,
    TaskRuleKind,
    TaskStatus,
    TaskTrigger,
)
from src.features.tasks.service import (
    TaskError,
    TasksService,
    _als_zeitpunkt,
    _utc,
)
from src.main import create_app

client = TestClient(create_app())

# Buchungs-ID für die Scope-Tests (muss eine UUID sein, Wurzel 5).
RES_ID = "55555555-5555-4555-8555-555555555555"


def test_tasks_health() -> None:
    resp = client.get("/api/v1/tasks/health")
    assert resp.status_code == 200
    assert resp.json() == {"slice": "tasks", "status": "ok"}


def _svc() -> tuple[TasksService, MagicMock]:
    m = MagicMock(name="supabase")
    return TasksService(client=m), m


def _insert_returns(m: MagicMock, rows: list[dict]) -> None:
    m.table.return_value.insert.return_value.execute.return_value.data = rows


# --- Vertretungs-Feature (§4.3) ---

def test_request_substitution_records_requester() -> None:
    svc, m = _svc()
    # §4.3-Guard: der Assignee-Check lädt zuerst die Aufgabe (select) — sie muss
    # dem Tenant gehören UND dem Antragsteller (u1) zugewiesen sein.
    m.table.return_value.select.return_value.eq.return_value.eq.return_value.limit.\
        return_value.execute.return_value.data = [
            {"id": "t1", "assignee_id": "u1"}
        ]
    _insert_returns(
        m,
        [{"id": "s1", "task_id": "t1", "requested_by": "u1",
          "accepted_by": None, "status": "requested", "note": None}],
    )
    sub = svc.request_substitution("T", "u1", SubstitutionRequest(task_id="t1"))
    assert sub.requested_by == "u1"
    assert sub.status.value == "requested"


def test_add_checklist_item_rejects_foreign_task() -> None:
    """IDOR-Guard: eine task_id, die NICHT dem Tenant gehört, wird mit 404
    abgelehnt (kein Checklist-Insert an fremde Aufgabe)."""
    from src.features.tasks.schemas import ChecklistItemCreate

    svc, m = _svc()
    # tasks-Select liefert NICHTS → fremde/unbekannte Aufgabe.
    m.table.return_value.select.return_value.eq.return_value.eq.return_value.limit.\
        return_value.execute.return_value.data = []
    with pytest.raises(TaskError) as exc:
        svc.add_checklist_item(
            "T", ChecklistItemCreate(task_id="foreign-task", label="X")
        )
    assert exc.value.status_code == 404


def test_request_substitution_rejects_non_assignee() -> None:
    """Nur der zugewiesene Mitarbeiter darf Vertretung anfragen — sonst 403."""
    import pytest

    from src.features.tasks.service import TaskError

    svc, m = _svc()
    # Aufgabe existiert, ist aber einem ANDEREN Mitarbeiter zugewiesen.
    m.table.return_value.select.return_value.eq.return_value.eq.return_value.limit.\
        return_value.execute.return_value.data = [
            {"id": "t1", "assignee_id": "someone-else"}
        ]
    with pytest.raises(TaskError) as exc:
        svc.request_substitution("T", "u1", SubstitutionRequest(task_id="t1"))
    assert exc.value.status_code == 403


# --- Inventar auch ohne property (§2.5 zentraler Pool) ---

def test_inventory_without_property_is_central_pool() -> None:
    svc, m = _svc()
    _insert_returns(
        m,
        [{"id": "i1", "tenant_id": "T", "property_id": None,
          "name": "Wäschepaket", "quantity": 23}],
    )
    item = svc.add_inventory(
        "T", InventoryItemCreate(name="Wäschepaket", quantity=23)
    )
    assert item.property_id is None
    assert item.quantity == 23


# --- create_task ---

def test_create_task_defaults_open() -> None:
    svc, m = _svc()
    _insert_returns(
        m, [{"id": "t1", "tenant_id": "T", "title": "X", "status": "open"}]
    )
    t = svc.create_task("T", TaskCreate(title="X"))
    assert t.status == TaskStatus.open


# --- Aufgaben je Buchung (PM-Detailseite) ---

def test_list_by_reservation_scopes_tenant_and_reservation() -> None:
    svc, m = _svc()
    # Die Buchung wird ZUERST gescopt geladen (Wurzel 9) — dieselbe Chain
    # (select.eq.eq.limit) beantwortet den Vorab-Load.
    (
        m.table.return_value.select.return_value.eq.return_value.eq.return_value.limit.return_value
    ).execute.return_value.data = [{"id": RES_ID, "property_id": "p1"}]
    chain = (
        m.table.return_value.select.return_value.eq.return_value.eq.return_value.order.return_value
    )
    chain.execute.return_value.data = [
        {"id": "t1", "tenant_id": "T", "reservation_id": RES_ID,
         "title": "Endreinigung", "status": "open", "property_id": "p1"},
    ]
    tasks = svc.list_by_reservation("T", RES_ID)
    assert [t.title for t in tasks] == ["Endreinigung"]
    assert tasks[0].reservation_id == RES_ID
    # Zwei gescopte Abfragen: erst die Buchung per (id, tenant_id), dann ihre
    # Aufgaben per (tenant_id, reservation_id) — kein ungescopter Roh-Zugriff
    # per ID (Wurzel 3), und der Vorab-Load ist der Wurzel-9-Guard.
    eq_calls = [c.args for c in m.table.return_value.select.return_value.eq.call_args_list]
    assert ("id", RES_ID) in eq_calls          # Buchung zuerst geladen
    assert ("tenant_id", "T") in eq_calls      # Aufgaben tenant-gescopt
    second_eq = [
        c.args
        for c in m.table.return_value.select.return_value.eq.return_value.eq.call_args_list
    ]
    assert ("tenant_id", "T") in second_eq     # Buchung tenant-gescopt
    assert ("reservation_id", RES_ID) in second_eq




# --- ohne Client: sauberer Fehler ---

def test_no_client_raises_clean_error() -> None:
    svc = TasksService(client=None)
    with pytest.raises(TaskError) as exc:
        svc.create_task("T", TaskCreate(title="X"))
    assert exc.value.status_code == 500


# --- PM-Modul: menschenlesbares Zeitplan-Label (UX-Verbesserung) ---

def test_schedule_label_weekly_pattern() -> None:
    from src.features.tasks.schedule_label import schedule_label

    # Mo (bit0) + Fr (bit4) = 1 + 16 = 17
    label = schedule_label({"frequency": "weekly", "weekday_mask": 17})
    assert label is not None
    assert "Montag" in label and "Freitag" in label


def test_schedule_label_monthly_weekday_pattern() -> None:
    from src.features.tasks.schedule_label import schedule_label

    label = schedule_label(
        {
            "frequency": "monthly",
            "weekday_pattern_position": "first",
            "weekday_pattern_weekday": 0,  # Montag
        }
    )
    assert label == "Monatlich · jeden 1. Montag"


def test_schedule_label_daily_interval() -> None:
    from src.features.tasks.schedule_label import schedule_label

    assert schedule_label({"frequency": "daily", "interval": 3}) == "Alle 3 Tage"


def test_schedule_label_empty_returns_none() -> None:
    """Keine erfundenen Fallback-Werte (CLAUDE.md Wurzel 4)."""
    from src.features.tasks.schedule_label import schedule_label

    assert schedule_label({}) is None
    assert schedule_label(None) is None
    assert schedule_label({"frequency": "unknown"}) is None


# --- PM-Modul: Foto-Pflicht beim Abschließen ---

def test_complete_task_rejects_missing_required_photo() -> None:
    """Ein requires_photo-Item ohne Foto → 422 (Foto-Pflicht, Prompt-1 §8)."""
    from src.features.tasks.schemas import ChecklistItem, TaskDetail

    svc, _ = _svc()
    detail = TaskDetail(
        id="t1",
        tenant_id="T",
        title="Endreinigung",
        status=TaskStatus.in_progress,
        checklist=[
            ChecklistItem(
                id="c1", task_id="t1", label="Bad", requires_photo=True, photos=[]
            )
        ],
    )
    svc.get_detail = MagicMock(return_value=detail)  # type: ignore[method-assign]
    with pytest.raises(TaskError) as exc:
        svc.complete_task("T", "t1", "u1")
    assert exc.value.status_code == 422


def test_complete_task_ok_when_photos_present() -> None:
    from src.features.tasks.schemas import ChecklistItem, TaskDetail

    svc, m = _svc()
    detail = TaskDetail(
        id="t1",
        tenant_id="T",
        title="Endreinigung",
        status=TaskStatus.in_progress,
        needs_inspection=True,
        checklist=[
            ChecklistItem(
                id="c1",
                task_id="t1",
                label="Bad",
                requires_photo=True,
                photos=["path/a.jpg"],
            )
        ],
    )
    done = detail.model_copy(update={"status": TaskStatus.done})
    svc.get_detail = MagicMock(  # type: ignore[method-assign]
        side_effect=[detail, done]
    )
    (
        m.table.return_value.update.return_value.eq.return_value.eq.return_value.execute.return_value
    ).data = [{"id": "t1"}]
    result = svc.complete_task("T", "t1", "u1")
    assert result.status == TaskStatus.done
    # needs_inspection → inspection_state auf to_review gesetzt.
    update_payload = m.table.return_value.update.call_args.args[0]
    assert update_payload["inspection_state"] == "to_review"


def test_complete_task_lehnt_abgebrochene_aufgabe_ab() -> None:
    """`cancelled` → `done` gibt es nicht — auch nicht über `/complete`.

    `_STATUS_WECHSEL` erlaubt aus `cancelled` nur `open`. Solange die Prüfung
    allein in `set_status` stand, war `POST /{id}/complete` die zweite, offene
    Tür: eine abgesagte Aufgabe ließ sich abschließen, und `bulk_complete`
    tat es gleich reihenweise (Wurzel 5).
    """
    from src.features.tasks.schemas import TaskDetail

    svc, m = _svc()
    svc.get_detail = MagicMock(  # type: ignore[method-assign]
        return_value=TaskDetail(
            id="t1", tenant_id="T", title="Endreinigung",
            status=TaskStatus.cancelled, checklist=[],
        )
    )
    with pytest.raises(TaskError) as exc:
        svc.complete_task("T", "t1", "u1")
    assert exc.value.status_code == 422
    m.table.return_value.update.assert_not_called()


def test_complete_task_zweiter_abschluss_schreibt_nicht_um() -> None:
    """Doppelter Abschluss ist kein Fehler, aber auch keine Neuzuschreibung.

    Ohne den Idempotenz-Zweig hätte der zweite Aufruf `completed_by` auf den
    zweiten Tipper gesetzt und `completed_at` nach vorn geschoben — die
    Aufgabe hätte plötzlich jemand anderes erledigt (Wurzel 2).
    """
    from src.features.tasks.schemas import TaskDetail

    svc, m = _svc()
    detail = TaskDetail(
        id="t1", tenant_id="T", title="Endreinigung",
        status=TaskStatus.done, checklist=[],
    )
    svc.get_detail = MagicMock(return_value=detail)  # type: ignore[method-assign]
    ergebnis = svc.complete_task("T", "t1", "u2")
    assert ergebnis is detail
    # Kein zweites `update`: `completed_at`/`completed_by` stehen in der DB und
    # bleiben stehen, wie sie beim ERSTEN Abschluss gesetzt wurden.
    m.table.return_value.update.assert_not_called()


# --- PM-Modul: Inspektions-Entscheidung ---

def test_inspect_reject_reopens_task() -> None:
    """Zurückweisung setzt inspection_state=to_review UND status=open zur
    Nachbearbeitung."""
    from src.features.tasks.schemas import InspectionDecision

    svc, m = _svc()
    (
        m.table.return_value.update.return_value.eq.return_value.eq.return_value.execute.return_value
    ).data = [{"id": "t1"}]
    svc.get_detail = MagicMock(  # type: ignore[method-assign]
        return_value=MagicMock()
    )
    svc.inspect("T", "t1", InspectionDecision(approved=False))
    update_payload = m.table.return_value.update.call_args.args[0]
    assert update_payload["inspection_state"] == "to_review"
    assert update_payload["status"] == "open"


# --- PM-Modul: Status-Bucket-Filter (Meine/Team-Tabs) ---

def test_filter_bucket_teilt_zeitlich_nicht_nach_status() -> None:
    """AKTUELL/BEVORSTEHENDE entscheiden sich am Termin, nicht am Status.

    Vorher galt „current = in_progress", wodurch eine heute fällige offene
    Aufgabe unter BEVORSTEHENDE landete und der AKTUELL-Reiter leer blieb.
    """
    from datetime import UTC, datetime, timedelta

    from src.features.tasks.schemas import Task

    now = datetime.now(UTC)

    def _t(tid: str, status: TaskStatus, start: datetime | None) -> Task:
        return Task(id=tid, tenant_id="T", title=tid, status=status, start_at=start)

    faellig = _t("faellig", TaskStatus.open, now - timedelta(hours=2))
    kommend = _t("kommend", TaskStatus.open, now + timedelta(days=3))
    laufend = _t("laufend", TaskStatus.in_progress, now - timedelta(days=1))
    erledigt = _t("erledigt", TaskStatus.done, now - timedelta(days=5))
    storniert = _t("storniert", TaskStatus.cancelled, now - timedelta(days=5))
    tasks = [faellig, kommend, laufend, erledigt, storniert]

    current = {t.id for t in TasksService._filter_bucket(tasks, "current")}
    assert current == {"faellig", "laufend"}
    upcoming = {t.id for t in TasksService._filter_bucket(tasks, "upcoming")}
    assert upcoming == {"kommend"}
    done = {t.id for t in TasksService._filter_bucket(tasks, "done")}
    assert done == {"erledigt", "storniert"}
    assert len(TasksService._filter_bucket(tasks, None)) == 5


def test_filter_bucket_tagesgrenze_holt_heute_spaeter_faellige_in_aktuell() -> None:
    """Mit Tagesgrenze gehört ALLES bis Mitternacht unter AKTUELL.

    Der Fehler davor: verglichen wurde gegen `now()` — ein Zeitpunkt, wo eine
    Tagesgrenze hingehört. Eine heute um 16:00 fällige Aufgabe lag morgens um
    09:00 unter BEVORSTEHEND, zwischen den Aufgaben der nächsten Woche, obwohl
    der Docstring der Funktion das Gegenteil zusagt. Live (23.08.2026) traf das
    8 von 57 offenen Aufgaben; die 49 Aufgaben auf UTC-Mitternacht zusätzlich im
    Fenster 00:00–02:00 Ortszeit, weil 00:00 UTC = 02:00 in Kopenhagen ist.
    """
    from datetime import UTC, datetime

    from src.features.tasks.schemas import Task

    def _t(tid: str, faellig: datetime) -> Task:
        return Task(
            id=tid, tenant_id="T", title=tid, status=TaskStatus.open, due_at=faellig
        )

    # Es ist 08:54 in Kopenhagen (06:54 UTC); der Tag endet 24.08. 00:00 lokal.
    grenze = datetime(2026, 8, 23, 22, 0, tzinfo=UTC)
    aufgaben = [
        _t("heute_frueh", datetime(2026, 8, 23, 0, 0, tzinfo=UTC)),
        _t("heute_spaet", datetime(2026, 8, 23, 16, 0, tzinfo=UTC)),
        _t("ueberfaellig", datetime(2026, 8, 22, 10, 0, tzinfo=UTC)),
        _t("morgen", datetime(2026, 8, 24, 9, 0, tzinfo=UTC)),
    ]

    current = {t.id for t in TasksService._filter_bucket(aufgaben, "current", grenze)}
    # „heute_spaet" ist der Kern: mit `now()` wäre sie draußen gewesen.
    assert current == {"heute_frueh", "heute_spaet", "ueberfaellig"}
    upcoming = {t.id for t in TasksService._filter_bucket(aufgaben, "upcoming", grenze)}
    assert upcoming == {"morgen"}

    # Die Grenze selbst gehört zum NÄCHSTEN Tag (kein Off-by-one).
    genau = [_t("mitternacht", grenze)]
    assert TasksService._filter_bucket(genau, "current", grenze) == []
    assert len(TasksService._filter_bucket(genau, "upcoming", grenze)) == 1


def test_filter_bucket_ohne_tagesgrenze_bleibt_beim_altverhalten() -> None:
    """Ohne Grenze (ältere App-Fassung) ändert sich nichts.

    Die Klammer gegen einen stillen Verhaltenswechsel: eine App, die den neuen
    Parameter nicht kennt, muss weiter genau dieselbe Einteilung bekommen —
    inklusive `<=`, damit eine Aufgabe mit dem Termin JETZT unter AKTUELL fällt.
    """
    from datetime import UTC, datetime, timedelta

    from src.features.tasks.schemas import Task

    now = datetime.now(UTC)
    spaeter = Task(
        id="spaeter",
        tenant_id="T",
        title="spaeter",
        status=TaskStatus.open,
        due_at=now + timedelta(hours=6),
    )
    # Ohne Grenze bleibt die heute später fällige Aufgabe BEVORSTEHEND — das ist
    # das alte Verhalten und hier ausdrücklich gewollt.
    assert TasksService._filter_bucket([spaeter], "current") == []
    assert len(TasksService._filter_bucket([spaeter], "upcoming")) == 1


# --- Wurzel 9: by-reservation scopt wie der Buchungs-Slice ------------------
#
# Angriff: Ein Eigentümer schiebt die reservation_id einer Buchung an einem
# NICHT zugeordneten Objekt desselben Betriebs unter. Der reservations-Slice
# 404t das (reads.detail), dieser Pfad tat es nicht — der Item-Pfad gab mehr
# her als der List-Pfad.

OWN_PROP = "p-own"
FOREIGN_PROP = "p-fremd"


class _TaskTableFake:
    def __init__(self, rows: list[dict]) -> None:
        self._rows = rows

    def select(self, *_a: object, **_k: object) -> "_TaskTableFake":
        return self

    def order(self, *_a: object, **_k: object) -> "_TaskTableFake":
        return self

    def limit(self, *_a: object, **_k: object) -> "_TaskTableFake":
        return self

    def eq(self, col: str, val: object) -> "_TaskTableFake":
        return _TaskTableFake([r for r in self._rows if r.get(col) == val])

    def execute(self) -> object:
        from types import SimpleNamespace

        return SimpleNamespace(data=list(self._rows))


class _TaskDBFake:
    def __init__(self, tables: dict[str, list[dict]]) -> None:
        self._tables = tables

    def table(self, name: str) -> _TaskTableFake:
        return _TaskTableFake(list(self._tables.get(name, [])))


def _resv_svc(assigned: list[str], resv_property: str) -> TasksService:
    """Buchung an `resv_property`; `assigned` = Objekte des Anfragenden."""
    return TasksService(
        client=_TaskDBFake(  # type: ignore[arg-type]
            {
                "reservations": [
                    {"id": RES_ID, "tenant_id": "T", "property_id": resv_property}
                ],
                "tasks": [
                    {
                        "id": "task-1",
                        "tenant_id": "T",
                        "reservation_id": RES_ID,
                        "property_id": resv_property,
                        "title": "Endreinigung",
                        "status": "open",
                    }
                ],
                "owner_property_assignments": [
                    {"property_id": p, "tenant_id": "T", "user_id": "u1"}
                    for p in assigned
                ],
                "staff_property_assignments": [
                    {"property_id": p, "tenant_id": "T", "user_id": "u1"}
                    for p in assigned
                ],
            }
        )
    )


def _owner_task_ctx() -> AuthContext:
    return AuthContext(user_id="u1", tenant_id="T", role="owner")


def test_by_reservation_foreign_property_is_404() -> None:
    """Eigentümer + fremdes Objekt → 404 wie im reservations-Slice."""
    svc = _resv_svc(assigned=[OWN_PROP], resv_property=FOREIGN_PROP)
    with pytest.raises(TaskError) as exc:
        svc.list_by_reservation("T", RES_ID, _owner_task_ctx())
    assert exc.value.status_code == 404


def test_by_reservation_without_assignment_is_404() -> None:
    """Fail-closed: keine Zuordnung → nichts."""
    svc = _resv_svc(assigned=[], resv_property=OWN_PROP)
    with pytest.raises(TaskError) as exc:
        svc.list_by_reservation("T", RES_ID, _owner_task_ctx())
    assert exc.value.status_code == 404


def test_by_reservation_staff_scope_applies() -> None:
    """§4.3: derselbe Schnitt für staff/cleaner."""
    svc = _resv_svc(assigned=[OWN_PROP], resv_property=FOREIGN_PROP)
    ctx = AuthContext(user_id="u1", tenant_id="T", role="cleaner")
    with pytest.raises(TaskError) as exc:
        svc.list_by_reservation("T", RES_ID, ctx)
    assert exc.value.status_code == 404


def test_by_reservation_own_property_returns_tasks() -> None:
    """Gegenprobe: das zugeordnete Objekt liefert die Aufgaben."""
    svc = _resv_svc(assigned=[OWN_PROP], resv_property=OWN_PROP)
    tasks = svc.list_by_reservation("T", RES_ID, _owner_task_ctx())
    assert [t.id for t in tasks] == ["task-1"]


def test_by_reservation_admin_not_restricted() -> None:
    """admin sieht die Aufgaben auch ohne Zuordnung."""
    svc = _resv_svc(assigned=[], resv_property=FOREIGN_PROP)
    ctx = AuthContext(user_id="u1", tenant_id="T", role="admin")
    assert len(svc.list_by_reservation("T", RES_ID, ctx)) == 1


def test_by_reservation_foreign_tenant_is_404() -> None:
    """Cross-Tenant bleibt 404 (Wurzel 3)."""
    svc = _resv_svc(assigned=[OWN_PROP], resv_property=OWN_PROP)
    with pytest.raises(TaskError) as exc:
        svc.list_by_reservation("FREMD", RES_ID, _owner_task_ctx())
    assert exc.value.status_code == 404


def test_by_reservation_non_uuid_is_404_not_500() -> None:
    """Wurzel 5: Fehl-Input darf keinen 500 werfen."""
    svc = _resv_svc(assigned=[OWN_PROP], resv_property=OWN_PROP)
    with pytest.raises(TaskError) as exc:
        svc.list_by_reservation("T", "not-a-uuid", _owner_task_ctx())
    assert exc.value.status_code == 404


# --- 0360: vierter Status, Abhaken, Kosten, Rückmeldung --------------------
#
# Diese Tests laufen gegen ein zustandsbehaftetes DB-Doppel statt gegen
# MagicMock-Ketten: `get_detail` liest sechs Tabellen, und eine Kette je Pfad
# zu stellen sagt am Ende mehr über die Mocks als über den Dienst.


class _FakeQuery:
    def __init__(self, db: "_FakeDB", table: str) -> None:
        self._db = db
        self._table = table
        self._filters: list[tuple[str, object]] = []
        self._patch: dict | None = None
        self._delete = False
        self._insert: dict | None = None
        self._upsert: dict | None = None

    def select(self, *_a: object, **_k: object) -> "_FakeQuery":
        return self

    def eq(self, col: str, val: object) -> "_FakeQuery":
        self._filters.append((col, val))
        return self

    def in_(self, col: str, vals: list) -> "_FakeQuery":
        self._filters.append((col, ("__in__", tuple(str(v) for v in vals))))
        return self

    def neq(self, col: str, val: object) -> "_FakeQuery":
        self._filters.append((col, ("__neq__", val)))
        return self

    def lt(self, col: str, val: object) -> "_FakeQuery":
        # ISO-Datumstexte vergleichen sich zeichenweise richtig.
        self._filters.append((col, ("__lt__", val)))
        return self

    def gt(self, col: str, val: object) -> "_FakeQuery":
        self._filters.append((col, ("__gt__", val)))
        return self

    def is_(self, col: str, val: object) -> "_FakeQuery":
        # PostgREST-`is` prüft NULL-Sein. Muss echt filtern: der Bestandsfilter
        # `nur_im_bestand` hängt daran, und eine Attrappe, die ihn durchwinkt,
        # bewiese, dass archivierte Objekte ausgeblendet werden, obwohl sie es
        # nicht sind.
        self._filters.append((col, ("__is__", val)))
        return self

    def order(self, *_a: object, **_k: object) -> "_FakeQuery":
        return self

    def limit(self, _n: int) -> "_FakeQuery":
        return self

    def update(self, patch: dict) -> "_FakeQuery":
        self._patch = patch
        return self

    def insert(self, row: dict) -> "_FakeQuery":
        self._insert = row
        return self

    def upsert(self, row: dict, **_k: object) -> "_FakeQuery":
        self._upsert = row
        return self

    def delete(self) -> "_FakeQuery":
        self._delete = True
        return self

    def _passt(self, row: dict) -> bool:
        for col, val in self._filters:
            if isinstance(val, tuple) and val and val[0] == "__in__":
                if str(row.get(col)) not in val[1]:
                    return False
            elif isinstance(val, tuple) and val and val[0] == "__is__":
                ist_null = row.get(col) is None
                if ist_null != (val[1] in ("null", None)):
                    return False
            elif isinstance(val, tuple) and val and val[0] == "__neq__":
                if str(row.get(col)) == str(val[1]):
                    return False
            elif isinstance(val, tuple) and val and val[0] == "__lt__":
                if not str(row.get(col)) < str(val[1]):
                    return False
            elif isinstance(val, tuple) and val and val[0] == "__gt__":
                if not str(row.get(col)) > str(val[1]):
                    return False
            elif str(row.get(col)) != str(val):
                return False
        return True

    def execute(self) -> MagicMock:
        rows = self._db.tables.setdefault(self._table, [])
        treffer = [r for r in rows if self._passt(r)]
        if self._patch is not None:
            for r in treffer:
                r.update(self._patch)
            return MagicMock(data=list(treffer))
        if self._delete:
            self._db.tables[self._table] = [r for r in rows if r not in treffer]
            return MagicMock(data=list(treffer))
        if self._insert is not None:
            neu = {"id": f"neu-{len(rows) + 1}", **self._insert}
            rows.append(neu)
            return MagicMock(data=[neu])
        if self._upsert is not None:
            schluessel = "task_id"
            vorhanden = [
                r for r in rows if r.get(schluessel) == self._upsert.get(schluessel)
            ]
            if vorhanden:
                vorhanden[0].update(self._upsert)
                return MagicMock(data=[vorhanden[0]])
            rows.append(dict(self._upsert))
            return MagicMock(data=[rows[-1]])
        return MagicMock(data=list(treffer))


class _FakeDB:
    def __init__(self, tables: dict[str, list[dict]]) -> None:
        self.tables = tables

    def table(self, name: str) -> _FakeQuery:
        return _FakeQuery(self, name)


def _tables(**extra: list[dict]) -> dict[str, list[dict]]:
    basis: dict[str, list[dict]] = {
        "tasks": [
            {
                "id": "t1", "tenant_id": "T", "title": "Endreinigung",
                "status": "open", "property_id": "p1", "assignee_id": "u1",
            }
        ],
        "properties": [{"id": "p1", "tenant_id": "T", "title": "Haus", "currency": "DKK"}],
        "tenants": [{"id": "T", "currency": "EUR"}],
        # `role` steht hier, weil der Schreibpfad sie liest: nur staff/cleaner
        # hängen am Objekt-Scope, admin/co_admin/owner nicht
        # (`_require_own_assignee`).
        "users": [
            {"id": "u1", "tenant_id": "T", "full_name": "Reinigung", "role": "cleaner"},
            {"id": "u2", "tenant_id": "T", "full_name": "Zweite", "role": "cleaner"},
            {"id": "a1", "tenant_id": "T", "full_name": "Chefin", "role": "admin"},
        ],
        "checklist_items": [],
        "checklist_photos": [],
        "task_costs": [],
        "task_resolutions": [],
        "reservations": [],
        # Der cleaner arbeitet NUR an freigegebenen Objekten (§4.3). Ohne diese
        # Zeile ist er fail-closed ausgesperrt — genau richtig, aber dann
        # prüfen die Tests unten den Scope statt der neuen Funktionen.
        "staff_property_assignments": [
            {"tenant_id": "T", "user_id": "u1", "property_id": "p1"}
        ],
    }
    basis.update(extra)
    return basis


def _admin() -> AuthContext:
    return AuthContext(user_id="a1", tenant_id="T", role="admin")


def _cleaner() -> AuthContext:
    return AuthContext(user_id="u1", tenant_id="T", role="cleaner")


def _owner() -> AuthContext:
    return AuthContext(user_id="o1", tenant_id="T", role="owner")


# --- Eigentümer als Zuständiger (03.09.2026) ---------------------------------
#
# Der Nutzer: „hier in das popup müssen wir eine funktion bekommen wenn ich
# unter Zuständig auch den haus eigentümer auswählen kann". Manche Eigentümer
# reinigen oder empfangen selbst. Bis dahin war der Eigentümer BEWUSST aus der
# Auswahl entfernt, weil er die Aufgabe nie hätte öffnen können — ihn nur in
# die Liste zu setzen wäre derselbe Fehler noch einmal. Deshalb prüfen diese
# Tests den GANZEN Weg: Auswahl, Schreibpfad, Lesepfad, Regel-Sperre.


def _eigentuemer_db(**extra: list[dict]) -> _FakeDB:
    basis = dict(
        users=[
            {"id": "u1", "tenant_id": "T", "full_name": "Reinigung",
             "role": "cleaner", "email": "r@x.dk"},
            {"id": "o1", "tenant_id": "T", "full_name": "Eigentümer Britt",
             "role": "owner", "email": "o@x.dk"},
        ],
        owner_property_assignments=[
            {"tenant_id": "T", "user_id": "o1", "property_id": "p1"},
        ],
        staff_property_assignments=[
            {"tenant_id": "T", "user_id": "u1", "property_id": "p1"},
            {"tenant_id": "T", "user_id": "u1", "property_id": "p2"},
        ],
        properties=[
            {"id": "p1", "tenant_id": "T", "title": "Britt", "currency": "DKK"},
            {"id": "p2", "tenant_id": "T", "title": "Dora", "currency": "DKK"},
        ],
        tasks=[
            {"id": "t1", "tenant_id": "T", "title": "Reinigung", "status": "open",
             "property_id": "p1", "assignee_id": "u1"},
            {"id": "t2", "tenant_id": "T", "title": "Reinigung", "status": "open",
             "property_id": "p1", "assignee_id": "o1"},
            {"id": "t3", "tenant_id": "T", "title": "Reinigung", "status": "open",
             "property_id": "p2", "assignee_id": "o1"},
            {"id": "t4", "tenant_id": "T", "title": "Lager", "status": "open",
             "property_id": None, "assignee_id": "o1"},
        ],
    )
    basis.update(extra)
    return _FakeDB(_tables(**basis))


def test_eigentuemer_steht_nur_fuer_sein_objekt_zur_wahl() -> None:
    """Ohne Objekt fehlt er (Pool-Aufgabe, Filter, Regel-Editor); mit seinem
    Objekt ist er da; mit einem fremden nicht. Dieselbe Regel wie der
    Schreibpfad — die Liste darf nichts versprechen, was 422 wird."""
    svc = TasksService(client=_eigentuemer_db())
    assert "o1" not in {o.user_id for o in svc.moegliche_zustaendige("T")}
    assert {o.user_id for o in svc.moegliche_zustaendige("T", "p1")} == {"u1", "o1"}
    assert "o1" not in {o.user_id for o in svc.moegliche_zustaendige("T", "p2")}


def test_eigentuemer_zuweisung_nur_an_eigenem_objekt() -> None:
    """Schreibpfad: eigenes Objekt geht durch, fremdes und Pool sind 422 —
    eine Zuweisung, die der Empfänger nie sähe, ist kein Erfolg."""
    svc = TasksService(client=_eigentuemer_db())
    svc._require_own_assignee("T", "o1", "p1")  # eigenes Objekt: ok
    with pytest.raises(TaskError) as exc:
        svc._require_own_assignee("T", "o1", "p2")
    assert exc.value.status_code == 422
    with pytest.raises(TaskError) as exc:
        svc._require_own_assignee("T", "o1", None)
    assert exc.value.status_code == 422
    assert "Objektbezug" in exc.value.message


def test_eigentuemer_sieht_nur_die_ihm_zugewiesene_aufgabe_an_seinem_objekt() -> None:
    """Lesepfad, derselbe Scope wie die Liste (Wurzel 9).

    t1: fremde Zuweisung an seinem Haus — NICHT sichtbar (wer putzt, ist
    Personaleinsatz des Betriebs, §4.3). t2: seine Aufgabe an seinem Haus —
    sichtbar. t3: seine Aufgabe an einem fremden Haus — nicht sichtbar.
    t4: Pool-Aufgabe — nicht sichtbar. Alles Unsichtbare ist 404, nie 403:
    kein Orakel über fremde Aufgaben.
    """
    svc = TasksService(client=_eigentuemer_db())
    svc._require_own_task("T", "t2", _owner())
    for fremd in ("t1", "t3", "t4"):
        with pytest.raises(TaskError) as exc:
            svc._require_own_task("T", fremd, _owner())
        assert exc.value.status_code == 404, fremd


def test_zuweisung_an_eigentuemer_loest_die_meldung_aus(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """„die mail muss an den eigentümer raus gehen sobald er eingeteilt wird".

    Der Weg ist derselbe wie beim Personal: `set_assignee` → 
    `melde_aufgaben_zuweisung` → Dispatcher (Glocke + Mail). Dieser Test hält
    fest, dass der Eigentümer diesen Weg auch wirklich erreicht — mit SEINER
    id als Empfänger und dem Objekt, damit die Mail das Portal-Ziel bekommt.
    """
    gerufen: list[dict] = []
    monkeypatch.setattr(
        "src.features.tasks.service.melde_aufgaben_zuweisung",
        lambda *_a, **k: gerufen.append(k),
    )
    svc = TasksService(client=_eigentuemer_db())
    d = svc.set_assignee("T", "t1", "o1", _admin())  # t1: p1, vorher u1
    assert d.assignee_id == "o1"
    assert len(gerufen) == 1, "keine Meldung an den Eigentümer"
    assert gerufen[0]["assignee_id"] == "o1"
    assert gerufen[0]["property_id"] == "p1"
    assert gerufen[0]["task_id"] == "t1"


def test_regel_darf_keinem_eigentuemer_gehoeren() -> None:
    """Eine Regel legt Aufgaben an ALLEN ihren Objekten an — auch an fremden.
    `_require_own_assignee` prüft beim Regel-Speichern nur das erste Objekt und
    ließe das durch; deshalb die eigene Sperre."""
    svc = TasksService(client=_eigentuemer_db())
    with pytest.raises(TaskError) as exc:
        svc._kein_eigentuemer_als_regelzustaendiger("T", "o1")
    assert exc.value.status_code == 422
    svc._kein_eigentuemer_als_regelzustaendiger("T", "u1")  # Personal: ok
    svc._kein_eigentuemer_als_regelzustaendiger("T", None)  # ohne Zuständigen: ok


def test_vertretung_benachrichtigt_die_moeglichen_vertreter(monkeypatch) -> None:
    """Eine Anfrage erreichte bis 0415 NIEMANDEN — nur eine Log-Zeile.

    Der Empfaengerkreis ist derselbe, aus dem eine Zuweisung schoepfen darf
    (Capability + Objekt-Freigabe), minus dem Anfragenden.
    """
    gesendet: dict[str, object] = {}

    def _fake(_db, **kwargs):
        gesendet.update(kwargs)

    monkeypatch.setattr(
        "src.features.tasks.service.melde_vertretung_gesucht", _fake
    )
    db = _FakeDB(
        _tables(
            staff_property_assignments=[
                {"tenant_id": "T", "user_id": "u1", "property_id": "p1"},
                # Zweite Reinigungskraft MIT Freigabe fuer dasselbe Objekt —
                # nur sie kann die Aufgabe ueberhaupt uebernehmen.
                {"tenant_id": "T", "user_id": "u2", "property_id": "p1"},
            ]
        )
    )
    svc = TasksService(client=db)
    svc.request_substitution(
        "T", "u1", SubstitutionRequest(task_id="t1", note="krank")
    )
    assert gesendet["task_id"] == "t1"
    empfaenger = gesendet["empfaenger_ids"]
    assert "u1" not in empfaenger  # man vertritt sich nicht selbst
    assert "u2" in empfaenger
    # Wer fuer das Objekt NICHT freigegeben ist, wird nicht gefragt: er koennte
    # die Aufgabe ohnehin nicht uebernehmen (Wurzel 9).
    assert gesendet["titel"] == "Endreinigung"


def test_vertretung_antwort_geht_an_den_anfragenden(monkeypatch) -> None:
    """Ohne diese Meldung weiss der Anfragende nicht, ob er noch fahren muss."""
    antworten: list[dict[str, object]] = []

    def _fake(_db, **kwargs):
        antworten.append(kwargs)

    monkeypatch.setattr(
        "src.features.tasks.service.melde_vertretung_entschieden", _fake
    )
    db = _FakeDB(
        _tables(
            task_substitutions=[
                {
                    "id": "s1", "tenant_id": "T", "task_id": "t1",
                    "requested_by": "u1", "status": "requested", "note": None,
                    "accepted_by": None,
                }
            ],
            staff_property_assignments=[
                {"tenant_id": "T", "user_id": "u1", "property_id": "p1"},
                {"tenant_id": "T", "user_id": "u2", "property_id": "p1"},
            ],
        )
    )
    svc = TasksService(client=db)
    svc.accept_substitution("T", "s1", "u2", _admin())
    assert antworten[-1]["empfaenger_id"] == "u1"
    assert antworten[-1]["uebernommen"] is True
    # Der Name des Vertreters steht in der Uebernahme-Meldung.
    assert antworten[-1]["durch_name"] == "Zweite"


def test_vertretung_ablehnung_nennt_keinen_namen(monkeypatch) -> None:
    """Eine Absage ist keine Anschuldigung — kein Name in der Meldung."""
    antworten: list[dict[str, object]] = []
    monkeypatch.setattr(
        "src.features.tasks.service.melde_vertretung_entschieden",
        lambda _db, **kwargs: antworten.append(kwargs),
    )
    db = _FakeDB(
        _tables(
            task_substitutions=[
                {
                    "id": "s1", "tenant_id": "T", "task_id": "t1",
                    "requested_by": "u1", "status": "requested", "note": None,
                    "accepted_by": None,
                }
            ]
        )
    )
    svc = TasksService(client=db)
    svc.decline_substitution("T", "s1", "u2", _admin())
    assert antworten[-1]["uebernommen"] is False
    assert antworten[-1]["durch_name"] is None


def test_detail_traegt_buchungsbezug_ohne_gastdaten() -> None:
    """Das Detail nennt Referenz UND Zeitraum der Buchung — aber nichts sonst.

    Für die ausführende Person ist „ab wann ist das Objekt frei" die
    Arbeitsangabe; sie fehlte im Detail komplett, obwohl die Liste daneben die
    Referenz schon zeigte (TaskDetail erbte von der schmalen Task-Basis und
    verwarf `reservation_ref` stillschweigend).
    """
    db = _FakeDB(
        _tables(
            tasks=[
                {
                    "id": "t1", "tenant_id": "T", "title": "Endreinigung",
                    "status": "open", "property_id": "p1", "assignee_id": "u1",
                    "reservation_id": "r1",
                }
            ],
            reservations=[
                {
                    "id": "r1", "tenant_id": "T", "external_ref": "5318730188",
                    "check_in": "2026-08-18", "check_out": "2026-08-22",
                    "guest_name": "Gun Heiboe", "total_amount": "4905.00",
                }
            ],
        )
    )
    svc = TasksService(client=db)
    d = svc.get_detail("T", "t1", _cleaner())
    assert d.reservation_ref == "5318730188"
    assert d.reservation_check_in == "2026-08-18"
    assert d.reservation_check_out == "2026-08-22"
    # §4.3: kein Gastname, kein Betrag — auch nicht als Nebenprodukt.
    werte = d.model_dump()
    assert "guest_name" not in werte
    assert "total_amount" not in werte


def test_detail_ohne_buchung_erfindet_keinen_zeitraum() -> None:
    """Wurzel 4: keine Buchung heißt `None`, nicht ein plausibler Tag."""
    db = _FakeDB(_tables())
    svc = TasksService(client=db)
    d = svc.get_detail("T", "t1", _admin())
    assert d.reservation_ref is None
    assert d.reservation_check_in is None
    assert d.reservation_check_out is None


def test_detail_liest_die_buchung_nur_im_eigenen_mandanten() -> None:
    """Wurzel 3: die Buchung wird über tenant_id UND id geladen."""
    db = _FakeDB(
        _tables(
            tasks=[
                {
                    "id": "t1", "tenant_id": "T", "title": "X", "status": "open",
                    "property_id": "p1", "reservation_id": "r-fremd",
                }
            ],
            reservations=[
                {
                    "id": "r-fremd", "tenant_id": "FREMD", "external_ref": "999",
                    "check_in": "2026-08-18", "check_out": "2026-08-22",
                }
            ],
        )
    )
    svc = TasksService(client=db)
    d = svc.get_detail("T", "t1", _admin())
    assert d.reservation_check_in is None
    assert d.reservation_ref is None


def test_upload_prueft_die_bytes_nicht_den_header() -> None:
    """Wurzel 8: `content_type` ist eine Behauptung des Clients.

    Vorher entschied allein der Header, ob eine Datei „ein Bild" ist. Damit
    landete alles im Bucket, was `image/jpeg` behauptete — auch Markup, das ein
    Browser später ausführt.
    """
    db = _FakeDB(_tables(checklist_items=[
        {"id": "c1", "task_id": "t1", "label": "Bad", "done": False,
         "requires_photo": True, "sort_order": 0},
    ]))
    svc = TasksService(client=db)
    with pytest.raises(TaskError) as exc:
        svc.upload_checklist_photo(
            "T", "c1", b"<svg onload=alert(1)>", "image/jpeg", _cleaner()
        )
    assert exc.value.status_code == 415


def test_upload_nimmt_echtes_jpeg_an() -> None:
    db = _FakeDB(_tables(checklist_items=[
        {"id": "c1", "task_id": "t1", "label": "Bad", "done": False,
         "requires_photo": True, "sort_order": 0},
    ]))
    svc = TasksService(client=db)
    db.storage = MagicMock()  # type: ignore[attr-defined]
    foto_id = svc.upload_checklist_photo(
        "T", "c1", b"\xff\xd8\xff\xe0" + b"0" * 64, "image/jpeg", _cleaner()
    )
    assert foto_id
    assert len(db.tables["checklist_photos"]) == 1
    # Der Pfad trägt die Endung des ECHTEN Typs, nicht die des Headers.
    assert db.tables["checklist_photos"][0]["storage_path"].endswith(".jpg")


# --- Regel-Zeitfenster: Ende darf nicht vor dem Start liegen (31.08.2026) ----


def _regel(**kw: object) -> RuleCreate:
    """Eine planmaessige Regel mit Vorgaben, die den Test nicht interessieren."""
    basis: dict[str, object] = {
        "kind": TaskRuleKind.auto,
        "name": "Velk T",
        "start_trigger": TaskTrigger.check_in,
        "end_trigger": TaskTrigger.check_in,
        "start_offset_minutes": 0,
        # 240, nicht 1440: ein 24-Stunden-Fenster an derselben Basis ist seit
        # dem 03.09.2026 selbst ein Ablehnungsgrund — als Vorgabe wuerde es
        # jeden „erlaubt"-Test aus dem falschen Grund kippen.
        "end_offset_minutes": 240,
    }
    basis.update(kw)
    return RuleCreate(**basis)  # type: ignore[arg-type]


# --- Regel-Zeitfenster: Uhrzeit am Tagesanker, kein 24h-Fenster (03.09.2026) --


def test_regel_tagesanker_ohne_uhrzeit_wird_abgelehnt() -> None:
    """„Am Anreisetag" ohne Stunde heisst Tagesbeginn 00:00 — keine Arbeitszeit.

    Live standen 261 Aufgaben so da; die Detailansicht zeigte „Von 02:00",
    weil der Altbestand ohne Zone gerechnet war. Der Anker verlangt die Stunde.
    """
    with pytest.raises(TaskError) as exc:
        TasksService._pruefe_zeitfenster(
            _regel(
                start_trigger=TaskTrigger.arrival_day,
                end_trigger=TaskTrigger.arrival_day,
                start_clock=None,
                end_clock=None,
                end_offset_minutes=0,
            )
        )
    assert exc.value.status_code == 422
    assert "Uhrzeit" in exc.value.message


def test_regel_tagesanker_mit_uhrzeit_ist_erlaubt() -> None:
    """Die korrigierte Live-Form: Reinigung am Abreisetag 10:00 bis 14:00."""
    TasksService._pruefe_zeitfenster(
        _regel(
            start_trigger=TaskTrigger.departure_day,
            end_trigger=TaskTrigger.departure_day,
            start_clock=time(10, 0),
            end_clock=time(14, 0),
            end_offset_minutes=0,
        )
    )


def test_regel_fenster_ueber_einen_tag_wird_abgelehnt() -> None:
    """„Beim Check-in bis Check-in + 1440" — die Form der 233 falschen Aufgaben.

    Das Ende liegt einen ganzen Tag nach dem Start; im Kalender endete die
    Aufgabe eine Spalte hinter ihrer Buchung. Der Nutzer: „hinweise sind auch
    fehler".
    """
    with pytest.raises(TaskError) as exc:
        TasksService._pruefe_zeitfenster(
            _regel(
                start_trigger=TaskTrigger.check_in,
                end_trigger=TaskTrigger.check_in,
                end_offset_minutes=1440,
            )
        )
    assert exc.value.status_code == 422
    assert "über den Tag" in exc.value.message


def test_regel_anreise_bis_abreise_ist_kein_24h_fehler() -> None:
    """Zwei VERSCHIEDENE Basen duerfen weiter auseinanderliegen — eine
    Aufenthaltsaufgabe von der Anreise bis zur Abreise ist kein Fehler."""
    TasksService._pruefe_zeitfenster(
        _regel(
            start_trigger=TaskTrigger.arrival_day,
            end_trigger=TaskTrigger.departure_day,
            start_clock=time(10, 0),
            end_clock=time(14, 0),
            end_offset_minutes=0,
        )
    )


def test_regel_ende_vor_start_wird_abgelehnt() -> None:
    """Die Wurzel der 161 falsch stehenden Live-Aufgaben: Start = Abreise,
    Ende = Anreise liess sich speichern (Wurzel 5)."""
    with pytest.raises(TaskError) as exc:
        TasksService._pruefe_zeitfenster(
            _regel(
                start_trigger=TaskTrigger.check_out,
                end_trigger=TaskTrigger.check_in,
            )
        )
    assert exc.value.status_code == 422


def test_regel_gleicher_anker_negativer_endversatz_abgelehnt() -> None:
    """Gleiche Basis, aber das Ende liegt frueher — derselbe Fehler eine Ebene
    feiner."""
    with pytest.raises(TaskError) as exc:
        TasksService._pruefe_zeitfenster(
            _regel(start_offset_minutes=0, end_offset_minutes=-1440)
        )
    assert exc.value.status_code == 422


# Die „erlaubt"-Faelle pruefen die PRUEFUNG, nicht den ganzen `create_rule`:
# der ruft am Ende `_regel_nachziehen`, das an der Fake-DB scheitert (kein
# `.not_`). Ein Testumbau dafuer waere Aufwand ohne Erkenntnis — geprueft
# gehoert, ob die Regel durchgelassen wird, und genau das tut dieser Aufruf.
def test_regel_ende_gleich_start_ist_erlaubt() -> None:
    """Ein Termin ohne Dauer ist kein Fehler."""
    TasksService._pruefe_zeitfenster(_regel(end_offset_minutes=0))


def test_regel_anreise_bis_abreise_bleibt_erlaubt() -> None:
    """Der Regelfall einer Aufenthaltsaufgabe: Anreise bis Abreise."""
    TasksService._pruefe_zeitfenster(
        _regel(
            start_trigger=TaskTrigger.check_in,
            end_trigger=TaskTrigger.check_out,
            end_offset_minutes=0,
        )
    )


def test_regel_unbestimmbare_ordnung_wird_durchgelassen() -> None:
    """`booking_confirmed` liegt irgendwann vor der Anreise — wie weit, weiss
    nur die Buchung. Eine solche Regel abzulehnen hiesse, gueltige Faelle zu
    verbieten; den Einzelfall faengt der Motor ab."""
    TasksService._pruefe_zeitfenster(
        _regel(
            start_trigger=TaskTrigger.booking_confirmed,
            end_trigger=TaskTrigger.check_in,
            end_offset_minutes=0,
        )
    )


# --- Regel loeschen raeumt ihre offenen Aufgaben ab (03.09.2026) -------------


def test_regel_loeschen_entfernt_die_offenen_aufgaben() -> None:
    """Sonst bleiben sie ohne Herkunft im Kalender stehen.

    Live gemeldet als „warum sind die jetzt doppelt?": eine Regel wurde
    umgebaut, indem man sie loeschte und neu anlegte — danach stand jede
    Anreise zweimal da, weil `on delete set null` die alten Aufgaben
    zurueckliess. 243 Zeilen hingen so an geloeschten Regeln.
    """
    svc, m = _svc()
    kette = m.table.return_value
    kette.select.return_value.eq.return_value.eq.return_value.in_.return_value.\
        execute.return_value.data = [{"id": "t1"}, {"id": "t2"}]
    kette.delete.return_value.eq.return_value.eq.return_value.execute.\
        return_value.data = [{"id": "r1"}]

    svc.delete_rule("T", "r1")

    # Der Statusfilter ist der Kern: erledigte Aufgaben belegen geleistete
    # Arbeit und muessen stehen bleiben.
    stati = kette.select.return_value.eq.return_value.eq.return_value.in_.\
        call_args[0]
    assert stati[0] == "status"
    assert set(stati[1]) == {"open", "in_progress"}


def test_regel_loeschen_ruehrt_bei_404_keine_aufgabe_an() -> None:
    """Die Regel-Loeschung prueft Existenz UND Tenant (Wurzel 3). Erst wenn sie
    durch ist, darf an Aufgaben etwas passieren — sonst raeumte ein Fehlgriff
    fremde Zeilen ab."""
    svc, m = _svc()
    kette = m.table.return_value
    kette.select.return_value.eq.return_value.eq.return_value.in_.return_value.\
        execute.return_value.data = [{"id": "t1"}]
    kette.delete.return_value.eq.return_value.eq.return_value.execute.\
        return_value.data = []

    with pytest.raises(TaskError) as exc:
        svc.delete_rule("T", "gibtesnicht")
    assert exc.value.status_code == 404
    # Kein Aufgaben-Delete: das laeuft ueber `.delete().eq().in_()`, waehrend
    # die Regel-Loeschung `.delete().eq().eq()` ist.
    assert not kette.delete.return_value.eq.return_value.in_.called


# --- Tages-Anker mit Uhrzeitfenster (0535) -----------------------------------


def test_tages_anker_uhrzeit_ende_vor_start_wird_abgelehnt() -> None:
    """„Am Anreisetag 14:00 bis 10:00": gleicher Anker, gleicher Versatz — nur
    die UHRZEIT unterscheidet sich. Ohne sie im Vergleich waere der Fall
    unsichtbar durchgerutscht, und genau ihn kann der Nutzer neu einstellen."""
    with pytest.raises(TaskError) as exc:
        TasksService._pruefe_zeitfenster(
            _regel(
                start_trigger=TaskTrigger.arrival_day,
                end_trigger=TaskTrigger.arrival_day,
                start_offset_minutes=0,
                end_offset_minutes=0,
                start_clock=time(14, 0),
                end_clock=time(10, 0),
            )
        )
    assert exc.value.status_code == 422


def test_tages_anker_uhrzeit_von_bis_ist_erlaubt() -> None:
    TasksService._pruefe_zeitfenster(
        _regel(
            start_trigger=TaskTrigger.arrival_day,
            end_trigger=TaskTrigger.arrival_day,
            start_offset_minutes=0,
            end_offset_minutes=0,
            start_clock=time(10, 0),
            end_clock=time(14, 0),
        )
    )


def test_uhrzeit_wird_bei_fremdem_anker_entfernt() -> None:
    """Der Gegenzustand (Wurzel 1): wer von „Am Anreisetag 10-14 Uhr" auf
    „Beim Check-in" umstellt, darf keine tote Uhrzeit in der Zeile lassen."""
    req = _regel(
        start_trigger=TaskTrigger.check_in,
        end_trigger=TaskTrigger.check_out,
        end_offset_minutes=0,
        start_clock=time(10, 0),
        end_clock=time(14, 0),
    )
    TasksService._bereinige_uhrzeiten(req)
    assert req.start_clock is None
    assert req.end_clock is None


def test_uhrzeit_bleibt_am_tages_anker_stehen() -> None:
    req = _regel(
        start_trigger=TaskTrigger.departure_day,
        end_trigger=TaskTrigger.departure_day,
        start_offset_minutes=0,
        end_offset_minutes=0,
        start_clock=time(8, 0),
        end_clock=time(11, 0),
    )
    TasksService._bereinige_uhrzeiten(req)
    assert req.start_clock == time(8, 0)
    assert req.end_clock == time(11, 0)


def test_alter_versatz_wird_am_tages_anker_genullt() -> None:
    """DIE WURZEL des Fehlers vom 03.09.2026.

    Die Regel „Velk T" wurde von „Tage vor der Anreise → Beim Check-in" auf
    „Am Anreisetag 10:00 bis 16:00" umgestellt. Der alte
    `end_offset_minutes=1440` blieb stehen, weil sein Feld bei diesem Anker
    unsichtbar ist — der Motor rechnete 16:00 + einen ganzen Tag und legte das
    Ende auf den Folgetag.
    """
    req = _regel(
        start_trigger=TaskTrigger.arrival_day,
        end_trigger=TaskTrigger.arrival_day,
        start_offset_minutes=0,
        end_offset_minutes=1440,
        start_clock=time(10, 0),
        end_clock=time(16, 0),
    )
    TasksService._bereinige_uhrzeiten(req)
    assert req.end_offset_minutes == 0
    assert req.start_offset_minutes == 0
    assert req.start_clock == time(10, 0)
    assert req.end_clock == time(16, 0)


def test_versatz_fremder_anker_bleibt_unangetastet() -> None:
    """„Velk J" steht live auf `check_in` + 1440 und meint das so. Dort mit zu
    nullen waere eine stille Aenderung fremder Regeln."""
    req = _regel(
        start_trigger=TaskTrigger.days_before_check_in,
        end_trigger=TaskTrigger.check_in,
        start_offset_minutes=-2880,
        end_offset_minutes=1440,
    )
    TasksService._bereinige_uhrzeiten(req)
    assert req.start_offset_minutes == -2880
    assert req.end_offset_minutes == 1440


def test_anreisetag_zaehlt_zur_anreise_achse() -> None:
    """Sonst meldete die Deckungspruefung ein Objekt als „ohne Anreise-Regel",
    obwohl genau diese Regel dafuer existiert."""
    assert "arrival_day" in TasksService._ANREISE_TRIGGER
    assert "departure_day" not in TasksService._ANREISE_TRIGGER


# --- Zeitfenster von Hand setzen (31.08.2026) --------------------------------


def test_zeitfenster_setzt_start_ende_und_faelligkeit() -> None:
    """Der Regelfall: eine Aufgabe auf denselben Tag von 10 bis 16 Uhr legen."""
    db = _FakeDB(_tables())
    svc = TasksService(client=db)
    start = datetime(2026, 8, 28, 10, 0, tzinfo=UTC)
    ende = datetime(2026, 8, 28, 16, 0, tzinfo=UTC)
    d = svc.set_zeitfenster("T", "t1", start, ende, _admin())
    assert d.start_at == start
    assert d.end_at == ende
    # `due_at` laeuft mit (Wurzel 1): sonst sortiert jede Liste nach dem alten
    # Termin weiter.
    assert d.due_at == ende


def test_zeitfenster_lehnt_ende_vor_start_ab() -> None:
    """Genau die Luecke, durch die neun Live-Aufgaben mit einem Ende bis zu
    64 Tage VOR ihrem Start entstanden sind (Wurzel 5)."""
    db = _FakeDB(_tables())
    svc = TasksService(client=db)
    with pytest.raises(TaskError) as exc:
        svc.set_zeitfenster(
            "T",
            "t1",
            datetime(2026, 8, 28, tzinfo=UTC),
            datetime(2026, 8, 21, tzinfo=UTC),
            _admin(),
        )
    assert exc.value.status_code == 422
    # Nichts geschrieben: die Aufgabe behaelt ihren alten Stand.
    assert db.tables["tasks"][0].get("start_at") is None


def test_zeitfenster_gleicher_zeitpunkt_ist_erlaubt() -> None:
    """Start == Ende ist ein Termin ohne Dauer, kein Fehler."""
    db = _FakeDB(_tables())
    svc = TasksService(client=db)
    t = datetime(2026, 8, 28, 9, 30, tzinfo=UTC)
    d = svc.set_zeitfenster("T", "t1", t, t, _admin())
    assert d.start_at == t and d.end_at == t


def test_zeitfenster_leeren_setzt_auch_faelligkeit_zurueck() -> None:
    db = _FakeDB(_tables())
    svc = TasksService(client=db)
    svc.set_zeitfenster(
        "T", "t1",
        datetime(2026, 8, 28, 10, 0, tzinfo=UTC),
        datetime(2026, 8, 28, 16, 0, tzinfo=UTC),
        _admin(),
    )
    d = svc.set_zeitfenster("T", "t1", None, None, _admin())
    assert d.start_at is None and d.end_at is None and d.due_at is None


def test_zeitfenster_nur_start_faellt_auf_start_zurueck() -> None:
    """Ohne Ende ist der Start die Faelligkeit — dieselbe Regel wie im
    Regel-Motor (`end or start`), damit beide Wege dasselbe schreiben."""
    db = _FakeDB(_tables())
    svc = TasksService(client=db)
    start = datetime(2026, 9, 1, 8, 0, tzinfo=UTC)
    d = svc.set_zeitfenster("T", "t1", start, None, _admin())
    assert d.due_at == start


def test_zeitfenster_fremde_aufgabe_ist_ein_404() -> None:
    """Wurzel 9: derselbe Scope wie beim Lesen."""
    db = _FakeDB(_tables())
    svc = TasksService(client=db)
    with pytest.raises(TaskError) as exc:
        svc.set_zeitfenster(
            "ANDERER", "t1", datetime(2026, 8, 28, tzinfo=UTC), None, _admin()
        )
    assert exc.value.status_code == 404


def test_status_annehmen_und_anfangen() -> None:
    db = _FakeDB(_tables())
    svc = TasksService(client=db)
    d = svc.set_status("T", "t1", TaskStatus.accepted, _admin())
    assert d.status == TaskStatus.accepted
    d = svc.set_status("T", "t1", TaskStatus.in_progress, _admin())
    assert d.status == TaskStatus.in_progress


def test_status_gleicher_wert_ist_idempotent() -> None:
    """Wurzel 2: Doppeltipp auf dem Telefon ist kein Fehler."""
    db = _FakeDB(_tables())
    svc = TasksService(client=db)
    svc.set_status("T", "t1", TaskStatus.accepted, _admin())
    d = svc.set_status("T", "t1", TaskStatus.accepted, _admin())
    assert d.status == TaskStatus.accepted


def test_status_unmoeglicher_sprung_wird_abgelehnt() -> None:
    db = _FakeDB(_tables(tasks=[
        {"id": "t1", "tenant_id": "T", "title": "X", "status": "done",
         "property_id": "p1"},
    ]))
    svc = TasksService(client=db)
    with pytest.raises(TaskError) as exc:
        svc.set_status("T", "t1", TaskStatus.in_progress, _admin())
    assert exc.value.status_code == 422


def test_status_done_erzwingt_die_fotopflicht() -> None:
    """Der Statuswechsel war bis 0360 der Weg AM Foto-Zwang vorbei."""
    db = _FakeDB(_tables(checklist_items=[
        {"id": "c1", "task_id": "t1", "label": "Bad", "done": False,
         "requires_photo": True, "sort_order": 0},
    ]))
    svc = TasksService(client=db)
    with pytest.raises(TaskError) as exc:
        svc.set_status("T", "t1", TaskStatus.done, _admin())
    assert exc.value.status_code == 422


def test_status_zuruecknehmen_raeumt_den_abschluss_ab() -> None:
    """Wurzel 1: wer den Haken zurücknimmt, nimmt auch Zeitpunkt und Urheber
    zurück — sonst trägt eine offene Aufgabe ein „abgeschlossen am …"."""
    db = _FakeDB(_tables(tasks=[
        {"id": "t1", "tenant_id": "T", "title": "X", "status": "done",
         "property_id": "p1", "completed_at": "2026-08-01T10:00:00+00:00",
         "completed_by": "u1", "inspection_state": "to_review"},
    ]))
    svc = TasksService(client=db)
    svc.set_status("T", "t1", TaskStatus.open, _admin())
    zeile = db.tables["tasks"][0]
    assert zeile["completed_at"] is None
    assert zeile["completed_by"] is None
    assert zeile["inspection_state"] is None


def test_checklisten_punkt_abhaken_haelt_die_spur_fest() -> None:
    db = _FakeDB(_tables(checklist_items=[
        {"id": "c1", "task_id": "t1", "label": "Bad", "done": False,
         "requires_photo": False, "sort_order": 0},
    ]))
    svc = TasksService(client=db)
    d = svc.toggle_checklist_item("T", "c1", True, _cleaner())
    assert d.checklist[0].done is True
    assert db.tables["checklist_items"][0]["done_by"] == "u1"
    assert db.tables["checklist_items"][0]["done_at"]


def test_checklisten_punkt_zuruecknehmen_loescht_die_spur() -> None:
    db = _FakeDB(_tables(checklist_items=[
        {"id": "c1", "task_id": "t1", "label": "Bad", "done": True,
         "requires_photo": False, "sort_order": 0,
         "done_at": "2026-08-01T10:00:00+00:00", "done_by": "u1"},
    ]))
    svc = TasksService(client=db)
    svc.toggle_checklist_item("T", "c1", False, _cleaner())
    zeile = db.tables["checklist_items"][0]
    assert zeile["done"] is False
    assert zeile["done_at"] is None
    assert zeile["done_by"] is None


def test_checklisten_punkt_fremder_mandant_ist_404() -> None:
    """Der Scope hängt an der Aufgabe, nicht an der item_id (Wurzel 9)."""
    db = _FakeDB(_tables(checklist_items=[
        {"id": "c9", "task_id": "fremd", "label": "X", "done": False,
         "requires_photo": False, "sort_order": 0},
    ]))
    svc = TasksService(client=db)
    with pytest.raises(TaskError) as exc:
        svc.toggle_checklist_item("T", "c9", True, _admin())
    assert exc.value.status_code == 404


def test_kosten_nehmen_die_objektwaehrung() -> None:
    from src.features.tasks.schemas import TaskCostCreate
    db = _FakeDB(_tables())
    svc = TasksService(client=db)
    d = svc.add_cost("T", "t1", TaskCostCreate(amount="12.50", note=" Klopapier "), _cleaner())
    assert d.costs[0].currency == "DKK"      # Objektwährung, nicht Betriebs-EUR
    assert d.costs[0].note == "Klopapier"
    assert d.cost_currency == "DKK"


def test_kosten_ohne_waehrung_werden_abgelehnt() -> None:
    """Wurzel 4: lieber 422 als ein erfundenes Euro in einer Abrechnung."""
    from src.features.tasks.schemas import TaskCostCreate
    db = _FakeDB(_tables(
        properties=[{"id": "p1", "tenant_id": "T", "title": "Haus", "currency": None}],
        tenants=[{"id": "T", "currency": None}],
    ))
    svc = TasksService(client=db)
    with pytest.raises(TaskError) as exc:
        svc.add_cost("T", "t1", TaskCostCreate(amount="5.00"), _cleaner())
    assert exc.value.status_code == 422


def test_cleaner_sieht_nur_die_eigenen_auslagen() -> None:
    """§4.3: die eigene Auslage eintragen ≠ die Auslagen des Betriebs lesen."""
    db = _FakeDB(_tables(task_costs=[
        {"id": "k1", "tenant_id": "T", "task_id": "t1", "amount": "10.00",
         "currency": "DKK", "created_by": "u1"},
        {"id": "k2", "tenant_id": "T", "task_id": "t1", "amount": "99.00",
         "currency": "DKK", "created_by": "chef"},
    ]))
    svc = TasksService(client=db)
    assert len(svc.get_detail("T", "t1", _cleaner()).costs) == 1
    assert len(svc.get_detail("T", "t1", _admin()).costs) == 2


def test_cleaner_kann_fremde_auslage_nicht_loeschen() -> None:
    db = _FakeDB(_tables(task_costs=[
        {"id": "k2", "tenant_id": "T", "task_id": "t1", "amount": "99.00",
         "currency": "DKK", "created_by": "chef"},
    ]))
    svc = TasksService(client=db)
    with pytest.raises(TaskError) as exc:
        svc.delete_cost("T", "k2", _cleaner())
    assert exc.value.status_code == 404


def test_rueckmeldung_ohne_berechtigung_darf_nicht_benoten() -> None:
    from src.features.tasks.schemas import TaskResolutionUpsert
    db = _FakeDB(_tables())
    svc = TasksService(client=db)
    with pytest.raises(TaskError) as exc:
        svc.set_resolution(
            "T", "t1", TaskResolutionUpsert(score=5), _cleaner(), darf_benoten=False
        )
    assert exc.value.status_code == 403


def test_rueckmeldung_text_darf_die_zustaendige_person() -> None:
    from src.features.tasks.schemas import TaskResolutionUpsert
    db = _FakeDB(_tables())
    svc = TasksService(client=db)
    d = svc.set_resolution(
        "T", "t1", TaskResolutionUpsert(note="Schlüssel klemmt"), _cleaner(),
        darf_benoten=False,
    )
    assert d.resolution is not None
    assert d.resolution.note == "Schlüssel klemmt"
    assert d.resolution.score is None


def test_rueckmeldung_ganz_leer_wird_abgelehnt() -> None:
    from src.features.tasks.schemas import TaskResolutionUpsert
    db = _FakeDB(_tables())
    svc = TasksService(client=db)
    with pytest.raises(TaskError) as exc:
        svc.set_resolution(
            "T", "t1", TaskResolutionUpsert(note="   "), _admin(), darf_benoten=True
        )
    assert exc.value.status_code == 422


# --- Zuweisung an einen Mitarbeiter (17.08.2026) ---------------------------
#
# Bis hierher war `assignee_id` ein Einweg-Feld: gesetzt beim Anlegen, danach
# unveränderlich. Diese Tests halten die drei Eigenschaften fest, an denen der
# neue Pfad hängt — Scope, Objekt-Freigabe, Gegenzustand.


def test_zuweisen_setzt_den_zustaendigen() -> None:
    """u2 ist cleaner MIT Freigabe für p1 — der Normalfall."""
    db = _FakeDB(
        _tables(
            staff_property_assignments=[
                {"tenant_id": "T", "user_id": "u1", "property_id": "p1"},
                {"tenant_id": "T", "user_id": "u2", "property_id": "p1"},
            ]
        )
    )
    svc = TasksService(client=db)
    d = svc.set_assignee("T", "t1", "u2", _admin())
    assert d.assignee_id == "u2"


def test_zuweisung_zuruecknehmen_ist_erlaubt() -> None:
    """`None` ist ein Zielzustand, kein fehlender Wert.

    Ohne diesen Weg bliebe eine Fehlzuweisung für immer stehen — die Aufgabe
    müsste gelöscht und neu angelegt werden, mitsamt Checkliste und Historie.
    """
    db = _FakeDB(_tables())
    svc = TasksService(client=db)
    d = svc.set_assignee("T", "t1", None, _admin())
    assert d.assignee_id is None


def test_zuweisen_an_denselben_ist_idempotent(monkeypatch: pytest.MonkeyPatch) -> None:
    """Derselbe Empfänger ist kein Wechsel — und löst keine zweite Mail aus."""
    gerufen: list[str] = []
    monkeypatch.setattr(
        "src.features.tasks.service.melde_aufgaben_zuweisung",
        lambda *a, **k: gerufen.append("mail"),
    )
    db = _FakeDB(_tables())
    svc = TasksService(client=db)
    d = svc.set_assignee("T", "t1", "u1", _admin())
    assert d.assignee_id == "u1"
    assert gerufen == []


def test_zuweisen_an_fremden_mitarbeiter_ist_422() -> None:
    db = _FakeDB(_tables())
    svc = TasksService(client=db)
    with pytest.raises(TaskError) as exc:
        svc.set_assignee("T", "t1", "fremd", _admin())
    assert exc.value.status_code == 422


def test_zuweisen_ohne_objekt_freigabe_ist_422() -> None:
    """Der Schreibpfad prüft, was der Lesepfad filtert (Wurzel 9).

    Ohne diese Prüfung ginge die Zuweisung durch, die Mail ginge raus — und
    beim Empfänger wäre die Aufgabe unsichtbar, weil `list_own_tasks` sie am
    fehlenden `staff_property_assignments`-Eintrag ausblendet.
    """
    db = _FakeDB(_tables())
    svc = TasksService(client=db)
    with pytest.raises(TaskError) as exc:
        # u2 ist cleaner, hat aber keine Freigabe für p1.
        svc.set_assignee("T", "t1", "u2", _admin())
    assert exc.value.status_code == 422
    assert "Objekt" in exc.value.message


def test_zuweisen_an_admin_braucht_keine_objekt_freigabe() -> None:
    """admin/co_admin/owner hängen nicht an staff_property_assignments."""
    db = _FakeDB(_tables())
    svc = TasksService(client=db)
    d = svc.set_assignee("T", "t1", "a1", _admin())
    assert d.assignee_id == "a1"


def test_zuweisen_fremder_mandant_ist_404() -> None:
    db = _FakeDB(_tables())
    svc = TasksService(client=db)
    with pytest.raises(TaskError) as exc:
        svc.set_assignee("FREMD", "t1", "a1", _admin())
    assert exc.value.status_code == 404


def test_zuweisen_meldet_neuem_und_altem_zustaendigen(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Beide Richtungen (Wurzel 1).

    Nur den Neuen zu benachrichtigen ließe den Bisherigen im Glauben, die
    Aufgabe sei weiter seine — sie verschwindet wortlos aus seiner Liste.
    """
    neu: list[str | None] = []
    weg: list[str | None] = []
    monkeypatch.setattr(
        "src.features.tasks.service.melde_aufgaben_zuweisung",
        lambda *a, **k: neu.append(k.get("assignee_id")),
    )
    monkeypatch.setattr(
        "src.features.tasks.service.melde_aufgaben_entzug",
        lambda *a, **k: weg.append(k.get("assignee_id")),
    )
    db = _FakeDB(_tables())
    svc = TasksService(client=db)
    svc.set_assignee("T", "t1", "a1", _admin())
    assert neu == ["a1"]
    assert weg == ["u1"]


def test_bulk_zuweisen_zaehlt_uebersprungene() -> None:
    """Was am Scope scheitert, wird gezählt statt den ganzen Aufruf zu kippen."""
    db = _FakeDB(
        _tables(
            tasks=[
                {"id": "t1", "tenant_id": "T", "title": "A", "status": "open",
                 "property_id": "p1", "assignee_id": None},
                {"id": "t2", "tenant_id": "T", "title": "B", "status": "open",
                 "property_id": "p1", "assignee_id": None},
            ]
        )
    )
    svc = TasksService(client=db)
    res = svc.bulk_assign("T", ["t1", "t2", "gibtsnicht"], "a1", _admin())
    assert res == {"assigned": 2, "skipped": 1}


# --- Vertretung (§4.3) -----------------------------------------------------


def _mit_anfrage() -> _FakeDB:
    return _FakeDB(
        _tables(
            task_substitutions=[
                {"id": "s1", "tenant_id": "T", "task_id": "t1",
                 "requested_by": "u1", "accepted_by": None,
                 "status": "requested", "note": None}
            ]
        )
    )


def test_vertretung_annehmen_schreibt_den_zustaendigen_um() -> None:
    """Der Kern des Features — und genau das, was vorher fehlte.

    Vorher setzte `accept` nur `status='accepted'`: die Aufgabe blieb beim
    Vertretenen, tauchte beim Vertreter nie auf, und zwei Leute hielten
    dieselbe Aufgabe für ihre.
    """
    db = _mit_anfrage()
    svc = TasksService(client=db)
    sub = svc.accept_substitution("T", "s1", "a1", _admin())
    assert sub.status.value == "accepted"
    assert db.tables["tasks"][0]["assignee_id"] == "a1"


def test_vertretung_sich_selbst_ist_422() -> None:
    db = _mit_anfrage()
    svc = TasksService(client=db)
    with pytest.raises(TaskError) as exc:
        svc.accept_substitution("T", "s1", "u1", _cleaner())
    assert exc.value.status_code == 422


def test_vertretung_zweimal_annehmen_ist_409() -> None:
    """Ohne Status-Guard ließe sich der Vertreter nachträglich überschreiben."""
    db = _mit_anfrage()
    svc = TasksService(client=db)
    svc.accept_substitution("T", "s1", "a1", _admin())
    with pytest.raises(TaskError) as exc:
        svc.accept_substitution("T", "s1", "u2", _admin())
    assert exc.value.status_code == 409


def test_vertretung_ablehnen_laesst_die_aufgabe_stehen() -> None:
    db = _mit_anfrage()
    svc = TasksService(client=db)
    sub = svc.decline_substitution("T", "s1", "a1")
    assert sub.status.value == "declined"
    assert db.tables["tasks"][0]["assignee_id"] == "u1"


def test_offene_anfragen_ohne_eigene() -> None:
    """Man vertritt sich nicht selbst — die eigene Anfrage fällt raus."""
    db = _mit_anfrage()
    svc = TasksService(client=db)
    assert svc.list_substitutions("T", "u1", _cleaner()) == []
    fremd = svc.list_substitutions("T", "a1", _admin())
    assert len(fremd) == 1
    # Ohne Titel und Objekt wäre eine Anfrage nicht entscheidbar.
    assert fremd[0].title == "Endreinigung"
    assert fremd[0].property_title == "Haus"
    assert fremd[0].requested_by_name == "Reinigung"


def test_auswahlliste_zeigt_keine_eigentuemer() -> None:
    """Ein `owner` hat VIEW_OWN_TASKS nicht — er könnte die Aufgabe nie öffnen.

    Live standen 23 Eigentümer neben 2 berechtigten Personen in der Auswahl,
    und 11 Aufgaben lagen auf Eigentümer-Konten, die sie nie zu sehen bekamen.
    """
    db = _FakeDB(
        _tables(
            users=[
                {"id": "u1", "tenant_id": "T", "full_name": "Reinigung",
                 "role": "cleaner", "email": "r@x.dk"},
                {"id": "a1", "tenant_id": "T", "full_name": "Chefin",
                 "role": "admin", "email": "c@x.dk"},
                {"id": "o1", "tenant_id": "T", "full_name": "Eigentümer",
                 "role": "owner", "email": "o@x.dk"},
            ]
        )
    )
    svc = TasksService(client=db)
    ids = {o.user_id for o in svc.moegliche_zustaendige("T")}
    assert ids == {"u1", "a1"}


def test_auswahlliste_ohne_gesperrte_und_ohne_fremde_rolle() -> None:
    """Gesperrt = kein Login = keine Arbeit. Unbekannte Rolle: fail-closed."""
    db = _FakeDB(
        _tables(
            users=[
                {"id": "u1", "tenant_id": "T", "full_name": "Aktiv",
                 "role": "cleaner", "email": "a@x.dk"},
                {"id": "u9", "tenant_id": "T", "full_name": "Gesperrt",
                 "role": "cleaner", "email": "g@x.dk",
                 "deactivated_at": "2026-08-01T00:00:00Z"},
                {"id": "u8", "tenant_id": "T", "full_name": "Fremd",
                 "role": "hausmeister", "email": "f@x.dk"},
            ]
        )
    )
    svc = TasksService(client=db)
    assert {o.user_id for o in svc.moegliche_zustaendige("T")} == {"u1"}


# --- Nachträge aus dem Review (17.08.2026) ---------------------------------


def test_vertretung_ablehnen_ohne_objekt_scope_ist_404() -> None:
    """`decline` prüft denselben Scope wie die Liste (Wurzel 9).

    Vorher nahm die Methode kein `ctx` und filterte nur auf den Mandanten:
    ein Mitarbeiter konnte eine Anfrage abwürgen, die er nicht einmal sehen
    darf — die Bitte um Vertretung wäre erledigt, ohne dass jemand einspringt.
    """
    db = _FakeDB(
        _tables(
            tasks=[
                {"id": "t1", "tenant_id": "T", "title": "X", "status": "open",
                 "property_id": "p9", "assignee_id": "u1"},
            ],
            task_substitutions=[
                {"id": "s1", "tenant_id": "T", "task_id": "t1",
                 "requested_by": "u1", "accepted_by": None,
                 "status": "requested", "note": None},
            ],
        )
    )
    svc = TasksService(client=db)
    # u1 ist cleaner und hat nur p1 frei, die Aufgabe hängt an p9.
    with pytest.raises(TaskError) as exc:
        svc.decline_substitution("T", "s1", "u1", _cleaner())
    assert exc.value.status_code == 404
    # Die Anfrage bleibt offen — sie wurde nicht heimlich entschieden.
    assert db.tables["task_substitutions"][0]["status"] == "requested"


def test_vertretung_annehmen_claimt_vor_dem_umschreiben() -> None:
    """Der Claim ist der Riegel, nicht die Reihenfolge (Wurzel 2).

    Scheitert das Umschreiben fachlich, wird der Claim zurückgerollt — sonst
    stünde eine quittierte Anfrage ohne Wirkung da, die niemand mehr annehmen
    kann.
    """
    db = _FakeDB(
        _tables(
            tasks=[
                {"id": "t1", "tenant_id": "T", "title": "X", "status": "open",
                 "property_id": "p1", "assignee_id": "u1"},
            ],
            task_substitutions=[
                {"id": "s1", "tenant_id": "T", "task_id": "t1",
                 "requested_by": "u1", "accepted_by": None,
                 "status": "requested", "note": None},
            ],
            # u2 ist cleaner OHNE Freigabe für p1 → set_assignee wirft 422.
            staff_property_assignments=[
                {"tenant_id": "T", "user_id": "u1", "property_id": "p1"},
            ],
        )
    )
    svc = TasksService(client=db)
    with pytest.raises(TaskError) as exc:
        svc.accept_substitution("T", "s1", "u2", _admin())
    assert exc.value.status_code == 422
    zeile = db.tables["task_substitutions"][0]
    assert zeile["status"] == "requested"
    assert zeile["accepted_by"] is None
    assert db.tables["tasks"][0]["assignee_id"] == "u1"


def test_auswahlliste_beruecksichtigt_objekt_freigabe() -> None:
    """Wer nicht freigegeben ist, steht gar nicht erst zur Wahl.

    Sonst verspricht die Liste etwas, das `_require_own_assignee` gleich
    darauf mit 422 ablehnt — bei der Massen-Zuweisung sogar wortlos als
    „N übersprungen".
    """
    db = _FakeDB(
        _tables(
            users=[
                {"id": "u1", "tenant_id": "T", "full_name": "Frei",
                 "role": "cleaner", "email": "f@x.dk"},
                {"id": "u2", "tenant_id": "T", "full_name": "Nicht frei",
                 "role": "cleaner", "email": "n@x.dk"},
                {"id": "a1", "tenant_id": "T", "full_name": "Chefin",
                 "role": "admin", "email": "c@x.dk"},
            ],
            staff_property_assignments=[
                {"tenant_id": "T", "user_id": "u1", "property_id": "p1"},
            ],
        )
    )
    svc = TasksService(client=db)
    # Ohne Objekt: beide Reinigungskräfte plus Chefin.
    assert {o.user_id for o in svc.moegliche_zustaendige("T")} == {
        "u1", "u2", "a1",
    }
    # Mit Objekt p1: u2 fällt raus, die Chefin bleibt (hängt nicht am Scope).
    assert {o.user_id for o in svc.moegliche_zustaendige("T", "p1")} == {
        "u1", "a1",
    }


def test_umweisung_hin_und_zurueck_meldet_zweimal(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A→B→A muss A wirklich zweimal erreichen.

    Der Entdopplungs-Schlüssel trägt den Empfänger, aber der UNIQUE-Index
    greift über OFFENE Meldungen: ohne einen Vorgangs-Stempel liefe A's
    zweite Zuweisung auf seine erste, noch ungelesene — und fiele samt Mail
    aus.
    """
    schluessel: list[str | None] = []
    monkeypatch.setattr(
        "src.features.tasks.service.melde_aufgaben_zuweisung",
        lambda *a, **k: schluessel.append(k.get("vorgang")),
    )
    monkeypatch.setattr(
        "src.features.tasks.service.melde_aufgaben_entzug",
        lambda *a, **k: None,
    )
    db = _FakeDB(_tables())
    svc = TasksService(client=db)
    svc.set_assignee("T", "t1", "a1", _admin())
    svc.set_assignee("T", "t1", "u1", _admin())
    assert len(schluessel) == 2
    assert all(v for v in schluessel), "jeder Wechsel braucht einen Stempel"


def test_fenstergrenze_wird_als_zeitpunkt_verglichen() -> None:
    """Eine Aufgabe GENAU auf der unteren Fenstergrenze bleibt im Kalender.

    Vorher verglich der Kalender ISO-Strings: die App schickt
    `…T00:00:00.000Z`, Python schreibt `…+00:00`, und bei gleicher Sekunde
    entschied die ASCII-Ordnung von '+' (0x2B) und '.' (0x2E) — die Aufgabe fiel
    heraus, ohne dass irgendwo ein Fehler entstand.
    """
    grenze = _als_zeitpunkt("2026-08-01T00:00:00.000Z", "month_from")
    assert grenze == datetime(2026, 8, 1, tzinfo=UTC)
    # Derselbe Zeitpunkt, anders geschrieben — als Zeitpunkt identisch, als
    # String kleiner.
    assert _utc(datetime(2026, 8, 1, tzinfo=UTC)) >= grenze
    assert "2026-08-01T00:00:00+00:00" < "2026-08-01T00:00:00.000Z"


def test_unlesbare_fenstergrenze_faellt_hart_durch() -> None:
    with pytest.raises(TaskError) as exc:
        _als_zeitpunkt("naechster Monat", "month_to")
    assert exc.value.status_code == 422


def _deckung_db(rules: list[dict], props: list[dict], zuordnung: dict) -> MagicMock:
    """Fake-DB für `regel_deckung`: task_rules, properties, task_rule_assignments."""
    db = MagicMock()

    def table(name: str) -> MagicMock:
        q = MagicMock()
        if name == "task_rules":
            kette = q.select.return_value.eq.return_value.eq.return_value
            kette.eq.return_value.not_.is_.return_value.execute.return_value.data = (
                rules
            )
        elif name == "properties":
            # select → eq(tenant) → is_(archived_at) → order → execute
            kette = q.select.return_value.eq.return_value.is_.return_value
            kette.order.return_value.execute.return_value.data = props
        elif name == "task_rule_assignments":
            rows = [
                {"rule_id": rid, "property_id": pid}
                for rid, pids in zuordnung.items()
                for pid in pids
            ]
            q.select.return_value.in_.return_value.execute.return_value.data = rows
        return q

    db.table.side_effect = table
    return db


def test_deckung_meldet_objekt_ohne_regel() -> None:
    """Ein Objekt, das keiner Regel zugeordnet ist, bekommt NIE eine Aufgabe.

    Sobald einer Regel ein Objekt zugeordnet ist, gilt sie nur noch für die
    gelisteten — ein später angelegtes Objekt fällt still heraus. Live traf das
    2 von 19 Objekten, und nichts in der Oberfläche sagte das.
    """
    svc = TasksService(
        client=_deckung_db(
            rules=[
                {"id": "r_an", "start_trigger": "days_before_check_in"},
                {"id": "r_ab", "start_trigger": "check_out"},
            ],
            props=[{"id": "p1", "title": "Haus A"}, {"id": "p2", "title": "Haus B"}],
            zuordnung={"r_an": ["p1"], "r_ab": ["p1"]},
        )
    )
    deckung = svc.regel_deckung("t1")
    assert deckung.objekte == 2
    assert deckung.ohne_anreise == 1
    assert deckung.ohne_abreise == 1
    assert [b.property_title for b in deckung.betroffen] == ["Haus B"]


def test_regel_ohne_zuordnung_deckt_jedes_objekt() -> None:
    """Eine Regel ohne Objekt-Zuordnung gilt für ALLE — auch für künftige."""
    svc = TasksService(
        client=_deckung_db(
            rules=[
                {"id": "r_an", "start_trigger": "check_in"},
                {"id": "r_ab", "start_trigger": "days_after_check_out"},
            ],
            props=[{"id": "p1", "title": "Haus A"}, {"id": "p2", "title": "Haus B"}],
            zuordnung={},
        )
    )
    deckung = svc.regel_deckung("t1")
    assert deckung.ohne_anreise == 0
    assert deckung.ohne_abreise == 0
    assert deckung.betroffen == []


# --- URL-Länge: `in_`-Listen müssen geblockt sein (01.09.2026) ---------------

def test_in_bloecken_haelt_die_url_grenze() -> None:
    """PostgREST bekommt `in_`-Listen über die URL — ab ~8 KB kommt HTTP 414.

    DER VORFALL: der Aufgabenkalender warf beim Scrollen `internal_error`.
    Gemessen kippte er zwischen 207 und 212 Aufgaben; nachgestellt gegen die
    Live-DB gehen 200 IDs, 210 werfen 414 „URI too long". `_enrich` reichte
    ALLE Task-IDs des Fensters in einem Rutsch an `checklist_items`.

    Das Tückische: es hängt an der DATENMENGE, nicht am Code. Bei einem
    kleinen Betrieb läuft dieselbe Zeile jahrelang.
    """
    from src.features.tasks.service import _ID_BLOCK, _in_bloecken

    ids = [f"id-{i}" for i in range(250)]
    bloecke = _in_bloecken(ids)

    assert all(len(b) <= _ID_BLOCK for b in bloecke)
    # Nichts verloren, nichts doppelt — ein Block-Helfer, der Einträge
    # verschluckt, wäre schlimmer als die 414: die Aufgabe fehlte einfach.
    assert [x for b in bloecke for x in b] == ids
    assert _in_bloecken([]) == []


def test_id_block_bleibt_unter_der_gemessenen_grenze() -> None:
    """Gemessen kippt es zwischen 200 und 210 IDs.

    Der Wert steht deutlich darunter, weil Filter, Spaltenliste und Sortierung
    in derselben URL stehen — und weil die Grenze eine Eigenschaft der
    Serverkonfiguration ist, nicht unseres Codes.
    """
    from src.features.tasks.service import _ID_BLOCK

    assert _ID_BLOCK <= 150


def test_keine_ungeblockte_in_liste_im_slice() -> None:
    """Kein `.in_(..., list(...))` mehr im Service.

    Der Wächter gegen die Rückkehr: die vorige Fassung hatte die Blockbildung
    an KEINER der acht Sammelabfragen, obwohl das Nachbarmodul
    `regel_uebersetzung` sie längst hatte. Wer eine neue schreibt, soll hier
    stolpern statt beim Kunden.
    """
    import re
    from pathlib import Path

    quelle = (
        Path(__file__).resolve().parents[1] / "service.py"
    ).read_text(encoding="utf-8")
    treffer = re.findall(r"\.in_\([^)]*\blist\(", quelle)
    assert not treffer, (
        f"{len(treffer)} ungeblockte in_()-Liste(n) — `_in_bloecken` benutzen."
    )


# --- Bestellte Leistung → Abrechnungsposten (0531, gemeldet 03.09.2026) -----


class _PreisDb:
    """Stub mit genau den Tabellen, die `abrechnung` anfasst."""

    def __init__(self, **tabellen: list[dict]) -> None:
        self.tabellen = {"service_type_prices": [], "owner_expenses": [],
                         "owners": [], "tasks": [], **tabellen}
        self.inserts: list[tuple[str, dict]] = []
        self.updates: list[tuple[str, dict]] = []
        self.deletes: list[str] = []

    def table(self, name: str) -> "_PreisQ":
        return _PreisQ(name, self)


class _PreisQ:
    def __init__(self, name: str, db: _PreisDb) -> None:
        self._n = name
        self._db = db
        self._daten: list[dict] = list(db.tabellen.get(name, []))

    def select(self, *_a, **_k) -> "_PreisQ":
        return self

    def insert(self, zeile: dict) -> "_PreisQ":
        self._db.inserts.append((self._n, zeile))
        self._daten = [{**zeile, "id": f"neu-{self._n}"}]
        return self

    def update(self, zeile: dict) -> "_PreisQ":
        self._db.updates.append((self._n, zeile))
        return self

    def delete(self) -> "_PreisQ":
        self._db.deletes.append(self._n)
        return self

    def __getattr__(self, name: str):
        if name.startswith("_"):
            raise AttributeError(name)
        return lambda *_a, **_k: self

    def execute(self):
        return type("R", (), {"data": self._daten})()


def _aufgabe(**over) -> dict:
    basis = {
        "id": "task-1",
        "ordered_by_owner": True,
        "owner_expense_id": None,
        "service_type_id": "st-1",
        "property_id": "prop-1",
        "requested_by": "user-owner",
        "title": "Endreinigung",
        "completed_at": "2026-10-30T09:00:00+00:00",
    }
    return {**basis, **over}


def test_ohne_preis_entsteht_kein_posten() -> None:
    """Ein Posten mit 0,00 waere eine geschenkte Leistung (Wurzel 4).

    Der Mangel wird laut protokolliert, aber die Abrechnung erfindet keinen
    Betrag.
    """
    from src.features.tasks import abrechnung

    db = _PreisDb(owners=[{"id": "own-1"}])
    assert abrechnung.posten_anlegen(db, tenant_id="t-1", zeile=_aufgabe()) is None
    assert not db.inserts


def test_nur_eigentuemer_bestellungen_werden_berechnet() -> None:
    """Eine gewoehnliche Betriebsaufgabe ist im Provisionsmodell enthalten."""
    from src.features.tasks import abrechnung

    db = _PreisDb(
        owners=[{"id": "own-1"}],
        service_type_prices=[{"property_id": None, "amount": "950", "currency": "DKK"}],
    )
    ergebnis = abrechnung.posten_anlegen(
        db, tenant_id="t-1", zeile=_aufgabe(ordered_by_owner=False)
    )
    assert ergebnis is None
    assert not db.inserts, "eine Betriebsaufgabe darf dem Eigentuemer nicht berechnet werden"


def test_posten_traegt_abschlusstag_und_richtung() -> None:
    """Der ABSCHLUSStag entscheidet die Abrechnungsperiode (Wurzel 5b)."""
    from src.features.tasks import abrechnung

    db = _PreisDb(
        owners=[{"id": "own-1"}],
        service_type_prices=[{"property_id": None, "amount": "950", "currency": "DKK"}],
    )
    abrechnung.posten_anlegen(db, tenant_id="t-1", zeile=_aufgabe())
    posten = next(z for t, z in db.inserts if t == "owner_expenses")
    assert posten["date"] == "2026-10-30", "nicht heute, sondern der Abschlusstag"
    assert posten["direction"] == "from_owner"
    assert posten["amount"] == "950"
    assert posten["currency"] == "DKK"
    assert posten["owner_id"] == "own-1"
    assert "statement_id" not in posten, (
        "der Posten haengt frei am Eigentuemer — eine schon verschickte "
        "Abrechnung darf er nicht veraendern"
    )


def test_zweiter_abschluss_legt_keinen_zweiten_posten_an() -> None:
    """Wurzel 2: Doppelklick, Redelivery, Nachlauf."""
    from src.features.tasks import abrechnung

    db = _PreisDb(
        owners=[{"id": "own-1"}],
        service_type_prices=[{"property_id": None, "amount": "950", "currency": "DKK"}],
    )
    assert abrechnung.posten_anlegen(
        db, tenant_id="t-1", zeile=_aufgabe(owner_expense_id="exp-1")
    ) is None
    assert not db.inserts


def test_objekt_ausnahme_schlaegt_betriebsregel() -> None:
    """Dieselbe Vorrang-Regel wie bei den Gebuehren."""
    from src.features.tasks import abrechnung

    db = _PreisDb(service_type_prices=[
        {"property_id": None, "amount": "950", "currency": "DKK"},
        {"property_id": "prop-1", "amount": "1250", "currency": "DKK"},
    ])
    treffer = abrechnung.preis_finden(
        db, tenant_id="t-1", service_type_id="st-1", property_id="prop-1"
    )
    assert treffer is not None and str(treffer[0]) == "1250"


def test_abgerechneter_posten_bleibt_bei_ruecknahme_stehen() -> None:
    """Eine fakturierte Zeile darf nicht ruecklings verschwinden (Wurzel 1)."""
    from src.features.tasks import abrechnung

    db = _PreisDb(owner_expenses=[{"id": "exp-1", "statement_id": "stmt-1"}])
    assert abrechnung.posten_zuruecknehmen(
        db, tenant_id="t-1", zeile={"id": "task-1", "owner_expense_id": "exp-1"}
    ) is False
    assert "owner_expenses" not in db.deletes


def test_portal_bestellung_setzt_das_kennzeichen() -> None:
    """Ohne `ordered_by_owner` blieb die bestellte Leistung unberechnet."""
    from pathlib import Path

    quelle = (
        Path(__file__).resolve().parents[2]
        / "public_portal" / "dienstleistungen.py"
    ).read_text(encoding="utf-8")
    assert '"ordered_by_owner": True' in quelle


def test_abschluss_und_ruecknahme_haengen_am_abrechnungsmodul() -> None:
    """Beide Tueren zu `done` fuehren durch die Abrechnung."""
    from pathlib import Path

    quelle = (
        Path(__file__).resolve().parents[1] / "service.py"
    ).read_text(encoding="utf-8")
    assert "abrechnung.posten_anlegen(" in quelle
    assert "abrechnung.posten_zuruecknehmen(" in quelle


def test_zeitraum_filter_prueft_ueberschneidung_nicht_nur_den_start() -> None:
    """Der Datumsfilter „von–bis" trifft jede Aufgabe, die den Zeitraum berührt.

    Ein `start_at BETWEEN` waere hier falsch: die Aufgabe vom 20.08. 10:00–16:00
    aus der Teamliste muss beim Filter „20.08.–20.08." erscheinen, und eine
    ueber Nacht laufende an BEIDEN Tagen. `bis` ist der Beginn des Folgetags und
    damit exklusiv — sonst fiele der gewaehlte Endtag halb heraus.
    """
    from datetime import UTC, datetime

    from src.features.tasks.schemas import Task

    def _t(tid: str, start: datetime | None, ende: datetime | None = None) -> Task:
        return Task(
            id=tid,
            tenant_id="T",
            title=tid,
            status=TaskStatus.open,
            start_at=start,
            end_at=ende,
        )

    # Filter „20.08." — von 20.08. 00:00 bis 21.08. 00:00 (exklusiv).
    von = datetime(2026, 8, 20, 0, 0, tzinfo=UTC)
    bis = datetime(2026, 8, 21, 0, 0, tzinfo=UTC)

    aufgaben = [
        # Die Live-Form aus dem Screenshot: Anreisecheck 10:00–16:00.
        _t(
            "im_fenster",
            datetime(2026, 8, 20, 10, 0, tzinfo=UTC),
            datetime(2026, 8, 20, 16, 0, tzinfo=UTC),
        ),
        # Beginnt davor, laeuft hinein: beruehrt den Zeitraum.
        _t(
            "ueber_nacht",
            datetime(2026, 8, 19, 22, 0, tzinfo=UTC),
            datetime(2026, 8, 20, 6, 0, tzinfo=UTC),
        ),
        _t("tag_davor", datetime(2026, 8, 19, 9, 0, tzinfo=UTC)),
        _t("tag_danach", datetime(2026, 8, 21, 9, 0, tzinfo=UTC)),
    ]

    treffer = {t.id for t in TasksService._im_zeitraum(aufgaben, von, bis)}
    assert treffer == {"im_fenster", "ueber_nacht"}

    # Offene Grenzen: nur „ab" bzw. nur „bis".
    ab_20 = {t.id for t in TasksService._im_zeitraum(aufgaben, von, None)}
    assert ab_20 == {"im_fenster", "ueber_nacht", "tag_danach"}
    bis_20 = {t.id for t in TasksService._im_zeitraum(aufgaben, None, bis)}
    assert bis_20 == {"im_fenster", "ueber_nacht", "tag_davor"}

    # Ohne Filter bleibt die Liste unangetastet.
    assert len(TasksService._im_zeitraum(aufgaben, None, None)) == 4


def test_zeitraum_filter_nutzt_faelligkeit_wenn_kein_start_gesetzt_ist() -> None:
    """Ohne `start_at` gilt `due_at` — dieselbe Kette wie in `_filter_bucket`.

    Ein reines `start_at`-Kriterium haette jede Aufgabe ohne Startzeitpunkt
    verschluckt: live waren das die 30 Zusatzleistungs-Aufgaben, die nur eine
    Faelligkeit trugen. Ein Filter, der Zeilen versteckt, die er zeigen muesste,
    ist schlimmer als keiner — man sieht ihm nicht an, dass etwas fehlt.
    """
    from datetime import UTC, datetime

    from src.features.tasks.schemas import Task

    von = datetime(2026, 8, 20, 0, 0, tzinfo=UTC)
    bis = datetime(2026, 8, 21, 0, 0, tzinfo=UTC)

    nur_faellig = Task(
        id="nur_faellig",
        tenant_id="T",
        title="Waeschepaket",
        status=TaskStatus.open,
        due_at=datetime(2026, 8, 20, 12, 0, tzinfo=UTC),
    )
    ohne_termin = Task(
        id="ohne_termin", tenant_id="T", title="irgendwann", status=TaskStatus.open
    )

    treffer = {t.id for t in TasksService._im_zeitraum([nur_faellig, ohne_termin], von, bis)}
    # Die faellige ist drin; die ohne jeden Zeitpunkt liegt an keinem Tag und
    # taucht deshalb in KEINEM Zeitraum auf (statt in jedem).
    assert treffer == {"nur_faellig"}

    # Ohne gesetzten Filter bleibt sie sichtbar.
    assert len(TasksService._im_zeitraum([nur_faellig, ohne_termin], None, None)) == 2


def test_zeitraum_grenzen_werden_mit_422_abgelehnt_nicht_mit_500() -> None:
    """Vertauschter, zu weiter oder unlesbarer Zeitraum → 422.

    Zwei Regeln in einem Test, weil sie denselben Eingang schuetzen:
    angreiferkontrollierter Input darf keinen 500 erzeugen (Wurzel 5), und jeder
    unbegrenzte Bereich braucht eine harte Obergrenze (Wurzel 8) — ein Zeitraum
    „1900–2999" waere sonst ein Vollabzug der Tabelle durch einen Filter, der
    wie eine Einschraenkung aussieht.
    """
    from src.features.tasks.router import _zeitraum

    # Der gute Fall: `bis` wird zum exklusiven Folgetag-Zeitpunkt des Clients.
    ab, bis_zu = _zeitraum("2026-08-20T00:00:00+02:00", "2026-08-21T00:00:00+02:00")
    assert ab is not None and bis_zu is not None and bis_zu > ab

    # Beide Grenzen offen ist erlaubt — das ist „kein Filter".
    assert _zeitraum(None, None) == (None, None)

    with pytest.raises(TaskError) as vertauscht:
        _zeitraum("2026-08-21T00:00:00+02:00", "2026-08-20T00:00:00+02:00")
    assert vertauscht.value.status_code == 422

    with pytest.raises(TaskError) as zu_weit:
        _zeitraum("1900-01-01T00:00:00+00:00", "2999-12-31T00:00:00+00:00")
    assert zu_weit.value.status_code == 422

    # Unlesbar und ohne Zone: beides Client-Fehler, kein Serverfehler.
    with pytest.raises(TaskError) as kaputt:
        _zeitraum("gestern", None)
    assert kaputt.value.status_code == 422
    with pytest.raises(TaskError) as ohne_zone:
        _zeitraum("2026-08-20T00:00:00", None)
    assert ohne_zone.value.status_code == 422


# --- Aufgabenkalender: archivierte Objekte -----------------------------------


def _kalender_db(
    extra_props: list[dict],
    extra_tasks: list[dict],
    reservations: list[dict] | None = None,
) -> _FakeDB:
    tables = _tables()
    tables["properties"].extend(extra_props)
    tables["tasks"].extend(extra_tasks)
    tables["reservations"] = reservations or []
    return _FakeDB(tables)


def test_kalender_blendet_archiviertes_objekt_ohne_inhalt_aus() -> None:
    """Ein archiviertes Objekt ohne Aufgaben/Buchungen im Zeitraum bekommt
    KEINE Zeile — live stand „Fewo-Mosbjerg-Sindal" (archiviert 21.08.2026)
    dauerhaft als leere Zeile im Aufgabenkalender."""
    db = _kalender_db(
        [{"id": "p-archiv", "tenant_id": "T", "title": "Fewo-Mosbjerg-Sindal",
          "archived_at": "2026-08-21T14:11:12+00:00"}],
        [],
    )
    svc = TasksService(client=db)
    rows = svc.calendar(
        "T", "2026-09-01T00:00:00Z", "2026-09-30T23:59:59Z", ctx=_admin()
    ).rows
    assert [r.property_id for r in rows] == [None, "p1"]


def test_kalender_zeigt_archiviertes_objekt_solange_etwas_daran_haengt() -> None:
    """Hängt im Zeitraum noch eine Aufgabe oder Buchung am archivierten Objekt,
    erscheint es MIT ihr: die letzte Reinigung nach Vertragsende darf nicht
    unsichtbar werden (Wurzel 1)."""
    db = _kalender_db(
        [
            {"id": "p-archiv", "tenant_id": "T", "title": "Aus dem Vertrag",
             "archived_at": "2026-08-21T14:11:12+00:00"},
            {"id": "p-archiv2", "tenant_id": "T", "title": "Buchung offen",
             "archived_at": "2026-08-21T14:11:12+00:00"},
        ],
        [{"id": "t-archiv", "tenant_id": "T", "title": "Letzte Reinigung",
          "status": "open", "property_id": "p-archiv", "assignee_id": "u1",
          "start_at": "2026-09-10T08:00:00+00:00",
          "due_at": "2026-09-10T12:00:00+00:00"}],
        [{"id": "r-archiv", "tenant_id": "T", "property_id": "p-archiv2",
          "channel": "airbnb", "ota_name": None, "adults": 2, "children": 0,
          "check_in": "2026-09-12", "check_out": "2026-09-14",
          "status": "confirmed"}],
    )
    svc = TasksService(client=db)
    rows = svc.calendar(
        "T", "2026-09-01T00:00:00Z", "2026-09-30T23:59:59Z", ctx=_admin()
    ).rows
    nach_id = {r.property_id: r for r in rows}
    assert set(nach_id) == {None, "p1", "p-archiv", "p-archiv2"}
    assert [t.id for t in nach_id["p-archiv"].tasks] == ["t-archiv"]
    assert [b.id for b in nach_id["p-archiv2"].bookings] == ["r-archiv"]
    # Sortiert nach Titel: das Nachgeladene fügt sich ein, statt hinten zu hängen.
    assert [r.property_title for r in rows[1:]] == [
        "Aus dem Vertrag", "Buchung offen", "Haus",
    ]


def test_kalender_archiviertes_objekt_mit_inhalt_ausserhalb_bleibt_weg() -> None:
    """Der Nachlade-Zweig greift nur für Inhalt IM Zeitraum: eine Aufgabe im
    Vormonat und eine stornierte Buchung im Monat holen die Zeile nicht
    zurück — sonst stünde das archivierte Objekt doch wieder leer da."""
    db = _kalender_db(
        [{"id": "p-archiv", "tenant_id": "T", "title": "Aus dem Vertrag",
          "archived_at": "2026-08-21T14:11:12+00:00"}],
        [{"id": "t-alt", "tenant_id": "T", "title": "Alte Reinigung",
          "status": "open", "property_id": "p-archiv", "assignee_id": "u1",
          "start_at": "2026-08-10T08:00:00+00:00",
          "due_at": "2026-08-10T12:00:00+00:00"}],
        [{"id": "r-storno", "tenant_id": "T", "property_id": "p-archiv",
          "channel": "airbnb", "ota_name": None, "adults": 2, "children": 0,
          "check_in": "2026-09-12", "check_out": "2026-09-14",
          "status": "cancelled"}],
    )
    svc = TasksService(client=db)
    rows = svc.calendar(
        "T", "2026-09-01T00:00:00Z", "2026-09-30T23:59:59Z", ctx=_admin()
    ).rows
    assert [r.property_id for r in rows] == [None, "p1"]
