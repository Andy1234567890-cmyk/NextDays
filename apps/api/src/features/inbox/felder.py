"""Platzhalter (Felder) für Vorlagen, Automationen und geplante Nachrichten.

Ohne Platzhalter kann eine Automation nur Sätze verschicken, die für jeden Gast
gleich lauten — der Automations-Tab war damit praktisch unbenutzbar. Hier steht
der Katalog, der Ersetzer und die Prüfung.

Schreibweise: ``{{guest_name}}``. Die Schlüssel sind bewusst ENGLISCH und
sprachneutral: der Text der Vorlage schreibt der Betrieb in seiner Sprache, der
Schlüssel darin muss aber stabil bleiben — sonst wäre eine Vorlage nach einem
Sprachwechsel der Oberfläche kaputt. Übersetzt wird nur das Etikett im Picker
(Frontend, ``inbox.field_*``).

Zwei Regeln, die das Verhalten bestimmen:

1. **Ersetzt wird beim SENDEN, nicht beim Planen.** Eine Automation für den
   Anreisetag wird Tage vorher geplant; der Türcode entsteht oft erst kurz
   davor. Würde beim Planen ersetzt, stünde im Text für immer der Stand von
   damals. Deshalb liegt im Zeitplan der Rohtext, und erst der Versand löst auf.

2. **Fehlt der Wert eines BENUTZTEN Feldes, wird nicht gesendet** (Wurzel 4).
   „Hallo ," ist kein akzeptabler Ersatz für „Hallo Frau Meier,". Der Versand
   schlägt mit :class:`FeldFehlt` fehl und nennt die betroffenen Felder; der
   Grund landet sichtbar an der geplanten Nachricht (``last_error``), statt
   still eine kaputte Nachricht an einen Gast zu schicken.
"""
from __future__ import annotations

import re
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation

# {{ feld }} — Leerzeichen innen erlaubt, damit ein aus der UI eingefügtes Feld
# auch nach manuellem Nachtippen noch greift.
#
# GROSSBUCHSTABEN BEWUSST MIT: Vorher stand hier `[a-z0-9_]+`. Damit galt
# „{{WifiInformation}}" (so schreibt Lodgify) NICHT als Platzhalter — kein 422
# beim Speichern, keine Meldung beim Senden, und der Gast las wörtlich
# „{{WifiInformation}}". Was wir nicht erkennen, können wir auch nicht
# beanstanden; deshalb lieber erkennen und dann sauber ablehnen oder übersetzen
# (`aufloesen_schluessel`).
MUSTER = re.compile(r"\{\{\s*([A-Za-z0-9_-]+)\s*\}\}")


class FeldFehlt(Exception):
    """Ein im Text benutztes Feld hat für diesen Vorgang keinen Wert."""

    def __init__(self, felder: list[str]) -> None:
        self.felder = felder
        super().__init__(
            "Diese Felder haben für diese Reservierung keinen Wert: "
            + ", ".join(sorted(felder))
        )


@dataclass(frozen=True)
class Feld:
    schluessel: str
    gruppe: str  # guest | reservation | property | company
    aufloesen: Callable[[Kontext], object]


