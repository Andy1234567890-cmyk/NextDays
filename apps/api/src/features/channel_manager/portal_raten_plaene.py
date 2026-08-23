"""Fuer jede Portal-Rate einen eigenen Preisplan — statt mehrere auf einen.

Booking.com fuehrt Restriktionen auf RATE-Ebene, nicht auf Zimmer-Ebene
(SiteMinder-Doku zum selben OTA-Protokoll: „Restrictions are set at the room
rate level, while availability is set at the room type level … Each rate plan
can have independent restrictions"). Jede Rate braucht deshalb ihre eigene
Zeile mit eigenem Mindestaufenthalt.

Vorher legte `_build_rate_plans` jede ueberzaehlige Portal-Rate auf den ERSTEN
Preisplan (`pairs += [(rate, selected[0]) …]`). Zwei Folgen, beide live belegt
am 23.08.2026:

  1. In unserer Oberflaeche war die zweite Rate unsichtbar. Der Betrieb fuehrt
     bei Booking eine „Wochenrate" fuer den Wochenrabatt; unter „Preise" stand
     nur „Grundpreis", weil es bei uns keinen zweiten Plan gab.
  2. Nur EIN Eintrag je Plan trug `primary_occ` und damit die Restriktionen.
     Im Extranet-Kalender von „Rævlingehuset" stand an der Standard Rate
     min_stay 3 in jeder Spalte, an der Wochenrate LEER — und ueber diese Rate
     kam um 11:46 eine 1-NACHT-Buchung (1.820 DKK, 28.–29.05.2027).

Gegenprobe im selben Bestand: bei „FeWo *Stjerneskud*" ist die Wochenrate
(Code 63941996) mit `primary_occ: True` gemappt, und dort zeigt das Extranet
die 2 auf BEIDEN Raten. Es ist also genau die fehlende eigene Zuordnung.

WAS DIESES MODUL TUT: es legt fuer eine Portal-Rate ohne eigenen Preisplan
einen an — Name aus dem Portal-Titel, Preis und Mindestaufenthalt vom
Grundpreis geerbt (kein erfundener Wert, Wurzel 4), `send_to_portals` gesetzt,
weil die Rate beim Portal ohnehin schon verkauft.

WAS ES NICHT TUT: Raten beim Portal anlegen oder loeschen. Die Raten existieren
dort bereits (der Betrieb hat sie im Extranet gebaut — belegt: ihre Codes
erscheinen im Channex-Protokoll ausschliesslich in ANTWORTEN, in keinem
Request-Body). Wir bilden sie nach, wir erzeugen sie nicht.
"""
from __future__ import annotations

from typing import Any

from supabase import Client

from src.core.logging import get_logger

log = get_logger(__name__)

# Obergrenze je Zimmer. Booking-Kennungen fuehren real zwei bis drei Raten
# (Standard, Wochenrate, non-refundable); ein Abruf, der Dutzende liefert, ist
# ein Fehler und darf nicht Dutzende Plaene anlegen (Wurzel 8: jeder unbegrenzte
# Bereich bekommt eine harte Obergrenze).
MAX_PLAENE_JE_ZIMMER = 6

# Portal-Raten, deren Titel eine Wochen- oder Monatsrate benennt, bekommen den
# dazu gehoerenden Mindestaufenthalt statt den des Grundpreises.
#
# Belegt (partner.booking.com, „Setting up weekly rate plans for extended
# stays"): eine Wochenrate ist bei Booking ein EIGENER Ratenkategorie-Typ
# („Add new rate plan -> Weekly"), und sie erscheint Gaesten, die „stays of
# seven nights or more" suchen. Booking hat KEINEN separaten Wochenrabatt-
# Schalter: „To encourage more guests to book longer stays, you can set up
# discounts through a Weekly or Monthly Rate Plan." Der Mindestaufenthalt IST
# die Mechanik dieser Rate.
#
# Ohne das erbte eine „Wochenrate" den Mindestaufenthalt des Grundpreises
# (real 2 oder 3 Naechte) und waere damit keine Wochenrate, sondern ein
# zweiter Standardpreis — genau der Zustand, der live gemessen wurde: bei
# „FeWo *Stjerneskud*" traegt die Wochenrate denselben Preis (605 DKK) und
# denselben min_stay (2) wie die Standard Rate.
#
# Nur Titel-Erkennung, kein Raten: trifft kein Wort, bleibt der Grundwert.
_WOCHE_WOERTER = ("wochen", "weekly", "week", "uge", "ugentlig", "semana")
_MONAT_WOERTER = ("monats", "monatlich", "monthly", "month", "maaned", "måned")
WOCHE_NAECHTE = 7
MONAT_NAECHTE = 30


