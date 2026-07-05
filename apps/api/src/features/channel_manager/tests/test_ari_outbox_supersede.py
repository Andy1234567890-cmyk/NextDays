"""Superseding im ari_outbox-Cron: eine ältere pending-Zeile für dieselben
(überlappenden) Tage wird von einer neueren überholt und nicht mehr gepusht."""
from src.features.channel_manager.ari_push import AriPushMixin


def test_older_overlapping_row_is_superseded() -> None:
    rows = [
        # ältester avail=1 (Storno-Freigabe, Push scheiterte) für 10.-12.
        {"id": "old", "property_id": "p1", "date_from": "2026-08-10",
         "date_to": "2026-08-12", "availability": 1},
        # neuere avail=0 (neue Buchung) für 10.-12. → überholt 'old'
        {"id": "new", "property_id": "p1", "date_from": "2026-08-10",
         "date_to": "2026-08-12", "availability": 0},
    ]
    superseded = AriPushMixin._superseded_outbox_ids(rows)
    assert superseded == {"old"}


def test_disjoint_ranges_not_superseded() -> None:
    rows = [
        {"id": "a", "property_id": "p1", "date_from": "2026-08-01",
         "date_to": "2026-08-03", "availability": 0},
        {"id": "b", "property_id": "p1", "date_from": "2026-08-10",
         "date_to": "2026-08-12", "availability": 0},
    ]
    assert AriPushMixin._superseded_outbox_ids(rows) == set()


def test_different_property_not_superseded() -> None:
    rows = [
        {"id": "a", "property_id": "p1", "date_from": "2026-08-10",
         "date_to": "2026-08-12", "availability": 1},
        {"id": "b", "property_id": "p2", "date_from": "2026-08-10",
         "date_to": "2026-08-12", "availability": 0},
    ]
    assert AriPushMixin._superseded_outbox_ids(rows) == set()
