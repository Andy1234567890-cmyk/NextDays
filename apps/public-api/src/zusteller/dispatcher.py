"""Webhook-Zusteller — ein EIGENER Prozess dieses Service.

Er ist bewusst nicht der Worker der Haupt-API: die öffentliche API soll sich
selbst versorgen können, und ein Ereignis, das an einen Kunden-Endpunkt geht,
darf nicht mit den internen Jobs (Channex-Push, Mailversand) um dieselben
Arbeiter konkurrieren. Ein langsam antwortender Kunden-Server würde sonst den
Portal-Abgleich des ganzen Systems ausbremsen.

Start (eigener Container, dasselbe Image):

    python -m src.zusteller.dispatcher

Der Ablauf je Takt:

  1. Fällige Zustellungen holen (`public_api_deliveries`, `status = pending`,
     `next_attempt_at <= now`).
  2. Je Zustellung: Abo laden, URL erneut auflösen und prüfen, auf die geprüfte
     IP pinnen, senden.
  3. Erfolg (2xx) → `delivered`. Fehler → Versuch zählen, nächsten Zeitpunkt mit
     exponentiellem Abstand setzen, nach `webhook_max_attempts` → `failed`.

**Warum die URL bei JEDER Zustellung neu geprüft wird**, obwohl sie beim Anlegen
schon geprüft war: zwischen Anlegen und Zustellung liegen Minuten bis Monate. Ein
Angreifer registriert eine Adresse, die auf einen öffentlichen Server zeigt, und
biegt den DNS-Eintrag danach auf `127.0.0.1` oder den Metadaten-Dienst um. Ohne
erneute Prüfung wäre der Zusteller ein dauerhaft offener SSRF-Kanal (Wurzel 8).

**Warum es eine UNIQUE-Bedingung auf (webhook, event) gibt** und nicht nur die
Statusspalte: der Takt kann sich überlappen (langsamer Empfänger, zwei
Container). Der eindeutige Index in der Datenbank ist die letzte Instanz, die
eine doppelte Zustellung verhindert — eine Prüfung im Code allein hat immer ein
Rennen (Wurzel 2).
"""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
from datetime import UTC, datetime, timedelta
from urllib.parse import urlparse

import httpx
from supabase import Client

from ..core.ausgehende_url import UnsichereUrl, host_pinnen, oeffentliche_ips
from ..core.config import get_settings
from ..core.logging import configure_logging, get_logger
from ..core.supabase import get_service_client

log = get_logger("publicapi.zusteller")

# Wie viele Zustellungen ein Takt anfasst. Klein gehalten, damit ein hängender
# Empfänger nicht den ganzen Takt blockiert und die anderen Kunden warten.
_STAPEL = 25

# Abstände der Wiederholungen in Sekunden, nach Versuchsnummer. Danach gilt der
# letzte Wert. Beginnt bei einer Minute — ein Empfänger, der gerade neu startet,
# ist meist binnen einer Minute wieder da. Ende bei einer Stunde: häufiger zu
# klopfen hilft nicht, wenn ein Server seit Stunden weg ist.
_ABSTAENDE = (60, 300, 900, 1800, 3600)


def _naechster_abstand(versuch: int) -> int:
    idx = min(max(versuch - 1, 0), len(_ABSTAENDE) - 1)
    return _ABSTAENDE[idx]


def signatur(secret: str, zeitstempel: int, koerper: bytes) -> str:
    """`t=<sekunden>,v1=<hmac>` über `<t>.<body>`.

    Der Zeitstempel ist MITSIGNIERT. Genau das unterscheidet dieses Verfahren
    von einer Signatur nur über den Body: der Empfänger kann eine alte,
    aufgezeichnete Zustellung erkennen, indem er den Zeitstempel gegen seine Uhr
    prüft (empfohlene Toleranz: fünf Minuten). Ohne signierten Zeitstempel ist
    eine Wiedereinspielung von einer echten Zustellung nicht unterscheidbar.

    `v1` ist eine Versionsmarke. Sollte SHA-256 einmal ersetzt werden, kommt ein
    `v2` DANEBEN, damit bestehende Empfänger nicht über Nacht brechen.
    """
    nutzlast = f"{zeitstempel}.".encode() + koerper
    mac = hmac.new(secret.encode("utf-8"), nutzlast, hashlib.sha256).hexdigest()
    return f"t={zeitstempel},v1={mac}"


