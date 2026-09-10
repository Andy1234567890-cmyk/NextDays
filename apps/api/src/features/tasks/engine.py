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
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from postgrest.exceptions import APIError
from supabase import Client

from src.core.logging import get_logger
from src.features.notification_settings.ereignisse import melde_aufgaben_zuweisung
from src.features.tasks.inventur import zaehlpunkte_fuer_abreise

from .eigennutzung import bestellte_regeln, regel_erlaubt
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

# Zustände, in denen eine Reservierung nichts mehr auslöst und ihre planmäßigen
# Aufgaben weg müssen (Wurzel 1: Gegenzustand). `cancelled` war lange der
# einzige geprüfte Wert — `declined`/`expired` aus dem Anfrage-Modell (Request
# to Book) ließen eine erzeugte Reinigung stehen, obwohl der Verkauf nie
# zustande kam.
_ENDSTATUS = frozenset({"cancelled", "declined", "expired"})

# Eine offene Anfrage ist noch kein Verkauf und darf keine Reinigung planen.
# Aufgaben entstehen erst mit dem Annehmen (`accept_request` → confirmed) bzw.
# mit der bezahlten Buchung. `pending` gehört NICHT hierher: das ist eine echte
# Buchung, die nur noch nicht bezahlt ist.
_UNVERBINDLICH = frozenset({"requested"})

# Wie weit der Nachzug ZURÜCK schaut. Ein Fenster nur ab heute lässt genau die
# Arbeit unsichtbar, die liegen geblieben ist: live fehlten am 23.08.2026 fünf
# Reinigungen zu fünf Abreisen dieses Tages, und ab dem 24. hätte der Lauf sie
# nie mehr angefasst — der Tag wäre für immer leer geblieben, obwohl niemand
# weiß, ob geputzt wurde. Zwei Wochen sind der Zeitraum, in dem eine offene
# Reinigung noch eine Aussage ist; weiter zurück wäre sie Archiv-Rauschen.
NACHZUG_RUECKBLICK_TAGE = 14

# Wie viele Reservierungen ein Nachzieh-Lauf je Tenant betrachtet (Wurzel 8:
# jeder unbegrenzte Bereich bekommt eine Obergrenze). Der Lauf arbeitet in
# Seiten bis hierhin — eine einzelne `limit`-Abfrage hätte bei einem großen
# Betrieb IMMER dieselben ersten 500 geholt, und der Rest wäre nie dran
# gekommen: eine stille Grenze, die wie „fertig" aussieht.
MAX_NACHZUG_RESERVIERUNGEN = 5000

# Seitengröße je Abfrage. Eine Zeile ist klein; die Grenze ist die URL-Länge
# der `in_`-Liste im Aufgaben-Abgleich, nicht der Speicher.
_NACHZUG_SEITE = 200

# PostgREST bekommt `in_`-Listen über die URL — in Blöcken, nicht als eine
# Riesenliste.
_BLOCK = 100

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


def _at(day: date, clock: time | None, zone: ZoneInfo | None = None) -> datetime:
    """Tag + Uhrzeit → UTC-Zeitstempel. Ohne bekannte Uhrzeit gilt der TAG
    (00:00), nicht eine erfundene Standardstunde (Wurzel 4).

    `zone` ist die Zeitzone des OBJEKTS. Sie ist bei den Tages-Ankern nicht
    Kosmetik, sondern der Unterschied zwischen richtig und falsch: „10:00 am
    Anreisetag" meint 10:00 vor Ort. In UTC gerechnet stünde die Reinigung in
    Dänemark im Sommer um 12:00 vor der Tür, und eine Aufgabe ohne Uhrzeit
    zeigte „02:00" statt Tagesbeginn — genau so gemeldet am 03.09.2026.

    Ohne Zone bleibt es bei UTC. Das ist die ehrliche Auskunft für ein Objekt
    ohne gepflegte Zeitzone, keine geratene Ortszeit (Wurzel 4).
    """
    return datetime.combine(day, clock or time(0, 0), tzinfo=zone or UTC).astimezone(
        UTC
    )


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
    zone: ZoneInfo | None = None,
) -> tuple[datetime, datetime] | None:
    """Check-in- und Check-out-Zeitpunkt der Reservierung.

    `zone` ist die Zeitzone des OBJEKTS, und sie gehoert hierher, nicht nur an
    die Tages-Anker. „Check-in um 16:00" meint 16:00 VOR ORT; in UTC gerechnet
    stuende die Aufgabe zwei Stunden daneben.

    Sichtbar wird es dort, wo die Buchung GAR KEINE Uhrzeit hat — live bei 351
    von 536 Buchungen dieses Betriebs (03.09.2026). `_at` setzt dann den
    Tagesbeginn, und in UTC gerechnet zeigte der Kalender „02:00" statt
    Mitternacht. Gemeldet wurde genau dieses Bild: „das Zeitfenster stimmt
    auch nicht".
    """
    check_in = _as_date(reservation.get("check_in"))
    check_out = _as_date(reservation.get("check_out"))
    if check_in is None or check_out is None:
        return None
    return (
        _at(check_in, _parse_clock(reservation.get("checkin_time")), zone),
        _at(check_out, _parse_clock(reservation.get("checkout_time")), zone),
    )


