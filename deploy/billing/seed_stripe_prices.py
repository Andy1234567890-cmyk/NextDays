#!/usr/bin/env python3
"""Legt die myNextDays-Abo-Preisliste idempotent in Stripe an (SDK).

Quelle der Wahrheit: myNextDays_Preisliste.pdf (Stand 07/2026).
Betraege in EUR (Anker 19,90 EUR), plus feste Betraege in den sechs
Nicht-EUR-Waehrungen der EU als `currency_options` (siehe Abschnitt
"Waehrungsoptionen" unten).

WARUM NICHT MEHR NUR EUR (Aenderung 24.08.2026):
Vorher trug jeder Preis nur EUR, und die Umrechnung sollte Stripe Adaptive
Pricing im Checkout uebernehmen. Das deckt den Checkout ab — aber NICHT die
oeffentliche Preisseite: die liest `/subscriptions/public/pricing` und zeigte
einem daenischen Besucher "19,90 EUR". Ein Preis in einer Waehrung, die der
Besucher nicht benutzt, ist keine Angabe, sondern eine Umrechnungsaufgabe.
`currency_options` loest beides mit EINER Quelle: die Preisseite liest den
Betrag der Besucher-Waehrung, und Checkout waehlt dieselbe Zahl automatisch
anhand der IP (Stripe-Doku "Preise in mehreren Waehrungen verwenden") — Seite
und Rechnung koennen so nicht auseinanderlaufen.

RUECKWEG (am 24.08.2026 an einem Wegwerf-Preis im Live-Konto BEWIESEN):
`currency_options` laesst sich NICHT wieder entfernen. Stripe antwortet auf
`currency_options=` mit "You cannot unset currency_options." und auf
`currency_options[dkk]=` mit `parameter_invalid_empty`. Der Weg zurueck ist
derselbe wie bei einer Betragsaenderung und funktioniert, weil der ganze Code
Preise ueber den `lookup_key` adressiert, nie ueber die ID:
    1. neuen Preis mit denselben EUR-Betraegen anlegen, ohne
       `currency_options`, mit `transfer_lookup_key=true`
    2. alten Preis `active=false`
Der `lookup_key` wandert dabei atomar mit; laufende Abos behalten ihren alten
Preis und bleiben unberuehrt.

Idempotenz (Wurzel 2): jedes Produkt/jeder Preis traegt einen stabilen
`lookup_key` (Preise) bzw. `metadata.mnd_key` (Produkte). Ein zweiter Lauf
erzeugt NICHTS doppelt: vorhandene Objekte werden wiederverwendet. Preise sind
in Stripe immutable — Betragsaenderung = neuer Preis + alter deaktiviert (nie
mutieren). Das erkennt das Skript und meldet DRIFT statt still zu ueberschreiben.

Ausfuehrung (nie automatisch, nur manuell):
    STRIPE_SECRET_KEY=sk_test_... python3 deploy/billing/seed_stripe_prices.py [--apply]

Ohne --apply laeuft ein DRY-RUN (nichts wird geschrieben, nur der Plan gezeigt).
Der Key wird NUR aus der Umgebung gelesen, nie hardcoded/geloggt.
"""
from __future__ import annotations

import json
import os
import sys

import stripe

CURRENCY = "eur"  # Standardwaehrung jedes Preises. Weitere via currency_options.

# Der lookup_key des Grundtarifs. Deckungsgleich mit GRUNDTARIF_LOOKUP_KEY in
# apps/api/src/features/subscriptions/schemas.py — dort liest die API ihn, hier
# wird er angelegt. Als Konstante, weil er unten dreimal vorkommt.
GRUNDTARIF_LK = "mnd_grundtarif_month"

