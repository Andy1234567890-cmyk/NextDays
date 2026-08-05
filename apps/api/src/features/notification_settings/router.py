"""Router für notification_settings. Gemountet unter /api/v1/notification-settings.

Benachrichtigungs-Präferenzen des eingeloggten Kontos (Airbnb „Konto →
Benachrichtigungen"). Scope über die eigene user_id im Service (Wurzel 3/9) —
jeder eingeloggte Nutzer sieht/ändert nur die EIGENE Zeile.
"""
from __future__ import annotations

from fastapi import APIRouter

from src.core.security import CurrentUser

from .dependencies import GlockeServiceDep, NotificationSettingsServiceDep
from .schemas import (
    GlockeEintrag,
    GlockeListe,
    NotificationOverview,
    NotificationSettings,
    NotificationSettingsUpdate,
)

router = APIRouter(
    prefix="/notification-settings", tags=["notification-settings"]
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
