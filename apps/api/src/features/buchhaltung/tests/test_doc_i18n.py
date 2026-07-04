"""Tests für doc_i18n (Dokumentsprache der Belege aus Buchungen)."""
from src.features.buchhaltung import doc_i18n


def test_resolve_language_normalizes_region_codes() -> None:
    assert doc_i18n.resolve_language("de-AT") == "de"
    assert doc_i18n.resolve_language("pt_BR") == "pt"
    assert doc_i18n.resolve_language("IT") == "it"


def test_resolve_language_unknown_or_missing_falls_back_to_de() -> None:
    assert doc_i18n.resolve_language(None) == "de"
    assert doc_i18n.resolve_language("") == "de"
    assert doc_i18n.resolve_language("xx") == "de"


def test_all_supported_languages_have_all_terms() -> None:
    for lang in doc_i18n.SUPPORTED:
        assert doc_i18n.flat_rate_unit(lang)
        assert doc_i18n.extra_service_label(lang)
        assert doc_i18n.item_fallback_label(lang)
        assert doc_i18n.nights_label(lang, 1)
        assert doc_i18n.nights_label(lang, 3)
        assert doc_i18n.fmt_date(lang, "2026-07-01") != "2026-07-01" or lang in (
            "lt",
            "sv",
        )


def test_nights_label_plural_rules() -> None:
    # Polnisch: 1 noc, 2–4 noce, 5+ nocy, 22 noce (Einer 2–4), 12 nocy.
    assert doc_i18n.nights_label("pl", 1) == "1 noc"
    assert doc_i18n.nights_label("pl", 3) == "3 noce"
    assert doc_i18n.nights_label("pl", 5) == "5 nocy"
    assert doc_i18n.nights_label("pl", 12) == "12 nocy"
    assert doc_i18n.nights_label("pl", 22) == "22 noce"
    # Tschechisch/Slowakisch: 2–4 noci, sonst nocí.
    assert doc_i18n.nights_label("cs", 2) == "2 noci"
    assert doc_i18n.nights_label("cs", 7) == "7 nocí"
    # Litauisch: 1/21 naktis, 2–9 naktys, 10–19 naktų.
    assert doc_i18n.nights_label("lt", 21) == "21 naktis"
    assert doc_i18n.nights_label("lt", 5) == "5 naktys"
    assert doc_i18n.nights_label("lt", 11) == "11 naktų"
    # Rumänisch: „de" nur bei Endziffern 00 oder 20–99 (nicht 101–119).
    assert doc_i18n.nights_label("ro", 3) == "3 nopți"
    assert doc_i18n.nights_label("ro", 21) == "21 de nopți"
    assert doc_i18n.nights_label("ro", 100) == "100 de nopți"
    assert doc_i18n.nights_label("ro", 101) == "101 nopți"
    assert doc_i18n.nights_label("ro", 120) == "120 de nopți"
    # Deutsch/Englisch Standard.
    assert doc_i18n.nights_label("de", 1) == "1 Nacht"
    assert doc_i18n.nights_label("en", 2) == "2 nights"


def test_date_format_per_language() -> None:
    assert doc_i18n.fmt_date("de", "2026-07-03") == "03.07.2026"
    assert doc_i18n.fmt_date("it", "2026-07-03") == "03/07/2026"
    assert doc_i18n.fmt_date("hu", "2026-07-03") == "2026. 07. 03."
    assert doc_i18n.fmt_date("sv", "2026-07-03") == "2026-07-03"
    assert doc_i18n.fmt_date("de", "kein-datum") == "kein-datum"


def test_stay_label_and_head_text() -> None:
    label = doc_i18n.stay_label("fr", "Villa Rose", "2026-07-01", "2026-07-04", 3)
    assert label == "Séjour Villa Rose 01/07/2026 – 04/07/2026 (3 nuits)"
    head = doc_i18n.head_text("fr", "2026-07-01", "2026-07-04", 3, "Villa Rose")
    assert head == "Séjour 01/07/2026 – 04/07/2026 (3 nuits), Villa Rose"
    # Ohne Objekttitel kein hängendes Komma.
    assert doc_i18n.head_text("en", "2026-07-01", "2026-07-04", 3, "") == (
        "Stay 01/07/2026 – 04/07/2026 (3 nights)"
    )