@dataclass
class Kontext:
    """Alle Daten, aus denen sich Felder speisen. Rohwerte, kein Formatieren —
    das übernimmt der jeweilige Resolver."""

    guest_name: str | None = None
    guest_email: str | None = None
    guest_phone: str | None = None
    guest_language: str | None = None
    check_in: str | None = None
    check_out: str | None = None
    checkin_time: str | None = None
    checkout_time: str | None = None
    adults: int | None = None
    children: int | None = None
    reservation_code: str | None = None
    channel: str | None = None
    total_amount: object = None  # Cent (int) oder Betrag (float/Decimal)
    currency: str | None = None
    property_name: str | None = None
    property_address: str | None = None
    property_city: str | None = None
    door_code: str | None = None
    wifi_ssid: str | None = None
    wifi_password: str | None = None
    company_name: str | None = None
    # --- Gast (weitere) ---
    guest_last_name: str | None = None
    guest_country: str | None = None
    # --- Reservierung (weitere) ---
    paid_amount: object = None
    # Positionsliste der Buchung: [{kind, label, amount}] — Übernachtung,
    # Abgaben, Zusatzleistungen. Bei OTA-Buchungen oft leer (Airbnb liefert
    # keine Aufstellung); die betroffenen Felder sind dann leer statt 0.
    quote_items: object = None
    payment_link: str | None = None
    # --- Objekt: Anschrift und Lage ---
    property_country: str | None = None
    property_zip: str | None = None
    property_lat: object = None
    property_lng: object = None
    property_phone: str | None = None
    emergency_phone: str | None = None
    security_deposit: object = None
    # --- Objekt: Freitexte für den Gast ---
    # Bereits IN DER SPRACHE DES GASTES aufgelöst (`service._messaging_texte`).
    # Gepflegt werden sie mehrsprachig unter `/objekte/{id}/nachrichten` in
    # `properties.type_attributes.messaging`.
    checkin_instructions: str | None = None
    checkout_instructions: str | None = None
    door_instructions: str | None = None
    directions: str | None = None
    house_rules: str | None = None
    local_guide: str | None = None
    wifi_text: str | None = None
    emergency_contact: str | None = None
    # --- Betrieb: Bankverbindung (Zahlungsaufforderungen) ---
    bank_iban: str | None = None
    bank_bic: str | None = None
    bank_name: str | None = None
    bank_holder: str | None = None
    payment_text: str | None = None
    tax_rate: object = None
    company_website: str | None = None


# Block-Elemente, die im Klartext einen Zeilenumbruch bedeuten. `li` bekommt
# zusätzlich einen Aufzählungsstrich — eine Hausordnung ohne Gliederung ist im
# Chat unlesbar.
_UMBRUCH_TAGS = re.compile(
    r"</\s*(p|div|h[1-6]|li|ul|ol|tr|blockquote)\s*>|<\s*br\s*/?>", re.I
)
_LISTENPUNKT = re.compile(r"<\s*li[^>]*>", re.I)
_ALLE_TAGS = re.compile(r"<[^>]+>")
_ENTITAETEN = {
    "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">",
    "&quot;": '"', "&#39;": "'", "&apos;": "'",
}
_LEERZEILEN = re.compile(r"\n{3,}")


def html_zu_text(roh: str) -> str:
    """Rich-Text aus der Objektpflege → Klartext für eine Chat-Nachricht.

    DER GRUND: Die Objekt-Texte („Hausordnung", „Check-out") werden unter
    `/objekte/{id}/nachrichten` in einem Rich-Text-Editor gepflegt und liegen
    als HTML vor (`<p>`, `<strong>`, `<ul><li>`). Unverändert in eine
    Portal-Nachricht gesetzt, liest der Gast die Tags mit — Airbnb und
    Booking.com übertragen reinen Text.

    Kein Tag-Strippen allein (`nh3.clean(tags=set())`): das ergäbe eine
    Textwand, in der eine zwölfpunktige Hausordnung zu einem Absatz verklebt.
    Die GLIEDERUNG ist hier die Information — deshalb werden Block-Enden zu
    Zeilenumbrüchen und Listenpunkte zu „- ".
    """
    if not roh:
        return ""
    text = _LISTENPUNKT.sub("\n- ", roh)
    text = _UMBRUCH_TAGS.sub("\n", text)
    text = _ALLE_TAGS.sub("", text)
    for entitaet, zeichen in _ENTITAETEN.items():
        text = text.replace(entitaet, zeichen)
    # Zeilenweise trimmen: das Markup hinterlässt Einrückungen, die im Chat
    # wie ein Formatierungsfehler aussehen.
    zeilen = [z.strip() for z in text.split("\n")]
    return _LEERZEILEN.sub("\n\n", "\n".join(zeilen)).strip()


def _text(wert: object) -> str | None:
    """Rohwert → getrimmter Text, leer wird zu None (= „kein Wert")."""
    if wert is None:
        return None
    s = str(wert).strip()
    return s or None


def _vorname(k: Kontext) -> str | None:
    ganz = _text(k.guest_name)
    return ganz.split()[0] if ganz else None


