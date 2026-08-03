#!/usr/bin/env python3
"""E2E: Steuern und Gebühren je Portal — live gegen Channex (Staging).

WARUM DIESES SKRIPT: „HTTP 200" ist bei Channex kein Beweis. Mehrere Felder
werden freundlich quittiert und still verworfen (siehe feld_sonde.py). Ob unser
Regelwerk (`ota_abgaben.py`) wirklich das erzeugt, was der Branchenstandard
beschreibt, lässt sich nur durch RÜCKLESEN bei Channex feststellen — Posten für
Posten, Set für Set, je Portal.

WAS GEPRÜFT WIRD (die Matrix des Standards):
  Airbnb      Gebühren nach Kategorie×Berechnungsmodell; gleiche Kategorie wird
              summiert; gemischte Modelle fallen ganz weg; Steuern nur Prozent
              und „pro Gast pro Nacht"; alles GETRENNT vom Zimmerpreis; hängt am
              Steuererhebungsszenario.
  Booking.com NUR Prozentwerte, und IM Zimmerpreis enthalten.
  Expedia     nichts.
  Standard    unverändertes Verhalten für Kanäle ohne Sonderregel.
  Löschen     alles weg heißt: bei Channex ist auch alles weg (Wurzel 1).

AUSFÜHRUNG (vom Repo-Root, braucht apps/api/.env mit Staging-Key + DB):
    apps/api/.venv/bin/python scripts/channex/e2e_abgaben.py

Das Skript räumt hinter sich auf (Preis-Blob, Verbindungen, Kanal-Pläne, alle
bei Channex angelegten Posten) — auch wenn eine Prüfung fehlschlägt.
"""
# pylint: disable=wrong-import-position,wrong-import-order,protected-access,import-error
# import-error: die src-Module liegen erst nach dem sys.path-Eintrag unten im
# Suchpfad — pylint löst das statisch nicht auf (wie scripts/demo/*).
# Ein Diagnose-Skript: die .env MUSS vor dem ersten src-Import in der Umgebung
# stehen (die Settings-Klasse liest sie beim Import), und `_request` ist hier
# bewusst direkt angesprochen — für `GET /taxes` mit Paginierung gibt es keine
# öffentliche Client-Methode.
from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
API = ROOT / "apps" / "api"
sys.path.insert(0, str(API))

# .env laden, BEVOR die Settings-Klasse importiert wird.
for zeile in (API / ".env").read_text(encoding="utf-8").splitlines():
    if "=" in zeile and not zeile.lstrip().startswith("#"):
        schluessel, _, wert = zeile.partition("=")
        os.environ.setdefault(schluessel.strip(), wert.strip().strip('"').strip("'"))

from src.core.security import AuthContext  # noqa: E402
from src.core.supabase import get_service_client  # noqa: E402
from src.features.channel_manager.channex_client import ChannexClient  # noqa: E402
from src.features.channel_manager.service import ChannelManagerService  # noqa: E402
from src.features.properties.schemas import PropertyUpdate  # noqa: E402
from src.features.properties.service import PropertiesService  # noqa: E402
from supabase import Client  # noqa: E402

TESTOBJEKT_TITEL = "Smoke-Testhaus"
PORTALE = ("AirBNB", "BookingCom", "Expedia")

