"""Baut den Demo-Bestand für Marketing-Screenshots auf.

Zwei Demo-Betriebe mit Objekten, Fotos, Gästen, Buchungen über alle
Vertriebskanäle, Sperrungen, Stop-Sells und Reinigungsaufgaben — so viel Leben,
dass ein Screenshot der App wie ein echter Betrieb aussieht und nicht wie eine
leere Testinstallation.

Der Lauf ist ein vollständiger Neuaufbau: die beiden Demo-Tenants werden
gelöscht (cascade) und aus denselben deterministischen IDs neu geschrieben.
Das ist die Idempotenz dieses Skripts — zweimal laufen lassen ergibt exakt
denselben Bestand, ohne Dubletten (Wurzel 2). Fremde Tenants fasst es nie an.

Buchungen entstehen ausschließlich über `create_reservation_atomic(..., false)`:
* die Kalendernächte werden in derselben Transaktion belegt — kein von Hand
  nachgezogenes `availability` (Wurzel 1),
* `p_with_outbox = false` unterdrückt jeden ARI-Eintrag, damit aus Demo-Daten
  niemals ein Push an Channex/OTAs entsteht.

Aufruf:
    apps/api/.venv/bin/python scripts/demo/fotos.py        # einmal: Fotos holen
    apps/api/.venv/bin/python scripts/demo/seed_demo.py
"""
from __future__ import annotations

import argparse
import json
import random
import secrets
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

# Die Nachbarmodule liegen im selben Ordner; das Skript wird per Pfad
# aufgerufen, nicht als Paket importiert — daher steht der Pfad-Eintrag
# absichtlich vor den Imports.
sys.path.insert(0, str(Path(__file__).resolve().parent))
# pylint: disable=wrong-import-position
from fotos import FOTO_ORDNER, MANIFEST  # noqa: E402
from katalog import BETRIEBE, GAESTE, Betrieb, Objekt  # noqa: E402
from konfig import Supabase, demo_id  # noqa: E402
# pylint: enable=wrong-import-position

# Fester Zufallskeim: gleiche Belegung bei jedem Lauf. Ein Screenshot, der nach
# einem Re-Seed anders aussieht, wäre auf der Website nicht wiederholbar.
KEIM = 20260731

# Zeitfenster des Bestands, relativ zu heute — der Belegungsplan zeigt damit
# Vergangenheit (abgereist), Gegenwart (im Haus) und Zukunft (bestätigt/Option)
# gleichzeitig, also jede Farbe der Legende.
TAGE_ZURUECK = 45
TAGE_VORAUS = 150

# Zielauslastung. Bewusst nicht 100 %: ein voll belegter Plan wirkt unecht und
# nimmt der Dynamic-Pricing-Geschichte die Lücken, die sie erzählt.
ZIEL_AUSLASTUNG = 0.78

# Kanal-Mix. Verhältnis wie in einem typischen Portfolio: OTA-lastig, mit
# spürbarem Direkt- und Plattform-Anteil.
KANAELE: list[tuple[str, float, str | None]] = [
    ("booking", 0.34, "Booking.com"),
    ("airbnb", 0.24, "Airbnb"),
    ("portal", 0.16, None),
    ("direct", 0.16, None),
    ("vrbo", 0.10, "Vrbo"),
]

# Provision je Kanal (Anteil vom Buchungswert). Nur Anzeigewerte für die Demo —
# die echte Abrechnung macht der commissions-Slice.
PROVISION = {"booking": 0.15, "airbnb": 0.15, "vrbo": 0.08, "portal": 0.08, "direct": 0.0}

SPERR_GRUENDE = [
    "Eigennutzung", "Handwerker: Bad", "Wartung Heizung", "Grundreinigung",
    "Malerarbeiten", "Eigenbelegung Familie",
]
STOP_SELL_GRUENDE = ["Renovierung Bad", "Umbau Küche", "Bauarbeiten Nachbargebäude"]


def _heute() -> date:
    return datetime.now(timezone.utc).date()


def _zeitstempel(tag: date, stunde: int = 12) -> str:
    return datetime(tag.year, tag.month, tag.day, stunde, tzinfo=timezone.utc).isoformat()


