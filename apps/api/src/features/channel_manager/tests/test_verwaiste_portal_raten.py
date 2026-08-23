"""Geloeschte Portal-Raten duerfen nicht im Kanal-Mapping stehen bleiben.

Live gemessen am 23.08.2026: der Booking-Kanal von „Rævlingehuset" fuehrte zwei
Eintraege (Codes 45621028 und 45627350), `POST /channels/mapping_details` gab
aber nur noch 45621028 zurueck. Ueber den verwaisten Code kam um 11:46 eine
1-NACHT-Buchung (1.820 DKK, 28.–29.05.2027) an einem Objekt mit
Mindestaufenthalt 3: Verfuegbarkeit floss weiter, Restriktionen erreichten
diesen Code nie (er war nicht `primary_occ`).

Dieselbe Abweichung an „Feriehus Line" (65900673 vs. zusaetzlich 65900767) und
„Feriehus \"Perlen\" Tversted" (55775627 vs. zusaetzlich 63942112).
"""
from __future__ import annotations

from typing import Any

from src.features.channel_manager.verwaiste_raten import (
    ohne_verwaiste,
    portal_ratencodes,
    verwaiste_eintraege,
)

# Wie live: Booking fuehrt EINE Rate am Zimmer.
OTA_ROOMS_EINE_RATE: list[dict[str, Any]] = [
    {
        "id": 1220760101,
        "title": "Three-Bedroom House",
        "rates": [{"id": 45621028, "title": "Standard Rate"}],
    }
]

# Wie live: der Kanal hat ZWEI Eintraege, beide auf denselben lokalen Plan.
KANAL_MIT_VERWAISTEM_CODE: list[dict[str, Any]] = [
    {
        "rate_plan_id": "51e29abe-35d4-4006-b1f1-79be1b5c39a9",
        "settings": {"room_type_code": 1220760101, "rate_plan_code": 45621028,
                     "primary_occ": True},
    },
    {
        "rate_plan_id": "51e29abe-35d4-4006-b1f1-79be1b5c39a9",
        "settings": {"room_type_code": 1220760101, "rate_plan_code": 45627350,
                     "primary_occ": False},
    },
]


def test_portal_ratencodes_liest_alle_raten() -> None:
    ota = [
        {"id": 1, "rates": [{"id": 45621028}, {"id": 45627350}]},
        {"id": 2, "rates": [{"id": 999}]},
    ]
    assert portal_ratencodes(ota) == {"45621028", "45627350", "999"}


def test_codes_werden_als_string_verglichen() -> None:
    """Channex liefert int (Booking) oder str (Sandbox) — ein Typvergleich
    haette JEDEN Code als verwaist gemeldet und das Mapping abgeraeumt."""
    ota = [{"id": 1, "rates": [{"id": 45621028}]}]  # int
    kanal = [{"rate_plan_id": "x",
              "settings": {"rate_plan_code": "45621028"}}]  # str
    assert verwaiste_eintraege(kanal, portal_ratencodes(ota)) == []


def test_verwaister_code_wird_erkannt() -> None:
    verwaist = verwaiste_eintraege(
        KANAL_MIT_VERWAISTEM_CODE, portal_ratencodes(OTA_ROOMS_EINE_RATE)
    )
    assert len(verwaist) == 1
    assert verwaist[0]["settings"]["rate_plan_code"] == 45627350


def test_ohne_verwaiste_behaelt_die_gefuehrte_rate() -> None:
    uebrig = ohne_verwaiste(
        KANAL_MIT_VERWAISTEM_CODE, OTA_ROOMS_EINE_RATE,
        tenant_id="t", portal_code="BookingCom",
    )
    assert [e["settings"]["rate_plan_code"] for e in uebrig] == [45621028]


def test_zwei_gefuehrte_raten_bleiben_beide() -> None:
    """Fuehrt das Portal wirklich zwei Raten (Standard + Wochenrate, live bei
    fuenf Objekten), ist KEINE davon verwaist — auch wenn beide auf denselben
    lokalen Plan zeigen."""
    ota = [{"id": 1220760101,
            "rates": [{"id": 45621028}, {"id": 45627350}]}]
    uebrig = ohne_verwaiste(
        KANAL_MIT_VERWAISTEM_CODE, ota,
        tenant_id="t", portal_code="BookingCom",
    )
    assert len(uebrig) == 2