# --- Die Abgaben, mit denen die Matrix abgeklopft wird -----------------------
# Jede Zeile ist ein Fall aus dem Standard; die Erwartungen unten beziehen sich
# namentlich darauf.
STEUERN: list[dict[str, Any]] = [
    {
        "id": "e2e-ust", "kind": "vat", "name": "", "mode": "percent",
        "value": 20, "includedInPrice": False,
    },
    {
        "id": "e2e-kurtaxe-prozent", "kind": "local", "taxType": "TouristTax",
        "name": "Kurtaxe Prozent", "mode": "percent", "value": 2.5,
        "includedInPrice": False, "taxableBase": ["base_price", "cleaning"],
    },
    {
        "id": "e2e-kurtaxe-gast-nacht", "kind": "local", "taxType": "TouristTax",
        "name": "Kurtaxe pro Gast pro Nacht", "mode": "amount", "value": 2,
        "chargeBasis": "PerPerson", "period": "PerNight", "includedInPrice": False,
    },
    {
        "id": "e2e-kurtaxe-aufenthalt", "kind": "local", "taxType": "TouristTax",
        "name": "Kurtaxe pro Aufenthalt", "mode": "amount", "value": 20,
        "chargeBasis": "SingleCharge", "period": "PerStay", "includedInPrice": False,
    },
]
GEBUEHREN: list[dict[str, Any]] = [
    # Reinigung, Pauschalbetrag pro Aufenthalt → Airbnb ✅, Booking ❌ (kein %)
    {"id": "e2e-reinigung", "name": "Endreinigung", "amount": 50,
     "mode": "amount", "basis": "per_stay", "optional": False,
     "feeType": "cleaning_fee"},
    # Zwei Gemeinschaftsgebühren, GLEICHES Modell → Airbnb summiert sie zu einer
    {"id": "e2e-parken", "name": "Parkplatz", "amount": 10, "mode": "amount",
     "basis": "per_night", "optional": False, "feeType": "parking"},
    {"id": "e2e-internet", "name": "Internet", "amount": 5, "mode": "amount",
     "basis": "per_night", "optional": False, "feeType": "internet"},
    # Resort als Prozentsatz → Airbnb ✅ UND Booking ✅
    {"id": "e2e-resort", "name": "Resortgebühr", "amount": 5, "mode": "percent",
     "basis": "per_stay", "optional": False, "feeType": "resort"},
    # Wäsche pro Nacht → Airbnb ❌ (Matrix erlaubt nur Aufenthalt/Gast+Aufenthalt)
    {"id": "e2e-waesche", "name": "Wäsche", "amount": 8, "mode": "amount",
     "basis": "per_night", "optional": False, "feeType": "linens"},
    # Ohne Airbnb-Kategorie → nicht an Airbnb („Unknown: not sent"), an Kanäle
    # ohne Sonderregel aber schon
    {"id": "e2e-unbekannt", "name": "Sonstiges", "amount": 3, "mode": "amount",
     "basis": "per_stay", "optional": False, "feeType": "unknown"},
    # Optional → geht an kein Portal (der Gast könnte sie dort nicht abwählen)
    {"id": "e2e-optional", "name": "Frühstück", "amount": 15, "mode": "amount",
     "basis": "per_guest_night", "optional": True, "feeType": "food"},
    # Nur an Booking eingeschränkt
    {"id": "e2e-nur-booking", "name": "Nur Booking", "amount": 4,
     "mode": "percent", "basis": "per_stay", "optional": False,
     "feeType": "service_fee", "portalScope": ["BookingCom"]},
]

# Erwartung je Portal: Titel → (logic, type, rate, is_inclusive).
ERWARTET: dict[str | None, dict[str, tuple[str, str, str, bool]]] = {
    "AirBNB": {
        "USt.": ("percent", "tax", "20", False),
        "Kurtaxe Prozent": ("percent", "city_tax", "2.5", False),
        "Kurtaxe pro Gast pro Nacht": ("per_person_per_night", "city_tax", "2.0", False),
        "Endreinigung": ("per_booking", "fee", "50.0", False),
        "Gemeinschaftsgebühr": ("per_night", "fee", "15.0", False),
        "Resortgebühr": ("percent", "fee", "5.0", False),
    },
    "BookingCom": {
        "USt.": ("percent", "tax", "20", True),
        "Kurtaxe Prozent": ("percent", "city_tax", "2.5", True),
        "Resortgebühr": ("percent", "fee", "5.0", True),
        "Nur Booking": ("percent", "fee", "4.0", True),
    },
    "Expedia": {},
    None: {
        "USt.": ("percent", "tax", "20", False),
        "Kurtaxe Prozent": ("percent", "city_tax", "2.5", False),
        "Kurtaxe pro Gast pro Nacht": ("per_person_per_night", "city_tax", "2.0", False),
        "Kurtaxe pro Aufenthalt": ("per_booking", "city_tax", "20.0", False),
        "Endreinigung": ("per_booking", "fee", "50.0", False),
        "Parkplatz": ("per_night", "fee", "10.0", False),
        "Internet": ("per_night", "fee", "5.0", False),
        "Resortgebühr": ("percent", "fee", "5.0", False),
        "Wäsche": ("per_night", "fee", "8.0", False),
        # Eine Gebühr ohne Airbnb-Kategorie („Unbekannt") geht sehr wohl an
        # Kanäle OHNE Sonderregel: der Standard sagt nur „not sent to Airbnb".
        # Hier nichts zu senden wäre eine erfundene Einschränkung (Wurzel 4).
        "Sonstiges": ("per_booking", "fee", "3.0", False),
    },
}