# ── Aufräumen ────────────────────────────────────────────────────────────────
def aufraeumen(db: Supabase, betrieb: Betrieb) -> None:
    """Demo-Tenant vollständig entfernen — Zeilen, Login und Bilder."""
    tenant_id = demo_id(f"tenant:{betrieb.schluessel}")
    db.delete("tenants", id=f"eq.{tenant_id}")
    db.auth_user_loeschen(betrieb.login)
    geloescht = db.storage_aufraeumen(tenant_id)
    print(f"  aufgeräumt: Tenant, Login, {geloescht} Bilddateien")


# ── Betrieb, Login, Objekte ──────────────────────────────────────────────────
def betrieb_anlegen(db: Supabase, betrieb: Betrieb, passwort: str) -> str:
    """Tenant, abgeschlossenes Onboarding und Admin-Login anlegen."""
    tenant_id = demo_id(f"tenant:{betrieb.schluessel}")
    db.upsert("tenants", [{
        "id": tenant_id,
        "name": betrieb.name,
        "country": betrieb.land,
        "currency": betrieb.waehrung,
        "business_type": betrieb.business_type,
        "accommodation_type": betrieb.accommodation_type,
        "account_type": "pms",
    }])
    # Ohne diese Zeile blendet das Dashboard den Einrichtungs-Assistenten statt
    # der Kennzahlen ein — im Screenshot sähe der Betrieb wie ein leeres,
    # frisch angelegtes Konto aus.
    db.upsert("tenant_onboarding", [{
        "tenant_id": tenant_id,
        "customer_type": "new",
        "has_ota": True,
        "selected_portals": ["BookingCom", "AirBNB", "Vrbo"],
        "company_data_set": True,
        "object_created": True,
        "price_set": True,
        "channels_done": True,
        "completed": True,
        "completed_at": _zeitstempel(_heute() - timedelta(days=120)),
    }], konflikt="tenant_id")
    auth_id = db.auth_user_sicherstellen(
        betrieb.login, passwort, {"tenant_id": tenant_id, "role": "admin"},
    )
    db.upsert("users", [{
        "id": auth_id,
        "tenant_id": tenant_id,
        "role": "admin",
        "email": betrieb.login,
        "full_name": betrieb.kontakt_name,
        "preferred_language": "de",
        "preferred_currency": betrieb.waehrung,
    }])
    return tenant_id


