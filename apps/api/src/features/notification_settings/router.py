"""Router für notification_settings. Gemountet unter /api/v1/notification-settings.

Benachrichtigungs-Präferenzen (Airbnb „Konto → Benachrichtigungen"). ZWEI Wege
auf dieselbe Ressource, mit unterschiedlichem Schutz:

* `""`/`/raw` — die EIGENE Zeile. Die user_id kommt aus dem Token, ein Client
  kann sie nicht wählen; es genügt, angemeldet zu sein.
* `/nutzer/{user_id}` — die Zeile eines Nutzers des eigenen Betriebs. Hier ist
  die ID Client-Eingabe, also brauchen beide Routen BEIDES: die Autorisierung
  (MANAGE_STAFF, Rolle frisch aus der DB — Wurzel 7) UND den Tenant-Scope im
  Service (`_nutzer_im_tenant`, Wurzel 3/9). Ein `get_current_user` allein wäre
  hier eine IDOR auf die Kommunikationsgewohnheiten jedes fremden Kontos.
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from src.core.security import AuthContext, CurrentUser
from src.features.auth.dependencies import require_permission
from src.features.auth.permissions import Capability

from .dependencies import (
    GlockeServiceDep,
    NotificationSettingsServiceDep,
    PushGeraeteServiceDep,
)
from .geraete import GeraeteFehler
from .schemas import (
    GlockeEintrag,
    GlockeListe,
    NotificationOverview,
    NotificationSettings,
    NotificationSettingsUpdate,
    PushGeraetAbmeldung,
    PushGeraetRegistrierung,
)
from .service import NotificationScopeFehler

router = APIRouter(
    prefix="/notification-settings", tags=["notification-settings"]
)

# Dieselbe Fähigkeit, die die Nutzerverwaltung unter /konto/nutzer schützt —
# wer dort Rollen und Kontaktdaten pflegt, pflegt auch die Zustellwege. Eine
# eigene Fähigkeit dafür zu erfinden hieße, zwei Wahrheiten über dieselbe
# Verwaltungsrolle zu führen (Wurzel 4).
_MANAGE_STAFF = require_permission(  # noqa: N816  pylint: disable=invalid-name
    Capability.MANAGE_STAFF
)


@router.get("", response_model=NotificationOverview)
def get_overview(
    ctx: CurrentUser, service: NotificationSettingsServiceDep
) -> NotificationOverview:
    """Alle Kategorien mit Kanal-Zustand und Sperr-Information für den Tab."""
    return service.overview(ctx)


@router.get("/raw", response_model=NotificationSettings)
def get_raw(
    ctx: CurrentUser, service: NotificationSettingsServiceDep
) -> NotificationSettings:
    """Die flachen Präferenzen (ein bool je Kategorie×Kanal)."""
    return service.get(ctx)


@router.patch("", response_model=NotificationSettings)
def update_settings(
    patch: NotificationSettingsUpdate,
    ctx: CurrentUser,
    service: NotificationSettingsServiceDep,
) -> NotificationSettings:
    """Einzelne Präferenzen ändern (nur gesetzte Felder). Pflicht-E-Mails
    bleiben an, das Sammel-Opt-out pflegt die Marketing-Kanäle mit."""
    return service.update(ctx, patch)


# --- Verwaltungs-Weg: die Präferenzen eines MITARBEITERS ---------------------
# Konto → Nutzer → ein Nutzer → „Benachrichtigungen". Der Betrieb stellt ein,
# was bei seinen Leuten ankommt; ohne diesen Weg müsste sich jemand als sie
# anmelden, um eine Mailflut zu stoppen.


@router.get("/nutzer/{user_id}", response_model=NotificationOverview)
def get_overview_fuer_nutzer(
    user_id: str,
    service: NotificationSettingsServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE_STAFF)],
) -> NotificationOverview:
    """Kategorien und Kanal-Zustand EINES Nutzers des eigenen Betriebs."""
    try:
        return service.overview_fuer_nutzer(ctx, user_id)
    except NotificationScopeFehler as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc


@router.patch("/nutzer/{user_id}", response_model=NotificationSettings)
def update_settings_fuer_nutzer(
    user_id: str,
    patch: NotificationSettingsUpdate,
    service: NotificationSettingsServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE_STAFF)],
) -> NotificationSettings:
    """Präferenzen eines Nutzers des eigenen Betriebs ändern.

    Pflicht-E-Mails bleiben auch hier an — der Verwaltungs-Weg ist kein
    Schlupfloch um `email_pflicht` (die Regel sitzt im gemeinsamen Schreibpfad).
    """
    try:
        return service.update_fuer_nutzer(ctx, user_id, patch)
    except NotificationScopeFehler as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc


# --- Die Glocke (In-App-Benachrichtigungen) ---------------------------------
# Eigener Präfix unter demselben Slice: die Meldungen teilen den Katalog mit den
# Präferenzen, sind aber eine andere Ressource. Scope überall über ctx (Wurzel 9)
# — auch `{id}/gelesen` prüft user_id, nicht nur den Tenant.


@router.get("/glocke", response_model=GlockeListe)
def get_glocke(
    ctx: CurrentUser,
    service: GlockeServiceDep,
    nur_ungelesen: bool = False,
    limit: int = 30,
) -> GlockeListe:
    """Die eigenen Meldungen plus Zähler — beides in einem Aufruf."""
    eintraege = service.liste(ctx, nur_ungelesen=nur_ungelesen, limit=limit)
    return GlockeListe(
        eintraege=[GlockeEintrag(**_glocke_zeile(e)) for e in eintraege],
        ungelesen=service.ungelesen(ctx),
    )


@router.post("/glocke/{notification_id}/gelesen", status_code=204)
def glocke_gelesen(
    notification_id: str, ctx: CurrentUser, service: GlockeServiceDep
) -> None:
    """Eine Meldung quittieren. Idempotent — auch fremde IDs sind kein Fehler."""
    service.als_gelesen(ctx, notification_id)


@router.post("/glocke/alle-gelesen")
def glocke_alle_gelesen(
    ctx: CurrentUser, service: GlockeServiceDep
) -> dict[str, int]:
    """Alle eigenen Meldungen quittieren."""
    return {"gelesen": service.alle_gelesen(ctx)}


def _glocke_zeile(zeile: dict[str, object]) -> dict[str, object]:
    """DB-Zeile → Schema-Felder. UUIDs und Zeitstempel als Text.

    Ohne die Umwandlung schlägt die Validierung an `id`/`property_id` fehl —
    PostgREST liefert sie je nach Treiber als UUID-Objekt.
    """
    return {
        "id": str(zeile["id"]),
        "kategorie": str(zeile["kategorie"]),
        "titel": str(zeile["titel"]),
        "text": zeile.get("text") or None,
        "ziel_pfad": zeile.get("ziel_pfad") or None,
        "property_id": (
            str(zeile["property_id"]) if zeile.get("property_id") else None
        ),
        "gelesen_am": (
            str(zeile["gelesen_am"]) if zeile.get("gelesen_am") else None
        ),
        "created_at": str(zeile["created_at"]),
    }


# --- Push-Geraete (Migration 0414) -------------------------------------------
# Die Tabelle ist fuer Clients komplett gesperrt (revoke); dies ist der einzige
# Weg hinein. Beide Routen scopen auf `ctx.user_id` — ein Client darf weder ein
# Token auf eine fremde user_id setzen noch ein fremdes Geraet abmelden
# (Wurzel 3/9).


@router.put("/push-geraet", status_code=204)
def push_geraet_registrieren(
    req: PushGeraetRegistrierung,
    ctx: CurrentUser,
    service: PushGeraeteServiceDep,
) -> None:
    """Geraet fuer Push anmelden oder auffrischen.

    PUT statt POST, weil die Operation idempotent ist: dasselbe Token legt kein
    zweites Geraet an (UNIQUE auf token, Wurzel 2). Die App ruft das bei jedem
    Start und bei jedem Token-Wechsel (`onTokenRefresh`) auf — ohne den zweiten
    Aufruf stirbt Push fuer einen Teil der Nutzer stumm, weil FCM Tokens
    jederzeit rotieren kann.

    `tenant_id` kommt aus der Session, nicht aus der Anfrage.
    """
    try:
        service.registrieren(
            user_id=ctx.user_id,
            tenant_id=ctx.tenant_id,
            token=req.token,
            platform=req.platform,
            app=req.app,
        )
    except GeraeteFehler as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc


@router.post("/push-geraet/abmelden", status_code=204)
def push_geraet_abmelden(
    req: PushGeraetAbmeldung,
    ctx: CurrentUser,
    service: PushGeraeteServiceDep,
) -> None:
    """Geraet abmelden (Logout).

    Ohne diesen Aufruf bekaeme das Telefon weiter die Meldungen des
    abgemeldeten Betriebs — der Gegenzustand zur Anmeldung (Wurzel 1).
    """
    service.abmelden(user_id=ctx.user_id, token=req.token)
