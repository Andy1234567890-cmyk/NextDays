"""Airbnbs `standard_fees` in unsere Gebühren übersetzen — und zurück.

DER WEG, live verifiziert (05.08.2026, Konto AirSmil, 18 Listings):

    GET/PUT channels/{channel_id}/mappings/{mapping_id}/pricing_settings

`v2/pricing_settings/{listing_id}` ist TOT — Airbnb antwortet 403 „Endpoint is
no longer supported in this version, please migrate to new Pricing and
Availability APIs." Der bisherige Importweg (`airbnb_listing_import.
gebuehren_uebernehmen`) las deshalb ins Leere; das Feld `type_attributes.
airbnbGebuehren` blieb überall leer und wurde ohnehin nirgends gelesen.

WAS DIE 18 LISTINGS WIRKLICH LIEFERN (43 Gebühren, alle DKK):
    PASS_THROUGH_CLEANING_FEE   18×   795–1590   flat  PER_BOOKING PER_GROUP
    PASS_THROUGH_RESORT_FEE     15×   0 / 25     flat  PER_NIGHT   PER_GROUP
    PASS_THROUGH_PET_FEE        10×   0 / 150    flat  PER_BOOKING PER_GROUP

DER BETRAG IST KEINE CENT-ZAHL. Die Spezifikation
(`docs/OTA/Airbnb/Airbnb.ListingSettings.PricingSettings.yaml`, `Models.
StandardFee.amount`) sagt „in cents of the listing currency"; geliefert wird
aber die ganze Währungseinheit — 1150.0 für eine Reinigungsgebühr, die im
Extranet als „1.150 kr DKK" steht (Listing 1654285285861524234, Screenshot des
Betriebs). Würde man durch 100 teilen, stünden hier 11,50 kr. Deshalb wird der
Wert unverändert übernommen und NICHT umgerechnet.

DIE ABBILDUNG IST NICHT VERLUSTFREI, UND DAS IST BEABSICHTIGT:
Airbnb kennt 13 Gebührenarten, wir 49. Mehrere unserer Arten fallen auf
dieselbe Airbnb-Kategorie (`gebuehren.FEE_TYPE_CATEGORY`) — beim Import gibt es
also keinen eindeutigen Rückweg. Gewählt wird deshalb je Kategorie die
KANONISCHE Art, nicht geraten (Wurzel 4): `PASS_THROUGH_RESORT_FEE` wird
`resort`, nicht „vielleicht Pool oder Concierge".
"""
from __future__ import annotations

import uuid
from typing import Any

from src.features.properties.gebuehren import FEE_TYPE_LABEL

# Airbnbs Gebührenart → unsere kanonische Art (Wert aus `FEE_TYPE_CATEGORY`).
#
# Die Zielwerte sind bewusst die, deren Kategorie 1:1 auf Airbnbs Art fällt —
# `resort` → `resort`, `linens` → `linen`. Wo Airbnb feiner ist als unsere
# Kategorie (Strom/Wasser/Heizung/Klima fallen alle auf `community`), wird die
# passende EINZELART genommen: sie trägt die Information, und der Export legt
# sie ohnehin wieder auf die Kategorie zurück.
AIRBNB_FEE_AUF_ART: dict[str, str] = {
    "PASS_THROUGH_CLEANING_FEE": "cleaning_fee",
    "PASS_THROUGH_SHORT_TERM_CLEANING_FEE": "short_term_cleaning",
    "PASS_THROUGH_PET_FEE": "pet_fee",
    "PASS_THROUGH_RESORT_FEE": "resort",
    "PASS_THROUGH_COMMUNITY_FEE": "community",
    "PASS_THROUGH_MANAGEMENT_FEE": "management_fee",
    "PASS_THROUGH_LINEN_FEE": "linens",
    # Diese fünf kommen beim EXPORT als `PASS_THROUGH_COMMUNITY_FEE` zurück,
    # nicht als sie selbst: unsere Kategorie-Ebene fasst Strom, Wasser, Heizung,
    # Klima und Nebenkosten zu `community` zusammen
    # (`gebuehren.FEE_TYPE_CATEGORY`). Der Kreis ist an dieser Stelle bewusst
    # nicht verlustfrei — die feine Art bleibt in `feeType` und damit auf
    # Rechnung und Gastanzeige erhalten, nur das Portal sieht die
    # Sammelkategorie. Festgehalten in
    # `test_der_kreis_ist_nicht_verlustfrei_und_das_ist_gewollt`.
    "PASS_THROUGH_ELECTRICITY_FEE": "electricity",
    "PASS_THROUGH_WATER_FEE": "water",
    "PASS_THROUGH_HEATING_FEE": "heating",
    "PASS_THROUGH_AIR_CONDITIONING_FEE": "air_conditioning",
    "PASS_THROUGH_UTILITY_FEE": "community",
    "PASS_THROUGH_SECURITY_DEPOSIT": "security_deposit",
}

# `charge_type` × `charge_period` → unsere Basis.
#
# Airbnb führt zwei Achsen, wir eine mit vier Kombinationen (plus `per_pet_stay`
# an der Haustiergebühr). PER_PET gibt es bei Airbnb ausschliesslich für
# `PASS_THROUGH_PET_FEE` (Spec: „available exclusively for") — genau wie bei uns
# (`gebuehren.PET_BASIS_CATEGORIES`).
BASIS_AUS_AIRBNB: dict[tuple[str, str], str] = {
    ("PER_GROUP", "PER_BOOKING"): "per_stay",
    ("PER_GROUP", "PER_NIGHT"): "per_night",
    ("PER_PERSON", "PER_BOOKING"): "per_guest_stay",
    ("PER_PERSON", "PER_NIGHT"): "per_guest_night",
    ("PER_PET", "PER_BOOKING"): "per_pet_stay",
    # PER_PET + PER_NIGHT gibt es bei uns nicht (`per_pet_night` wäre erfunden);
    # Airbnb erlaubt die Kombination formal, der Standard nennt sie nirgends.
    # Sie fällt bewusst auf die Tier-Basis pro Aufenthalt zurück, statt den
    # Import an einem theoretischen Fall scheitern zu lassen.
    ("PER_PET", "PER_NIGHT"): "per_pet_stay",
}

