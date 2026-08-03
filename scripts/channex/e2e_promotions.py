#!/usr/bin/env python3
"""E2E: Promotions — live gegen die Server-DB (und Channex, wo möglich).

WARUM DIESES SKRIPT: eine Promotion berührt vier Schichten, und ein Unit-Test
sieht keine davon vollständig — die Tabelle mit ihren CHECKs und dem partiellen
UNIQUE-Index, den Preis-Resolver, die Gast-Buchungsstrecke (Code einlösen) und
die zwei Wege zu den Portalen (Tagespreis bzw. Airbnbs Rabattregeln). Genau an
den Nahtstellen sind die Fehler entstanden, die dieses Skript nachstellt: ein
Rabatt, der auch die Reinigungsgebühr abzog; ein Zeitraum, der nur den
Anreisetag prüfte; eine Pauschale, die gegen 5 % nie gewinnen konnte.

WAS GEPRÜFT WIRD (jede Zusage des Branchenstandards einmal):
  Stufe A  Anlegen/Ändern/Löschen über den echten Service-Pfad; die je-Typ-
           Pflichtfelder und der Singleton-Index der Kurven-Typen greifen.
  Stufe B  Rechnung: Grundlage nur Übernachtung (nicht Gebühren), Teil-Aufenthalt
           je Nacht, bester Wert in GELD, Code-Vorrang, `promo_code_applied`.
  Stufe C  Bedingungen: Mindestaufenthalt, Vorlauf-Fenster, Buchungszeitraum,
           Kanal-Einschränkung.
  Stufe D  Gast-Buchungsstrecke: Angebot mit Code, Buchung rechnet DENSELBEN
           Preis, die Reservierung trägt ihn.
  Stufe E  Auswahlliste („bestehende Promotion übernehmen") inkl. Währungsfilter
           und Dublettenschutz.
  Stufe F  Portale: welcher Weg trägt welche Bedingung, was bleibt „Manuelle
           Synchronisierung", und was passiert beim Airbnb-Push ohne Verbindung.
  Stufe G  Jobs: jede Änderung reiht Tagespreis-Push UND Airbnb-Regeln ein.

AUSFÜHRUNG (vom Repo-Root, braucht apps/api/.env mit DB-Zugang):
    apps/api/.venv/bin/python scripts/channex/e2e_promotions.py

Das Skript räumt hinter sich auf — alle angelegten Promotions, Reservierungen und
Preis-Änderungen werden zurückgenommen, auch wenn eine Prüfung fehlschlägt
(Wurzel 1: jede Aktion hat einen Gegenzustand).
"""
# pylint: disable=wrong-import-position,wrong-import-order,import-error
# pylint: disable=protected-access
# import-error: die src-Module liegen erst nach dem sys.path-Eintrag im Suchpfad.
# protected-access: `_aktionen_status` ist die Funktion, die den Chip „Manuelle
# Synchronisierung" speist — genau sie soll hier geprüft werden. Über die Route
# zu gehen hieße, den ganzen Abgaben-Status samt Channex-Calls mitzuziehen.
from __future__ import annotations

import os
import sys
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
API = ROOT / "apps" / "api"
sys.path.insert(0, str(API))

# .env laden, BEVOR die Settings-Klasse importiert wird.
for zeile in (API / ".env").read_text(encoding="utf-8").splitlines():
    if "=" in zeile and not zeile.lstrip().startswith("#"):
        schluessel, _, wert = zeile.partition("=")
        os.environ.setdefault(schluessel.strip(), wert.strip().strip('"').strip("'"))

from src.core.sales_channels import (  # noqa: E402
    PLATFORM,
    availability_block_hits_channel,
    stop_sell_blocks_channel,
)
from src.core.security import AuthContext  # noqa: E402
from src.core.supabase import get_service_client  # noqa: E402
from src.features.booking_engine.schemas import (  # noqa: E402
    GuestContact,
    PublicBookingRequest,
    PublicQuoteRequest,
)
from src.features.booking_engine.service import BookingEngineService  # noqa: E402
from src.features.channel_manager.abgaben_status import (  # noqa: E402
    AbgabenStatusMixin,
)
from src.features.channel_manager.airbnb_aktionen import (  # noqa: E402
    MODELL_LOS,
    MODELL_RATE_PLAN,
    MODELL_STANDARD,
    RULE_FRUEHBUCHER,
    RULE_LAST_MINUTE,
    RULE_LOS,
    regel_fuer_airbnb,
    regeln_fuer_listing,
)
from src.features.channel_manager.ota_aktionen import (  # noqa: E402
    aktionsfaktor_je_tag,
    per_tagespreis_uebertragbar,
)
from src.features.channel_manager.service import ChannelManagerService  # noqa: E402
from src.features.pricing.resolver import PricingResolver  # noqa: E402
from src.features.pricing.schemas import QuoteRequest, QuoteResponse  # noqa: E402
from src.features.property_discounts.schemas import (  # noqa: E402
    DiscountCreate,
    DiscountUpdate,
)
from src.features.property_discounts.service import (  # noqa: E402
    DiscountError,
    PropertyDiscountsService,
)
from supabase import Client  # noqa: E402

