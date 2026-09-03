"""Gebühren, die Booking.com-Buchungen DIESES Objekts mitbringen — lesen und übernehmen.

WARUM (03.09.2026): Die Booking-Buchung 5522296055 für „Feriehus Kornblomst"
brachte „Stromkosten DKK 125,00" mit. Am Objekt standen nur Resort, Reinigung
und Haustier. Die Eigentümer-Abrechnung blockierte mit „Die Gebührenart
`electricity` ist nicht zugeordnet" und verlangte Handarbeit für eine Angabe,
die im Payload jeder Buchung steht. Anweisung: das System erkennt sie selbst
und trägt sie am Objekt ein.

NUR BOOKING.COM. Diese Datei liest ausschließlich Bookings Payload-Form; sie
ist nicht von einem anderen Portal abgeleitet und gilt für kein anderes. Jedes
Portal hat sein eigenes Datenmodell (CLAUDE.md: „NIE ein Portal aus einem
anderen ableiten"), deshalb steht hier ein harter Kanal-Filter auf
``ota_name``/``channel``.

WAS BOOKING LIEFERT — gemessen 03.09.2026 an allen 788 Payloads der Live-DB
(82 Posten in 37 Aufstellungen), je Posten unter
``rooms[].meta.price_details.guest_view.taxes``:

    tax_description         charge_frequency   amount (Minor)
    Reinigungsgebühr                    12     79500
    Stromkosten                         19     12500
    Mehrwertsteuer (25%)                12     97150

und daneben unter ``rooms[].meta.charge_periods`` die Lage je sprachneutralem
Schlüssel::

    "CLEANINGFEE":     [{"excluded": true,  "from": "2026-05-01", "to": null}]
    "ELECTRICITYFEE":  [{"excluded": true,  "from": "2026-05-01", "to": null}]
    "VAT":             [{"excluded": false, "from": "2026-05-01", "to": null}]

Daraus ist die Objekt-Gebühr vollständig bestimmbar:

  * **Art** — über den sprachneutralen Schlüssel bzw. den Anzeigenamen
    (`gebuehren_quelle`, dieselbe Erkennung wie die Abrechnung).
  * **Betrag und Basis** — ``charge_frequency`` 12 = je Aufenthalt, 19 = je
    Nacht; der ``amount`` ist die SUMME des Aufenthalts, bei Nacht-Basis also
    durch die Nächte zu teilen (Stromkosten 125,00 bei 5 Nächten = 25,00/Nacht,
    genau die Form des vorhandenen Resort-Eintrags).
  * **Lage** — ``excluded: true`` heißt „nicht im Zimmerpreis", also ein
    eigener Posten, den Booking über dem Strich zeigt. Nur der ist eine
    zusätzliche Leistung und gehört als Objekt-Gebühr angelegt; ``false`` ist
    Bookings „Rate Included" (die Mehrwertsteuer) und wird nie übernommen.

WAS NICHT ÜBERNOMMEN WIRD (Wurzel 4 — kein Ratewert):
  * eine Art, die das Objekt SCHON führt: der dort gepflegte Betrag ist die
    Vereinbarung des Betriebs und wird nicht nach einer einzelnen Buchung
    überschrieben.
  * eine Art ohne Lage-Angabe: ohne ``excluded`` ist nicht belegt, ob sie
    obendrauf kommt — dann bleibt es bei der Rückfrage.
  * Steuern und Abgaben (``VAT``, ``CITYTAX``): sie laufen durch und sind keine
    Leistung des Objekts. Der Leser gibt sie gar nicht heraus.
  * eine unbekannte ``charge_frequency``: die Basis entscheidet, ob ein Betrag
    einmal oder fünfmal in die Rechnung geht — ein falscher Ratewert wäre ein
    Geldfehler, den niemand als Bug erkennt.
"""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING, Any

from src.core.logging import get_logger
from src.core.supabase import fetch_all_rows

if TYPE_CHECKING:
    from supabase import Client

log = get_logger("nextdays.properties.booking_gebuehren")

# Bookings ``charge_frequency`` → unsere Basis. Nur die Codes, die live
# vorkommen; ein unbekannter Code führt zum Verwerfen, nicht zu einer Vorgabe.
FREQUENZ_AUF_BASIS: dict[str, str] = {
    "12": "per_stay",
    "19": "per_night",
}

