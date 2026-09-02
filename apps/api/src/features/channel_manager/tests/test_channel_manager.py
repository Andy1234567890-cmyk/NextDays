
from fastapi.testclient import TestClient

from src.features.channel_manager import ota_abgaben, ota_aktionen
from src.features.channel_manager.abgaben_status import (
    AbgabenStatusMixin,
)
from src.features.channel_manager.abgaben_status import (
    _exportiert as abgaben_status_exportiert,
)
from src.features.channel_manager.channex_client import ChannexError
from src.features.channel_manager.service import (
    ChannelManagerService,
)
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
    # Channex' eigener Kanalcode schreibt sich OHNE Punkt — live gelesen aus
    # `GET channels/list`. Genau daran sind sechs echte Buchungen als
    # `ota_other` gelandet und waren im Belegungsplan nicht als Booking
    # erkennbar (07.08.2026).
    assert f("BookingCom") == "booking"
    # Rechtsform-Zusätze hängen hinten an und meinen dasselbe Portal. Vorher
    # fiel das auf `ota_other`: finanziell gleich (beide 1 % nach Preisliste
    # §2), aber im Kalender ohne Filter und ohne Kanalfarbe.
    assert f("Booking.com B.V.") == "booking"
    assert f("Air BnB") == "airbnb"
    # Unbekannte/weitere OTAs → externer Sammelkanal, nicht 'portal'.
    assert f("Expedia") == "ota_other"
    assert f("Agoda") == "ota_other"
    assert f(None) == "ota_other"
    # Ein Name, der einen Portalnamen nur ENTHÄLT, ist nicht dieses Portal.
    assert f("Notbooking Inc") == "ota_other"
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
    from src.features.channel_manager.common import _CHANNEX_FACILITY
    from src.features.channel_manager.service import _channex_facility_ids

    # UUIDs aus dem Katalog, NICHT abgeschrieben: die Werte stammen aus einem
    # fremden Katalog und wurden am 13.08.2026 komplett erneuert (die alten waren
    # sämtlich ungültig). Ein fest einkodierter Wert prüft dann nur noch, ob
    # jemand dieselbe Zahl zweimal getippt hat — hier geht es um die Logik
    # (Abbildung, Unbekanntes weglassen, Duplikate, Reihenfolge).
    wifi = _CHANNEX_FACILITY["wifi"]
    ac = _CHANNEX_FACILITY["air_conditioning"]
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
    from src.features.channel_manager.common import _CHANNEX_FACILITY

    wifi = _CHANNEX_FACILITY["wifi"]
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

def _ari_wert_in_der_zukunft() -> dict[str, object]:
    """Ein availability-Wert, dessen Zeitraum in der Zukunft liegt.

    KEIN FESTES DATUM (13.08.2026): Hier stand „2026-06-23 bis 2026-06-25", und
    das brach genau in dem Moment, als der Client anfing, vergangene Tage zentral
    abzuschneiden (`ohne_vergangenheit`) — die Nutzlast wurde leer, und der Test
    verlor die `property_id`, deren Weiterleitung er eigentlich prüft. Ein Test
    für den BUDGET-Zähler darf nicht am Kalender hängen.
    """
    from datetime import date, timedelta

    start = date.today() + timedelta(days=30)
    return {
        "property_id": "cx-prop",
        "room_type_id": "cx-rt",
        "date_from": start.isoformat(),
        "date_to": (start + timedelta(days=2)).isoformat(),
        "availability": 0,
    }


def _budget_client(*, allow: bool):  # noqa: ANN202
    """Realer ChannexClient mit gesetztem before_call. `allow=False` verweigert
    jedes Token (deny-all), damit KEIN echter HTTP-Call passiert. api_key gesetzt
    → is_configured, damit die Handler nicht schon am Konfig-Gate no-oppen.

    retry_after=0 bei Ablehnung: kein Kurz-Wait (die Waits sind für „Fenster
    gleich frei"-Fälle da), damit der Test ohne echte time.sleep-Wartezeit
    genau EINEN before_call-Aufruf je HTTP-Call sieht."""
    from src.features.channel_manager.channex_client import ChannexClient
    from src.jobs.channex_budget import BudgetDecision

    calls: list[tuple[str | None, str]] = []

    def before_call(channex_property_id, kind):  # noqa: ANN001, ANN202
        calls.append((channex_property_id, kind))
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
            client.update_availability([_ari_wert_in_der_zukunft()])
        except ChannexBudgetExhausted as exc:
            assert exc.retry_after >= 1
        else:
            raise AssertionError("erschöpftes Budget muss ChannexBudgetExhausted werfen")
    httpx_client.assert_not_called()  # KEIN Channex-Call trotz Aufruf
    # Property-Ebene: die channex_property_id aus values[] wurde durchgereicht,
    # und POST /availability zählt in den eigenen ARI-Availability-Topf.
    assert calls == [("cx-prop", "availability")]


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
        client.update_availability([_ari_wert_in_der_zukunft()])
    httpx_client.assert_called_once()  # Budget frei → echter Call läuft
    # genau ein Token für diesen einen Call, aus dem Availability-Topf
    assert calls == [("cx-prop", "availability")]


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
        assert ota_abgaben.tax_logic(tax) == erwartet


def test_tax_logic_altdatensatz_bleibt_per_night() -> None:
    """Ohne gespeicherte Basis bleibt es beim bisherigen Verhalten."""
    assert ota_abgaben.tax_logic({"mode": "amount"}) == "per_night"
    assert ota_abgaben.tax_logic({"mode": "percent"}) == "percent"


def test_tax_type_aus_steuerart() -> None:
    """Ortsbezogene Abgaben sind „city_tax", Zimmer-/Beherbergungssteuern „tax".

    Der Unterstrich ist NICHT kosmetisch: live gegen die Channex-Sandbox
    gemessen (03.08.2026) akzeptiert POST /taxes nur `city_tax`; „city tax"
    (Doku-Schreibweise) und „City Tax" (Response-Schreibweise) ergeben
    `422 {"type": ["is invalid"]}`. Dieser Test hält die geprüfte Realität
    fest, nicht die Doku."""
    assert ota_abgaben.tax_type({"taxType": "TouristTax"}) == "city_tax"
    assert ota_abgaben.tax_type({"taxType": "RoomTax"}) == "tax"
    # Ohne Steuerart entscheidet weiter die gröbere kind-Achse (Bestand).
    assert ota_abgaben.tax_type({"kind": "local"}) == "city_tax"
    assert ota_abgaben.tax_type({"kind": "vat"}) == "tax"


# --- Gebühren/Steuern je Portal (Branchenstandard als Regelwerk) -------------