# Rückrichtung für den Export: unsere Kategorie → Airbnbs Art. Die Kategorien
# stammen aus `gebuehren.FEE_CATEGORIES`; `security_deposit` ist dabei, geht
# aber über `ota_abgaben.NICHT_EXPORTIERBAR` nie raus.
KATEGORIE_AUF_AIRBNB: dict[str, str] = {
    "cleaning": "PASS_THROUGH_CLEANING_FEE",
    "short_term_cleaning": "PASS_THROUGH_SHORT_TERM_CLEANING_FEE",
    "pet": "PASS_THROUGH_PET_FEE",
    "resort": "PASS_THROUGH_RESORT_FEE",
    "community": "PASS_THROUGH_COMMUNITY_FEE",
    "management": "PASS_THROUGH_MANAGEMENT_FEE",
    "linen": "PASS_THROUGH_LINEN_FEE",
    "security_deposit": "PASS_THROUGH_SECURITY_DEPOSIT",
}

AIRBNB_PERIODE = {"per_stay": "PER_BOOKING", "per_night": "PER_NIGHT",
                  "per_guest_stay": "PER_BOOKING",
                  "per_guest_night": "PER_NIGHT",
                  "per_pet_stay": "PER_BOOKING"}
AIRBNB_TYP = {"per_stay": "PER_GROUP", "per_night": "PER_GROUP",
              "per_guest_stay": "PER_PERSON", "per_guest_night": "PER_PERSON",
              "per_pet_stay": "PER_PET"}


def fee_aus_airbnb(roh: dict[str, Any]) -> dict[str, Any] | None:
    """Eine Airbnb-Gebühr in unsere Form. None = nicht übernehmbar.

    Verworfen wird:
      * eine unbekannte Gebührenart — kein Ratewert (Wurzel 4),
      * ein Betrag von 0: Airbnb führt Gebühren mit 0 als „nicht erhoben"
        (live: `PASS_THROUGH_RESORT_FEE 0.0`, `PASS_THROUGH_PET_FEE 0.0`).
        Als Gebühr angelegt stünde bei uns eine 0-Zeile in jeder Rechnung.
      * `offline: true` — der Betrag wird nicht über die Buchung eingezogen und
        gehört damit nicht in unseren Preis.
    """
    art = AIRBNB_FEE_AUF_ART.get(str(roh.get("fee_type") or "").strip())
    if not art:
        return None
    if roh.get("offline") is True:
        return None
    try:
        betrag = float(roh.get("amount") or 0)
    except (TypeError, ValueError):
        return None
    if betrag <= 0:
        return None

    prozent = str(roh.get("amount_type") or "flat").lower() == "percent"
    schluessel = (
        str(roh.get("charge_type") or "PER_GROUP").upper(),
        str(roh.get("charge_period") or "PER_BOOKING").upper(),
    )
    basis = BASIS_AUS_AIRBNB.get(schluessel, "per_stay")
    name = FEE_TYPE_LABEL.get(art, art)
    fee: dict[str, Any] = {
        "id": str(uuid.uuid4()),
        "name": name,
        # Der Name geht an den Gast; Deutsch ist unsere Basissprache, die
        # übrigen 23 pflegt der Betrieb im Editor nach. Ein maschinell
        # übersetzter Gasttext wäre geraten.
        "names": {"de": name},
        "feeType": art,
        "mode": "percent" if prozent else "amount",
        "basis": basis,
        "optional": False,
    }
    # `amount` trägt BEIDES — bei `mode: percent` ist es der Prozentsatz, nicht
    # ein zweites Feld `percent`. So liest es `normalize_fees`
    # (`gebuehren.py`: `_clean_percent(eintrag.get("amount"))`) und so zeigt es
    # die Oberfläche (`feeSummary`). Ein eigenes `percent`-Feld würde beim
    # Speichern verworfen und der Betrag stünde auf 0.
    fee["amount"] = betrag
    return fee


def fees_aus_airbnb(standard_fees: list[Any] | None) -> list[dict[str, Any]]:
    """Airbnbs `standard_fees` in unsere Gebührenliste."""
    ergebnis = []
    for roh in standard_fees or []:
        if not isinstance(roh, dict):
            continue
        fee = fee_aus_airbnb(roh)
        if fee:
            ergebnis.append(fee)
    return ergebnis


def airbnb_fee_signatur(fee: dict[str, Any]) -> tuple[str, str, str, float]:
    """Was eine Gebühr für den Abgleich ausmacht: Art, Rechenart, Basis, Betrag.

    Der NAME zählt bewusst nicht: derselbe Betrag unter anderem Namen ist
    dieselbe Gebühr, und Airbnb liefert überhaupt keinen Namen.
    """
    mode = str(fee.get("mode") or "amount")
    # `amount` trägt auch den Prozentsatz — es gibt kein Feld `percent`.
    try:
        betrag = float(fee.get("amount") or 0)
    except (TypeError, ValueError):
        betrag = 0.0
    return (
        str(fee.get("feeType") or ""),
        mode,
        str(fee.get("basis") or "per_stay"),
        betrag,
    )
