"""Die Portal-Zerlegung einer Buchung ERMITTELN und FESTHALTEN (0366).

Warum es diese Schicht gibt: bis 11.08.2026 leiteten drei Ansichten
(Eigentümer-Kalender, Einnahmen-Übersicht, Abrechnung) dieselben Beträge
unabhängig voneinander aus einem JSON-Blob ab. Das hat zwei echte Rechenfehler
erzeugt, die beide plausibel aussahen:

* Airbnb schreibt in ``total_amount`` den ``payout_amount`` — die Auszahlung
  NACH Abzug der Portal-Provision. Als Übernachtungspreis gelesen wurde die
  Provision ein zweites Mal abgezogen. Symptom: der gemeldete Abzug entsprach
  scheinbar 12,34 %–17,02 % je Buchung bei tatsächlich konstant 15,50 %.
* Booking.com schreibt dort den Gastpreis INKLUSIVE Gebühren. Die
  Objekt-Gebühren obendrauf zählten sie doppelt.

Nach der Korrektur ergeben alle 26 Live-Buchungen mit gemeldeter Provision
exakt den vereinbarten Satz (22/22 Airbnb 15,50 %, 4/4 Booking 15,00 %).

WAS HIER GESPEICHERT WIRD — und was ausdrücklich nicht: ausschliesslich der
PORTAL-Teil (Übernachtung, Gebühren, Portal-Provision, Zahlungsgebühr). Das ist
eine Tatsache und ändert sich nie mehr. Die VERWALTUNGSPROVISION bleibt
Laufzeitrechnung aus dem Abrechnungsvertrag (0343): ein Vertrag wird korrigiert,
und gespeichert müsste jede Korrektur einen Nachrechnungs-Job über alle
betroffenen Buchungen auslösen — vergisst er eine, zeigt die Abrechnung
dauerhaft eine veraltete Zahl. Trennlinie: Tatsache = gespeichert,
Vereinbarung = gerechnet.
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from supabase import Client

from src.core.logging import get_logger

from .common import (
    Gebuehr,
    PayoutUnbekannt,
    gastpreis,
    portal_abzug,
    portal_zieht_ein,
    zu_decimal,
)
from .gebuehren_quelle import (
    GebuehrenBefund,
    booking_naechte_summe,
    gebuehren_der_buchung,
)

log = get_logger("nextdays.portal_finanzen")


@dataclass(frozen=True, slots=True)
class PortalFinanzen:
    """Die ermittelte Zerlegung EINER Buchung, bereit zum Speichern.

    ``provision_gemeldet`` unterscheidet Beleg von Rekonstruktion: eine vom
    Portal gemeldete Provision ist eine Tatsache, eine aus dem hinterlegten Satz
    errechnete unsere Annahme. Ohne diese Unterscheidung liesse sich später nicht
    sagen, welchen Zahlen man trauen kann.
    """

    reservation_id: str
    tenant_id: str
    uebernachtung: Decimal
    brutto: Decimal
    provision: Decimal
    provision_gemeldet: bool
    zahlungsgebuehr: Decimal
    quelle: str
    currency: str
    gebuehren: list[Gebuehr]
    # Der Originaltext des Portals je Gebührenart, wo es einen liefert. Bei einer
    # unbekannten Art ist genau dieser Text die Antwort auf „was muss ich
    # zuordnen".
    bezeichnungen: dict[str, str]


def zerlegung_ermitteln(
    *,
    reservation: dict[str, Any],
    raw: object,
    type_attributes: dict[str, Any] | None,
    klassifikation: dict[tuple[str, str | None], tuple[str, bool]],
    naechte: int,
    satz: dict[str, Any] | None,
) -> PortalFinanzen:
    """Die Zerlegung einer Buchung aus Payload und Stammdaten bestimmen.

    Reine Rechnung, kein DB-Zugriff — damit sie in den Tests ohne Fake-DB prüfbar
    bleibt und der Schreibvorgang (``zerlegung_speichern``) getrennt davon
    idempotent gehalten werden kann.

    ``satz`` ist der hinterlegte Portal-Abzugssatz (0364) und wird nur gebraucht,
    wenn das Portal seine Provision NICHT mitmeldet.
    """
    currency = str(reservation.get("currency") or "").strip().upper()
    if not currency:
        raise PayoutUnbekannt(
            "betrag",
            "Reservierung ohne Währung — die Zerlegung ist nicht ausweisbar.",
        )

    befund = gebuehren_der_buchung(
        raw=raw,
        type_attributes=type_attributes,
        naechte=naechte,
        klassifikation=klassifikation,
        property_id=str(reservation.get("property_id") or ""),
        # Entscheidet im Stammdaten-Rückfall, welche der gepflegten Gebühren bei
        # DIESER Buchung anfiel (z. B. Haustier nur mit Tier).
        reservierung=reservation,
    )
    total = reservation.get("total_amount")
    basis = befund.basisbetrag(total)
    brutto = gastpreis(
        uebernachtung=basis,
        gebuehren=befund.gebuehren,
        gebuehren_im_betrag=befund.im_gesamtpreis,
    )
    # Die gespeicherte `uebernachtung` ist der REINE Übernachtungsbetrag. Bei
    # Booking ist der Basisbetrag der Gastpreis inklusive Gebühren; der reine
    # Wert kommt dann aus der Tagespreis-Aufstellung (`rooms[].days`), die live
    # bei allen 55 Booking-Buchungen vorliegt. Ihn stattdessen als
    # „Brutto minus Gebühren" zu rechnen ginge auch, wäre aber eine Ableitung
    # statt einer gemeldeten Zahl — und würde einen Rundungsfehler des Portals
    # stillschweigend in die Übernachtung schieben.
    uebernachtung = _reine_uebernachtung(
        befund=befund, brutto=brutto, raw=raw, basis=basis
    )

    gemeldet = zu_decimal(reservation.get("ota_commission"))
    abzug = portal_abzug(
        kanal=reservation.get("channel"),
        brutto=brutto,
        gemeldete_provision=gemeldet,
        provision_pct=(satz or {}).get("provision_pct"),
        zahlungsgebuehr_pct=(satz or {}).get("zahlungsgebuehr_pct"),
        zieht_portal_ein=portal_zieht_ein(
            reservation.get("channel"), reservation.get("payment_collect")
        ),
    )
    return PortalFinanzen(
        reservation_id=str(reservation["id"]),
        tenant_id=str(reservation["tenant_id"]),
        uebernachtung=uebernachtung,
        brutto=brutto,
        provision=abzug.provision,
        provision_gemeldet=gemeldet is not None,
        zahlungsgebuehr=abzug.zahlungsgebuehr,
        quelle=befund.quelle,
        currency=currency,
        gebuehren=befund.gebuehren,
        bezeichnungen=befund.bezeichnungen,
    )


def _reine_uebernachtung(
    *,
    befund: GebuehrenBefund,
    brutto: Decimal,
    raw: object,
    basis: object,
) -> Decimal:
    """Der reine Übernachtungsbetrag ohne Gebühren.

    Drei Fälle, alle an den Live-Daten belegt:

    * Der Basisbetrag ist schon ohne Gebühren (Airbnb ``base_price``,
      Altimporte) → er ist die Übernachtung.
    * Booking mit Aufstellung → die Summe der Tagespreise aus ``rooms[].days``.
      Sie liegt bei allen 55 Booking-Buchungen vor und geht mit den Gebühren
      exakt auf den Gesamtbetrag auf (3/3 mit Aufstellung geprüft).
    * Booking mit Aufstellung, aber ohne lesbare Tagespreise → die Ableitung
      ``Brutto − Gebühren``. Kommt im Bestand nicht vor; sie steht hier, damit
      ein künftiger Payload ohne ``days`` nicht die ganze Buchung unauswertbar
      macht.
    """
    if not befund.im_gesamtpreis:
        wert = zu_decimal(basis)
        if wert is None:
            raise PayoutUnbekannt(
                "betrag",
                "Reservierung ohne Gesamtbetrag — Übernachtung unbestimmt.",
            )
        return wert
    naechte_summe = booking_naechte_summe(raw)
    if naechte_summe is not None:
        return naechte_summe
    return brutto - sum((g.betrag for g in befund.gebuehren), Decimal("0"))


def zerlegung_speichern(db: Client, finanzen: PortalFinanzen) -> None:
    """Die Zerlegung festhalten — idempotent (Wurzel 2).

    Der Buchungs-Import läuft bei jeder Revision und bei jedem Resync erneut;
    dieselbe Buchung kommt also garantiert mehrfach hier an. Der Kopf wird per
    ``upsert`` auf ``reservation_id`` (Primärschlüssel) geschrieben, die
    Gebührenposten werden ERSETZT statt ergänzt: eine Revision kann eine Gebühr
    entfernt haben, und ein reines Ergänzen liesse die alte stehen (Wurzel 1 —
    der Gegenzustand muss mitgepflegt werden).

    Reihenfolge: erst Kopf (die Kindtabelle referenziert ihn), dann Posten
    löschen, dann neu schreiben.
    """
    db.table("reservation_portal_finanzen").upsert(
        {
            "reservation_id": finanzen.reservation_id,
            "tenant_id": finanzen.tenant_id,
            "uebernachtung": str(finanzen.uebernachtung),
            "brutto": str(finanzen.brutto),
            "provision": str(finanzen.provision),
            "provision_gemeldet": finanzen.provision_gemeldet,
            "zahlungsgebuehr": str(finanzen.zahlungsgebuehr),
            "quelle": finanzen.quelle,
            "currency": finanzen.currency,
        },
        on_conflict="reservation_id",
    ).execute()

    db.table("reservation_portal_gebuehren").delete().eq(
        "reservation_id", finanzen.reservation_id
    ).execute()
    posten = [
        {
            "reservation_id": finanzen.reservation_id,
            "tenant_id": finanzen.tenant_id,
            "art": g.art,
            "betrag": str(g.betrag),
            "ota_bezeichnung": finanzen.bezeichnungen.get(g.art),
        }
        for g in finanzen.gebuehren
    ]
    if posten:
        db.table("reservation_portal_gebuehren").insert(posten).execute()


def zerlegung_laden(
    db: Client, tenant_id: str, reservation_ids: list[str]
) -> dict[str, PortalFinanzen]:
    """Die gespeicherten Zerlegungen mehrerer Buchungen laden.

    Zwei Abfragen für n Buchungen, nicht 2n: bei einem Kalendermonat mit 40
    Buchungen wären das sonst 80 Rundreisen zur DB.

    Tenant-gescoped (Wurzel 3): der Service-Role-Key umgeht RLS, also muss der
    Scope hier explizit stehen. Ohne ihn liesse sich mit einer fremden
    ``reservation_id`` die Finanzzerlegung eines anderen Betriebs lesen.
    """
    if not reservation_ids:
        return {}
    koepfe = (
        db.table("reservation_portal_finanzen")
        .select(
            "reservation_id, tenant_id, uebernachtung, brutto, provision, "
            "provision_gemeldet, zahlungsgebuehr, quelle, currency"
        )
        .eq("tenant_id", tenant_id)
        .in_("reservation_id", reservation_ids)
        .execute()
    ).data or []
    if not koepfe:
        return {}
    posten_rows = (
        db.table("reservation_portal_gebuehren")
        .select("reservation_id, art, betrag, ota_bezeichnung")
        .eq("tenant_id", tenant_id)
        .in_("reservation_id", [str(k["reservation_id"]) for k in koepfe])
        .execute()
    ).data or []
    return _zeilen_zu_finanzen(koepfe, posten_rows)


def _zeilen_zu_finanzen(
    koepfe: list[dict[str, Any]], posten_rows: list[dict[str, Any]]
) -> dict[str, PortalFinanzen]:
    """DB-Zeilen in ``PortalFinanzen`` überführen.

    Die Gebühren-ZUORDNUNG (``gehoert_zu`` / ``provisionspflichtig``) wird hier
    NICHT mitgeladen: sie ist Vereinbarung und keine Tatsache, kann sich also
    ändern. Gespeichert ist nur ``art`` und ``betrag``; wer die Auszahlung
    rechnet, verbindet sie über ``gebuehren_zuordnen`` mit der AKTUELLEN
    Klassifikation. Läge sie mit in der Zeile, wirkte eine korrigierte Zuordnung
    nicht auf bestehende Buchungen.
    """
    bezeichnungen: dict[str, dict[str, str]] = {}
    for p in posten_rows:
        text = p.get("ota_bezeichnung")
        if not text:
            continue
        rid = str(p["reservation_id"])
        bezeichnungen.setdefault(rid, {})[str(p.get("art") or "")] = str(text)
    out: dict[str, PortalFinanzen] = {}
    for k in koepfe:
        rid = str(k["reservation_id"])
        out[rid] = PortalFinanzen(
            reservation_id=rid,
            tenant_id=str(k["tenant_id"]),
            uebernachtung=zu_decimal(k.get("uebernachtung")) or Decimal("0"),
            brutto=zu_decimal(k.get("brutto")) or Decimal("0"),
            provision=zu_decimal(k.get("provision")) or Decimal("0"),
            provision_gemeldet=bool(k.get("provision_gemeldet")),
            zahlungsgebuehr=zu_decimal(k.get("zahlungsgebuehr")) or Decimal("0"),
            quelle=str(k.get("quelle") or ""),
            currency=str(k.get("currency") or ""),
            # Die Posten kommen NICHT hier hinein: `Gebuehr` verlangt eine
            # Zuordnung, und die ist Vereinbarung statt Tatsache. Wer rechnet,
            # holt die Rohposten über `rohposten` und verbindet sie mit der
            # AKTUELLEN Klassifikation — sonst wirkte eine korrigierte Zuordnung
            # nicht auf bestehende Buchungen.
            gebuehren=[],
            bezeichnungen=bezeichnungen.get(rid, {}),
        )
    return out


def rohposten(
    db: Client, tenant_id: str, reservation_ids: list[str]
) -> dict[str, list[tuple[str, Decimal]]]:
    """Die gespeicherten Gebührenposten als ``(art, betrag)`` je Buchung.

    Der Eingang für die Auszahlungsrechnung: sie verbindet diese Rohposten über
    ``gebuehren_zuordnen`` mit der AKTUELLEN Klassifikation, statt eine
    mitgespeicherte Zuordnung zu verwenden. Damit wirkt eine korrigierte
    Zuordnung sofort auf alle Buchungen — genau wie beim Abrechnungsvertrag.
    """
    if not reservation_ids:
        return {}
    rows = (
        db.table("reservation_portal_gebuehren")
        .select("reservation_id, art, betrag")
        .eq("tenant_id", tenant_id)
        .in_("reservation_id", reservation_ids)
        .execute()
    ).data or []
    out: dict[str, list[tuple[str, Decimal]]] = {}
    for r in rows:
        betrag = zu_decimal(r.get("betrag"))
        if betrag is None:
            continue
        out.setdefault(str(r["reservation_id"]), []).append(
            (str(r.get("art") or ""), betrag)
        )
    return out