# --- Waehrungsoptionen ----------------------------------------------------
# WELCHE WAEHRUNGEN: die sechs Waehrungen, die es in der EU neben dem Euro
# ueberhaupt noch gibt. BGN steht bewusst NICHT dabei — Bulgarien hat den Euro
# am 01.01.2026 eingefuehrt (Ratsbeschluss 08.07.2025, feste Umstellung
# 1 EUR = 1,95583 BGN); die EZB fuehrt BGN seither nicht mehr im Kursblatt.
# Kroatien (2023) und die uebrigen 20 Euro-Laender brauchen ohnehin nichts.
#
# EZB-Referenzkurse vom 24.08.2026 (eurofxref-daily). Sie sind hier NICHT die
# Preisquelle, sondern die Pruefgrundlage: Preise sind Festlegungen, keine
# Tageskurse. Ein Preis, der sich mit dem Kurs bewegt, ist kein Preis.
FX_STAND = "2026-08-24"  # EZB eurofxref-daily
FX_ECB = {
    "dkk": 7.4757,
    "sek": 11.0805,
    "pln": 4.3078,
    "czk": 24.100,
    "huf": 362.55,
    "ron": 5.2504,
}

# Rundungsschritt in der KLEINSTEN Einheit. Alle sechs sind bei Stripe
# Zwei-Dezimal-Waehrungen (die "durch 100 teilbar"-Regel fuer HUF gilt laut
# Stripe-Doku nur fuer AUSZAHLUNGEN, nicht fuer Belastungen). Trotzdem wird auf
# ganze Einheiten gerundet — ein Abo-Preis mit Oere/Groschen liest sich falsch.
# HUF auf 10 Forint, weil 1 Forint eine Groessenordnung kleiner ist als 1 Krone.
FX_SCHRITT = {"dkk": 100, "sek": 100, "pln": 100, "czk": 100, "huf": 1000, "ron": 100}

# Die FESTGELEGTEN Betraege je Waehrung, in der kleinsten Einheit.
# Regel, mit der sie entstanden sind und die `_assert_currency_math` prueft:
# EUR-Betrag x EZB-Kurs, dann AUFGERUNDET auf den Schritt aus FX_SCHRITT.
# Aufgerundet, nie abgerundet: sonst waere eine Waehrung guenstiger als der
# EUR-Anker und wir wuerden dieselbe Leistung je Land unterschiedlich teuer
# verkaufen, ohne es entschieden zu haben.
#
# `tiers` spiegelt GRADUATED_TIERS in derselben Reihenfolge (die Assertion
# prueft die Laenge), `module` die Schluessel von FIXED_PRICES (dito).
CURRENCY_OPTIONS: dict[str, dict] = {
    "dkk": {
        "tiers": [14900, 4500, 3800, 3000],
        "module": {"modul3_flat": 22500, "modul4_flat": 14900,
                   "modul4_per_seat": 1900, "modul6_flat": 448600,
                   "modul6_per_room": 1200},
    },
    "sek": {
        "tiers": [22100, 6700, 5600, 4500],
        "module": {"modul3_flat": 33300, "modul4_flat": 22100,
                   "modul4_per_seat": 2800, "modul6_flat": 664900,
                   "modul6_per_room": 1700},
    },
    "pln": {
        "tiers": [8600, 2600, 2200, 1800],
        "module": {"modul3_flat": 13000, "modul4_flat": 8600,
                   "modul4_per_seat": 1100, "modul6_flat": 258500,
                   "modul6_per_room": 700},
    },
    "czk": {
        "tiers": [48000, 14500, 12100, 9700],
        "module": {"modul3_flat": 72300, "modul4_flat": 48000,
                   "modul4_per_seat": 6100, "modul6_flat": 1446000,
                   "modul6_per_room": 3700},
    },
    "huf": {
        "tiers": [722000, 218000, 182000, 146000],
        "module": {"modul3_flat": 1088000, "modul4_flat": 722000,
                   "modul4_per_seat": 91000, "modul6_flat": 21753000,
                   "modul6_per_room": 55000},
    },
    "ron": {
        "tiers": [10500, 3200, 2700, 2100],
        "module": {"modul3_flat": 15800, "modul4_flat": 10500,
                   "modul4_per_seat": 1400, "modul6_flat": 315100,
                   "modul6_per_room": 800},
    },
}