def _datum(roh: str | None) -> str | None:
    """ISO-Datum → TT.MM.JJJJ. Kein Locale-Rateversuch: das Zielformat hängt an
    der Sprache des Gastes, die wir hier nicht zuverlässig kennen. Das ISO-Datum
    unverändert stehen zu lassen wäre für einen Gast schlechter lesbar."""
    s = str(roh).strip() if roh is not None else ""
    if not s:
        return None
    try:
        return date.fromisoformat(s[:10]).strftime("%d.%m.%Y")
    except ValueError:
        return s


def _naechte(k: Kontext) -> int | None:
    if not (k.check_in and k.check_out):
        return None
    try:
        a = date.fromisoformat(str(k.check_in)[:10])
        b = date.fromisoformat(str(k.check_out)[:10])
    except ValueError:
        return None
    return (b - a).days or None


def _gaeste(k: Kontext) -> int | None:
    summe = (k.adults or 0) + (k.children or 0)
    return summe or None


def _dezimal(roh: object) -> Decimal | None:
    """Rohwert → Decimal, unbrauchbares → None."""
    if roh is None:
        return None
    try:
        return Decimal(str(roh))
    except (InvalidOperation, ValueError):
        return None


def _geld(roh: object) -> str | None:
    """Betrag mit zwei Nachkommastellen, deutsches Komma. Ohne Währungszeichen —
    dafür gibt es `{{currency}}` (Wurzel 4: kein hartkodiertes €)."""
    wert = _dezimal(roh)
    return None if wert is None else f"{wert:.2f}".replace(".", ",")


def _restbetrag(k: Kontext) -> str | None:
    """Was noch offen ist: Gesamt minus bereits bezahlt.

    Beides muss bekannt sein. Fehlt der Bezahlt-Stand, ist die Antwort None und
    nicht „= Gesamtbetrag": Eine Zahlungsaufforderung über einen Betrag, den der
    Gast womöglich schon überwiesen hat, ist schlimmer als gar keine (Wurzel 4).
    """
    gesamt = _dezimal(k.total_amount)
    bezahlt = _dezimal(k.paid_amount)
    if gesamt is None or bezahlt is None:
        return None
    offen = gesamt - bezahlt
    return f"{offen:.2f}".replace(".", ",")


def _bankblock(k: Kontext) -> str | None:
    """Die Bankverbindung als fertiger Absatz für eine Zahlungsaufforderung.

    Nur vollständig oder gar nicht: Ohne IBAN kann niemand überweisen, und eine
    halbe Bankverbindung im Text sieht aus wie ein Fehler des Betriebs. Der
    Verwendungszweck ist die Buchungsnummer — ohne ihn lässt sich der Eingang
    nicht zuordnen.
    """
    if not (k.bank_iban and k.bank_holder):
        return None
    zeilen = [f"Empfänger: {k.bank_holder}", f"IBAN: {k.bank_iban}"]
    if k.bank_bic:
        zeilen.append(f"BIC: {k.bank_bic}")
    if k.bank_name:
        zeilen.append(f"Bank: {k.bank_name}")
    if k.reservation_code:
        zeilen.append(f"Verwendungszweck: {k.reservation_code}")
    return "\n".join(zeilen)


# `quote_items`-Arten, wie sie in der Reservierung stehen (belegt in
# `buchhaltung.reservation_invoice`): der Übernachtungspreis, Abgaben wie
# Kurtaxe, und alles Zubuchbare (Endreinigung, Wäschepaket, Haustier).
_ART_UEBERNACHTUNG = "lodging"
_ART_ABGABE = "tax"
_ART_ZUSATZ = "addon"


def _posten(k: Kontext, art: str) -> list[dict]:
    """Die Positionen einer Art aus der Buchung ([] wenn keine)."""
    if not isinstance(k.quote_items, list):
        return []
    return [
        p for p in k.quote_items
        if isinstance(p, dict) and str(p.get("kind") or "") == art
    ]


def _posten_summe(k: Kontext, art: str) -> str | None:
    """Summe einer Positionsart. None, wenn es KEINE solche Position gibt.

    Kein „0,00" als Ersatz: „Steuern: 0,00" behauptet, es seien Abgaben
    berechnet und sie betrügen null — tatsächlich weist die Buchung gar keine
    aus (Airbnb liefert die Aufstellung nicht mit). Der Versand meldet dann
    „Feld ohne Wert", und der Betrieb sieht, dass sein Text nicht passt.
    """
    posten = _posten(k, art)
    if not posten:
        return None
    summe = sum((_dezimal(p.get("amount")) or Decimal(0)) for p in posten)
    return f"{summe:.2f}".replace(".", ",")