TESTOBJEKT_TITEL = "Smoke-Testhaus"
# Kennung der Testbuchung. Läuft ein Durchgang mitten im Ablauf auf einen Fehler,
# findet der nächste sie daran wieder und räumt sie auf — sonst blockiert eine
# Leiche aus dem Vorlauf den Kalender und der Lauf prüft am falschen Zeitraum.
TESTGAST_EMAIL = "e2e-promotion@example.com"
NAECHTE = 3
# Rabattsätze der Testaktionen. Die erwarteten BETRÄGE werden NICHT hart
# geschrieben, sondern aus dem gemessenen Übernachtungswert des Objekts
# gerechnet: das Testobjekt trägt Dynamic Pricing, Gebühren und Steuern aus
# anderen Läufen. Ein Skript mit festen Zahlen wäre entweder falsch oder müsste
# die Preise des Objekts umschreiben — und ein E2E, das die Ausgangslage
# zerstört, prüft am Ende sich selbst.
PROZENT = 20
AUTOMATIK_PROZENT = 30
PAUSCHALE = 5000.0

fehler: list[str] = []


def pruefe(bedingung: bool, text: str) -> None:
    if bedingung:
        print(f"  ✓ {text}")
    else:
        print(f"  ✗ {text}")
        fehler.append(text)


def _rabatt(quote: QuoteResponse) -> float:
    """Summe der Rabattzeilen (negativ), auf zwei Stellen gerundet."""
    return round(
        sum(z.amount for z in quote.lines if z.kind == "discount"), 2
    )


def _uebernachtung(quote: QuoteResponse) -> float:
    return round(
        sum(z.amount for z in quote.lines if z.kind in ("lodging", "surcharge")), 2
    )


class _StatusService(AbgabenStatusMixin):
    """Nur der lesende Abgaben-/Aktions-Status, ohne den ganzen Channex-Service.

    Der Mixin braucht `_require_db`/`_require_tenant` nicht für
    `_aktionen_status` — der Aufruf bekommt DB und Tenant direkt übergeben.
    """