def _abgaben(portal, *, taxes=(), fees=(), **kw):
    """Kurzform: Posten eines Portals als {Titel: attrs}."""
    posten, diagnose = ota_abgaben.abgaben_je_portal(
        portal=portal,
        taxes=list(taxes),
        fees=list(fees),
        currency="EUR",
        **kw,
    )
    return {p.attrs["title"]: p for p in posten}, diagnose


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
        posten, _ = _abgaben(
            None,
            fees=[{"id": "f", "name": "Extra", "amount": 10, "basis": basis}],
        )
        assert posten["Extra"].attrs["logic"] == erwartet
    # Ohne Basis gilt „einmalig pro Aufenthalt" (der Default des Formulars).
    posten, _ = _abgaben(None, fees=[{"id": "f", "name": "Extra", "amount": 10}])
    assert posten["Extra"].attrs["logic"] == "per_booking"


def test_prozentgebuehr_geht_als_percent_ohne_waehrung() -> None:
    """Prozentuale Gebühr → logic=percent; `currency` verlangt Channex dort
    nicht (und `rate` ist der Satz, nicht ein Betrag)."""
    posten, _ = _abgaben(
        None,
        fees=[{"id": "f", "name": "Resort", "amount": 5, "mode": "percent",
               "basis": "per_stay"}],
    )
    attrs = posten["Resort"].attrs
    assert attrs["logic"] == "percent"
    assert attrs["rate"] == "5"
    assert "currency" not in attrs


def test_expedia_bekommt_nichts() -> None:
    """„Taxes and fees are not sent to Expedia." — beides, ohne Ausnahme."""
    posten, diagnose = _abgaben(
        ota_abgaben.EXPEDIA,
        taxes=[{"id": "t", "kind": "local", "name": "Kurtaxe", "mode": "percent",
                "value": 5}],
        fees=[{"id": "f", "name": "Reinigung", "amount": 50}],
    )
    assert posten == {}
    assert diagnose["gebuehren_nicht_exportiert"] == 1


def test_booking_steuer_nur_prozent_und_inklusiv() -> None:
    """Booking.com-STEUERN: nur Prozentwerte, und sie stecken IM Zimmerpreis."""
    posten, diagnose = _abgaben(
        ota_abgaben.BOOKING,
        taxes=[
            {"id": "p", "kind": "local", "name": "Kurtaxe %", "mode": "percent",
             "value": 2.5},
            {"id": "b", "kind": "local", "name": "Kurtaxe Betrag",
             "mode": "amount", "value": 2, "chargeBasis": "PerPerson",
             "period": "PerNight"},
        ],
        fees=[],
    )
    assert set(posten) == {"Kurtaxe %"}
    assert posten["Kurtaxe %"].attrs["is_inclusive"] is True
    assert diagnose["steuer_nicht_exportfaehig"] == ["b"]


def test_booking_nimmt_feste_gebuehren_und_zwar_exklusiv() -> None:
    """Booking.com-GEBÜHREN: auch feste Beträge, und getrennt ausgewiesen.

    Gegen die Lodgify-Aussage „Fixed amounts are not exported" — die beschreibt
    Lodgifys eigenen Weg, nicht den über Channex. Live belegt am 14.08.2026:
    drei Objekte (Rævehulen, FeWo Lille Lægehus, Perlen Tversted) bekommen ihre
    Booking-Buchungen mit UNSEREN deutschen Gebührennamen und Betrag zurück
    (``rooms[].taxes``: „Reinigungsgebühr", ``is_inclusive: false``) — das kann
    nur unser Sync geliefert haben.

    ``is_inclusive: false`` ist der Kern: die Reinigungsgebühr ist NICHT im
    Zimmerpreis enthalten. Bei ``true`` zöge Booking sie aus dem Nachtpreis
    heraus statt sie zu addieren — der Gast zahlte weniger und die Gebühr wäre
    nie eingezogen.
    """
    posten, diagnose = _abgaben(
        ota_abgaben.BOOKING,
        taxes=[],
        fees=[
            {"id": "fp", "name": "Service %", "amount": 5, "mode": "percent"},
            {"id": "fb", "name": "Reinigung", "amount": 50},
        ],
    )
    assert set(posten) == {"Service %", "Reinigung"}
    assert all(p.attrs["is_inclusive"] is False for p in posten.values())
    assert posten["Reinigung"].attrs["logic"] == "per_booking"
    # Kein „geht nicht raus"-Vermerk mehr — sonst stünde an der Gebühr wieder
    # der Chip „Manuelle Synchronisierung · Booking.com" (abgaben_status).
    assert "gebuehr_kein_prozent" not in diagnose


def test_airbnb_nimmt_betragssteuer_nur_pro_gast_pro_nacht() -> None:
    """„Fixed amounts are only exported if they are set as per guest per night."

    Und: getrennt vom Zimmerpreis ausgewiesen, nicht inklusiv.
    """
    posten, _ = _abgaben(
        ota_abgaben.AIRBNB,
        taxes=[
            {"id": "ok", "kind": "local", "name": "Kurtaxe Nacht/Gast",
             "mode": "amount", "value": 2, "chargeBasis": "PerPerson",
             "period": "PerNight"},
            {"id": "nein", "kind": "local", "name": "Kurtaxe Aufenthalt",
             "mode": "amount", "value": 20, "chargeBasis": "SingleCharge",
             "period": "PerStay"},
        ],
    )
    assert set(posten) == {"Kurtaxe Nacht/Gast"}
    assert posten["Kurtaxe Nacht/Gast"].attrs["is_inclusive"] is False


def test_airbnb_export_matrix_je_kategorie_und_modell() -> None:
    """Die Export-Tabelle des Standards, Zeile für Zeile."""
    faelle = [
        ("cleaning_fee", "per_stay", True),
        ("cleaning_fee", "per_night", False),
        ("cleaning_fee", "per_guest_stay", False),
        ("pet_fee", "per_stay", True),
        ("pet_fee", "per_guest_night", False),
        ("linens", "per_stay", True),
        ("linens", "per_guest_stay", True),
        ("linens", "per_night", False),
        ("linens", "per_guest_night", False),
        ("resort", "per_guest_night", True),
        ("internet", "per_night", True),      # → Gemeinschaftsgebühr
        ("hot_tub", "per_guest_stay", True),  # → Verwaltungsgebühr
        # Unknown/MiscCharges haben keine Kategorie → „Not sent to Airbnb".
        ("unknown", "per_stay", False),
        ("misc_charges", "per_stay", False),
        # Kaution steht nicht in der Export-Tabelle.
        ("security_deposit", "per_stay", False),
    ]
    for art, basis, erwartet in faelle:
        posten, _ = _abgaben(
            ota_abgaben.AIRBNB,
            fees=[{"id": "f", "name": "X", "amount": 10, "basis": basis,
                   "feeType": art}],
        )
        assert bool(posten) is erwartet, f"{art}/{basis}"


