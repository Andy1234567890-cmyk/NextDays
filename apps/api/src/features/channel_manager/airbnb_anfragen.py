"""Airbnb-Anfragen annehmen, ablehnen, gegenanbieten.

WARUM DIESES MODUL EXISTIERT:
Airbnb schickt drei handlungspflichtige Anfragearten, die KEINE Buchung sind und
deshalb auch keine Buchungs-Revision erzeugen:

  reservation_request  Anfrage zu buchen (Airbnb lehnt nach ~24 h selbst ab)
  inquiry              Voranfrage — vorab genehmigen oder Sonderpreis anbieten
  alteration_request   Änderungswunsch an einer bestehenden Buchung

Bis hierher wurden sie zwar abonniert und als Blob weggeschrieben, aber es gab
keinen einzigen Weg, sie zu BEANTWORTEN: unser `/events/{id}/resolve` setzte nur
ein Flag in unserer eigenen Tabelle. Der Gast hat gewartet, bis Airbnbs
Auto-Decline zuschlug.

DIE FORMEN STAMMEN AUS AIRBNBS EIGENEN DOKUMENTEN
(`docs/OTA/Airbnb/`) — und sie sind absichtlich NICHT gleich. Das ist die
Falle, wegen der dieses Modul überhaupt eigene Bauhelfer hat:

  Reservation Request   `accept` ist ein BOOLEAN (true/false)
  Alteration Request    `accept` ist ein STRING ("accept"/"decline"/"cancel")

Wer beides über eine gemeinsame Funktion schickt, sendet `true` statt "accept"
— Airbnb antwortet 422, und die Frist läuft weiter. Deshalb hat jede Anfrageart
hier ihren eigenen Bauhelfer mit eigenem Typ.

Belegstellen in den Dokumenten:
  Airbnb Reservation Request.pdf  accept true | false + reason + zwei Nachrichten
  Airbnb Alteration Request.pdf   accept "accept" | "decline" | "cancel"
  Airbnb Inquiry.pdf              type "preapproval" (+ block_instant_booking)
                                  type "special_offer" (+ total_price)
"""
from __future__ import annotations

from typing import Any, Final

# --- Reservation Request ---------------------------------------------------
# Die vier erlaubten Ablehnungsgründe, wörtlich aus dem Airbnb-Dokument. Ein
# anderer Wert ist kein Grund, sondern ein 422 — deshalb Allowlist statt
# Durchreichen (Wurzel 3: der Anfrage nicht vertrauen).
ABLEHNUNG_DATEN_BELEGT: Final = "dates_not_available"
ABLEHNUNG_UNPASSEND: Final = "not_a_good_fit"
ABLEHNUNG_WARTET_BESSER: Final = "waiting_for_better_reservation"
ABLEHNUNG_UNWOHL: Final = "not_comfortable"

ABLEHNUNGSGRUENDE: Final[frozenset[str]] = frozenset(
    {
        ABLEHNUNG_DATEN_BELEGT,
        ABLEHNUNG_UNPASSEND,
        ABLEHNUNG_WARTET_BESSER,
        ABLEHNUNG_UNWOHL,
    }
)

# --- Alteration Request ----------------------------------------------------
# STRING-Werte, nicht Boolean. `cancel` zieht einen selbst gestellten
# Änderungswunsch zurück — es ist NICHT dasselbe wie `decline` (den Wunsch des
# Gastes abweisen).
ALTERATION_ANNEHMEN: Final = "accept"
ALTERATION_ABLEHNEN: Final = "decline"
ALTERATION_ZURUECKZIEHEN: Final = "cancel"

ALTERATION_ENTSCHEIDUNGEN: Final[frozenset[str]] = frozenset(
    {ALTERATION_ANNEHMEN, ALTERATION_ABLEHNEN, ALTERATION_ZURUECKZIEHEN}
)

# --- Inquiry ---------------------------------------------------------------
INQUIRY_VORAB_GENEHMIGEN: Final = "preapproval"
INQUIRY_SONDERPREIS: Final = "special_offer"