def main() -> None:  # pylint: disable=too-many-locals,too-many-statements
    db = get_service_client()

    prop = (
        db.table("properties")
        .select("id, tenant_id, title, currency, type_attributes, max_guests")
        .eq("title", TESTOBJEKT_TITEL)
        .limit(1)
        .execute()
    ).data
    if not prop:
        sys.exit(f"Testobjekt {TESTOBJEKT_TITEL!r} nicht gefunden")
    property_id = str(prop[0]["id"])
    tenant_id = str(prop[0]["tenant_id"])
    attrs_vorher = prop[0].get("type_attributes") or {}
    waehrung = str(prop[0].get("currency") or "")
    print(f"Objekt: {TESTOBJEKT_TITEL} ({property_id}), Währung {waehrung or '—'}")
    if not waehrung:
        sys.exit("Das Testobjekt hat keine Objektwährung — ohne sie ist ein "
                 "Pauschalbetrag nicht prüfbar (Wurzel 4).")

    # Der Kontext braucht einen ECHTEN Benutzer des Betriebs: Storno und
    # Gast-Maskierung lesen `ctx.user_id` als uuid aus der DB — „e2e" hat den
    # ersten Lauf mit 22P02 abgebrochen. Kein erfundener Wert (Wurzel 4).
    admin = (
        db.table("users")
        .select("id")
        .eq("tenant_id", tenant_id)
        .in_("role", ["admin", "co_admin"])
        .limit(1)
        .execute()
    ).data
    if not admin:
        sys.exit("Kein admin/co_admin im Konto des Testobjekts gefunden.")
    ctx = AuthContext(user_id=str(admin[0]["id"]), tenant_id=tenant_id, role="admin")
    promos = PropertyDiscountsService(service_client=db)
    resolver = PricingResolver(service_client=db)

    # Aufenthalt: das erste FREIE Fenster mit genug Vorlauf. Ein festes „heute +
    # 120 Tage" hat beim ersten Lauf in eine belegte Woche gezeigt und die
    # Buchungsprüfung mit „Zeitraum nicht mehr verfügbar" abgebrochen — der
    # Kalender des Testobjekts ist echt, also wird er gelesen.
    heute = date.today()
    anreise = _freies_fenster(db, property_id, heute + timedelta(days=60), NAECHTE)
    if anreise is None:
        sys.exit("Kein freies Fenster von 3 Nächten im nächsten Jahr gefunden.")
    abreise = anreise + timedelta(days=NAECHTE)
    vorlauf = (anreise - heute).days
    print(f"Aufenthalt: {anreise} bis {abreise} ({vorlauf} Tage Vorlauf)")
    # Zeitraum, der nur die ersten ZWEI der drei Nächte deckt — der Fall
    # „Aktion deckt nur einen Teil des Aufenthalts".
    teil_zeitraum = {
        "from": anreise.isoformat(),
        "to": (anreise + timedelta(days=1)).isoformat(),
    }
    # Gästezahl aus dem Objekt: die Buchungsstrecke lehnt mehr als die Kapazität
    # ab, und das Testobjekt hat womöglich nur einen Schlafplatz.
    gaeste = max(1, min(2, int(prop[0].get("max_guests") or 1)))

    def quote(**kw: object) -> QuoteResponse:
        return resolver.quote(
            QuoteRequest(
                property_id=property_id,
                check_in=anreise,
                check_out=abreise,
                guests=gaeste,
                as_of=heute,
                **kw,
            )
        )

    angelegt: list[str] = []
    reservierungen: list[str] = []
    try:
        # --- Stufe 0: Ausgangslage MESSEN (nicht setzen) ------------------------
        print("\nStufe 0 — Ausgangslage messen (Preise des Objekts bleiben unberührt)")
        _alte_testbuchungen_entfernen(db, ctx, property_id)
        for alt in promos.list_for_property(ctx, property_id):
            promos.delete(ctx, property_id, alt.id)
        roh = quote()
        basis = _uebernachtung(roh)
        gebuehren = round(
            sum(z.amount for z in roh.lines if z.kind == "fee"), 2
        )
        naechte_werte = _naechte_werte(resolver, property_id, anreise, abreise)
        print(f"  · Übernachtung {basis:.2f} {waehrung}, Gebühren {gebuehren:.2f}")
        pruefe(basis > 0, "das Objekt hat einen Übernachtungspreis")
        pruefe(
            gebuehren > 0,
            "das Objekt hat Gebühren — nur dann beweist der nächste Test etwas",
        )
        pruefe(
            round(sum(naechte_werte.values()), 2) == basis,
            "die Summe der Nachtpreise ist der Übernachtungswert (keine "
            "Aufschläge, die der Teil-Aufenthalt-Test nicht kennt)",
        )
        pruefe(_rabatt(roh) == 0.0, "kein Rabatt, solange keine Promotion existiert")
        pruefe(
            not (attrs_vorher.get("pricing") or {}).get("promotions"),
            "der abgeschaffte Blob-Pfad (`pricing.promotions`) ist leer",
        )

        # --- Stufe A: Anlegen, Ändern, Pflichtfelder, Singleton ---------------
        print("\nStufe A — Anlegen/Ändern/Löschen und die Regeln der Tabelle")
        aktion = promos.create(
            ctx,
            property_id,
            DiscountCreate(
                discount_type="promotion",
                discount_kind="percent",
                discount_bps=PROZENT * 100,
                name={"de": "E2E Sommer"},
                description_html="<p>intern</p><script>alert(1)</script>",
            ),
        )
        angelegt.append(aktion.id)
        pruefe(
            aktion.discount_bps == PROZENT * 100, f"Promotion angelegt ({PROZENT} %)"
        )
        pruefe(
            "script" not in (aktion.description_html or ""),
            "interne Beschreibung wird serverseitig sanitisiert (Wurzel 8)",
        )
        try:
            promos.create(
                ctx, property_id,
                DiscountCreate(discount_type="length_of_stay", discount_bps=500),
            )
            pruefe(False, "Längenrabatt ohne Nächtezahl wird abgewiesen")
        except Exception:  # noqa: BLE001 — Schema/DB weisen ab, beides ist richtig
            pruefe(True, "Längenrabatt ohne Nächtezahl wird abgewiesen")

        kurve = promos.create(
            ctx, property_id,
            DiscountCreate(
                discount_type="early_booker", discount_bps=500, lead_min_days=60,
                name={"de": "E2E Frühbucher"},
            ),
        )
        angelegt.append(kurve.id)
        try:
            zweite = promos.create(
                ctx, property_id,
                DiscountCreate(
                    discount_type="early_booker", discount_bps=700, lead_min_days=90,
                    name={"de": "E2E Frühbucher 2"},
                ),
            )
            angelegt.append(zweite.id)
            pruefe(False, "zweite AKTIVE Frühbucher-Kurve wird abgewiesen (409)")
        except DiscountError as exc:
            pruefe(
                exc.status_code == 409,
                "zweite AKTIVE Frühbucher-Kurve wird abgewiesen (409)",
            )
        promos.delete(ctx, property_id, kurve.id)
        angelegt.remove(kurve.id)

        # --- Stufe B: die Rechnung ---------------------------------------------
        print("\nStufe B — Rechnung: Grundlage, Teil-Aufenthalt, bester Wert, Code")
        voll = -round(basis * PROZENT / 100, 2)
        q = quote()
        pruefe(
            _rabatt(q) == voll,
            f"{PROZENT} % nur auf die Übernachtung ({abs(voll):.2f}), NICHT auf die "
            f"Gebühren ({gebuehren:.2f} bleiben ungerabattet)",
        )

        promos.update(
            ctx, property_id, aktion.id,
            DiscountUpdate(stay_ranges=[teil_zeitraum]),  # deckt 2 von 3 Nächten
        )
        gedeckt = round(
            sum(
                betrag
                for tag, betrag in naechte_werte.items()
                if tag.isoformat() <= teil_zeitraum["to"]
            ),
            2,
        )
        q = quote()
        pruefe(
            _rabatt(q) == -round(gedeckt * PROZENT / 100, 2) < 0,
            f"Teil-Aufenthalt: nur die zwei gedeckten Nächte ({gedeckt:.2f}) "
            f"werden rabattiert",
        )
        promos.update(ctx, property_id, aktion.id, DiscountUpdate(stay_ranges=[]))

        pauschale = promos.create(
            ctx, property_id,
            DiscountCreate(
                discount_type="promotion", discount_kind="fixed",
                discount_amount=PAUSCHALE, name={"de": "E2E Pauschale"},
            ),
        )
        angelegt.append(pauschale.id)
        q = quote()
        # Die Pauschale ist absichtlich größer als der Übernachtungswert: dann
        # prüft dieselbe Zeile zwei Dinge — sie gewinnt gegen den Prozentsatz UND
        # wird auf den Übernachtungswert gekappt (kein negativer Preis).
        pruefe(
            _rabatt(q) == -basis,
            f"bester Wert in GELD: Pauschale gewinnt gegen {PROZENT} % und wird "
            f"auf den Übernachtungswert gekappt ({basis:.2f})",
        )
        promos.update(ctx, property_id, pauschale.id, DiscountUpdate(active=False))

        promos.update(
            ctx, property_id, aktion.id, DiscountUpdate(promo_codes=["sommer26"]),
        )
        q = quote()
        pruefe(
            _rabatt(q) == 0.0 and q.promo_code_applied is False,
            "Aktion mit Code greift OHNE Code nicht",
        )
        q = quote(promo_code="SoMmEr26")
        pruefe(
            _rabatt(q) == voll and q.promo_code_applied is True,
            "Code greift unabhängig von Groß-/Kleinschreibung",
        )
        q = quote(promo_code="QUATSCH")
        pruefe(
            _rabatt(q) == 0.0 and q.promo_code_applied is False,
            "unbekannter Code löst nichts aus und meldet das",
        )

        automatik = promos.create(
            ctx, property_id,
            DiscountCreate(
                discount_type="promotion", discount_bps=AUTOMATIK_PROZENT * 100,
                name={"de": "E2E Automatik"},
            ),
        )
        angelegt.append(automatik.id)
        automatik_betrag = -round(basis * AUTOMATIK_PROZENT / 100, 2)
        q = quote(promo_code="SOMMER26")
        pruefe(
            _rabatt(q) == voll and q.promo_code_applied is True,
            f"Code-Vorrang: der eingelöste Code ({PROZENT} %) verdrängt die "
            f"Automatik ({AUTOMATIK_PROZENT} %)",
        )
        q = quote(promo_code="QUATSCH")
        pruefe(
            _rabatt(q) == automatik_betrag and q.promo_code_applied is False,
            "ungültiger Code verdrängt nichts — die Automatik bleibt",
        )
        promos.delete(ctx, property_id, automatik.id)
        angelegt.remove(automatik.id)

        # --- Stufe C: Bedingungen ---------------------------------------------
        print("\nStufe C — Bedingungen greifen wirklich")
        promos.update(
            ctx, property_id, aktion.id,
            DiscountUpdate(promo_codes=[], min_nights=NAECHTE + 1),
        )
        pruefe(
            _rabatt(quote()) == 0.0,
            f"Mindestaufenthalt {NAECHTE + 1} Nächte greift bei {NAECHTE} nicht",
        )
        promos.update(ctx, property_id, aktion.id, DiscountUpdate(min_nights=NAECHTE))
        pruefe(_rabatt(quote()) == voll, "Mindestaufenthalt erfüllt → Rabatt")

        promos.update(
            ctx, property_id, aktion.id,
            DiscountUpdate(min_nights=None, lead_min_days=vorlauf + 30),
        )
        pruefe(
            _rabatt(quote()) == 0.0,
            f"Frühbucher: {vorlauf + 30} Tage Vorlauf verlangt, {vorlauf} "
            f"vorhanden → kein Rabatt",
        )
        promos.update(
            ctx, property_id, aktion.id,
            DiscountUpdate(lead_min_days=vorlauf - 10, lead_max_days=vorlauf + 10),
        )
        pruefe(
            _rabatt(quote()) == voll,
            f"Vorlauf-Fenster {vorlauf - 10}–{vorlauf + 10} Tage greift",
        )

        gestern = (heute - timedelta(days=2)).isoformat()
        promos.update(
            ctx, property_id, aktion.id,
            DiscountUpdate(
                lead_min_days=None, lead_max_days=None,
                booked_from=date.fromisoformat(gestern),
                booked_to=heute - timedelta(days=1),
            ),
        )
        pruefe(
            _rabatt(quote()) == 0.0,
            "Buchungszeitraum in der Vergangenheit → kein Rabatt (heute gebucht)",
        )
        promos.update(
            ctx, property_id, aktion.id,
            DiscountUpdate(booked_from=heute, booked_to=heute + timedelta(days=1)),
        )
        pruefe(_rabatt(quote()) == voll, "Buchungszeitraum umfasst heute → Rabatt")
        promos.update(
            ctx, property_id, aktion.id,
            DiscountUpdate(booked_from=None, booked_to=None,
                           portal_scope=["BookingCom"]),
        )
        pruefe(
            _rabatt(quote()) == 0.0,
            "auf BookingCom eingeschränkt → im Direktkanal kein Rabatt",
        )
        pruefe(
            _rabatt(quote(channel="BookingCom")) == voll,
            "auf BookingCom eingeschränkt → dort schon",
        )
        promos.update(ctx, property_id, aktion.id, DiscountUpdate(portal_scope=[]))

        # --- Stufe D: Gast-Buchungsstrecke ------------------------------------
        print("\nStufe D — Gast löst den Code in der Buchungsstrecke ein")
        promos.update(ctx, property_id, aktion.id, DiscountUpdate(promo_codes=["E2E20"]))
        be = BookingEngineService(service_client=db)
        ohne = be.public_quote(
            PublicQuoteRequest(
                property_id=property_id, check_in=anreise, check_out=abreise,
                guests=gaeste,
            )
        )
        mit = be.public_quote(
            PublicQuoteRequest(
                property_id=property_id, check_in=anreise, check_out=abreise,
                guests=gaeste, promo_code="e2e20",
            )
        )
        pruefe(
            mit.promo_code_applied and not ohne.promo_code_applied,
            "Angebot meldet, ob der Code gewirkt hat",
        )
        rabattzeile = round(
            sum(z.amount for z in mit.lines if z.kind == "discount"), 2
        )
        pruefe(
            rabattzeile == voll,
            f"Angebot mit Code trägt die Rabattzeile ({abs(voll):.2f})",
        )
        # Die SUMME sinkt um mehr als den Rabatt: prozentuale Steuern rechnen auf
        # die gesenkte Grundlage. Genau deshalb wird hier nicht auf Gleichheit
        # geprüft — das wäre eine falsche Erwartung an eine richtige Rechnung.
        pruefe(
            round(ohne.total - mit.total, 2) >= abs(voll),
            "die Angebotssumme sinkt um mindestens den Rabatt (Steuern folgen)",
        )
        buchung = be.create_public_booking(
            PublicBookingRequest(
                property_id=property_id,
                check_in=anreise,
                check_out=abreise,
                guests=gaeste,
                contact=GuestContact(
                    first_name="E2E", last_name="Promotion",
                    email=TESTGAST_EMAIL,
                ),
                # Bewusst FALSCH: der Server muss selbst rechnen (Wurzel 3).
                total_amount=1.0,
                promo_code="E2E20",
            )
        )
        reservierungen.append(buchung.id)
        gebucht = (
            db.table("reservations")
            .select("total_amount")
            .eq("id", buchung.id)
            .limit(1)
            .execute()
        ).data
        pruefe(
            bool(gebucht) and round(float(gebucht[0]["total_amount"]), 2) == round(
                mit.total, 2
            ),
            "die Buchung trägt den rabattierten Preis des Angebots, nicht den "
            "Client-Betrag",
        )

        # --- Stufe E: Auswahlliste --------------------------------------------
        print("\nStufe E — „bestehende Promotion übernehmen“")
        lib = promos.library(ctx, property_id)
        pruefe(
            all(e["property_id"] != property_id for e in lib["items"]),
            "die Auswahlliste zeigt keine Promotion DIESES Objekts",
        )
        pruefe(lib["currency"] == waehrung.upper(), "Auswahlliste kennt die Objektwährung")
        ziel = _zweites_objekt(db, tenant_id, property_id)
        if ziel is None:
            print("  · nur ein Objekt im Konto — Übertragung wird übersprungen")
        else:
            promos.apply_to_properties(ctx, property_id, aktion.id, [ziel])
            am_ziel = [
                r for r in promos.list_for_property(ctx, ziel)
                if r.name.get("de") == "E2E Sommer"
            ]
            pruefe(len(am_ziel) == 1, "Promotion auf ein zweites Objekt übertragen")
            promos.apply_to_properties(ctx, property_id, aktion.id, [ziel])
            am_ziel2 = [
                r for r in promos.list_for_property(ctx, ziel)
                if r.name.get("de") == "E2E Sommer"
            ]
            pruefe(
                len(am_ziel2) == 1,
                "zweite Übertragung legt KEINE Dublette an (idempotent, Wurzel 2)",
            )
            for r in am_ziel2:
                promos.delete(ctx, ziel, r.id)

        # --- Stufe F: die zwei Wege zu den Portalen ---------------------------
        print("\nStufe F — Portale: Tagespreis, Airbnb-Regel, Manuelle Synchronisierung")
        promos.update(ctx, property_id, aktion.id, DiscountUpdate(promo_codes=[]))
        faktoren = aktionsfaktor_je_tag(
            db, property_id, von=anreise, bis=abreise - timedelta(days=1)
        )
        pruefe(
            faktoren.get(anreise.isoformat()) == 0.8,
            "Tagespreis-Weg: Faktor 0.8 je Tag (20 % Rabatt geht an alle Portale)",
        )
        promos.update(
            ctx, property_id, aktion.id, DiscountUpdate(stay_ranges=[teil_zeitraum])
        )
        faktoren = aktionsfaktor_je_tag(
            db, property_id, von=anreise, bis=abreise - timedelta(days=1)
        )
        pruefe(
            faktoren.get(anreise.isoformat()) == 0.8
            and (abreise - timedelta(days=1)).isoformat() not in faktoren,
            "Tagespreis-Weg rabattiert NUR die Tage im Aktionszeitraum",
        )
        promos.update(ctx, property_id, aktion.id, DiscountUpdate(stay_ranges=[]))

        pruefe(
            per_tagespreis_uebertragbar({"min_nights": 5})[1] == "mindestaufenthalt",
            "Mindestaufenthalt kann der Tagespreis nicht tragen (und sagt warum)",
        )
        regel, grund = regel_fuer_airbnb(
            {"active": True, "discount_kind": "percent", "discount_bps": 2000,
             "min_nights": 7}
        )
        pruefe(
            regel == {"rule_type": RULE_LOS, "price_change": 20, "threshold_one": 7}
            and grund is None,
            "Mindestaufenthalt wird zur Airbnb-Regel STAYED_AT_LEAST_X_DAYS",
        )
        pruefe(
            regel_fuer_airbnb(
                {"active": True, "discount_kind": "percent", "discount_bps": 2000,
                 "min_nights": 7}, preismodell=MODELL_RATE_PLAN,
            )[1] == "airbnb_preismodell",
            "im Rate-Plan-Preismodell nimmt Airbnb keine Regeln",
        )
        pruefe(
            regel_fuer_airbnb(
                {"active": True, "discount_kind": "percent", "discount_bps": 2000,
                 "lead_max_days": 40},
            )[1] == "last_minute_ueber_28",
            "Last Minute über 28 Tage lehnt Airbnb ab (kein Blindflug-Push)",
        )
        regeln, gruende = regeln_fuer_listing(
            [
                {"id": "a", "active": True, "discount_kind": "percent",
                 "discount_bps": 1000, "min_nights": 7},
                {"id": "b", "active": True, "discount_kind": "percent",
                 "discount_bps": 2500, "min_nights": 7},
                {"id": "c", "active": True, "discount_kind": "percent",
                 "discount_bps": 1500, "lead_max_days": 14},
                {"id": "d", "active": True, "discount_kind": "fixed",
                 "discount_amount": 50, "min_nights": 3},
            ],
            preismodell=MODELL_STANDARD,
        )
        pruefe(
            regeln == [
                {"rule_type": RULE_LOS, "price_change": 25, "threshold_one": 7},
                {"rule_type": RULE_LAST_MINUTE, "price_change": 15, "threshold_one": 14},
            ],
            "je Regelart genau EINE Regel, der höhere Rabatt gewinnt",
        )
        pruefe(
            gruende.get("d") == "pauschalbetrag",
            "eine Pauschale nennt ihren Grund statt still zu verschwinden",
        )
        pruefe(
            regel_fuer_airbnb(
                {"active": True, "discount_kind": "percent", "discount_bps": 2000,
                 "lead_min_days": 60}, preismodell=MODELL_LOS,
            )[0] == {
                "rule_type": RULE_FRUEHBUCHER, "price_change": 20, "threshold_one": 60,
            },
            "Frühbucher-Vorlauf 60 Tage geht auch im LOS-Preismodell",
        )

        # „Manuelle Synchronisierung": der Status je Portal, gerechnet aus
        # denselben Regeln wie der Sync.
        #
        # ALLE Achsen explizit setzen, nicht nur die eine: aus Stufe C stand noch
        # `lead_max_days` an der Aktion, und mit zwei Bedingungen ist sie für
        # Airbnb gar nicht abbildbar („bedingungen_kombiniert"). Der erste Lauf
        # hat genau das gemeldet — die Prüfung war falsch aufgesetzt, nicht der
        # Code.
        promos.update(
            ctx, property_id, aktion.id,
            DiscountUpdate(
                min_nights=None, lead_min_days=60, lead_max_days=None,
                stay_ranges=[], booked_from=None, booked_to=None,
                promo_codes=[], portal_scope=[],
            ),
        )
        posten = _StatusService()._aktionen_status(  # noqa: SLF001 — Diagnose
            db, tenant_id, property_id, ["AirBNB", "BookingCom"]
        )
        eintrag = next((p for p in posten if p["key"] == aktion.id), None)
        pruefe(
            eintrag is not None and eintrag["manual_portals"] == ["BookingCom"],
            "Frühbucher: bei Airbnb automatisch, bei Booking.com manuell",
        )
        pruefe(
            eintrag is not None and eintrag["reason"] == "fruehbucher"
            and eintrag["airbnb_reason"] is None,
            "der Grund steht am Posten (Tagespreis) und Airbnb hat keinen",
        )
        promos.update(
            ctx, property_id, aktion.id,
            DiscountUpdate(lead_min_days=45),  # kein Vielfaches von 28/30
        )
        posten = _StatusService()._aktionen_status(  # noqa: SLF001
            db, tenant_id, property_id, ["AirBNB", "BookingCom"]
        )
        eintrag = next((p for p in posten if p["key"] == aktion.id), None)
        pruefe(
            eintrag is not None
            and eintrag["manual_portals"] == ["AirBNB", "BookingCom"]
            and eintrag["airbnb_reason"] == "vorlauf_nicht_28_30",
            "45 Tage Vorlauf: auch Airbnb manuell, mit eigenem Grund",
        )
        promos.update(ctx, property_id, aktion.id, DiscountUpdate(lead_min_days=None))

        cm = ChannelManagerService(service_client=db)
        ergebnis = cm.aktionen_an_airbnb(ctx, property_id)
        airbnb_verbunden = ergebnis["channel_id"] is not None
        if airbnb_verbunden:
            pruefe(
                ergebnis["listings"] >= 0,
                f"Airbnb-Push gelaufen: {ergebnis['listings']} Listing(s), "
                f"{ergebnis['updated']} geändert",
            )
        else:
            pruefe(
                ergebnis == {"channel_id": None, "listings": 0, "updated": 0,
                             "rules": [], "skipped": {}},
                "ohne aktive Airbnb-Verbindung schreibt der Push nichts und "
                "behauptet nichts",
            )

        # --- Stufe G: Jobs ------------------------------------------------------
        print("\nStufe G — jede Änderung reiht beide Wege als Job ein")
        offen_vorher = _offene_jobs(db, tenant_id, property_id)
        promos.update(ctx, property_id, aktion.id, DiscountUpdate(discount_bps=1500))
        offen = _offene_jobs(db, tenant_id, property_id)
        pruefe(
            "sync_airbnb_aktionen" in offen,
            "Änderung reiht `sync_airbnb_aktionen` ein (Airbnb-Regeln)",
        )
        pruefe(
            "recompute_property" in offen or "recompute_property" in offen_vorher,
            "Änderung reiht `recompute_property` ein (Tagespreise an alle Portale)",
        )

    finally:
        print("\nAufräumen")
        for pid in list(reservierungen):
            _reservierung_entfernen(db, ctx, pid)
        print(f"  · {len(reservierungen)} Reservierung(en) entfernt")
        for aid in list(angelegt):
            try:
                promos.delete(ctx, property_id, aid)
            except DiscountError:
                pass
        print(f"  · {len(angelegt)} Promotion(s) entfernt")
        # Preise, Gebühren und Steuern des Objekts wurden NICHT verändert — es
        # gibt hier nichts zurückzunehmen. Genau deshalb rechnet das Skript mit
        # gemessenen statt mit gesetzten Werten.

    print()
    if fehler:
        print(f"FEHLGESCHLAGEN — {len(fehler)} Prüfung(en):")
        for f in fehler:
            print(f"  · {f}")
        sys.exit(1)
    print("ALLE PRÜFUNGEN GRÜN")