def test_airbnb_prozent_nur_bei_community_management_resort() -> None:
    """Nur diese drei Zeilen der Tabelle sind „Percentage or flat"; die
    Haustiergebühr MUSS ein Pauschalbetrag sein."""
    for art, erwartet in (
        ("resort", True), ("internet", True), ("hot_tub", True),
        ("cleaning_fee", False), ("pet_fee", False), ("linens", False),
    ):
        posten, _ = _abgaben(
            ota_abgaben.AIRBNB,
            fees=[{"id": "f", "name": "X", "amount": 5, "mode": "percent",
                   "basis": "per_stay", "feeType": art}],
        )
        assert bool(posten) is erwartet, art


def test_airbnb_summiert_gleiche_kategorie_gleiches_modell() -> None:
    """Zwei Gebühren derselben Airbnb-Kategorie, gleiches Modell: Beträge
    addieren, EINE Gebühr senden — mit dem Kategorie-Namen als Titel und einem
    stabilen Kategorie-Schlüssel."""
    posten, _ = _abgaben(
        ota_abgaben.AIRBNB,
        fees=[
            {"id": "a", "name": "Parken", "amount": 10, "basis": "per_night",
             "feeType": "parking"},
            {"id": "b", "name": "Internet", "amount": 5, "basis": "per_night",
             "feeType": "internet"},
        ],
    )
    assert set(posten) == {"Gemeinschaftsgebühr"}
    eintrag = posten["Gemeinschaftsgebühr"]
    assert eintrag.attrs["rate"] == "15.0"
    assert eintrag.schluessel == "cat:community"


def test_kurzzeitreinigung_ist_eine_eigene_zeile_der_export_tabelle() -> None:
    """„Short-term cleaning (Flat amount)": nur einmalig pro Aufenthalt, nur als
    Betrag — und getrennt von der Reinigungsgebühr, nicht mit ihr summiert."""
    for basis, erwartet in (
        ("per_stay", True), ("per_night", False),
        ("per_guest_stay", False), ("per_guest_night", False),
    ):
        posten, _ = _abgaben(
            ota_abgaben.AIRBNB,
            fees=[{"id": "f", "name": "Kurzreinigung", "amount": 20,
                   "basis": basis, "feeType": "short_term_cleaning"}],
        )
        assert bool(posten) is erwartet, basis
    # Prozentual gibt es die Zeile nicht („Flat amount").
    posten, _ = _abgaben(
        ota_abgaben.AIRBNB,
        fees=[{"id": "f", "name": "Kurzreinigung", "amount": 5, "mode": "percent",
               "basis": "per_stay", "feeType": "short_term_cleaning"}],
    )
    assert posten == {}
    # Zwei Zeilen, zwei Posten — keine Summierung mit der Reinigungsgebühr.
    posten, _ = _abgaben(
        ota_abgaben.AIRBNB,
        fees=[
            {"id": "a", "name": "Endreinigung", "amount": 50,
             "basis": "per_stay", "feeType": "cleaning_fee"},
            {"id": "b", "name": "Kurzreinigung", "amount": 20,
             "basis": "per_stay", "feeType": "short_term_cleaning"},
        ],
    )
    assert set(posten) == {"Endreinigung", "Kurzreinigung"}


def test_haustiergebuehr_pro_tier_geht_als_pauschale_ans_portal() -> None:
    """Kein Portal kennt die Tierzahl vor der Buchung: „pro Tier und
    Aufenthalt" geht als Pauschale pro Aufenthalt raus (Betrag für EIN Tier),
    die tatsächliche Zahl rechnet der Resolver bei uns."""
    posten, _ = _abgaben(
        ota_abgaben.AIRBNB,
        fees=[{"id": "f", "name": "Hund", "amount": 25, "basis": "per_pet_stay",
               "feeType": "pet_fee"}],
    )
    assert posten["Hund"].attrs["logic"] == "per_booking"
    assert posten["Hund"].attrs["rate"] == "25"


def test_kaution_geht_an_kein_portal() -> None:
    """„Kaution → SecurityDeposit" steht nur in der Zuordnungstabelle, nicht in
    der Export-Tabelle: sie ist kein Aufschlag auf den Preis. Channex kennt
    dafür keinen Typ — als `fee` gesendet wäre sie Geld, das nie zurückgeht."""
    fee = {"id": "f", "name": "Kaution", "amount": 300, "basis": "per_stay",
           "feeType": "security_deposit"}
    for portal in (
        ota_abgaben.AIRBNB, ota_abgaben.BOOKING, ota_abgaben.EXPEDIA, "Vrbo", None
    ):
        posten, _ = _abgaben(portal, fees=[fee])
        assert posten == {}, portal


def test_homeaway_vrbo_nimmt_alles_getrennt_ausgewiesen() -> None:
    """Vrbo: Prozent UND Betrag, bei Steuern wie Gebühren, alles getrennt vom
    Zimmerpreis; zwei Gebühren derselben Art bleiben zwei Gebühren; die Steuer
    rechnet nur auf den Zimmerpreis (Gebühr also nicht in der Grundlage).

    Der Kanal steht heute nicht im Channex-Katalog — die Regel greift deshalb
    über den Markennamen im Code, nicht über einen geratenen Code.
    """
    for code in ("Vrbo", "HomeAway", "VrboUS"):
        posten, diagnose = _abgaben(
            code,
            taxes=[
                {"id": "p", "kind": "local", "name": "Kurtaxe %",
                 "mode": "percent", "value": 2.5,
                 "taxableBase": ["base_price", "cleaning"]},
                {"id": "b", "kind": "local", "name": "Kurtaxe Betrag",
                 "mode": "amount", "value": 2, "chargeBasis": "SingleCharge",
                 "period": "PerNight"},
            ],
            fees=[
                {"id": "fa", "name": "Parken", "amount": 10, "basis": "per_night",
                 "feeType": "parking"},
                {"id": "fb", "name": "Internet", "amount": 5,
                 "basis": "per_night", "feeType": "internet"},
                {"id": "fc", "name": "Reinigung", "amount": 50,
                 "basis": "per_stay", "feeType": "cleaning_fee"},
            ],
        )
        assert set(posten) == {
            "Kurtaxe %", "Kurtaxe Betrag", "Parken", "Internet", "Reinigung"
        }, code
        assert all(p.attrs["is_inclusive"] is False for p in posten.values()), code
        assert posten["Reinigung"].level == posten["Kurtaxe %"].level, code
        assert diagnose == {}, code


