"""Airbnbs `standard_fees` → unsere Gebühren.

Die Beispieldaten sind live gemessen (05.08.2026, Konto AirSmil, 18 Listings mit
43 Gebühren, alle DKK) — nicht erfunden:

    PASS_THROUGH_CLEANING_FEE   795.0   flat  PER_BOOKING  PER_GROUP
    PASS_THROUGH_RESORT_FEE      25.0   flat  PER_NIGHT    PER_GROUP
    PASS_THROUGH_PET_FEE        150.0   flat  PER_BOOKING  PER_GROUP
"""
from __future__ import annotations

from src.features.channel_manager.airbnb_gebuehren_import import (
    AIRBNB_FEE_AUF_ART,
    KATEGORIE_AUF_AIRBNB,
    airbnb_fee_signatur,
    betrag_aus_airbnb,
    fee_aus_airbnb,
    fees_aus_airbnb,
)
from src.features.properties.gebuehren import (
    FEE_BASES,
    FEE_CATEGORIES,
    FEE_TYPES,
    fee_category,
)

# Genau die Antwort von Listing 1675950565421151420 (Holiday house Cornflower).
LIVE = [
    {"amount": 25.0, "amount_type": "flat", "charge_period": "PER_NIGHT",
     "charge_type": "PER_GROUP", "fee_type": "PASS_THROUGH_RESORT_FEE",
     "offline": False},
    {"amount": 795.0, "amount_type": "flat", "charge_period": "PER_BOOKING",
     "charge_type": "PER_GROUP", "fee_type": "PASS_THROUGH_CLEANING_FEE",
     "offline": False},
    {"amount": 150.0, "amount_type": "flat", "charge_period": "PER_BOOKING",
     "charge_type": "PER_GROUP", "fee_type": "PASS_THROUGH_PET_FEE",
     "offline": False},
]


def test_live_antwort_wird_vollstaendig_uebersetzt() -> None:
    """Die drei echten Gebühren, mit richtiger Basis je Zeile."""
    fees = fees_aus_airbnb(LIVE)
    assert len(fees) == 3
    nach_art = {f["feeType"]: f for f in fees}
    assert nach_art["resort"]["basis"] == "per_night"
    assert nach_art["resort"]["amount"] == 25.0
    assert nach_art["cleaning_fee"]["basis"] == "per_stay"
    assert nach_art["cleaning_fee"]["amount"] == 795.0
    assert nach_art["pet_fee"]["amount"] == 150.0


def test_betrag_wird_nicht_durch_hundert_geteilt() -> None:
    """Airbnbs Spec sagt „cents", geliefert wird die HAUPTEINHEIT.

    Live: eine Reinigungsgebühr von 1150.0 steht im Extranet als „1.150 kr DKK"
    (Listing 1654285285861524234). Durch 100 geteilt wären es 11,50 kr — der
    Betrieb würde 99 % seiner Reinigungskosten verlieren.
    """
    fee = fee_aus_airbnb(
        {"fee_type": "PASS_THROUGH_CLEANING_FEE", "amount": 1150.0,
         "amount_type": "flat", "charge_period": "PER_BOOKING",
         "charge_type": "PER_GROUP"}
    )
    assert fee is not None
    assert fee["amount"] == 1150.0


def test_mikro_betrag_wird_zurueckgerechnet() -> None:
    """Was CHANNEX geschrieben hat, kommt in Mikro-Einheiten zurück.

    Live gemessen (11.08.2026, Konto AirSmil): dasselbe Feld am selben Konto in
    zwei Größenordnungen — 1150.0 an einem vom Betrieb gepflegten Inserat,
    795000000 an dem, das unser Sync bespielt (Listing 54087677; im Airbnb-Host
    steht dort 795 kr). Ohne Rückrechnung meldete unser eigener Vergleich jede
    synchronisierte Gebühr als „795 Millionen" und damit als abweichend.
    """
    fee = fee_aus_airbnb(
        {"fee_type": "PASS_THROUGH_CLEANING_FEE", "amount": 795000000,
         "amount_type": "flat", "charge_period": "PER_BOOKING",
         "charge_type": "PER_GROUP"}
    )
    assert fee is not None
    assert fee["amount"] == 795.0
    assert betrag_aus_airbnb(
        {"amount": 25000000, "amount_type": "flat"}
    ) == 25.0