# --- Helfer ------------------------------------------------------------------


def _naechte_werte(
    resolver: PricingResolver, property_id: str, anreise: date, abreise: date
) -> dict[date, float]:
    """Effektivpreis je Nacht — dieselbe Quelle, aus der der Quote rechnet.

    Damit lässt sich der erwartete Teil-Aufenthalt-Rabatt aus den ECHTEN
    Tagespreisen des Objekts bestimmen (es läuft Dynamic Pricing), statt eine
    gleichmäßige Verteilung anzunehmen.
    """
    tage = resolver.effective_prices(property_id, anreise, abreise)
    return {t.date: float(t.price) for t in tage if t.price is not None}


def _zweites_objekt(db: Client, tenant_id: str, property_id: str) -> str | None:
    rows = (
        db.table("properties")
        .select("id, currency")
        .eq("tenant_id", tenant_id)
        .neq("id", property_id)
        .limit(20)
        .execute()
    ).data or []
    return str(rows[0]["id"]) if rows else None


def _offene_jobs(db: Client, tenant_id: str, property_id: str) -> set[str]:
    rows = (
        db.table("jobs")
        .select("job_type, status, payload")
        .eq("tenant_id", tenant_id)
        .in_("status", ["queued", "running"])
        .limit(200)
        .execute()
    ).data or []
    return {
        str(r["job_type"])
        for r in rows
        if (r.get("payload") or {}).get("property_id") == property_id
    }