def min_stay_aus_titel(portal_titel: str | None) -> int | None:
    """7 bei einer Wochenrate, 30 bei einer Monatsrate, sonst None.

    None heisst „nicht erkannt" und laesst den Grundwert gelten — kein
    geratener Mindestaufenthalt (Wurzel 4).
    """
    titel = (portal_titel or "").strip().lower()
    if not titel:
        return None
    if any(w in titel for w in _MONAT_WOERTER):
        return MONAT_NAECHTE
    if any(w in titel for w in _WOCHE_WOERTER):
        return WOCHE_NAECHTE
    return None


def _plan_name(
    portal_titel: str | None, code: int | str, portal_label: str
) -> str:
    """Der Plan traegt den Namen der Portal-Rate, damit der Betrieb ihn im
    Extranet wiedererkennt („Wochenrate" heisst bei uns „Wochenrate").
    Ohne Titel der Code — nie ein erfundener Name."""
    titel = (portal_titel or "").strip()
    if titel:
        return titel
    return f"{portal_label} Rate {code}"


def plan_fuer_portal_rate(
    db: Client, *, property_id: str, grundpreis: dict[str, Any],
    portal_titel: str | None, rate_code: int | str, portal_label: str,
) -> str | None:
    """Einen Preisplan fuer eine Portal-Rate anlegen; gibt seine ID zurueck.

    Erbt Preis, Waehrung und Mindestaufenthalt vom Grundpreis: die Rate verkauft
    beim Portal bereits zu diesem Preis (im Extranet-Kalender tragen Standard-
    und Wochenrate denselben Betrag), und ein abweichender Startwert waere eine
    Behauptung ueber den Verkauf, die niemand getroffen hat. Der Betrieb passt
    ihn danach unter „Preise" an — dafuer ist der Plan da.

    None bei Fehlschlag: eine fehlende Plan-Zeile darf den Kanal-Aufbau nicht
    kippen (der Aufrufer faellt dann auf den Grundpreis zurueck wie bisher).
    """
    name = _plan_name(portal_titel, rate_code, portal_label)
    # Eine Wochen-/Monatsrate traegt ihren eigenen Mindestaufenthalt (7 bzw. 30),
    # sonst gilt der des Grundpreises.
    min_stay = min_stay_aus_titel(portal_titel) or grundpreis.get("min_stay")
    payload = {
        "property_id": property_id,
        "name": name,
        "base_price": grundpreis.get("base_price"),
        "currency": grundpreis.get("currency"),
        "min_stay": min_stay,
        # `manual` und OHNE parent_rate_plan_id — bewusst. Mit einem Parent
        # stehen bei Channex `inherit_rate` und `inherit_min_stay_arrival`
        # standardmaessig auf true (Doku rate-plans-collection), und die
        # Wochenrate truege zwangsweise Preis und Mindestaufenthalt der
        # Elternrate. Genau das ist der Zustand, der behoben werden soll.
        "rate_mode": "manual",
        # Die Rate verkauft beim Portal schon — sie muss dorthin gesendet
        # werden, sonst bekommt sie weiterhin keine Restriktionen.
        "send_to_portals": True,
    }
    try:
        ins = (db.table("rate_plans").insert(payload).execute()).data or []
    except Exception as exc:  # noqa: BLE001 — Kanal-Aufbau darf nicht kippen
        log.error(
            "portal_rate_plan_anlegen_fehlgeschlagen",
            property_id=property_id, rate_code=rate_code, error=str(exc)[:200],
        )
        return None
    if not ins:
        log.error(
            "portal_rate_plan_leer_zurueck",
            property_id=property_id, rate_code=rate_code,
        )
        return None
    plan_id = str(ins[0].get("id"))
    log.info(
        "portal_rate_plan_angelegt",
        property_id=property_id, rate_plan_id=plan_id,
        name=name, rate_code=rate_code,
    )
    return plan_id


def vorhandene_plan_namen(
    db: Client, property_id: str
) -> dict[str, str]:
    """{name_klein: plan_id} der Plaene eines Objekts — fuer Idempotenz.

    Wurzel 2: der Kanal-Aufbau laeuft mehrfach (erneutes Verbinden, additiver
    PUT, Reconnect). Ohne diesen Abgleich entstuende bei jedem Lauf ein weiterer
    „Wochenrate"-Plan.
    """
    try:
        rows = (
            db.table("rate_plans")
            .select("id, name")
            .eq("property_id", property_id)
            .execute()
        ).data or []
    except Exception as exc:  # noqa: BLE001 — leer heisst "nichts wiederverwenden"
        log.warning(
            "portal_rate_plan_namen_unlesbar",
            property_id=property_id, error=str(exc)[:200],
        )
        return {}
    return {
        str(r.get("name") or "").strip().lower(): str(r.get("id"))
        for r in rows
        if r.get("id") and r.get("name")
    }