def test_prozentwert_wird_nie_zurueckgerechnet() -> None:
    """Prozent ist laut Spec eine Zahl zwischen 0 und 100 — nie Mikro."""
    assert betrag_aus_airbnb({"amount": 12.5, "amount_type": "percent"}) == 12.5


def test_mikro_erkennung_haengt_am_wert_nicht_am_json_typ() -> None:
    """795000000 ist 795,00 DKK — egal ob int, float oder String.

    Airbnb liefert heute `int` (live geprüft 11.08.2026). Bis dahin hing die
    Erkennung an `isinstance(wert, int)`: derselbe Betrag als `795000000.0`
    oder `"795000000"` lief unumgerechnet durch und schrieb 795 Millionen
    Kronen ins Inserat — genau der Fehler, den die Umrechnung verhindern soll.
    Ein Feed, der den Wert als Float oder String schickt, meint ihn nicht
    anders.
    """
    for wert in (795000000, 795000000.0, "795000000"):
        assert betrag_aus_airbnb({"amount": wert, "amount_type": "flat"}) == 795.0
    for wert in (25000000, 25000000.0, "25000000"):
        assert betrag_aus_airbnb({"amount": wert, "amount_type": "flat"}) == 25.0


def test_krummer_millionenbetrag_ist_keine_mikroeinheit() -> None:
    """Mikro-Einheiten sind immer ganzzahlig.

    1.500.000,75 ist damit ein echter (wenn auch unwahrscheinlicher) Betrag und
    darf nicht auf 1,50 heruntergerechnet werden — das wäre eine erfundene
    Zahl in der anderen Richtung.
    """
    assert betrag_aus_airbnb(
        {"amount": 1500000.75, "amount_type": "flat"}
    ) == 1500000.75


def test_wahrheitswert_ist_kein_betrag() -> None:
    """`True` ergäbe über `float()` 1,00 DKK — eine Gebühr aus einem Flag."""
    assert betrag_aus_airbnb({"amount": True, "amount_type": "flat"}) is None


def test_nullbetrag_wird_verworfen() -> None:
    """Airbnb führt „nicht erhoben" als 0 — das ist keine Gebühr.

    Live gemessen: `PASS_THROUGH_RESORT_FEE 0.0` und `PASS_THROUGH_PET_FEE 0.0`
    an mehreren Listings. Als Gebühr angelegt stünde in jeder Rechnung eine
    0-Zeile.
    """
    assert fee_aus_airbnb(
        {"fee_type": "PASS_THROUGH_PET_FEE", "amount": 0.0,
         "amount_type": "flat"}
    ) is None


def test_offline_gebuehr_geht_nicht_in_den_preis() -> None:
    """`offline: true` heißt: nicht über die Buchung eingezogen."""
    assert fee_aus_airbnb(
        {"fee_type": "PASS_THROUGH_CLEANING_FEE", "amount": 500.0,
         "amount_type": "flat", "offline": True}
    ) is None


def test_unbekannte_art_wird_nicht_geraten() -> None:
    """Wurzel 4: lieber keine Gebühr als eine erfundene Art."""
    assert fee_aus_airbnb(
        {"fee_type": "PASS_THROUGH_ETWAS_NEUES", "amount": 50.0,
         "amount_type": "flat"}
    ) is None


def test_prozent_landet_in_amount_nicht_in_percent() -> None:
    """Es gibt KEIN Feld `percent` — `amount` trägt beides.

    `normalize_fees` liest bei `mode: percent` ebenfalls `amount`
    (`_clean_percent(eintrag.get("amount"))`). Ein eigenes `percent`-Feld würde
    beim Speichern verworfen und der Satz stünde auf 0.
    """
    fee = fee_aus_airbnb(
        {"fee_type": "PASS_THROUGH_RESORT_FEE", "amount": 5,
         "amount_type": "percent", "charge_period": "PER_BOOKING",
         "charge_type": "PER_GROUP"}
    )
    assert fee is not None
    assert fee["mode"] == "percent"
    assert fee["amount"] == 5
    assert "percent" not in fee


