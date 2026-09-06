"""Seam-Webhooks: Zustandsmeldungen der Schlösser.

WARUM DIESER ENDPUNKT NÖTIG IST — der HTTP-200 beim Anlegen eines Zugangs ist
KEIN Beweis, dass der Code am Schloss liegt. Seam nimmt den Grant an, muss ihn
aber erst an das Gerät ausliefern; ist es offline, passiert das später oder gar
nicht. Ohne diesen Webhook wäre `status = angelegt` unser letzter Wissensstand,
und ein Gast ohne funktionierenden Code fiele niemandem auf, bis er vor der Tür
steht. Deshalb setzt erst das Ereignis `am_geraet_at` und `status = aktiv`.

FAIL-CLOSED (Wurzel 5): Fehlt die Signatur oder das Webhook-Secret, wird mit
401 abgelehnt — nie durchgelassen. Ein Webhook-Endpunkt ohne Prüfung ist eine
offene Schreibschnittstelle in unsere Zustandstabelle.

IDEMPOTENZ (Wurzel 2): Redelivery ist bei Webhooks der Normalfall, nicht die
Ausnahme. `seam_webhook_eingang.event_id` ist Primärschlüssel; eine zweite
Zustellung derselben ID läuft in den Konflikt und wird als „schon verarbeitet"
beantwortet, statt den Zustand ein zweites Mal zu verändern.
"""
from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from supabase import Client
from svix.webhooks import Webhook, WebhookVerificationError

from src.core.config import get_settings
from src.core.logging import get_logger
from src.core.supabase import get_service_client

router = APIRouter(prefix="/schloesser", tags=["schloesser"])
log = get_logger("nextdays.schloesser.webhook")

# Seam liefert Webhooks über Svix und empfiehlt ausdrücklich die Prüfung mit
# dem Svix-SDK. `Webhook.verify` macht in EINEM Aufruf, was hier vorher
# handgeschrieben stand: Signaturvergleich (zeitkonstant, mehrere Signaturen
# bei Secret-Rotation) UND Zeitstempel-Toleranz gegen Replay. Eigene
# Krypto-Handarbeit ist genau die Stelle, an der ein subtiler Fehler
# unbemerkt bleibt — das SDK ist hier die sicherere Wahl, nicht nur die
# kürzere.
_HEADER_ID = "svix-id"

# Grenze für die Nutzlast: ein unbegrenzter Body ist ein Angriffsvektor
# (Wurzel 8 — jeder unbegrenzte Bereich bekommt eine harte Obergrenze).
_MAX_BODY = 256 * 1024


@router.post("/webhook", include_in_schema=False)
async def webhook(request: Request) -> dict:
    """Ein Ereignis von Seam annehmen.

    Antwortet absichtlich immer schnell und ohne fachliche Fehler nach außen:
    Seam wiederholt bei 5xx, und eine Zustellung, die wir zwar verstanden,
    aber nicht verarbeiten konnten, soll nicht endlos wiederkommen. Der
    Fehler wird stattdessen an der Eingangszeile festgehalten und geloggt.
    """
    roh = await request.body()
    if len(roh) > _MAX_BODY:
        raise HTTPException(status_code=413, detail="Nutzlast zu gross.")

    _signatur_pruefen(request, roh)

    try:
        nutzlast = json.loads(roh or b"{}")
    except ValueError as exc:
        raise HTTPException(
            status_code=400, detail="Nutzlast ist kein gueltiges JSON."
        ) from exc
    if not isinstance(nutzlast, dict):
        raise HTTPException(status_code=400, detail="Nutzlast ist kein Objekt.")

    ereignis_id = str(
        nutzlast.get("event_id")
        or request.headers.get(_HEADER_ID)
        or ""
    ).strip()
    if not ereignis_id:
        raise HTTPException(
            status_code=400, detail="Ereignis ohne Kennung."
        )

    db = get_service_client()
    if not _eingang_vormerken(db, ereignis_id, nutzlast):
        # Schon gesehen — Redelivery. Kein Fehler, aber auch keine zweite
        # Verarbeitung.
        return {"status": "bereits_verarbeitet"}

    try:
        _verarbeiten(db, nutzlast)
    except (ValueError, KeyError, TypeError) as exc:
        # Spezifisch gefangen: eine unerwartete Nutzlastform darf den
        # Endpunkt nicht mit 500 quittieren (Seam würde endlos wiederholen),
        # muss aber sichtbar bleiben.
        db.table("seam_webhook_eingang").update(
            {"fehler": str(exc)[:500]}
        ).eq("event_id", ereignis_id).execute()
        log.warning(
            "schloesser.webhook_unverarbeitet",
            extra={"event_id": ereignis_id, "grund": str(exc)},
        )
        return {"status": "angenommen_mit_fehler"}

    db.table("seam_webhook_eingang").update(
        {"verarbeitet_at": datetime.now(UTC).isoformat(), "fehler": None}
    ).eq("event_id", ereignis_id).execute()
    return {"status": "ok"}