def test_airbnb_sperrt_kategorie_bei_gemischten_modellen() -> None:
    """Gemischte Berechnungsmodelle in einer Kategorie: KEINE der Gebühren geht
    raus. Der Standard verlangt, Art zu ändern oder Dubletten zu entfernen."""
    posten, diagnose = _abgaben(
        ota_abgaben.AIRBNB,
        fees=[
            {"id": "a", "name": "Parken", "amount": 10, "basis": "per_night",
             "feeType": "parking"},
            {"id": "b", "name": "Internet", "amount": 5, "basis": "per_stay",
             "feeType": "internet"},
        ],
    )
    assert posten == {}
    assert diagnose["gesperrte_kategorien"] == ["community"]


def test_airbnb_steuern_haengen_am_szenario() -> None:
    """Ohne freigeschaltetes Steuerszenario bekommt Airbnb KEINE Steuern —
    Gebühren dagegen schon (der Standard hängt nur die Steuern daran)."""
    posten, diagnose = _abgaben(
        ota_abgaben.AIRBNB,
        taxes=[{"id": "t", "kind": "local", "name": "Kurtaxe", "mode": "percent",
                "value": 5}],
        fees=[{"id": "f", "name": "Reinigung", "amount": 50,
               "feeType": "cleaning_fee"}],
        airbnb_steuern_erlaubt=False,
    )
    assert set(posten) == {"Reinigung"}
    assert diagnose["airbnb_steuern_gesperrt"] == 1


def test_grundlage_hebt_nur_gewaehlte_kategorien_ueber_die_steuer() -> None:
    """Bemessungsgrundlage → Kaskadenebene: die gewählte Kategorie liegt ÜBER
    der Steuer (wird also mitbesteuert), die andere auf derselben Ebene."""
    posten, _ = _abgaben(
        ota_abgaben.AIRBNB,
        taxes=[{"id": "t", "kind": "local", "name": "Kurtaxe", "mode": "percent",
                "value": 5, "taxableBase": ["base_price", "cleaning"]}],
        fees=[
            {"id": "c", "name": "Reinigung", "amount": 50,
             "feeType": "cleaning_fee"},
            {"id": "r", "name": "Resort", "amount": 20, "feeType": "resort"},
        ],
    )
    assert posten["Reinigung"].level > posten["Kurtaxe"].level
    assert posten["Resort"].level == posten["Kurtaxe"].level


def test_ohne_grundlage_liegen_gebuehren_unter_der_steuer() -> None:
    """Bestand ohne gepflegte Grundlage: unverändertes Verhalten — die
    prozentuale Steuer rechnet auf Grundpreis PLUS Gebühren."""
    posten, _ = _abgaben(
        ota_abgaben.AIRBNB,
        taxes=[{"id": "t", "kind": "local", "name": "Kurtaxe", "mode": "percent",
                "value": 5}],
        fees=[{"id": "c", "name": "Reinigung", "amount": 50,
               "feeType": "cleaning_fee"}],
    )
    assert posten["Reinigung"].level > posten["Kurtaxe"].level


def test_bei_anderen_kanaelen_liegt_keine_gebuehr_in_der_grundlage() -> None:
    """„Für alle anderen Kanäle gelten Steuern nur auf den Basispreis."

    Also: Gebühr auf derselben Ebene wie die Steuer, damit sie nicht mit
    besteuert wird — selbst wenn die Grundlage sie ausdrücklich nennt.
    """
    posten, _ = _abgaben(
        ota_abgaben.BOOKING,
        taxes=[{"id": "t", "kind": "local", "name": "Kurtaxe", "mode": "percent",
                "value": 5, "taxableBase": ["base_price", "cleaning"]}],
        fees=[{"id": "c", "name": "Reinigung %", "amount": 5, "mode": "percent",
               "feeType": "cleaning_fee"}],
    )
    assert posten["Reinigung %"].level == posten["Kurtaxe"].level


def test_kanal_einschraenkung_haelt_posten_aus_dem_standard_set() -> None:
    """Ein auf ein Portal eingeschränkter Posten darf NICHT ins Standard-Set:
    das hängt an allen Plänen ohne Portal-Scope und wäre der Weg zu jedem
    anderen Kanal."""
    fee = {"id": "f", "name": "Nur Booking", "amount": 50,
           "portalScope": ["BookingCom"], "mode": "percent"}
    standard, _ = _abgaben(None, fees=[fee])
    booking, _ = _abgaben(ota_abgaben.BOOKING, fees=[fee])
    assert standard == {}
    assert set(booking) == {"Nur Booking"}


def test_optionale_gebuehr_geht_an_kein_portal() -> None:
    """Optionale Gebühren wählt der Gast ab — als Pflichtaufschlag beim Portal
    wären sie eine Falle."""
    posten, _ = _abgaben(
        None, fees=[{"id": "f", "name": "Frühstück", "amount": 20,
                     "optional": True}]
    )
    assert posten == {}


def test_portal_das_selbst_kassiert_bekommt_nichts() -> None:
    """Rechnet das Portal die Abgabe selbst zum Gastpreis (Airbnb „Payout
    Amount", Expedia „Collect Amount"), darf sie nicht zusätzlich hin."""
    posten, _ = _abgaben(
        ota_abgaben.BOOKING,
        taxes=[{"id": "t", "kind": "local", "name": "Kurtaxe", "mode": "percent",
                "value": 5}],
        objekt_inklusiv_erlaubt=False,
    )
    assert posten == {}


def test_ust_ohne_namen_heisst_nicht_steuer() -> None:
    """Die USt trägt keinen eigenen Namen — beim Portal darf trotzdem kein
    Platzhalter „Steuer" stehen (Wurzel 4)."""
    posten, _ = _abgaben(
        None, taxes=[{"id": "v", "kind": "vat", "mode": "percent", "value": 19}]
    )
    assert set(posten) == {"USt."}


def test_gastseitiger_steuername_gewinnt_beim_portal() -> None:
    """names[locale] ist der Text, den der Gast beim Portal sieht."""
    posten, _ = _abgaben(
        None,
        taxes=[{"id": "t", "kind": "local", "name": "intern",
                "names": {"de": "Kurtaxe"}, "mode": "percent", "value": 5}],
    )
    assert set(posten) == {"Kurtaxe"}


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