def test_pet_kombination_ergibt_tier_basis() -> None:
    """PER_PET gibt es bei Airbnb nur an der Haustiergebühr — bei uns auch."""
    fee = fee_aus_airbnb(
        {"fee_type": "PASS_THROUGH_PET_FEE", "amount": 150.0,
         "amount_type": "flat", "charge_period": "PER_BOOKING",
         "charge_type": "PER_PET"}
    )
    assert fee is not None
    assert fee["basis"] == "per_pet_stay"


def test_alle_zielarten_sind_gueltige_gebuehrenarten() -> None:
    """Sonst wirft `normalize_fees` beim Speichern 422 — und der Import wäre tot.

    Genau daran wäre ein direkter Durchreichversuch gescheitert: Airbnbs
    `..._SHORT_TERM_CLEANING_FEE` heißt bei uns `short_term_cleaning`, nicht
    `short_term_cleaning_fee`.
    """
    for art in AIRBNB_FEE_AUF_ART.values():
        assert art in FEE_TYPES, art


def test_jede_zielart_traegt_eine_exportierbare_kategorie() -> None:
    """Jede importierte Art muss beim Export wieder an Airbnb gehen können.

    Sonst importierte man eine Gebühr, die danach an kein Portal mehr geht.
    """
    for unsere in AIRBNB_FEE_AUF_ART.values():
        kategorie = fee_category({"feeType": unsere})
        assert kategorie in FEE_CATEGORIES, (unsere, kategorie)
        assert kategorie in KATEGORIE_AUF_AIRBNB, (unsere, kategorie)


def test_der_kreis_ist_nicht_verlustfrei_und_das_ist_gewollt() -> None:
    """Fünf Airbnb-Arten kommen als `COMMUNITY_FEE` zurück, nicht als sie selbst.

    Airbnb trennt Strom, Wasser, Heizung, Klima und Nebenkosten; unsere
    Kategorie-Ebene fasst sie zu `community` zusammen
    (`gebuehren.FEE_TYPE_CATEGORY`). Beim Export landen sie deshalb alle unter
    `PASS_THROUGH_COMMUNITY_FEE`.

    Das ist eine bewusste Vergröberung und kein Fehler: die feine Art bleibt in
    `feeType` erhalten (Rechnung, Gastanzeige), nur das Portal sieht die
    Sammelkategorie. Der Test hält fest, WELCHE Arten das betrifft — wird die
    Kategorie-Tabelle geändert, muss man hier bewusst hinsehen.
    """
    vergroebert = {
        airbnb_art
        for airbnb_art, unsere in AIRBNB_FEE_AUF_ART.items()
        if KATEGORIE_AUF_AIRBNB[fee_category({"feeType": unsere})] != airbnb_art
    }
    assert vergroebert == {
        "PASS_THROUGH_ELECTRICITY_FEE",
        "PASS_THROUGH_WATER_FEE",
        "PASS_THROUGH_HEATING_FEE",
        "PASS_THROUGH_AIR_CONDITIONING_FEE",
        "PASS_THROUGH_UTILITY_FEE",
    }


def test_alle_basen_sind_gueltig() -> None:
    """Eine Basis außerhalb von `FEE_BASES` wäre ein 422 beim Speichern."""
    for roh in LIVE:
        fee = fee_aus_airbnb(roh)
        assert fee is not None
        assert fee["basis"] in FEE_BASES


def test_signatur_ignoriert_den_namen() -> None:
    """Derselbe Betrag unter anderem Namen ist dieselbe Gebühr.

    Airbnb liefert überhaupt keinen Namen — würde er zählen, meldete der
    Vergleich jede Gebühr als „fehlt", und jede Übernahme legte Doubletten an.
    """
    a = {"feeType": "cleaning_fee", "mode": "amount", "basis": "per_stay",
         "amount": 795.0, "name": "Reinigungsgebühr"}
    b = {**a, "name": "Endreinigung"}
    assert airbnb_fee_signatur(a) == airbnb_fee_signatur(b)