def _zone(name: object) -> ZoneInfo | None:
    """Die Zeitzone eines Objekts. Unbekanntes ergibt None, nicht UTC-als-ob:
    eine geratene Zone verschiebt jede Aufgabe still um Stunden (Wurzel 4)."""
    if not isinstance(name, str) or not name.strip():
        return None
    try:
        return ZoneInfo(name.strip())
    except (ZoneInfoNotFoundError, ValueError):
        log.warning("task_zeitzone_unbekannt", zone=name)
        return None


def _trigger_time(
    trigger: str | None,
    offset_minutes: int,
    reservation: dict[str, object],
    anchors: tuple[datetime, datetime],
    clock: time | None = None,
    zone: ZoneInfo | None = None,
) -> datetime | None:
    """Zeitpunkt eines Triggers. `offset_minutes` ist IMMER die Feinjustierung
    mit Vorzeichen — bei `days_before_check_in` trägt sie die ganze Distanz.

    `clock` ist die an der REGEL gepflegte Uhrzeit (0535). Sie gilt
    ausschliesslich bei den Tages-Ankern `arrival_day`/`departure_day`: dort
    zaehlt nur das DATUM der Reservierung, die Stunde kommt aus der Regel. Bei
    allen uebrigen Ankern bleibt die Uhrzeit der Buchung massgeblich — sonst
    haette dieselbe Aufgabe zwei Wahrheiten.

    `zone` ist die Zeitzone des Objekts; sie gilt aus demselben Grund nur bei
    den Tages-Ankern. Bei den uebrigen steckt die Zone schon in den Ankern
    selbst, die aus der Buchung kommen.
    """
    if not trigger:
        return None
    check_in, check_out = anchors
    if trigger == "arrival_day":
        # Das KALENDERDATUM der Reservierung, nicht `.date()` des Ankers.
        #
        # DER FEHLER (03.09.2026, 25 Aufgaben live betroffen): `check_in` ist
        # hier bereits der von `_at` nach UTC gerechnete Anker. Ohne gepflegte
        # `checkin_time` setzt `_at` lokal 00:00 — in Kopenhagen im Sommer also
        # `22:00Z des VORTAGS`. `.date()` liest daraus den Vortag, und der
        # Anreisecheck stand einen Tag vor der Anreise. Die Korrelation war
        # lückenlos: mit gepflegter Uhrzeit 18 von 18 richtig, ohne sie 25 von
        # 25 falsch — und 1346 von 1531 Buchungen haben keine.
        #
        # `reservations.check_in` ist eine `date`-Spalte und damit die Wahrheit
        # über den Tag; sie durch eine Zeitzone zu schicken, kann sie nur
        # verschieben.
        tag = _as_date(reservation.get("check_in")) or check_in.date()
        base = _at(tag, clock, zone)
    elif trigger == "departure_day":
        tag = _as_date(reservation.get("check_out")) or check_out.date()
        base = _at(tag, clock, zone)
    elif trigger == "booking_confirmed":
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


def _objekt_zonen(db: Client, tenant_id: str) -> dict[str, ZoneInfo | None]:
    """Die Zeitzone je Objekt des Betriebs, in EINEM Abruf.

    Die Alternative waere eine Abfrage je Buchung — beim Nachzug ueber hunderte
    Reservierungen ist das derselbe Datensatz hundertfach. Ein Objekt ohne
    gepflegte Zone bekommt `None` und rechnet weiter in UTC (`_at`).
    """
    rows = (
        db.table("properties")
        .select("id, timezone")
        .eq("tenant_id", tenant_id)
        .execute()
    ).data or []
    return {str(r["id"]): _zone(r.get("timezone")) for r in rows}


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


