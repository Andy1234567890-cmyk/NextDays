"""Tests für den reinen Channex-Content-Builder (keine DB, kein HTTP).

Deckt Foto-Reihenfolge/-Positionen, Cover-Vorrang, mehrsprachige Captions,
important_information (nur Property), Sprach-Auswahl nach Land und das
Weglassen leerer Felder ab (keine erfundenen Werte)."""
from src.features.channel_manager import content_builder as cb

# --- locale_order_for_country ------------------------------------------------

def test_locale_order_de_country() -> None:
    assert cb.locale_order_for_country("DE") == ["de", "en"]


def test_locale_order_unknown_country_is_english_only() -> None:
    assert cb.locale_order_for_country("ZZ") == ["en"]
    assert cb.locale_order_for_country(None) == ["en"]


def test_locale_order_english_country_no_duplicate() -> None:
    # GB → primär en; "en" darf nicht doppelt erscheinen.
    assert cb.locale_order_for_country("GB") == ["en"]


# --- Fotos -------------------------------------------------------------------

def test_photos_cover_first_then_sort_order() -> None:
    photos = [
        {"url": "b.jpg", "sort_order": 2, "is_cover": False, "caption": {}},
        {"url": "cover.jpg", "sort_order": 9, "is_cover": True, "caption": {}},
        {"url": "a.jpg", "sort_order": 1, "is_cover": False, "caption": {}},
    ]
    content = cb.build_property_content(
        {"country": "DE"}, photos, locale_order=["de", "en"]
    )
    urls = [p["url"] for p in content["photos"]]
    positions = [p["position"] for p in content["photos"]]
    assert urls == ["cover.jpg", "a.jpg", "b.jpg"]  # Cover zuerst, dann sort_order
    assert positions == [0, 1, 2]


def test_photo_caption_uses_locale_order() -> None:
    photos = [
        {"url": "a.jpg", "sort_order": 0, "is_cover": True,
         "caption": {"de": "Meerblick", "en": "Sea view"}},
    ]
    content = cb.build_property_content(
        {"country": "DE"}, photos, locale_order=["de", "en"]
    )
    assert content["photos"][0]["description"] == "Meerblick"


def test_photo_without_caption_omits_description() -> None:
    photos = [{"url": "a.jpg", "sort_order": 0, "is_cover": True, "caption": {}}]
    content = cb.build_property_content({}, photos, locale_order=["de", "en"])
    assert "description" not in content["photos"][0]
    assert content["photos"][0]["kind"] == "photo"


def test_photo_without_url_is_skipped() -> None:
    photos = [
        {"url": "", "sort_order": 0, "is_cover": True, "caption": {}},
        {"url": "ok.jpg", "sort_order": 1, "is_cover": False, "caption": {}},
    ]
    content = cb.build_property_content({}, photos, locale_order=["de"])
    assert [p["url"] for p in content["photos"]] == ["ok.jpg"]


def test_no_photos_omits_photos_key() -> None:
    content = cb.build_property_content(
        {"description": "Text"}, [], locale_order=["de"]
    )
    assert "photos" not in content


# --- Beschreibung ------------------------------------------------------------

def test_description_is_canonical_text() -> None:
    content = cb.build_property_content(
        {"description": "Schönes Haus"}, [], locale_order=["de"]
    )
    assert content["description"] == "Schönes Haus"


def test_empty_description_is_omitted() -> None:
    content = cb.build_property_content(
        {"description": "  "}, [], locale_order=["de"]
    )
    assert "description" not in content


# --- important_information (nur Property) -------------------------------------

def test_important_information_from_checkin_and_rules() -> None:
    prop = {
        "description": "X",
        "type_attributes": {
            "policies": {
                "checkInTime": "16:00",
                "checkOutTime": "10:00",
                "rentalAgreement": {"de": "Keine Partys.", "en": "No parties."},
            }
        },
    }
    content = cb.build_property_content(prop, [], locale_order=["de", "en"])
    info = content["important_information"]
    assert "Check-in ab 16:00, Check-out bis 10:00." in info
    assert "Keine Partys." in info


def test_no_policies_omits_important_information() -> None:
    content = cb.build_property_content(
        {"description": "X", "type_attributes": {}}, [], locale_order=["de"]
    )
    assert "important_information" not in content


# --- Room-Type: KEIN important_information ------------------------------------

def test_room_type_has_no_important_information() -> None:
    prop = {
        "description": "Zimmer-Text",
        "country": "DE",
        "type_attributes": {"policies": {"checkInTime": "15:00", "checkOutTime": "11:00"}},
    }
    photos = [{"url": "a.jpg", "sort_order": 0, "is_cover": True, "caption": {}}]
    content = cb.build_room_type_content(prop, photos, locale_order=["de", "en"])
    assert content["description"] == "Zimmer-Text"
    assert content["photos"][0]["url"] == "a.jpg"
    assert "important_information" not in content  # Channex room_type kennt es nicht


def test_empty_room_type_content_is_empty_dict() -> None:
    # Ohne Beschreibung/Fotos entsteht kein leeres content-Gerüst.
    content = cb.build_room_type_content({}, [], locale_order=["de"])
    assert content == {}
