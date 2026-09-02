"""Portal-Payloads (``channex_booking.raw``) für eine Menge Reservierungen laden.

EINE Stelle statt drei: Abrechnung (`zeilen`), Bericht (`owner_reporting.
auswertung`) und Eigentümer-Kalender (`public_portal`) holten sich die Payloads
bis 02.09.2026 jeweils selbst — jedes Mal nur über ``channex_booking_id``.
Damit blieb der CSV-Bestandsimport blind: seine Buchungen tragen
``source_channex_booking_id = "csv:<ota_reservation_code>"``, und Channex hat
dieselbe Buchung SEHR WOHL (als Import mit Tagespreisen, ohne Gebühren) — nur
unter seiner eigenen ID. Live am 02.09.2026: 54 von 259 CSV-Buchungen haben
so einen Channex-Zwilling, und genau der liefert die Nächte-Summe, aus der die
im CSV-Gesamtpreis steckenden Gebühren erst ableitbar werden
(``gebuehren_quelle._csv_gebuehren``).

Der Schlüssel der Rückgabe ist IMMER ``source_channex_booking_id`` der
Reservierung — auch für den CSV-Zwilling. Die Verbraucher schlagen weiter mit
demselben Schlüssel nach; nur die Quelle dahinter ist breiter geworden.
"""

from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING, Any

from src.core.logging import get_logger
from src.core.supabase import fetch_all_rows

if TYPE_CHECKING:
    from supabase import Client

log = get_logger("nextdays.owner_statements.payloads")

CSV_PRAEFIX = "csv:"


def payloads_laden(
    db: Client, tenant_id: str, reservations: list[dict[str, Any]]
) -> dict[str, Any]:
    """``source_channex_booking_id`` → ``channex_booking.raw`` für alle Zeilen.

    Zwei Wege, ein Ergebnis:

    * Feed-Buchung: ``channex_booking_id`` ist der Schlüssel selbst.
    * CSV-Bestandsimport: der Zwilling wird über ``ota_reservation_code =
      reservations.external_ref`` gefunden und unter dem CSV-Schlüssel
      abgelegt. Ohne Zwilling bleibt der Eintrag leer — kein Ersatz.

    Tenant-gescoped (Wurzel 3): ein Reservierungscode eines anderen Portals
    oder Betriebs darf nie als Zwilling durchgehen.
    """
    codes = sorted(
        {
            str(r["source_channex_booking_id"])
            for r in reservations
            if r.get("source_channex_booking_id")
            and not str(r["source_channex_booking_id"]).startswith(CSV_PRAEFIX)
        }
    )
    payloads: dict[str, Any] = {}
    if codes:
        for row in fetch_all_rows(
            db.table("channex_booking")
            .select("channex_booking_id, raw")
            .eq("tenant_id", tenant_id)
            .in_("channex_booking_id", codes)
            .order("channex_booking_id")
        ):
            code = str(row.get("channex_booking_id") or "")
            if code:
                payloads[code] = row.get("raw")

    csv_je_code: dict[str, str] = {}
    for r in reservations:
        quelle = str(r.get("source_channex_booking_id") or "")
        ext = str(r.get("external_ref") or "").strip()
        if quelle.startswith(CSV_PRAEFIX) and ext:
            csv_je_code[ext] = quelle
    if csv_je_code:
        gefunden = 0
        for row in fetch_all_rows(
            db.table("channex_booking")
            .select("ota_reservation_code, raw")
            .eq("tenant_id", tenant_id)
            .in_("ota_reservation_code", sorted(csv_je_code))
            .order("ota_reservation_code")
        ):
            code = str(row.get("ota_reservation_code") or "")
            schluessel = csv_je_code.get(code)
            if schluessel and row.get("raw") is not None:
                payloads[schluessel] = row.get("raw")
                gefunden += 1
        log.info(
            "csv_zwillinge_geladen",
            tenant_id=tenant_id,
            csv_buchungen=len(csv_je_code),
            mit_channex_zwilling=gefunden,
        )

    # Dritte Quelle (0528): Payloads, die NICHT über Channex kamen — der
    # Airbnb-Historie-Import legt die Original-Reservierung dort ab. Sie
    # ergänzt nur, was Channex nicht hat; ein Feed-Payload bleibt führend.
    schluessel_je_reservierung = {
        str(r["id"]): str(r.get("source_channex_booking_id") or "")
        for r in reservations
        if r.get("id") and r.get("source_channex_booking_id")
    }
    fehlend = [
        rid for rid, key in schluessel_je_reservierung.items() if key not in payloads
    ]
    if fehlend:
        for row in fetch_all_rows(
            db.table("portal_buchungs_payloads")
            .select("reservation_id, raw")
            .eq("tenant_id", tenant_id)
            .in_("reservation_id", sorted(fehlend))
            .order("reservation_id")
        ):
            key = schluessel_je_reservierung.get(str(row.get("reservation_id") or ""))
            if key and row.get("raw") is not None:
                payloads[key] = row.get("raw")
    return payloads


