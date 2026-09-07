"""Eigentümer, ihre Objektzuordnung und fertige Abrechnungen für die Demo.

WARUM ES DAS GIBT (07.09.2026)
==============================
Der Seed baute Objekte, Buchungen, Personal und Posteingang — aber KEINE
Eigentümer. Live gemessen: alle drei Demo-Betriebe hatten null Zeilen in
`owners`. Damit war der gesamte Eigentümer-Zweig des PMS auf keinem Screenshot
zu zeigen: die Liste `/eigentuemer`, die Abrechnungen, das Eigentümer-Portal
und die Auswertung „Ausgaben & Extras" standen leer, obwohl es die Funktionen
gibt. Für ein Verkaufsbild ist eine leere Seite schlimmer als gar keine.

WAS HIER ENTSTEHT
-----------------
* Ein Eigentümer je Objekt-Gruppe (nicht je Objekt): so sieht man beides —
  Eigentümer mit EINEM Haus und Eigentümer mit mehreren. Ein Objekt hat genau
  einen Eigentümer (unique-Index 0073), deshalb wird jedes Objekt genau einmal
  vergeben.
* `owner_properties` mit `ownership_share = 100`: Miteigentum ist ein eigener
  Fall, den die Demo bewusst NICHT zeigt — ein Screenshot soll den Normalfall
  erklären, nicht die Ausnahme.
* Je Eigentümer eine FINALISIERTE Abrechnung für den Vormonat und eine
  ENTWURFS-Abrechnung für den laufenden Monat. Beide Zustände nebeneinander,
  weil die Oberfläche sie verschieden zeichnet (Rechnungsnummer, Sperre).
* Verrechnungsposten (`owner_expenses`) in beiden Richtungen: `from_owner`
  (Handwerker, Verbrauch) und `to_owner` (Gutschrift). Sie füllen zugleich den
  Auswertungs-Reiter „Ausgaben & Extras".

WAS ES NICHT TUT
----------------
Es rechnet die Beträge NICHT aus den Buchungen nach. Der Abrechnungs-Service
ist die Wahrheit dafür; ihn hier nachzubauen hieße, zwei Rechenwege zu pflegen
(genau der Fehler, den `auswertung-export` vermeidet). Die Zahlen sind aus dem
tatsächlichen Buchungsbestand des Zeitraums SUMMIERT — also echt, nur ohne die
Feinheiten von Gebühren und Staffeln.
"""
from __future__ import annotations

import random
from datetime import date, timedelta
from typing import Any

from konfig import Supabase, demo_id

# Fester Keim wie im Seed: gleiche Eigentümer bei jedem Lauf.
KEIM = 20260907

