"""Welche Gebührenart ist bei welchem Portal NACHWEISLICH hinterlegt?

DIE FRAGE, DIE DER CHIP VORHER FALSCH BEANTWORTETE: die Oberfläche zeigte an
einer Gebühr die Portale, die sie NICHT per Sync bekommen („dort manuell
pflegen"). Der Betrieb liest daran aber ab, WO die Gebühr liegt — und für eine
Gebühr, die er längst im Extranet gepflegt hat, sagte der Chip weiterhin
„fehlt dort". Live am 11.08.2026: die Reinigungsgebühr steht bei Airbnb UND bei
Booking.com, der Chip zeigte sie bei keinem von beiden.

DER BELEG IST DIE BUCHUNG. Erscheint eine Gebührenart in der Preisaufstellung
einer echten Buchung dieses Portals, dann hat das Portal sie dem Gast berechnet
— das ist keine Einschätzung, sondern ein Zahlungsvorgang. Beide Portale liefern
die Aufstellung mit, an verschiedenen Stellen (Airbnb
``standard_fees_details``, Booking ``price_details.guest_view.taxes``); den
Unterschied kennt schon ``owner_statements.gebuehren_quelle``, und genau dieser
eine Leser wird hier benutzt, damit es keine zweite Auslegung derselben Payloads
gibt.

WARUM ZUSÄTZLICH DER ZURÜCKGELESENE STAND BLEIBT (``ota_gebuehren_stand``): der
Buchungs-Nachweis kommt erst, wenn eine Buchung eingegangen ist. Für ein neu
gepflegtes Inserat ohne Buchung sagt er nichts — dort ist das Rücklesen die
einzige Quelle. Beide Aussagen stehen deshalb nebeneinander und werden nicht
verrechnet: die eine sagt „ein Gast hat es bezahlt", die andere „es steht im
Inserat". Für Booking gibt es über Channex keinen Rückleseweg, dort ist die
Buchung die einzige Quelle.

WAS HIER NICHT PASSIERT: kein Channex-Aufruf. Gelesen werden ausschliesslich die
Payloads, die beim Buchungsimport ohnehin gespeichert wurden. Ein Live-Call je
Seitenaufbau hinge die Preise-Seite an eine fremde Antwortzeit.
"""
from __future__ import annotations

from typing import Any

from supabase import Client

from src.features.owner_statements.common import PayoutUnbekannt
from src.features.owner_statements.gebuehren_quelle import portal_posten

from .common import log

# Wie viele Buchungen je Objekt für den Nachweis gelesen werden.
#
# Der Nachweis ist eine JA/NEIN-Aussage je (Gebührenart, Portal) — dafür genügt
# EIN Fund. Die Grenze steht trotzdem, weil ein Objekt mit 300 Buchungen sonst
# 300 Payloads durch die JSON-Schälung schickt, nur um dieselbe Antwort zu
# bekommen. Absteigend nach Anreise gelesen: was das Portal HEUTE berechnet,
# steht in den neuesten Buchungen. Eine vor zwei Jahren abgeschaffte Gebühr soll
# nicht als „liegt dort" erscheinen.
_MAX_BUCHUNGEN = 40


def belege_je_gebuehrenart(
    db: Client, tenant_id: str, property_id: str
) -> dict[str, list[str]]:
    """``fee_type`` → Portal-Codes, bei denen die Art nachweislich hinterlegt ist.

    Der Portal-Code ist derselbe wie in ``channex_channel_connection``
    (``ota_portal_code``), damit die Oberfläche ihn ohne Übersetzungstabelle
    gegen die verbundenen Portale halten kann.

    Eine leere Karte heißt „kein Nachweis" und NICHT „liegt nirgends": ein Objekt
    ohne Buchungen kann keinen Beleg haben. Die Oberfläche muss beides
    unterscheiden, sonst behauptete sie für ein neues Inserat, dort läge nichts.
    """
    zeilen = _buchungen_lesen(db, tenant_id, property_id)
    out: dict[str, set[str]] = {}
    for zeile in zeilen:
        portal = _portal_code(zeile.get("ota_name"))
        if not portal:
            continue
        for art in _arten_der_buchung(zeile.get("raw")):
            out.setdefault(art, set()).add(portal)
    return {art: sorted(portale) for art, portale in out.items()}