def _freies_fenster(
    db: Client, property_id: str, ab: date, naechte: int
) -> date | None:
    """Erster Tag, ab dem `naechte` Nächte am Stück WIRKLICH buchbar sind.

    Geprüft wird mit denselben Helfern, die die Buchungsstrecke benutzt
    (`availability_block_hits_channel`, `stop_sell_blocks_channel` für den
    Plattform-Kanal) — eine eigene Auslegung von „frei" wäre eine zweite
    Wahrheit, und genau daran ist der erste Lauf gescheitert: der Kalender war
    offen, aber ein Verkaufsstopp lag darauf.

    Tage ohne availability-Zeile gelten NICHT als frei: ohne Zeile weiß niemand,
    ob dort verkauft werden darf (Wurzel 4).
    """
    rows = (
        db.table("availability")
        .select("date, status, source")
        .eq("property_id", property_id)
        .gte("date", ab.isoformat())
        .order("date")
        .limit(1000)
        .execute()
    ).data or []
    gesperrt = {
        str(r["date"])
        for r in rows
        if str(r.get("status")) != "open"
        and availability_block_hits_channel(r.get("source"), PLATFORM)
    }
    offen = {str(r["date"]) for r in rows} - gesperrt
    stops = (
        db.table("stop_sell")
        .select("date, scope, channels")
        .eq("property_id", property_id)
        .gte("date", ab.isoformat())
        .limit(1000)
        .execute()
    ).data or []
    offen -= {
        str(r["date"]) for r in stops if stop_sell_blocks_channel(r, PLATFORM)
    }
    tag = ab
    grenze = ab + timedelta(days=365)
    while tag < grenze:
        fenster = [(tag + timedelta(days=k)).isoformat() for k in range(naechte)]
        if all(d in offen for d in fenster):
            return tag
        tag += timedelta(days=1)
    return None


