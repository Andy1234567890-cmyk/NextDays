"""Abbildung Automatisierung: DB-Zeile ⇄ API-Modell.

Aus `service.py` herausgelöst (Datei-Längenlimit), kein Verhaltenswechsel. Die
beiden Richtungen gehören zusammen und stehen deshalb nebeneinander: wer eine
Spalte ergänzt, sieht hier sofort, dass sie in BEIDE Richtungen gehört.
"""

from .ausloeser import anker_von, versatz_normieren
from .schemas import Automation, AutomationUpsert

# Spalten, die beide Leser (Service und Planung) brauchen. Eine hier fehlende
# Spalte kommt nie an — die Regel liefe dann still mit dem Vorgabewert.
AUTOMATION_COLS = (
    "id, name, trigger, anchor, offset_days, offset_unit, offset_value, "
    "send_time, property_ids, channels, template_id, message, is_active, "
    "use_property_timezone, only_first_message, window_days, window_from, "
    "window_to"
)


def automation_row(r: dict) -> Automation:
    """DB-Zeile → Automation: NULL-Arrays zu [], Zeiten auf HH:MM kürzen."""
    st = r.get("send_time")
    roh_wert = r.get("offset_value")
    trigger = r.get("trigger") or "booking_new"
    return Automation(
        id=str(r["id"]),
        name=r.get("name") or "",
        trigger=trigger,
        # Aus dem Auslöser abgeleitet, nicht aus der Spalte gelesen (0307): so
        # meldet die API auch für eine noch nicht migrierte Zeile keinen Anker,
        # der dem Auslöser widerspricht.
        anchor=anker_von(trigger),
        offset_days=r.get("offset_days") or 0,
        offset_unit=r.get("offset_unit") or "days",
        # Altbestand ohne eigenen Wert rechnet in Tagen weiter (0303).
        offset_value=roh_wert if roh_wert is not None else (r.get("offset_days") or 0),
        send_time=str(st)[:5] if st else None,
        property_ids=[str(p) for p in (r.get("property_ids") or [])],
        channels=list(r.get("channels") or []),
        template_id=str(r["template_id"]) if r.get("template_id") else None,
        message=r.get("message"),
        is_active=bool(r.get("is_active", True)),
        use_property_timezone=bool(r.get("use_property_timezone")),
        only_first_message=bool(r.get("only_first_message")),
        window_days=[int(t) for t in (r.get("window_days") or [])],
        window_from=str(r["window_from"])[:5] if r.get("window_from") else None,
        window_to=str(r["window_to"])[:5] if r.get("window_to") else None,
    )


def automation_payload(req: AutomationUpsert) -> dict:
    """Upsert-Payload: leere Arrays als NULL (= „alle"), send_time HH:MM.

    Anker und Vorzeichen des Versatzes kommen NICHT aus der Anfrage, sondern aus
    dem Auslöser (0307). Ein Client, der „vor Anreise" schickt und dabei
    `anchor='departure'` mitgibt, bekommt so keine Regel, die anders feuert, als
    sie heißt."""
    versatz = versatz_normieren(req.trigger, req.offset_value)
    return {
        "name": req.name,
        "trigger": req.trigger,
        "anchor": anker_von(req.trigger),
        # `offset_days` bleibt die Tages-Sicht: bei Tages-Regeln derselbe Wert,
        # bei Stunden/Minuten 0 — dort ist „in Tagen" keine Aussage.
        "offset_days": versatz if req.offset_unit == "days" else 0,
        "offset_unit": req.offset_unit,
        "offset_value": versatz,
        # None = keine feste Uhrzeit (bei Tagen Mitternacht des Ankertags).
        "send_time": req.send_time if req.send_time else None,
        "property_ids": req.property_ids or None,
        "channels": req.channels or None,
        "template_id": req.template_id,
        "message": req.message,
        "is_active": req.is_active,
        "use_property_timezone": req.use_property_timezone,
        "only_first_message": req.only_first_message,
        # Leeres Array als NULL = „alle Tage" (analog property_ids/channels).
        "window_days": req.window_days or None,
        "window_from": req.window_from or None,
        "window_to": req.window_to or None,
    }
