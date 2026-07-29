"""Tag-genaues Superseding im ari_outbox-Cron: von einer neueren Absicht
abgedeckte Tage werden übersprungen, die restlichen Tage weiter gepusht."""
from src.features.channel_manager.ari_push import (
    AriPushMixin,
    _group_iso_days_to_ranges,
    _iso_days,
    _merge_equal_value_days,
)


def _row(rid, pid, df, dt):  # noqa: ANN001, ANN202
    return {"id": rid, "property_id": pid, "date_from": df, "date_to": dt}


def test_full_overlap_supersedes_all_days() -> None:
    rows = [
        _row("old", "p1", "2026-08-10", "2026-08-12"),
        _row("new", "p1", "2026-08-10", "2026-08-12"),
    ]
    by = AriPushMixin._superseding_days_by_row(rows)
    # old komplett überholt, new hat nichts über sich.
    assert by["old"] == {"2026-08-10", "2026-08-11", "2026-08-12"}
    assert by["new"] == set()


def test_partial_overlap_keeps_non_overlapping_days() -> None:
    # KRITISCH: old deckt 10.-14., new nur 12.-13. → old darf 10.,11.,14. behalten.
    rows = [
        _row("old", "p1", "2026-08-10", "2026-08-14"),
        _row("new", "p1", "2026-08-12", "2026-08-13"),
    ]
    by = AriPushMixin._superseding_days_by_row(rows)
    assert by["old"] == {"2026-08-12", "2026-08-13"}
    days = set(_iso_days("2026-08-10", "2026-08-14"))
    remaining = days - by["old"]
    ranges = _group_iso_days_to_ranges(remaining)
    # 10.-11. und 14. bleiben (zwei getrennte Ranges).
    assert ranges == [("2026-08-10", "2026-08-11"), ("2026-08-14", "2026-08-14")]


def test_disjoint_and_other_property_not_superseded() -> None:
    rows = [
        _row("a", "p1", "2026-08-01", "2026-08-03"),
        _row("b", "p1", "2026-08-10", "2026-08-12"),
        _row("c", "p2", "2026-08-01", "2026-08-03"),
    ]
    by = AriPushMixin._superseding_days_by_row(rows)
    assert by["a"] == set() and by["b"] == set() and by["c"] == set()


def test_group_ranges_bundles_consecutive_days() -> None:
    assert _group_iso_days_to_ranges(set()) == []
    assert _group_iso_days_to_ranges({"2026-08-05"}) == [("2026-08-05", "2026-08-05")]
    assert _group_iso_days_to_ranges(
        {"2026-08-01", "2026-08-02", "2026-08-04"}
    ) == [("2026-08-01", "2026-08-02"), ("2026-08-04", "2026-08-04")]


# --- Reconcile-Drift: date_range statt Einzeltag-Objekte --------------------
# Channex-Zertifizierung 17.07.2026, dreimal: „Use date_range syntax with merged
# sequences instead of single-date objects."


def test_merge_equal_value_days_bundles_consecutive_same_value() -> None:
    drift = {"2026-11-10": 12000, "2026-11-11": 12000, "2026-11-12": 12000}
    assert _merge_equal_value_days(drift, "rate_cents", "rp-1") == [
        {
            "date_from": "2026-11-10",
            "date_to": "2026-11-12",
            "rate_cents": 12000,
            "rate_plan_id": "rp-1",
        }
    ]


def test_merge_equal_value_days_never_merges_different_values() -> None:
    """KRITISCH: unterschiedliche Preise dürfen NIE in eine Range fallen —
    sonst überschriebe der Push einen Tag mit dem falschen Betrag."""
    drift = {"2026-11-10": 12000, "2026-11-11": 9900, "2026-11-12": 12000}
    segmente = _merge_equal_value_days(drift, "rate_cents", "rp-1")
    assert len(segmente) == 3
    assert all(s["date_from"] == s["date_to"] for s in segmente)
    nach_tag = {s["date_from"]: s["rate_cents"] for s in segmente}
    assert nach_tag == drift


def test_merge_equal_value_days_splits_at_gaps() -> None:
    # Gleicher Wert, aber Lücke am 12.: zwei Ranges, der 12. bleibt unberührt.
    drift = {"2026-11-10": 5, "2026-11-11": 5, "2026-11-13": 5}
    segmente = _merge_equal_value_days(drift, "min_stay", "rp-1")
    assert [(s["date_from"], s["date_to"]) for s in segmente] == [
        ("2026-11-10", "2026-11-11"),
        ("2026-11-13", "2026-11-13"),
    ]
    assert all(s["min_stay"] == 5 for s in segmente)


def test_merge_equal_value_days_empty() -> None:
    assert _merge_equal_value_days({}, "rate_cents", "rp-1") == []