def test_kurzaufenthalts_gebuehr_geht_an_kein_portal() -> None:
    """Keine Channex-`logic` und kein Portal kennt eine Gebühr, die nur bis zu
    einer Aufenthaltslänge greift. Unbedingt gesendet würde sie JEDEM
    Portal-Gast berechnet — also draußen lassen und protokollieren."""
    posten, diagnose = _abgaben(
        None,
        fees=[
            {"id": "k", "name": "Kurz", "amount": 30, "basis": "per_stay",
             "shortStayOnly": True},
            {"id": "n", "name": "Normal", "amount": 50, "basis": "per_stay"},
        ],
    )
    assert "Kurz" not in posten
    assert "Normal" in posten
    assert diagnose["gebuehr_nur_kurzaufenthalt"] == 1


def test_gebuehr_mit_zeitraum_oder_nur_abrechnung_geht_an_kein_portal() -> None:
    """Channex kennt keine Datumsbedingung: eine Gebühr „ab 01.08." gälte dort
    für jede Anreise. Und „nur in der Eigentümer-Abrechnung" zahlt der Gast
    nie. Beide bleiben draußen und werden protokolliert."""
    posten, diagnose = _abgaben(
        None,
        fees=[
            {"id": "r", "name": "Resort", "amount": 25, "basis": "per_night",
             "validFrom": "2026-08-01"},
            {"id": "i", "name": "Intern", "amount": 40, "basis": "per_stay",
             "ownerStatementOnly": True},
            {"id": "n", "name": "Normal", "amount": 50, "basis": "per_stay"},
        ],
    )
    assert "Resort" not in posten
    assert "Intern" not in posten
    assert "Normal" in posten
    assert diagnose["gebuehr_mit_zeitraum"] == 1
    assert diagnose["gebuehr_nur_abrechnung"] == 1


# --- Sync-Stand der Abgaben (Chip „Manuelle Synchronisierung") ---------------


def _status(eintrag, kind, *, portale, nicht_gesendet=None):
    return AbgabenStatusMixin._posten_status(  # pylint: disable=protected-access
        eintrag,
        kind,
        portale=portale,
        nicht_gesendet=nicht_gesendet or {},
    )


def test_abgaben_status_trennt_manuell_von_eingeschraenkt() -> None:
    """Drei verschiedene Aussagen, drei verschiedene Felder: „das Portal nimmt
    den Posten nicht" (Chip), „der Betrieb hat ihn ausgeschlossen" (Absicht) und
    „er geht bewusst an kein Portal" (intern)."""
    portale = ["AirBNB", "BookingCom"]
    # Booking nimmt keine festen Beträge → dort manuell, bei Airbnb nicht.
    manuell = _status(
        {"id": "f1", "name": "Reinigung", "feeType": "cleaning_fee"},
        "fee",
        portale=portale,
        nicht_gesendet={"BookingCom": {"f1"}, "AirBNB": set()},
    )
    assert manuell["manual_portals"] == ["BookingCom"]
    assert manuell["restricted_portals"] == []
    assert manuell["internal_only"] is False

    # Ausdrücklich nur an Airbnb: Booking ist eingeschränkt, NICHT „manuell".
    eingeschraenkt = _status(
        {"id": "f1", "name": "Reinigung", "feeType": "cleaning_fee",
         "portalScope": ["AirBNB"]},
        "fee",
        portale=portale,
        nicht_gesendet={"BookingCom": {"f1"}, "AirBNB": set()},
    )
    assert eingeschraenkt["restricted_portals"] == ["BookingCom"]
    assert eingeschraenkt["manual_portals"] == []


def test_abgaben_status_interne_gebuehren_ohne_chip() -> None:
    """Optionale Gebühr, Kurzaufenthalts-Gebühr und Kaution gehen bewusst an
    kein Portal. Ein Chip „muss dort manuell gepflegt werden" wäre bei ihnen
    eine Aufforderung zu etwas, das gar nicht gewollt ist."""
    portale = ["AirBNB"]
    for eintrag in (
        {"id": "f1", "optional": True, "feeType": "cleaning_fee"},
        {"id": "f1", "shortStayOnly": True, "feeType": "cleaning_fee"},
        {"id": "f1", "feeType": "security_deposit"},
        {"id": "f1", "feeType": "resort", "validFrom": "2026-08-01"},
        {"id": "f1", "feeType": "resort", "ownerStatementOnly": True},
    ):
        st = _status(eintrag, "fee", portale=portale,
                     nicht_gesendet={"AirBNB": {"f1"}})
        assert st["internal_only"] is True, eintrag
        assert st["manual_portals"] == []

    # Eine Steuer ist NIE „intern": sie hat keine Optional-Achse.
    st = _status({"id": "t1", "kind": "local"}, "tax", portale=portale,
                 nicht_gesendet={"AirBNB": {"t1"}})
    assert st["internal_only"] is False
    assert st["manual_portals"] == ["AirBNB"]


def test_abgaben_status_summierte_airbnb_kategorie_gilt_als_gesendet() -> None:
    """Bei Airbnb werden Gebühren derselben Kategorie zu EINER summiert; der
    Posten trägt dann `cat:<kategorie>`. Ohne diesen zweiten Schlüssel stünde
    der Chip an genau den Gebühren, die sehr wohl rausgehen."""
    fees = [
        {"id": "a", "name": "Reinigung 1", "amount": 20, "basis": "per_stay",
         "feeType": "community"},
        {"id": "b", "name": "Reinigung 2", "amount": 30, "basis": "per_stay",
         "feeType": "parking"},
    ]
    posten, _ = _abgaben(ota_abgaben.AIRBNB, fees=fees)
    summe = next(iter(posten.values()))
    assert summe.schluessel == "cat:community"
    # Beide Einzelgebühren gelten als übertragen.
    for fee in fees:
        assert abgaben_status_exportiert(
            [summe], schluessel=str(fee["id"]),
            kategorie=ota_abgaben.fee_category(fee),
        )


# --- Aktionen an die Portale: Weg 1 Tagespreis (ota_aktionen) ----------------


def test_per_tagespreis_uebertragbar_nur_am_tag_entscheidbare_bedingungen() -> None:
    """Der Tagespreis trägt nur Bedingungen, die sich am TAG entscheiden.
    Was an der BUCHUNG hängt, darf NICHT pauschal gesenkt rausgehen, sonst
    bekommt jeder Portal-Gast den Rabatt (bei Airbnb übernimmt das Weg 2,
    airbnb_aktionen)."""
    ok, grund = ota_aktionen.per_tagespreis_uebertragbar(
        {"stay_ranges": [{"from": "2026-06-01", "to": "2026-06-30"}]}
    )
    assert ok is True and grund is None
    # Ohne jede Bedingung: gilt an jedem Tag, also übertragbar.
    assert ota_aktionen.per_tagespreis_uebertragbar({})[0] is True

    for feld, erwartet in (
        ("min_nights", "mindestaufenthalt"),
        ("lead_min_days", "fruehbucher"),
        ("lead_max_days", "last_minute"),
        ("booked_from", "buchungszeitraum"),
        ("promo_codes", "angebotscode"),
    ):
        wert = ["CODE"] if feld == "promo_codes" else 5
        ok, grund = ota_aktionen.per_tagespreis_uebertragbar({feld: wert})
        assert ok is False, feld
        assert grund == erwartet, feld