def csv_muster_je_objekt(
    db: Client, tenant_id: str, property_ids: list[str]
) -> dict[str, str]:
    """Je Objekt: steckt die Portal-Gebühr im CSV-Betrag („im_betrag") oder
    nicht („obendrauf")? Gelernt aus den CSV-Buchungen MIT Channex-Zwilling.

    Anlass (02.09.2026, Betrieb AirSmil): Bei Perlen, Oluf, Rævlingehuset ist
    der Booking-Betrag Nächte + Reinigung (Differenz zur Channex-Nächtesumme
    > 0); bei Line, Britt, Dora ist er EXAKT die Nächtesumme — die Reinigung
    ist dort nicht im Preis. Dasselbe Haus verhält sich dabei immer gleich.
    Für CSV-Buchungen OHNE Zwilling (Bestand vor dem Channex-Anschluss, 123
    Buchungen) ist dieses Muster die einzige belegbare Grundlage; ohne sie
    müsste man raten.

    Rückgabe nur für Objekte mit mindestens einem Beleg; Mehrheit entscheidet,
    bei Gleichstand „im_betrag". Ein Objekt ohne Eintrag bekommt beim Aufrufer
    die Vorgabe des Betriebs („im_betrag").
    """
    if not property_ids:
        return {}
    from .gebuehren_quelle import booking_naechte_summe  # noqa: PLC0415

    zeilen = fetch_all_rows(
        db.table("reservations")
        .select("id, property_id, total_amount, source_channex_booking_id, external_ref")
        .eq("tenant_id", tenant_id)
        .in_("property_id", sorted(set(property_ids)))
        .in_("status", ["confirmed", "completed"])
        .like("source_channex_booking_id", f"{CSV_PRAEFIX}%")
        .order("id")
    )
    if not zeilen:
        return {}
    payloads = payloads_laden(db, tenant_id, zeilen)
    stimmen: dict[str, dict[str, int]] = {}
    for r in zeilen:
        raw = payloads.get(str(r.get("source_channex_booking_id") or ""))
        naechte = booking_naechte_summe(raw)
        total = r.get("total_amount")
        if naechte is None or total is None:
            continue
        differenz = Decimal(str(total)) - naechte
        muster = "obendrauf" if differenz == 0 else "im_betrag"
        pid = str(r.get("property_id") or "")
        stimmen.setdefault(pid, {"im_betrag": 0, "obendrauf": 0})[muster] += 1
    out = {
        pid: ("obendrauf" if s["obendrauf"] > s["im_betrag"] else "im_betrag")
        for pid, s in stimmen.items()
    }
    log.info("csv_muster_gelernt", tenant_id=tenant_id, muster=out, stimmen=stimmen)
    return out