fehler: list[str] = []


def pruefe(bedingung: bool, text: str) -> None:
    if bedingung:
        print(f"  ✓ {text}")
    else:
        print(f"  ✗ {text}")
        fehler.append(text)


def channex_taxes(cx: ChannexClient) -> dict[str, dict[str, Any]]:
    """Alle Taxes des Accounts als {channex_id: attributes}.

    MIT PAGINIERUNG. `GET /taxes` liefert nur die erste Seite — ohne Blättern
    fehlten beim ersten Lauf genau die Posten, die auf Seite 2 lagen, und das
    sah aus wie „nicht gesendet". Ein Prüfskript, das selbst unvollständig
    liest, ist schlimmer als keines.
    """
    alle: dict[str, dict[str, Any]] = {}
    for seite in range(1, 21):  # harte Obergrenze statt while True
        roh = cx._request(  # noqa: SLF001 — Diagnose-Skript
            "GET",
            "/taxes",
            params={"pagination[page]": seite, "pagination[limit]": 100},
        )
        rows = roh.get("data") or []
        for eintrag in rows:
            alle[eintrag["id"]] = eintrag.get("attributes") or {}
        if len(rows) < 100:
            break
    return alle


def set_inhalt(cx: ChannexClient, set_id: str) -> list[dict[str, Any]]:
    attrs = (cx.get_tax_set(set_id).get("data") or {}).get("attributes") or {}
    return attrs.get("taxes") or []