class _AktionenDB:
    """Minimal-Stub: property_discounts mit festen Zeilen."""

    def __init__(self, rows: list[dict]) -> None:
        self._rows = rows

    def table(self, _name: str) -> "_AktionenDB":
        return self

    def select(self, *_a: object, **_k: object) -> "_AktionenDB":
        return self

    def eq(self, *_a: object, **_k: object) -> "_AktionenDB":
        return self

    def execute(self) -> object:
        class _R:
            pass

        r = _R()
        r.data = self._rows  # type: ignore[attr-defined]
        return r


def test_aktionsfaktor_je_tag_nur_im_zeitraum() -> None:
    """Der Faktor senkt genau die Tage der Aufenthaltsdaten — nicht mehr."""
    from datetime import date as _d

    db = _AktionenDB(
        [
            {"discount_type": "promotion", "discount_kind": "percent",
             "discount_bps": 2000,
             "stay_ranges": [{"from": "2026-06-10", "to": "2026-06-12"}]},
        ]
    )
    f = ota_aktionen.aktionsfaktor_je_tag(
        db, "p", von=_d(2026, 6, 8), bis=_d(2026, 6, 14)
    )
    assert set(f) == {"2026-06-10", "2026-06-11", "2026-06-12"}
    assert f["2026-06-10"] == 0.8


def test_aktionsfaktor_bester_einzelrabatt_und_pauschale_draussen() -> None:
    """Kein Stacking (wie im Resolver), und eine Pauschale wird NICHT auf Nächte
    verteilt — beim Push kennt niemand die Aufenthaltsdauer (Wurzel 4)."""
    from datetime import date as _d

    db = _AktionenDB(
        [
            {"discount_type": "promotion", "discount_kind": "percent",
             "discount_bps": 500, "stay_ranges": []},
            {"discount_type": "promotion", "discount_kind": "percent",
             "discount_bps": 3000, "stay_ranges": []},
            {"discount_type": "promotion", "discount_kind": "fixed",
             "discount_amount": 50, "stay_ranges": []},
        ]
    )
    f = ota_aktionen.aktionsfaktor_je_tag(
        db, "p", von=_d(2026, 6, 1), bis=_d(2026, 6, 1)
    )
    assert f["2026-06-01"] == 0.7  # 30 %, nicht 35 %


def test_aktionsfaktor_kanal_einschraenkung() -> None:
    """Eine auf ein Portal eingeschränkte Aktion darf NICHT in den Standardpreis
    (portal=None) — den bekommen alle Kanäle ohne eigenen Plan."""
    from datetime import date as _d

    db = _AktionenDB(
        [
            {"discount_type": "promotion", "discount_kind": "percent",
             "discount_bps": 1000, "stay_ranges": [],
             "portal_scope": ["BookingCom"]},
        ]
    )
    tag = {"von": _d(2026, 6, 1), "bis": _d(2026, 6, 1)}
    assert ota_aktionen.aktionsfaktor_je_tag(db, "p", **tag) == {}
    assert ota_aktionen.aktionsfaktor_je_tag(
        db, "p", portal="BookingCom", **tag
    )["2026-06-01"] == 0.9
    assert ota_aktionen.aktionsfaktor_je_tag(db, "p", portal="AirBNB", **tag) == {}


def test_segmente_werden_an_der_aktionsgrenze_geteilt() -> None:
    """Ein Segment ist ein Zeitraum mit EINEM Preis. Gilt die Aktion nur an einem
    Teil, muss geteilt werden — sonst bekäme der Rabatt zu viele oder zu wenige
    Tage. Segmente ohne Preis (nur min_stay) bleiben unberührt."""
    from datetime import date as _d

    from src.features.channel_manager.ari_push import _aktionen_einrechnen

    segmente = [
        {"date_from": _d(2026, 6, 1), "date_to": _d(2026, 6, 4), "rate_cents": 10000},
        {"date_from": _d(2026, 7, 1), "date_to": _d(2026, 7, 2), "min_stay": 3},
    ]
    faktoren = {"2026-06-02": 0.8, "2026-06-03": 0.8}
    out = _aktionen_einrechnen(segmente, faktoren)
    preise = {
        s["date_from"].isoformat(): s.get("rate_cents")
        for s in out
        if s.get("rate_cents") is not None
    }
    assert preise == {
        "2026-06-01": 10000,
        "2026-06-02": 8000,
        "2026-06-03": 8000,
        "2026-06-04": 10000,
    }
    # Das min_stay-Segment ist unverändert durchgelaufen.
    assert {"date_from": _d(2026, 7, 1), "date_to": _d(2026, 7, 2), "min_stay": 3} in out
    # Ohne Aktionen wird NICHT aufgesplittet (keine unnötigen Channex-Werte).
    assert _aktionen_einrechnen(segmente, {}) is segmente


# --- Aktionen an die Portale: Weg 2 Airbnbs eigene Rabattregeln --------------
# Belege für die Grenzen stehen im Modul-Docstring von airbnb_aktionen.py
# (Formular-Schema des ausgelieferten Channex-Clients, 03.08.2026).


def test_airbnb_regel_je_bedingungsart() -> None:
    """Mindestaufenthalt, Frühbucher und Last Minute werden auf genau die drei
    Airbnb-`rule_type`s abgebildet — das ist der Weg, den der Tagespreis nicht
    gehen kann."""
    from src.features.channel_manager import airbnb_aktionen as aa

    basis = {"active": True, "discount_kind": "percent", "discount_bps": 2000}
    assert aa.regel_fuer_airbnb({**basis, "min_nights": 7})[0] == {
        "rule_type": aa.RULE_LOS, "price_change": 20, "threshold_one": 7,
    }
    assert aa.regel_fuer_airbnb({**basis, "lead_min_days": 60})[0] == {
        "rule_type": aa.RULE_FRUEHBUCHER, "price_change": 20, "threshold_one": 60,
    }
    assert aa.regel_fuer_airbnb({**basis, "lead_max_days": 14})[0] == {
        "rule_type": aa.RULE_LAST_MINUTE, "price_change": 20, "threshold_one": 14,
    }