def _posten_liste(k: Kontext, art: str) -> str | None:
    """Die Positionen einer Art als Zeilen: „Endreinigung: 60,00"."""
    zeilen = [
        f"{p.get('label') or '—'}: {_geld(p.get('amount')) or '—'}"
        for p in _posten(k, art)
    ]
    return "\n".join(zeilen) or None


def _reinigung(k: Kontext) -> str | None:
    """Die Reinigungsposition — an ihrem Text erkannt.

    Es gibt KEINE eigene `kind`-Art dafür: Endreinigung ist ein `addon` wie
    Wäschepaket oder Haustiergebühr. Deshalb über das Label, und bewusst
    mehrsprachig — der Betrieb ist dänisch, seine Gäste sind es nicht.
    """
    for p in _posten(k, _ART_ZUSATZ):
        label = str(p.get("label") or "").lower()
        if any(w in label for w in ("reinig", "cleaning", "rengør", "schoonmaak")):
            return _geld(p.get("amount"))
    return None


def _wlan(k: Kontext) -> str | None:
    """Netz und Passwort in einer Zeile: „NetzName / geheim123".

    Nur das, was da ist: fehlt das Passwort, steht der Netzname allein. Fehlt
    beides, ist das Feld leer — der Versand schlägt dann mit `FeldFehlt` fehl,
    statt „Internet: " an den Gast zu schicken.
    """
    teile = [x for x in (k.wifi_ssid, k.wifi_password) if x]
    return " / ".join(teile) or None


def _betrag(k: Kontext) -> str | None:
    """Betrag mit zwei Nachkommastellen. Ohne Währungszeichen — dafür gibt es
    ``{{currency}}``; ein hier hartkodiertes € wäre in 26 der 27 EU-Länder
    falsch (Wurzel 4)."""
    roh = k.total_amount
    if roh is None:
        return None
    try:
        wert = Decimal(str(roh))
    except (InvalidOperation, ValueError):
        return None
    return f"{wert:.2f}".replace(".", ",")