def test_signatur_trennt_verschiedene_betraege() -> None:
    """795 und 1150 sind zwei verschiedene Gebühren — sonst bliebe eine unsichtbar."""
    a = {"feeType": "cleaning_fee", "mode": "amount", "basis": "per_stay",
         "amount": 795.0}
    b = {**a, "amount": 1150.0}
    assert airbnb_fee_signatur(a) != airbnb_fee_signatur(b)


# --- Der Import ist EINMALIG (11.08.2026) ------------------------------------
#
# Unsere Plattform ist die Quelle für die Portale: was am Objekt steht, geht
# raus. Airbnbs Gebühren dürfen deshalb genau EINMAL als Starthilfe hereinkommen
# — danach ist das Angebot beendet.
#
# DER ANLASS: der Kasten „Bei Airbnb sind N weitere Gebühren hinterlegt" stand
# dauerhaft über der Preisseite und verglich BETRÄGE. Unser Objekt hatte 795 DKK
# Reinigung, Airbnb 1.590 DKK → Airbnbs galt als „fehlt uns", ein Klick legte
# eine ZWEITE Reinigungsgebühr an, und der Gast zahlte im Checkout beide.


def _airbnb_reinigung(betrag: float) -> dict:
    return {"feeType": "cleaning_fee", "mode": "amount", "basis": "per_stay",
            "amount": betrag, "name": "", "optional": False, "id": "a-1"}


def test_gleiche_art_mit_anderem_betrag_ist_nicht_uebernehmbar() -> None:
    from src.features.channel_manager.airbnb_gebuehren import _fehlende_arten

    unsere = [{"feeType": "cleaning_fee", "mode": "amount", "basis": "per_stay",
               "amount": 795.0, "name": "Reinigungsgebühr"}]
    # Airbnb führt dieselbe ART mit anderem Betrag → KEIN Vorschlag.
    assert _fehlende_arten([_airbnb_reinigung(1590.0)], unsere) == []


def test_fehlende_art_wird_vorgeschlagen() -> None:
    from src.features.channel_manager.airbnb_gebuehren import _fehlende_arten

    unsere = [{"feeType": "cleaning_fee", "amount": 795.0}]
    airbnb = [
        _airbnb_reinigung(1590.0),
        {"feeType": "pet_fee", "mode": "amount", "basis": "per_pet_stay",
         "amount": 150.0, "name": "", "optional": False, "id": "a-2"},
    ]
    vorschlag = _fehlende_arten(airbnb, unsere)
    assert [f["feeType"] for f in vorschlag] == ["pet_fee"]


def test_zwei_airbnb_eintraege_derselben_art_ergeben_einen_vorschlag() -> None:
    """Eine Art kommt an einem Objekt einmal vor — sonst legte ein Klick zwei
    Reinigungsgebühren an, nur weil Airbnb zwei Einträge führt."""
    from src.features.channel_manager.airbnb_gebuehren import _fehlende_arten

    airbnb = [_airbnb_reinigung(795.0), _airbnb_reinigung(1590.0)]
    vorschlag = _fehlende_arten(airbnb, [])
    assert len(vorschlag) == 1
    assert vorschlag[0]["amount"] == 795.0  # der erste gewinnt, nicht der größte


def test_art_ohne_kennung_wird_nicht_vorgeschlagen() -> None:
    """Ohne `feeType` ist nicht entscheidbar, ob wir sie schon haben →
    fail-closed, kein Vorschlag (Wurzel 5)."""
    from src.features.channel_manager.airbnb_gebuehren import _fehlende_arten

    assert _fehlende_arten([{"feeType": "", "amount": 10.0}], []) == []


def test_import_merker_erkennt_den_abgeschlossenen_lauf() -> None:
    from src.features.channel_manager.airbnb_gebuehren import (
        IMPORT_MERKER,
        _import_erledigt,
    )

    assert _import_erledigt({"type_attributes": {}}) is False
    # Ein leeres Merker-Objekt zählt NICHT als erledigt (unvollständig
    # geschrieben ist nicht dasselbe wie gelaufen).
    assert _import_erledigt({"type_attributes": {IMPORT_MERKER: {}}}) is False
    assert (
        _import_erledigt(
            {"type_attributes": {IMPORT_MERKER: {"erledigt_am": "2026-08-11T09:00:00Z"}}}
        )
        is True
    )