def main() -> None:  # pylint: disable=too-many-locals,too-many-statements
    db = get_service_client()
    cx = ChannexClient()
    if not cx.is_configured:
        sys.exit("CHANNEX_API_KEY fehlt")

    prop = (
        db.table("properties")
        .select("id, tenant_id, title, type_attributes")
        .eq("title", TESTOBJEKT_TITEL)
        .limit(1)
        .execute()
    ).data
    if not prop:
        sys.exit(f"Testobjekt {TESTOBJEKT_TITEL!r} nicht gefunden")
    property_id = prop[0]["id"]
    tenant_id = prop[0]["tenant_id"]
    attrs_vorher = prop[0].get("type_attributes") or {}
    print(f"Objekt: {TESTOBJEKT_TITEL} ({property_id})")

    ctx = AuthContext(user_id="e2e", tenant_id=tenant_id, role="admin")
    props = PropertiesService(service_client=db)
    cm = ChannelManagerService(service_client=db, channex=cx)

    # --- Stufe A: Verbindungen der drei Portale aktivieren -------------------
    print("\nStufe A — Portale verbinden (AirBNB, BookingCom, Expedia)")
    verbindungen_vorher = (
        db.table("channex_channel_connection")
        .select("id, ota_portal_code, is_active")
        .eq("property_id", property_id)
        .execute()
    ).data or []
    vorher_je_portal = {v["ota_portal_code"]: v for v in verbindungen_vorher}
    pmap = (
        db.table("channex_property_map")
        .select("channex_property_id")
        .eq("property_id", property_id)
        .is_("deleted_at", "null")
        .limit(1)
        .execute()
    ).data
    channex_property_id = pmap[0]["channex_property_id"]
    selbst_angelegt: list[str] = []
    for portal in PORTALE:
        if portal in vorher_je_portal:
            db.table("channex_channel_connection").update({"is_active": True}).eq(
                "id", vorher_je_portal[portal]["id"]
            ).execute()
        else:
            neu = (
                db.table("channex_channel_connection")
                .insert(
                    {
                        "tenant_id": tenant_id,
                        "property_id": property_id,
                        "channex_property_id": channex_property_id,
                        "ota_portal_code": portal,
                        "ota_hotel_id": f"e2e-{portal}",
                        "is_active": True,
                    }
                )
                .execute()
            ).data
            selbst_angelegt.append(neu[0]["id"])
        print(f"  · {portal} aktiv")

    # Airbnb-Steuerexport freischalten — ohne Szenario + beide Schalter gehen
    # KEINE Steuern an Airbnb (fail-closed). Das ist selbst ein Prüfpunkt.
    print("\nStufe B — Airbnb-Steuerszenario: erst gesperrt prüfen")
    try:
        _abgaben_setzen(props, ctx, property_id, attrs_vorher)
        cm.sync_taxes_only(tenant_id, property_id)
        sets = _unsere_sets(db, tenant_id, property_id)
        alle = channex_taxes(cx)
        airbnb_titel = _titel_des_sets(cx, alle, sets.get("AirBNB"))
        pruefe(
            not any(t in airbnb_titel for t in ("USt.", "Kurtaxe Prozent")),
            "ohne freigeschaltetes Szenario gehen keine Steuern an Airbnb",
        )
        pruefe(
            "Endreinigung" in airbnb_titel,
            "Gebühren gehen trotzdem an Airbnb (nur Steuern hängen am Szenario)",
        )

        print("\nStufe C — Szenario freischalten und erneut syncen")
        cm.set_airbnb_tax_settings(
            ctx, property_id, "AirBNB",
            scenario="no_collected", acknowledged=True, send_user_taxes=True,
        )
        cm.sync_taxes_only(tenant_id, property_id)

        print("\nStufe D — Rücklesen bei Channex: Matrix je Portal")
        sets = _unsere_sets(db, tenant_id, property_id)
        alle = channex_taxes(cx)
        for portal, erwartet in ERWARTET.items():
            name = portal or "Standard"
            set_id = sets.get(portal)
            print(f"\n  [{name}]")
            if not erwartet:
                pruefe(set_id is None, f"{name}: kein Set (nichts zu senden)")
                continue
            if set_id is None:
                pruefe(False, f"{name}: Set fehlt")
                continue
            ist = _posten_des_sets(cx, alle, set_id)
            pruefe(
                set(ist) == set(erwartet),
                f"{name}: genau die erwarteten Posten "
                f"(fehlt: {sorted(set(erwartet) - set(ist))}, "
                f"zu viel: {sorted(set(ist) - set(erwartet))})",
            )
            for titel, (logic, typ, rate, inklusiv) in erwartet.items():
                a = ist.get(titel)
                if a is None:
                    continue
                pruefe(
                    a.get("logic") == logic,
                    f"{name}/{titel}: logic={logic} (ist {a.get('logic')})",
                )
                pruefe(
                    a.get("type") == typ,
                    f"{name}/{titel}: type={typ} (ist {a.get('type')})",
                )
                # Zahlenvergleich, nicht Textvergleich: Channex antwortet
                # „20.00", wir senden „20" — dasselbe Geld.
                pruefe(
                    float(a.get("rate") or 0) == float(rate),
                    f"{name}/{titel}: rate={rate} (ist {a.get('rate')})",
                )
                pruefe(
                    bool(a.get("is_inclusive")) is inklusiv,
                    f"{name}/{titel}: is_inclusive={inklusiv} "
                    f"(ist {a.get('is_inclusive')})",
                )

        # Bemessungsgrundlage → Kaskadenebene: die gewählte Kategorie liegt ÜBER
        # der Steuer, die nicht gewählte auf derselben Ebene.
        print("\n  [Bemessungsgrundlage → Ebene]")
        airbnb_set = sets.get("AirBNB")
        if airbnb_set:
            ebenen = {
                (alle.get(e["id"]) or {}).get("title"): e.get("level")
                for e in set_inhalt(cx, airbnb_set)
            }
            pruefe(
                ebenen.get("Endreinigung", 0) > ebenen.get("Kurtaxe Prozent", 0),
                "gewählte Kategorie (Reinigung) liegt über der Steuer",
            )
            pruefe(
                ebenen.get("Resortgebühr") == ebenen.get("Kurtaxe Prozent"),
                "nicht gewählte Kategorie (Resort) liegt auf Steuer-Ebene",
            )

        print("\nStufe E — alles entfernen: bei Channex muss alles weg sein")
        _abgaben_leeren(props, ctx, property_id, attrs_vorher)
        cm.sync_taxes_only(tenant_id, property_id)
        offen = (
            db.table("channex_tax_map")
            .select("id")
            .eq("property_id", property_id)
            .is_("deleted_at", "null")
            .execute()
        ).data or []
        pruefe(len(offen) == 0, "kein aktives Posten-Mapping mehr")
        offene_sets = (
            db.table("channex_tax_set_map")
            .select("id")
            .eq("property_id", property_id)
            .is_("deleted_at", "null")
            .execute()
        ).data or []
        pruefe(len(offene_sets) == 0, "kein aktives Tax-Set mehr")
        rest = channex_taxes(cx)
        e2e_reste = [
            a.get("title")
            for a in rest.values()
            if (a.get("property_id") or "") == channex_property_id
        ]
        pruefe(
            not e2e_reste,
            f"bei Channex keine Posten dieses Objekts mehr (Rest: {e2e_reste})",
        )
    finally:
        print("\nGegenzustand — Objekt und Verbindungen zurücksetzen")
        try:
            props.update(
                ctx, property_id, PropertyUpdate(type_attributes=attrs_vorher)
            )
        except Exception as exc:  # noqa: BLE001 — Aufräumen darf nicht kippen
            print(f"  ! Preis-Blob nicht zurückgesetzt: {exc}")
        for cid in selbst_angelegt:
            db.table("channex_channel_connection").delete().eq("id", cid).execute()
        for portal, alt in vorher_je_portal.items():
            if portal in PORTALE:
                db.table("channex_channel_connection").update(
                    {
                        "is_active": alt["is_active"],
                        "airbnb_tax_scenario": None,
                        "airbnb_tax_acknowledged": False,
                        "airbnb_send_user_taxes": False,
                    }
                ).eq("id", alt["id"]).execute()
        print("  · Verbindungen wie vorher")

    print()
    if fehler:
        print(f"FEHLGESCHLAGEN — {len(fehler)} Prüfung(en):")
        for f in fehler:
            print(f"  · {f}")
        sys.exit(1)
    print("ALLE PRÜFUNGEN GRÜN")