# Ereignisarten, die dieses Modul auflösen kann.
EVENT_RESERVATION_REQUEST: Final = "reservation_request"
EVENT_INQUIRY: Final = "inquiry"
EVENT_ALTERATION_REQUEST: Final = "alteration_request"

AUFLOESBARE_EVENTS: Final[frozenset[str]] = frozenset(
    {EVENT_RESERVATION_REQUEST, EVENT_INQUIRY, EVENT_ALTERATION_REQUEST}
)

# Airbnb begrenzt die Nachrichten an Gast und an Airbnb. Das Dokument nennt für
# `instant_book_welcome_message` 200 Zeichen; für die Ablehnungsnachrichten
# nennt es KEINE Grenze. Wir kappen deshalb nicht, sondern lehnen zu lange Texte
# ab — stilles Abschneiden würde eine Aussage des Gastgebers verfälschen.
NACHRICHT_MAX_ZEICHEN: Final = 2000


class AnfrageFehler(ValueError):
    """Die gewünschte Auflösung ist nach Airbnbs Regeln nicht sendbar."""


def _nachricht_pruefen(text: str | None, feld: str) -> str | None:
    """Leer → weglassen (Airbnb behandelt beide Nachrichten als optional)."""
    if text is None:
        return None
    sauber = text.strip()
    if not sauber:
        return None
    if len(sauber) > NACHRICHT_MAX_ZEICHEN:
        raise AnfrageFehler(
            f"{feld}: {len(sauber)} Zeichen — höchstens {NACHRICHT_MAX_ZEICHEN}."
        )
    return sauber


def reservation_request_annehmen() -> dict[str, Any]:
    """`{"accept": true}` — Boolean, siehe Modul-Kopf."""
    return {"accept": True}


def reservation_request_ablehnen(
    *,
    grund: str,
    nachricht_an_gast: str | None = None,
    nachricht_an_airbnb: str | None = None,
) -> dict[str, Any]:
    """`{"accept": false, "reason": ..., ...}`.

    Der Grund MUSS einer der vier von Airbnb genannten sein. Ein eigener
    Freitext-Grund wäre ein 422 — und die Anfrage bliebe offen, bis Airbnbs
    Auto-Decline zuschlägt (fail-closed statt fail-open, Wurzel 5).
    """
    if grund not in ABLEHNUNGSGRUENDE:
        erlaubt = ", ".join(sorted(ABLEHNUNGSGRUENDE))
        raise AnfrageFehler(f"Ablehnungsgrund {grund!r} unbekannt. Erlaubt: {erlaubt}")

    resolution: dict[str, Any] = {"accept": False, "reason": grund}
    an_gast = _nachricht_pruefen(nachricht_an_gast, "decline_message_to_guest")
    if an_gast:
        resolution["decline_message_to_guest"] = an_gast
    an_airbnb = _nachricht_pruefen(nachricht_an_airbnb, "decline_message_to_airbnb")
    if an_airbnb:
        resolution["decline_message_to_airbnb"] = an_airbnb
    return resolution


def alteration_entscheiden(entscheidung: str) -> dict[str, Any]:
    """`{"accept": "accept"|"decline"|"cancel"}` — STRING, nicht Boolean."""
    if entscheidung not in ALTERATION_ENTSCHEIDUNGEN:
        erlaubt = ", ".join(sorted(ALTERATION_ENTSCHEIDUNGEN))
        raise AnfrageFehler(
            f"Entscheidung {entscheidung!r} unbekannt. Erlaubt: {erlaubt}"
        )
    return {"accept": entscheidung}


def inquiry_vorab_genehmigen(*, sofortbuchung_sperren: bool) -> dict[str, Any]:
    """`{"type": "preapproval", "block_instant_booking": bool}`.

    `block_instant_booking` sperrt für andere Gäste die Sofortbuchung derselben
    Nächte — der angefragte Gast bekommt sie also reserviert.
    """
    return {
        "type": INQUIRY_VORAB_GENEHMIGEN,
        "block_instant_booking": bool(sofortbuchung_sperren),
    }


