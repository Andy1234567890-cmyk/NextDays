"""Ereignis-Abos (Webhooks) verwalten.

Warum es Webhooks gibt: ohne sie muss eine Integration pollen. Ein Client, der
alle fünf Minuten `GET /reservations?updated_since=…` fragt, verbraucht 288
Aufrufe pro Tag und erfährt eine Buchung im Schnitt zweieinhalb Minuten zu
spät — bei einer Buchung, die eine Reinigung auslöst, ist das der Unterschied
zwischen einem geplanten und einem hektischen Tag.

**Woher die Ereignisse kommen.** Nicht aus diesem Service. Datenbank-Trigger
schreiben jede relevante Änderung in eine Warteschlange (`public_api_events`) —
egal ob sie aus dieser API, aus dem Dashboard, aus dem Portal-Import oder aus
einem Hintergrundjob stammt. Der Zusteller dieses Service liest die
Warteschlange und liefert aus. Das ist der Grund für die Trigger-Lösung: ein
Ereignis, das nur bei API-Änderungen feuert, wäre wertlos, denn die
interessanten Buchungen kommen von Booking.com.

**Signatur.** Jede Zustellung trägt

    MyNextDays-Signature: t=<unix-sekunden>,v1=<hex-hmac-sha256>

über der Zeichenkette `<t>.<roher-body>`, mit dem Secret des Abos als
Schlüssel. Das ist das Verfahren, das Stripe etabliert hat, und es kann eines
mehr als Lodgifys reines Body-HMAC (`ms-signature: sha256=…`): weil der
Zeitstempel MITSIGNIERT ist, erkennt der Empfänger eine aufgezeichnete und
später erneut eingespielte Zustellung. Bei einer Signatur nur über den Body ist
eine solche Wiedereinspielung von einer echten Zustellung nicht zu
unterscheiden.

**Das Secret wird genau einmal ausgeliefert** — beim Anlegen. Danach nie wieder;
wer es verliert, legt ein neues Abo an. Ein Secret, das man jederzeit abrufen
kann, ist keines.
"""
from __future__ import annotations

import secrets
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Response

from ..core import errors
from ..core.ausgehende_url import UnsichereUrl, oeffentliche_ips
from ..core.auth import ApiKontext, scope_erforderlich
from ..core.db import service_db, zeile_im_mandanten
from ..core.logging import get_logger
from .schemas import EREIGNISSE, EreignisTyp, Webhook, WebhookAngelegt, WebhookAnlegen

log = get_logger("publicapi.webhooks")

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])


def _webhook(zeile: dict) -> Webhook:
    return Webhook(
        id=str(zeile["id"]),
        url=zeile["url"],
        events=list(zeile.get("events") or []),
        property_ids=[str(p) for p in (zeile.get("property_ids") or [])],
        active=zeile.get("revoked_at") is None,
        created_at=zeile["created_at"],
        last_success_at=zeile.get("last_success_at"),
        last_error=zeile.get("last_error"),
        failure_count=int(zeile.get("failure_count") or 0),
    )


@router.get(
    "/events", response_model=list[EreignisTyp], summary="Ereignis-Katalog"
)
def katalog(
    ctx: Annotated[ApiKontext, Depends(scope_erforderlich("webhooks:read"))],
) -> list[dict[str, str]]:
    """Alle abonnierbaren Ereignisse mit Beschreibung.

    Aus derselben Quelle, gegen die ein Abo validiert wird — eine
    handgeschriebene Liste in der Doku wäre die zweite Wahrheit, und ein
    Tippfehler im Abo führte zu einem Abo, das für immer still bleibt.
    """
    del ctx
    return [{"event": e, "description": b} for e, b in sorted(EREIGNISSE.items())]


@router.get("", response_model=list[Webhook], summary="Eigene Abos auflisten")
def liste(
    ctx: Annotated[ApiKontext, Depends(scope_erforderlich("webhooks:read"))],
) -> list[Webhook]:
    """Die Abos DIESES Zugangs.

    Bewusst nicht alle Abos des Betriebs: ein Zugang soll nicht sehen, wohin ein
    anderer Zugang ausliefert — das wäre eine Landkarte fremder Systeme.
    """
    db = service_db()
    zeilen = (
        db.table("public_api_webhooks")
        .select(
            "id, url, events, property_ids, revoked_at, created_at, "
            "last_success_at, last_error, failure_count"
        )
        .eq("tenant_id", ctx.tenant_id)
        .eq("api_client_id", ctx.client_pk)
        .order("created_at", desc=True)
        .execute()
    ).data or []
    return [_webhook(z) for z in zeilen]