FELDER: tuple[Feld, ...] = (
    Feld("guest_name", "guest", lambda k: _text(k.guest_name)),
    Feld("guest_first_name", "guest", _vorname),
    Feld("guest_email", "guest", lambda k: _text(k.guest_email)),
    Feld("guest_phone", "guest", lambda k: _text(k.guest_phone)),
    Feld("guest_language", "guest", lambda k: _text(k.guest_language)),
    Feld("check_in", "reservation", lambda k: _datum(k.check_in)),
    Feld("check_out", "reservation", lambda k: _datum(k.check_out)),
    Feld("checkin_time", "reservation", lambda k: _text(k.checkin_time)),
    Feld("checkout_time", "reservation", lambda k: _text(k.checkout_time)),
    Feld("nights", "reservation", _naechte),
    Feld("guests", "reservation", _gaeste),
    Feld("adults", "reservation", lambda k: k.adults or None),
    Feld("children", "reservation", lambda k: k.children),
    Feld("reservation_code", "reservation", lambda k: _text(k.reservation_code)),
    Feld("channel", "reservation", lambda k: _text(k.channel)),
    Feld("total_amount", "reservation", _betrag),
    Feld("currency", "reservation", lambda k: _text(k.currency)),
    Feld("property_name", "property", lambda k: _text(k.property_name)),
    Feld("property_address", "property", lambda k: _text(k.property_address)),
    Feld("property_city", "property", lambda k: _text(k.property_city)),
    Feld("door_code", "property", lambda k: _text(k.door_code)),
    # WLAN getrennt in Netz und Passwort (0296): eine Vorlage schreibt oft nur
    # eines von beidem („Das Netz heißt X, das Passwort steht am Kühlschrank"),
    # und der QR-Code des Gastportals braucht die Teile ohnehin einzeln.
    Feld("wifi_ssid", "property", lambda k: _text(k.wifi_ssid)),
    Feld("wifi_password", "property", lambda k: _text(k.wifi_password)),
    # Beides in einer Zeile — das, was „Internet: {{WifiInformation}}" in den
    # übernommenen Vorlagen meinte. Die Einzelfelder bleiben daneben bestehen;
    # wer nur das Netz nennen will, nimmt `{{wifi_ssid}}`.
    # Der GEPFLEGTE WLAN-Text aus `/objekte/{id}/nachrichten` (mehrsprachig).
    # Das ist es, was `{{WifiInformation}}` in den übernommenen Vorlagen meint:
    # ein ganzer Satz („Netz X, Passwort Y, Router steht im Flur"), nicht zwei
    # Werte. Fehlt der Text, springt die Zusammensetzung aus den strukturierten
    # Feldern ein — besser die nackten Zugangsdaten als eine leere Zeile.
    Feld("wifi", "property", lambda k: _text(k.wifi_text) or _wlan(k)),
    Feld("company_name", "company", lambda k: _text(k.company_name)),
    # --- Gast (weitere) ---
    Feld("guest_last_name", "guest", lambda k: _text(k.guest_last_name)),
    Feld("guest_country", "guest", lambda k: _text(k.guest_country)),
    # --- Reservierung: Beträge ---
    # Der offene Betrag ist das, was in einer Zahlungsaufforderung steht. Drei
    # Lodgify-Namen meinen dasselbe (AmountToPay/AmountDueAfterPay/
    # ResidualAmount) — EIN Feld, drei Alt-Namen zeigen darauf.
    Feld("amount_due", "reservation", _restbetrag),
    Feld("paid_amount", "reservation", lambda k: _geld(k.paid_amount)),
    # --- Objekt: Anschrift und Lage ---
    Feld("property_country", "property", lambda k: _text(k.property_country)),
    Feld("property_zip", "property", lambda k: _text(k.property_zip)),
    Feld("property_lat", "property", lambda k: _text(k.property_lat)),
    Feld("property_lng", "property", lambda k: _text(k.property_lng)),
    Feld("property_phone", "property", lambda k: _text(k.property_phone)),
    Feld("emergency_phone", "property", lambda k: _text(k.emergency_phone)),
    Feld("security_deposit", "property", lambda k: _geld(k.security_deposit)),
    # --- Objekt: Freitexte für den Gast (0298) ---
    Feld("checkin_instructions", "property",
         lambda k: _text(k.checkin_instructions)),
    Feld("checkout_instructions", "property",
         lambda k: _text(k.checkout_instructions)),
    Feld("door_instructions", "property", lambda k: _text(k.door_instructions)),
    Feld("directions", "property", lambda k: _text(k.directions)),
    Feld("house_rules", "property", lambda k: _text(k.house_rules)),
    Feld("local_guide", "property", lambda k: _text(k.local_guide)),
    Feld("emergency_contact", "property", lambda k: _text(k.emergency_contact)),
    # --- Betrieb: Bankverbindung ---
    # Der fertige Block ist der Normalfall in einer Zahlungsaufforderung; die
    # Einzelfelder daneben, wenn jemand seinen Satz selbst bauen will.
    Feld("bank_details", "company", _bankblock),
    Feld("bank_iban", "company", lambda k: _text(k.bank_iban)),
    Feld("bank_bic", "company", lambda k: _text(k.bank_bic)),
    Feld("bank_name", "company", lambda k: _text(k.bank_name)),
    Feld("bank_holder", "company", lambda k: _text(k.bank_holder)),
    Feld("payment_text", "company", lambda k: _text(k.payment_text)),
    Feld("tax_rate", "company", lambda k: _text(k.tax_rate)),
    Feld("company_website", "company", lambda k: _text(k.company_website)),
    # --- Positionen der Buchung (aus `quote_items`) ---
    Feld("addons", "reservation", lambda k: _posten_liste(k, _ART_ZUSATZ)),
    Feld("addons_total", "reservation",
         lambda k: _posten_summe(k, _ART_ZUSATZ)),
    Feld("taxes", "reservation", lambda k: _posten_summe(k, _ART_ABGABE)),
    Feld("cleaning_fee", "reservation", _reinigung),
    Feld("payment_link", "reservation", lambda k: _text(k.payment_link)),
)

NACH_SCHLUESSEL: dict[str, Feld] = {f.schluessel: f for f in FELDER}