_ABREISE_ANKER = frozenset({"check_out", "departure_day", "days_after_check_out"})


def _ist_abreise(rule: dict[str, object]) -> bool:
    """Haengt diese Regel an der Abreise?

    Geprueft wird der START-Anker: `end_trigger` steht bei vielen Regeln auf
    demselben Wert, aber der Start sagt, WANN die Arbeit beginnt. Eine
    Anreise-Aufgabe, die zufaellig bis zur Abreise laeuft, ist keine Zaehlung.
    """
    return str(rule.get("start_trigger") or "") in _ABREISE_ANKER


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
                # Zaehlpunkt (0623): worauf sich dieser Punkt bezieht. Nur
                # gesetzt, wenn die Zeile aus dem Inventar stammt — bei einer
                # gewoehnlichen Vorlagenzeile bleibt es None.
                "inventory_item_id": item.get("inventory_item_id"),
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
    ordered_by_owner: bool = False,
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
        # Spur: diese Aufgabe entstand aus einer BESTELLUNG des Eigentümers zu
        # seiner Sperrung (0510), nicht aus dem gewöhnlichen Lauf. Steht an der
        # Aufgabe selbst, weil die Frage „hat er das bestellt?" auch nach dem
        # Widerruf der Sperre beantwortbar bleiben muss — ein Rückschluss über
        # drei Tabellen liefe dann ins Leere.
        "ordered_by_owner": ordered_by_owner,
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
    if not items and payload.get("rule_id"):
        # LAUT, nicht stumm (Wurzel 5): eine planmäßige Regel ohne Vorlage und
        # ohne eigene Punkte erzeugt Aufgaben, die in der App nur einen Titel
        # zeigen. Live liefen so vier aktive Regeln (03.09.2026), und niemand
        # sah es, bis eine Mitarbeiterin fragte, wo die Checkliste sei.
        log.warning(
            "task_ohne_checkliste_angelegt",
            tenant_id=str(payload.get("tenant_id") or ""),
            task_id=task_id,
            rule_id=str(payload["rule_id"]),
            titel=str(payload.get("title") or ""),
        )
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


def _regel_zeitfenster(
    rule: dict[str, object],
    reservation: dict[str, object],
    anchors: tuple[datetime, datetime],
    zone: ZoneInfo | None = None,
) -> tuple[datetime, datetime | None] | None:
    """Start- und Endzeitpunkt einer planmäßigen Regel für diese Buchung.

    `None`, wenn die Regel (noch) nichts auslösen kann — kaputter oder
    fehlender Start-Trigger. Beides ist kein Fehler des Aufrufers: eine
    halbfertige Regel darf die übrigen nicht mitreißen.
    """
    try:
        start = _trigger_time(
            str(rule.get("start_trigger") or "") or None,
            int(rule.get("start_offset_minutes") or 0),
            reservation,
            anchors,
            _parse_clock(rule.get("start_clock")),
            zone,
        )
        end = _trigger_time(
            str(rule.get("end_trigger") or "") or None,
            int(rule.get("end_offset_minutes") or 0),
            reservation,
            anchors,
            # Ohne eigene Endzeit gilt die Startzeit weiter: eine Regel „von
            # 10:00", deren Ende nur den Tag nennt, endet um 10:00 desselben
            # Tages und nicht um Mitternacht davor (das waere ein Ende VOR dem
            # Start und fiele unten stumm heraus).
            _parse_clock(rule.get("end_clock")) or _parse_clock(rule.get("start_clock")),
            zone,
        )
    except RuleEngineError as exc:
        log.warning("task_rule_trigger_unbekannt", rule_id=rule["id"], error=str(exc))
        return None
    if start is None:
        # Ohne Start-Trigger ist die Regel noch nicht fertig konfiguriert.
        return None
    if end is None and rule.get("duration_minutes"):
        end = start + timedelta(minutes=int(rule["duration_minutes"]))
    if end is not None and end < start:
        # LETZTE BASTION gegen ein Ende vor dem Start (Wurzel 5).
        #
        # Start und Ende kommen aus ZWEI unabhaengigen Triggern, die niemand
        # gegeneinander geprueft hat. Zeigte der eine auf die Abreise und der
        # andere auf die Anreise, schrieb der Motor das kommentarlos in die
        # Datenbank: live standen so neun Aufgaben mit einem Ende bis zu 64 Tage
        # VOR ihrem Start (31.08.2026) — im Kalender ein rueckwaerts laufender
        # Balken, in der Liste ein unlesbares Datumspaar.
        #
        # Die Aufgabe wird trotzdem angelegt, nur OHNE das unmoegliche Ende:
        # sie auszulassen hiesse, eine Reinigung verschwindet still, weil ihre
        # Regel schief steht. Ein fehlendes Ende ist sichtbar und harmlos, ein
        # fehlender Termin ist es nicht. Die Regel selbst weist
        # `RulesService` beim Speichern zurueck — hier steht der Schutz fuer
        # Regeln, die VOR dieser Pruefung angelegt wurden.
        log.warning(
            "task_regel_ende_vor_start",
            rule_id=rule["id"],
            start=start.isoformat(),
            end=end.isoformat(),
        )
        end = None
    return start, end