@router.post(
    "",
    response_model=WebhookAngelegt,
    status_code=201,
    summary="Abo anlegen",
    responses={
        409: {"description": "Für diese URL besteht bereits ein Abo dieses Zugangs."},
        422: {
            "description": (
                "URL nicht erlaubt (kein https, interne Adresse, nicht "
                "auflösbar) oder unbekanntes Ereignis."
            )
        },
    },
)
def anlegen(
    body: WebhookAnlegen,
    ctx: Annotated[ApiKontext, Depends(scope_erforderlich("webhooks:write"))],
) -> WebhookAngelegt:
    """Ein Ereignis-Abo anlegen.

    Die URL wird beim Anlegen geprüft: `https` ist Pflicht, und jede aufgelöste
    Adresse muss öffentlich sein. Damit lässt sich unser Server nicht auf
    interne Dienste oder den Cloud-Metadaten-Endpunkt richten — ein
    Standard-Angriff gegen jede Webhook-Funktion.

    Die Antwort enthält das `secret` **einmalig**. Jetzt speichern.
    """
    db = service_db()
    _url_pruefen(body.url)
    if body.property_ids:
        for pid in body.property_ids:
            ctx.objekt_pruefen(pid)
            zeile_im_mandanten(
                db, "properties", pid, ctx.tenant_id, spalten="id", was="Das Objekt"
            )

    # Ein Abo je (Zugang, URL): dieselbe URL zweimal zu abonnieren führt nur zu
    # doppelten Zustellungen, die der Empfänger auseinanderhalten muss. Lodgify
    # antwortet in diesem Fall ebenfalls mit 409.
    doppelt = (
        db.table("public_api_webhooks")
        .select("id")
        .eq("tenant_id", ctx.tenant_id)
        .eq("api_client_id", ctx.client_pk)
        .eq("url", body.url)
        .is_("revoked_at", "null")
        .limit(1)
        .execute()
    ).data
    if doppelt:
        raise errors.konflikt(
            "abo_besteht_bereits",
            "Für diese URL besteht bereits ein aktives Abo dieses Zugangs. "
            "Erst löschen, dann neu anlegen.",
        )

    # 32 Byte Entropie. Der Empfänger prüft damit ein HMAC-SHA256 — kürzer wäre
    # ein Schlüssel, den man durchprobieren kann.
    secret = f"whsec_{secrets.token_urlsafe(32)}"
    zeilen = (
        db.table("public_api_webhooks")
        .insert(
            {
                "tenant_id": ctx.tenant_id,
                "api_client_id": ctx.client_pk,
                "url": body.url,
                "events": body.events,
                "property_ids": body.property_ids or [],
                "secret": secret,
            }
        )
        .execute()
    ).data
    if not zeilen:
        raise errors.ApiFehler(
            status=500,
            code="abo_nicht_angelegt",
            detail="Das Abo konnte nicht angelegt werden.",
            titel="Abo nicht angelegt",
        )
    log.info("webhook_angelegt", tenant_id=ctx.tenant_id, events=len(body.events))
    return WebhookAngelegt(**_webhook(zeilen[0]).model_dump(), secret=secret)


@router.delete("/{webhook_id}", status_code=204, summary="Abo löschen")
def loeschen(
    webhook_id: str,
    ctx: Annotated[ApiKontext, Depends(scope_erforderlich("webhooks:write"))],
) -> Response:
    """Ein Abo beenden.

    Löscht die Zeile nicht, sondern setzt `revoked_at`: offene Zustellversuche
    verweisen darauf, und ein hartes Löschen würde sie zu Waisen machen. Für den
    Client ist das Abo sofort weg — es taucht nicht mehr in der Liste auf und
    bekommt nichts mehr zugestellt.
    """
    db = service_db()
    zeile = zeile_im_mandanten(
        db, "public_api_webhooks", webhook_id, ctx.tenant_id,
        spalten="id, api_client_id", was="Das Abo",
    )
    if str(zeile.get("api_client_id")) != ctx.client_pk:
        # Fremdes Abo desselben Betriebs: derselbe 404 wie „existiert nicht".
        # Ein 403 würde verraten, dass ein anderer Zugang dieses Abo hält.
        raise errors.nicht_gefunden("Das Abo")

    (
        db.table("public_api_webhooks")
        .update({"revoked_at": datetime.now(UTC).isoformat()})
        .eq("id", webhook_id)
        .eq("tenant_id", ctx.tenant_id)
        .is_("revoked_at", "null")
        .execute()
    )
    return Response(status_code=204)


def _url_pruefen(url: str) -> None:
    """Ziel-URL gegen SSRF prüfen (nur https, nur öffentliche Adressen).

    Die Prüfung beim ANLEGEN ist die Nutzerfreundlichkeit — der Entwickler
    erfährt sofort, dass seine Adresse nicht geht. Sie ist NICHT der Schutz: der
    liegt beim Zusteller, der vor jeder Zustellung erneut auflöst und sich auf
    die geprüfte IP pinnt. Ein DNS-Eintrag, der heute öffentlich ist und morgen
    auf 127.0.0.1 zeigt, wäre sonst ein offener SSRF-Kanal (Wurzel 8).
    """
    try:
        oeffentliche_ips(url, nur_https=True)
    except UnsichereUrl as exc:
        raise errors.ungueltige_anfrage(
            f"Die Adresse ist als Ziel nicht erlaubt: {exc}. Erwartet wird eine "
            "öffentlich erreichbare https-Adresse.",
            extra={"url": url},
        ) from exc