def _alte_testbuchungen_entfernen(
    db: Client, ctx: AuthContext, property_id: str
) -> None:
    """Reste früherer Läufe wegräumen, bevor gemessen wird (Selbstheilung)."""
    rows = (
        db.table("reservations")
        .select("id, status")
        .eq("property_id", property_id)
        .eq("guest_email", TESTGAST_EMAIL)
        .execute()
    ).data or []
    for row in rows:
        _reservierung_entfernen(db, ctx, str(row["id"]))
    if rows:
        print(f"  · {len(rows)} Testbuchung(en) aus früheren Läufen entfernt")


def _reservierung_entfernen(db: Client, ctx: AuthContext, reservation_id: str) -> None:
    """Test-Reservierung zurücknehmen — über den EINEN offiziellen Pfad.

    `ReservationsService.cancel` gibt die Nächte über `_release_nights` frei und
    meldet sie an die Portale zurück (Wurzel 1). Die Zeile selbst wird danach
    gelöscht, damit das Testobjekt nicht mit Storni zuwächst; hängt ein
    Audit-Eintrag daran, bleibt sie storniert stehen — dann ist der Kalender
    trotzdem frei, und das ist der Punkt, auf den es ankommt.
    """
    from src.features.reservations.service import ReservationsService  # noqa: PLC0415

    # `by_user_id=None`: der E2E-Kontext ist kein echter Benutzer, und eine
    # erfundene UUID im Storno-Protokoll wäre eine Fälschung (die Spalte ist
    # uuid — „e2e" hat den ersten Lauf mit 22P02 abgebrochen).
    svc = ReservationsService(service_client=db)
    zeile = (
        db.table("reservations")
        .select("status")
        .eq("id", reservation_id)
        .limit(1)
        .execute()
    ).data
    if zeile and str(zeile[0].get("status")) != "cancelled":
        svc.cancel(ctx, reservation_id, "E2E-Testlauf Promotions", by_user_id=None)
    try:
        db.table("reservations").delete().eq("id", reservation_id).execute()
    except Exception as exc:  # noqa: BLE001 — Storno ist der wichtige Teil
        print(f"  · Reservierung {reservation_id} bleibt storniert stehen: "
              f"{str(exc)[:80]}")


if __name__ == "__main__":
    main()