def test_airbnb_regel_lehnt_ab_was_airbnb_nicht_nimmt() -> None:
    """Jede abgelehnte Form nennt ihren Grund — der speist den Chip „Manuelle
    Synchronisierung". Stilles Mitsenden wäre Geldverlust bzw. ein 422."""
    from src.features.channel_manager import airbnb_aktionen as aa

    basis = {"active": True, "discount_kind": "percent", "discount_bps": 2000}
    faelle = [
        ({**basis, "min_nights": 7, "promo_codes": ["SOMMER"]}, "angebotscode"),
        ({**basis, "min_nights": 7, "booked_to": "2026-06-30"}, "buchungszeitraum"),
        ({**basis, "min_nights": 7, "lead_max_days": 5}, "bedingungen_kombiniert"),
        (
            {**basis, "min_nights": 7,
             "stay_ranges": [{"from": "2026-06-01", "to": "2026-06-30"}]},
            "zeitraum_mit_bedingung",
        ),
        # Pauschale: Airbnb-Regeln sind prozentual.
        (
            {"active": True, "discount_kind": "fixed", "discount_amount": 50,
             "min_nights": 7},
            "pauschalbetrag",
        ),
        # 12,5 % lässt sich in `price_change` (ganze Prozent) nicht ausdrücken.
        ({**basis, "discount_bps": 1250, "min_nights": 7}, "prozent_nicht_darstellbar"),
        # Frühbucher-Vorlauf muss ein Vielfaches von 28 oder 30 Tagen sein.
        ({**basis, "lead_min_days": 45}, "vorlauf_nicht_28_30"),
        # Last Minute höchstens 28 Tage.
        ({**basis, "lead_max_days": 40}, "last_minute_ueber_28"),
        ({**basis, "active": False, "min_nights": 7}, "inaktiv"),
    ]
    for aktion, erwartet in faelle:
        regel, grund = aa.regel_fuer_airbnb(aktion)
        assert regel is None, erwartet
        assert grund == erwartet, aktion

    # Reine Zeitraum-Aktion: kein Mangel, sondern Weg 1 (Tagespreis) — deshalb
    # KEIN Grund und kein Chip.
    regel, grund = aa.regel_fuer_airbnb(
        {**basis, "stay_ranges": [{"from": "2026-06-01", "to": "2026-06-30"}]}
    )
    assert regel is None and grund is None


def test_airbnb_regel_beachtet_preismodell_des_listings() -> None:
    """Der Längenrabatt existiert nur im Standard-Preismodell; im Rate-Plan-Modell
    kennt Airbnb überhaupt keine Regeln."""
    from src.features.channel_manager import airbnb_aktionen as aa

    basis = {"active": True, "discount_kind": "percent", "discount_bps": 1000}
    assert aa.regel_fuer_airbnb(
        {**basis, "min_nights": 7}, preismodell=aa.MODELL_LOS
    ) == (None, "airbnb_preismodell")
    assert aa.regel_fuer_airbnb(
        {**basis, "lead_max_days": 7}, preismodell=aa.MODELL_LOS
    )[0] is not None
    assert aa.regel_fuer_airbnb(
        {**basis, "lead_max_days": 7}, preismodell=aa.MODELL_RATE_PLAN
    ) == (None, "airbnb_preismodell")


def test_airbnb_regeln_bester_einzelrabatt_und_kanal_scope() -> None:
    """Je Regelart genau EINE Regel: bei zwei Kandidaten gewinnt der höhere
    Rabatt (kein Stacking, wie im Resolver). Eine auf andere Kanäle
    eingeschränkte Aktion kommt gar nicht vor."""
    from src.features.channel_manager import airbnb_aktionen as aa

    aktionen = [
        {"id": "a", "active": True, "discount_kind": "percent",
         "discount_bps": 1000, "min_nights": 7},
        {"id": "b", "active": True, "discount_kind": "percent",
         "discount_bps": 2500, "min_nights": 7},
        {"id": "c", "active": True, "discount_kind": "percent",
         "discount_bps": 3000, "min_nights": 7, "portal_scope": ["BookingCom"]},
        {"id": "d", "active": True, "discount_kind": "percent",
         "discount_bps": 1500, "lead_max_days": 7},
    ]
    regeln, gruende = aa.regeln_fuer_listing(
        aktionen, preismodell=aa.MODELL_STANDARD
    )
    assert regeln == [
        {"rule_type": aa.RULE_LOS, "price_change": 25, "threshold_one": 7},
        {"rule_type": aa.RULE_LAST_MINUTE, "price_change": 15, "threshold_one": 7},
    ]
    assert gruende == {}


def test_airbnb_listing_regeln_schreiben_nur_bei_aenderung() -> None:
    """Idempotenz (Wurzel 2): steht der Soll-Stand schon drin, wird NICHT
    geschrieben. Und ein PUT nimmt den vollen Ist-Stand mit, damit es die
    Steuer-/Gebühren-Einstellungen des Listings nicht abräumt (Wurzel 1)."""
    from src.features.channel_manager.airbnb_aktionen import (
        RULE_LOS,
        AirbnbAktionenMixin,
    )

    regel = {"rule_type": RULE_LOS, "price_change": 20, "threshold_one": 7}

    class _Channex:
        def __init__(self, vorhandene: list[dict]) -> None:
            self.ist = {
                "data": {
                    "attributes": {
                        "id": "map-1",
                        "currency": "DKK",
                        "pass_through_taxes": [{"tax_type": "pass_through_vat_gst"}],
                        "default_pricing_rules": vorhandene,
                    }
                }
            }
            self.puts: list[dict] = []

        def get_listing_pricing_settings(self, _channel: str, _mapping: str) -> dict:
            return self.ist

        def update_listing_pricing_settings(
            self, _channel: str, _mapping: str, settings: dict
        ) -> dict:
            self.puts.append(settings)
            return {"data": {"attributes": settings}}

    class _Service(AirbnbAktionenMixin):
        def __init__(self, channex: _Channex) -> None:
            self._channex = channex

    unveraendert = _Channex([regel])
    svc = _Service(unveraendert)
    assert svc._listing_regeln_setzen("ch", "map-1", [regel]) is False
    assert unveraendert.puts == []

    leer = _Channex([])
    svc = _Service(leer)
    assert svc._listing_regeln_setzen("ch", "map-1", [regel]) is True
    assert leer.puts[0]["default_pricing_rules"] == [regel]
    # Fremde Felder bleiben erhalten, die Kennung geht NICHT mit in den PUT.
    assert leer.puts[0]["currency"] == "DKK"
    assert leer.puts[0]["pass_through_taxes"] == [
        {"tax_type": "pass_through_vat_gst"}
    ]
    assert "id" not in leer.puts[0]


