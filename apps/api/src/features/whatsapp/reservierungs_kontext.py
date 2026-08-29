"""Platzhalter-Kontext aus einer RESERVIERUNG.

Der Posteingang baut seinen Kontext aus einer Channex-Buchung
(``inbox.feld_kontext._feld_kontext``). Für WhatsApp geht das nicht: eine
WhatsApp-Konversation trägt eine ``reservation_id``, keine
``channex_booking_id`` — und bei Direktbuchungen gibt es überhaupt keine
Channex-Zeile, auf die man zurückspringen könnte.

Ohne diesen Kontext wäre der Vorlagen-Knopf im WhatsApp-Schreibfeld eine Falle:
der Text landete mit rohem ``{{guest_name}}`` beim Gast. Genau das soll er
nicht. Fehlt der Wert eines benutzten Feldes, wirft ``felder.rendern`` weiterhin
``FeldFehlt`` und der Versand unterbleibt — „Hallo ," ist kein Ersatz
(Wurzel 4).

Bewusst NICHT gemaskt: Empfänger ist der Gast selbst. Die Rollen-Maske schützt
die Ansicht für Mitarbeiter, nicht den Gast vor seinen eigenen Daten.

Gedeckt sind die Felder, die aus Reservierung, Gast, Objekt und Betrieb
unmittelbar folgen. Die OTA-eigenen Angaben (Channex-Payload, Zahlungslink,
Objekt-Textbausteine) fehlen hier — sie hängen an der Buchung des Portals. Ein
Platzhalter, der darauf zeigt, bleibt ohne Wert und der Versand meldet ihn beim
Namen, statt still etwas anderes zu senden.
"""
from __future__ import annotations

from supabase import Client

from src.core.logging import get_logger
from src.features.inbox.felder import Kontext

log = get_logger("nextdays.whatsapp.kontext")


def _zeile(db: Client, tabelle: str, spalten: str, **bedingungen: str) -> dict | None:
    frage = db.table(tabelle).select(spalten)
    for feld, wert in bedingungen.items():
        frage = frage.eq(feld, wert)
    daten = (frage.limit(1).execute()).data
    return daten[0] if daten else None


def kontext_aus_reservierung(
    db: Client, tenant_id: str, reservation_id: str
) -> Kontext | None:
    """Kontext für die Platzhalter einer Reservierung. ``None``, wenn es sie
    für diesen Betrieb nicht gibt — scoped, nie über den Tenant hinaus
    (Wurzel 3)."""
    res = _zeile(
        db,
        "reservations",
        "id, property_id, guest_id, check_in, check_out, checkin_time, "
        "checkout_time, adults, children, num_guests, total_amount, "
        "paid_amount, currency, channel, ota_name, external_ref, quote_items, "
        "guest_email, guest_phone, guest_language, guest_country",
        id=reservation_id,
        tenant_id=tenant_id,
    )
    if not res:
        return None

    gast = (
        _zeile(
            db,
            "guests",
            "first_name, last_name, email, phone, language, country",
            id=res["guest_id"],
            tenant_id=tenant_id,
        )
        if res.get("guest_id")
        else None
    ) or {}

    objekt = (
        _zeile(
            db,
            "properties",
            "title, address, city, postal_code, country, lat, lng, "
            "deposit_amount",
            id=res["property_id"],
            tenant_id=tenant_id,
        )
        if res.get("property_id")
        else None
    ) or {}

    betrieb = _zeile(db, "tenants", "name", id=tenant_id) or {}

    vorname = gast.get("first_name")
    nachname = gast.get("last_name")
    voller_name = " ".join(x for x in (vorname, nachname) if x) or None

    return Kontext(
        guest_name=voller_name,
        guest_last_name=nachname,
        # Die Reservierung führt eigene Kontaktdaten (OTA-Import); der
        # Gäste-Datensatz ist die gepflegte Quelle. Erst der gepflegte Wert.
        guest_email=gast.get("email") or res.get("guest_email"),
        guest_phone=gast.get("phone") or res.get("guest_phone"),
        guest_language=gast.get("language") or res.get("guest_language"),
        guest_country=gast.get("country") or res.get("guest_country"),
        check_in=res.get("check_in"),
        check_out=res.get("check_out"),
        checkin_time=res.get("checkin_time"),
        checkout_time=res.get("checkout_time"),
        adults=res.get("adults"),
        children=res.get("children"),
        # Die Buchungsnummer, die der Gast kennt, ist die des Portals; bei einer
        # Direktbuchung gibt es keine, dann bleibt das Feld leer statt eine
        # interne UUID zu zeigen.
        reservation_code=res.get("external_ref"),
        channel=res.get("ota_name") or res.get("channel"),
        total_amount=res.get("total_amount"),
        paid_amount=res.get("paid_amount"),
        quote_items=res.get("quote_items"),
        currency=res.get("currency"),
        property_name=objekt.get("title"),
        property_address=objekt.get("address"),
        property_city=objekt.get("city"),
        property_zip=objekt.get("postal_code"),
        property_country=objekt.get("country"),
        property_lat=objekt.get("lat"),
        property_lng=objekt.get("lng"),
        security_deposit=objekt.get("deposit_amount"),
        company_name=betrieb.get("name"),
    )
