"""Verwaiste Portal-Raten im Kanal-Mapping erkennen und aussortieren.

Ein Kanal-Mapping ordnet jeder Rate des Portals (`rate_plan_code`) einen
unserer Preisplaene zu. Geschrieben wird es beim Verbinden — und danach nie
wieder gegen das Portal geprueft. Loescht der Betrieb im Extranet eine Rate,
bleibt ihr Code bei uns im Mapping stehen.

Das ist nicht bloss unordentlich, es verkauft. Live gemessen (23.08.2026):

  Objekt                     Booking fuehrt   unser Kanal hat zusaetzlich
  Rævlingehuset              45621028         45627350
  Feriehus Line              65900673         65900767
  Feriehus "Perlen" Tversted 55775627         63942112

Ueber genau so einen Code kam am 23.08. um 11:46 eine 1-NACHT-Buchung an
Rævlingehuset (1.820 DKK, 28.–29.05.2027) — Code 45627350, den
`POST /channels/mapping_details` nicht mehr zurueckgibt. Restriktionen
erreichten diesen Code nie (er war nicht `primary_occ`), waehrend die
Verfuegbarkeit weiter floss: eine Rate, die verkauft, aber keine Regel kennt.

Wurzel 1 (Gegenzustand): wer Zuordnungen neu setzt, muss die freigewordenen
alten pflegen. Diese Datei ist dieser Gegenzustand.

SEIT DEM 24.08.2026 WIRD AUCH GELOESCHT — und zwar am Kanal, nicht im Extranet.
Der Modul-Kopf sagte hier bis dahin das Gegenteil („der Abgleich MELDET, und der
Betrieb entscheidet"). Das war richtig, solange ein verwaister Eintrag nur
unordentlich war. Er ist es nicht: Booking.com lehnt die GANZE Preis-Nachricht
ab, sobald sie eine nicht mehr gefuehrte Rate nennt. Gemessen am 24.08.2026
02:02 (Channel Action View, „Feriehus Line", Hotel 11659051, Zimmer
1165905102) — zwei `RateAmountMessage`, 65900673 gueltig und 65900767 verwaist:

    <Error Code="RATE_NOT_ACTIVE_FOR_ROOM"
           ShortText="Rate '65900767' is not active for room '1165905102'"/>
    Result: Failure

Damit verlieren ALLE Raten des Zimmers ihre Preise, nicht nur die verwaiste. Der
Mindestaufenthalt-Push derselben Aktion (`OTA_HotelAvailNotif`, eigene
Nachricht) lief mit `<Success/>` durch — nur die Preis-Nachricht nennt die Raten
namentlich. Das Stehenlassen ist ab hier der Eingriff, das Loeschen der
Gegenzustand (Wurzel 1).

Zwei Grenzen bleiben unveraendert:
* Geloescht wird ausschliesslich UNSER Kanal-Mapping bei Channex
  (`DELETE channels/{id}/mappings/{mapping_id}`), NIE etwas im Extranet des
  Portals. Die Rate hat der Betrieb dort selbst entfernt; wir ziehen nach.
* Ein `mapping_details` ohne Raten loescht NICHTS. Ein eingeschraenkt
  antwortender Abruf ist kein Portal ohne Raten — siehe `verwaiste_eintraege`.
Der loeschende Pfad steht in
`portal_raten_abgleich._verwaiste_kanal_eintraege_entfernen`.
"""
from __future__ import annotations

from typing import Any

from src.core.logging import get_logger

log = get_logger(__name__)


def portal_ratencodes(ota_rooms: list[dict[str, Any]]) -> set[str]:
    """Alle Ratencodes, die das Portal aktuell fuehrt — als Strings.

    Vergleichsschluessel ist bewusst der String: Channex liefert die Codes je
    OTA als int (Booking) oder str (Sandbox), und ein Typvergleich haette
    jeden Code als verwaist gemeldet.
    """
    codes: set[str] = set()
    for room in ota_rooms or []:
        for rate in room.get("rates") or []:
            code = rate.get("id")
            if code is not None:
                codes.add(str(code))
    return codes