def inquiry_sonderpreis(*, gesamtpreis_minor: int) -> dict[str, Any]:
    """`{"type": "special_offer", "total_price": <Minor Units>}`.

    Airbnb nennt ausdrücklich „total_price in lower fraction size (10000 for
    100.00 USD)" — also GANZZAHL in der kleinsten Währungseinheit. Ein Betrag in
    Haupteinheiten wäre ein Faktor-100-Fehler zu Lasten des Betriebs, deshalb
    nimmt diese Funktion NUR Minor Units und weist alles andere ab (keine
    stillschweigende Umrechnung, Wurzel 4).
    """
    if isinstance(gesamtpreis_minor, bool) or not isinstance(gesamtpreis_minor, int):
        raise AnfrageFehler(
            "gesamtpreis_minor muss eine Ganzzahl in Minor Units sein "
            "(10000 = 100,00) — kein Betrag in Haupteinheiten."
        )
    if gesamtpreis_minor <= 0:
        raise AnfrageFehler("gesamtpreis_minor muss größer als 0 sein.")
    return {"type": INQUIRY_SONDERPREIS, "total_price": gesamtpreis_minor}


# --- Aktion des Betriebs → Airbnb-Form ------------------------------------
# Eine Tabelle statt einer Kette von Abfragen: sie hält an EINER Stelle
# zusammen, welche Aktion zu welcher Anfrageart gehört und welcher Bauhelfer die
# (je Art unterschiedliche) Form erzeugt. Eine neue Aktion ist damit eine Zeile
# und kann nicht versehentlich die falsche Form senden.
AKTION_ZU_EVENT: Final[dict[str, str]] = {
    "annehmen": EVENT_RESERVATION_REQUEST,
    "ablehnen": EVENT_RESERVATION_REQUEST,
    "alteration_annehmen": EVENT_ALTERATION_REQUEST,
    "alteration_ablehnen": EVENT_ALTERATION_REQUEST,
    "alteration_zuruecknehmen": EVENT_ALTERATION_REQUEST,
    "vorab_genehmigen": EVENT_INQUIRY,
    "sonderpreis": EVENT_INQUIRY,
}


def resolution_bauen(
    aktion: str,
    *,
    grund: str | None = None,
    nachricht_an_gast: str | None = None,
    nachricht_an_airbnb: str | None = None,
    sofortbuchung_sperren: bool = False,
    gesamtpreis_minor: int | None = None,
) -> dict[str, Any]:
    """Die `resolution` für eine Aktion — mit der je Art richtigen Form.

    Wirft `AnfrageFehler`, wenn die Aktion unbekannt ist oder ein für sie
    nötiger Wert fehlt. Nie eine halb gefüllte Form senden (Wurzel 5).
    """
    if aktion == "annehmen":
        return reservation_request_annehmen()
    if aktion == "ablehnen":
        if not grund:
            raise AnfrageFehler("Zum Ablehnen fehlt der Grund.")
        return reservation_request_ablehnen(
            grund=grund,
            nachricht_an_gast=nachricht_an_gast,
            nachricht_an_airbnb=nachricht_an_airbnb,
        )
    if aktion.startswith("alteration_"):
        return alteration_entscheiden(
            {
                "alteration_annehmen": ALTERATION_ANNEHMEN,
                "alteration_ablehnen": ALTERATION_ABLEHNEN,
                "alteration_zuruecknehmen": ALTERATION_ZURUECKZIEHEN,
            }.get(aktion, "")
        )
    if aktion == "vorab_genehmigen":
        return inquiry_vorab_genehmigen(
            sofortbuchung_sperren=bool(sofortbuchung_sperren)
        )
    if aktion == "sonderpreis":
        if gesamtpreis_minor is None:
            raise AnfrageFehler("Für ein Sonderangebot fehlt der Gesamtpreis.")
        return inquiry_sonderpreis(gesamtpreis_minor=gesamtpreis_minor)
    raise AnfrageFehler(f"Aktion {aktion!r} unbekannt.")
