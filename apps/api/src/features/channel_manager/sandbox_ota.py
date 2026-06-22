"""Mock-OTA für den Channex-Sandbox-Test (OpenChannel).

Channex' `OpenChannel` ruft eine SELBST bereitgestellte Endpoint-URL auf (3
Routen), statt eine echte OTA zu sein. Damit lässt sich der komplette
Verbinden-Flow (test_connection → mapping_details → create → activate) im
Staging end-to-end testen, OHNE echtes Booking.com-Konto.

Dieser Router stellt genau diese 3 Routen bereit:
  GET  …/sandbox-ota/test_connection/?hotel_code=<property_id>
  GET  …/sandbox-ota/mapping_details/?hotel_code=<property_id>
  POST …/sandbox-ota/changes/

`hotel_code` ist bewusst unsere lokale property_id — so liefert mapping_details
die ECHTEN Zimmer/Raten dieser Property (eine Einheit + ihre Preispläne).

WICHTIG: Nur aktiv, wenn `channex_sandbox_portals` gesetzt ist (Dev/Test). In
Prod sind diese Routen aus, damit kein Test-Kram offen liegt. Kein JWT — Channex
ruft von außen; Schutz über das geteilte `api-key`-Header-Secret (= unser
Sandbox-API-Key, identisch zum channex_webhook_secret-Muster).
"""
from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Header, HTTPException, Query

from src.core.config import get_settings
from src.core.logging import get_logger
from src.core.supabase import get_service_client

log = get_logger("nextdays.sandbox_ota")

router = APIRouter(prefix="/channel-manager/sandbox-ota", tags=["channel_manager"])


def _require_sandbox() -> None:
    if not get_settings().channex_sandbox_portals:
        raise HTTPException(status_code=404, detail="Not found.")


def _check_api_key(api_key: str | None) -> None:
    """OpenChannel sendet den konfigurierten Schlüssel im Header `api-key`.
    Wir prüfen gegen das Webhook-Secret (dasselbe geteilte Geheimnis)."""
    expected = get_settings().channex_webhook_secret.get_secret_value()
    if expected and api_key != expected:
        raise HTTPException(status_code=401, detail="Invalid api-key.")


@router.get("/test_connection/")
def test_connection(
    hotel_code: Annotated[str, Query()],
    api_key: Annotated[str | None, Header(alias="api-key")] = None,
) -> dict[str, Any]:
    """Channex prüft die Erreichbarkeit. Erfolg = property existiert."""
    _require_sandbox()
    _check_api_key(api_key)
    db = get_service_client()
    prop = (
        db.table("properties").select("id").eq("id", hotel_code).limit(1).execute()
    )
    if not prop.data:
        return {"success": False, "errors": ["Unbekannter hotel_code."]}
    log.info("sandbox_ota_test_connection", hotel_code=hotel_code)
    return {"success": True}


@router.get("/mapping_details/")
def mapping_details(
    hotel_code: Annotated[str, Query()],
    api_key: Annotated[str | None, Header(alias="api-key")] = None,
) -> dict[str, Any]:
    """Liefert die Zimmer/Raten der Property im OpenChannel-Format.

    NextDays-Modell: eine property = eine Einheit (ein Room-Type), darunter ihre
    rate_plans. Wir geben genau das zurück, damit die Zuordnungs-Maske echte
    Daten zeigt."""
    _require_sandbox()
    _check_api_key(api_key)
    db = get_service_client()

    prop = (
        db.table("properties")
        .select("id, title")
        .eq("id", hotel_code)
        .limit(1)
        .execute()
    )
    if not prop.data:
        raise HTTPException(status_code=404, detail="Unbekannter hotel_code.")
    p = prop.data[0]

    plans = (
        db.table("rate_plans")
        .select("id, name, currency")
        .eq("property_id", hotel_code)
        .order("created_at")
        .execute()
    ).data or []
    if not plans:
        plans = [{"id": f"{hotel_code}-default", "name": "Standardpreis",
                  "currency": "EUR"}]

    rate_plans = [
        {
            "id": str(rp["id"]),
            "title": rp.get("name") or "Standardpreis",
            "sell_mode": "per_room",
            "max_persons": 2,
            "currency": (rp.get("currency") or "EUR").upper(),
            "read_only": False,
        }
        for rp in plans
    ]
    return {
        "data": {
            "type": "mapping_details",
            "attributes": {
                "room_types": [
                    {
                        "id": str(p["id"]),
                        "title": p.get("title") or "Unterkunft",
                        "rate_plans": rate_plans,
                    }
                ]
            },
        }
    }