def _abgaben_setzen(
    props: PropertiesService, ctx: AuthContext, property_id: str,
    attrs_vorher: dict[str, Any],
) -> None:
    pricing = dict(attrs_vorher.get("pricing") or {})
    pricing["taxes"] = STEUERN
    pricing["fees"] = GEBUEHREN
    attrs = {**attrs_vorher, "pricing": pricing}
    props.update(ctx, property_id, PropertyUpdate(type_attributes=attrs))
    print("  · Steuern und Gebühren gespeichert (über den echten Update-Pfad)")


def _abgaben_leeren(
    props: PropertiesService, ctx: AuthContext, property_id: str,
    attrs_vorher: dict[str, Any],
) -> None:
    pricing = dict(attrs_vorher.get("pricing") or {})
    pricing["taxes"] = []
    pricing["fees"] = []
    attrs = {**attrs_vorher, "pricing": pricing}
    props.update(ctx, property_id, PropertyUpdate(type_attributes=attrs))


def _unsere_sets(
    db: Client, tenant_id: str, property_id: str
) -> dict[str | None, str]:
    """portal_scope → channex_tax_set_id (nur aktive)."""
    rows = (
        db.table("channex_tax_set_map")
        .select("portal_scope, channex_tax_set_id")
        .eq("tenant_id", tenant_id)
        .eq("property_id", property_id)
        .is_("deleted_at", "null")
        .execute()
    ).data or []
    return {r.get("portal_scope"): r["channex_tax_set_id"] for r in rows}


def _posten_des_sets(
    cx: ChannexClient, alle: dict[str, dict[str, Any]], set_id: str
) -> dict[str, dict[str, Any]]:
    """Titel → Channex-Attribute der Posten eines Sets."""
    out: dict[str, dict[str, Any]] = {}
    for eintrag in set_inhalt(cx, set_id):
        attrs = alle.get(eintrag["id"])
        if attrs:
            out[str(attrs.get("title"))] = attrs
    return out


def _titel_des_sets(
    cx: ChannexClient, alle: dict[str, dict[str, Any]], set_id: str | None
) -> set[str]:
    if not set_id:
        return set()
    return set(_posten_des_sets(cx, alle, set_id))


if __name__ == "__main__":
    main()
