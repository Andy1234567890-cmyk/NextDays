"""Der Webhook-Monitor muss zeigen, was die Portale schicken.

DER LIVE-BEFUND (12.08.2026): `channex_webhook_event` hielt 538 Eingänge über 8
Typen — darunter **18 mit `severity='error'`, alle unbearbeitet**: 10×
`booking_unmapped_rate`, 4× `disconnect_listing`, 4× `deactivate_channel`. Ein
getrenntes Airbnb-Inserat verkauft nichts mehr, und niemand sah es, weil es für
diese Tabelle keine Oberfläche gab.

Die Payloads hier sind WÖRTLICH die live gespeicherten. Sie zeigen zwei Formen
derselben Sache — mit `event`-Hülle und ohne —, weshalb beide Ebenen gelesen
werden müssen.
"""

from typing import Any

from src.features.platform_admin import webhook_verlauf

# Wörtlich aus der Live-DB (12.08.2026 05:54:12).
DEACTIVATE: dict[str, Any] = {
    "event": "deactivate_channel",
    "payload": {
        "title": "Booking.com",
        "ota_name": "BookingCom",
        "channel_id": "6194a921-b1c8-41b3-8971-f8bf0a645efc",
    },
    "user_id": None,
    "timestamp": "2026-08-12T05:54:12.691042Z",
    "property_id": "6a17222f-9a75-4e1f-8f8d-9fa07efa9275",
}

# Dieselbe Sache, ANDERE Form: ohne `event`-Hülle, Felder direkt oben.
UNMAPPED_FLACH: dict[str, Any] = {
    "booking_id": "94fb69a9-1ee6-42c2-a3ef-c47b68bdb530",
    "booking_revision_id": "8e5d3898-877e-4bf5-a969-88b8217e1afc",
}

UNMAPPED_VERSCHACHTELT: dict[str, Any] = {
    "event": "booking_unmapped_rate",
    "payload": {
        "booking_id": "94fb69a9-1ee6-42c2-a3ef-c47b68bdb530",
        "property_id": "d873917f-441e-4218-999f-0cba11f7baa6",
        "live_feed_event_id": "ff81df6e-286d-40b1-986f-9890da30d96b",
        "booking_revision_id": "8e5d3898-877e-4bf5-a969-88b8217e1afc",
    },
    "user_id": None,
    "timestamp": "2026-08-11T09:03:08.630152Z",
    "property_id": "d873917f-441e-4218-999f-0cba11f7baa6",
}


def _zeile(row: dict[str, Any]) -> Any:
    return webhook_verlauf._zeile(row, {}, {})  # noqa: SLF001


# --------------------------------------------------------------------------
# Wurzel 5b: unsere Uhr ist nicht der Zeitpunkt des Portals
# --------------------------------------------------------------------------


def test_portal_zeitpunkt_kommt_aus_der_payload() -> None:
    """Der `timestamp` des Portals wird übernommen — nicht `created_at`.

    Live liegen die beiden auseinander, und bei einem Rutsch-Import tragen alle
    Zeilen dieselbe Eingangssekunde. `created_at` als Portal-Zeitpunkt
    auszugeben wäre eine Falschaussage, die plausibel aussieht (Wurzel 5b).
    """
    zeile = _zeile({
        "id": "x", "event": "deactivate_channel", "severity": "error",
        "resolved": False, "payload": DEACTIVATE,
        "created_at": "2026-08-12T06:10:00Z",
    })
    assert zeile.portal_at == "2026-08-12T05:54:12.691042Z"
    assert zeile.eingang_at == "2026-08-12T06:10:00Z"