# Obergrenze der erlaubten Abweichung nach oben (Faktor auf den umgerechneten
# Betrag). Sie faengt den einzigen Fehler, den eine Aufrundungsregel nicht
# faengt: eine Null zu viel. Der groesste echte Abstand liegt bei 1,083
# (PLN, 1,50 EUR -> 7 PLN; bei kleinen Betraegen wirkt die Aufrundung am
# staerksten), deshalb 1,15.
FX_TOLERANZ = 1.15

# --- Produkte -------------------------------------------------------------
# mnd_key = stabiler interner Schluessel (metadata), NICHT die Stripe-ID.
PRODUCTS = {
    "grundtarif": {
        "name": "myNextDays Grundtarif",
        "desc": "Grundgebuehr inkl. 1. Objekt (voller Funktionsumfang) + "
        "Objekt-Staffel. Modul 1+2: PMS, Channel Manager, Buchungsportal, "
        "Eigentuemer-App, Reinigungs-App.",
    },
    "modul3_buchhaltung": {"name": "Modul 3 - Buchhaltung",
                           "desc": "Rechnungs- & Exportlogik, DATEV / e-conomic."},
    "modul4_mitarbeiter": {"name": "Modul 4 - Mitarbeiter",
                           "desc": "Schicht- & Einsatzplanung."},
    "modul6_hotel": {"name": "Modul 6 - Hotel",
                     "desc": "Front Desk."},
    "dynamische_preise": {
        "name": "Dynamische Preise",
        "desc": "Automatische Preisoptimierung (Auslastung, Vorlauf, Saison, "
        "Markt). Abrechnung nutzungsabhaengig: 0,5 % vom Umsatz der Buchungen, "
        "die waehrend der aktiven Buchung des Moduls entstehen.",
    },
    # Modul 5 (Jobmarkt, 2 % vom Umsatz) ist KEIN fixer Preis -> wird nachgelagert
    # als Invoice-Item berechnet, kein Stripe-Produkt hier. Bewusst ausgelassen.
}

# --- Preise ---------------------------------------------------------------
# Betraege in kleinster Einheit (Cent). lookup_key = stabiler Schluessel.
# Grundtarif: EIN wiederkehrender graduated Preis (tiers_mode=graduated).
#   Tier 1  (up_to 1)   : 19,90 EUR FLAT   -> flat_amount 1990
#   Tier 2  (up_to 50)  :  6,00 EUR/Objekt -> unit_amount  600
#   Tier 3  (up_to 100) :  5,00 EUR/Objekt -> unit_amount  500
#   Tier 4  (inf)       :  4,00 EUR/Objekt -> unit_amount  400
GRADUATED_TIERS = [
    {"up_to": 1, "flat_amount": 1990},
    {"up_to": 50, "unit_amount": 600},
    {"up_to": 100, "unit_amount": 500},
    {"up_to": "inf", "unit_amount": 400},
]

# Fixe Modul-Preise (recurring monatlich, per_unit).
FIXED_PRICES = {
    "modul3_flat": {"product": "modul3_buchhaltung", "unit_amount": 3000,
                    "recurring": {"interval": "month"}},
    # Modul 4: zwei Alternativpreise (Kunde waehlt einen).
    "modul4_flat": {"product": "modul4_mitarbeiter", "unit_amount": 1990,
                    "recurring": {"interval": "month"}},
    "modul4_per_seat": {"product": "modul4_mitarbeiter", "unit_amount": 250,
                        "recurring": {"interval": "month"}},
    # Modul 6: zwei Alternativpreise (ab 600/Monat ODER 1,50/Zimmer).
    "modul6_flat": {"product": "modul6_hotel", "unit_amount": 60000,
                    "recurring": {"interval": "month"}},
    "modul6_per_room": {"product": "modul6_hotel", "unit_amount": 150,
                        "recurring": {"interval": "month"}},
}


def _die(msg: str) -> None:
    print(f"FEHLER: {msg}", file=sys.stderr)
    sys.exit(1)