# Platzhalternamen aus ALTSYSTEMEN, die in übernommenen Vorlagen stehen.
#
# DER ANLASS (06.08.2026): Die aus Lodgify übernommene Vorlage „Anreisetag"
# enthält „Internet: {{WifiInformation}}". Diesen Namen kennt unser Katalog
# nicht — und weil `MUSTER` nur Kleinbuchstaben erfasste, wurde er nicht einmal
# als Platzhalter ERKANNT: kein 422 beim Speichern, keine Meldung beim Senden.
# Der Gast hätte wörtlich „{{WifiInformation}}" gelesen.
#
# Zwei Konsequenzen, beide hier: `MUSTER` erkennt jetzt auch Groß-/Binnen-
# schreibung (sonst rutscht der nächste Alt-Name genauso durch), und bekannte
# Alt-Namen werden auf unseren Schlüssel abgebildet, statt 18 Vorlagen von Hand
# umschreiben zu lassen.
#
# Schlüssel hier IMMER klein vergleichen — Lodgify schreibt „WifiInformation",
# andere Systeme „wifi_information" oder „WIFI_INFORMATION".
# Vollständig gegen die Lodgify-Liste des Betriebs geprüft (65 Namen). Mehrere
# Lodgify-Namen zeigen bewusst auf DASSELBE Feld — etwa die drei Schreibweisen
# für den offenen Restbetrag. Sie dort zu trennen hieße, denselben Wert dreimal
# zu pflegen.
_ALTNAMEN: dict[str, str] = {
    # Gast
    "guestfirstname": "guest_first_name",
    "guestfullname": "guest_name",
    "guestname": "guest_name",
    "guestlastname": "guest_last_name",
    "guestemail": "guest_email",
    "guestphone": "guest_phone",
    "guestcountry": "guest_country",
    # Reservierung
    "arrival": "check_in",
    "departure": "check_out",
    "checkintime": "checkin_time",
    "checkouttime": "checkout_time",
    "numberofnights": "nights",
    "numberofpeople": "guests",
    "bookingid": "reservation_code",
    "banktransferconcept": "reservation_code",  # Verwendungszweck = Buchungsnr.
    "source": "channel",
    "totalamount": "total_amount",
    "totalpaid": "paid_amount",
    "currencycode": "currency",
    # Drei Namen, ein Betrag: was noch offen ist.
    "amounttopay": "amount_due",
    "amountdueafterpay": "amount_due",
    "residualamount": "amount_due",
    # Objekt
    "housename": "property_name",
    "roomtypename": "property_name",  # 1 Objekt = 1 Typ (Datenmodell)
    "propertyname": "property_name",
    "houseaddress": "property_address",
    "housecity": "property_city",
    "housecountry": "property_country",
    "houseregion": "property_city",
    "housezipcode": "property_zip",
    "houselatitude": "property_lat",
    "houselongitude": "property_lng",
    "housephone": "property_phone",
    "emergencycontact": "emergency_contact",
    "securitydeposit": "security_deposit",
    "keycode": "door_code",
    "doorcode": "door_code",
    # Freitexte (0298)
    "checkininstructions": "checkin_instructions",
    "checkoutinstructions": "checkout_instructions",
    "doorinstructions": "door_instructions",
    # Lodgify kennt zwei Namen für die Anfahrt — wir führen EINEN Text.
    "housedirections": "directions",
    "rentaldirections": "directions",
    "rentalrules": "house_rules",
    "localguide": "local_guide",
    # WLAN (0296)
    "wifiinformation": "wifi",
    "wifi_information": "wifi",
    "wifiname": "wifi_ssid",
    "wifipassword": "wifi_password",
    # Betrieb / Bank
    "ownername": "company_name",
    "ownerurl": "company_website",
    "bankiban": "bank_iban",
    "bankswift": "bank_bic",
    "bankname": "bank_name",
    "banktransferrecipient": "bank_holder",
    "bankaccounttext": "payment_text",
    "banktransferpaymentibantemplate": "bank_details",
    "banktransferpaymentothertemplate": "bank_details",
    "taxespercentage": "tax_rate",
    # Positionen der Buchung. Lodgify unterscheidet „Template" (fertige Zeilen)
    # von „Total" (nur die Summe) — beides bilden wir ab; die
    # Prozent-/Nacht-Varianten laufen auf denselben Wert, weil unsere
    # Positionen als Betrag gespeichert sind, nicht als Rechenregel.
    "addonsdescription": "addons",
    "addondescriptionstemplate": "addons",
    "addonstotal": "addons_total",
    "addonstotaltemplate": "addons_total",
    "misccharges": "addons",
    "misccharsesnightlyamount": "addons_total",
    "miscchargesnightlyamount": "addons_total",
    "miscchargespercentage": "addons_total",
    "cleaningcharge": "cleaning_fee",
    "taxes": "taxes",
    "taxesnightlyamount": "taxes",
    "securitydepositpercentage": "security_deposit",
    "paymentlink": "payment_link",
    "creditcardpaymenttemplate": "payment_link",
}


