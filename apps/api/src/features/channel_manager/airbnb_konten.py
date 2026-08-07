"""Airbnb-Konten eines Betriebs — die Bündelung für konto-weite Abrufe.

Vier Worker-Ticks holen Bestandsdaten NICHT je Objekt, sondern je Konto: Airbnb
gibt Lesestände, Anreisezeiten, Buchungszeitpunkte und Gast-Profilbilder in
EINEM Abruf über alle Inserate eines Kontos heraus. Ein Aufruf je Objekt wären
bei 20 Objekten 20 Abrufe für dieselbe Antwort.

Bisher bündelten sie je TENANT und holten sich „den" Token des Betriebs. Das
war richtig, solange ein Betrieb ein Airbnb-Konto hatte. Mit mehreren Konten
(0304 — Agenturen betreuen hunderte Vermieter) ist es falsch: der Abruf liefe
mit dem Token von Konto A und suchte darin Buchungen, die zu Konto B gehören.
Gefunden würde nichts, gemeldet würde „0 aktualisiert" — ein stiller Ausfall,
den niemand bemerkt.

Deshalb ist die Klammer hier das KONTO, nicht der Betrieb.
"""
from __future__ import annotations

from collections.abc import Callable
from typing import Any

from supabase import Client

AIRBNB = "AirBNB"


def airbnb_konten(db: Client, tenant_id: str) -> list[dict[str, Any]]:
    """Die verbundenen Airbnb-Konten eines Betriebs (0304).

    Nur Konten mit Kanal: ohne ihn gibt es keinen Token und damit nichts
    abzurufen. Leere Liste = der Betrieb hat kein verbundenes Airbnb-Konto.
    """
    return (
        db.table("ota_account")
        .select("id, channex_channel_id, ota_hotel_id, display_name")
        .eq("tenant_id", tenant_id)
        .eq("ota_portal_code", AIRBNB)
        .eq("is_active", True)
        .not_.is_("channex_channel_id", "null")
        .order("created_at")
        .execute()
    ).data or []


def objekte_je_konto(db: Client, tenant_id: str) -> dict[str, set[str]]:
    """Konto-ID → die `property_id`s, die an diesem Konto hängen.

    Damit lässt sich eine Menge gemischter Zeilen (Buchungen, Reservierungen)
    dem richtigen Konto zuordnen, statt sie alle mit einem Token abzufragen.
    """
    zeilen = (
        db.table("channex_channel_connection")
        .select("ota_account_id, property_id")
        .eq("tenant_id", tenant_id)
        .eq("ota_portal_code", AIRBNB)
        .not_.is_("ota_account_id", "null")
        .not_.is_("property_id", "null")
        .execute()
    ).data or []
    zuordnung: dict[str, set[str]] = {}
    for z in zeilen:
        konto = str(z["ota_account_id"])
        zuordnung.setdefault(konto, set()).add(str(z["property_id"]))
    return zuordnung


def property_je_buchung(
    db: Client, tenant_id: str, buchung_ids: list[str]
) -> dict[str, str]:
    """Buchungs-ID → `property_id`, aufgelöst über `channex_property_map`.

    `channex_booking` trägt kein `property_id`, sondern `property_map_id`
    (0027). Für die Zuordnung „welches Konto gehört zu dieser Buchung" braucht
    es diesen Zwischenschritt — in EINER Abfrage für die ganze Liste, nicht je
    Zeile.
    """
    if not buchung_ids:
        return {}
    buchungen = (
        db.table("channex_booking")
        .select("id, property_map_id")
        .eq("tenant_id", tenant_id)
        .in_("id", buchung_ids)
        .execute()
    ).data or []
    map_ids = [str(b["property_map_id"]) for b in buchungen if b.get("property_map_id")]
    if not map_ids:
        return {}
    maps = (
        db.table("channex_property_map")
        .select("id, property_id")
        .eq("tenant_id", tenant_id)
        .in_("id", map_ids)
        .execute()
    ).data or []
    prop_je_map = {str(m["id"]): str(m["property_id"]) for m in maps if m.get("property_id")}
    return {
        str(b["id"]): prop_je_map[str(b["property_map_id"])]
        for b in buchungen
        if b.get("property_map_id") and str(b["property_map_id"]) in prop_je_map
    }


def kontoweise(
    db: Client,
    tenant_id: str,
    zeilen: list[dict[str, Any]],
    arbeit: Callable[[Client, str, list[dict[str, Any]], str], int],
    *,
    id_feld: str = "id",
    hat_property: bool = False,
) -> int:
    """`arbeit` je Airbnb-Konto ausführen, mit den Zeilen DIESES Kontos.

    Die gemeinsame Klammer der konto-weiten Worker-Ticks. Sie beantwortet die
    eine Frage, die jeder von ihnen hat: „Welche dieser Buchungen darf ich mit
    welchem Token abfragen?"

    Bei genau EINEM Konto (der Normalfall) gehen alle Zeilen in einem Rutsch
    durch — kein zusätzlicher Auflösungsaufwand für den häufigsten Fall.

    Bei mehreren Konten wird jede Zeile über ihr Objekt dem Konto zugeordnet.
    Zeilen ohne auflösbares Objekt bleiben LIEGEN, statt beim erstbesten Konto
    mitzulaufen: eine Buchung mit dem falschen Token zu suchen liefert kein
    Ergebnis, verbraucht aber ein Kontingent und sieht aus wie „nichts zu tun".

    `hat_property=True`, wenn die Zeilen ihre `property_id` schon mitbringen
    (`reservations`); sonst wird sie über `channex_booking.property_map_id`
    aufgelöst.

    Rückgabe ist die Summe dessen, was `arbeit` gemeldet hat.
    """
    konten = airbnb_konten(db, tenant_id)
    if not konten:
        return 0
    if len(konten) == 1:
        return arbeit(db, tenant_id, zeilen, str(konten[0]["channex_channel_id"]))

    props_je_konto = objekte_je_konto(db, tenant_id)
    if hat_property:
        prop_je_zeile = {
            str(z[id_feld]): str(z["property_id"])
            for z in zeilen
            if z.get(id_feld) and z.get("property_id")
        }
    else:
        prop_je_zeile = property_je_buchung(
            db, tenant_id, [str(z[id_feld]) for z in zeilen if z.get(id_feld)]
        )
    gesamt = 0
    for konto in konten:
        erlaubt = props_je_konto.get(str(konto["id"]), set())
        eigene = [
            z for z in zeilen if prop_je_zeile.get(str(z.get(id_feld) or "")) in erlaubt
        ]
        if eigene:
            gesamt += arbeit(
                db, tenant_id, eigene, str(konto["channex_channel_id"])
            )
    return gesamt