def verwaiste_eintraege(
    rate_plans: list[dict[str, Any]], portal_codes: set[str]
) -> list[dict[str, Any]]:
    """Die Mapping-Eintraege, deren `rate_plan_code` das Portal nicht mehr fuehrt.

    Leere `portal_codes` geben LEER zurueck, nicht alles: ein Abruf ohne Raten
    ist ein fehlgeschlagener Abruf, kein Portal ohne Raten. Wer daraus
    "alles verwaist" ableitete, raeumte bei jeder Stoerung das ganze Mapping ab
    (fail-closed, Wurzel 5).
    """
    if not portal_codes:
        return []
    verwaist: list[dict[str, Any]] = []
    for eintrag in rate_plans or []:
        settings = eintrag.get("settings") or {}
        code = settings.get("rate_plan_code")
        if code is None:
            continue  # Airbnb & Co. mappen ueber listing_id, nicht ueber Raten
        if str(code) not in portal_codes:
            verwaist.append(eintrag)
    return verwaist


def ohne_verwaiste(
    rate_plans: list[dict[str, Any]], ota_rooms: list[dict[str, Any]],
    *, tenant_id: str, portal_code: str,
) -> list[dict[str, Any]]:
    """`rate_plans` ohne die Eintraege, die das Portal nicht mehr fuehrt.

    Wird beim additiven PUT gebraucht: dort werden die bestehenden Eintraege
    mitgesendet, weil Channex das Array ERSETZT. Ohne diesen Filter schleppt
    jeder weitere Kanal-Schreibvorgang die verwaisten Codes mit.

    Jeder aussortierte Eintrag wird geloggt — ein stilles Verschwinden waere
    dieselbe Unsichtbarkeit wie das stille Mitschleppen.
    """
    portal_codes = portal_ratencodes(ota_rooms)
    verwaist = verwaiste_eintraege(rate_plans, portal_codes)
    if not verwaist:
        return list(rate_plans or [])
    for eintrag in verwaist:
        settings = eintrag.get("settings") or {}
        log.warning(
            "kanal_verwaiste_portal_rate_ausgelassen",
            tenant_id=tenant_id, portal=portal_code,
            rate_plan_code=settings.get("rate_plan_code"),
            room_type_code=settings.get("room_type_code"),
            primary_occ=settings.get("primary_occ"),
            portal_fuehrt=sorted(portal_codes),
        )
    verwaiste_ids = {id(e) for e in verwaist}
    return [e for e in (rate_plans or []) if id(e) not in verwaiste_ids]


def verwaiste_mit_mapping_id(
    rate_plans: list[dict[str, Any]], portal_codes: set[str]
) -> list[tuple[str, dict[str, Any]]]:
    """Die verwaisten Eintraege, die sich UEBERHAUPT loeschen lassen.

    `[(mapping_id, settings), ...]`. Die `mapping_id` steht ausschliesslich im
    Kanal-Objekt unter `attributes.rate_plans[].id` — es gibt keinen GET-Pfad
    fuer Mappings (siehe `channex_client.delete_channel_mapping`). Ein Eintrag
    ohne diese `id` ist nicht loeschbar; er wird geloggt und ausgelassen, statt
    einen geratenen Pfad zu bauen (Wurzel 4).
    """
    loeschbar: list[tuple[str, dict[str, Any]]] = []
    for eintrag in verwaiste_eintraege(rate_plans, portal_codes):
        settings = eintrag.get("settings") or {}
        mapping_id = str(eintrag.get("id") or "")
        if not mapping_id:
            log.warning(
                "kanal_verwaiste_rate_ohne_mapping_id",
                rate_plan_code=settings.get("rate_plan_code"),
                room_type_code=settings.get("room_type_code"),
                rate_plan_id=eintrag.get("rate_plan_id"),
            )
            continue
        loeschbar.append((mapping_id, settings))
    return loeschbar
