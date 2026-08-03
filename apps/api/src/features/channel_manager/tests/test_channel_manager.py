
from fastapi.testclient import TestClient

from src.features.channel_manager.channex_client import ChannexError
from src.features.channel_manager.service import (
    ChannelManagerService,
)
from src.features.channel_manager.tax_sync import TaxSyncMixin
from src.main import create_app

client = TestClient(create_app())

# Regel-/Raten-Parameter-Formen genau wie im echten Kanal-Katalog (live gegen
# channels/list gemessen): `rules` ist eine Liste von Bedingungen, `rate_params`
# beschreibt die Felder EINER Zuordnungszeile.


def test_channel_manager_health() -> None:
    resp = client.get("/api/v1/channel-manager/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["slice"] == "channel_manager"
    assert body["status"] == "ok"
    # Feld existiert und ist bool (Wert hängt von der Umgebung/Key-Konfig ab).
    # Neutraler Name (kein Provider-Leck im Response).
    assert isinstance(body["channel_manager_ready"], bool)


def test_webhook_rejects_wrong_secret() -> None:
    # Ohne korrektes Secret → 401 (Webhook ist nicht JWT-gesichert).
    resp = client.post(
        "/api/v1/channel-manager/webhook",
        json={"event": "booking_new"},
        headers={"X-Channex-Webhook-Secret": "falsch"},
    )
    assert resp.status_code == 401


def test_protected_endpoints_require_auth() -> None:
    # Property-Liste ohne JWT → 401.
    resp = client.get("/api/v1/channel-manager/properties")
    assert resp.status_code == 401


# --- Mandantentrennung: kontoweiter Buchungs-Feed darf NICHT durchsickern ----










def test_ota_name_to_channel() -> None:
    """OTA-Namen → Kanal. NIEMALS 'portal'.

    'portal' trägt laut Preisliste §2 die 8 % all-in und macht uns zum Merchant
    of Record. Eine über den Channel-Manager eingegangene Buchung ist per
    Definition fremd — sie dort einzuordnen würde die geschuldete 1 % nie
    fakturieren UND uns die Chargeback-Haftung ohne Erlös aufladen.
    """
    f = ChannelManagerService._ota_name_to_channel
    assert f("Booking.com") == "booking"
    assert f("Airbnb") == "airbnb"
    assert f("VRBO") == "vrbo"
    # Namensvarianten dürfen nicht durchrutschen.
    assert f("booking") == "booking"
    # Unbekannte/weitere OTAs → externer Sammelkanal, nicht 'portal'.
    assert f("Expedia") == "ota_other"
    assert f("Agoda") == "ota_other"
    assert f("Booking.com B.V.") == "ota_other"
    assert f(None) == "ota_other"
    # Der Kernschutz, explizit:
    for name in (None, "", "Expedia", "Agoda", "irgendwas"):
        assert f(name) != "portal"


def test_channex_property_type_mapping() -> None:
    from src.features.channel_manager.service import _channex_property_type

    # Lokaler deutscher Enum → gültiger Channex-Code.
    assert _channex_property_type("appartement") == "apartment"
    assert _channex_property_type("ferienhaus") == "holiday_home"
    assert _channex_property_type("glamping") == "tent"
    assert _channex_property_type("tiny_house") == "chalet"
    assert _channex_property_type("stellplatz") == "camping"
    assert _channex_property_type("hausboot") == "boat"
    # Unbekannt/leer → None (Feld wird weggelassen, kein ungültiger Wert).
    assert _channex_property_type(None) is None
    assert _channex_property_type("unbekannt") is None


def test_property_attrs_maps_property_type_for_channex() -> None:
    # Regression: der lokale property_type 'appartement' darf NICHT roh an
    # Channex gehen (422), sondern als 'apartment'.
    attrs = ChannelManagerService._property_attrs(
        {"property_type": "appartement", "country": "DE", "city": "Berlin"}
    )
    assert attrs["property_type"] == "apartment"

    # Unbekannter Typ → property_type fehlt im Payload (statt ungültig).
    attrs2 = ChannelManagerService._property_attrs(
        {"property_type": "raumschiff", "country": "DE"}
    )
    assert "property_type" not in attrs2


def test_channex_facility_ids_maps_and_drops_unknown() -> None:
    from src.features.channel_manager.service import _channex_facility_ids

    wifi = "ed553333-7f1f-434a-8c43-eb8fe96c5f54"
    ac = "cc402cc0-696b-4bd6-a5d7-4adb060bc056"
    # Bekannte Slugs → UUIDs (Reihenfolge stabil).
    assert _channex_facility_ids(["wifi", "air_conditioning"]) == [wifi, ac]
    # Unbekannt → weggelassen (kein ungültiger Wert an Channex).
    assert _channex_facility_ids(["wifi", "raumschiff"]) == [wifi]
    # Leer/None → leere Liste (leert Facilities synchron).
    assert _channex_facility_ids([]) == []
    assert _channex_facility_ids(None) == []
    # Duplikate entfernt.
    assert _channex_facility_ids(["wifi", "wifi"]) == [wifi]


def test_property_attrs_includes_facilities() -> None:
    wifi = "ed553333-7f1f-434a-8c43-eb8fe96c5f54"
    attrs = ChannelManagerService._property_attrs(
        {"country": "DE", "amenities": ["wifi"]}
    )
    assert attrs["facilities"] == [wifi]
    # amenities-Key gesetzt, aber leer → facilities=[] (leert bei Channex/OTA).
    attrs_empty = ChannelManagerService._property_attrs(
        {"country": "DE", "amenities": []}
    )
    assert attrs_empty["facilities"] == []
    # amenities gar nicht geladen → facilities-Feld fehlt (kein versehentliches Leeren).
    attrs_none = ChannelManagerService._property_attrs({"country": "DE"})
    assert "facilities" not in attrs_none


def test_room_facility_ids_uses_own_catalogue() -> None:
    """Zimmer-Facilities haben EIGENE UUIDs — der Objekt-Katalog gilt hier nicht.

    Live gegen /room_facilities verifiziert: 30 Titel kommen in beiden Katalogen
    vor, alle 30 mit unterschiedlicher UUID. Eine Objekt-UUID an einem Room-Type
    wäre ungültig, deshalb sind es zwei getrennte Maps."""
    from src.features.channel_manager.common import (
        _CHANNEX_FACILITY,
        _CHANNEX_ROOM_FACILITY,
        _channex_room_facility_ids,
    )

    klima = "9f5726e2-f979-4b6b-a69e-cbca387bc7ea"  # Airconditioning (Zimmer)
    balkon = "363c2057-2cdf-4cbc-af98-069c2d573952"  # Balcony (Zimmer)
    assert _channex_room_facility_ids(["airconditioning"]) == [klima]
    assert _channex_room_facility_ids(["airconditioning", "balcony"]) == [klima, balkon]
    # Unbekannt → weglassen statt 422 zu riskieren.
    assert _channex_room_facility_ids(["gibt_es_nicht"]) == []
    assert _channex_room_facility_ids([]) == []
    assert _channex_room_facility_ids(None) == []
    # Duplikate entfernt, Reihenfolge stabil.
    assert _channex_room_facility_ids(["balcony", "balcony"]) == [balkon]
    # Kein gemeinsamer Slug darf dieselbe UUID tragen wie im Objekt-Katalog.
    gemeinsam = set(_CHANNEX_FACILITY) & set(_CHANNEX_ROOM_FACILITY)
    assert gemeinsam, "Erwartet: einige Slugs gibt es in beiden Katalogen"
    assert all(_CHANNEX_FACILITY[s] != _CHANNEX_ROOM_FACILITY[s] for s in gemeinsam)


def test_availability_settings_maps_valid_channex_keys() -> None:
    from src.features.channel_manager.service import _availability_settings

    out = _availability_settings(
        {
            "cutOffTime": "18:00",
            "cutOffDays": 2,
            "maxDayAdvance": 400,
            "minStayType": "arrival",
            # Autoupdate-Toggles werden BEWUSST ignoriert (PMS = Availability-
            # Master): modification/cancellation sind hart auf false gepinnt,
            # sonst entstünde ein Doppel-Dekrement gegen unseren absoluten Push.
            "autoUpdateOnModification": True,
            "autoUpdateOnCancellation": True,
        }
    )
    assert out == {
        "cut_off_time": "18:00",
        "cut_off_days": 2,
        "max_day_advance": 400,
        "min_stay_type": "arrival",
        "allow_availability_autoupdate_on_modification": False,
        "allow_availability_autoupdate_on_cancellation": False,
    }


def test_availability_settings_drops_invalid_and_empty() -> None:
    from src.features.channel_manager.service import _availability_settings

    # Leerer Block → nur die fest gepinnten Autoupdate-Flags (PMS = Master).
    assert _availability_settings({}) == {
        "allow_availability_autoupdate_on_modification": False,
        "allow_availability_autoupdate_on_cancellation": False,
    }
    # Ungültige Cut-Off-Zeit / negative Zahlen / unbekannter Typ → weglassen.
    out = _availability_settings(
        {
            "cutOffTime": "25:99",
            "cutOffDays": -1,
            "maxDayAdvance": 0,
            "minStayType": "raumschiff",
        }
    )
    assert out == {
        "allow_availability_autoupdate_on_modification": False,
        "allow_availability_autoupdate_on_cancellation": False,
    }
    # cutOffTime="" (Nutzer schaltet aus) ist kein gültiges HH:MM → nicht senden.
    assert "cut_off_time" not in _availability_settings({"cutOffTime": ""})
    # bool ist kein gültiger int für cut_off_days (Python: True == 1) — abweisen.
    # (Die fest gepinnten Autoupdate-Flags bleiben immer im Ergebnis.)
    assert _availability_settings({"cutOffDays": True}) == {
        "allow_availability_autoupdate_on_modification": False,
        "allow_availability_autoupdate_on_cancellation": False,
    }


def test_property_attrs_includes_availability_settings() -> None:
    attrs = ChannelManagerService._property_attrs(
        {
            "country": "DE",
            "type_attributes": {"availability": {"cutOffTime": "20:00"}},
        }
    )
    assert attrs["settings"]["cut_off_time"] == "20:00"
    # state_length = 500 (Channex-Zertifizierung Test 1: 500-Tage-Full-Sync).
    assert attrs["settings"]["state_length"] == 500




def test_lodgify_booking_to_attrs_maps_core_fields() -> None:
    # Belegte Roh-Feldnamen (köpferl): id/arrival/departure/total_amount/guest.name.
    attrs = ChannelManagerService._lodgify_booking_to_attrs({
        "id": 5512,
        "arrival": "2026-08-01",
        "departure": "2026-08-04",
        "total_amount": 420.0,
        "currency_code": "CHF",
        "source": "Booking.com",
        "status": "Booked",
        "property_id": 991,
        "guest": {"name": "Anna Meier", "email": "a@m.ch"},
        "rooms": [{"people": 3}],
    })
    assert attrs is not None
    assert attrs["booking_id"] == "lodgify:5512"
    assert attrs["currency"] == "CHF"  # kein EUR-Fallback (Wurzel 4)
    assert attrs["customer"]["name"] == "Anna" and attrs["customer"]["surname"] == "Meier"
    assert attrs["_lodgify_status"] == "booked"


def test_lodgify_booking_to_attrs_skips_incomplete() -> None:
    # Fehlt arrival → None (kein erfundener Zeitraum).
    assert ChannelManagerService._lodgify_booking_to_attrs(
        {"id": 1, "departure": "2026-08-04"}
    ) is None




















def test_exclude_superseded_days_splits_ranges() -> None:
    # Range-values werden um superseded Tage ZERSCHNITTEN — ein reiner
    # `date`-Filter ließe den Tag im Range und überschriebe den neueren Wert.
    from src.features.channel_manager.ari_push import _exclude_superseded_days

    values = [{"property_id": "cx", "rate_plan_id": "rp", "rate": 100,
               "date_from": "2099-06-20", "date_to": "2099-06-26"}]
    out = _exclude_superseded_days(values, {"2099-06-23"})
    assert [(v.get("date"), v.get("date_from"), v.get("date_to")) for v in out] == [
        (None, "2099-06-20", "2099-06-22"),
        (None, "2099-06-24", "2099-06-26"),
    ]
    # Einzeltag-Kollaps prüft die Wochentags-Maske lokal (kein days-Feld am date).
    masked = [{"rate": 1, "days": ["mo", "tu", "we", "th", "fr", "sa", "su"],
               "date_from": "2099-06-22", "date_to": "2099-06-24"}]
    out2 = _exclude_superseded_days(masked, {"2099-06-23"})
    assert [v["date"] for v in out2] == ["2099-06-22", "2099-06-24"]
    assert all("days" not in v for v in out2)


def test_rate_plan_options_per_room_without_surcharge() -> None:
    mode, opts = ChannelManagerService._rate_plan_options(10000, {"max_guests": 4})
    assert mode == "per_room"
    assert opts == [{"occupancy": 2, "is_primary": True, "rate": 10000}]


def test_rate_plan_options_per_person_with_surcharge() -> None:
    prop = {
        "max_guests": 3,
        "type_attributes": {"pricing": {"extraGuestCharge": 20, "extraGuestFrom": 1}},
    }
    mode, opts = ChannelManagerService._rate_plan_options(10000, prop)
    assert mode == "per_person"
    # occ1 primär = Basispreis; occ2 = +1×2000; occ3 = +2×2000.
    by_occ = {o["occupancy"]: o for o in opts}
    assert by_occ[1]["is_primary"] and by_occ[1]["rate"] == 10000
    assert by_occ[2]["derived_option"]["rate"] == [["increase_by_amount", "2000"]]
    assert by_occ[3]["derived_option"]["rate"] == [["increase_by_amount", "4000"]]


def test_room_type_occupancy_from_object_data() -> None:
    occ = ChannelManagerService._room_type_occupancy(
        {
            "max_guests": 4,
            "type_attributes": {"occupancy": {"children": 2, "infants": 1, "rooms": 3}},
        }
    )
    assert occ["occ_adults"] == 4
    assert occ["default_occupancy"] == 4
    assert occ["occ_children"] == 2
    assert occ["occ_infants"] == 1
    # count_of_rooms ist die Verkaufsobergrenze bei Channex (ein höherer
    # availability-Push wird darauf gekappt) und bei „1 Objekt = 1 Einheit"
    # immer 1 — auch wenn im Altbestand noch ein occupancy.rooms steht (0245).
    assert occ["count_of_rooms"] == 1


def test_room_type_occupancy_defaults_when_missing() -> None:
    # Ohne occupancy-Block: Kinder/Kleinkinder 0, count_of_rooms 1, occ_adults ≥ 1.
    occ = ChannelManagerService._room_type_occupancy({"max_guests": 1})
    assert occ == {
        "count_of_rooms": 1,
        "occ_adults": 1,
        "occ_children": 0,
        "occ_infants": 0,
        "default_occupancy": 1,
    }
    # Gar keine Objektdaten → sichere Mindestwerte (occ_adults 2 = Default).
    assert ChannelManagerService._room_type_occupancy(None)["occ_adults"] == 2


# --- Phase 4: Property-Settings (state_length + min/max price) ---------------
def test_property_attrs_includes_settings() -> None:
    attrs = ChannelManagerService._property_attrs(
        {"city": "Kiel", "type_attributes": {"pricing": {"minPrice": 50, "maxPrice": 0}}}
    )
    assert attrs["settings"]["state_length"] == 500
    assert attrs["settings"]["min_price"] == 50
    # maxPrice=0 → NICHT gesendet (kein erfundener Wert).
    assert "max_price" not in attrs["settings"]


def test_property_attrs_settings_without_pricing() -> None:
    attrs = ChannelManagerService._property_attrs({"city": "Kiel"})
    # Inventartage + fest gepinnte Autoupdate-Flags (PMS = Master); keine Preisgrenzen.
    assert attrs["settings"] == {
        "state_length": 500,
        "allow_availability_autoupdate_on_modification": False,
        "allow_availability_autoupdate_on_cancellation": False,
    }


# --- Hotel-ID-Persistierung (channex_channel_connection) ---------------------
def test_extract_hotel_id_prefers_known_keys() -> None:
    # Booking.com & Co: hotel_id; Sandbox: hotel_code.
    assert ChannelManagerService._extract_hotel_id({"hotel_id": "12345"}) == "12345"
    assert ChannelManagerService._extract_hotel_id({"hotel_code": "abc"}) == "abc"
    # Zahlen werden zu String normalisiert.
    assert ChannelManagerService._extract_hotel_id({"hotel_id": 999}) == "999"


def test_extract_hotel_id_none_without_match() -> None:
    # Kein Fallback/Raten: ohne passenden Schlüssel → None.
    assert ChannelManagerService._extract_hotel_id({}) is None
    assert ChannelManagerService._extract_hotel_id({"foo": "bar"}) is None
    assert ChannelManagerService._extract_hotel_id({"hotel_id": ""}) is None




def test_channex_fehlermeldung_nennt_die_ursache() -> None:
    """Channex betitelt JEDEN Validierungsfehler mit „Validation Error"; die
    Ursache steht in `details`. Ohne diese Auswertung sah der Kunde nur den
    nichtssagenden Titel — und unsere Sonderbehandlung (belegte Hotel-ID → 409)
    griff nie, weil sie auf den Text prüft."""
    from src.features.channel_manager.channex_client import ChannexClient

    detail = {
        "code": "validation_error",
        "title": "Validation Error",
        "details": {"settings": ["channel with the same settings already exists"]},
    }
    assert ChannexClient._extract_message(detail) == (
        "channel with the same settings already exists"
    )
    # Ohne `details` bleibt der Titel die beste verfügbare Aussage.
    assert ChannexClient._extract_message({"title": "Unauthorized"}) == "Unauthorized"


def test_to_booking_masks_customer_via_mixin() -> None:
    """Regression für den Mixin-Split: _to_booking referenziert _mask_customer
    über BookingsSyncMixin (einzige Nicht-Verbatim-Stelle des Splits)."""
    from src.features.auth.guest_masking import GuestMask

    mask = GuestMask(
        full_name=False, contact=False, amounts=True, source=True, id_docs=False
    )
    row = {
        "id": "b1",
        "channex_booking_id": "cx-1",
        "status": "new",
        "customer": {"name": "Max Mustermann", "mail": "max@example.com"},
    }
    booking = ChannelManagerService._to_booking(row, mask)
    assert booking.id == "b1"
    assert booking.external_id == "cx-1"
    # Maskierung greift: voller Name/Kontakt sind ohne Rechte nicht sichtbar.
    assert booking.customer.get("mail") is None or booking.customer.get("mail") == ""


# --- Kontoweites Channex-Budget: PRO-CALL-Gate (Bypass-Fix) ------------------
# Regression für den Batch-Bypass: früher zog der Worker EIN Token vor dem
# Handler; ein Batch-Job (process_ari_outbox mit bis zu 200 Zeilen, reconcile
# über hunderte Objekte) feuerte danach N Channex-Calls für dieses 1 Token und
# umging das kontoweite Limit. Der Fix zieht ein Token PRO ECHTEM HTTP-CALL im
# ChannexClient (before_call-Callback); erschöpftes Budget → ChannexBudgetExhausted.

def _budget_client(*, allow: bool):  # noqa: ANN202
    """Realer ChannexClient mit gesetztem before_call. `allow=False` verweigert
    jedes Token (deny-all), damit KEIN echter HTTP-Call passiert. api_key gesetzt
    → is_configured, damit die Handler nicht schon am Konfig-Gate no-oppen.

    retry_after=0 bei Ablehnung: kein Kurz-Wait (die Waits sind für „Fenster
    gleich frei"-Fälle da), damit der Test ohne echte time.sleep-Wartezeit
    genau EINEN before_call-Aufruf je HTTP-Call sieht."""
    from src.features.channel_manager.channex_client import ChannexClient
    from src.jobs.channex_budget import BudgetDecision

    calls: list[str | None] = []

    def before_call(channex_property_id):  # noqa: ANN001, ANN202
        calls.append(channex_property_id)
        return BudgetDecision(allowed=allow, retry_after=0)

    client = ChannexClient(
        api_key="test-key", base_url="https://channex.test/api/v1",
        before_call=before_call,
    )
    return client, calls


def test_channex_client_raises_when_budget_exhausted_without_http() -> None:
    from unittest.mock import patch

    from src.features.channel_manager.channex_client import ChannexBudgetExhausted

    client, calls = _budget_client(allow=False)
    # httpx darf gar nicht erst aufgerufen werden — der Budget-Gate schlägt davor zu.
    with patch("httpx.Client") as httpx_client:
        try:
            client.update_availability(
                [{"property_id": "cx-prop", "room_type_id": "cx-rt",
                  "date_from": "2026-06-23", "date_to": "2026-06-25", "availability": 0}]
            )
        except ChannexBudgetExhausted as exc:
            assert exc.retry_after >= 1
        else:
            raise AssertionError("erschöpftes Budget muss ChannexBudgetExhausted werfen")
    httpx_client.assert_not_called()  # KEIN Channex-Call trotz Aufruf
    # Property-Ebene: die channex_property_id aus values[] wurde durchgereicht.
    assert calls == ["cx-prop"]


def test_channex_client_allows_and_hits_http_when_budget_free() -> None:
    """Gegenprobe zum Bypass-Fix: erlaubt das Budget, geht der Call durch bis
    httpx (ein Token je Call gezogen), statt zu werfen."""
    from unittest.mock import MagicMock, patch

    client, calls = _budget_client(allow=True)
    resp = MagicMock()
    resp.status_code = 200
    resp.is_success = True
    resp.content = b"{}"
    resp.json.return_value = {"data": []}
    with patch("httpx.Client") as httpx_client:
        httpx_client.return_value.__enter__.return_value.request.return_value = resp
        client.update_availability(
            [{"property_id": "cx-prop", "room_type_id": "cx-rt",
              "date_from": "2026-06-23", "date_to": "2026-06-25", "availability": 0}]
        )
    httpx_client.assert_called_once()  # Budget frei → echter Call läuft
    assert calls == ["cx-prop"]  # genau ein Token für diesen einen Call


# --- Restriktions-Outbox: dauerhafter Backstop (BUG 2) + BUG 9 ---------------
# Vor 0115 hatte NUR der Availability-Push (ari_outbox) einen persistenten Retry-
# Backstop. Stop-Sell/Rate/CTA-CTD schrieben nichts → nach Job-Tod war der Wert
# verloren (Überbuchung trotz Sperre). Jetzt: Absicht VOR dem Channex-Call in
# ari_restriction_outbox, bei Fehler 'pending', Cron zieht nach.









def test_tax_logic_deckt_alle_vier_betragsbasen_ab() -> None:
    """Die vier Kombinationen aus Basis × Zeitraum ergeben genau die
    Channex-Enums (docs: taxes-and-tax-sets)."""
    faelle = {
        ("SingleCharge", "PerStay"): "per_booking",
        ("SingleCharge", "PerNight"): "per_night",
        ("PerPerson", "PerStay"): "per_person",
        ("PerPerson", "PerNight"): "per_person_per_night",
    }
    for (charge, period), erwartet in faelle.items():
        tax = {"mode": "amount", "chargeBasis": charge, "period": period}
        assert TaxSyncMixin._tax_logic(tax) == erwartet


def test_tax_logic_altdatensatz_bleibt_per_night() -> None:
    """Ohne gespeicherte Basis bleibt es beim bisherigen Verhalten."""
    assert TaxSyncMixin._tax_logic({"mode": "amount"}) == "per_night"
    assert TaxSyncMixin._tax_logic({"mode": "percent"}) == "percent"


def test_tax_type_aus_steuerart() -> None:
    """Ortsbezogene Abgaben sind „city_tax", Zimmer-/Beherbergungssteuern „tax".

    Der Unterstrich ist NICHT kosmetisch: live gegen die Channex-Sandbox
    gemessen (03.08.2026) akzeptiert POST /taxes nur `city_tax`; „city tax"
    (Doku-Schreibweise) und „City Tax" (Response-Schreibweise) ergeben
    `422 {"type": ["is invalid"]}`. Dieser Test hält die geprüfte Realität
    fest, nicht die Doku."""
    assert TaxSyncMixin._tax_type({"taxType": "TouristTax"}) == "city_tax"
    assert TaxSyncMixin._tax_type({"taxType": "RoomTax"}) == "tax"
    # Ohne Steuerart entscheidet weiter die gröbere kind-Achse (Bestand).
    assert TaxSyncMixin._tax_type({"kind": "local"}) == "city_tax"
    assert TaxSyncMixin._tax_type({"kind": "vat"}) == "tax"


# --- Gebühren → Channex (`type: "fee"`) --------------------------------------


def test_fee_logic_deckt_alle_vier_basen_ab() -> None:
    """Jede Gebühren-Basis hat ihr Channex-Gegenstück.

    Alle vier Ziele sind live mit `type: "fee"` gegen POST /taxes geprüft
    (03.08.2026) — Channex akzeptiert für Gebühren dieselben logic-Werte wie
    für Steuern."""
    faelle = {
        "per_stay": "per_booking",
        "per_night": "per_night",
        "per_guest_stay": "per_person",
        "per_guest_night": "per_person_per_night",
    }
    for basis, erwartet in faelle.items():
        assert TaxSyncMixin._fee_logic({"basis": basis}) == erwartet
    # Ohne Basis gilt „einmalig pro Aufenthalt" (der Default des Formulars).
    assert TaxSyncMixin._fee_logic({}) == "per_booking"


def test_fee_title_nutzt_die_gebuehrenart_wenn_kein_name_da_ist() -> None:
    """Channex kennt nur tax|fee|city_tax — die feinere Art lebt im TITEL.

    `cleaning_fee`/`resort_fee`/`pet_fee` werden von POST /taxes mit 422
    abgelehnt (live geprüft), deshalb ist der Titel die einzige Stelle, an der
    das Portal die Art überhaupt sehen kann."""
    assert TaxSyncMixin._fee_title({"name": "Endreinigung"}) == "Endreinigung"
    # Ohne Namen tritt die Art als Bezeichnung ein — nie ein blankes „Gebühr",
    # solange die Art bekannt ist (Wurzel 4).
    assert TaxSyncMixin._fee_title({"feeType": "pet"}) == "Haustiergebühr"
    assert TaxSyncMixin._fee_title({"feeType": "linen"}) == "Wäscheservice"
    # Weder Name noch Art: dann bleibt nur der neutrale Sammelbegriff.
    assert TaxSyncMixin._fee_title({}) == "Gebühr"


def test_gebuehr_liegt_in_der_kaskade_unter_der_steuer() -> None:
    """Level-Reihenfolge: Channex rechnet von der höchsten Zahl zur niedrigsten.

    Gebühr auf 1, Steuer auf 0 → die prozentuale USt greift auf Grundpreis
    PLUS Gebühren. Wären beide auf 0, rechnete die USt nur auf den Grundpreis
    und die Rechnung des Portals wiche von unserer ab."""
    assert TaxSyncMixin._LEVEL_FEE > TaxSyncMixin._LEVEL_TAX


def test_scope_of_liest_nur_echte_portal_codes() -> None:
    """Kanal-Einschränkung: leer = alle Kanäle (der Normalfall)."""
    assert TaxSyncMixin._scope_of({}) == []
    assert TaxSyncMixin._scope_of({"portalScope": None}) == []
    # Kein String-Splitting auf Zuruf: nur eine echte Liste zählt.
    assert TaxSyncMixin._scope_of({"portalScope": "BookingCom"}) == []
    assert TaxSyncMixin._scope_of({"portalScope": ["BookingCom"]}) == ["BookingCom"]
    # Leere Einträge fliegen raus (ein leerer Code schränkte auf „nichts" ein).
    assert TaxSyncMixin._scope_of({"portalScope": ["AirBNB", "  "]}) == ["AirBNB"]


# --- Steuerregime der Portale (automatisch erkannt) --------------------------


def test_regime_uebersetzt_jeden_live_gemessenen_kanalwert() -> None:
    """Die Werte stammen aus dem echten Channex-Kanal-Katalog (03.08.2026).

    Der Airbnb-Fall ist der wichtigste: `Payout Amount` ist dort der DEFAULT
    und heißt „Airbnb rechnet die Steuer selbst zum Gastpreis" — würden wir sie
    zusätzlich übertragen, zahlte der Gast sie doppelt."""
    from src.features.channel_manager.tax_regime import _regime_aus_wert

    # Portal rechnet selbst → NICHT senden.
    for wert in ("Payout Amount", "Collect Amount"):
        reg = _regime_aus_wert(wert, feld="booking_amount_settings", portal="X")
        assert reg.senden is False, wert

    # Betrag ist ohne Steuer → exklusiv übertragen.
    for wert in ("Exclusive", "Total Amount Excluding Tax"):
        reg = _regime_aus_wert(wert, feld="booking_tax_settings", portal="X")
        assert (reg.senden, reg.inclusive) == (True, False), wert

    # Betrag ist inklusive Steuer.
    for wert in ("Inclusive", "Inclusive With Commissions", "Total Paid Amount",
                 "Total Amount"):
        reg = _regime_aus_wert(wert, feld="booking_tax_settings", portal="X")
        assert (reg.senden, reg.inclusive) == (True, True), wert


def test_regime_ignoriert_provisionsangaben() -> None:
    """Hostelworld/Ostrovok nutzen `booking_amount_settings` für die PROVISION.

    Das ist keine Steueraussage — bekannt und bewusst ohne Wirkung, damit nicht
    bei jedem Sync dieser Kanäle eine Warnung steht, die niemand beheben kann."""
    from src.features.channel_manager.tax_regime import _regime_aus_wert

    for wert in ("With Commission", "Without Commission"):
        reg = _regime_aus_wert(wert, feld="booking_amount_settings", portal="X")
        assert (reg.senden, reg.inclusive) == (True, None), wert
        assert "Provision" in reg.quelle


def test_regime_raet_bei_unbekanntem_wert_nicht() -> None:
    """Ein neuer Channex-Wert darf nicht stillschweigend falsch gedeutet werden
    (Wurzel 4): Standardverhalten, und die Warnung macht ihn sichtbar."""
    from src.features.channel_manager.tax_regime import STANDARD, _regime_aus_wert

    reg = _regime_aus_wert("Ganz Neuer Wert", feld="booking_tax_settings",
                           portal="X")
    assert reg is STANDARD
    assert (reg.senden, reg.inclusive) == (True, None)


# --- Gäste-Chat: gehört zum Dienst, nicht auf einen Knopf ---------------------
class _ChatAppChannex:
    """Stub der Applications-API: merkt sich Installationen."""

    CHAT_APP_CODE = "channex_messages"
    is_configured = True

    def __init__(self, installed: list[dict] | None = None) -> None:
        self._installed = installed or []
        self.installs: list[tuple[str, str]] = []

    def list_installed_applications(self) -> dict:
        return {"data": self._installed}

    def install_application(self, *, channex_property_id: str, application_code: str) -> dict:
        self.installs.append((channex_property_id, application_code))
        return {"data": {"id": "inst-1"}}


def test_chat_wird_beim_verbinden_freigeschaltet() -> None:
    # Ohne installierte Chat-Anwendung antwortet die Nachrichten-API mit 403 —
    # der Posteingang bliebe bei jeder Buchung stumm. Das darf niemand von Hand
    # nachholen müssen.
    channex = _ChatAppChannex()
    svc = ChannelManagerService(service_client=None, channex=channex)
    svc._chat_freischalten("cx-prop-1")
    assert channex.installs == [("cx-prop-1", "channex_messages")]


def test_chat_freischaltung_ueberspringt_demo_objekte() -> None:
    channex = _ChatAppChannex()
    svc = ChannelManagerService(service_client=None, channex=channex)
    svc._chat_freischalten("demo-abc")
    assert channex.installs == []


def test_chat_nachziehen_installiert_nur_das_fehlende() -> None:
    channex = _ChatAppChannex(installed=[{
        "id": "inst-1",
        "attributes": {"application_code": "channex_messages", "property_id": "cx-a"},
    }])
    svc = ChannelManagerService(service_client=None, channex=channex)
    svc._chat_nachziehen(["cx-a", "cx-b"])
    assert channex.installs == [("cx-b", "channex_messages")]


def test_chat_freischaltung_kippt_das_verbinden_nicht() -> None:
    class _Kaputt(_ChatAppChannex):
        def install_application(self, **_k):  # noqa: ANN003, ANN201
            raise ChannexError("nope", status_code=502, channex_status=502)

    svc = ChannelManagerService(service_client=None, channex=_Kaputt())
    svc._chat_freischalten("cx-prop-1")  # kein Werfen: Distribution läuft auch ohne Chat

