"""Regel-Engine: aus `task_rules` werden echte Aufgaben.

Bis hierher waren planmäßige und regelmäßige Aufgaben Karteikarten — anlegbar,
aber ohne Wirkung: nichts hat sie je ausgewertet, `last_materialized_on` blieb
immer leer. Dieses Modul ist der eine Ort, der aus einer Regel eine Zeile in
`tasks` macht:

* **planmäßig** (`kind='auto'`) — hängt an einer Reservierung. Der
  Reservierungs-Schreibpfad ruft `sync_for_reservation` nach jedem Anlegen,
  Verschieben und Stornieren.
* **regelmäßig** (`kind='recurring'`) — hängt am Kalender. Der Worker-Tick ruft
  `materialize_recurring` und rollt ein Vorschaufenster aus.

Zwei Regeln beherrschen den Code:

**Wurzel 1 — Gegenzustand.** Eine verschobene Buchung erzeugt KEINE zweite
Aufgabe, sie verschiebt die vorhandene. Eine stornierte Buchung räumt die
erzeugten Aufgaben weg (`remove_on_cancellation`) bzw. setzt sie auf
`cancelled`; manuell angelegte Aufgaben (`rule_id is null`) bleiben unangetastet
— die kennt die Regel nicht und darf sie nicht wegräumen.

**Wurzel 2 — alles kommt doppelt.** Der Hook feuert bei jedem Update, der Tick
läuft mehrfach, ein Retry wiederholt den Insert. Der Zustand wird deshalb VOR
dem Schreiben gelesen und wiederverwendet; als Netz darunter liegen die beiden
partiellen UNIQUE-Indizes aus 0272. Ein 23505 heißt hier „war schon da" und
wird gezielt gefangen — nicht ein breites `except`, das auch echte Fehler
verschluckt (Wurzel 5).
"""
from __future__ import annotations

import calendar
from datetime import UTC, date, datetime, time, timedelta

from postgrest.exceptions import APIError
from supabase import Client

from src.core.logging import get_logger
from src.features.notification_settings.ereignisse import melde_aufgaben_zuweisung

from .schemas import TaskSource, TaskStatus

log = get_logger("nextdays.tasks.engine")

# Wie weit wiederkehrende Aufgaben im Voraus angelegt werden. Weiter wäre keine
# Planung mehr, sondern Vorrat: jede Regeländerung müsste rückwirkend aufräumen.
HORIZON_DAYS = 60

# Ein Lauf legt höchstens so viele Termine je Regel an. Schutz gegen eine
# „täglich, Intervall 1, ohne Enddatum"-Regel, die den Horizont vollschreibt
# (Wurzel 8: jeder unbegrenzte Bereich bekommt eine Obergrenze).
MAX_OCCURRENCES_PER_RULE = 400

_CONFLICT = "23505"

_WEEKDAY_POSITIONS = {"first": 0, "second": 1, "third": 2, "fourth": 3}


class RuleEngineError(Exception):
    """Die Regel ist unbrauchbar konfiguriert (kein Trigger, kein Zeitplan)."""


# ---------------------------------------------------------------------------
# Zeitanker
# ---------------------------------------------------------------------------


def _parse_clock(value: object) -> time | None:
    """„15:00" / „15:00:00" → time. Unlesbares ergibt None (keine Fantasieuhr)."""
    if isinstance(value, time):
        return value
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        return time.fromisoformat(value.strip())
    except ValueError:
        return None


def _at(day: date, clock: time | None) -> datetime:
    """Tag + Uhrzeit → UTC-Zeitstempel. Ohne bekannte Uhrzeit gilt der TAG
    (00:00), nicht eine erfundene Standardstunde (Wurzel 4)."""
    return datetime.combine(day, clock or time(0, 0), tzinfo=UTC)


def _as_date(value: object) -> date | None:
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, str) and value:
        try:
            return date.fromisoformat(value[:10])
        except ValueError:
            return None
    return None


def _reservation_anchors(
    reservation: dict[str, object],
) -> tuple[datetime, datetime] | None:
    """Check-in- und Check-out-Zeitpunkt der Reservierung."""
    check_in = _as_date(reservation.get("check_in"))
    check_out = _as_date(reservation.get("check_out"))
    if check_in is None or check_out is None:
        return None
    return (
        _at(check_in, _parse_clock(reservation.get("checkin_time"))),
        _at(check_out, _parse_clock(reservation.get("checkout_time"))),
    )