# Erfundene Personen mit formal gültigen Bankdaten (IBAN-Prüfziffer korrekt),
# damit die Auszahlungsansicht im Screenshot keine Fehler zeigt.
PERSONEN: list[dict[str, str]] = [
    {"name": "Katharina Moser", "email": "k.moser@example.at", "telefon": "+43 664 1102384",
     "strasse": "Lindenweg", "hausnummer": "12", "plz": "6363", "stadt": "Westendorf",
     "iban": "AT483200000012345864", "bic": "RLNWATWWXXX", "sprache": "de"},
    {"name": "Bernhard Steiner", "email": "b.steiner@example.at", "telefon": "+43 676 4471209",
     "strasse": "Kirchgasse", "hausnummer": "4", "plz": "6370", "stadt": "Kitzbühel",
     "iban": "AT611904300234573201", "bic": "BKAUATWWXXX", "sprache": "de"},
    {"name": "Elisabeth Hofer", "email": "e.hofer@example.at", "telefon": "+43 650 3387412",
     "strasse": "Seepromenade", "hausnummer": "21", "plz": "6212", "stadt": "Maurach",
     "iban": "AT022050302101023600", "bic": "SPIHAT22XXX", "sprache": "de"},
    {"name": "Familie Brugger", "email": "brugger@example.at", "telefon": "+43 512 584120",
     "strasse": "Anichstraße", "hausnummer": "9", "plz": "6020", "stadt": "Innsbruck",
     "iban": "AT791100000262600100", "bic": "BKAUATWWXXX", "sprache": "de",
     "firma": "Brugger Immobilien OG"},
    {"name": "Sandra Wallner", "email": "s.wallner@example.at", "telefon": "+43 699 1728394",
     "strasse": "Donauweg", "hausnummer": "6", "plz": "3601", "stadt": "Dürnstein",
     "iban": "AT321400000123456789", "bic": "BAWAATWWXXX", "sprache": "de"},
    {"name": "Markus Leitner", "email": "m.leitner@example.at", "telefon": "+43 662 887431",
     "strasse": "Alpenstraße", "hausnummer": "33", "plz": "5700", "stadt": "Zell am See",
     "iban": "AT973200000000123456", "bic": "RLNWATWWXXX", "sprache": "de"},
    {"name": "Nordlicht Immobilien GmbH", "email": "verwaltung@example.de",
     "telefon": "+49 38232 78120", "strasse": "Boddenweg", "hausnummer": "3",
     "plz": "18374", "stadt": "Zingst", "iban": "DE02120300000000202051",
     "bic": "BYLADEM1001", "sprache": "de", "firma": "Nordlicht Immobilien GmbH"},
    {"name": "Christine Paulsen", "email": "c.paulsen@example.de", "telefon": "+49 171 3348201",
     "strasse": "Deichstraße", "hausnummer": "17", "plz": "18375", "stadt": "Prerow",
     "iban": "DE89370400440532013000", "bic": "COBADEFFXXX", "sprache": "de"},
    {"name": "Hendrik Timm", "email": "h.timm@example.de", "telefon": "+49 160 2298431",
     "strasse": "Am Hafen", "hausnummer": "5", "plz": "18347", "stadt": "Ahrenshoop",
     "iban": "DE12500105170648489890", "bic": "INGDDEFFXXX", "sprache": "de"},
    {"name": "Birgit Sonnenberg", "email": "b.sonnenberg@example.de",
     "telefon": "+49 173 5561042", "strasse": "Dünenring", "hausnummer": "28",
     "plz": "18225", "stadt": "Kühlungsborn", "iban": "DE75512108001245126199",
     "bic": "GENODEF1M03", "sprache": "de"},
]

# Verrechnungsposten je Eigentümer. `from_owner` mindert seine Auszahlung,
# `to_owner` erhöht sie — beide Richtungen, damit die Oberfläche beide Farben
# zeigt. Kategorien sind bestehende Werte des Ausgaben-Slice.
POSTEN_VORLAGEN: list[tuple[str, str, str, float]] = [
    ("from_owner", "Maintenance", "Heizungswartung Jahresservice", 189.00),
    ("from_owner", "Cleaning", "Fensterreinigung außen", 145.00),
    ("from_owner", "Goods", "Bettwäsche Ersatzbeschaffung", 238.50),
    ("from_owner", "Utilities", "Stromabrechnung Zwischenablesung", 312.40),
    ("from_owner", "Repairs", "Reparatur Geschirrspüler", 274.90),
    ("to_owner", "Other", "Gutschrift Kaution Schadensfall", 150.00),
    ("to_owner", "Other", "Weiterberechnung Kurtaxe", 96.00),
]


def _monat_grenzen(heute: date, monate_zurueck: int) -> tuple[date, date]:
    """Erster und letzter Tag des Monats, der `monate_zurueck` zurückliegt."""
    jahr, monat = heute.year, heute.month - monate_zurueck
    while monat < 1:
        monat += 12
        jahr -= 1
    von = date(jahr, monat, 1)
    bis = date(jahr + (monat == 12), (monat % 12) + 1, 1) - timedelta(days=1)
    return von, bis


def _gruppen(objekt_ids: dict[str, str], wuerfel: random.Random) -> list[list[str]]:
    """Objekte auf Eigentümer verteilen: meist eines, manchmal zwei oder drei.

    Ein Objekt hat GENAU EINEN Eigentümer (unique 0073) — deshalb wird jedes
    Objekt genau einer Gruppe zugeteilt, nie zweien.
    """
    schluessel = list(objekt_ids)
    wuerfel.shuffle(schluessel)
    gruppen: list[list[str]] = []
    i = 0
    while i < len(schluessel):
        # Verteilung: die meisten Eigentümer haben ein Haus, einige mehrere.
        groesse = wuerfel.choice([1, 1, 1, 2, 2, 3])
        gruppen.append(schluessel[i : i + groesse])
        i += groesse
    return gruppen