def objekte_anlegen(db: Supabase, betrieb: Betrieb, tenant_id: str) -> dict[str, str]:
    """Objekte + Rate-Plans schreiben; liefert Schlüssel → property_id."""
    zeilen = []
    for objekt in betrieb.objekte:
        zeilen.append({
            "id": demo_id(f"objekt:{objekt.schluessel}"),
            "tenant_id": tenant_id,
            "title": objekt.titel,
            "description": objekt.beschreibung,
            "platform_description": objekt.beschreibung,
            "address": f"{objekt.strasse} {objekt.hausnummer}, {objekt.plz} {objekt.stadt}",
            "street": objekt.strasse,
            "house_number": objekt.hausnummer,
            "postal_code": objekt.plz,
            "city": objekt.stadt,
            "country": objekt.land,
            "lat": objekt.lat,
            "lng": objekt.lng,
            "amenities": objekt.ausstattung,
            "max_guests": objekt.max_gaeste,
            "status": "active",
            "property_type": objekt.property_type,
            "category_slug": objekt.category_slug,
            "subtype_slug": objekt.subtype_slug,
            "listing_type": objekt.listing_type,
            "currency": betrieb.waehrung,
            # Auf allen drei Kanälen sichtbar — genau das zeigen die Kanal-Chips
            # in der Objektliste (Website · Plattform · Portale).
            "listed_on_marketplace": True,
            "listed_on_website": True,
            "booking_mode": "instant",
            "moderation_status": "approved",
            "search_engine_indexing": True,
        })
    db.upsert("properties", zeilen)

    # Zwei Listen, weil PostgREST bei einem Mehrzeilen-Insert identische
    # Schlüsselmengen verlangt — abgeleitete Pläne tragen drei Spalten mehr.
    plaene: list[dict[str, Any]] = []
    abgeleitet: list[dict[str, Any]] = []
    for objekt in betrieb.objekte:
        property_id = demo_id(f"objekt:{objekt.schluessel}")
        standard_id = demo_id(f"rate:{objekt.schluessel}:standard")
        plaene.append({
            "id": standard_id,
            "property_id": property_id,
            "name": "Standardpreis",
            "base_price": objekt.grundpreis,
            "currency": betrieb.waehrung,
            "min_stay": objekt.min_aufenthalt,
            "weekend_surcharge": objekt.wochenend_aufschlag,
            "rate_mode": "manual",
            "send_to_portals": True,
        })
        if objekt.zweiter_plan:
            name, aufschlag = objekt.zweiter_plan
            abgeleitet.append({
                "id": demo_id(f"rate:{objekt.schluessel}:zweit"),
                "property_id": property_id,
                "name": name,
                # Abgeleitete Pläne tragen den Basispreis nur als Spiegelwert;
                # gerechnet wird über derived_from + offset (SiteMinder-Modell).
                "base_price": objekt.grundpreis + aufschlag,
                "currency": betrieb.waehrung,
                "min_stay": objekt.min_aufenthalt,
                "weekend_surcharge": objekt.wochenend_aufschlag,
                "rate_mode": "derived",
                "derived_from_rate_plan_id": standard_id,
                "offset_amount": aufschlag,
                "send_to_portals": True,
            })
    db.upsert("rate_plans", plaene)
    db.upsert("rate_plans", abgeleitet)
    return {o.schluessel: demo_id(f"objekt:{o.schluessel}") for o in betrieb.objekte}


# ── Fotos ────────────────────────────────────────────────────────────────────
def fotos_hochladen(db: Supabase, betrieb: Betrieb, tenant_id: str,
                    objekt_ids: dict[str, str]) -> None:
    """Zwischengespeicherte Fotos in den Bucket laden und am Objekt verknüpfen."""
    if not MANIFEST.exists():
        raise SystemExit(
            "Kein Foto-Manifest. Zuerst laufen lassen: "
            "apps/api/.venv/bin/python scripts/demo/fotos.py"
        )
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    nach_objekt: dict[str, list[dict[str, Any]]] = {}
    for eintrag in manifest:
        nach_objekt.setdefault(eintrag["objekt"], []).append(eintrag)

    foto_zeilen: list[dict[str, Any]] = []
    spiegel: list[dict[str, Any]] = []
    for objekt in betrieb.objekte:
        eintraege = sorted(nach_objekt.get(objekt.schluessel, []), key=lambda e: e["datei"])
        if not eintraege:
            print(f"  ! {objekt.schluessel}: keine Fotos im Manifest")
            continue
        property_id = objekt_ids[objekt.schluessel]
        urls: list[str] = []
        for position, eintrag in enumerate(eintraege):
            daten = (FOTO_ORDNER / eintrag["datei"]).read_bytes()
            # Nicht-ratbarer Dateiname wie im Produktivpfad: der Bucket ist
            # öffentlich, der Schutz sind die Namen.
            pfad = f"{tenant_id}/{property_id}/{secrets.token_hex(8)}.webp"
            url = db.upload(pfad, daten, "image/webp")
            urls.append(url)
            foto_zeilen.append({
                "id": demo_id(f"foto:{objekt.schluessel}:{position}"),
                "property_id": property_id,
                "url": url,
                "sort_order": position,
                "is_cover": position == 0,
                "caption": {},
            })
        spiegel.append({"id": property_id, "photos": urls})
        print(f"  {objekt.schluessel}: {len(urls)} Fotos hochgeladen")

    db.upsert("property_photos", foto_zeilen)
    # properties.photos ist der abgeleitete Kompat-Spiegel (Cover zuerst), den
    # Kalender-Thumbnail und öffentliche Listings lesen — ohne ihn bleibt die
    # Objektzeile im Belegungsplan grau.
    for eintrag in spiegel:
        db.update("properties", {"photos": eintrag["photos"]}, id=f"eq.{eintrag['id']}")