def _vorhandene_nachziehen(
    db: Client,
    tenant_id: str,
    rule: dict[str, object],
    known: dict[str, object],
    items: list[dict[str, object]],
    start: datetime,
    end: datetime | None,
    property_id: object,
    *,
    verschieben: bool,
) -> bool:
    """Eine SCHON vorhandene Regel-Aufgabe nachziehen: Punkte und Zeiten.

    Erledigt oder storniert: in Ruhe lassen — eine Verschiebung der Buchung
    macht eine bereits gemachte Reinigung nicht ungeschehen, und ihre
    Checkliste ist eine Momentaufnahme dessen, was getan wurde.

    FEHLENDE CHECKLISTE NACHZIEHEN (03.09.2026). Die Punkte werden sonst nur
    im Moment des Inserts kopiert — aus der Vorlage, die die Regel GENAU DANN
    hatte. Wer die Vorlage später an die Regel hängt (live: „Anreisecheck
    14–18", Vorlage um 19:44 verknüpft, alle 42 Aufgaben existierten längst),
    erreichte damit keine einzige Aufgabe; in der App stand „keine Checkliste
    hinterlegt" (Wurzel 1: Gegenzustand). Gilt auch bei `verschieben=False`:
    das ist „nur Fehlendes anlegen", und fehlende Punkte SIND Fehlendes.
    Idempotent, weil nur Aufgaben OHNE einen einzigen Punkt bedient werden —
    ein Doppellauf schreibt nichts doppelt (Wurzel 2).

    Zeiten nur, wenn der Lauf verschieben darf (Regel-Speichern), nicht im
    stündlichen Abgleich — der schriebe sonst jede Stunde dieselben Werte in
    jede Aufgabe (Realtime-Rauschen ohne Änderung).
    """
    if known.get("status") in (TaskStatus.done.value, TaskStatus.cancelled.value):
        return False
    punkte_nachgezogen = False
    if items and not known.get("hat_checkliste"):
        _copy_checklist(db, str(known["id"]), items)
        known["hat_checkliste"] = True
        punkte_nachgezogen = True
        log.info(
            "task_checkliste_nachgezogen",
            tenant_id=tenant_id,
            task_id=str(known["id"]),
            rule_id=str(rule["id"]),
            punkte=len(items),
        )
    if not verschieben:
        return punkte_nachgezogen
    db.table("tasks").update(
        {
            "start_at": start.isoformat(),
            "end_at": end.isoformat() if end else None,
            "due_at": (end or start).isoformat(),
            "property_id": property_id,
        }
    ).eq("id", known["id"]).eq("tenant_id", tenant_id).execute()
    return True