def _trigger_time(
    trigger: str | None,
    offset_minutes: int,
    reservation: dict[str, object],
    anchors: tuple[datetime, datetime],
) -> datetime | None:
    """Zeitpunkt eines Triggers. `offset_minutes` ist IMMER die Feinjustierung
    mit Vorzeichen — bei `days_before_check_in` trägt sie die ganze Distanz."""
    if not trigger:
        return None
    check_in, check_out = anchors
    if trigger == "booking_confirmed":
        created = reservation.get("created_at")
        base = (
            datetime.fromisoformat(str(created).replace("Z", "+00:00"))
            if created
            else check_in
        )
    elif trigger in ("check_in", "days_before_check_in"):
        base = check_in
    elif trigger == "after_check_in_24h":
        # Lodgify-Semantik: Check-in + 24 h, aber nie über den Check-out hinaus —
        # bei Kurzaufenthalten endet die Aufgabe mit der Abreise.
        base = min(check_in + timedelta(hours=24), check_out)
    elif trigger in ("check_out", "days_after_check_out"):
        base = check_out
    else:
        raise RuleEngineError(f"Unbekannter Trigger: {trigger}")
    return base + timedelta(minutes=offset_minutes)


# ---------------------------------------------------------------------------
# Wiederholungs-Muster
# ---------------------------------------------------------------------------


def _monthly_day(year: int, month: int, rec: dict[str, object]) -> date | None:
    """Der Termin eines Monats: entweder fester Tag oder Wochentagsmuster."""
    last = calendar.monthrange(year, month)[1]
    dom = rec.get("day_of_month")
    if isinstance(dom, int) and 1 <= dom <= 31:
        # Der 31. in einem 30-Tage-Monat rutscht auf den Monatsletzten statt
        # auszufallen — sonst hätte die Regel stumme Lücken.
        return date(year, month, min(dom, last))
    position = rec.get("weekday_pattern_position")
    weekday = rec.get("weekday_pattern_weekday")
    if not isinstance(weekday, int) or not 0 <= weekday <= 6:
        return None
    days = [
        date(year, month, d)
        for d in range(1, last + 1)
        if date(year, month, d).weekday() == weekday
    ]
    if position == "last":
        return days[-1]
    index = _WEEKDAY_POSITIONS.get(str(position))
    if index is None or index >= len(days):
        return None
    return days[index]


def _occurrences(
    rec: dict[str, object],
    starts_on: date,
    ends_on: date | None,
    window_from: date,
    window_to: date,
) -> list[date]:
    """Termine einer wiederkehrenden Regel im Fenster. Unvollständige Muster
    ergeben eine LEERE Liste — lieber keine Aufgabe als eine geratene."""
    frequency = rec.get("frequency")
    interval = max(1, int(rec.get("interval") or 1))
    low = max(starts_on, window_from)
    high = min(ends_on, window_to) if ends_on else window_to
    if low > high:
        return []

    out: list[date] = []
    if frequency == "daily":
        # Auf das Raster von starts_on einrasten, damit „alle 3 Tage" auch nach
        # einem Neustart des Ticks dieselben Tage trifft.
        shift = (low - starts_on).days % interval
        day = low + timedelta(days=(interval - shift) % interval)
        while day <= high and len(out) < MAX_OCCURRENCES_PER_RULE:
            out.append(day)
            day += timedelta(days=interval)
    elif frequency == "weekly":
        mask = rec.get("weekday_mask")
        if not isinstance(mask, int) or mask == 0:
            return []
        week_zero = starts_on - timedelta(days=starts_on.weekday())
        day = low
        while day <= high and len(out) < MAX_OCCURRENCES_PER_RULE:
            weeks = (day - timedelta(days=day.weekday()) - week_zero).days // 7
            if weeks % interval == 0 and mask & (1 << day.weekday()):
                out.append(day)
            day += timedelta(days=1)
    elif frequency in ("monthly", "yearly"):
        step = interval if frequency == "monthly" else interval * 12
        year, month = starts_on.year, starts_on.month
        while date(year, month, 1) <= high and len(out) < MAX_OCCURRENCES_PER_RULE:
            day = _monthly_day(year, month, rec)
            if day is not None and low <= day <= high:
                out.append(day)
            month += step
            year += (month - 1) // 12
            month = (month - 1) % 12 + 1
    return out


# ---------------------------------------------------------------------------
# Laden
# ---------------------------------------------------------------------------


def _rules(db: Client, tenant_id: str, kind: str) -> list[dict[str, object]]:
    return (
        db.table("task_rules")
        .select("*")
        .eq("tenant_id", tenant_id)
        .eq("kind", kind)
        .eq("active", True)
        .execute()
    ).data or []


