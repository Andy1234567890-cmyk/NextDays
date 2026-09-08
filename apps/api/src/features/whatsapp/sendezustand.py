"""Metas Sendezustand einer Nummer nachziehen (Quality-Rating, Sendelimit).

``quality_rating`` und ``messaging_limit_tier`` standen bisher genau so in
``whatsapp_account``, wie sie beim Embedded Signup waren — und blieben dort.
Ein Betrieb, dessen Nummer Meta später heruntergestuft oder gesperrt hat, sah
im Kanalmanager weiter den Zustand vom Tag der Verbindung. Das ist kein leeres
Feld, sondern eine plausible Falschaussage; dieselbe Klasse wie Wurzel 5b, nur
mit Metas Zustand statt mit einem Zeitstempel.

Dagegen steht eine TTL. Was sie wirklich schützt, ist das APP-weite Budget,
nicht das der einzelnen WABA: Metas Grenze von 200 Aufrufen pro Stunde gilt je
App UND je WABA, und weil jeder Betrieb eine eigene WABA mitbringt, hat er sein
eigenes WABA-Budget — 15 Minuten TTL heißt dort höchstens 4 von 200 Aufrufen
(2 %). Der Grund für die TTL ist ein anderer: ``onboarding_status`` hängt an
der Kanalkachel und läuft bei JEDEM Rendern; über alle Betriebe zusammen
summiert sich das auf der App-Ebene. Diese Zahl ehrlich zu benennen ist wichtig
— eine überzogene Begründung wird später als Tatsache weitergereicht.

Eigenes Modul, weil der Vorgang eine geschlossene Aufgabe ist und ``service.py``
sonst über die 1500-Zeilen-Grenze wächst.
"""
from __future__ import annotations

from datetime import UTC, datetime, timedelta

from supabase import Client

from src.core.logging import get_logger

from .client import WhatsAppClient, WhatsAppError

log = get_logger("nextdays.whatsapp.sendezustand")

# Meta ändert Quality-Rating und Sendelimit über Stunden, nicht über Sekunden.
TTL = timedelta(minutes=15)


def auffrischen(
    db: Client, tenant_id: str, row: dict, client: WhatsAppClient
) -> dict:
    """``quality_rating``/``messaging_limit_tier`` bei Meta nachziehen.

    Best effort: schlägt der Abruf fehl — auch wegen Drosselung —, bleibt der
    gespeicherte Stand stehen und der Kanal-Status wird trotzdem geliefert. Der
    Zustand ist eine Anzeige, kein Sendepfad; ein Fehler hier darf die Seite
    nicht kippen (Wurzel 5).
    """
    if not veraltet(row):
        return row
    waba_id = row.get("waba_id")
    phone_number_id = str(row.get("phone_number_id") or "")
    if not waba_id or not phone_number_id:
        return row
    try:
        nummern = client.phone_numbers(
            str(waba_id), token=client.token_fuer_abfrage
        )
    except WhatsAppError as exc:  # noqa: BLE001 — best effort, siehe Docstring
        log.info(
            "whatsapp_zustand_nicht_aufgefrischt",
            tenant_id=tenant_id,
            grund=exc.message,
        )
        return row
    nummer = next(
        (n for n in nummern if str(n.get("id") or "") == phone_number_id), None
    )
    if nummer is None:
        return row
    neu = {
        "quality_rating": nummer.get("quality_rating"),
        "messaging_limit_tier": nummer.get("messaging_limit_tier"),
    }
    # Nur schreiben, wenn sich wirklich etwas geändert hat — sonst schreibt
    # jeder Seitenaufruf eine Zeile und `updated_at` wandert grundlos.
    if all(row.get(k) == v for k, v in neu.items()):
        stempeln(db, tenant_id)
        return row
    db.table("whatsapp_account").update(
        {**neu, "zustand_geprueft_at": datetime.now(UTC).isoformat()}
    ).eq("tenant_id", tenant_id).execute()
    log.info(
        "whatsapp_zustand_aktualisiert",
        tenant_id=tenant_id,
        quality_rating=neu["quality_rating"],
        messaging_limit_tier=neu["messaging_limit_tier"],
    )
    return {**row, **neu}


def veraltet(row: dict) -> bool:
    """Ist der gespiegelte Zustand älter als ``TTL``?

    Fehlt der Zeitstempel (Altbestand vor Migration 0607), gilt der Zustand als
    veraltet — er wurde nachweislich nie geprüft.
    """
    roh = row.get("zustand_geprueft_at")
    if not roh:
        return True
    try:
        geprueft = datetime.fromisoformat(str(roh).replace("Z", "+00:00"))
    except ValueError:
        return True
    if geprueft.tzinfo is None:
        geprueft = geprueft.replace(tzinfo=UTC)
    return datetime.now(UTC) - geprueft > TTL


def stempeln(db: Client, tenant_id: str) -> None:
    """Prüfzeitpunkt setzen, ohne die Werte anzufassen.

    Nötig auch bei unverändertem Ergebnis: sonst gilt der Zustand sofort wieder
    als veraltet und der nächste Seitenaufruf fragt erneut bei Meta — genau der
    Aufruf-Hagel, den die TTL verhindern soll.
    """
    db.table("whatsapp_account").update(
        {"zustand_geprueft_at": datetime.now(UTC).isoformat()}
    ).eq("tenant_id", tenant_id).execute()