def _regel_anwenden(
    db: Client,
    tenant_id: str,
    rule: dict[str, object],
    reservation: dict[str, object],
    anchors: tuple[datetime, datetime],
    items: list[dict[str, object]],
    known: dict[str, object] | None,
    *,
    verschieben: bool = True,
    nicht_vor: datetime | None = None,
    bestellt: dict[str, set[str]] | None = None,
    zone: ZoneInfo | None = None,
) -> bool:
    """EINE planmäßige Regel auf EINE Reservierung anwenden.

    Der gemeinsame Kern von `sync_for_reservation` (ein Schreibpfad, alle
    Regeln einer Buchung) und `nachziehen_planmaessig` (ein Tick, alle
    Buchungen einer Regel). Rückgabe: True, wenn eine Aufgabe entstand oder
    verschoben wurde.

    `verschieben=False` legt nur Fehlendes an und lässt Vorhandenes in Ruhe —
    so schreibt der stündliche Abgleich nicht bei jedem Lauf dieselben Werte
    erneut in jede Aufgabe (Realtime-Rauschen, Schreiblast ohne Änderung).

    `nicht_vor` verwirft Aufgaben, deren Termin länger zurückliegt: einen
    Willkommens-Check für eine Anreise von vor drei Wochen nachträglich als
    OFFEN anzulegen wäre eine Falschmeldung, nicht ein Fund.

    `bestellt` sind die vom Eigentümer bestellten Leistungen je Eigennutzung
    (0510, `eigennutzung.bestellte_regeln`). Bei einer gewöhnlichen Buchung
    spielt es keine Rolle; bei einer Eigentümersperrung entscheidet es, ob die
    Regel überhaupt greifen darf.
    """
    # Eigennutzung ohne Bestellung dieser Leistung: keine Aufgabe (0510). Eine
    # BEREITS vorhandene wird bewusst NICHT weggeräumt — sie kann von Hand
    # angelegt worden sein, und das Wegräumen gehört dem Pfad, der die
    # Abbestellung kennt, nicht diesem Abgleich.
    if not regel_erlaubt(reservation, str(rule["id"]), bestellt or {}):
        return False

    fenster = _regel_zeitfenster(rule, reservation, anchors, zone)
    if fenster is None:
        return False
    start, end = fenster
    # Zu alter Termin: eine Anreise von vor drei Wochen nachträglich als OFFEN
    # anzulegen wäre eine Falschmeldung.
    if nicht_vor is not None and (end or start) < nicht_vor:
        return False

    property_id = reservation.get("property_id")

    # ZAEHLPUNKTE (0623): Eine Abreise-Aufgabe traegt zusaetzlich die faelligen
    # Inventarzeilen. Das ist der Kern — die Inventur haengt am Turnover, nicht
    # in einem eigenen Bereich, den niemand oeffnet.
    #
    # Nur bei `check_out`/`departure_day`: bei der ANREISE zaehlt niemand, da
    # wird vorbereitet. Und nur bei einer NEUEN Aufgabe, nicht beim Nachziehen
    # einer bestehenden — sonst waechst deren Checkliste bei jedem Lauf.
    if _ist_abreise(rule) and not known:
        items = [
            *items,
            *zaehlpunkte_fuer_abreise(db, tenant_id, str(property_id or "") or None),
        ]

    if known:
        return _vorhandene_nachziehen(
            db,
            tenant_id,
            rule,
            known,
            items,
            start,
            end,
            property_id,
            verschieben=verschieben,
        )

    return bool(
        _insert_task(
            db,
            _task_payload(
                tenant_id,
                rule,
                property_id=str(property_id) if property_id else None,
                reservation_id=str(reservation["id"]),
                occurrence_on=None,
                start=start,
                end=end,
                source=TaskSource.auto,
                # Bis hierher kommt eine Eigennutzung nur MIT Bestellung
                # (`regel_erlaubt` oben) — die Spur ist damit belegt, nicht
                # geraten.
                ordered_by_owner=bool(reservation.get("is_owner_stay")),
            ),
            items,
        )
    )