def _rule_properties(db: Client, rule_ids: list[str]) -> dict[str, set[str]]:
    if not rule_ids:
        return {}
    rows = (
        db.table("task_rule_assignments")
        .select("rule_id, property_id")
        .in_("rule_id", rule_ids)
        .execute()
    ).data or []
    out: dict[str, set[str]] = {}
    for row in rows:
        out.setdefault(row["rule_id"], set()).add(row["property_id"])
    return out


def _checklist_source(rule: dict[str, object]) -> str:
    """Woher die Punkte kommen: aus der verknüpften Vorlage, sonst aus der Regel
    selbst."""
    return str(rule.get("template_rule_id") or rule["id"])


def _template_items(
    db: Client, tenant_id: str, rule_ids: set[str]
) -> dict[str, list[dict[str, object]]]:
    if not rule_ids:
        return {}
    rows = (
        db.table("task_rule_items")
        .select("*")
        .eq("tenant_id", tenant_id)
        .in_("rule_id", list(rule_ids))
        .order("sort_order")
        .execute()
    ).data or []
    out: dict[str, list[dict[str, object]]] = {}
    for row in rows:
        out.setdefault(row["rule_id"], []).append(row)
    return out


# ---------------------------------------------------------------------------
# Schreiben
# ---------------------------------------------------------------------------


def _copy_checklist(
    db: Client, task_id: str, items: list[dict[str, object]]
) -> None:
    """Vorlagen-Punkte als Momentaufnahme in die Aufgabe kopieren.

    Kopie, nicht Verweis: eine später geänderte Vorlage darf eine laufende oder
    schon abgehakte Aufgabe nicht rückwirkend umschreiben.
    """
    if not items:
        return
    db.table("checklist_items").insert(
        [
            {
                "task_id": task_id,
                "label": item["label"],
                "description": item.get("description"),
                "room": item.get("room"),
                "requires_photo": bool(item.get("requires_photo")),
                "sort_order": index,
            }
            for index, item in enumerate(items)
        ]
    ).execute()


def _task_payload(
    tenant_id: str,
    rule: dict[str, object],
    *,
    property_id: str | None,
    reservation_id: str | None,
    occurrence_on: date | None,
    start: datetime | None,
    end: datetime | None,
    source: TaskSource,
) -> dict[str, object]:
    return {
        "tenant_id": tenant_id,
        "rule_id": rule["id"],
        "property_id": property_id,
        "reservation_id": reservation_id,
        "occurrence_on": occurrence_on.isoformat() if occurrence_on else None,
        "assignee_id": rule.get("assignee_id"),
        "title": rule["name"],
        "description": rule.get("description"),
        "status": TaskStatus.open.value,
        "source": source.value,
        "priority": int(rule.get("priority") or 0),
        "needs_inspection": bool(rule.get("needs_inspection")),
        "start_at": start.isoformat() if start else None,
        "end_at": end.isoformat() if end else None,
        "due_at": (end or start).isoformat() if (end or start) else None,
    }


def _insert_task(
    db: Client, payload: dict[str, object], items: list[dict[str, object]]
) -> str | None:
    """Aufgabe anlegen. Ein 23505 heißt: ein paralleler Lauf war schneller —
    das ist der Normalfall bei Retry/Doppelklick, kein Fehler (Wurzel 2)."""
    try:
        res = db.table("tasks").insert(payload).execute()
    except APIError as exc:
        if exc.code == _CONFLICT:
            return None
        raise
    if not res.data:
        return None
    task_id = str(res.data[0]["id"])
    _copy_checklist(db, task_id, items)
    # Der Zugewiesene erfährt von der Aufgabe (0331). Genau hier, weil dies der
    # EINZIGE Insert-Punkt der Engine ist — und nur bei echter Neuanlage: ein
    # 23505 oben ist oben schon abgebogen, ein zweiter Lauf meldet also nicht
    # erneut (Wurzel 2). Der Rest der Entdopplung liegt im dedup_key.
    melde_aufgaben_zuweisung(
        db,
        tenant_id=str(payload.get("tenant_id") or ""),
        task_id=task_id,
        assignee_id=(
            str(payload["assignee_id"]) if payload.get("assignee_id") else None
        ),
        titel=str(payload.get("title") or ""),
        property_id=(
            str(payload["property_id"]) if payload.get("property_id") else None
        ),
    )
    return task_id


# ---------------------------------------------------------------------------
# Planmäßige Aufgaben (an der Reservierung)
# ---------------------------------------------------------------------------