async def _senden(
    zustellung: dict, abo: dict, ereignis: dict, timeout: float
) -> tuple[bool, int | None, str | None]:
    """Eine Zustellung ausliefern. Gibt (erfolg, status, fehlertext) zurück."""
    koerper = json.dumps(
        {
            "id": str(ereignis["id"]),
            "event": ereignis["event"],
            "created_at": ereignis["created_at"],
            "property_id": (
                str(ereignis["property_id"]) if ereignis.get("property_id") else None
            ),
            "data": ereignis.get("payload") or {},
        },
        ensure_ascii=False,
        separators=(",", ":"),
    ).encode("utf-8")

    url = abo["url"]
    try:
        # Erneut auflösen und prüfen — siehe Modul-Docstring.
        ips = oeffentliche_ips(url, nur_https=True)
    except UnsichereUrl as exc:
        return False, None, f"Adresse nicht erlaubt: {exc}"

    teile = urlparse(url)
    gepinnt = teile._replace(netloc=host_pinnen(teile.netloc, ips[0])).geturl()
    jetzt = int(datetime.now(UTC).timestamp())

    kopf = {
        "Content-Type": "application/json",
        "User-Agent": "myNextDays-Webhooks/1.0",
        "MyNextDays-Signature": signatur(abo["secret"], jetzt, koerper),
        "MyNextDays-Event": ereignis["event"],
        "MyNextDays-Delivery": str(zustellung["id"]),
        # Der echte Name, obwohl die Verbindung zur gepinnten IP geht — nur so
        # bleibt die Zertifikatsprüfung intakt.
        "Host": teile.hostname or "",
    }
    try:
        async with httpx.AsyncClient(
            timeout=timeout,
            follow_redirects=False,  # ein Redirect wäre ein zweites, ungeprüftes Ziel
            verify=True,
        ) as client:
            antwort = await client.post(
                gepinnt,
                content=koerper,
                headers=kopf,
                extensions={"sni_hostname": teile.hostname},
            )
    except httpx.HTTPError as exc:
        return False, None, f"{type(exc).__name__}: {str(exc)[:180]}"

    if 200 <= antwort.status_code < 300:
        return True, antwort.status_code, None
    return False, antwort.status_code, f"HTTP {antwort.status_code}"


def _faellige(db: Client) -> list[dict]:
    jetzt = datetime.now(UTC).isoformat()
    return (
        db.table("public_api_deliveries")
        .select("id, webhook_id, event_id, attempts")
        .eq("status", "pending")
        .lte("next_attempt_at", jetzt)
        .order("next_attempt_at")
        .limit(_STAPEL)
        .execute()
    ).data or []


def _abo_und_ereignis(db: Client, zustellung: dict) -> tuple[dict | None, dict | None]:
    abo = (
        db.table("public_api_webhooks")
        .select("id, url, secret, revoked_at")
        .eq("id", zustellung["webhook_id"])
        .limit(1)
        .execute()
    ).data
    ereignis = (
        db.table("public_api_events")
        .select("id, event, payload, property_id, created_at")
        .eq("id", zustellung["event_id"])
        .limit(1)
        .execute()
    ).data
    return (abo[0] if abo else None), (ereignis[0] if ereignis else None)


def _erfolg_vermerken(db: Client, zustellung: dict, status: int | None) -> None:
    jetzt = datetime.now(UTC).isoformat()
    db.table("public_api_deliveries").update(
        {
            "status": "delivered",
            "attempts": int(zustellung["attempts"]) + 1,
            "response_status": status,
            "last_error": None,
            "delivered_at": jetzt,
        }
    ).eq("id", zustellung["id"]).execute()
    # Der Fehlerzähler des Abos wird zurückgesetzt: er zählt AUFEINANDERFOLGENDE
    # Fehler. Ohne Rücksetzen würde ein Abo, das einmal pro Monat scheitert, nach
    # einem Jahr als dauerhaft kaputt gelten (Wurzel 1 — der Gegenzustand gehört
    # mitgepflegt).
    db.table("public_api_webhooks").update(
        {"last_success_at": jetzt, "failure_count": 0, "last_error": None}
    ).eq("id", zustellung["webhook_id"]).execute()