def test_ohne_portal_zeitpunkt_kein_rueckfall_auf_unsere_uhr() -> None:
    """Trägt die Payload keinen `timestamp`, bleibt das Feld leer.

    Die flache Form (live vorhanden) hat keinen — dort darf NICHT `created_at`
    einspringen, sonst behauptet die Ansicht einen Portal-Zeitpunkt, den es
    nicht gibt.
    """
    zeile = _zeile({
        "id": "x", "event": "booking_unmapped_rate", "severity": "error",
        "resolved": False, "payload": UNMAPPED_FLACH,
        "created_at": "2026-08-11T09:08:25Z",
    })
    assert zeile.portal_at is None
    assert zeile.eingang_at == "2026-08-11T09:08:25Z"


# --------------------------------------------------------------------------
# Was das Ereignis besagt — beide Payload-Formen
# --------------------------------------------------------------------------


def test_verschachtelte_payload_wird_gelesen() -> None:
    """Bei der `event`-Hülle stecken die Felder eine Ebene tiefer."""
    zeile = _zeile({
        "id": "x", "event": "deactivate_channel", "severity": "error",
        "resolved": False, "payload": DEACTIVATE, "created_at": "2026-08-12T06:00:00Z",
    })
    assert zeile.zusammenfassung is not None
    assert "BookingCom" in zeile.zusammenfassung


def test_flache_payload_wird_auch_gelesen() -> None:
    """Dieselbe Sache ohne Hülle — beide Formen kommen live vor.

    Nur eine Ebene zu lesen liesse die Hälfte der Fehler-Ereignisse ohne Text
    dastehen, und niemand wüsste, welche Buchung gemeint ist.
    """
    zeile = _zeile({
        "id": "x", "event": "booking_unmapped_rate", "severity": "error",
        "resolved": False, "payload": UNMAPPED_FLACH,
        "created_at": "2026-08-11T09:08:25Z",
    })
    assert zeile.zusammenfassung is not None
    assert "94fb69a9-1ee6-42c2-a3ef-c47b68bdb530" in zeile.zusammenfassung


def test_leere_payload_erfindet_keinen_text() -> None:
    """Ohne Payload bleibt die Spalte leer statt eine Deutung zu behaupten."""
    zeile = _zeile({
        "id": "x", "event": "review", "severity": "info", "resolved": False,
        "payload": None, "created_at": "2026-08-12T06:00:00Z",
    })
    assert zeile.zusammenfassung is None


# --------------------------------------------------------------------------
# Handlungsbedarf: der Grund, aus dem die Seite existiert
# --------------------------------------------------------------------------


def test_getrenntes_inserat_verlangt_einen_eingriff() -> None:
    """`disconnect_listing` heisst: das Inserat verkauft nicht mehr."""
    zeile = _zeile({
        "id": "x", "event": "disconnect_listing", "severity": "error",
        "resolved": False, "payload": {}, "created_at": "2026-08-07T20:35:36Z",
    })
    assert zeile.handlungsbedarf is True


def test_erledigtes_ereignis_verlangt_keinen_eingriff_mehr() -> None:
    """Dasselbe Ereignis mit `resolved=true` ist abgearbeitet.

    Sonst stünde die Kachel dauerhaft rot und wäre nach der ersten Woche
    Dekoration — wenn alles warnt, warnt nichts.
    """
    zeile = _zeile({
        "id": "x", "event": "disconnect_listing", "severity": "error",
        "resolved": True, "payload": {}, "created_at": "2026-08-07T20:35:36Z",
        "resolved_at": "2026-08-08T09:00:00Z",
    })
    assert zeile.handlungsbedarf is False
    assert zeile.resolved_at == "2026-08-08T09:00:00Z"


def test_bewertung_ist_kein_handlungsbedarf() -> None:
    """254 Bewertungen in 7 Tagen — sie dürfen die Ansicht nicht rot machen.

    Nur was den VERKAUF blockiert, zählt als Eingriff; alles andere ist
    Kenntnisnahme.
    """
    zeile = _zeile({
        "id": "x", "event": "review", "severity": "info", "resolved": False,
        "payload": {}, "created_at": "2026-08-12T14:48:53Z",
    })
    assert zeile.handlungsbedarf is False