def sync_for_reservation(
    db: Client, tenant_id: str, reservation: dict[str, object]
) -> int:
    """Aufgaben einer Reservierung mit den planmäßigen Regeln abgleichen.

    Idempotent und verschiebend: gibt es zur Regel schon eine Aufgabe dieser
    Reservierung, wird sie AKTUALISIERT (Wurzel 1) — nie eine zweite angelegt.
    Rückgabe: Zahl der angelegten oder verschobenen Aufgaben.
    """
    reservation_id = str(reservation["id"])
    if str(reservation.get("status") or "") == "cancelled":
        return _on_cancelled(db, tenant_id, reservation_id)

    anchors = _reservation_anchors(reservation)
    if anchors is None:
        log.warning("task_rules_ohne_zeitraum", reservation_id=reservation_id)
        return 0

    property_id = reservation.get("property_id")
    rules = _rules(db, tenant_id, "auto")
    assignments = _rule_properties(db, [str(r["id"]) for r in rules])
    matching = [
        r
        for r in rules
        if not assignments.get(str(r["id"]))
        or str(property_id) in assignments[str(r["id"])]
    ]
    if not matching:
        return 0

    items = _template_items(
        db, tenant_id, {_checklist_source(r) for r in matching}
    )
    existing = {
        str(row["rule_id"]): row
        for row in (
            db.table("tasks")
            .select("id, rule_id, status")
            .eq("tenant_id", tenant_id)
            .eq("reservation_id", reservation_id)
            .not_.is_("rule_id", "null")
            .execute()
        ).data
        or []
    }

    touched = 0
    for rule in matching:
        try:
            start = _trigger_time(
                str(rule.get("start_trigger") or "") or None,
                int(rule.get("start_offset_minutes") or 0),
                reservation,
                anchors,
            )
            end = _trigger_time(
                str(rule.get("end_trigger") or "") or None,
                int(rule.get("end_offset_minutes") or 0),
                reservation,
                anchors,
            )
        except RuleEngineError as exc:
            # Eine kaputt konfigurierte Regel darf die übrigen nicht mitreißen.
            log.warning("task_rule_trigger_unbekannt", rule_id=rule["id"], error=str(exc))
            continue
        if start is None:
            # Ohne Start-Trigger kann die Regel nichts auslösen — sie ist noch
            # nicht fertig konfiguriert, kein Grund für einen Fehler.
            continue
        if end is None and rule.get("duration_minutes"):
            end = start + timedelta(minutes=int(rule["duration_minutes"]))

        known = existing.get(str(rule["id"]))
        if known:
            if known.get("status") in (TaskStatus.done.value, TaskStatus.cancelled.value):
                # Erledigtes bleibt erledigt: eine Verschiebung der Buchung
                # macht eine bereits gemachte Reinigung nicht ungeschehen.
                continue
            db.table("tasks").update(
                {
                    "start_at": start.isoformat(),
                    "end_at": end.isoformat() if end else None,
                    "due_at": (end or start).isoformat(),
                    "property_id": property_id,
                }
            ).eq("id", known["id"]).eq("tenant_id", tenant_id).execute()
            touched += 1
            continue

        created = _insert_task(
            db,
            _task_payload(
                tenant_id,
                rule,
                property_id=str(property_id) if property_id else None,
                reservation_id=reservation_id,
                occurrence_on=None,
                start=start,
                end=end,
                source=TaskSource.auto,
            ),
            items.get(_checklist_source(rule), []),
        )
        if created:
            touched += 1

    log.info(
        "task_rules_synced",
        reservation_id=reservation_id,
        rules=len(matching),
        touched=touched,
    )
    return touched