def test_abgaben_status_aktion_geht_bei_airbnb_ueber_die_regel() -> None:
    """Eine Frühbucher-Aktion ist bei Airbnb NICHT „manuell" (dort trägt sie die
    Rabattregel), bei Booking.com aber schon — der Chip muss je Portal
    unterscheiden."""

    class _DB:
        def table(self, _name: str) -> "_DB":
            return self

        def select(self, *_a: object, **_k: object) -> "_DB":
            return self

        def eq(self, *_a: object) -> "_DB":
            return self

        def execute(self) -> object:
            return type(
                "R", (), {"data": [
                    {"id": "akt-1", "discount_type": "early_booker",
                     "discount_kind": "percent", "discount_bps": 2000,
                     "lead_min_days": 60, "active": True},
                ]},
            )()

    class _Service(AbgabenStatusMixin):
        pass

    posten = _Service()._aktionen_status(_DB(), "t", "p", ["AirBNB", "BookingCom"])
    assert posten[0]["manual_portals"] == ["BookingCom"]
    # `reason` erklärt, warum der TAGESPREIS sie nicht trägt (das betrifft
    # Booking.com); `airbnb_reason` bleibt leer, weil Airbnb sie sehr wohl nimmt.
    assert posten[0]["reason"] == "fruehbucher"
    assert posten[0]["airbnb_reason"] is None


def test_preisblock_status_trennt_portalfaehig_von_nur_eigenen() -> None:
    """Die Editor-Kopfzeile „Gilt für · Nicht unterstützt von" hängt an dieser
    einen Antwort. Grundpreis und Gast-Aufschlag gehen an jeden verbundenen
    Kanal (ARI-Push bzw. `per_person`-Rate-Plan); Kurzaufenthalt und Extras
    hängen an der Aufenthaltslänge bzw. sind dazubuchbar — dafür hat kein Portal
    ein Feld."""
    from src.features.channel_manager.abgaben_status import preisblock_status

    status = {p["key"]: p for p in preisblock_status()}
    assert set(status) == {"base_price", "extra_guest", "short_stay", "addons"}
    assert status["base_price"]["internal_only"] is False
    assert status["extra_guest"]["internal_only"] is False
    for key in ("short_stay", "addons"):
        assert status[key]["internal_only"] is True
    # Ein Block wird NIE „von Hand im Extranet gepflegt" — dort gibt es kein Feld.
    assert all(not p["manual_portals"] for p in status.values())


def test_laengenpreis_mechanik_geht_an_airbnb_und_sonst_manuell() -> None:
    """Preise nach Aufenthaltsdauer gehen SEHR WOHL an die Portale — über Airbnbs
    eigene Rabattregel. Jedes andere Portal hat dafür kein Feld: dort muss der
    Wochenpreis im Extranet gepflegt werden. Das ist die Aussage der Kopfzeile im
    Editor, wo die Zeile noch keine Kennung hat."""
    from src.features.channel_manager.abgaben_status import laengenpreis_mechanik

    posten = laengenpreis_mechanik(["AirBNB", "BookingCom", "Expedia"])
    assert posten["key"] == "length_prices"
    assert posten["internal_only"] is False
    assert posten["manual_portals"] == ["BookingCom", "Expedia"]


def test_laengenpreis_prozent_rundet_ab_und_meldet_undarstellbares() -> None:
    """Airbnb nimmt nur ganze Prozent. Abwärts runden, damit dort nie billiger
    verkauft wird als eingestellt; bleibt 0 % übrig, wird NICHTS gesendet."""
    from src.features.channel_manager.airbnb_aktionen import (
        aktion_aus_laengenpreis,
        laengenpreis_prozent,
        regel_fuer_airbnb,
    )

    # 405 von 450 = genau 10 % Rabatt.
    assert laengenpreis_prozent(405, 450) == 10
    # 410 von 450 = 8,88 % → 8 % (abwärts, nie aufwärts).
    assert laengenpreis_prozent(410, 450) == 8
    # Kein Grundpreis, Aufschlag statt Rabatt, oder unter 1 % → nicht darstellbar.
    assert laengenpreis_prozent(405, 0) is None
    assert laengenpreis_prozent(500, 450) is None
    assert laengenpreis_prozent(449, 450) is None

    # Als Aktions-Zeile läuft der Längenpreis durch dieselbe Airbnb-Pipeline.
    regel, grund = regel_fuer_airbnb(
        aktion_aus_laengenpreis({"id": "lp1", "minNights": 7, "pricePerNight": 405}, 450)
    )
    assert grund is None
    assert regel == {
        "rule_type": "STAYED_AT_LEAST_X_DAYS", "price_change": 10, "threshold_one": 7
    }
    # Ohne darstellbaren Prozentsatz kommt KEINE Regel, sondern der Grund.
    regel, grund = regel_fuer_airbnb(
        aktion_aus_laengenpreis({"id": "lp2", "minNights": 7, "pricePerNight": 449}, 450)
    )
    assert regel is None
    assert grund == "prozent_nicht_darstellbar"


def test_facility_katalog_ist_eindeutig_und_vollstaendig() -> None:
    """Formprüfung des Facility-Katalogs — der Wächter für einen stillen Ausfall.

    Am 13.08.2026 waren ALLE 301 hinterlegten UUIDs veraltet: Channex quittiert
    unbekannte Facility-IDs mit HTTP 200 und verwirft sie still, also hatte kein
    einziges Objekt dort Ausstattung, ohne dass je ein Fehler sichtbar wurde.

    Dieser Test kann die Gültigkeit gegen Channex NICHT prüfen (kein Netz im
    Test) — er hält nur fest, was ohne Netz feststellbar ist: 301 Einträge,
    saubere UUID-Form, keine doppelte ID. Eine doppelte ID hieße, dass zwei
    Slugs auf dieselbe Facility zeigen — genau der Fehler, der beim Erneuern des
    Katalogs per Position (statt per Titel) entstünde.
    """
    import re as _re

    from src.features.channel_manager.common import _CHANNEX_FACILITY

    assert len(_CHANNEX_FACILITY) == 301
    uuid_form = _re.compile(r"^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$")
    kaputt = [s for s, i in _CHANNEX_FACILITY.items() if not uuid_form.match(i)]
    assert kaputt == []
    doppelt = len(_CHANNEX_FACILITY) - len(set(_CHANNEX_FACILITY.values()))
    assert doppelt == 0
