"""Live-Prüfung der Airbnb-Übernahme gegen die echte Server-DB.

Prüft die Logik, die aus einem Airbnb-Listing ein Objekt macht, sowie die
Vorbedingungen des OAuth-Starts.

BEWUSST NICHT ENTHALTEN — es wird NICHTS bei Channex angelegt, geändert oder
gelöscht. Kein Property, kein Kanal, kein Link. Frühere Fassungen dieses
Skripts haben Testkanäle angelegt; das ist Aufgabe des Kunden im echten Ablauf,
nicht die eines Prüfskripts. Die zwei belegten Channex-Tatsachen dahinter sind
LESEND geprüft (Katalog) bzw. in `airbnb_uebernahme.py` dokumentiert:
  * `meta/airbnb/connection_link` verlangt `properties` mit ≥ 1 Eintrag
    (ohne → 422 "should have at least 1 item(s)"), deshalb das Gerüst-Objekt.
  * Der Katalog liefert für AirBNB `mapping_mode: "listing"`, deshalb entstehen
    aus dem Property-Reconcile keine Airbnb-Objekte.

Was hier NICHT prüfbar ist (braucht ein autorisiertes Airbnb-Konto):
  * die echten Feldnamen der Antwort von `hosting/listings`
  * ob Airbnb dort den Preis mitliefert
  * der vollständige Durchlauf Auth → Listings → Objekte

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
from src.features.channel_manager import airbnb_uebernahme  # noqa: E402
from src.features.channel_manager.service import (          # noqa: E402
    ChannelManagerService,
)


class Bericht:
    """Sammelt die Ergebnisse — ohne `global`, damit das Skript selbst den
    Regeln entspricht, die es prüfen soll."""

    def __init__(self) -> None:
        self.gruen = 0
        self.rot: list[str] = []

    def pruefe(self, name: str, bedingung: bool, detail: str = "") -> None:
        if bedingung:
            self.gruen += 1
            print(f"  ✓ {name}")
        else:
            self.rot.append(f"{name} — {detail}")
            print(f"  ✗ {name} — {detail}")

    def abschluss(self) -> int:
        print(f"\n{'=' * 66}")
        print(f"{self.gruen} Prüfungen grün, {len(self.rot)} rot")
        for eintrag in self.rot:
            print(f"  ✗ {eintrag}")
        print("\nOFFEN (ohne autorisiertes Airbnb-Konto nicht prüfbar):")
        print("  - die echten Feldnamen von hosting/listings")
        print("  - ob Airbnb den Preis mitliefert (sonst einmal selbst setzen)")
        print("  - der Durchlauf Auth → Listings → Objekte")
        return 1 if self.rot else 0


def katalog_pruefen(service: ChannelManagerService, b: Bericht) -> None:
    """Nur LESEN: bestätigt, dass Airbnb Listings mappt statt Properties zu
    spiegeln — die Begründung dafür, dass die Übernahme über den Proxy geht."""
    print("\n1) Channex-Katalog (nur lesend)")
    eintraege = service.channex.list_channel_catalog().get("data") or []
    airbnb = None
    for eintrag in eintraege:
        for kandidat in eintrag if isinstance(eintrag, list) else [eintrag]:
            if isinstance(kandidat, dict) and kandidat.get("code") == "AirBNB":
                airbnb = kandidat
    b.pruefe("AirBNB im Katalog gefunden", airbnb is not None)
    if not airbnb:
        return
    b.pruefe(
        "mapping_mode == 'listing' (kein Property-Spiegel)",
        airbnb.get("mapping_mode") == "listing",
        f"gelesen: {airbnb.get('mapping_mode')}",
    )
    b.pruefe(
        "rate_params trägt listing_id",
        "listing_id" in (airbnb.get("rate_params") or {}),
        f"gelesen: {sorted((airbnb.get('rate_params') or {}).keys())}",
    )
    b.pruefe(
        "OAuth-Scope deckt property_management (Proxy auf hosting/listings)",
        "property_management" in str((airbnb.get("payload") or {}).get("scope")),
        f"gelesen: {(airbnb.get('payload') or {}).get('scope')}",
    )


def listing_mapping_pruefen(service: ChannelManagerService, b: Bericht) -> None:
    """Ein Airbnb-Listing → properties-Spalten. Reine Transformation, kein I/O."""
    print("\n2) Listing → Objekt-Felder")
    listing = {
        "id": 987654321, "name": "Strandhus ved Vesterhavet",
        "address": "Vestervej 12", "city": "Hvide Sande", "zipcode": "6960",
        "country_code": "DK", "person_capacity": 6,
        "description": "Lyst hus tæt på stranden.",
    }
    row = service.listing_zu_objekt(listing)
    b.pruefe("Titel übernommen", bool(row) and row["title"] == listing["name"])
    b.pruefe("Adresse übernommen", bool(row) and row["address"] == "Vestervej 12")
    b.pruefe("Ort übernommen", bool(row) and row["city"] == "Hvide Sande")
    b.pruefe("PLZ übernommen", bool(row) and row["postal_code"] == "6960")
    b.pruefe("Land als ISO-2", bool(row) and row["country"] == "DK")
    b.pruefe("Kapazität übernommen", bool(row) and row["max_guests"] == 6)
    b.pruefe(
        "Listing-ID als Wiedererkennungsschlüssel",
        bool(row) and row["airbnb_listing_id"] == "987654321",
    )
    b.pruefe(
        "Listing ohne Titel wird übersprungen (kein Platzhalter)",
        service.listing_zu_objekt({"id": 5}) is None,
    )
    b.pruefe(
        "Listing ohne ID wird übersprungen",
        service.listing_zu_objekt({"name": "Ohne ID"}) is None,
    )
    b.pruefe(
        "kein Preis erfunden (Preis kommt aus Airbnb oder gar nicht)",
        bool(row) and "base_price" not in row and "price" not in row,
    )


def db_kette_pruefen(service: ChannelManagerService, b: Bericht) -> None:
    """Gerüst-Anlage, Einheit, Idempotenz und das Füllen durch das erste
    Listing — gegen die echte Server-DB, in einem eigenen Test-Tenant."""
    print("\n3) Gerüst und Übernahme in der DB")
    db = get_service_client()
    tenant_id = str(uuid.uuid4())
    db.table("tenants").insert({
        "id": tenant_id, "name": "ZZ Verify Übernahme", "country": "DK",
        # currency ist NOT NULL — DKK passend zum Land, kein EUR-Default.
        "currency": "DKK",
    }).execute()
    try:
        erste = service.geruest_objekt_id(db, tenant_id)
        b.pruefe(
            "zweiter Start liefert dasselbe Objekt (idempotent)",
            erste == service.geruest_objekt_id(db, tenant_id),
        )
        objekte = (
            db.table("properties").select("id, title, status")
            .eq("tenant_id", tenant_id).execute()
        ).data or []
        b.pruefe("genau EIN Objekt angelegt", len(objekte) == 1,
                 f"{len(objekte)} Objekte")
        b.pruefe("Status draft (verkauft nichts)",
                 bool(objekte) and objekte[0]["status"] == "draft",
                 objekte[0]["status"] if objekte else "—")
        einheiten = (
            db.table("property_units").select("id")
            .eq("property_id", erste).execute()
        ).data or []
        b.pruefe("Einheit vorhanden (0265, sonst 22023 bei Buchung)",
                 len(einheiten) == 1, f"{len(einheiten)} Einheiten")

        b.pruefe(
            "Gerüst ist noch NICHT bei Channex registriert (der 409-Auslöser)",
            service.channex_property_id_von(db, tenant_id, erste) is None,
        )
        b.pruefe(
            "Währung des Betriebs wird gelesen (kein EUR-Default)",
            service.tenant_currency(db, tenant_id) == "DKK",
            f"gelesen: {service.tenant_currency(db, tenant_id)}",
        )

        print("\n4) Das erste Listing FÜLLT das Gerüst")
        row = service.listing_zu_objekt({
            "id": 987654321, "name": "Strandhus ved Vesterhavet",
            "address": "Vestervej 12", "city": "Hvide Sande",
        })
        b.pruefe("kein NEUES Objekt angelegt",
                 service.objekt_aus_listing_schreiben(db, tenant_id, row) is False)
        nach = (
            db.table("properties").select("id, title")
            .eq("tenant_id", tenant_id).execute()
        ).data or []
        b.pruefe("weiterhin genau EIN Objekt", len(nach) == 1, f"{len(nach)}")
        b.pruefe("Gerüst trägt jetzt den Airbnb-Namen",
                 bool(nach) and nach[0]["title"] == "Strandhus ved Vesterhavet",
                 nach[0]["title"] if nach else "—")
        b.pruefe(
            "kein Geisterobjekt „Übernahme läuft“ übrig",
            all(n["title"] != airbnb_uebernahme.GERUEST_TITEL for n in nach),
        )

        print("\n5) Zweiter Lauf verdoppelt nichts (Wurzel 2)")
        b.pruefe("erneutes Schreiben legt nichts an",
                 service.objekt_aus_listing_schreiben(db, tenant_id, row) is False)
        zweites = service.listing_zu_objekt(
            {"id": 111222333, "name": "Sommerhus i Skagen", "city": "Skagen"}
        )
        b.pruefe("zweites Listing wird ein NEUES Objekt",
                 service.objekt_aus_listing_schreiben(db, tenant_id, zweites) is True)
        gesamt = (
            db.table("properties").select("id")
            .eq("tenant_id", tenant_id).execute()
        ).data or []
        b.pruefe("jetzt ZWEI Objekte", len(gesamt) == 2, f"{len(gesamt)}")
    finally:
        # Eng gescoped aufräumen — nur DIESER Test-Tenant (Wurzel 3).
        db.table("property_units").delete().eq("tenant_id", tenant_id).execute()
        db.table("properties").delete().eq("tenant_id", tenant_id).execute()
        db.table("tenants").delete().eq("id", tenant_id).execute()
        print("\n  (Test-Tenant aufgeräumt)")


def main() -> int:
    service = ChannelManagerService(service_client=get_service_client())
    bericht = Bericht()
    katalog_pruefen(service, bericht)
    listing_mapping_pruefen(service, bericht)
    db_kette_pruefen(service, bericht)
    return bericht.abschluss()


if __name__ == "__main__":
    sys.exit(main())