# ── Gäste ────────────────────────────────────────────────────────────────────
def gaeste_anlegen(db: Supabase, tenant_id: str, praefix: str) -> list[dict[str, Any]]:
    """Gästestamm des Betriebs anlegen und die geschriebenen Zeilen liefern."""
    zeilen = []
    for nummer, (vorname, nachname, land) in enumerate(GAESTE):
        email = (
            f"{vorname.lower()}.{nachname.lower().replace(' ', '')}"
            f"@{'beispiel.de' if land == 'DE' else 'example.com'}"
        )
        zeilen.append({
            "id": demo_id(f"gast:{praefix}:{nummer}"),
            "tenant_id": tenant_id,
            "name": f"{vorname} {nachname}",
            "first_name": vorname,
            "last_name": nachname,
            "email": email,
            "phone": f"+49 170 {2000000 + nummer * 4177}",
            "nationality": land,
            "language": "de" if land in ("DE", "AT", "CH") else "en",
        })
    return db.upsert("guests", zeilen)


# ── Buchungen ────────────────────────────────────────────────────────────────
def _preis(objekt: Objekt, anreise: date, naechte: int) -> float:
    """Summe der Nächte: Grundpreis, freitags/samstags mit Aufschlag."""
    summe = 0.0
    for versatz in range(naechte):
        tag = anreise + timedelta(days=versatz)
        summe += objekt.grundpreis
        if tag.weekday() in (4, 5):
            summe += objekt.wochenend_aufschlag
    return round(summe, 2)


def _kanal_waehlen(wuerfel: random.Random) -> tuple[str, str | None]:
    wurf = wuerfel.random()
    laufend = 0.0
    for kanal, anteil, portal in KANAELE:
        laufend += anteil
        if wurf <= laufend:
            return kanal, portal
    return KANAELE[-1][0], KANAELE[-1][2]