def _tier_upper(tier: dict) -> float:
    """Obergrenze einer Stripe-Stufe als Zahl. `up_to: "inf"` = letzte Stufe."""
    up_to = tier["up_to"]
    return float("inf") if up_to in ("inf", float("inf")) else float(up_to)


def _graduated_cost(objects: int) -> int:
    """Monatsbetrag (Cent) fuer `objects` Objekte — gerechnet AUS `GRADUATED_TIERS`.

    Stripe-Semantik `tiers_mode=graduated`: die Stufen werden der Reihe nach
    gefuellt, `up_to` ist die kumulative Obergrenze der Stufe. In jeder Stufe
    fallen `flat_amount` (pauschal, sobald die Stufe ueberhaupt erreicht ist)
    und `unit_amount` je Einheit IN dieser Stufe an.

    Bewusst KEINE zweite Kopie der Betraege hier (Wurzel 4): waere die Staffel
    hier erneut hardcodiert, pruefte die Assertion eine Kopie gegen die
    Referenz — nicht die Konfiguration, die wirklich nach Stripe geht.
    """
    total = 0
    lower = 0.0  # bereits von vorherigen Stufen abgedeckte Einheiten
    for tier in GRADUATED_TIERS:
        if objects <= lower:
            break
        upper = _tier_upper(tier)
        in_tier = min(float(objects), upper) - lower
        total += int(tier.get("flat_amount") or 0)
        total += int(in_tier) * int(tier.get("unit_amount") or 0)
        lower = upper
    return total


# Soll-Betraege der Modul-Preise in Cent. Referenz: PLAN-stripe-preisliste.md
# Zeile 94-97 (Tabelle "Zusatzmodule", Abschnitt 3 der Preisliste):
#   Z. 94  Modul 3 Buchhaltung   30,00 EUR/Monat                 -> 3000
#   Z. 95  Modul 4 Mitarbeiter   19,90 EUR/Monat ODER 2,50/Nutzer -> 1990 / 250
#   Z. 97  Modul 6 Hotel        600,00 EUR/Monat ODER 1,50/Zimmer -> 60000 / 150
# Modul 5 (Jobmarkt, 2 % vom Umsatz, Z. 96) hat bewusst KEINEN Stripe-Preis.
EXPECTED_FIXED_AMOUNTS = {
    "modul3_flat": 3000,
    "modul4_flat": 1990,
    "modul4_per_seat": 250,
    "modul6_flat": 60000,
    "modul6_per_room": 150,
}


def _assert_pdf_math() -> None:
    """Prueft die tatsaechliche Konfiguration gegen die Preisliste. Bricht ab,
    wenn Staffel ODER Modulpreise nicht exakt stimmen — bevor irgendetwas in
    Stripe entsteht.

    Geprueft wird `GRADUATED_TIERS` und `FIXED_PRICES` SELBST, nicht eine
    Kopie davon: aendert jemand die Konfiguration, schlaegt das hier aus.
    """
    checks = {1: 1990, 3: 3190, 20: 13390, 100: 56390, 200: 96390}
    for objs, want in checks.items():
        got = _graduated_cost(objs)
        if got != want:
            _die(f"Staffel falsch: {objs} Objekte = {got/100:.2f} EUR, "
                 f"PDF sagt {want/100:.2f} EUR")
    print("  PDF-Rechenbeispiele stimmen (1/3/20/100/200 Objekte) ✓")

    # Modulpreise: Menge der lookup_keys UND jeder Betrag muessen stimmen.
    if set(FIXED_PRICES) != set(EXPECTED_FIXED_AMOUNTS):
        fehlt = sorted(set(EXPECTED_FIXED_AMOUNTS) - set(FIXED_PRICES))
        zuviel = sorted(set(FIXED_PRICES) - set(EXPECTED_FIXED_AMOUNTS))
        _die("Modul-Preisliste weicht ab: fehlt="
             f"{fehlt or '-'}, unerwartet={zuviel or '-'} "
             "(Referenz: PLAN-stripe-preisliste.md Z. 94-97)")
    for lk, want_amount in EXPECTED_FIXED_AMOUNTS.items():
        got_amount = FIXED_PRICES[lk].get("unit_amount")
        if got_amount != want_amount:
            _die(f"Modulpreis '{lk}' falsch: {got_amount} Cent, Preisliste sagt "
                 f"{want_amount} Cent (PLAN-stripe-preisliste.md Z. 94-97)")
        recurring = FIXED_PRICES[lk].get("recurring")
        if recurring != {"interval": "month"}:
            _die(f"Modulpreis '{lk}' ist nicht monatlich wiederkehrend: "
                 f"{recurring!r} (Preisliste: '/Monat')")
    print("  Modulpreise stimmen (Modul 3/4/6, je monatlich) ✓")