def paar_fuer_portal_plan(
    bestand: list[dict[str, Any]], plan_name: str,
    *, portal_titel_je_code: dict[str, str],
) -> dict[str, Any] | None:
    """Das EINE OTA-Paar (Zimmer + Rate), das diesem Portal-Plan gehoert.

    DER GEGENZUSTAND ZU `plan_fuer_portal_rate` (Wurzel 1). Der Plan entsteht
    beim Kanal-Aufbau ohne Channex-ID; registriert wird er erst durch den
    Content-Sync, und danach ordnet `freigegebene_plaene_zuordnen` ihn am Kanal
    zu. Genau dort fehlte die Zuordnungs-REGEL: dieser Weg legt einen
    freigegebenen Plan auf JEDES Paar des Zimmers, weil er fuer den
    Portal-Aufschlag gebaut wurde — der gilt fuer das ganze Zimmer.

    Fuer einen Portal-Raten-Plan ist das falsch, und zwar genau verkehrt herum.
    Nachgerechnet an der Live-Lage (Rævlingehuset, Zimmer 1220760101, Raten
    45621028 „Standard Rate" und 45627350 „Wochenrate"): der Wochen-Plan mit
    min_stay 7 laege danach AUCH auf der Standard Rate. Booking verkaufte die
    Standard-Rate dann erst ab sieben Naechten — der Schaden waere groesser als
    der behobene. Zusaetzlich verletzt es Channex' Eindeutigkeit
    („One OTA room+rate pair should map to at most one local rate plan"): das
    Paar 1220760101/45621028 trueg zwei lokale Plaene.

    ZUORDNUNGS-SCHLUESSEL ist der Rate-TITEL, nicht die Reihenfolge: der Plan
    heisst genau wie die Rate im Extranet (`_plan_name`), und der Titel steht je
    Code in `portal_titel_je_code` (aus `POST /channels/mapping_details`).
    Ueber die Reihenfolge zu gehen waere ein Ratespiel — Channex garantiert
    keine, und ein Fehlgriff verschiebt Restriktionen auf die falsche Rate.

    None heisst „kein Paar sicher zuordenbar" → der Aufrufer laesst die
    Zuordnung LIEBER GANZ (fail-closed, Wurzel 5). Eine ungemappte Rate ist
    ein sichtbarer Zustand, den der Betrieb im Kanal sieht; eine auf die
    falsche Rate gelegte Restriktion ist unsichtbar und verkauft falsch.
    """
    gesucht = (plan_name or "").strip().lower()
    if not gesucht:
        return None
    passende = [
        code for code, titel in (portal_titel_je_code or {}).items()
        if (titel or "").strip().lower() == gesucht
    ]
    if len(passende) != 1:
        # Kein Treffer oder MEHRERE Raten desselben Titels — in beiden Faellen
        # ist nicht entscheidbar, welche gemeint ist.
        log.warning(
            "portal_plan_paar_nicht_eindeutig",
            plan_name=plan_name, treffer=sorted(passende),
            portal_codes=sorted(portal_titel_je_code or {}),
        )
        return None
    code = passende[0]
    for eintrag in bestand or []:
        settings = eintrag.get("settings") or {}
        if str(settings.get("rate_plan_code")) != code:
            continue
        raum = settings.get("room_type_code")
        if raum is None:
            continue
        # Die Codes kommen aus dem BESTEHENDEN Mapping, also von Channex selbst
        # — im Originaltyp weitergeben (Integer; Strings landen laut Skill unter
        # "removed rates").
        return {
            "room_type_code": raum,
            "rate_plan_code": settings.get("rate_plan_code"),
        }
    log.warning(
        "portal_plan_paar_nicht_im_kanal",
        plan_name=plan_name, rate_plan_code=code,
    )
    return None


def portal_titel_je_code(ota_rooms: list[dict[str, Any]]) -> dict[str, str]:
    """{rate_plan_code: Titel} aus einem `mapping_details`-Abruf.

    Schluessel ist der String: Channex liefert die Codes je OTA als int
    (Booking) oder str (Sandbox); ein Typvergleich verfehlte jeden Code.
    """
    titel: dict[str, str] = {}
    for room in ota_rooms or []:
        for rate in room.get("rates") or []:
            code = rate.get("id")
            name = (rate.get("title") or "").strip()
            if code is not None and name:
                titel[str(code)] = name
    return titel