def _fehler_vermerken(
    db: Client,
    zustellung: dict,
    status: int | None,
    fehler: str | None,
    max_versuche: int,
) -> None:
    versuche = int(zustellung["attempts"]) + 1
    endgueltig = versuche >= max_versuche
    db.table("public_api_deliveries").update(
        {
            "status": "failed" if endgueltig else "pending",
            "attempts": versuche,
            "response_status": status,
            "last_error": (fehler or "")[:500],
            "next_attempt_at": (
                None
                if endgueltig
                else (
                    datetime.now(UTC) + timedelta(seconds=_naechster_abstand(versuche))
                ).isoformat()
            ),
        }
    ).eq("id", zustellung["id"]).execute()

    zeilen = (
        db.table("public_api_webhooks")
        .select("failure_count")
        .eq("id", zustellung["webhook_id"])
        .limit(1)
        .execute()
    ).data
    bisher = int((zeilen[0].get("failure_count") if zeilen else 0) or 0)
    db.table("public_api_webhooks").update(
        {"failure_count": bisher + 1, "last_error": (fehler or "")[:500]}
    ).eq("id", zustellung["webhook_id"]).execute()


async def takt(db: Client, *, timeout: float, max_versuche: int) -> int:
    """Einen Durchgang ausführen. Gibt die Zahl der bearbeiteten Zustellungen zurück."""
    zustellungen = _faellige(db)
    if not zustellungen:
        return 0
    for z in zustellungen:
        abo, ereignis = _abo_und_ereignis(db, z)
        if abo is None or ereignis is None:
            # Abo oder Ereignis ist weg (gelöschter Betrieb, aufgeräumtes
            # Ereignis). Die Zustellung wird abgeschlossen statt endlos
            # wiederholt — und zwar mit einem Grund im Feld, nicht still.
            db.table("public_api_deliveries").update(
                {
                    "status": "failed",
                    "last_error": "Abo oder Ereignis existiert nicht mehr.",
                    "next_attempt_at": None,
                }
            ).eq("id", z["id"]).execute()
            continue
        if abo.get("revoked_at") is not None:
            db.table("public_api_deliveries").update(
                {
                    "status": "cancelled",
                    "last_error": "Abo wurde beendet.",
                    "next_attempt_at": None,
                }
            ).eq("id", z["id"]).execute()
            continue

        erfolg, status, fehler = await _senden(z, abo, ereignis, timeout)
        if erfolg:
            _erfolg_vermerken(db, z, status)
            log.info("zustellung_ok", event=ereignis["event"], status=status)
        else:
            _fehler_vermerken(db, z, status, fehler, max_versuche)
            log.warning(
                "zustellung_fehlgeschlagen",
                event=ereignis["event"],
                status=status,
                versuch=int(z["attempts"]) + 1,
                fehler=(fehler or "")[:120],
            )
    return len(zustellungen)


async def hauptschleife() -> None:
    settings = get_settings()
    configure_logging(settings.log_level, json_logs=settings.json_logs)
    db = get_service_client()
    log.info("zusteller_start", takt_sekunden=settings.webhook_poll_seconds)
    while True:
        try:
            bearbeitet = await takt(
                db,
                timeout=settings.webhook_timeout_seconds,
                max_versuche=settings.webhook_max_attempts,
            )
        except Exception as exc:  # noqa: BLE001 — die Schleife darf nie sterben
            # Ein Fehler in EINEM Takt (DB kurz weg) darf den Zusteller nicht
            # beenden: ein gestorbener Zusteller liefert nichts mehr aus, und
            # niemand merkt es, weil keine Fehler mehr entstehen.
            log.error("zusteller_takt_fehler", fehler=str(exc)[:300])
            bearbeitet = 0
        # War der Stapel voll, gleich weitermachen — sonst braucht ein Rückstau
        # von 500 Zustellungen 20 Takte.
        if bearbeitet < _STAPEL:
            await asyncio.sleep(settings.webhook_poll_seconds)


def main() -> None:
    asyncio.run(hauptschleife())


if __name__ == "__main__":
    main()