# Nur diese Kanalnamen. `ota_name` kommt in beiden Schreibweisen vor (live:
# „BookingCom" und „Booking.com"), deshalb wird normalisiert verglichen.
_BOOKING_OTA_NAMEN = frozenset({"bookingcom", "booking.com", "booking"})


def _ist_booking(ota_name: object) -> bool:
    return str(ota_name or "").strip().casefold().replace(" ", "") in _BOOKING_OTA_NAMEN


def _betrag(posten: dict[str, Any]) -> Decimal | None:
    """``amount`` in Minor Units → Betrag in der Währung. None = unbrauchbar.

    ``decimal_places`` steht am Posten und ist live durchgängig 2; es wird
    gelesen statt angenommen — eine Währung ohne Dezimalstellen (JPY, ISK) käme
    sonst hundertfach zu hoch an.
    """
    roh = posten.get("amount")
    if roh is None:
        return None
    # `or 2` wäre hier falsch: `decimal_places: 0` ist ein GÜLTIGER Wert
    # (JPY, ISK) und würde von `or` auf 2 gezogen — der Betrag käme
    # hundertfach zu niedrig an. Nur ein FEHLENDES Feld fällt auf 2 zurück,
    # den live durchgängigen Wert.
    stellen_roh = posten.get("decimal_places")
    try:
        minor = Decimal(str(roh))
        stellen = 2 if stellen_roh is None else int(stellen_roh)
    except (ArithmeticError, TypeError, ValueError):
        return None
    if minor <= 0 or not 0 <= stellen <= 6:
        return None
    return minor / (Decimal(10) ** stellen)


def fee_aus_posten(
    art: str, posten: dict[str, Any], *, naechte: int
) -> dict[str, Any] | None:
    """Ein Booking-Posten als Objekt-Gebühr. ``None`` = nicht übernehmbar.

    ``name`` ist der Text, den der Gast bei Booking gesehen hat
    (``tax_description``, z. B. „Stromkosten"); nur wenn er fehlt, tritt das
    Katalog-Label ein. ``names`` wird allein für Deutsch gefüllt — ein
    maschinell übersetzter Gasttext wäre geraten, die übrigen Sprachen pflegt
    der Betrieb im Editor nach.
    """
    # Lokal importiert: `gebuehren` holt sich `fehlende_gebuehren` von hier,
    # ein Modul-Import wäre ein Zirkel.
    from .gebuehren import FEE_TYPE_LABEL  # noqa: PLC0415

    basis = FREQUENZ_AUF_BASIS.get(str(posten.get("charge_frequency") or "").strip())
    if basis is None:
        return None
    gesamt = _betrag(posten)
    if gesamt is None:
        return None
    if basis == "per_night":
        if naechte <= 0:
            return None
        # Booking liefert die SUMME des Aufenthalts; die Nacht-Basis erwartet
        # den Satz je Nacht.
        betrag = gesamt / Decimal(naechte)
    else:
        betrag = gesamt

    name = str(posten.get("tax_description") or "").strip() or FEE_TYPE_LABEL.get(
        art, art
    )
    return {
        "id": str(uuid.uuid4()),
        "name": name,
        "names": {"de": name},
        "feeType": art,
        "mode": "amount",
        "basis": basis,
        "optional": False,
        "amount": float(betrag),
    }


def _naechte(row: dict[str, Any]) -> int:
    an, ab = row.get("check_in"), row.get("check_out")
    try:
        return (date.fromisoformat(str(ab)) - date.fromisoformat(str(an))).days
    except (TypeError, ValueError):
        return 0