def _on_cancelled(db: Client, tenant_id: str, reservation_id: str) -> int:
    """Storno-Gegenzustand (Wurzel 1).

    Regeln mit `remove_on_cancellation` verschwinden samt Aufgabe; die übrigen
    bleiben als `cancelled` stehen, damit die Reinigungskraft sieht, dass der
    Termin entfällt, statt dass er kommentarlos aus ihrer Liste verschwindet.
    Manuelle Aufgaben (`rule_id is null`) rührt die Engine nicht an.
    """
    rows = (
        db.table("tasks")
        .select("id, rule_id, status")
        .eq("tenant_id", tenant_id)
        .eq("reservation_id", reservation_id)
        .not_.is_("rule_id", "null")
        .execute()
    ).data or []
    open_rows = [
        r
        for r in rows
        if r.get("status") not in (TaskStatus.done.value, TaskStatus.cancelled.value)
    ]
    if not open_rows:
        return 0

    flags = {
        str(r["id"]): bool(r.get("remove_on_cancellation"))
        for r in (
            db.table("task_rules")
            .select("id, remove_on_cancellation")
            .eq("tenant_id", tenant_id)
            .in_("id", list({str(r["rule_id"]) for r in open_rows}))
            .execute()
        ).data
        or []
    }
    remove = [r["id"] for r in open_rows if flags.get(str(r["rule_id"]), True)]
    keep = [r["id"] for r in open_rows if not flags.get(str(r["rule_id"]), True)]

    if remove:
        db.table("tasks").delete().eq("tenant_id", tenant_id).in_(
            "id", remove
        ).execute()
    if keep:
        db.table("tasks").update({"status": TaskStatus.cancelled.value}).eq(
            "tenant_id", tenant_id
        ).in_("id", keep).execute()

    log.info(
        "task_rules_storniert",
        reservation_id=reservation_id,
        removed=len(remove),
        cancelled=len(keep),
    )
    return len(remove) + len(keep)


# ---------------------------------------------------------------------------
# Regelmäßige Aufgaben (am Kalender)
# ---------------------------------------------------------------------------


def materialize_recurring(
    db: Client, tenant_id: str, *, today: date, horizon_days: int = HORIZON_DAYS
) -> int:
    """Wiederkehrende Regeln bis `today + horizon_days` ausrollen.

    Rückgabe: Zahl der neu angelegten Aufgaben. Läuft der Tick zweimal, ist die
    zweite Zahl 0 — die Termine liegen schon vor und der UNIQUE-Index aus 0272
    fängt das Rennen zwischen zwei Workern ab (Wurzel 2).
    """
    window_to = today + timedelta(days=horizon_days)
    rules = _rules(db, tenant_id, "recurring")
    if not rules:
        return 0
    assignments = _rule_properties(db, [str(r["id"]) for r in rules])
    items = _template_items(db, tenant_id, {_checklist_source(r) for r in rules})

    created = 0
    for rule in rules:
        starts_on = _as_date(rule.get("starts_on"))
        if starts_on is None:
            # Ohne Anfangsdatum gibt es kein Raster — die Regel ist unfertig.
            continue
        days = _occurrences(
            rule.get("recurrence") or {},
            starts_on,
            _as_date(rule.get("ends_on")),
            today,
            window_to,
        )
        if not days:
            continue
        created += _materialize_rule(
            db,
            tenant_id,
            rule,
            days,
            sorted(assignments.get(str(rule["id"]), set())) or [None],
            items.get(_checklist_source(rule), []),
        )
        db.table("task_rules").update(
            {"last_materialized_on": window_to.isoformat()}
        ).eq("id", rule["id"]).eq("tenant_id", tenant_id).execute()

    if created:
        log.info("task_rules_materialisiert", tenant_id=tenant_id, created=created)
    return created


def _materialize_rule(
    db: Client,
    tenant_id: str,
    rule: dict[str, object],
    days: list[date],
    property_ids: list[str | None],
    items: list[dict[str, object]],
) -> int:
    """Eine Regel für ihre Termine ausrollen.

    Der UNIQUE-Index trägt `(rule_id, occurrence_on)` — bei mehreren Objekten
    gehört ein Termin also EINER Aufgabe, die alle betroffenen Objekte meint.
    Deshalb bekommt sie das erste Objekt als Bezug; für getrennte Aufgaben je
    Objekt legt man getrennte Regeln an (so hält es Lodgify auch).
    """
    known = {
        str(row["occurrence_on"])
        for row in (
            db.table("tasks")
            .select("occurrence_on")
            .eq("tenant_id", tenant_id)
            .eq("rule_id", rule["id"])
            .gte("occurrence_on", days[0].isoformat())
            .lte("occurrence_on", days[-1].isoformat())
            .execute()
        ).data
        or []
        if row.get("occurrence_on")
    }
    clock = _parse_clock(rule.get("start_time"))
    duration = rule.get("duration_minutes")
    created = 0
    for day in days:
        if day.isoformat() in known:
            continue
        start = _at(day, clock)
        end = start + timedelta(minutes=int(duration)) if duration else None
        if _insert_task(
            db,
            _task_payload(
                tenant_id,
                rule,
                property_id=property_ids[0],
                reservation_id=None,
                occurrence_on=day,
                start=start,
                end=end,
                source=TaskSource.recurring,
            ),
            items,
        ):
            created += 1
    return created