def _summen(db: Supabase, tenant_id: str, property_ids: list[str],
            von: date, bis: date) -> tuple[float, int]:
    """Umsatz und Anzahl der Buchungen dieser Objekte im Zeitraum.

    Aus dem ECHTEN Bestand summiert, nicht erfunden: die Abrechnung im
    Screenshot soll zu dem passen, was die Buchungsliste daneben zeigt.
    """
    zeilen = db.select(
        "reservations",
        tenant_id=f"eq.{tenant_id}",
        property_id=f"in.({','.join(property_ids)})",
        check_in=f"gte.{von.isoformat()}",
        select="id, total_amount, check_in, status",
    )
    gueltig = [
        z for z in zeilen
        if z.get("check_in") and z["check_in"][:10] <= bis.isoformat()
        and str(z.get("status")) not in ("cancelled", "no_show")
    ]
    return round(sum(float(z.get("total_amount") or 0) for z in gueltig), 2), len(gueltig)


def eigentuemer_anlegen(  # pylint: disable=too-many-locals
    db: Supabase, betrieb: Any, tenant_id: str, objekt_ids: dict[str, str]
) -> None:
    """Eigentümer, Objektzuordnung, Verrechnungsposten und zwei Abrechnungen."""
    wuerfel = random.Random(KEIM)
    heute = date.today()
    gruppen = _gruppen(objekt_ids, wuerfel)
    firma = betrieb.firma

    owners: list[dict[str, Any]] = []
    zuordnung: list[dict[str, Any]] = []
    posten: list[dict[str, Any]] = []
    statements: list[dict[str, Any]] = []

    for nummer, gruppe in enumerate(gruppen):
        person = PERSONEN[nummer % len(PERSONEN)]
        owner_id = demo_id(f"owner:{betrieb.schluessel}:{nummer}")
        # Provision des Betriebs: gestaffelt, damit die Liste nicht überall
        # denselben Wert zeigt. Werte aus dem üblichen Marktband (15–25 %).
        provision = wuerfel.choice([15.0, 18.0, 20.0, 22.0, 25.0])
        owners.append({
            "id": owner_id,
            "tenant_id": tenant_id,
            "name": person["name"],
            "company": person.get("firma"),
            "email": person["email"],
            "phone": person["telefon"],
            "street": person["strasse"],
            "house_number": person["hausnummer"],
            "postal_code": person["plz"],
            "city": person["stadt"],
            "country": firma.land,
            "iban": person["iban"],
            "bic": person["bic"],
            "account_holder": person["name"],
            "language": person["sprache"],
            "default_commission_pct": provision,
            "default_payout_method": "bank_transfer",
            "statement_frequency": "monthly",
        })
        for schluessel in gruppe:
            zuordnung.append({
                "id": demo_id(f"ownerprop:{betrieb.schluessel}:{schluessel}"),
                "owner_id": owner_id,
                "property_id": objekt_ids[schluessel],
                "ownership_share": 100,
            })

        property_ids = [objekt_ids[s] for s in gruppe]

        # Verrechnungsposten: zwei bis drei je Eigentümer, im Vormonat.
        vor_von, vor_bis = _monat_grenzen(heute, 1)
        for lauf in range(wuerfel.choice([2, 2, 3])):
            richtung, kategorie, text, betrag = POSTEN_VORLAGEN[
                (nummer * 3 + lauf) % len(POSTEN_VORLAGEN)
            ]
            tag = vor_von + timedelta(days=wuerfel.randrange((vor_bis - vor_von).days))
            posten.append({
                "id": demo_id(f"ownerexp:{betrieb.schluessel}:{nummer}:{lauf}"),
                "tenant_id": tenant_id,
                "owner_id": owner_id,
                "listing_id": objekt_ids[gruppe[0]],
                "concept": text,
                "date": tag.isoformat(),
                "category": kategorie,
                "amount": str(betrag),
                "currency": betrieb.waehrung,
                "direction": richtung,
                "created_by_name": "myNextDays",
            })

        # Zwei Abrechnungen: Vormonat finalisiert, laufender Monat als Entwurf.
        for versatz, status in ((1, "finalized"), (0, "draft")):
            von, bis = _monat_grenzen(heute, versatz)
            umsatz, anzahl = _summen(db, tenant_id, property_ids, von, bis)
            if not anzahl and status == "draft":
                # Ein leerer Entwurf ist eine ehrliche Anzeige, aber kein gutes
                # Bild — nur der finalisierte Beleg bleibt dann stehen.
                continue
            eigene_posten = [
                p for p in posten
                if p["owner_id"] == owner_id and von.isoformat() <= p["date"] <= bis.isoformat()
            ]
            von_owner = round(sum(float(p["amount"]) for p in eigene_posten
                                  if p["direction"] == "from_owner"), 2)
            zu_owner = round(sum(float(p["amount"]) for p in eigene_posten
                                 if p["direction"] == "to_owner"), 2)
            pm_anteil = round(umsatz * provision / 100, 2)
            auszahlung = round(umsatz - pm_anteil - von_owner + zu_owner, 2)
            statements.append({
                "id": demo_id(f"stmt:{betrieb.schluessel}:{nummer}:{versatz}"),
                "tenant_id": tenant_id,
                "owner_id": owner_id,
                "period_from": von.isoformat(),
                "period_to": bis.isoformat(),
                "basis": "check_in",
                # Nur Werte des DB-Enums `reservation_status` — `checked_in`/
                # `checked_out` gab es dort nie, der Beleg starb damit beim
                # Lesen mit 500 (07.09.2026).
                "reservation_statuses": ["confirmed", "completed"],
                "status": status,
                "kind": "invoice",
                "commission_pct": provision,
                "currency": betrieb.waehrung,
                "total_price": str(umsatz),
                "total_payout": str(auszahlung),
                "expenses_from_owner": str(von_owner),
                "expenses_to_owner": str(zu_owner),
                "expenses_total": str(round(von_owner - zu_owner, 2)),
                "owner_payout": str(auszahlung),
                "pm_payout": str(pm_anteil),
                # Rechnungsnummer NUR am finalisierten Beleg: ein Entwurf hat
                # noch keine, und eine erfundene stünde später in der Buchhaltung.
                "invoice_number": (
                    f"{von.year}-{nummer + 1:04d}" if status == "finalized" else None
                ),
                "invoice_date": bis.isoformat() if status == "finalized" else None,
                "due_date": (bis + timedelta(days=14)).isoformat()
                if status == "finalized" else None,
                # Stammdaten-Schnappschuss: der Beleg muss auch dann noch
                # stimmen, wenn sich Adresse oder Name später ändern.
                "owner_name": person["name"],
                "owner_email": person["email"],
                "owner_phone": person["telefon"],
                "owner_address": (f"{person['strasse']} {person['hausnummer']}, "
                                  f"{person['plz']} {person['stadt']}"),
                "owner_currency": betrieb.waehrung,
                "pm_name": firma.legal_name,
                "pm_email": firma.email,
                "pm_phone": firma.telefon,
                "pm_address": (f"{firma.strasse} {firma.hausnummer}, "
                               f"{firma.plz} {firma.stadt}"),
                "pm_tax_id": firma.vat_id,
                "property_ids": property_ids,
                "language": person["sprache"],
            })

    db.upsert("owners", owners)
    db.upsert("owner_properties", zuordnung, konflikt="owner_id,property_id")
    db.upsert("owner_expenses", posten)
    db.upsert("owner_statements", statements)
    print(f"  {len(owners)} Eigentümer, {len(zuordnung)} Objektzuordnungen, "
          f"{len(posten)} Verrechnungsposten, {len(statements)} Abrechnungen")