def nachziehen_planmaessig(
    db: Client,
    tenant_id: str,
    *,
    today: date,
    horizon_days: int = HORIZON_DAYS,
    rueckblick_tage: int = NACHZUG_RUECKBLICK_TAGE,
    rule_id: str | None = None,
    verschieben: bool = False,
) -> int:
    """Planmäßige Regeln gegen ALLE Buchungen im Fenster abgleichen.

    Der fehlende Gegenzustand zur Regel selbst (Wurzel 1). Eine planmäßige
    Aufgabe entstand bisher ausschließlich in dem Moment, in dem eine
    Reservierung geschrieben wurde. Wer eine Regel NACH einer Buchung anlegte —
    oder ihr später ein Objekt zuordnete — bekam für diese Buchung nie eine
    Aufgabe, und es gab keinen Weg dahin außer dem Nachzügler-Knopf, einzeln,
    pro Buchung.

    LIVE PASSIERT (23.08.2026): die Buchung „Feriehus Britt" vom 10.08. mit
    Anreise am 23.08. hatte keine Anreise-Aufgabe, weil die Regel „Velk T"
    erst am 13.08. angelegt wurde. Gemeldet wurde das als „heute ist eine
    Anreise, dazu gibt es keine Aufgabe" — genau die Klasse Fehler, die
    niemand als Fehler erkennt, weil die Liste ja gefüllt aussieht.

    Zweite Wirkung: der Lauf ist das Auffangnetz für jeden Schreibpfad, der
    `sync_for_reservation` nicht ruft. Er ERSETZT den Aufruf nicht — eine
    Aufgabe soll sofort da sein, nicht erst beim nächsten Tick.

    Standardmäßig nur ANLEGEN, nie verschieben — der stündliche Tick soll nicht
    bei jedem Lauf dieselben Werte erneut in jede Aufgabe schreiben.
    `rule_id` grenzt den Lauf auf eine Regel ein (Aufruf direkt nach dem
    Speichern einer Regel).

    `verschieben=True` zieht zusätzlich die schon vorhandenen Aufgaben auf die
    neuen Zeiten nach. Genau das fehlte (03.09.2026): wer die Zeiten einer
    Regel änderte, sah die Änderung nur an KÜNFTIGEN Aufgaben — die bereits
    erzeugten behielten stumm ihr altes Fenster, und der Kalender zeigte
    weiter den alten Stand. Erledigte und stornierte Aufgaben bleiben dabei
    unberührt (`_regel_anwenden`): eine gemachte Reinigung verschiebt sich
    nicht mehr.
    """
    rules = [
        r
        for r in _rules(db, tenant_id, "auto")
        if rule_id is None or str(r["id"]) == rule_id
    ]
    if not rules:
        return 0
    assignments = _rule_properties(db, [str(r["id"]) for r in rules])
    items = _template_items(db, tenant_id, {_checklist_source(r) for r in rules})

    # Fenster: vom Rückblick bis zum Horizont. Der Rückblick ist kein Komfort,
    # sondern der Unterschied zwischen „keine Aufgabe" und „keine Arbeit": eine
    # Abreise von vorgestern ohne Reinigungsaufgabe ist offene Arbeit, die
    # niemand sieht.
    # Dieselbe Grenze wie beim Buchungsfenster, aber auf den AUFGABEN-Termin
    # angewandt: eine Buchung kann im Rückblick liegen und ihre Anreise-Aufgabe
    # trotzdem weit davor (langer Aufenthalt).
    fruehester_termin = _at(today - timedelta(days=rueckblick_tage), None)
    # Einmal je LAUF, nicht je Seite: die Objektliste eines Betriebs ist klein
    # und aendert sich waehrend eines Nachzugs nicht.
    zonen = _objekt_zonen(db, tenant_id)
    von = (today - timedelta(days=rueckblick_tage)).isoformat()
    bis = (today + timedelta(days=horizon_days)).isoformat()

    created = 0
    gesehen = 0
    while gesehen < MAX_NACHZUG_RESERVIERUNGEN:
        reservations = (
            db.table("reservations")
            # `is_owner_stay, block_request_id` (0510) MÜSSEN mit: ohne sie
            # sähe `ist_eigennutzung` ein fehlendes Feld und behandelte eine
            # Eigentümersperrung wieder wie eine Gastbuchung.
            .select(
                "id, property_id, status, check_in, check_out, "
                "checkin_time, checkout_time, created_at, "
                "is_owner_stay, block_request_id"
            )
            .eq("tenant_id", tenant_id)
            .gte("check_out", von)
            .lte("check_in", bis)
            .not_.in_("status", list(_ENDSTATUS | _UNVERBINDLICH))
            # Nach `id` sortiert, nicht nach `check_in`: die Seitengrenze muss
            # eindeutig sein, sonst kann eine Zeile bei gleichem Datum zwischen
            # zwei Seiten verschwinden oder doppelt kommen.
            .order("id")
            .range(gesehen, gesehen + _NACHZUG_SEITE - 1)
            .execute()
        ).data or []
        if not reservations:
            break
        gesehen += len(reservations)
        created += _nachzug_seite(
            db,
            tenant_id,
            rules,
            reservations,
            assignments,
            items,
            fruehester_termin,
            zonen,
            verschieben,
        )
        if len(reservations) < _NACHZUG_SEITE:
            break

    if created:
        log.info(
            "task_rules_nachgezogen",
            tenant_id=tenant_id,
            rules=len(rules),
            reservations=gesehen,
            created=created,
        )
    if gesehen >= MAX_NACHZUG_RESERVIERUNGEN:
        # Keine stille Deckelung: was der Lauf nicht erreicht hat, muss man
        # sehen können (sonst liest sich „fertig" wie „alles abgedeckt").
        log.warning(
            "task_rules_nachzug_gedeckelt",
            tenant_id=tenant_id,
            limit=MAX_NACHZUG_RESERVIERUNGEN,
        )
    return created