@router.post("/changes/")
def changes(
    api_key: Annotated[str | None, Header(alias="api-key")] = None,
) -> dict[str, Any]:
    """Channex pusht ARI-Änderungen hierher (Test). Wir bestätigen nur."""
    _require_sandbox()
    _check_api_key(api_key)
    log.info("sandbox_ota_changes")
    return {"success": True, "unique_id": "sandbox"}


# --- Test-Helfer: Posteingang-Flow ohne Channex-Messaging-Freischaltung -------
# Die echte Channex-Messaging-API ist gesperrt (403). Diese Routen erzeugen einen
# Test-Thread (channex_booking) + eine eingehende Gast-Nachricht, damit sich der
# Posteingang (lesen/senden/KI) lokal end-to-end durchspielen lässt. NUR Sandbox.
@router.post("/simulate-guest-message/")
def simulate_guest_message(
    hotel_code: Annotated[str, Query(description="lokale property_id")],
    text: Annotated[str, Query(description="Gast-Nachricht")] = "Hallo! Wie ist das WLAN-Passwort?",
    guest_name: Annotated[str, Query()] = "Test Gast",
    api_key: Annotated[str | None, Header(alias="api-key")] = None,
) -> dict[str, Any]:
    """Legt (idempotent) einen Test-Thread für die Property an und hängt eine
    eingehende Gast-Nachricht an. Gibt die thread_id zurück."""
    _require_sandbox()
    _check_api_key(api_key)
    db = get_service_client()

    prop = (
        db.table("properties")
        .select("id, tenant_id")
        .eq("id", hotel_code)
        .limit(1)
        .execute()
    )
    if not prop.data:
        raise HTTPException(status_code=404, detail="Unbekannter hotel_code.")
    tenant_id = prop.data[0]["tenant_id"]

    # Stabiler Test-Booking-Schlüssel pro Property (idempotenter Thread).
    cbid = f"sandbox-{hotel_code}"
    existing = (
        db.table("channex_booking")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("channex_booking_id", cbid)
        .limit(1)
        .execute()
    ).data
    if existing:
        thread_id = existing[0]["id"]
    else:
        # Vollständige Test-Buchung, damit das Reservierungs-Panel echte Felder
        # zeigt (Zeitraum, Betrag, Kontakt). Nur Sandbox/Demo.
        parts = guest_name.split(" ", 1)
        ins = (
            db.table("channex_booking")
            .insert(
                {
                    "tenant_id": tenant_id,
                    "channex_booking_id": cbid,
                    "ota_name": "Booking.com",
                    "ota_reservation_code": "SANDBOX-001",
                    "status": "new",
                    "arrival_date": "2026-07-10",
                    "departure_date": "2026-07-17",
                    "amount_cents": 223013,
                    "currency": "EUR",
                    "customer": {
                        "name": parts[0],
                        "surname": parts[1] if len(parts) > 1 else "",
                        "mail": "gast@example.com",
                        "phone": "+49 170 1234567",
                    },
                }
            )
            .execute()
        ).data
        thread_id = ins[0]["id"]

    db.table("sandbox_message").insert(
        {
            "tenant_id": tenant_id,
            "thread_id": thread_id,
            "sender": "guest",
            "message": text,
        }
    ).execute()
    log.info("sandbox_guest_message", hotel_code=hotel_code, thread_id=thread_id)
    return {"success": True, "thread_id": thread_id}
