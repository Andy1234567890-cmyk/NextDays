"""Live-Prüfung der Airbnb-Übernahme gegen die echte Server-DB + Channex.

Prüft, was ohne autorisiertes Airbnb-Konto prüfbar IST — und sagt beim Rest
ehrlich, dass er offen bleibt:

  1. Channex' connection_link verlangt mindestens ein Property (die Ursache,
     weshalb es das Gerüst-Objekt gibt).
  2. Der Katalog liefert für AirBNB `mapping_mode: "listing"` (weshalb der
     Property-Reconcile für Airbnb NICHTS erzeugt).
  3. Das Gerüst-Objekt entsteht serverseitig, bekommt seine Einheit und ist
     idempotent (zweiter Start → kein zweites Objekt).
  4. Ein Listing wird korrekt in properties-Spalten übersetzt, und das erste
     Listing FÜLLT das Gerüst statt daneben ein Objekt anzulegen.
  5. Ein zweiter Übernahme-Lauf verdoppelt nichts (Wurzel 2).

NICHT prüfbar ohne echtes Airbnb-Konto: die Feldnamen der Antwort von
`hosting/listings`. Sie sind aus dem Channex-SPA-Bundle abgeleitet und werden
defensiv gelesen; der Punkt wird am Ende als offen ausgewiesen.

Aufruf (aus apps/api, mit .env):
    python ../../scripts/channex/verify_airbnb_uebernahme.py
"""
from __future__ import annotations

import os
import sys
import uuid
from pathlib import Path

# apps/api ins Modul-Suchpfad, damit `src.*` importierbar ist.
API = Path(__file__).resolve().parents[2] / "apps" / "api"
sys.path.insert(0, str(API))

for zeile in (API / ".env").read_text().splitlines():
    if "=" in zeile and not zeile.strip().startswith("#"):
        schluessel, wert = zeile.split("=", 1)
        os.environ.setdefault(schluessel.strip(), wert.strip())

# pylint: disable=wrong-import-position
from src.core.supabase import get_service_client            # noqa: E402
from src.features.channel_manager.airbnb_uebernahme import (  # noqa: E402
    _GERUEST_TITEL,
)
from src.features.channel_manager.service import (           # noqa: E402
    ChannelManagerService,
)

ok = 0
fehler: list[str] = []


def pruefe(name: str, bedingung: bool, detail: str = "") -> None:
    global ok                                                # noqa: PLW0603
    if bedingung:
        ok += 1
        print(f"  ✓ {name}")
    else:
        fehler.append(f"{name} — {detail}")
        print(f"  ✗ {name} — {detail}")


service = ChannelManagerService(service_client=get_service_client())
db = get_service_client()
channex = service._channex                                   # noqa: SLF001

print("\n1) Channex verlangt ein Property für den OAuth-Link")
gruppe = (channex.list_groups().get("data") or [])[0]["id"]
kanal = channex.create_channel({
    "channel": "AirBNB", "group_id": gruppe, "is_active": False,
    "title": "ND Verify Übernahme",
})
kanal_id = kanal["data"]["id"]
try:
    ott = channex.create_one_time_token(
        property_id=None, group_id=gruppe, username="verify"
    )
    jwt = channex.exchange_one_time_token(ott)
    basis = {
        "group_id": gruppe, "channel_id": kanal_id, "request_id": kanal_id,
        "title": "ND Verify Übernahme",
        "settings": {
            "booking_amount_settings": "Payout Amount",
            "cohost_payout_calculations": False,
            "min_stay_type": "Arrival",
            "send_email_notifications": False,
        },
    }
    verweigert = False
    try:
        channex.create_airbnb_connection_link(jwt=jwt, connection_link=basis)
    except Exception as exc:                                 # noqa: BLE001
        verweigert = "at least 1 item" in str(exc)
    pruefe(
        "connection_link ohne Property wird abgelehnt",
        verweigert,
        "Channex nahm den Link OHNE Property an — dann wäre das Gerüst-Objekt "
        "unnötig und diese Prüfung müsste neu bewertet werden",
    )
finally:
    channex.deactivate_channel(kanal_id)
    channex.delete_channel(kanal_id)

print("\n2) Katalog: Airbnb mappt Listings (keine Properties)")
katalog = channex.list_channel_catalog().get("data") or []
airbnb = None
for eintrag in katalog:
    for kandidat in (eintrag if isinstance(eintrag, list) else [eintrag]):
        if isinstance(kandidat, dict) and kandidat.get("code") == "AirBNB":
            airbnb = kandidat
pruefe("AirBNB im Katalog gefunden", airbnb is not None)
if airbnb:
    pruefe(
        "mapping_mode == 'listing'",
        airbnb.get("mapping_mode") == "listing",
        f"gelesen: {airbnb.get('mapping_mode')}",
    )
    pruefe(
        "rate_params trägt listing_id",
        "listing_id" in (airbnb.get("rate_params") or {}),
        f"gelesen: {list((airbnb.get('rate_params') or {}).keys())}",
    )