def aufloesen_schluessel(roh: str) -> str:
    """Geschriebener Name → unser Katalog-Schlüssel.

    Erst wörtlich (der Normalfall), dann über die Alt-Namen-Tabelle. Unbekanntes
    kommt unverändert zurück und wird vom Aufrufer als unbekanntes Feld
    behandelt — kein stilles Verschlucken.
    """
    if roh in NACH_SCHLUESSEL:
        return roh
    return _ALTNAMEN.get(roh.lower().replace("-", "_"), roh)

# Früher stand `children` hier, damit „0 Kinder" als Aussage durchgeht. Das war
# überflüssig und schädlich zugleich: die Prüfung darunter fragt `wert is None`,
# und 0 ist nicht None — eine echte Null kam also ohnehin durch. Der Eintrag
# griff einzig, wenn die Kinderzahl GAR NICHT geliefert wurde (OTA-Payload ohne
# `occupancy.children`), und machte daraus die Behauptung „mit 0 Kindern"
# (Wurzel 4: kein erfundener Ersatzwert). Fehlt die Angabe, fehlt sie — dann
# meldet der Versand das Feld wie jedes andere.
_NULL_IST_GUELTIG: frozenset[str] = frozenset()


def benutzte_felder(text: str) -> list[str]:
    """Alle Feldschlüssel, die im Text vorkommen (Reihenfolge, ohne Dubletten)."""
    gesehen: list[str] = []
    for treffer in MUSTER.findall(text or ""):
        if treffer not in gesehen:
            gesehen.append(treffer)
    return gesehen


def unbekannte_felder(text: str) -> list[str]:
    """Benutzte Schlüssel, die es im Katalog nicht gibt. Beim Speichern einer
    Vorlage/Automation ein 422 wert: ein Tippfehler soll auffallen, solange der
    Autor davorsitzt — nicht Wochen später beim Versand an einen Gast."""
    return [
        f
        for f in benutzte_felder(text)
        if aufloesen_schluessel(f) not in NACH_SCHLUESSEL
    ]


def rendern(text: str, kontext: Kontext) -> str:
    """Platzhalter ersetzen. Wirft :class:`FeldFehlt`, wenn ein benutztes Feld
    für diesen Vorgang keinen Wert hat.

    Ein Schlüssel, den der Katalog nicht kennt, bleibt unverändert stehen statt
    zu werfen: beim Speichern ist er bereits abgewiesen worden, und eine von
    Hand getippte Nachricht, die zufällig `{{...}}` enthält, soll nicht am
    Versand scheitern.
    """
    fehlt: list[str] = []
    werte: dict[str, str] = {}
    for geschrieben in benutzte_felder(text):
        # Der Name im Text kann ein Alt-Name sein („WifiInformation"); ersetzt
        # wird trotzdem unter dem GESCHRIEBENEN Namen, denn genau der steht im
        # Text und muss verschwinden.
        schluessel = aufloesen_schluessel(geschrieben)
        feld = NACH_SCHLUESSEL.get(schluessel)
        if feld is None:
            continue
        wert = feld.aufloesen(kontext)
        if wert is None and schluessel not in _NULL_IST_GUELTIG:
            fehlt.append(schluessel)
            continue
        werte[geschrieben] = str(wert)
    if fehlt:
        raise FeldFehlt(fehlt)
    return MUSTER.sub(lambda m: werte.get(m.group(1), m.group(0)), text)
