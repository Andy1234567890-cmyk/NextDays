"""Baut den Demo-Bestand für Marketing-Screenshots auf.

Zwei Demo-Betriebe mit Objekten, Fotos, Gästen, Buchungen über alle
Vertriebskanäle, Sperrungen, Stop-Sells, Reinigungsaufgaben und einem
vollständigen Personalbereich (Akte, Dienstplan, Zeiten — `personal.py`) — so viel Leben,
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
    apps/api/.venv/bin/python scripts/demo/seed_demo.py \
        --betrieb seeblick --nur-personal --passwort '<DEIN_WERT>'
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
# too-many-locals: die Aufbau-Funktionen setzen je einen zusammenhängenden
# Datensatz (Objekt + Einheit + Rate-Plan, Buchung + Gast + Kalendernächte). In
# Hilfsfunktionen zerlegt, müsste man ein Dutzend Zwischenwerte durchreichen,
# ohne dass die Zeile lesbarer wird — ein Seed-Skript soll von oben nach unten
# zeigen, welche Felder eine Demo-Zeile trägt.
# pylint: disable=too-many-locals
from fotos import FOTO_ORDNER, MANIFEST  # noqa: E402
from gaestemappe import type_attributes  # noqa: E402
from posteingang import threads_anlegen  # noqa: E402
from eigentuemer import eigentuemer_anlegen, portalzugang_anlegen  # noqa: E402
from katalog import BETRIEBE, GAESTE, Betrieb, Objekt  # noqa: E402
from konfig import Supabase, demo_id  # noqa: E402
from personal import personal_anlegen  # noqa: E402
# Die Modulliste des Abrechnungs-Slice: eine Kopie hier liefe bei jedem neuen
# Modul aus dem Tritt.
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "apps" / "api"))
from src.features.subscriptions.schemas import MODULE_KEYS  # noqa: E402
from src.features.auth.modul_freischaltung import MODUL_PRAEFIXE  # noqa: E402
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

# Zahlungsgebühr je Kanal — was das Portal ZUSÄTZLICH zur Provision einbehält,
# wenn es das Geld selbst einzieht. Nur Booking weist sie getrennt aus; Airbnb
# und Vrbo kennen keine (fehlender Eintrag = keine Gebühr).
#
# Sie steht hier neben `PROVISION`, weil BEIDE zusammen den Portal-Abzug
# ergeben: `channel_fee` einer Buchung trägt die Summe, und
# `portal_saetze_anlegen` schreibt dieselben zwei Zahlen als Satz. Getrennte
# Quellen ergäben eine Abrechnung, die ihrer eigenen Buchungszeile
# widerspricht — genau das war bis 07.09.2026 der Fall (Booking: 15 % in
# `channel_fee`, 16,5 % in der Rechenkette).
ZAHLUNGSGEBUEHR = {"booking": 0.015}


def _portal_abzug_anteil(kanal: str) -> float:
    """Was das Portal insgesamt einbehält: Provision + Zahlungsgebühr."""
    return PROVISION[kanal] + ZAHLUNGSGEBUEHR.get(kanal, 0.0)

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
        # MUSS hier stehen, nicht nur in der Migration: `aufraeumen` loescht die
        # Mandanten-Zeile, dieser Upsert legt sie neu an — ein per Migration
        # gesetztes `is_demo` faellt damit auf den Default `false`. Genau so ging
        # die Absicherung der Vorfuehrung verloren (0529): Schreibsperre,
        # Bereichssperre, Schloss-Symbole und der `storybook_chat`-Ausschluss
        # haengen alle an diesem einen Schalter, und ohne ihn war die
        # oeffentliche Vorfuehrung voll bedienbar. Explizit auch im
        # `False`-Fall setzen, damit ein Betrieb das Flag nicht aus einer
        # frueheren Zeile behaelt (Wurzel 1: Gegenzustand mitpflegen).
        "is_demo": betrieb.ist_vorfuehrung,
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


def firma_anlegen(db: Supabase, betrieb: Betrieb, tenant_id: str) -> None:
    """Rechts- und Rechnungsdaten des Betriebs (`tenant_billing_profile`).

    PFLICHT, nicht Zierde: `DashboardService._real_progress` prueft die ZEILE,
    nicht das Flag `company_data_set` (Wurzel 4 — ein Flag sagt, was jemand
    vorhatte, die Zeile sagt, was passiert ist). Fehlt sie, faellt das
    Onboarding auf "Firmendaten fehlen" zurueck, die Oberflaeche zeigt den
    Einrichtungs-Assistenten statt der Kennzahlen, und jede Rechnung haette
    keinen Absender. Live am 30.08.2026: alle drei Demo-Betriebe trugen
    `company_data_set = true` und hatten KEIN Profil.

    Die Zahlungsanbieter (Stripe/PayPal) bleiben bewusst leer: ein Demo-Betrieb
    hat kein echtes Connect-Konto, und erfundene IDs wuerden beim ersten
    Statusabruf auffliegen.
    """
    f = betrieb.firma
    db.upsert("tenant_billing_profile", [{
        "tenant_id": tenant_id,
        "legal_name": f.legal_name,
        "legal_form": f.legal_form,
        "merchant_name": betrieb.name,
        "company_street": f.strasse,
        "company_house_number": f.hausnummer,
        "company_postal_code": f.plz,
        "company_city": f.stadt,
        "company_country": f.land,
        "vat_id": f.vat_id,
        "tax_number": f.steuernummer,
        "company_register": f.handelsregister,
        "district_court": f.amtsgericht,
        "managing_director_first_name": f.geschaeftsfuehrer[0],
        "managing_director_last_name": f.geschaeftsfuehrer[1],
        "email": f.email,
        "phone_number": f.telefon,
        "website": f.website,
        "account_holder": f.legal_name,
        "iban": f.iban,
        "bic": f.bic,
        "bank_name": f.bank,
        "default_tax_rate": f.steuersatz,
        "lodging_tax_rate": f.kurtaxe,
        "is_kleinunternehmer": False,
        "default_payment_days": 14,
        "manual_payments_enabled": True,
    }], konflikt="tenant_id")


def abo_anlegen(db: Supabase, betrieb: Betrieb, tenant_id: str) -> None:
    """Laufendes Abo (`tenant_subscription`).

    Ohne aktives Abo ist die Oberflaeche eine Sackgasse: `publish()` lehnt mit
    422 ab und die Navigation blendet Bereiche aus. Ein Demo-Betrieb, der seine
    Objekte nicht veroeffentlichen kann, taugt weder zum Vorfuehren noch fuer
    Screenshots.

    Kein Stripe-Abo dahinter (die IDs bleiben leer) — der Status ist gesetzt,
    weil er den Zustand eines zahlenden Kunden ABBILDET, nicht weil Geld
    fliesst.
    """
    db.upsert("tenant_subscription", [{
        "tenant_id": tenant_id,
        "status": "active",
        # Ein Jahr voraus: ein Enddatum in der Vergangenheit liesse das Abo
        # abgelaufen aussehen, sobald der Bestand ein paar Wochen alt ist.
        "current_period_end": _zeitstempel(_heute() + timedelta(days=365)),
        "reported_property_count": len(betrieb.objekte),
        "cancel_at_period_end": False,
    }], konflikt="tenant_id")


def module_freischalten(db: Supabase, tenant_id: str) -> None:
    """ALLE Zusatzmodule freischalten (`tenant_module_entitlement`).

    Die Demo-Betriebe sind ENTWICKLER-Konten: jeder Bereich muss ohne Kaufhürde
    erreichbar sein — Personal, Buchhaltung, Jobmarkt, Hotel, Avatar,
    Dynamische Preise und die Schloss-Anbieter. Bis 07.09.2026 stand hier NICHTS:
    alle drei Demo-Tenants hatten null Einträge, womit Personalbereich und
    Buchhaltung hinter der Modulsperre lagen und auf keinem Screenshot
    auftauchen konnten (live gemessen).

    Kein Stripe-Item dahinter (`stripe_subscription_item_id` bleibt leer) —
    derselbe Grund wie beim Abo: der Zustand wird ABGEBILDET, es fließt kein
    Geld. `active_until = None` heißt „läuft unbefristet".

    Die Modulliste kommt aus `MODULE_KEYS` (subscriptions/schemas.py), nicht aus
    einer Kopie hier: ein neues Modul soll im Demo-Bestand automatisch
    mitkommen und nicht an einer vergessenen zweiten Liste hängen bleiben.
    """
    zeilen = [{
        "id": demo_id(f"modul:{tenant_id}:{schluessel}"),
        "tenant_id": tenant_id,
        "module_key": schluessel,
        "active": True,
        "active_until": None,
    } for schluessel in sorted(MODULE_KEYS)]
    db.upsert("tenant_module_entitlement", zeilen, konflikt="tenant_id,module_key")

    # ZWEITE, UNABHÄNGIGE Sperre: `tenants.enabled_modules`.
    #
    # Sie hat mit dem Abrechnungs-Entitlement oben NICHTS zu tun und wird von
    # `modul_pruefen()` gelesen — fehlt der Präfix dort, antwortet die Route mit
    # 404 („Dieser Bereich ist für diesen Betrieb nicht verfügbar") und die
    # Navigation blendet den Punkt aus. Live am 07.09.2026 stand sie bei ALLEN
    # drei Demo-Betrieben auf `[]`: Personalbereich und Website-Baukasten waren
    # in der Sidebar unsichtbar, obwohl der Personalbestand vollständig da war.
    #
    # Wer nur die eine Tabelle füllt, hat das Modul halb freigeschaltet — genau
    # deshalb stehen beide Schreibvorgänge in DERSELBEN Funktion.
    db.update("tenants", {"enabled_modules": sorted(MODUL_PRAEFIXE)},
              id=f"eq.{tenant_id}")
    print(f"  {len(zeilen)} Module freigeschaltet, "
          f"Bereiche: {', '.join(sorted(MODUL_PRAEFIXE))}")


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
            # Gästemappe + Richtlinien: die EINZIGE Quelle der KI-Antwort
            # (`inbox/ki_kontext.py` liest bei jeder Frage frisch hier). Ohne
            # sie antwortet die KI in der Vorführung ausweichend, obwohl das
            # Objekt vollständig gepflegt aussieht.
            "type_attributes": type_attributes(betrieb, objekt),
        })
    db.upsert("properties", zeilen)

    # Einheiten (0265): jede properties-Zeile ist EIN Einheiten-TYP, verkauft
    # wird die EINHEIT. Ohne mindestens eine `property_units`-Zeile lehnt
    # `create_reservation_atomic` (0275) mit 22023 ab — verkaufen kann man nur,
    # was eine Einheit hat. Die Demo-Objekte sind Ferienobjekte bzw. einzeln
    # geführte Zimmer, also genau eine Einheit je Typ (der Normalfall).
    db.upsert("property_units", [
        {
            "id": demo_id(f"einheit:{objekt.schluessel}"),
            "tenant_id": tenant_id,
            "property_id": demo_id(f"objekt:{objekt.schluessel}"),
            "name": objekt.titel,
            "position": 0,
        }
        for objekt in betrieb.objekte
    ])

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
            provision = round(gesamt * _portal_abzug_anteil(kanal), 2)

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
                # Gesperrt wird die EINHEIT, nicht der Typ (0265): `unit_id` ist
                # NOT NULL und Teil des Unique-Keys. Die Demo-Objekte haben
                # genau eine Einheit, deren ID aus demselben Schlüssel kommt.
                "unit_id": demo_id(f"einheit:{objekt.schluessel}"),
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
    db.upsert("availability", sperren, konflikt="property_id,unit_id,date")
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


def portal_saetze_anlegen(db: Supabase, tenant_id: str) -> None:
    """Portal-Abzugssätze (0364) — ohne sie bleibt die Abrechnung auf „—".

    Der Portal-Abzug einer Buchung steht entweder als GEMELDETER Betrag in
    `reservations.ota_commission`, oder er wird aus dem hier hinterlegten Satz
    rekonstruiert. Demo-Buchungen melden nichts (kein echter Portal-Feed), also
    ist dieser Satz die einzige Quelle. Fehlt er, ist der Abzug nicht
    bestimmbar und die Kette zeigt korrekt „—" — Portal-Abzug, Provision UND
    Eigentümer-Anteil, weil die Provision auf die Auszahlung NACH Portal-Abzug
    rechnet (`common.portal_abzug`: kein Satz → kein 0 %, sonst zahlte man dem
    Eigentümer den Portal-Anteil als Ertrag aus).

    Die Sätze müssen `PROVISION` + `ZAHLUNGSGEBUEHR` spiegeln: dieselben zwei
    Zahlen stecken als Betrag in `reservations.channel_fee`
    (`_portal_abzug_anteil`). Zwei verschiedene Werte ergäben eine Abrechnung,
    die ihrer eigenen Buchungszeile widerspricht.

    `direct` bekommt bewusst KEINEN Satz: bei den eigenen Kanälen des Betriebs
    steht kein Portal dazwischen, der Abzug ist dort bekannt 0
    (`ohne_portal_abzug`). Ein 0-%-Satz wäre eine überflüssige Behauptung.
    Der eigene Marktplatz (`portal`) zählt NICHT dazu — myBestDays nimmt
    Provision wie Booking.

    Die Zahlungsgebühr trägt nur, wer das Geld auch einzieht: Booking weist sie
    getrennt aus, Airbnb und Vrbo kennen keine (NULL = erhebt keine).
    `gueltig_ab` liegt weit vor jeder Demo-Buchung, damit der Satz für den
    gesamten sichtbaren Zeitraum gilt; `gueltig_bis` bleibt offen.
    """
    saetze = [
        {
            "id": demo_id(f"{tenant_id}:portalsatz:{kanal}"),
            "tenant_id": tenant_id,
            "kanal": kanal,
            "property_id": None,
            "gueltig_ab": "2020-01-01",
            "gueltig_bis": None,
            "provision_pct": round(anteil * 100, 2),
            "zahlungsgebuehr_pct": (
                round(ZAHLUNGSGEBUEHR[kanal] * 100, 2)
                if kanal in ZAHLUNGSGEBUEHR
                else None
            ),
            "notiz": "Vorführdaten — dieselben Sätze stecken in channel_fee.",
        }
        for kanal, anteil in PROVISION.items()
        if kanal != "direct"
    ]
    db.upsert("portal_abzugssaetze", saetze)
    print(f"  {len(saetze)} Portal-Abzugssätze")


def channel_fee_nachziehen(db: Supabase, tenant_id: str) -> None:
    """`channel_fee` bestehender Buchungen auf den vollen Portal-Abzug bringen.

    Nur für Bestandsdaten nötig: bis 07.09.2026 trug `channel_fee` allein die
    Provision, während die Rechenkette zusätzlich die Zahlungsgebühr abzieht.
    Dieselbe Buchung wies damit zwei verschiedene Portal-Abzüge aus. Neue
    Läufe rechnen den vollen Anteil direkt (`_portal_abzug_anteil`).

    Angefasst werden nur Buchungen, deren Wert vom erwarteten abweicht — ein
    Lauf auf bereits korrigierten Daten schreibt nichts.
    """
    # Stornos bleiben unangetastet: dort steht `channel_fee` bewusst auf 0,
    # weil die Provision mit der Stornierung entfällt. Sie „nachzuziehen"
    # schriebe eine Gebühr auf eine Buchung, die nie stattgefunden hat.
    zeilen = db.select(
        "reservations", tenant_id=f"eq.{tenant_id}",
        status="neq.cancelled",
        select="id,channel,total_amount,channel_fee",
    )
    aenderungen = [
        {"id": z["id"], "channel_fee": soll}
        for z in zeilen
        if z.get("channel") in PROVISION
        and (soll := round(float(z["total_amount"] or 0)
                           * _portal_abzug_anteil(z["channel"]), 2))
        != round(float(z.get("channel_fee") or 0), 2)
    ]
    for zeile in aenderungen:
        db.patch("reservations", {"channel_fee": zeile["channel_fee"]},
                 id=f"eq.{zeile['id']}")
    print(f"  {len(aenderungen)} Buchungen mit korrigierter Portal-Gebühr")


def dynamische_preise_anlegen(db: Supabase, betrieb: Betrieb,
                              objekt_ids: dict[str, str]) -> None:
    """Regelsatz für Dynamische Preise je Objekt (`dp_settings`).

    Das Modul `dynamische_preise` ist freigeschaltet, aber ohne Regelsatz zeigt
    die Seite je Objekt nur den Einrichtungs-Dialog — kein Preisverlauf, keine
    Empfehlung, nichts zum Fotografieren.

    `autopilot_enabled = False` ist Absicht: der Demo-Bestand darf Preise
    VORSCHLAGEN, aber nichts selbsttätig an die Portale schreiben. Aus
    demselben Grund entsteht im Seed auch kein `ari_outbox`-Eintrag.

    Preisgrenzen leiten sich vom Grundpreis des Objekts ab, nicht aus festen
    Zahlen: ein Mindestpreis von 80 € wäre bei einem 310-€-Chalet unsinnig.
    """
    zeilen = []
    for objekt in betrieb.objekte:
        zeilen.append({
            "property_id": objekt_ids[objekt.schluessel],
            "enabled": True,
            # Unter-/Obergrenze relativ zum Grundpreis: −30 % / +85 %. Die
            # Spanne lässt Saison und Auslastung sichtbar arbeiten, ohne dass
            # ein Vorschlag absurd wird.
            "min_price": round(objekt.grundpreis * 0.7, 2),
            "max_price": round(objekt.grundpreis * 1.85, 2),
            "weekend_uplift_pct": 8.0,
            "last_minute": [
                {"days_before": 14, "discount_pct": 8.0},
                {"days_before": 5, "discount_pct": 15.0},
            ],
            "orphan_gap_discount_pct": 15.0,
            "occupancy_sensitivity": 30.0,
            "occupancy_discount_cap_pct": 20.0,
            "occupancy_premium_cap_pct": 25.0,
            "min_stay_min": 1,
            "min_stay_max": max(objekt.min_aufenthalt, 7),
            "base_mode": "data_driven",
            "base_rate_mode": "recommended",
            "market_enabled": True,
            "market_sensitivity": 20.0,
            "market_max_adjust_pct": 25.0,
            "weather_enabled": True,
            "weather_max_adjust_pct": 10.0,
            "feiertag_uplift_pct": 12.0,
            "ferien_uplift_pct": 8.0,
            # Der Saisonpreis ist UNTERGRENZE, nie Obergrenze (0565).
            "saison_mindestpreis": True,
            # Kein Selbstlauf an die Portale — siehe Docstring.
            "autopilot_enabled": False,
            "freigabe_noetig": True,
            "freigabe_ab_tagen": 3,
        })
    db.upsert("dp_settings", zeilen, konflikt="property_id")
    print(f"  {len(zeilen)} Regelsätze Dynamische Preise")


def regeln_anlegen(db: Supabase, tenant_id: str) -> None:
    """Planmäßige Aufgabenregeln (`task_rules`, kind='auto').

    Ohne sie meldet die Aufgabenseite „X von X Objekten wird von keiner Regel
    erreicht. Dort entsteht nie eine Anreise- oder Reinigungsaufgabe" — der
    Deckungshinweis aus `regel_deckung()`. Bis 07.09.2026 legte der Seed nur
    fertige Aufgaben an, aber keine REGEL, die sie erzeugt: der Betrieb sah aus,
    als hätte ihn nie jemand eingerichtet.

    Bewusst OHNE Objektzuordnung: eine Regel ohne Zuordnung gilt für ALLE
    Objekte — auch für jedes künftige. Mit Zuordnung fiele jedes später
    angelegte Objekt still heraus, und der Hinweis stünde wieder da.

    Je eine Regel auf der Anreise- und der Abreise-Achse, denn `regel_deckung`
    prüft beide getrennt: eine Reinigung nach Abreise deckt die Anreise nicht.
    """
    zeilen = [
        {
            "id": demo_id(f"regel:{tenant_id}:anreise"),
            "tenant_id": tenant_id,
            "name": "Anreise vorbereiten",
            "description": "Schlüssel, Willkommensmappe, Heizung, Endkontrolle",
            "kind": "auto",
            "active": True,
            "recurrence": {},
            "start_trigger": "arrival_day",
            "start_clock": "09:00",
            "end_trigger": "arrival_day",
            "end_clock": "14:00",
            "duration_minutes": 45,
            "priority": 1,
            "needs_inspection": False,
            # Wird die Buchung storniert, verschwindet die Aufgabe mit ihr
            # (Gegenzustand, Wurzel 1) — sonst putzt jemand ein leeres Haus.
            "remove_on_cancellation": True,
            "quellsprache": "de",
        },
        {
            "id": demo_id(f"regel:{tenant_id}:abreise"),
            "tenant_id": tenant_id,
            "name": "Endreinigung nach Abreise",
            "description": "Komplette Reinigung, Wäschewechsel, Müll, Bestandsprüfung",
            "kind": "auto",
            "active": True,
            "recurrence": {},
            "start_trigger": "departure_day",
            "start_clock": "11:00",
            "end_trigger": "departure_day",
            "end_clock": "15:00",
            "duration_minutes": 120,
            "priority": 2,
            "needs_inspection": True,
            "remove_on_cancellation": True,
            "quellsprache": "de",
        },
    ]
    db.upsert("task_rules", zeilen)
    print(f"  {len(zeilen)} planmäßige Aufgabenregeln")


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
    parser.add_argument("--nur-personal", action="store_true",
                        help="NUR den Personalbereich aufbauen — Objekte, Buchungen "
                             "und Fotos des Betriebs bleiben unangetastet")
    parser.add_argument("--nur-portalsaetze", action="store_true",
                        help="NUR die Portal-Abzugssätze nachtragen — alles andere "
                             "bleibt unangetastet")
    parser.add_argument("--nur-eigentuemer-zugang", action="store_true",
                        help="NUR den Eigentümer-Login für die App anlegen — "
                             "Objekte, Buchungen und Abrechnungen bleiben stehen")
    argumente = parser.parse_args()

    db = Supabase()
    passwort = argumente.passwort or f"Demo-{secrets.token_urlsafe(9)}"

    for betrieb in BETRIEBE:
        if argumente.betrieb and betrieb.schluessel != argumente.betrieb:
            continue
        print(f"\n{betrieb.name}")
        # `--nur-personal` setzt auf den BESTEHENDEN Bestand auf: es räumt
        # nicht auf und legt keine Objekte neu an. Ein Vollaufbau würde
        # Buchungen und Fotos neu würfeln — die Screenshots der Marketing-Seite
        # zeigten danach andere Zahlen (siehe Modulkopf).
        # Wie `--nur-personal` ein Nachtrag auf den BESTEHENDEN Bestand: die
        # Sätze sind reine Stammdaten, sie ändern keine Buchung. Damit lassen
        # sich fertige Demo-Konten nachrüsten, ohne die Zahlen der schon
        # gemachten Screenshots zu verwerfen.
        # Wie die anderen Nachtrags-Schalter: setzt auf den BESTEHENDEN
        # Bestand auf. Der Login ist eine Ergänzung, kein Neuaufbau — die
        # Zahlen der schon gemachten Screenshots bleiben gültig.
        if argumente.nur_eigentuemer_zugang:
            tenant_id = demo_id(f"tenant:{betrieb.schluessel}")
            if not db.select("tenants", id=f"eq.{tenant_id}", select="id"):
                print("  übersprungen: Betrieb noch nicht aufgebaut")
                continue
            portalzugang_anlegen(db, betrieb, tenant_id, passwort)
            continue

        if argumente.nur_portalsaetze:
            tenant_id = demo_id(f"tenant:{betrieb.schluessel}")
            if not db.select("tenants", id=f"eq.{tenant_id}", select="id"):
                print("  übersprungen: Betrieb noch nicht aufgebaut")
                continue
            portal_saetze_anlegen(db, tenant_id)
            channel_fee_nachziehen(db, tenant_id)
            continue

        if argumente.nur_personal:
            tenant_id = demo_id(f"tenant:{betrieb.schluessel}")
            vorhandene = db.select("properties", tenant_id=f"eq.{tenant_id}", select="id")
            if not vorhandene:
                print("  übersprungen: Betrieb noch nicht aufgebaut")
                continue
            admin = db.select("users", tenant_id=f"eq.{tenant_id}",
                              role="eq.admin", select="id")
            personal_anlegen(db, tenant_id, admin[0]["id"],
                             [z["id"] for z in vorhandene], passwort)
            continue

        aufraeumen(db, betrieb)
        if argumente.nur_loeschen:
            continue

        tenant_id = betrieb_anlegen(db, betrieb, passwort)
        firma_anlegen(db, betrieb, tenant_id)
        abo_anlegen(db, betrieb, tenant_id)
        module_freischalten(db, tenant_id)
        objekt_ids = objekte_anlegen(db, betrieb, tenant_id)
        print(f"  {len(objekt_ids)} Objekte")
        fotos_hochladen(db, betrieb, tenant_id, objekt_ids)
        gaeste = gaeste_anlegen(db, tenant_id, betrieb.schluessel)
        buchungen = buchungen_anlegen(db, betrieb, tenant_id, objekt_ids, gaeste)
        stornos_anlegen(db, betrieb, tenant_id, objekt_ids, gaeste)
        sperrungen_anlegen(db, betrieb, tenant_id, objekt_ids)
        portale_verbinden(db, betrieb, tenant_id, objekt_ids)
        # Portal-Sätze VOR den Eigentümern: ohne sie ist der Portal-Abzug
        # unbestimmbar, und die Abrechnungen darunter blieben auf „—".
        portal_saetze_anlegen(db, tenant_id)
        # Eigentümer vor den Aufgaben: die Abrechnungen summieren die
        # Buchungen, die oben schon stehen.
        eigentuemer_anlegen(db, betrieb, tenant_id, objekt_ids)
        # Der Eigentuemer-Login fuer die App (mobile-nextdays, OwnerTabs).
        portalzugang_anlegen(db, betrieb, tenant_id, passwort)
        dynamische_preise_anlegen(db, betrieb, objekt_ids)
        regeln_anlegen(db, tenant_id)
        aufgaben_anlegen(db, tenant_id, buchungen)
        # Posteingang: ein Thread je PORTAL-Buchung samt Verlauf. Ohne ihn
        # zeigt die App Buchungen, aber ein leeres Postfach.
        threads = threads_anlegen(db, tenant_id, buchungen)
        print(f"  {threads} Posteingang-Threads")
        # Personal zuletzt: der Dienstplan hängt an den Objekten und der
        # Admin-Zeile, die weiter oben entstehen.
        admin_id = db.select("users", tenant_id=f"eq.{tenant_id}",
                             role="eq.admin", select="id")[0]["id"]
        personal_anlegen(db, tenant_id, admin_id, list(objekt_ids.values()), passwort)

    if not argumente.nur_loeschen:
        print("\nLogins:")
        for betrieb in BETRIEBE:
            if argumente.betrieb and betrieb.schluessel != argumente.betrieb:
                continue
            print(f"  {betrieb.login}   {passwort}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