def _aufrunden(betrag_eur_cent: int, waehrung: str) -> int:
    """EUR-Cent -> Betrag in der kleinsten Einheit von `waehrung`, aufgerundet.

    Genau die Regel, mit der die Zahlen in CURRENCY_OPTIONS entstanden sind —
    hier EINMAL als Code, damit die Assertion die Regel prueft und nicht eine
    zweite Abschrift der Zahlen (Wurzel 4).
    """
    schritt = FX_SCHRITT[waehrung]
    roh = int(betrag_eur_cent * FX_ECB[waehrung] + 0.5)
    return int(-(-roh // schritt) * schritt)


def _assert_ein_betrag(waehrung: str, bezeichnung: str, eur_cent: int,
                       betrag: int) -> None:
    """Ein Betrag gegen den Kurswert. Zwei Schranken, beide notwendig."""
    soll = _aufrunden(eur_cent, waehrung)
    obergrenze = int(eur_cent * FX_ECB[waehrung] * FX_TOLERANZ)
    if betrag < soll:
        _die(f"{waehrung.upper()} '{bezeichnung}': {betrag} liegt UNTER dem "
             f"aufgerundeten Kurswert {soll} (EUR {eur_cent / 100:.2f} x "
             f"{FX_ECB[waehrung]}, Stand {FX_STAND})")
    if betrag > obergrenze:
        _die(f"{waehrung.upper()} '{bezeichnung}': {betrag} liegt ueber der "
             f"Toleranz {obergrenze} ({FX_TOLERANZ}x Kurswert) — Tippfehler?")


def _assert_currency_math() -> None:
    """Prueft JEDEN festgelegten Fremdwaehrungsbetrag gegen EUR-Betrag x Kurs.

    Zusaetzlich Vollstaendigkeit: fehlt eine Stufe oder ein Modul, waere die
    Waehrung im Checkout unvollstaendig und Stripe fiele fuer den GANZEN
    Vorgang auf EUR zurueck — ein Fehler, den niemand sieht.
    """
    if set(CURRENCY_OPTIONS) != set(FX_ECB) or set(FX_SCHRITT) != set(FX_ECB):
        _die("Waehrungslisten weichen ab: CURRENCY_OPTIONS/FX_ECB/FX_SCHRITT "
             f"= {sorted(CURRENCY_OPTIONS)} / {sorted(FX_ECB)} / "
             f"{sorted(FX_SCHRITT)}")
    for waehrung, spec in CURRENCY_OPTIONS.items():
        stufen = spec["tiers"]
        if len(stufen) != len(GRADUATED_TIERS):
            _die(f"{waehrung.upper()}: {len(stufen)} Staffelstufen, "
                 f"die Staffel hat {len(GRADUATED_TIERS)}")
        for i, (tier, betrag) in enumerate(zip(GRADUATED_TIERS, stufen,
                                               strict=True)):
            eur = int(tier.get("flat_amount") or tier.get("unit_amount") or 0)
            _assert_ein_betrag(waehrung, f"Stufe {i + 1}", eur, betrag)
        if set(spec["module"]) != set(FIXED_PRICES):
            _die(f"{waehrung.upper()}: Modul-Betraege weichen ab, "
                 f"fehlt={sorted(set(FIXED_PRICES) - set(spec['module']))}, "
                 f"unerwartet={sorted(set(spec['module']) - set(FIXED_PRICES))}")
        for lk, betrag in spec["module"].items():
            eur = int(FIXED_PRICES[lk]["unit_amount"])
            _assert_ein_betrag(waehrung, lk, eur, betrag)
    print(f"  Fremdwaehrungsbetraege stimmen (EZB-Kurse {FX_STAND}, "
          f"{len(CURRENCY_OPTIONS)} Waehrungen) ✓")


def _tier_currency_option(waehrung: str) -> list[dict]:
    """`tiers` fuer eine Waehrung, in derselben Form wie GRADUATED_TIERS.

    Welche Stufe `flat_amount` und welche `unit_amount` traegt, wird AUS der
    EUR-Staffel uebernommen — nicht erneut entschieden. Sonst koennte eine
    Waehrung eine Pauschale dort tragen, wo EUR einen Stueckpreis hat.
    """
    raus = []
    betraege = CURRENCY_OPTIONS[waehrung]["tiers"]
    for tier, betrag in zip(GRADUATED_TIERS, betraege, strict=True):
        eintrag: dict = {"up_to": tier["up_to"]}
        if tier.get("flat_amount") is not None:
            eintrag["flat_amount"] = betrag
        else:
            eintrag["unit_amount"] = betrag
        raus.append(eintrag)
    return raus


def _find_product(mnd_key: str):  # noqa: ANN202
    res = stripe.Product.search(query=f"metadata['mnd_key']:'{mnd_key}'", limit=1)
    return res.data[0] if res.data else None


def _find_price(lookup_key: str):  # noqa: ANN202
    res = stripe.Price.list(lookup_keys=[lookup_key], limit=1)
    return res.data[0] if res.data else None


def _vorhandene_waehrungen(price_id: str) -> set[str]:
    """Welche Waehrungen der Preis SCHON traegt (ohne die Standardwaehrung).

    Zwei Fallstricke, beide hier live aufgelaufen:
    · `currency_options` kommt NICHT von allein mit — es muss expandiert werden.
    · Ein `StripeObject` ist kein `dict`. `.keys()` darauf wirft
      `AttributeError: keys`, weil JEDER Attributzugriff als Feldzugriff auf die
      Nutzdaten gedeutet wird — der Name landet in `self._data` und fehlt dort.
      Genau deshalb ist auch `to_dict_recursive` nicht erreichbar (heisst in
      dieser SDK-Version `_to_dict_recursive`). Was oeffentlich existiert und
      traegt, ist `to_dict()`.
    """
    p = stripe.Price.retrieve(price_id, expand=["currency_options"])
    opts = p["currency_options"] if "currency_options" in _felder(p) else None
    if opts is None:
        return set()
    return set(_als_dict(opts).keys()) - {CURRENCY}


def _felder(objekt) -> set[str]:  # noqa: ANN001
    """Welche Felder ein `StripeObject` (oder Dict) wirklich traegt."""
    if isinstance(objekt, dict):
        return set(objekt.keys())
    try:
        return set(_als_dict(objekt).keys())
    except Exception:  # noqa: BLE001 - kein Feld lesbar => keine Felder
        return set()


def _als_dict(objekt) -> dict:  # noqa: ANN001
    """`StripeObject` -> gewoehnliches Dict. Kein privater Zugriff, kein Raten."""
    if isinstance(objekt, dict):
        return dict(objekt)
    umwandeln = getattr(objekt, "to_dict", None)
    if callable(umwandeln):
        return dict(umwandeln())
    # Letzter Ausweg: die JSON-Darstellung, die jedes StripeObject liefert.
    return dict(json.loads(str(objekt)))


def ensure_currency_options(price, lookup_key: str, apply: bool) -> None:
    """Fehlende Waehrungen an einen bestehenden Preis anfuegen. Idempotent.

    Was hier NICHT passiert: eine bereits gesetzte Waehrung ueberschreiben. Sie
    wird nur gemeldet. Weicht ihr Betrag von der Festlegung ab, ist entweder
    die Tabelle oder Stripe falsch, und das muss ein Mensch entscheiden — still
    ueberschreiben hiesse, den Preis eines laufenden Vorgangs zu aendern.

    Der zweite Lauf schreibt nichts mehr (Wurzel 2): `_vorhandene_waehrungen`
    liest den Ist-Stand, und nur die Differenz geht raus.
    """
    if price is None:
        print(f"    + [DRY] '{lookup_key}': alle Waehrungen wuerden angefuegt "
              "(Preis existiert noch nicht)")
        return
    gesetzt = _vorhandene_waehrungen(price.id)
    fehlend = [w for w in CURRENCY_OPTIONS if w not in gesetzt]
    if gesetzt:
        print(f"    = '{lookup_key}': schon gesetzt "
              f"{sorted(w.upper() for w in gesetzt)}")
    if not fehlend:
        return
    ist_staffel = price.billing_scheme == "tiered"
    optionen: dict[str, dict] = {}
    for waehrung in fehlend:
        if ist_staffel:
            optionen[waehrung] = {"tiers": _tier_currency_option(waehrung)}
        else:
            betrag = CURRENCY_OPTIONS[waehrung]["module"].get(lookup_key)
            if betrag is None:
                _die(f"Kein {waehrung.upper()}-Betrag fuer '{lookup_key}' "
                     "in CURRENCY_OPTIONS")
            optionen[waehrung] = {"unit_amount": betrag}
    if not apply:
        print(f"    + [DRY] '{lookup_key}': {[w.upper() for w in fehlend]} "
              f"wuerden angefuegt: {optionen}")
        return
    stripe.Price.modify(price.id, currency_options=optionen)
    # Zuruecklesen: ein 200 ist kein Beweis, dass es ankam.
    nachher = _vorhandene_waehrungen(price.id)
    offen = [w for w in fehlend if w not in nachher]
    if offen:
        _die(f"'{lookup_key}': {[w.upper() for w in offen]} nach dem Schreiben "
             "nicht zurueckgelesen")
    print(f"    + '{lookup_key}': {[w.upper() for w in fehlend]} angefuegt "
          f"(jetzt {sorted(w.upper() for w in nachher)})")


def ensure_product(mnd_key: str, spec: dict, apply: bool):  # noqa: ANN202
    existing = _find_product(mnd_key)
    if existing:
        print(f"  = Produkt '{mnd_key}' existiert: {existing.id}")
        return existing
    if not apply:
        print(f"  + [DRY] Produkt '{mnd_key}' wuerde angelegt: {spec['name']}")
        return None
    prod = stripe.Product.create(
        name=spec["name"], description=spec["desc"],
        metadata={"mnd_key": mnd_key},
    )
    print(f"  + Produkt '{mnd_key}' angelegt: {prod.id}")
    return prod


def ensure_price(lookup_key: str, product_id: str, params: dict, apply: bool):
    existing = _find_price(lookup_key)
    if existing:
        # Drift-Check: gleicht der vorhandene Preis dem Soll? (nur melden, nie mutieren)
        print(f"  = Preis '{lookup_key}' existiert: {existing.id} "
              f"(active={existing.active})")
        return existing
    if not apply:
        print(f"  + [DRY] Preis '{lookup_key}' wuerde angelegt: {params}")
        return None
    price = stripe.Price.create(
        lookup_key=lookup_key, product=product_id, currency=CURRENCY, **params,
    )
    print(f"  + Preis '{lookup_key}' angelegt: {price.id}")
    return price


def main() -> None:
    key = os.environ.get("STRIPE_SECRET_KEY", "").strip()
    if not key:
        _die("STRIPE_SECRET_KEY nicht in der Umgebung gesetzt.")
    if not key.startswith(("sk_test_", "rk_test_")) and "--apply" in sys.argv and \
            "--allow-live" not in sys.argv:
        _die("LIVE-Key erkannt. --apply nur mit zusaetzlichem --allow-live "
             "(Sicherheitsschranke).")
    stripe.api_key = key
    apply = "--apply" in sys.argv
    mode = "APPLY (schreibt in Stripe)" if apply else "DRY-RUN (nichts wird geschrieben)"
    # Eingeschraenkte Schluessel (rk_) tragen denselben Modus wie sk_ — beide
    # Praefixe pruefen, sonst meldet ein rk_live_-Lauf faelschlich "TEST".
    if key.startswith(("sk_live_", "rk_live_")):
        live = "LIVE"
    elif key.startswith(("sk_test_", "rk_test_")):
        live = "TEST"
    else:
        live = "UNBEKANNT"
    print(f"== Stripe-Preisliste seeden — {mode} — Account-Modus: {live} ==")

    print("\n[0] PDF-Betragspruefung")
    _assert_pdf_math()
    _assert_currency_math()

    print("\n[1] Produkte")
    prods = {k: ensure_product(k, v, apply) for k, v in PRODUCTS.items()}

    print("\n[2] Grundtarif — graduated Preis")
    gt = prods.get("grundtarif")
    ensure_price(
        GRUNDTARIF_LK, gt.id if gt else "<dry>",
        {"recurring": {"interval": "month"},
         "billing_scheme": "tiered", "tiers_mode": "graduated",
         "tiers": GRADUATED_TIERS},
        apply,
    )

    print("\n[3] Modul-Preise")
    modulpreise = {}
    for lk, spec in FIXED_PRICES.items():
        prod = prods.get(spec["product"])
        params = {k: v for k, v in spec.items() if k != "product"}
        modulpreise[lk] = ensure_price(
            lk, prod.id if prod else "<dry>", params, apply
        )

    print("\n[3b] Waehrungsoptionen (DKK/SEK/PLN/CZK/HUF/RON)")
    ensure_currency_options(_find_price(GRUNDTARIF_LK), GRUNDTARIF_LK, apply)
    for lk, preis in modulpreise.items():
        ensure_currency_options(preis, lk, apply)

    print("\n[4] Hinweise")
    print("  - WhatsApp ist KEIN Zusatzmodul: der Kanal gehoert zum Grundtarif.")
    print("    Eine eigene Gebuehr waere nach Metas Tech-Provider-Terms")
    print("    (Section 5, No Resale) unzulaessig. Nicht wieder anlegen.")
    print("  - Modul 5 (Jobmarkt 2%), Provisionen UND Dynamische Preise (0,5%):")
    print("    nachgelagert als Invoice-Item, KEIN Stripe-Preis (variabel).")
    print("    Das Produkt 'Dynamische Preise' existiert nur als Katalog-Eintrag")
    print("    (Name/Beschreibung) — der Betrag kommt aus dynpricing_ledger")
    print("    (Migration 0277), je Waehrung ein eigenes Invoice-Item.")
    print("    KEIN Billing-Meter: ein Meter ist waehrungslos und wuerde EUR-")
    print("    und DKK-Buchungen zu einer sinnlosen Summe addieren (24 Laender).")
    print("  - Nicht-EUR (DKK/SEK/PLN/CZK/HUF/RON): feste Betraege als")
    print("    currency_options an jedem Preis (Tabelle oben, EZB-Kurse als")
    print("    Pruefgrundlage). Checkout waehlt sie automatisch nach IP.")
    print("    BGN entfaellt: Bulgarien hat den Euro am 01.01.2026 eingefuehrt.")
    print("  - currency_options sind NICHT entfernbar. Rueckweg: neuen Preis")
    print("    ohne sie anlegen mit transfer_lookup_key=true, alten auf")
    print("    active=false (siehe Modul-Docstring).")
    if not apply:
        print("\n>> DRY-RUN. Mit --apply real anlegen.")


if __name__ == "__main__":
    main()