def buchungen_anlegen(db: Supabase, betrieb: Betrieb, tenant_id: str,
                      objekt_ids: dict[str, str],
                      gaeste: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Buchungen über alle Kanäle erzeugen; belegt die Kalendernächte mit."""
    heute = _heute()
    beginn = heute - timedelta(days=TAGE_ZURUECK)
    ende = heute + timedelta(days=TAGE_VORAUS)
    wuerfel = random.Random(KEIM + hash(betrieb.schluessel) % 1000)
    angelegt: list[dict[str, Any]] = []

    for objekt in betrieb.objekte:
        property_id = objekt_ids[objekt.schluessel]
        rate_plan_id = demo_id(f"rate:{objekt.schluessel}:standard")
        zeiger = beginn + timedelta(days=wuerfel.randint(0, 3))

        while zeiger < ende:
            naechte = wuerfel.randint(objekt.min_aufenthalt, objekt.min_aufenthalt + 4)
            abreise = zeiger + timedelta(days=naechte)
            if abreise > ende:
                break

            kanal, portal = _kanal_waehlen(wuerfel)
            gast = wuerfel.choice(gaeste)
            gesamt = _preis(objekt, zeiger, naechte)
            provision = round(gesamt * PROVISION[kanal], 2)

            if abreise <= heute:
                status, bezahlt, zahlstatus = "completed", gesamt, "paid"
            elif zeiger <= heute < abreise:
                status, bezahlt, zahlstatus = "confirmed", gesamt, "paid"
            elif wuerfel.random() < 0.12:
                status, bezahlt, zahlstatus = "pending", 0.0, "unpaid"
            else:
                anzahlung = round(gesamt * 0.3, 2)
                status, bezahlt, zahlstatus = "confirmed", anzahlung, "deposit_held"

            erwachsene = min(objekt.max_gaeste, wuerfel.randint(2, objekt.max_gaeste))
            kinder = wuerfel.randint(0, max(0, objekt.max_gaeste - erwachsene))
            gebucht_am = zeiger - timedelta(days=wuerfel.randint(9, 75))

            reservierung: dict[str, Any] = {
                "id": demo_id(f"res:{objekt.schluessel}:{zeiger.isoformat()}"),
                "tenant_id": tenant_id,
                "property_id": property_id,
                "guest_id": gast["id"],
                "rate_plan_id": rate_plan_id,
                "channel": kanal,
                "check_in": zeiger.isoformat(),
                "check_out": abreise.isoformat(),
                "status": status,
                "total_amount": gesamt,
                "paid_amount": bezahlt,
                "payment_status": zahlstatus,
                "currency": betrieb.waehrung,
                "channel_fee": provision,
                "num_guests": erwachsene + kinder,
                "adults": erwachsene,
                "children": kinder,
                "guest_email": gast["email"],
                "guest_phone": gast["phone"],
                "guest_country": gast["nationality"],
                "guest_language": gast["language"],
                "created_at": _zeitstempel(gebucht_am, wuerfel.randint(8, 21)),
            }
            if portal:
                reservierung["ota_name"] = portal
                nummer = wuerfel.randint(10**7, 10**8 - 1)
                reservierung["external_ref"] = f"{portal[:3].upper()}-{nummer}"
            if abreise <= heute:
                reservierung["checked_in_at"] = _zeitstempel(zeiger, 16)
                reservierung["checked_out_at"] = _zeitstempel(abreise, 10)
            elif zeiger <= heute < abreise:
                reservierung["checked_in_at"] = _zeitstempel(zeiger, 16)

            db.rpc("create_reservation_atomic", {
                "p_reservation": reservierung,
                "p_source": kanal,
                # Kein ARI-Eintrag: Demo-Daten dürfen niemals an Channex/OTAs gehen.
                "p_with_outbox": False,
            })
            angelegt.append({**reservierung, "objekt": objekt.schluessel})

            # Lücke bis zur nächsten Buchung — steuert die Auslastung.
            luecke = max(0, round(naechte * (1 - ZIEL_AUSLASTUNG) / ZIEL_AUSLASTUNG
                                  * wuerfel.uniform(0.4, 2.1)))
            zeiger = abreise + timedelta(days=luecke)

    print(f"  {len(angelegt)} Buchungen")
    return angelegt


def stornos_anlegen(db: Supabase, betrieb: Betrieb, tenant_id: str,
                    objekt_ids: dict[str, str], gaeste: list[dict[str, Any]]) -> None:
    """Ein paar stornierte Buchungen — sie belegen keine Nacht.

    Deshalb laufen sie NICHT über die RPC (die würde Kalendernächte belegen),
    sondern als direkter Insert: eine stornierte Reservierung ist Historie,
    kein Bestand.
    """
    heute = _heute()
    wuerfel = random.Random(KEIM + 7)
    zeilen = []
    for nummer, objekt in enumerate(betrieb.objekte[:6]):
        anreise = heute + timedelta(days=wuerfel.randint(20, 110))
        naechte = wuerfel.randint(2, 5)
        gast = wuerfel.choice(gaeste)
        kanal, portal = _kanal_waehlen(wuerfel)
        gesamt = _preis(objekt, anreise, naechte)
        zeilen.append({
            "id": demo_id(f"storno:{objekt.schluessel}:{nummer}"),
            "tenant_id": tenant_id,
            "property_id": objekt_ids[objekt.schluessel],
            "guest_id": gast["id"],
            "channel": kanal,
            "check_in": anreise.isoformat(),
            "check_out": (anreise + timedelta(days=naechte)).isoformat(),
            "status": "cancelled",
            "total_amount": gesamt,
            "currency": betrieb.waehrung,
            "guest_email": gast["email"],
            "cancel_reason": wuerfel.choice([
                "Gast hat kostenfrei storniert", "Reise abgesagt",
                "Umbuchung auf anderen Zeitraum",
            ]),
            "cancelled_at": _zeitstempel(heute - timedelta(days=wuerfel.randint(1, 20))),
            "ota_name": portal,
        })
    db.upsert("reservations", zeilen)
    print(f"  {len(zeilen)} Stornos")


# ── Sperrungen, Stop-Sell, Aufgaben ──────────────────────────────────────────
def sperrungen_anlegen(db: Supabase, betrieb: Betrieb, tenant_id: str,
                       objekt_ids: dict[str, str]) -> None:
    """Wartungssperren und Stop-Sells auf Tagen, die noch frei sind.

    Erst nach den Buchungen, und nur auf freien Tagen: eine Sperre auf einer
    belegten Nacht wäre ein Widerspruch im Bestand, kein hübscherer Screenshot.
    """
    heute = _heute()
    wuerfel = random.Random(KEIM + 21)
    # Je Objekt einzeln abfragen: PostgREST deckelt Antworten, und ein
    # stillschweigend abgeschnittenes Ergebnis würde hier Sperren auf belegte
    # Nächte legen.
    belegt: dict[str, set[str]] = {
        property_id: {
            zeile["date"] for zeile in
            db.select("availability", select="date", property_id=f"eq.{property_id}")
        }
        for property_id in objekt_ids.values()
    }

    sperren, stops = [], []
    for nummer, objekt in enumerate(betrieb.objekte):
        property_id = objekt_ids[objekt.schluessel]
        frei = [
            tag for versatz in range(5, TAGE_VORAUS)
            if (tag := heute + timedelta(days=versatz)).isoformat()
            not in belegt.get(property_id, set())
        ]
        if len(frei) < 8:
            continue
        start = wuerfel.choice(frei[: max(1, len(frei) - 6)])
        for versatz in range(wuerfel.randint(2, 4)):
            tag = start + timedelta(days=versatz)
            if tag.isoformat() in belegt.get(property_id, set()):
                continue
            sperren.append({
                "property_id": property_id,
                "date": tag.isoformat(),
                "status": "blocked",
                "source": "manual",
            })
        if nummer % 4 == 0:
            stop_start = wuerfel.choice(frei[len(frei) // 2:] or frei)
            for versatz in range(2):
                tag = stop_start + timedelta(days=versatz)
                if tag.isoformat() in belegt.get(property_id, set()):
                    continue
                stops.append({
                    "id": demo_id(f"stop:{objekt.schluessel}:{tag.isoformat()}"),
                    "tenant_id": tenant_id,
                    "property_id": property_id,
                    "date": tag.isoformat(),
                    "reason": wuerfel.choice(STOP_SELL_GRUENDE),
                    "source": "manual",
                    "scope": "all",
                })
    db.upsert("availability", sperren, konflikt="property_id,date")
    db.upsert("stop_sell", stops)
    print(f"  {len(sperren)} gesperrte Nächte, {len(stops)} Stop-Sell-Tage")


def portale_verbinden(db: Supabase, betrieb: Betrieb, tenant_id: str,
                      objekt_ids: dict[str, str]) -> None:
    """Portal-Verbindungen eintragen, damit der Chip „Portale" grün ist.

    Der Chip liest ausschließlich `channex_channel_connection` — die
    Registrierungs-Map allein bedeutet nur „bei Channex bekannt", nicht
    „Portal verbunden" (properties/service.py). Beide Zeilen sind reine
    Anzeigedaten:

    * Es entsteht KEIN Push. Der Worker arbeitet die `ari_outbox` ab, und die
      bleibt für Demo-Daten leer (`p_with_outbox = False`).
    * Der Reconcile-Cron läuft nur über Tenants mit `channex_group_map`-Zeile.
      Die legen wir bewusst NICHT an — sonst würde der Job alle 15 Minuten mit
      erfundenen Channex-IDs gegen die echte API laufen.
    """
    portale = [("BookingCom", "Booking.com"), ("AirBNB", "Airbnb"), ("Vrbo", "Vrbo")]
    karten, verbindungen = [], []
    for objekt in betrieb.objekte:
        property_id = objekt_ids[objekt.schluessel]
        channex_property = f"demo-{demo_id(f'channex:{objekt.schluessel}')[:18]}"
        karten.append({
            "id": demo_id(f"cxmap:{objekt.schluessel}"),
            "tenant_id": tenant_id,
            "property_id": property_id,
            "channex_property_id": channex_property,
            "sync_enabled": True,
            "last_sync_status": "ok",
        })
        for code, name in portale:
            verbindungen.append({
                "id": demo_id(f"cxconn:{objekt.schluessel}:{code}"),
                "tenant_id": tenant_id,
                "property_id": property_id,
                "channex_property_id": channex_property,
                "ota_portal_code": code,
                "ota_hotel_id": f"demo-{name.lower().replace('.', '')}",
                "is_active": True,
            })
    db.upsert("channex_property_map", karten)
    db.upsert("channex_channel_connection", verbindungen)
    print(f"  {len(verbindungen)} Portal-Verbindungen")


def aufgaben_anlegen(db: Supabase, tenant_id: str,
                     buchungen: list[dict[str, Any]]) -> None:
    """Reinigung zum Abreisetag — die Aufgabenliste der App füllt sich daraus."""
    heute = _heute()
    wuerfel = random.Random(KEIM + 33)
    zeilen = []
    for buchung in buchungen:
        abreise = date.fromisoformat(buchung["check_out"])
        if abreise < heute - timedelta(days=14) or abreise > heute + timedelta(days=30):
            continue
        erledigt = abreise < heute
        zeilen.append({
            "id": demo_id(f"aufgabe:{buchung['id']}"),
            "tenant_id": tenant_id,
            "property_id": buchung["property_id"],
            "reservation_id": buchung["id"],
            "title": "Endreinigung nach Abreise",
            "description": f"Wechsel für {buchung['num_guests']} Gäste",
            "status": "done" if erledigt else "open",
            "due_at": _zeitstempel(abreise, 11),
            "start_at": _zeitstempel(abreise, 10),
            "end_at": _zeitstempel(abreise, 13),
            "source": "manual",
            "priority": wuerfel.choice([0, 0, 1]),
            "completed_at": _zeitstempel(abreise, 13) if erledigt else None,
        })
    db.upsert("tasks", zeilen)
    print(f"  {len(zeilen)} Reinigungsaufgaben")


# ── Ablauf ───────────────────────────────────────────────────────────────────
def main() -> int:
    """Beide Demo-Betriebe neu aufbauen und die Logins ausgeben."""
    parser = argparse.ArgumentParser(description="Demo-Bestand für Screenshots aufbauen")
    parser.add_argument("--betrieb", help="nur dieser Betrieb (nordlicht|seeblick)")
    parser.add_argument("--nur-loeschen", action="store_true",
                        help="Demo-Tenants nur entfernen, nichts neu anlegen")
    parser.add_argument("--passwort", help="Passwort der Demo-Logins "
                                           "(sonst wird eines erzeugt und ausgegeben)")
    argumente = parser.parse_args()

    db = Supabase()
    passwort = argumente.passwort or f"Demo-{secrets.token_urlsafe(9)}"

    for betrieb in BETRIEBE:
        if argumente.betrieb and betrieb.schluessel != argumente.betrieb:
            continue
        print(f"\n{betrieb.name}")
        aufraeumen(db, betrieb)
        if argumente.nur_loeschen:
            continue

        tenant_id = betrieb_anlegen(db, betrieb, passwort)
        objekt_ids = objekte_anlegen(db, betrieb, tenant_id)
        print(f"  {len(objekt_ids)} Objekte")
        fotos_hochladen(db, betrieb, tenant_id, objekt_ids)
        gaeste = gaeste_anlegen(db, tenant_id, betrieb.schluessel)
        buchungen = buchungen_anlegen(db, betrieb, tenant_id, objekt_ids, gaeste)
        stornos_anlegen(db, betrieb, tenant_id, objekt_ids, gaeste)
        sperrungen_anlegen(db, betrieb, tenant_id, objekt_ids)
        portale_verbinden(db, betrieb, tenant_id, objekt_ids)
        aufgaben_anlegen(db, tenant_id, buchungen)

    if not argumente.nur_loeschen:
        print("\nLogins:")
        for betrieb in BETRIEBE:
            if argumente.betrieb and betrieb.schluessel != argumente.betrieb:
                continue
            print(f"  {betrieb.login}   {passwort}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