def _buchungen_lesen(
    db: Client, tenant_id: str, property_id: str
) -> list[dict[str, Any]]:
    """Die neuesten Buchungs-Payloads dieses Objekts.

    Tenant-gescoped (Wurzel 3): der Service-Role-Key umgeht RLS, also muss der
    Scope explizit stehen — sonst liesse sich mit einer fremden ``property_id``
    die Preisstruktur eines anderen Betriebs auslesen.

    ``property_id`` steht seit 0293 direkt an der Buchung; der Umweg über
    ``property_map_id`` wäre ein zweiter Join, der bei fehlender Zuordnung still
    zu wenig fände.
    """
    try:
        return (
            db.table("channex_booking")
            .select("ota_name, raw, arrival_date")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .order("arrival_date", desc=True)
            .limit(_MAX_BUCHUNGEN)
            .execute()
        ).data or []
    except Exception as exc:  # noqa: BLE001 — der Nachweis ist ein Zusatz
        # Fällt die Abfrage aus, gibt es KEINEN Nachweis — das ist eine ehrliche
        # leere Antwort. Die Preise-Seite darf daran nicht scheitern; sie zeigt
        # dann nur die übrigen Aussagen (Wurzel 5: best-effort, markiert).
        log.warning(
            "gebuehren_belege_lesen_fehlgeschlagen",
            tenant_id=tenant_id,
            property_id=property_id,
            error=str(exc),
        )
        return []


def _arten_der_buchung(raw: object) -> list[str]:
    """Die Gebührenarten, die diese Buchung dem Gast berechnet hat.

    Benutzt ``portal_posten`` aus ``owner_statements.gebuehren_quelle`` —
    dieselbe Auslegung der Payloads UND dieselbe Reihenfolge der Stellen, mit
    denen die Auszahlung rechnet. Eine eigene Schälung hier wäre die zweite
    Wahrheit, die genau dann auseinanderläuft, wenn ein Portal sein Format
    ändert: als ``rooms[].taxes`` als bessere erste Stelle dazukam, hätte eine
    Kopie hier weiter die alte gelesen und dem Betrieb eine andere Gebührenliste
    gezeigt als seine Abrechnung.

    Eine unbekannte Gebührenart im Payload lässt den Leser werfen. Für den
    NACHWEIS ist das kein Fehler: er beantwortet nur „liegt dort", und eine Art,
    die wir nicht benennen können, kann keiner Zeile zugeordnet werden. Sie wird
    darum still übersprungen — die Auszahlungsrechnung meldet denselben Payload
    weiterhin als offenen Punkt, dort gehört die Meldung hin.
    """
    try:
        gefunden = portal_posten(raw)
    except PayoutUnbekannt:
        return []
    if gefunden is None:
        return []
    posten, _bezeichnungen = gefunden
    return [art for art, _betrag in posten]


def _portal_code(ota_name: object) -> str | None:
    """Channex' ``ota_name`` auf den Portal-Code der Verbindungen abbilden.

    Die Schreibweisen unterscheiden sich: Channex liefert ``BookingCom`` und
    ``AirBNB``, die Verbindungen führen ``booking`` bzw. ``airbnb``. Die
    Zuordnung steht ausdrücklich und wird nicht per Kleinschreibung geraten —
    ``BookingCom`` würde sonst zu ``bookingcom`` und träfe keine Verbindung, und
    der Chip fehlte genau bei dem Portal, um das es geht (derselbe Fehler wie
    live am 07.08.2026 bei der Kanal-Zuordnung im Kalender).
    """
    name = str(ota_name or "").strip().lower().replace(".", "").replace(" ", "")
    if not name:
        return None
    return {
        "bookingcom": "booking",
        "booking": "booking",
        "airbnb": "airbnb",
        "vrbo": "vrbo",
        "expedia": "expedia",
        "agoda": "agoda",
        "hostelworld": "hostelworld",
        "tripcom": "tripcom",
    }.get(name)
