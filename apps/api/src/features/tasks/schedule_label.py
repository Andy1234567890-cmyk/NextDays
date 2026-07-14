"""Menschenlesbares Zeitplan-Label aus dem recurrence-jsonb einer Regel.

Die "Regelmäßige Aufgaben"-Tabelle zeigt ein Label wie
"Jeden 1. Montag im Monat" statt Rohdaten (UX-Verbesserung, Prompt-1 §7.7).
Das recurrence-Objekt ist frei strukturiert (Bestand: task_rules.recurrence
jsonb). Unbekannte/leere Strukturen ergeben ``None`` — kein Fantasie-Label
(CLAUDE.md Wurzel 4: keine erfundenen Fallback-Werte).
"""
from typing import Any

_WEEKDAYS = [
    "Montag", "Dienstag", "Mittwoch", "Donnerstag",
    "Freitag", "Samstag", "Sonntag",
]
_POSITIONS = {
    "first": "1.", "second": "2.", "third": "3.",
    "fourth": "4.", "last": "letzten",
}


def _weekly_label(rec: dict[str, Any]) -> str | None:
    mask = rec.get("weekday_mask")
    interval = int(rec.get("interval") or 1)
    days: list[str] = []
    if isinstance(mask, int):
        days = [_WEEKDAYS[i] for i in range(7) if mask & (1 << i)]
    if not days:
        return None
    every = "Jede Woche" if interval == 1 else f"Alle {interval} Wochen"
    return f"{every} · {', '.join(days)}"


def _monthly_label(rec: dict[str, Any]) -> str | None:
    interval = int(rec.get("interval") or 1)
    prefix = "Monatlich" if interval == 1 else f"Alle {interval} Monate"
    dom = rec.get("day_of_month")
    if isinstance(dom, int) and 1 <= dom <= 31:
        return f"{prefix} · am {dom}."
    pos = rec.get("weekday_pattern_position")
    wd = rec.get("weekday_pattern_weekday")
    if pos in _POSITIONS and isinstance(wd, int) and 0 <= wd <= 6:
        return f"{prefix} · jeden {_POSITIONS[pos]} {_WEEKDAYS[wd]}"
    return None


def schedule_label(recurrence: dict[str, Any] | None) -> str | None:
    """Erzeugt das Anzeige-Label oder ``None``, wenn nicht ableitbar."""
    if not recurrence:
        return None
    freq = recurrence.get("frequency")
    interval = int(recurrence.get("interval") or 1)
    if freq == "daily":
        return "Täglich" if interval == 1 else f"Alle {interval} Tage"
    if freq == "weekly":
        return _weekly_label(recurrence)
    if freq == "monthly":
        return _monthly_label(recurrence)
    return None