print("\n3) Gerüst-Objekt: Anlage, Einheit, Idempotenz")
tenant_id = str(uuid.uuid4())
db.table("tenants").insert({
    "id": tenant_id, "name": "ZZ Verify Übernahme", "country": "DK",
    # currency ist NOT NULL — bewusst DKK zum Land passend, kein EUR-Default
    # (Wurzel 4). Der Wert spielt für diese Prüfung keine Rolle.
    "currency": "DKK",
}).execute()
try:
    erste = service._geruest_objekt(db, tenant_id)            # noqa: SLF001
    zweite = service._geruest_objekt(db, tenant_id)           # noqa: SLF001
    pruefe("zweiter Start liefert dasselbe Objekt", erste == zweite,
           f"{erste} != {zweite}")

    objekte = (
        db.table("properties").select("id, title, status")
        .eq("tenant_id", tenant_id).execute()
    ).data or []
    pruefe("genau EIN Objekt angelegt", len(objekte) == 1,
           f"{len(objekte)} Objekte")
    pruefe("Titel ist der Gerüst-Titel",
           objekte and objekte[0]["title"] == _GERUEST_TITEL,
           f"{objekte[0]['title'] if objekte else '—'}")
    pruefe("Status ist draft (nicht verkäuflich)",
           objekte and objekte[0]["status"] == "draft",
           f"{objekte[0]['status'] if objekte else '—'}")

    einheiten = (
        db.table("property_units").select("id")
        .eq("property_id", erste).execute()
    ).data or []
    pruefe("Einheit vorhanden (0265, sonst 22023 bei Buchung)",
           len(einheiten) == 1, f"{len(einheiten)} Einheiten")

    print("\n4) Listing → Objekt: das erste füllt das Gerüst")
    listing = {
        "id": 987654321, "name": "Strandhus ved Vesterhavet",
        "address": "Vestervej 12", "city": "Hvide Sande",
        "zipcode": "6960", "country_code": "DK", "person_capacity": 6,
        "description": "Lyst hus tæt på stranden.",
    }
    row = service._listing_zu_objekt(listing)                 # noqa: SLF001
    pruefe("Titel übernommen", row and row["title"] == listing["name"])
    pruefe("Adresse übernommen", row and row["address"] == "Vestervej 12")
    pruefe("Land als ISO-2", row and row["country"] == "DK")
    pruefe("Kapazität übernommen", row and row["max_guests"] == 6)
    pruefe("Listing-ID als Schlüssel",
           row and row["airbnb_listing_id"] == "987654321")

    neu = service._objekt_schreiben(db, tenant_id, row)       # noqa: SLF001
    pruefe("kein NEUES Objekt (Gerüst wurde gefüllt)", neu is False)
    nach = (
        db.table("properties").select("id, title, airbnb_listing_id")
        .eq("tenant_id", tenant_id).execute()
    ).data or []
    pruefe("weiterhin genau EIN Objekt", len(nach) == 1, f"{len(nach)}")
    pruefe("Gerüst trägt jetzt den Airbnb-Namen",
           nach and nach[0]["title"] == listing["name"],
           f"{nach[0]['title'] if nach else '—'}")

    print("\n5) Zweiter Lauf verdoppelt nichts (Wurzel 2)")
    nochmal = service._objekt_schreiben(db, tenant_id, row)   # noqa: SLF001
    pruefe("zweiter Schreibvorgang legt nichts an", nochmal is False)

    zweites = service._listing_zu_objekt({                    # noqa: SLF001
        "id": 111222333, "name": "Sommerhus i Skagen", "city": "Skagen",
    })
    pruefe("zweites Listing wird ein NEUES Objekt",
           service._objekt_schreiben(db, tenant_id, zweites) is True)  # noqa: SLF001
    gesamt = (
        db.table("properties").select("id")
        .eq("tenant_id", tenant_id).execute()
    ).data or []
    pruefe("jetzt ZWEI Objekte", len(gesamt) == 2, f"{len(gesamt)}")

    ohne_titel = service._listing_zu_objekt({"id": 5})        # noqa: SLF001
    pruefe("Listing ohne Titel wird übersprungen (kein Platzhalter)",
           ohne_titel is None)
finally:
    # Eng gescoped aufräumen — nur DIESER Test-Tenant (Wurzel 3).
    db.table("property_units").delete().eq("tenant_id", tenant_id).execute()
    db.table("properties").delete().eq("tenant_id", tenant_id).execute()
    db.table("tenants").delete().eq("id", tenant_id).execute()
    print("\n  (Test-Tenant aufgeräumt)")

print(f"\n{'='*66}")
print(f"{ok} Prüfungen grün, {len(fehler)} rot")
for f in fehler:
    print(f"  ✗ {f}")
print("\nOFFEN (ohne autorisiertes Airbnb-Konto nicht prüfbar):")
print("  - die echten Feldnamen von hosting/listings über den Channex-Proxy")
print("  - der vollständige Durchlauf Auth → Listings → Objekte")
sys.exit(1 if fehler else 0)