def _nachzug_seite(
    db: Client,
    tenant_id: str,
    rules: list[dict[str, object]],
    reservations: list[dict[str, object]],
    assignments: dict[str, set[str]],
    items: dict[str, list[dict[str, object]]],
    fruehester_termin: datetime,
    zonen: dict[str, ZoneInfo | None],
    verschieben: bool,
) -> int:
    """Eine Seite Reservierungen gegen die Regeln abgleichen."""
    known = _vorhandene_aufgaben(
        db, tenant_id, [str(r["id"]) for r in reservations]
    )
    # Einmal je SEITE, nicht je Reservierung: bei 200 Zeilen wären das sonst
    # 200 Roundtrips. Ohne Eigennutzung in der Seite fragt der Aufruf gar nicht
    # erst — er kostet dann nichts.
    bestellt = bestellte_regeln(db, reservations)
    created = 0
    for reservation in reservations:
        reservation_id = str(reservation["id"])
        property_id = str(reservation.get("property_id") or "")
        zone = zonen.get(property_id)
        anchors = _reservation_anchors(reservation, zone)
        if anchors is None:
            continue
        for rule in rules:
            zuordnung = assignments.get(str(rule["id"]))
            if zuordnung and property_id not in zuordnung:
                continue
            if _regel_anwenden(
                db,
                tenant_id,
                rule,
                reservation,
                anchors,
                items.get(_checklist_source(rule), []),
                known.get((reservation_id, str(rule["id"]))),
                verschieben=verschieben,
                nicht_vor=fruehester_termin,
                bestellt=bestellt,
                zone=zone,
            ):
                created += 1
    return created


def _mit_checkliste(db: Client, task_ids: list[str]) -> set[str]:
    """Die Aufgaben unter `task_ids`, die schon mindestens einen Punkt tragen.

    Grundlage für den Nachzug fehlender Checklisten (`_regel_anwenden`): eine
    Aufgabe MIT Punkten ist eine Momentaufnahme und bleibt unangetastet, eine
    OHNE bekommt die Punkte ihrer Quelle. Ohne diese Menge müsste der Nachzug
    je Aufgabe nachfragen — bei 200 Buchungen je Seite 200 Roundtrips.
    """
    out: set[str] = set()
    for start in range(0, len(task_ids), _BLOCK):
        block = task_ids[start : start + _BLOCK]
        rows = (
            db.table("checklist_items")
            .select("task_id")
            .in_("task_id", block)
            .execute()
        ).data or []
        out.update(str(r["task_id"]) for r in rows)
    return out


def _vorhandene_aufgaben(
    db: Client, tenant_id: str, reservation_ids: list[str]
) -> dict[tuple[str, str], dict[str, object]]:
    """Schon erzeugte Regel-Aufgaben als {(reservation_id, rule_id): Zeile}.

    Jede Zeile trägt zusätzlich `hat_checkliste`, damit `_regel_anwenden`
    fehlende Punkte nachziehen kann, ohne je Aufgabe nachzufragen.
    """
    out: dict[tuple[str, str], dict[str, object]] = {}
    for start in range(0, len(reservation_ids), _BLOCK):
        block = reservation_ids[start : start + _BLOCK]
        rows = (
            db.table("tasks")
            .select("id, rule_id, reservation_id, status")
            .eq("tenant_id", tenant_id)
            .in_("reservation_id", block)
            .not_.is_("rule_id", "null")
            .execute()
        ).data or []
        for row in rows:
            out[(str(row["reservation_id"]), str(row["rule_id"]))] = row
    mit = _mit_checkliste(db, [str(r["id"]) for r in out.values()])
    for row in out.values():
        row["hat_checkliste"] = str(row["id"]) in mit
    return out