def test_leerer_abruf_raeumt_nichts_ab() -> None:
    """Ein `mapping_details` ohne Raten ist ein FEHLGESCHLAGENER Abruf, kein
    Portal ohne Raten. Wer daraus „alles verwaist" ableitet, loescht bei jeder
    Stoerung das ganze Mapping (fail-closed, Wurzel 5)."""
    assert verwaiste_eintraege(KANAL_MIT_VERWAISTEM_CODE, set()) == []
    uebrig = ohne_verwaiste(
        KANAL_MIT_VERWAISTEM_CODE, [], tenant_id="t", portal_code="BookingCom"
    )
    assert len(uebrig) == 2


def test_airbnb_eintraege_ohne_ratencode_bleiben() -> None:
    """Airbnb mappt ueber `listing_id`, nicht ueber Raten — solche Eintraege
    haben keinen `rate_plan_code` und duerfen nie als verwaist gelten."""
    kanal = [{"rate_plan_id": "x", "settings": {"listing_id": "1654285285861524234"}}]
    ota = [{"id": 1, "rates": [{"id": 45621028}]}]
    assert verwaiste_eintraege(kanal, portal_ratencodes(ota)) == []


def test_merge_behaelt_zwei_raten_auf_einem_plan() -> None:
    """`_merge_channel_rate_plans` dedupliziert auf dem OTA-PAAR, nicht auf
    unserer rate_plan_id.

    Vorher lief `seen` ueber die rate_plan_id. Weil mehrere Portal-Raten bewusst
    auf denselben lokalen Plan zeigen duerfen (ein Ferienobjekt hat EINEN Preis,
    eine Booking-Kennung fuehrt regelmaessig zwei Raten), verwarf der Merge
    jede zweite Rate stillschweigend — sie stand nie im Kanal und bekam damit
    auch nie eine Restriktion. Live betroffen: fuenf Objekte mit
    „Standard Rate" + „Wochenrate".
    """
    from src.features.channel_manager.channels import ChannelsMixin

    class _Channex:
        is_configured = True

        @staticmethod
        def get_channel(_cid: str) -> dict[str, Any]:
            return {"data": {"attributes": {"rate_plans": [
                {"rate_plan_id": "PLAN", "settings": {
                    "room_type_code": 1220760101, "rate_plan_code": 45621028}},
            ]}}}

    mixin = ChannelsMixin.__new__(ChannelsMixin)
    mixin._channex = _Channex()  # type: ignore[attr-defined]

    # Zweite Portal-Rate, GLEICHER lokaler Plan, anderer Ratencode.
    neu = [{"rate_plan_id": "PLAN", "settings": {
        "room_type_code": 1220760101, "rate_plan_code": 45627350}}]
    ota = [{"id": 1220760101,
            "rates": [{"id": 45621028}, {"id": 45627350}]}]

    merged = mixin._merge_channel_rate_plans(
        "CH", neu, ota_rooms=ota, tenant_id="t", portal_code="BookingCom"
    )
    codes = sorted(str(e["settings"]["rate_plan_code"]) for e in merged)
    assert codes == ["45621028", "45627350"], merged


def test_merge_bleibt_idempotent() -> None:
    """Derselbe Eintrag zweimal bleibt EIN Eintrag (Wurzel 2) — die Dedup auf
    dem Paar darf die Idempotenz nicht verlieren."""
    from src.features.channel_manager.channels import ChannelsMixin

    class _Channex:
        is_configured = True

        @staticmethod
        def get_channel(_cid: str) -> dict[str, Any]:
            return {"data": {"attributes": {"rate_plans": [
                {"rate_plan_id": "PLAN", "settings": {
                    "room_type_code": 1220760101, "rate_plan_code": 45621028}},
            ]}}}

    mixin = ChannelsMixin.__new__(ChannelsMixin)
    mixin._channex = _Channex()  # type: ignore[attr-defined]
    gleich = [{"rate_plan_id": "PLAN", "settings": {
        "room_type_code": 1220760101, "rate_plan_code": 45621028}}]
    ota = [{"id": 1220760101, "rates": [{"id": 45621028}]}]
    merged = mixin._merge_channel_rate_plans(
        "CH", gleich, ota_rooms=ota, tenant_id="t", portal_code="BookingCom"
    )
    assert len(merged) == 1
