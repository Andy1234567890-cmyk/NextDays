"""Datengrundlage der Platzhalter — woher jeder Wert einer Vorlage kommt.

Aus `service.py` herausgelöst, als die Lodgify-Platzhalterliste (65 Namen)
dazukam: Bank, Positionen, Koordinaten und die mehrsprachigen Objekt-Texte
haben die Datei über die Grenze von 1500 Zeilen getrieben. Reine Verschiebung,
kein Verhaltenswechsel.

Hier steht NUR das Beschaffen der Werte. Wie ein Wert aussieht (Datum, Betrag,
Klartext aus HTML) entscheidet `felder.py`, und was fehlt, meldet
:class:`FeldFehlt` — nicht dieses Modul.
"""
from __future__ import annotations

from supabase import Client

from src.core.countries import telefon_anzeigen
from src.core.languages import sprach_name

from .felder import Kontext, html_zu_text


class FeldKontextMixin:
    """Baut den :class:`Kontext` eines Threads — Teil von `InboxService`."""

    _MESSAGING_FELDER = {
        "checkIn": "checkin_instructions",
        "checkOut": "checkout_instructions",
        "directions": "directions",
        "doorInstructions": "door_instructions",
        "rules": "house_rules",
        "wifi": "wifi_text",
        "localGuide": "local_guide",
        "emergency": "emergency_contact",
    }

    @staticmethod
    def _messaging_texte(prop: dict | None, sprache: str | None) -> dict[str, str]:
        """Die gepflegten Objekt-Texte IN DER SPRACHE DES GASTES.

        Der Betrieb pflegt jeden Block mehrsprachig (de/en/da). Welcher davon
        in die Nachricht gehört, entscheidet die Sprache des GASTES — sie steht
        an der Buchung (`customer.language`, bei Airbnb z. B. „da").

        Reihenfolge: die Gastsprache, dann Englisch, dann Deutsch, dann die
        erste überhaupt gepflegte. Ein Gast, der Dänisch spricht, liest lieber
        den englischen Text als gar keinen — und lieber irgendeinen als
        „{{RentalRules}}" im Klartext. Ist NICHTS gepflegt, bleibt das Feld
        leer, und der Versand meldet „Feld ohne Wert" (Wurzel 4).
        """
        attrs = prop.get("type_attributes") if prop else None
        messaging = attrs.get("messaging") if isinstance(attrs, dict) else None
        if not isinstance(messaging, dict):
            return {}
        basis = (sprache or "").strip().lower().replace("_", "-").split("-")[0]
        reihenfolge = [s for s in (basis, "en", "de") if s]

        out: dict[str, str] = {}
        for quelle, ziel in FeldKontextMixin._MESSAGING_FELDER.items():
            werte = messaging.get(quelle)
            if not isinstance(werte, dict):
                continue
            text = next(
                (
                    str(werte[s]).strip()
                    for s in reihenfolge
                    if isinstance(werte.get(s), str) and werte[s].strip()
                ),
                "",
            ) or next(
                (
                    str(v).strip()
                    for v in werte.values()
                    if isinstance(v, str) and v.strip()
                ),
                "",
            )
            # Der Editor liefert Rich-Text; ein Portal-Chat überträgt nur
            # Klartext. Ohne Umwandlung läse der Gast „<p><strong>…".
            klartext = html_zu_text(text)
            if klartext:
                out[ziel] = klartext
        return out

    @staticmethod
    def _reservierung_zeiten(db: Client, tenant_id: str, row: dict) -> dict:
        """Die projizierte Reservierung zu diesem Thread ({} wenn keine da).

        Liefert die Felder, die im Thread selbst NICHT stehen: An-/Abreisezeit
        (vom Portal geholt, 0295-Reihe), Bezahlt-Stand (für den offenen Betrag)
        und Herkunftsland des Gastes.
        """
        cbid = row.get("channex_booking_id")
        if not cbid:
            return {}
        treffer = (
            db.table("reservations")
            .select(
                "checkin_time, checkout_time, paid_amount, guest_country, "
                "quote_items"
            )
            .eq("tenant_id", tenant_id)
            .eq("source_channex_booking_id", cbid)
            .limit(1)
            .execute()
        ).data
        return treffer[0] if treffer else {}

    def _feld_kontext(self, db: Client, tenant_id: str, row: dict) -> Kontext:
        """Datengrundlage der Platzhalter für einen Thread.

        Bewusst UNGEMASKT: der Empfänger ist der Gast selbst, dem seine eigenen
        Daten nicht vorenthalten werden müssen. Die Rollen-Maske (§4.3) schützt
        die ANSICHT für Mitarbeiter — sie darf nicht dazu führen, dass ein Gast
        eine Nachricht mit „Hallo M****" bekommt.
        """
        customer = self._customer_of(row)
        raw = row.get("raw") or {}
        occ = raw.get("occupancy") or {}
        # Dieselbe Quelle wie die Detailspalte: erst die eigene Reservierung
        # (dort steht Airbnbs `check_in_datetime`), dann die Channex-Payload.
        # Sonst zeigte die Spalte rechts „16:00", während die Vorlage daneben
        # „Feld ohne Wert: checkin_time" meldete — derselbe Widerspruch, den
        # `_ota_zeiten` schon einmal aufgelöst hat.
        checkin_time, checkout_time = self._ota_zeiten(
            raw, self._reservierung_zeiten(db, tenant_id, row)
        )
        prop = self._property_for_thread(db, tenant_id, row)
        # Dritter Weg: die Hausregel am OBJEKT. Sie kommt aus Airbnbs
        # `booking_settings` (`check_in_time_start`/`check_out_time`, importiert
        # nach `type_attributes.policies`) und gilt für JEDE Buchung des Hauses.
        #
        # Ohne diesen Rückfall scheiterte die Check-in-Automail an einer Angabe,
        # die längst da war: Airbnb schickt die Uhrzeit NICHT je Reservierung
        # mit (die Buchungs-Payload hat keine), sondern nur als Einstellung des
        # Inserats. Live gemessen am 07.08.2026 — „Feriehus Perlen" trug 16:00
        # am Objekt, während die Automail „Feld ohne Wert: checkin_time" meldete
        # und deshalb NICHT rausging.
        checkin_time, checkout_time = self._zeiten_vom_objekt(
            prop, checkin_time, checkout_time
        )
        cents = row.get("amount_cents")
        betrag = (cents / 100) if isinstance(cents, (int, float)) else None

        # Alles, was am Gastportal des Objekts hängt: Zugangsgeheimnisse UND die
        # Freitexte für den Gast (0296/0298). Eine Abfrage, nicht drei.
        portal_zeile: dict = {}
        if prop and prop.get("id"):
            portal = (
                db.table("property_guest_portal")
                # Nur die STRUKTURIERTEN Werte. Die Freitexte (Anfahrt,
                # Hausordnung …) stehen NICHT hier, sondern mehrsprachig in
                # `properties.type_attributes.messaging` — gepflegt unter
                # /objekte/{id}/nachrichten, gelesen von `_messaging_texte`.
                .select(
                    "door_code, wifi_ssid, wifi_password, contact_phone, "
                    "maintenance_phone"
                )
                .eq("property_id", str(prop["id"]))
                .limit(1)
                .execute()
            ).data or []
            if portal:
                portal_zeile = portal[0]
        tuercode = portal_zeile.get("door_code")
        wlan_netz = portal_zeile.get("wifi_ssid")
        wlan_passwort = portal_zeile.get("wifi_password")

        firma = (
            db.table("tenants")
            .select("name")
            .eq("id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        # Bankverbindung und Steuersatz für Zahlungsaufforderungen. Eigene
        # Abfrage, weil `tenants` nur Name/Land führt — die Zahldaten stehen im
        # Abrechnungsprofil.
        abrechnung = (
            db.table("tenant_billing_profile")
            .select(
                "iban, bic, bank_name, account_holder, default_payment_text, "
                "default_tax_rate, website"
            )
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        bank = abrechnung[0] if abrechnung else {}
        # Die mehrsprachig gepflegten Objekt-Texte in der Sprache des Gastes.
        texte = self._messaging_texte(
            prop, customer.get("language") or customer.get("lang")
        )
        # Notfallkontakt: der gepflegte Text gewinnt, sonst die hinterlegte
        # Nummer aus dem Gastportal. Beides meint dasselbe — an wen sich der
        # Gast wendet, wenn etwas ist.
        texte.setdefault(
            "emergency_contact", portal_zeile.get("maintenance_phone") or ""
        )
        texte = {k: v for k, v in texte.items() if v}
        # Bezahlt-Stand aus der Reservierung — ohne ihn ließe sich der offene
        # Betrag nicht bilden (`{{AmountToPay}}` bliebe leer).
        reservierung = self._reservierung_zeiten(db, tenant_id, row)

        return Kontext(
            guest_name=self._guest_name(customer),
            guest_email=customer.get("mail") or customer.get("email"),
            guest_phone=telefon_anzeigen(customer.get("phone")),
            guest_language=sprach_name(customer.get("language") or customer.get("lang"))
            or customer.get("language")
            or customer.get("lang"),
            check_in=row.get("arrival_date"),
            check_out=row.get("departure_date"),
            checkin_time=checkin_time,
            checkout_time=checkout_time,
            adults=occ.get("adults"),
            children=occ.get("children"),
            reservation_code=row.get("ota_reservation_code"),
            channel=row.get("ota_name"),
            total_amount=betrag,
            currency=row.get("currency"),
            property_name=prop.get("title") if prop else None,
            property_address=prop.get("address") if prop else None,
            property_city=prop.get("city") if prop else None,
            door_code=tuercode,
            wifi_ssid=wlan_netz,
            wifi_password=wlan_passwort,
            company_name=firma[0].get("name") if firma else None,
            guest_last_name=customer.get("surname"),
            guest_country=reservierung.get("guest_country")
            or customer.get("country"),
            paid_amount=reservierung.get("paid_amount"),
            quote_items=reservierung.get("quote_items"),
            property_country=prop.get("country") if prop else None,
            property_zip=prop.get("postal_code") if prop else None,
            property_lat=prop.get("lat") if prop else None,
            property_lng=prop.get("lng") if prop else None,
            security_deposit=prop.get("deposit_amount") if prop else None,
            property_phone=portal_zeile.get("contact_phone"),
            emergency_phone=portal_zeile.get("maintenance_phone"),
            # Die gepflegten Objekt-Texte, aufgelöst in der Sprache des Gastes.
            **texte,
            bank_iban=bank.get("iban"),
            bank_bic=bank.get("bic"),
            bank_name=bank.get("bank_name"),
            bank_holder=bank.get("account_holder"),
            payment_text=bank.get("default_payment_text"),
            tax_rate=bank.get("default_tax_rate"),
            company_website=bank.get("website"),
        )