def arten_aus_buchungen(
    db: Client, tenant_id: str, property_id: str, bestand: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    """ALLE Gebühren aus den Booking-Buchungen dieses Objekts.

    Anders als ``fehlende_gebuehren`` filtert diese Funktion NICHT gegen den
    Objekt-Bestand: sie sagt, welche Arten das Portal an diesem Objekt
    überhaupt berechnet. Gebraucht für die Abrechnungs-Zuordnung, die auch für
    eine bereits am Objekt stehende Art nötig ist — sonst bliebe eine früher
    übernommene Gebühr für immer ohne Regel (live 03.09.2026).
    """
    return _aus_buchungen(db, tenant_id, property_id, bestand, nur_fehlende=False)


def fehlende_gebuehren(
    db: Client, tenant_id: str, property_id: str, bestand: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    """Gebühren, die Booking-Buchungen dieses Objekts mitbringen und die fehlen.

    Gelesen wird ``channex_booking.raw`` mit denselben Lesern wie die
    Abrechnung (``owner_statements.gebuehren_quelle``) — nicht eine zweite
    Auslegung derselben Daten. Zwei Leser wären zwei Wahrheiten: die Seite
    zeigte eine Gebühr, die die Rechnung nicht sieht, oder umgekehrt.

    Tenant-gescoped (Wurzel 3): der Payload eines anderen Betriebs darf hier
    nie durchschlagen.

    Die JÜNGSTE Buchung gewinnt: sortiert nach Anreise, spätere Werte
    überschreiben frühere. Booking kann den Betrag am Inserat ändern, und dann
    ist der aktuelle Stand der richtige — nicht der von vor einem Jahr.
    """
    return _aus_buchungen(db, tenant_id, property_id, bestand, nur_fehlende=True)


def _aus_buchungen(  # noqa: PLR0913 — benannte Eingänge
    db: Client,
    tenant_id: str,
    property_id: str,
    bestand: list[dict[str, Any]],
    *,
    nur_fehlende: bool,
) -> list[dict[str, Any]]:
    """Der gemeinsame Kern. ``nur_fehlende`` filtert gegen den Objekt-Bestand."""
    # Lokal, weil `owner_statements` seinerseits auf `properties` zugreift.
    from src.features.owner_statements.booking_leser import (  # noqa: PLC0415
        booking_gebuehren_lage,
        booking_rohposten,
    )
    from src.features.owner_statements.common import (  # noqa: PLC0415
        PayoutUnbekannt,
    )
    from src.features.owner_statements.payloads import (  # noqa: PLC0415
        payloads_laden,
    )

    zeilen = [
        r
        for r in fetch_all_rows(
            db.table("reservations")
            .select(
                "id, ota_name, check_in, check_out, "
                "source_channex_booking_id, external_ref"
            )
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .in_("status", ["confirmed", "completed"])
            .order("check_in")
        )
        if _ist_booking(r.get("ota_name"))
    ]
    if not zeilen:
        return []

    payloads = payloads_laden(db, tenant_id, zeilen)
    vorhanden = {
        str(f.get("feeType") or "").strip()
        for f in bestand
        if isinstance(f, dict)
    }
    gefunden: dict[str, dict[str, Any]] = {}
    for r in zeilen:
        raw = payloads.get(str(r.get("source_channex_booking_id") or ""))
        if not isinstance(raw, dict):
            continue
        try:
            rohposten = booking_rohposten(raw)
            lage = booking_gebuehren_lage(raw)
        except PayoutUnbekannt:
            # Nicht auflösbar — die Abrechnung meldet es an ihrer Stelle. Hier
            # geht es um einen Vorschlag; ein Lesefehler darf die Seite nicht
            # kippen (Wurzel 5: best effort, Hauptpfad bleibt stehen).
            continue
        naechte = _naechte(r)
        for art, posten in rohposten.items():
            if nur_fehlende and art in vorhanden:
                continue
            # Ohne belegte Lage wird NICHT „obendrauf" unterstellt (Wurzel 4).
            if lage.get(art) is not True:
                continue
            fee = fee_aus_posten(art, posten, naechte=naechte)
            if fee is not None:
                gefunden[art] = fee
    return list(gefunden.values())

def zuordnung_nachziehen(
    db: Client, tenant_id: str, arten: list[str], *, zugeordnet_von: str | None
) -> list[str]:
    """Für übernommene Booking-Gebühren die Abrechnungs-Zuordnung mitschreiben.

    WARUM DAS HIER PASSIERT (03.09.2026): Der Objekt-Import legte „Stromkosten"
    als Gebühr an — die Eigentümer-Abrechnung blockierte danach WEITER, weil
    `fee_classification` unberührt blieb. Zwei Tabellen, zwei Vorgänge: die
    Gebühr sagt, WAS berechnet wird, die Zuordnung, WEM das Geld gehört. Wer
    eine Gebühr aus einer Buchung übernimmt, hat den ersten Teil erledigt und
    stand vor derselben Blockade wie vorher. Anweisung: das System schreibt es
    beim Import mit.

    DER WERT IST EINE ENTSCHEIDUNG, KEINE ABLEITUNG. Booking belegt nur, DASS
    die Gebühr anfiel und dass der Gast sie ZUSÄTZLICH zum Zimmerpreis zahlte
    (`charge_periods[].excluded = true`); wem sie gehört, sagt kein Feld des
    Payloads — `code` ist bei Reinigung, Resort und Strom identisch `14`,
    `type` bei allen „Inclusive". Der Betrieb hat am 03.09.2026 entschieden:
    eine über die Buchung hereinkommende Gebühr gehört dem **Eigentümer** und
    ist **provisionsfrei** — dieselbe Zuordnung, die er für `resort` von Hand
    gewählt hatte. Sachlich deckt sich das mit der Herkunft: der Gast zahlt für
    Verbrauch und Ausstattung des vermieteten Objekts, nicht für eine Leistung
    des Betriebs (Reinigung und Haustierbetreuung erbringt der Betrieb, und
    genau die stehen bei ihm).

    ÜBERSCHREIBT NIE. Existiert für eine Art schon eine Betriebsregel, bleibt
    sie unangetastet — sie ist die Entscheidung des Betriebs, und ein Import
    darf sie nicht kippen (Wurzel 1: der Gegenzustand wird gepflegt, nicht
    überfahren). Damit ist der Aufruf auch idempotent (Wurzel 2).

    Rückgabe: die Arten, für die eine Regel NEU angelegt wurde.
    """
    if not arten:
        return []
    bestehend = {
        str(r.get("fee_type") or "")
        for r in (
            db.table("fee_classification")
            .select("fee_type, property_id")
            .eq("tenant_id", tenant_id)
            .in_("fee_type", sorted(set(arten)))
            .execute()
        ).data
        or []
        if not r.get("property_id")
    }
    angelegt: list[str] = []
    for art in sorted(set(arten) - bestehend):
        try:
            db.table("fee_classification").insert(
                {
                    "tenant_id": tenant_id,
                    "fee_type": art,
                    "property_id": None,
                    "gehoert_zu": "eigentuemer",
                    "provisionspflichtig": False,
                    "zugeordnet_von": zugeordnet_von,
                    "zugeordnet_am": "now()",
                    "notiz": (
                        "Automatisch beim Übernehmen der Booking-Gebühr gesetzt: "
                        "über die Buchung hereinkommende Gebühren gehören dem "
                        "Eigentümer und sind provisionsfrei."
                    ),
                }
            ).execute()
            angelegt.append(art)
        except Exception as exc:  # noqa: BLE001 — Übernahme darf nicht kippen
            # Ein gleichzeitiger zweiter Aufruf war schneller (23505), oder die
            # Zuordnung ließ sich nicht schreiben. Die Gebühr selbst steht dann
            # am Objekt; die Abrechnung meldet die fehlende Zuordnung an ihrer
            # Stelle, statt hier die ganze Übernahme zu verlieren (Wurzel 5).
            log.warning(
                "booking_zuordnung_nicht_gesetzt",
                tenant_id=tenant_id,
                fee_type=art,
                error=str(exc),
            )
    return angelegt

def zugeordnete_arten(db: Client, tenant_id: str, arten: list[str]) -> set[str]:
    """Welche dieser Arten haben schon eine BETRIEBSREGEL in ``fee_classification``?

    Nur ``property_id is null`` zählt: eine Objekt-Ausnahme deckt genau ein
    Objekt, die Abrechnung eines anderen blockiert weiter.
    """
    sauber = sorted({a for a in arten if a})
    if not sauber:
        return set()
    rows = (
        db.table("fee_classification")
        .select("fee_type, property_id")
        .eq("tenant_id", tenant_id)
        .in_("fee_type", sauber)
        .execute()
    ).data or []
    return {
        str(r.get("fee_type") or "") for r in rows if not r.get("property_id")
    }