def _signatur_pruefen(request: Request, roh: bytes) -> None:
    """Svix-Signatur prüfen — fail-closed.

    Fehlt das Secret in der Umgebung, wird ABGELEHNT statt durchgelassen. Ein
    Webhook ohne Prüfung wäre eine offene Schreibschnittstelle in unsere
    Zustandstabelle; „Secret noch nicht konfiguriert" ist kein Grund, sie
    aufzumachen (Wurzel 5).

    Der Status ist 401 und nicht 400: Svix wiederholt bei 4xx nicht, und ein
    fehlgeschlagener Signaturvergleich ist eine Authentifizierungsfrage, keine
    Formatfrage. Beides verhindert Endlos-Retries einer Zustellung, die wir
    ohnehin nie annehmen werden.
    """
    secret = get_settings().seam_webhook_secret.get_secret_value().strip()
    if not secret:
        log.error("schloesser.webhook_secret_fehlt")
        raise HTTPException(
            status_code=401,
            detail="Webhook-Pruefung ist nicht konfiguriert.",
        )
    try:
        Webhook(secret).verify(roh, dict(request.headers))
    except WebhookVerificationError as exc:
        # Kein Log des Payloads: er ist angreiferkontrolliert.
        log.warning("schloesser.webhook_signatur_ungueltig")
        raise HTTPException(
            status_code=401, detail="Signatur passt nicht."
        ) from exc
    except (ValueError, TypeError) as exc:
        # Ein unbrauchbares Secret (falsches Format) ist Konfiguration, kein
        # Angriff — trotzdem fail-closed, aber mit eigener Meldung.
        log.error("schloesser.webhook_secret_unbrauchbar", grund=str(exc)[:200])
        raise HTTPException(
            status_code=401,
            detail="Webhook-Pruefung ist nicht konfiguriert.",
        ) from exc


def _eingang_vormerken(
    db: Client, ereignis_id: str, nutzlast: dict[str, Any]
) -> bool:
    """Die Eingangszeile anlegen. `False` = schon vorhanden (Redelivery).

    Der Insert IST die Prüfung: ein `select` davor wäre ein Rennen, weil zwei
    parallele Zustellungen beide „nicht vorhanden" sehen könnten. Der
    Primärschlüssel-Konflikt ist der Backstop, der auch dann hält.
    """
    try:
        db.table("seam_webhook_eingang").insert(
            {
                "event_id": ereignis_id,
                "event_type": str(nutzlast.get("event_type") or "unbekannt"),
                # Seams Zeitstempel, nicht unsere Uhr (Wurzel 5b): `created_at`
                # der Zeile beschreibt nur, wann WIR es bekamen.
                "occurred_at": nutzlast.get("occurred_at"),
                "payload": nutzlast,
            }
        ).execute()
        return True
    except Exception as exc:  # noqa: BLE001 - Konflikt ist der Normalfall
        # 23505 = unique_violation: dieselbe Ereignis-ID kam schon. Andere
        # Fehler werden weitergegeben, damit sie nicht als Redelivery
        # durchgehen.
        if "23505" in str(exc) or "duplicate key" in str(exc).lower():
            return False
        raise


def _verarbeiten(db: Client, nutzlast: dict[str, Any]) -> None:
    """Das Ereignis auf unseren Zustand anwenden.

    Bewusst nur die Ereignisse, die einen Zustand ÄNDERN. Alles andere wird
    gespeichert (für die Nachschau) und sonst ignoriert — ein unbekanntes
    Ereignis ist kein Fehler, Seam ergänzt seinen Katalog laufend.
    """
    typ = str(nutzlast.get("event_type") or "")

    if typ.startswith("access_grant."):
        _grant_ereignis(db, typ, nutzlast)
    elif typ.startswith("device."):
        _geraet_ereignis(db, typ, nutzlast)


def _grant_ereignis(
    db: Client, typ: str, nutzlast: dict[str, Any]
) -> None:
    """Zustandswechsel eines Zugangs."""
    grant_id = nutzlast.get("access_grant_id")
    if not grant_id:
        return
    jetzt = datetime.now(UTC).isoformat()

    if typ in {"access_grant.access_granted", "access_grant.activated"}:
        # JETZT ist der Code wirklich am Gerät — der Zustand, den der
        # HTTP-200 beim Anlegen nicht belegen konnte.
        db.table("seam_zugang").update(
            {"status": "aktiv", "am_geraet_at": jetzt, "status_grund": None}
        ).eq("seam_grant_id", str(grant_id)).execute()
    elif typ == "access_grant.access_failed":
        grund = str(
            nutzlast.get("error_message")
            or nutzlast.get("message")
            or "Der Schloss-Dienst meldet einen Fehler ohne Angabe."
        )
        db.table("seam_zugang").update(
            {"status": "fehlgeschlagen", "status_grund": grund[:500]}
        ).eq("seam_grant_id", str(grant_id)).execute()
        log.warning(
            "schloesser.grant_fehlgeschlagen",
            extra={"grant_id": str(grant_id), "grund": grund},
        )
    elif typ == "access_grant.deleted":
        db.table("seam_zugang").update(
            {"status": "widerrufen", "widerrufen_at": jetzt}
        ).eq("seam_grant_id", str(grant_id)).execute()


def _geraet_ereignis(
    db: Client, typ: str, nutzlast: dict[str, Any]
) -> None:
    """Zustandswechsel eines Geräts (online/offline, Batterie).

    WICHTIG: `device.disconnected` ist bei igloohome OHNE Bridge der
    NORMALZUSTAND und kein Fehler. Deshalb wird hier nur der Zustand
    gespiegelt, ohne ihn zu bewerten — die Bewertung passiert in der
    Oberfläche, die weiß, ob das Gerät offline-fähig ist.
    """
    device_id = nutzlast.get("device_id")
    if not device_id:
        return
    werte: dict[str, Any] = {"last_seen_at": datetime.now(UTC).isoformat()}
    if typ == "device.connected":
        werte["online"] = True
    elif typ == "device.disconnected":
        werte["online"] = False
    elif typ in {"device.low_battery", "device.battery_status_changed"}:
        stand = nutzlast.get("battery_level")
        if stand is not None:
            try:
                werte["battery_level"] = float(stand)
            except (TypeError, ValueError):
                pass
    db.table("seam_device").update(werte).eq(
        "seam_device_id", str(device_id)
    ).execute()