def sync_for_reservation(
    db: Client, tenant_id: str, reservation: dict[str, object]
) -> int:
    """Aufgaben einer Reservierung mit den planmäßigen Regeln abgleichen.

    Idempotent und verschiebend: gibt es zur Regel schon eine Aufgabe dieser
    Reservierung, wird sie AKTUALISIERT (Wurzel 1) — nie eine zweite angelegt.
    Rückgabe: Zahl der angelegten oder verschobenen Aufgaben.
    """
    reservation_id = str(reservation["id"])
    status = str(reservation.get("status") or "")
    if status in _ENDSTATUS:
        return _on_cancelled(db, tenant_id, reservation_id)
    if status in _UNVERBINDLICH:
        # Weder anlegen noch wegräumen: eine offene Anfrage hatte nie Aufgaben.
        # Angenommen wird sie über `accept_request`, das erneut hierher kommt —
        # dann mit `confirmed`.
        return 0

    # Die Zeitzone DIESES Objekts — VOR den Ankern, weil sie in sie eingeht.
    # Ein gezielter Abruf statt der ganzen Liste: hier geht es um eine Buchung.
    property_id = reservation.get("property_id")
    zone = None
    if property_id:
        zeile = (
            db.table("properties")
            .select("timezone")
            .eq("id", str(property_id))
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if zeile:
            zone = _zone(zeile[0].get("timezone"))

    anchors = _reservation_anchors(reservation, zone)
    if anchors is None:
        log.warning("task_rules_ohne_zeitraum", reservation_id=reservation_id)
        return 0

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
    mit = _mit_checkliste(db, [str(r["id"]) for r in existing.values()])
    for row in existing.values():
        row["hat_checkliste"] = str(row["id"]) in mit

    # 0510: Bei einer Eigentümersperrung entstehen nur die Aufgaben, die der
    # Eigentümer zu seiner Sperre BESTELLT hat. Für jede gewöhnliche Buchung
    # bleibt die Menge leer und ohne Wirkung.
    bestellt = bestellte_regeln(db, [reservation])

    touched = 0
    for rule in matching:
        if _regel_anwenden(
            db,
            tenant_id,
            rule,
            reservation,
            anchors,
            items.get(_checklist_source(rule), []),
            existing.get(str(rule["id"])),
            bestellt=bestellt,
            zone=zone,
        ):
            touched += 1

    log.info(
        "task_rules_synced",
        reservation_id=reservation_id,
        rules=len(matching),
        touched=touched,
    )
    return touched


def sync_nach_id(db: Client, tenant_id: str, reservation_id: str) -> int:
    """Wie `sync_for_reservation`, aber lädt die Reservierung selbst.

    Für Schreibpfade, die keine Service-Instanz haben — allen voran der
    OTA-Import (`channel_manager.bookings_sync`). Der schreibt Reservierungen
    direkt per `db.table("reservations")` und rief die Regel-Engine bis 15.08.
    NICHT auf: live entstanden aus 235 Portalbuchungen ganze 1 Aufgabe, während
    34 Direktbuchungen 55 erzeugten. Für einen Betrieb, dessen Buchungen über
    die Portale kommen, war die Aufgaben-Automatik damit wirkungslos — und mit
    ihr beide Gegenrichtungen (Wurzel 1): eine Umbuchung ließ die Reinigung am
    alten Datum stehen, eine Stornierung ließ sie ganz stehen.

    Best-effort wie im manuellen Pfad (`reservations._base._sync_task_rules`):
    eine Aufgabe, die nicht entstehen konnte, darf den bereits vollzogenen
    Import NICHT zurückdrehen. Der Fehler wird geloggt, `POST
    /tasks/sync-reservation/{id}` holt ihn nach.

    Der Load ist auf den Mandanten gescopt (Wurzel 3) — die Service-Rolle
    umgeht RLS, ein Load allein per ID wäre eine offene Mandantengrenze.
    """
    try:
        rows = (
            db.table("reservations")
            # `is_owner_stay, block_request_id` (0510) MÜSSEN mit: ohne sie
            # sähe `ist_eigennutzung` ein fehlendes Feld und behandelte eine
            # Eigentümersperrung wieder wie eine Gastbuchung.
            .select(
                "id, property_id, status, check_in, check_out, "
                "checkin_time, checkout_time, created_at, "
                "is_owner_stay, block_request_id"
            )
            .eq("id", reservation_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            return 0
        return sync_for_reservation(db, tenant_id, rows[0])
    except Exception as exc:  # noqa: BLE001 — Aufgaben sind der Nebenpfad
        log.warning(
            "task_rules_sync_failed",
            reservation_id=reservation_id,
            error=str(exc)[:200],
        )
        # In den Verlauf: eine ausgefallene Reinigung fällt sonst erst auf,
        # wenn niemand geputzt hat. Best-effort im Best-effort — schlägt auch
        # das Protokollieren fehl, bleibt es bei der Log-Zeile.
        from src.jobs import worker_verlauf  # noqa: PLC0415 — Zirkularität

        worker_verlauf.merken(
            db,
            richtung="intern",
            vorgang="aufgaben_regeln",
            ergebnis="fehler",
            tenant_id=tenant_id,
            quelle_tabelle="reservations",
            quelle_id=reservation_id,
            fehler_text=str(exc)[:2000],
            zusammenfassung="Planmäßige Aufgaben konnten nicht erzeugt werden",
        )
        return 0


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