def portalzugang_anlegen(
    db: Supabase, betrieb: Any, tenant_id: str, passwort: str
) -> None:
    """Einen Eigentuemer-LOGIN fuer die App anlegen (Rolle `owner`).

    WARUM EIGENS UND NICHT UEBER DIE API
    ------------------------------------
    Der Produktivweg ist `POST /owners/{id}/portalzugang`. Der verschickt eine
    EINLADUNGSMAIL an die hinterlegte Adresse und vergibt kein Passwort — bei
    `@example.at` kommt nichts an, und ein Vorfuehr-Konto braucht ein festes,
    wiederholbar setzbares Passwort. Deshalb hier derselbe Weg wie fuer alle
    anderen Demo-Logins: `auth_user_sicherstellen` (Supabase-Admin-API).

    DREI Dinge gehoeren dazu, nicht eines:
      1. Der Auth-Nutzer mit `app_metadata` (tenant_id + role). Die API liest
         den Mandanten AUS DEM TOKEN, nicht aus `users` — ohne die Claims
         antwortet jeder Endpunkt „Kein Tenant im Konto".
      2. Die `users`-Zeile mit Rolle `owner`. Daraus leitet die App ihr
         Erlebnis ab (`experienceFor` → OwnerTabs), und daraus kommen die
         Capabilities (VIEW_OWNER_REPORTS, REQUEST_BLOCK …) — ein eigenes
         `permissions`-Feld braucht die Rolle nicht.
      3. `owners.user_id` UND `owner_property_assignments`. Das sind zwei
         verschiedene Fragen: die erste sagt „wem gehoert das Objekt"
         (Abrechnung), die zweite „was sieht dieser Login" (Portal-RLS, 0058).
         Genau darauf setzt `owner_can_see_property` auf. Fehlt die zweite,
         meldet sich der Eigentuemer an und sieht NICHTS — die App zeigte eine
         leere Objektliste, ohne dass irgendwo ein Fehler stuende.

    Genommen wird der ERSTE Eigentuemer (`owner:<betrieb>:0`, Katharina Moser
    mit zwei Objekten): die Objektliste ist damit weder leer noch ueberladen.
    Deterministisch wie der ganze Seed — derselbe Lauf ergibt denselben Zugang.
    """
    owner_id = demo_id(f"owner:{betrieb.schluessel}:0")
    zeilen = db.select("owners", tenant_id=f"eq.{tenant_id}", id=f"eq.{owner_id}",
                       select="id,name,email,language")
    if not zeilen:
        print("  kein Eigentümer für den Portalzugang gefunden")
        return
    eigentuemer = zeilen[0]
    email = str(eigentuemer.get("email") or "").strip()
    if not email:
        print(f"  {eigentuemer['name']}: ohne E-Mail kein Login")
        return

    auth_id = db.auth_user_sicherstellen(
        email, passwort, {"tenant_id": tenant_id, "role": "owner"},
    )
    db.upsert("users", [{
        "id": auth_id,
        "tenant_id": tenant_id,
        "role": "owner",
        "email": email,
        "full_name": eigentuemer["name"],
        "preferred_language": eigentuemer.get("language") or "de",
        "preferred_currency": betrieb.waehrung,
    }])
    db.patch("owners", {"user_id": auth_id}, id=f"eq.{owner_id}")

    # Portal-Sicht: je zugeordnetem Objekt eine Zeile. `konflikt` haelt den
    # Lauf idempotent — ein zweiter Aufruf legt nichts doppelt an (Wurzel 2).
    # Die Spaltenliste folgt dem UNIQUE-Index aus 0058: `(user_id,
    # property_id)` OHNE tenant_id. Ein `konflikt` mit anderen Spalten als
    # dem Index wird von PostgREST mit 42P10 abgewiesen.
    objekte = db.select("owner_properties", owner_id=f"eq.{owner_id}",
                        select="property_id")
    db.upsert("owner_property_assignments", [{
        "id": demo_id(f"opa:{betrieb.schluessel}:{o['property_id']}"),
        "tenant_id": tenant_id,
        "user_id": auth_id,
        "property_id": o["property_id"],
    } for o in objekte], konflikt="user_id,property_id")
    print(f"  Eigentümer-Zugang: {email} ({len(objekte)} Objekte)")
