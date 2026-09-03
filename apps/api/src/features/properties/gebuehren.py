"""Serverseitige Prüfung und Säuberung der Objekt-Gebühren.

Gegenstück zu `steuern.py`. Die Gebühren eines Objekts liegen als Liste im
Preis-Blob (`type_attributes.pricing.fees`) und werden von dort in
`property_pricing_config.fees` gespiegelt, vom Preis-Resolver gerechnet, auf die
Rechnung geschrieben und — seit dem Gebühren-Export — als `type: "fee"` an die
Portale gesendet. Bis dahin liefen sie ungeprüft durch: der Blob wurde
unverändert übernommen. Das ging, solange die Gebühr nur intern gerechnet wurde;
sobald sie das Haus verlässt, ist jedes Feld angreiferkontrollierter Input
(Wurzel 3).

* Gebührenart nur aus der erlaubten Liste — sie geht als Kategorie an die
  Portale (Wurzel 4: kein erfundener Ersatzwert, ungültige Eingabe schlägt fehl).
* Basis nur aus den vier bekannten Werten; sie bestimmt die Channex-`logic`.
* Kanal-Einschränkung nur mit bekannten Portal-Codes, sonst liefe die Gebühr
  ins Leere und niemand merkte es.
"""
from __future__ import annotations

from datetime import date
from typing import Any

import nh3
from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.supabase import load_scoped

from .booking_gebuehren import (
    arten_aus_buchungen as booking_arten_am_objekt,
)
from .booking_gebuehren import (
    fehlende_gebuehren as booking_fehlende_gebuehren,
)
from .booking_gebuehren import (
    zugeordnete_arten as booking_zugeordnete_arten,
)
from .booking_gebuehren import (
    zuordnung_nachziehen as booking_zuordnung_nachziehen,
)
from .errors import PropertyError
from .schemas import PropertyUpdate

log = get_logger("nextdays.properties.gebuehren")

# Gebührenarten → Airbnb-Gebührenkategorie.
#
# Die feine Art wählt der Betrieb (Klimaanlage, Whirlpool, Parken …); die
# KATEGORIE entscheidet, was beim Portal ankommt und ob überhaupt. Mehrere feine
# Arten fallen auf dieselbe Airbnb-Kategorie und werden dort zu EINER Gebühr
# zusammengefasst (siehe channel_manager/ota_abgaben.py).
#
# HERKUNFT DER LISTE: die 49 Werte sind LIVE aus dem Branchenstandard abgelesen
# (Lodgify, Gebühren-Editor `/pricing/<id>/fee/<id>`, Auswahlfeld
# „Gebührenart", 03.08.2026) — nicht aus dem Hilfe-Artikel abgeschrieben. Die
# Zuordnung auf die Airbnb-Kategorie steht im Artikel „Taxes and Fees applied in
# OTAs" (Fußnoten 1–4 + Fee-mapping-Tabelle, englisches Original 27.07.2026).
# Wo beides auseinanderfällt, gewinnt das gemessene Produkt:
#   * `community` und `misc_charges` sind wählbar, stehen aber NICHT in der
#     Artikel-Tabelle. `community` ist die Kategorie selbst; `misc_charges` hat
#     dort keine Airbnb-Kategorie → None (nicht übertragbar), kein geratenes Ziel.
#   * `security_deposit` steht in der Zuordnungstabelle („Kaution →
#     SecurityDeposit"), war im Produkt live nicht im Auswahlfeld. Der Artikel
#     ist die verbindliche Quelle → wählbar, mit eigener Kategorie. Exportiert
#     wird sie trotzdem nicht: die Export-Tabelle (Kategorie × Modell) führt
#     keine Zeile für die Kaution, und Channex kennt nur tax|fee|city_tax —
#     eine Kaution als „fee" wäre ein Aufschlag, der nie zurückgeht.
#   * `short_term_cleaning` steht als eigene Zeile der Export-Tabelle
#     („Short-term cleaning (Flat amount)": nur einmalig pro Aufenthalt) und ist
#     deshalb eine eigene Kategorie — NICHT `cleaning`, sonst würden Reinigung
#     und Kurzzeitreinigung zu einer Gebühr summiert, die die Tabelle getrennt
#     führt.
#
# `unknown` ist bewusst dabei und bewusst OHNE Kategorie (None): eine Gebühr
# ohne Art geht an kein Portal — kein erfundenes „ist bestimmt Reinigung"
# (Wurzel 4). Altbestand ohne `feeType` wird genauso behandelt.
FEE_TYPE_CATEGORY: dict[str, str | None] = {
    # → Gemeinschaftsgebühr (CommunityFee)
    "additional_bed": "community",
    "air_conditioning": "community",
    "baby_bed": "community",
    "community": "community",
    "electricity": "community",
    "equipment": "community",
    "gas": "community",
    "heating": "community",
    "internet": "community",
    "parking": "community",
    "spa": "community",
    "toiletries": "community",
    "utensils_cleaning": "community",
    "water": "community",
    "wood": "community",
    # → Verwaltungsgebühr (ManagementFee)
    "class": "management",
    "drinking_water": "management",
    "food_utensils": "management",
    "gardening": "management",
    "hot_tub": "management",
    "laundry": "management",
    "management_fee": "management",
    "oil": "management",
    "on_site_payment_method": "management",
    "water_craft": "management",
    "water_craft_mooring": "management",
    # → Resortgebühr (ResortFee)
    "concierge": "resort",
    "damage_protection_insurance": "resort",
    "food": "resort",
    "high_chair": "resort",
    "labor": "resort",
    "phone": "resort",
    "pool": "resort",
    "pool_heating": "resort",
    "property_association": "resort",
    "rent": "resort",
    "resort": "resort",
    "service_fee": "resort",
    "tour": "resort",
    "transportation": "resort",
    "travel_insurance": "resort",
    "vehicle": "resort",
    # → Wäschegebühr (LinenFee)
    "linens": "linen",
    "linens_bath": "linen",
    "linens_bed": "linen",
    # → eigene Kategorien (1:1)
    "pet_fee": "pet",
    "cleaning_fee": "cleaning",
    "short_term_cleaning": "short_term_cleaning",
    "security_deposit": "security_deposit",
    # → nicht übertragbar (keine Airbnb-Kategorie)
    "misc_charges": None,
    "unknown": None,
}
# Gültig, aber nicht (mehr) anzubieten.
#
# `linen`/`management`/`pet`/`cleaning`/`other` sind unsere eigenen Bestands-
# schlüssel aus der Zeit vor der vollen Taxonomie. Sie bleiben gültig, damit ein
# Objekt mit alter Gebühr speicherbar bleibt — sonst wirft jedes Speichern 422,
# auch beim Ändern der Beschreibung. Das Auswahlfeld zeigt nur die Werte oben.
FEE_TYPE_ALTBESTAND: dict[str, str | None] = {
    "cleaning": "cleaning",
    "pet": "pet",
    "management": "management",
    "linen": "linen",
    "other": None,
}
FEE_TYPES = frozenset(FEE_TYPE_CATEGORY) | frozenset(FEE_TYPE_ALTBESTAND)

# Bezeichnung der Gebührenart im Auswahlfeld — live aus dem Branchenstandard
# abgelesen (03.08.2026), damit dieselbe Art dieselbe Bezeichnung trägt.
#
# Nur Deutsch, wie bei der Objekt-Taxonomie (`property_subtypes.label_de`, 0198):
# eine Fachtaxonomie, die AUSSCHLIESSLICH der Betrieb im PMS auswählt. Der Gast
# sieht nie diesen Wert, sondern den frei gewählten Namen der Gebühr. Die Liste
# gehört deshalb NICHT in die 24-sprachigen Message-Dateien, sondern kommt über
# `GET /properties/fee-types` aus dieser einen Quelle.
FEE_TYPE_LABEL: dict[str, str] = {
    "additional_bed": "Zusätzliches Bett",
    "air_conditioning": "Klimaanlage",
    "baby_bed": "Babybett",
    "community": "Gemeinschaftsgebühr",
    "electricity": "Elektrizität",
    "equipment": "Ausstattung",
    "gas": "Gas",
    "heating": "Heizung",
    "internet": "Internet",
    "parking": "Parkmöglichkeit",
    "spa": "Spa",
    "toiletries": "Hygieneartikel",
    "utensils_cleaning": "Putzutensilien",
    "water": "Wasser",
    "wood": "Holz",
    "class": "Kurs",
    "drinking_water": "Trinkwasser",
    "food_utensils": "Kochutensilien",
    "gardening": "Gartenarbeiten",
    "hot_tub": "Whirlpool",
    "laundry": "Wäscheservice",
    "management_fee": "Verwaltungsgebühr",
    "oil": "Öl",
    "on_site_payment_method": "Zahlungsmethode vor Ort",
    "water_craft": "Wasserfahrzeug",
    "water_craft_mooring": "Anlegeplatz",
    "concierge": "Concierge",
    "damage_protection_insurance": "Kaution",
    "food": "Lebensmittel",
    "high_chair": "Babystuhl",
    "labor": "Aufwand",
    "phone": "Telefon",
    "pool": "Pool",
    "pool_heating": "Beheizter Pool",
    "property_association": "Immobilienverband",
    "rent": "Miete",
    "resort": "Resort",
    "service_fee": "Servicegebühr",
    "tour": "Tour",
    "transportation": "Entfernungen",
    "travel_insurance": "Reiseversicherung",
    "vehicle": "Fahrzeug",
    "linens": "Bettwäsche",
    "linens_bath": "Handtücher",
    "linens_bed": "Bettwäsche (Bett)",
    "pet_fee": "Haustiergebühr",
    "cleaning_fee": "Reinigungsgebühr",
    "short_term_cleaning": "Kurzzeitreinigung",
    # „Kaution" allein wäre doppeldeutig: `damage_protection_insurance` trägt
    # diese Bezeichnung bereits (live abgelesen) und geht als Resortgebühr raus.
    "security_deposit": "Kaution (Sicherheitsleistung)",
    "misc_charges": "Sonstige Gebühren",
    "unknown": "Unbekannt",
}


def fee_type_katalog() -> list[dict[str, str | None]]:
    """Die wählbaren Gebührenarten mit Bezeichnung und Airbnb-Kategorie.

    Alphabetisch nach Bezeichnung — so führt der Branchenstandard sein
    Auswahlfeld, und bei 49 Einträgen ist das die einzige Ordnung, in der man
    etwas findet. Bestandsschlüssel sind NICHT dabei: sie bleiben gültig, aber
    neu wählbar ist nur die geprüfte Taxonomie.
    """
    return sorted(
        (
            {
                "value": art,
                "label": FEE_TYPE_LABEL[art],
                "category": kategorie,
            }
            for art, kategorie in FEE_TYPE_CATEGORY.items()
        ),
        key=lambda eintrag: str(eintrag["label"]),
    )


def fee_category(fee: dict[str, Any]) -> str | None:
    """Airbnb-Gebührenkategorie einer Gebühr; `None` = geht an kein Portal.

    Eine Gebühr ohne `feeType` (Altbestand) ist „Unknown" und damit ohne
    Kategorie — nicht „irgendwas" (Wurzel 4).
    """
    art = str(fee.get("feeType") or "").strip()
    if not art:
        return None
    if art in FEE_TYPE_CATEGORY:
        return FEE_TYPE_CATEGORY[art]
    return FEE_TYPE_ALTBESTAND.get(art)


# Die Airbnb-Kategorien selbst (Zielwerte oben). `security_deposit` ist Airbnbs
# „SecurityDeposit"; sie ist keine Gebühr im Preis, sondern eine Kaution.
FEE_CATEGORIES = frozenset(
    {"community", "management", "resort", "linen", "pet", "cleaning",
     "short_term_cleaning", "security_deposit"}
)

# Berechnungsbasis („calculation model" der Export-Tabelle); bestimmt die
# Channex-`logic` (siehe channel_manager.tax_sync `_FEE_LOGIC`). Gegenstück:
# FeeBasis in web/lib/pricing-meta.ts.
#
# Im Branchenstandard sind das zwei Auswahlfelder — „Einmaliger Betrag | Pro
# Gast" × „Pro Aufenthalt | Pro Nacht" (live abgelesen). Wir führen die vier
# Kombinationen als EINEN Wert, weil genau vier möglich sind und die
# Channex-`logic` ohnehin die Kombination braucht.
#
# `per_pet_stay` ist die fünfte: „pro Tier und Aufenthalt". Der Standard nennt
# sie ausdrücklich an der Haustiergebühr („can also be configured per pet per
# stay") und nur dort — deshalb gibt es kein `per_pet_night`, das wäre erfunden.
# Sie multipliziert mit `reservations.pets`; an die Portale geht sie als
# Pauschale pro Aufenthalt (kein Portal überträgt eine Tierzahl vorab).
FEE_BASES = frozenset(
    {"per_stay", "per_night", "per_guest_stay", "per_guest_night", "per_pet_stay"}
)
# Die Tier-Basis ergibt nur bei der Haustiergebühr Sinn: eine „Reinigung pro
# Tier" wäre eine Zahl ohne Bedeutung. Serverseitig erzwungen (Wurzel 3).
PET_BASIS = "per_pet_stay"
PET_BASIS_CATEGORIES = frozenset({"pet"})

# Rechenart der Gebühr. Prozentuale Gebühren („Resort fee: 5 %") sind für
# Booking.com sogar die EINZIGEN, die exportiert werden — ohne diese Achse
# ließe sich der Branchenstandard nicht abbilden.
#
# Live abgelesener Hinweis am Prozent-Feld: „Gebühr wird als einmalige Gebühr
# berechnet, wenn sie prozentual basiert ist, und richtet sich nach dem
# Zimmerpreis einschließlich Promotions." Prozent ist also IMMER einmalig auf
# den Zimmerpreis; die Berechnungsfelder verschwinden dort. Deshalb multipliziert
# `basis` bei `percent` nichts (pricing/resolver._fee_amount) — sie bleibt aber
# gespeichert, weil die Airbnb-Export-Matrix sie auswertet.
FEE_MODES = frozenset({"amount", "percent"})

# Steuerbemessungsgrundlage: worauf eine prozentuale lokale Steuer erhoben
# werden kann. Live abgelesen (Pflicht-Mehrfachauswahl im Steuer-Editor des
# Branchenstandards, 03.08.2026): der Grundpreis plus die sechs von Airbnb
# unterstützten Gebührenkategorien. `security_deposit` ist NICHT dabei.
#
# Bezug ist die KATEGORIE, nicht die einzelne Gebühr: mehrere Gebührenarten
# fallen auf dieselbe Airbnb-Kategorie und werden dort zu einer Gebühr — eine
# Grundlage „genau diese eine Gebühr" gäbe es beim Portal also gar nicht.
TAXABLE_BASE_PRICE = "base_price"
TAXABLE_BASE_CATEGORIES = frozenset(
    {"cleaning", "linen", "resort", "management", "community", "pet"}
)
TAXABLE_BASE_ITEMS = TAXABLE_BASE_CATEGORIES | {TAXABLE_BASE_PRICE}

# Eigene Buchungsstrecken, auf die eine Gebühr/Steuer ebenfalls eingeschränkt
# werden kann — zusätzlich zu den verbundenen Portalen.
#
# Der Branchenstandard führt seine eigene Buchungsstrecke im
# Einschränkungs-Dialog als gleichrangige Auswahl neben Airbnb und Booking.com
# (live abgelesen: Checkboxen „Lodgify · Airbnb · Booking.com"). Bei uns sind das
# ZWEI: die eigene Website/Direktbuchung und der Marktplatz myBestDays — das
# sind laut Datenmodell eigene Vertriebskanäle, kein „Direkt" in einem Topf.
# Die Codes sind bewusst die, die auch in Reservierungen/Quotes stehen
# (`channel`), damit der Preis-Resolver dieselbe Einschränkung lesen kann.
EIGENE_KANAELE = frozenset({"direct", "portal"})

_NAME_MAX = 255
_AMOUNT_MAX = 1_000_000.0

# Beschreibung ist internes Rich-Text (fett/kursiv/unterstrichen/durchgestrichen).
# Keine Links, keine Bilder, keine Attribute — der Text braucht nichts davon, und
# was nicht erlaubt ist, kann auch nicht missbraucht werden (Wurzel 8: Allowlist-
# Parser, nie Regex).
#
# Liegt HIER und nicht in steuern.py, obwohl die Steuern sie zuerst brauchten:
# gebuehren.py ist die untere Schicht (steuern.py importiert daraus, nicht
# umgekehrt). Eine zweite Kopie in gebuehren.py wäre die dritte Wahrheit über
# erlaubtes HTML — genau das, was Wurzel 4 verbietet.
_DESC_TAGS = {"b", "strong", "i", "em", "u", "s", "strike", "p", "br"}
_DESC_MAX = 5000


def clean_description(raw: object) -> str | None:
    """Internes Rich-Text säubern; `None`, wenn nichts übrig bleibt."""
    if raw is None:
        return None
    text = str(raw)
    if not text.strip():
        return None
    if len(text) > _DESC_MAX:
        raise PropertyError(
            f"Beschreibung zu lang (höchstens {_DESC_MAX} Zeichen).",
            status_code=422,
        )
    cleaned = nh3.clean(text, tags=_DESC_TAGS, attributes={}, url_schemes=set())
    return cleaned or None


def clean_names(raw: object) -> dict[str, str]:
    """Gastseitige Namen je Sprache. Leere Werte fliegen raus, damit ein
    ungefüllter Sprach-Tab nicht als „Name = leer" beim Portal landet.

    Liegt HIER, nicht in steuern.py, obwohl die Steuer sie zuerst brauchte:
    gebuehren.py ist die untere Schicht (steuern.py importiert daraus, nicht
    umgekehrt) — und die Gebühr trägt denselben mehrsprachigen Namen. Eine
    Kopie je Posten wäre die zweite Wahrheit über Länge und Leerbehandlung.
    """
    if not isinstance(raw, dict):
        return {}
    namen: dict[str, str] = {}
    for locale, value in raw.items():
        if not isinstance(locale, str) or not isinstance(value, (str, int, float)):
            continue
        text = str(value).strip()[:_NAME_MAX]
        if text:
            namen[locale[:10]] = text
    return namen


def _clean_amount(raw: object) -> float:
    try:
        value = float(raw if raw is not None else 0)
    except (TypeError, ValueError) as exc:
        raise PropertyError("Gebührenbetrag ist keine Zahl.", status_code=422) from exc
    if value < 0:
        raise PropertyError(
            "Gebührenbetrag darf nicht negativ sein.", status_code=422
        )
    if value > _AMOUNT_MAX:
        raise PropertyError("Gebührenbetrag ist unplausibel hoch.", status_code=422)
    return value


def _clean_percent(raw: object) -> float:
    """Prozentsatz einer prozentualen Gebühr. Über 100 % ist kein Aufschlag mehr,
    sondern ein Tippfehler — Channex lehnt `rate > 100` bei `logic: percent`
    ohnehin ab, also hier schon klar fehlschlagen statt beim Sync."""
    try:
        value = float(raw if raw is not None else 0)
    except (TypeError, ValueError) as exc:
        raise PropertyError("Gebührensatz ist keine Zahl.", status_code=422) from exc
    if not 0 <= value <= 100:
        raise PropertyError(
            "Gebührensatz muss zwischen 0 und 100 liegen.", status_code=422
        )
    return value


def _clean_date(raw: object, *, feld: str) -> str | None:
    """ISO-Datum einer Gebühren-Grenze, oder ``None`` wenn keine gesetzt ist.

    Ein unlesbares Datum ist ein Fehler, kein „keine Grenze": sonst gälte die
    Gebühr plötzlich unbegrenzt, obwohl der Betrieb eine Grenze eingetragen hat
    (Wurzel 5 — fail-closed).
    """
    if raw is None or not str(raw).strip():
        return None
    try:
        return date.fromisoformat(str(raw).strip()).isoformat()
    except ValueError as exc:
        raise PropertyError(
            f"Gebühren-Datum „{feld}“ ist kein Datum: {raw}", status_code=422
        ) from exc


def hat_zeitraum(fee: dict[str, Any]) -> bool:
    """Trägt die Gebühr eine Gültigkeitsgrenze (``validFrom``/``validUntil``)?"""
    return bool(fee.get("validFrom") or fee.get("validUntil"))


def gebuehr_gilt_am(fee: dict[str, Any], tag: date | None) -> bool:
    """Gilt die Gebühr für eine Buchung mit Anreise ``tag``?

    Beide Grenzen inklusiv, fehlende Grenze = offen. Die Achse ist die ANREISE,
    nicht das Buchungsdatum: eine Gebühr „ab 01.08." meint Aufenthalte ab dann.

    ``tag=None`` bei gesetzter Grenze heißt „nicht beurteilbar" und ergibt
    ``False`` — eine Gebühr, deren Bedingung niemand prüfen kann, wird nicht
    angesetzt (Wurzel 4: kein Geld aus einer ungeprüften Annahme). Ohne Grenze
    gilt sie immer, auch ohne Datum.
    """
    if not hat_zeitraum(fee):
        return True
    if tag is None:
        return False
    von = fee.get("validFrom")
    bis = fee.get("validUntil")
    if von and tag < date.fromisoformat(str(von)):
        return False
    return not (bis and tag > date.fromisoformat(str(bis)))


def _clean_tax_rate(raw: object) -> float | None:
    """Eigener USt-Satz der Gebühr. None = Übernachtungssatz des Objekts."""
    if raw is None or raw == "":
        return None
    try:
        value = float(raw)
    except (TypeError, ValueError) as exc:
        raise PropertyError("Steuersatz ist keine Zahl.", status_code=422) from exc
    if not 0 <= value <= 100:
        raise PropertyError(
            "Steuersatz muss zwischen 0 und 100 liegen.", status_code=422
        )
    return value


def sync_pricing_config(
    db: Client, tenant_id: str, property_id: str, pricing: dict
) -> None:
    """Pricing-Blob → property_pricing_config (vom Preis-Resolver gelesen).

    Schreibt die strukturierten Felder per Upsert. Fehlende Felder bleiben auf
    den Spalten-Defaults (kein erfundener Wert). Best-effort — ein Fehler hier
    darf das Speichern des Objekts nicht kippen (Realtime/Resolver greifen beim
    nächsten Speichern erneut).

    Liegt bei den Gebühren, weil `fees`/`taxes` den fachlichen Kern dieser
    Spiegelung bilden — und weil properties/service.py sonst über die
    1500-Zeilen-Grenze läuft.
    """
    try:
        row = {
            "property_id": property_id,
            "tenant_id": tenant_id,
            "custom_by_weekday": bool(pricing.get("customByWeekday")),
            "weekday_prices": pricing.get("weekdayPrices") or {},
            "extra_guest_charge": pricing.get("extraGuestCharge") or 0,
            "extra_guest_from": pricing.get("extraGuestFrom") or 1,
            "short_stay_max_nights": pricing.get("shortStayMaxNights") or 0,
            "short_stay_surcharge": pricing.get("shortStaySurcharge") or 0,
            "length_prices": pricing.get("lengthPrices") or [],
            "fees": pricing.get("fees") or [],
            "taxes": pricing.get("taxes") or [],
            "promotions": pricing.get("promotions") or [],
            # Beide Spalten sind TOT und werden vom Resolver nicht gelesen: die
            # Aktionen liegen seit 0276 in `property_discounts`, die Extras im
            # addons-Slice (`property_addons`, 0074/0075). Der Blob trägt sie
            # nicht mehr, die Spalten laufen also auf [] leer. Sie bleiben
            # stehen, damit Altbestand lesbar bleibt — wer hier etwas hinein
            # schreibt, baut die Attrappe wieder auf.
            "add_ons": pricing.get("addOns") or [],
        }
        # Währung nur setzen, wenn explizit übergeben — kein EUR erfinden
        # (Wurzel 4). Fehlt sie, greift bei Insert der Spalten-Default bzw. der
        # bestehende Wert bleibt bei Update erhalten.
        if pricing.get("currency"):
            row["currency"] = pricing["currency"]
        db.table("property_pricing_config").upsert(
            row, on_conflict="property_id"
        ).execute()
    except Exception as exc:  # noqa: BLE001 — Spiegelung darf Speichern nicht kippen
        log.warning(
            "pricing_config_sync_failed", property_id=property_id, error=str(exc)
        )


def laengenpreise_geaendert(alte_attrs: dict, changes: dict) -> bool:
    """Haben sich die Preise nach Aufenthaltsdauer geändert?

    Entscheidet, ob die Airbnb-Rabattregeln nachgezogen werden müssen: ein
    Wochen-/Monatspreis IST ein Längenrabatt und geht als
    `STAYED_AT_LEAST_X_DAYS` raus (channel_manager/airbnb_aktionen.py).

    Bewusst KONSERVATIV: ist der Alt-Stand nicht ladbar, gilt „geändert" und der
    Job läuft. Ein Job zu viel kostet zwei Channex-Calls; ein ausgelassener ließe
    bei Airbnb einen Rabatt stehen, den es nicht mehr gibt (Wurzel 1).

    Liegt hier und nicht in service.py — aus demselben Grund wie
    `sync_pricing_config`: das Modul läuft sonst über die 1500-Zeilen-Grenze.
    """
    neu_attrs = changes.get("type_attributes")
    if not isinstance(neu_attrs, dict):
        return False
    if not isinstance(alte_attrs, dict):
        return True

    def _liste(attrs: dict[str, Any]) -> object:
        pricing = attrs.get("pricing")
        if not isinstance(pricing, dict):
            return []
        return pricing.get("lengthPrices") or []

    return _liste(alte_attrs) != _liste(neu_attrs)


def erlaubte_portale(
    db: Client, tenant_id: str, property_id: str
) -> frozenset[str] | None:
    """Portal-Codes, auf die eine Steuer/Gebühr dieses Objekts eingeschränkt
    werden darf: die für das Objekt WIRKLICH verbundenen Kanäle.

    Absichtlich nicht der volle Channex-Katalog: eine Einschränkung auf ein
    Portal, das gar nicht verbunden ist, wäre wirkungslos und würde in der
    Oberfläche Sicherheit vortäuschen (Wurzel 4 — keine erfundene Auswahl).

    `None` heißt „Liste nicht ladbar" und ist NICHT dasselbe wie „keine
    verbundenen Portale": bei einem DB-Aussetzer würde ein leeres Set jede
    bestehende Einschränkung als unbekanntes Portal abweisen — der Betrieb
    könnte dann am Objekt nichts mehr speichern, auch keine Beschreibung, weil
    das Formular den ganzen Preis-Blob zurücksendet. Bei `None` bleiben
    vorhandene Codes deshalb unverändert stehen (siehe `clean_portal_scope`);
    geprüft wird erst wieder, wenn die Liste wirklich vorliegt.
    """
    try:
        rows = (
            db.table("channex_channel_connection")
            .select("ota_portal_code")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .execute()
        ).data or []
    except Exception as exc:  # noqa: BLE001 — siehe Docstring
        log.warning(
            "erlaubte_portale_nicht_ladbar",
            property_id=property_id,
            error=str(exc),
        )
        return None
    return frozenset(
        str(r["ota_portal_code"]) for r in rows if r.get("ota_portal_code")
    )


def clean_portal_scope(
    raw: object, *, erlaubt: frozenset[str] | None
) -> list[str]:
    """Kanal-Einschränkung säubern; leere Liste = alle Kanäle.

    Ein unbekannter Portal-Code ist ein Fehler, kein stilles Verwerfen: sonst
    stünde in der Oberfläche „nur an Booking", und gesendet würde an alle
    (Wurzel 5 — fail-closed statt still danebenliegen).

    `erlaubt=None` (Portalliste nicht ladbar) übernimmt die Codes ungeprüft:
    ein DB-Aussetzer darf nicht dazu führen, dass das Objekt unspeicherbar wird.
    Der Sync ignoriert eine Einschränkung auf ein nicht verbundenes Portal
    ohnehin — der Schaden ist also begrenzt, das Blockieren wäre größer.
    """
    if raw is None:
        return []
    if not isinstance(raw, list):
        raise PropertyError("Kanal-Einschränkung ist keine Liste.", status_code=422)
    codes: list[str] = []
    for eintrag in raw:
        code = str(eintrag).strip()
        if not code:
            continue
        if (
            erlaubt is not None
            and code not in erlaubt
            and code not in EIGENE_KANAELE
        ):
            raise PropertyError(f"Unbekanntes Portal: {code}", status_code=422)
        if code not in codes:  # Reihenfolge behalten, Dubletten weg
            codes.append(code)
    return codes


def normalize_fees(
    raw_fees: list[Any], *, portale: frozenset[str] | None
) -> list[dict[str, Any]]:
    """Gebührenliste prüfen und säubern; wirft PropertyError(422) bei Unsinn."""
    fees: list[dict[str, Any]] = []
    gesehene_ids: set[str] = set()
    for eintrag in raw_fees:
        if not isinstance(eintrag, dict):
            continue
        fee_id = str(eintrag.get("id") or "").strip()
        if not fee_id:
            raise PropertyError("Gebühr ohne Kennung.", status_code=422)
        # Doppelte Kennungen brächen die Steuerbemessungsgrundlage: dort werden
        # Gebühren über ihre ID referenziert, zwei gleiche wären mehrdeutig.
        if fee_id in gesehene_ids:
            raise PropertyError(
                f"Gebühr {fee_id} ist doppelt vorhanden.", status_code=422
            )
        gesehene_ids.add(fee_id)

        basis = str(eintrag.get("basis") or "per_stay")
        if basis not in FEE_BASES:
            raise PropertyError(f"Unbekannte Gebühren-Basis: {basis}", status_code=422)

        # Altbestand hat kein `mode` — das waren ausschließlich Beträge.
        mode = str(eintrag.get("mode") or "amount")
        if mode not in FEE_MODES:
            raise PropertyError(f"Unbekannte Gebühren-Rechenart: {mode}", status_code=422)

        name = str(eintrag.get("name") or "").strip()[:_NAME_MAX]
        if not name:
            raise PropertyError("Gebühr braucht einen Namen.", status_code=422)

        # Gastseitiger Name je Sprache — dieselbe Achse wie bei der lokalen
        # Steuer. Die Gebühr steht in der Preisaufschlüsselung des Gastes; ohne
        # Übersetzung liest ein dänischer Gast „Reinigungsgebühr". Der interne
        # `name` bleibt daneben stehen (Listen, Bestands-Rechnungen).
        namen = clean_names(eintrag.get("names"))

        betrag = (
            _clean_percent(eintrag.get("amount"))
            if mode == "percent"
            else _clean_amount(eintrag.get("amount"))
        )
        sauber: dict[str, Any] = {
            "id": fee_id,
            "name": name,
            "amount": betrag,
            "mode": mode,
            "basis": basis,
            "optional": bool(eintrag.get("optional")),
        }
        if namen:
            sauber["names"] = namen

        satz = _clean_tax_rate(eintrag.get("taxRate"))
        if satz is not None:
            sauber["taxRate"] = satz
            # Steckt der Satz schon im Betrag oder kommt er obendrauf? Der
            # Branchenstandard fragt es genau hier (Auswahlfeld unter dem
            # USt-Satz der Gebühr: „Preis inkl. Umsatz-/MwSt." vs. „Der Preis
            # enthält keine Umsatzsteuer / MwSt.", live abgelesen 03.08.2026).
            #
            # Standard ist INKLUSIVE — das war das bisherige Verhalten (die
            # Rechnung zerlegt jeden Zeilenbetrag als Brutto, siehe
            # buchhaltung/reservation_invoice._split_gross). Ein anderer Default
            # würde alle Bestandsgebühren stillschweigend teurer machen.
            sauber["taxIncluded"] = bool(eintrag.get("taxIncluded", True))

        # „Nur für Kurzaufenthalte": dieselbe Grenze, die den
        # Kurzaufenthalts-Aufschlag steuert (`shortStayMaxNights`) — nicht eine
        # zweite Zahl an der Gebühr. Zwei Definitionen von „kurz" in einem
        # Objekt wären der Widerspruch, den niemand auflösen kann.
        if bool(eintrag.get("shortStayOnly")):
            sauber["shortStayOnly"] = True

        # Gültigkeit nach ANREISE („gilt ab" / „gilt bis", inklusiv, je optional).
        # Anlass (02.09.2026): die Resort-Gebühr des Beta-Betriebs gibt es erst
        # seit dem 01.08.2026 — ohne Zeitraum trug die Abrechnung sie in 98
        # Buchungen davor aus den Stammdaten nach. Kein Portal kennt eine
        # Datumsbedingung; eine Gebühr mit Zeitraum geht deshalb an kein Portal
        # (ota_abgaben), genau wie `shortStayOnly`.
        gilt_ab = _clean_date(eintrag.get("validFrom"), feld="validFrom")
        gilt_bis = _clean_date(eintrag.get("validUntil"), feld="validUntil")
        if gilt_ab and gilt_bis and gilt_bis < gilt_ab:
            raise PropertyError(
                "Gebühr: „gilt bis“ liegt vor „gilt ab“.", status_code=422
            )
        if gilt_ab:
            sauber["validFrom"] = gilt_ab
        if gilt_bis:
            sauber["validUntil"] = gilt_bis

        # „Nur in der Eigentümer-Abrechnung": dem Gast nirgends berechnet (kein
        # Angebot, kein Portal), aber in Abrechnung/Auswertung/Eigentümer-Portal
        # aus den Stammdaten angesetzt. Eine interne Abrechnungsgröße, kein
        # Gastpreis.
        if bool(eintrag.get("ownerStatementOnly")):
            sauber["ownerStatementOnly"] = True

        # Interne Beschreibung. Sie stand im Editor und im Frontend-Typ, wurde
        # hier aber nie in `sauber` übernommen — jedes Speichern hat sie also
        # stillschweigend verworfen (der Betrieb tippt einen Text, der beim
        # nächsten Öffnen weg ist). Allowlist-gesäubert wie bei der Steuer.
        beschreibung = clean_description(eintrag.get("descriptionHtml"))
        if beschreibung is not None:
            sauber["descriptionHtml"] = beschreibung

        # Gebührenart: Altbestand hat sie nicht. Fehlt sie, bleibt sie weg —
        # der Export liest dann "other". Ein gesetzter Wert muss aber stimmen.
        art = eintrag.get("feeType")
        if art is not None and str(art).strip():
            if str(art) not in FEE_TYPES:
                raise PropertyError(f"Unbekannte Gebührenart: {art}", status_code=422)
            sauber["feeType"] = str(art)

        # „Pro Tier und Aufenthalt" gibt es nur an der Haustiergebühr; sonst
        # multiplizierte eine Zahl, die mit der Leistung nichts zu tun hat.
        if basis == PET_BASIS and fee_category(sauber) not in PET_BASIS_CATEGORIES:
            raise PropertyError(
                "„Pro Tier und Aufenthalt“ gibt es nur für die Haustiergebühr.",
                status_code=422,
            )

        scope = clean_portal_scope(eintrag.get("portalScope"), erlaubt=portale)
        if scope:
            sauber["portalScope"] = scope

        fees.append(sauber)
    return fees


def fee_signatur(fee: dict[str, Any]) -> str:
    """Fachliche Identität einer Gebühr — ohne ihre Kennung.

    Dieselbe Gebühr steht auf jedem Objekt, dem sie zugewiesen wurde, als
    EIGENER Eintrag mit EIGENER `id` (der Preis-Blob hängt am Objekt, es gibt
    keine gemeinsame Gebühren-Tabelle). In der Auswahlliste soll die
    „Reinigungsgebühr 955 kr" trotzdem EINMAL erscheinen und nicht achtmal —
    also wird über die fachlichen Felder gebündelt, nicht über die Kennung.

    Der Name ist Teil der Signatur: zwei gleich gerechnete Gebühren mit
    verschiedenem Namen sind für den Betrieb zwei Gebühren.
    """
    return "|".join(
        (
            str(fee.get("name") or "").strip().casefold(),
            str(fee.get("feeType") or ""),
            str(fee.get("mode") or "amount"),
            str(fee.get("basis") or "per_stay"),
            f"{float(fee.get('amount') or 0):.2f}",
            # Zeitraum und Abrechnungs-Schalter sind Teil der Identität: „Resort
            # ab 01.08." und „Resort" sind für den Betrieb zwei Gebühren.
            str(fee.get("validFrom") or ""),
            str(fee.get("validUntil") or ""),
            "abrechnung" if fee.get("ownerStatementOnly") else "",
        )
    )


class GebuehrenMixin:
    """Gebühren-Aktionen am Objekt. Wird von PropertiesService eingebunden.

    Gegenstück zu `SteuernMixin` — dieselben zwei Wege, die der
    Branchenstandard für Gebühren führt (live abgelesen 03.08.2026):

    * `/pricing/<id>/assign-fee` — „Fügen Sie eine neue oder bestehende Gebühr
      hinzu": eine Auswahlliste der Gebühren, die der Betrieb schon irgendwo
      angelegt hat (`fee_library`).
    * Block „Zu anderen Unterkünften hinzufügen" im Gebühren-Editor: dieselbe
      Gebühr auf weitere Objekte übertragen (`apply_fee_to_properties`).
    """

    def fee_library(
        self, ctx: AuthContext, property_id: str
    ) -> dict[str, Any]:
        """Bestehende Gebühren des Betriebs zur Übernahme auf DIESES Objekt.

        Nur Gebühren aus Objekten mit DERSELBEN Währung: ein Betrag ist ohne
        seine Währung keine Zahl, die man übernehmen kann — „955" von einem
        DKK-Objekt auf ein EUR-Objekt zu kopieren wäre eine stille
        Preiserhöhung um den Faktor 7,5 (Wurzel 4: kein plausibel aussehender
        Ersatzwert). Prozentuale Gebühren sind währungsfrei und kommen deshalb
        aus allen Objekten.

        Hat das Zielobjekt noch keine Währung, bleibt die Liste bei den
        prozentualen Gebühren und `currency` ist `None` — die Oberfläche sagt
        dann, dass zuerst die Objektwährung zu setzen ist. Kein geratenes EUR.

        Gebühren, die auf DIESEM Objekt schon liegen, fehlen bewusst: sie
        „hinzuzufügen" wäre eine Dublette.
        """
        tenant_id = self._require_tenant(ctx)  # type: ignore[attr-defined]
        ziel = load_scoped(
            self._db,  # type: ignore[attr-defined]
            "properties",
            property_id,
            tenant_id,
            columns="id, currency, type_attributes",
            not_found=PropertyError("Objekt nicht gefunden.", status_code=404),
        )
        ziel_currency = str(ziel.get("currency") or "").upper() or None
        eigene = {
            fee_signatur(f)
            for f in _fees_von(ziel)
        }

        rows = (
            self._db.table("properties")  # type: ignore[attr-defined]
            .select("id, title, currency, type_attributes")
            .eq("tenant_id", tenant_id)
            .order("title")
            .execute()
        ).data or []

        items: list[dict[str, Any]] = []
        gesehen: set[str] = set()
        for row in rows:
            if str(row.get("id")) == property_id:
                continue
            quelle_currency = str(row.get("currency") or "").upper() or None
            for fee in _fees_von(row):
                prozent = str(fee.get("mode") or "amount") == "percent"
                if not prozent and quelle_currency != ziel_currency:
                    continue
                signatur = fee_signatur(fee)
                if signatur in eigene or signatur in gesehen:
                    continue
                gesehen.add(signatur)
                items.append(
                    {
                        "fee": fee,
                        "property_id": str(row["id"]),
                        "property_title": row.get("title"),
                    }
                )
        return {"currency": ziel_currency, "items": items}

    def booking_gebuehren_vorschlag(
        self, ctx: AuthContext, property_id: str
    ) -> dict[str, Any]:
        """Gebühren, die Booking-Buchungen dieses Objekts mitbringen und die fehlen.

        Booking liefert sie an JEDER Buchung mit (Art, Betrag, Name,
        Berechnungsart, Lage im Preis) — siehe `booking_gebuehren`. Bis
        03.09.2026 wurde das nirgends ausgewertet: das Objekt kannte die
        Gebühr nicht, und die Eigentümer-Abrechnung blockierte mit „Die
        Gebührenart `electricity` ist nicht zugeordnet", obwohl die Angabe im
        Payload stand.
        """
        tenant_id = self._require_tenant(ctx)  # type: ignore[attr-defined]
        ziel = load_scoped(
            self._db,  # type: ignore[attr-defined]
            "properties",
            property_id,
            tenant_id,
            columns="id, currency, type_attributes",
            not_found=PropertyError("Objekt nicht gefunden.", status_code=404),
        )
        bestand = list(
            ((ziel.get("type_attributes") or {}).get("pricing") or {}).get("fees")
            or []
        )
        fehlende = booking_fehlende_gebuehren(
            self._db,  # type: ignore[attr-defined]
            tenant_id,
            property_id,
            bestand,
        )
        # Arten, die das Portal berechnet und die am Objekt schon stehen, aber
        # KEINE Abrechnungs-Zuordnung haben. Ohne diese zweite Liste blieb die
        # Oberfläche stumm, sobald die Gebühr einmal übernommen war: der Block
        # rendert nur bei `items`, und die Abrechnung blockierte weiter an der
        # fehlenden Zuordnung (live 03.09.2026 nach dem Übernehmen von
        # „Stromkosten").
        alle = booking_arten_am_objekt(
            self._db,  # type: ignore[attr-defined]
            tenant_id,
            property_id,
            bestand,
        )
        neue_arten = {str(f["feeType"]) for f in fehlende}
        zugeordnet = booking_zugeordnete_arten(
            self._db,  # type: ignore[attr-defined]
            tenant_id,
            [str(f.get("feeType") or "") for f in alle],
        )
        offen = [
            f
            for f in alle
            if str(f.get("feeType") or "") not in neue_arten
            and str(f.get("feeType") or "") not in zugeordnet
        ]
        return {
            "items": fehlende,
            "unassigned": offen,
            "currency": str(ziel.get("currency") or "").upper() or None,
        }

    def booking_gebuehren_uebernehmen(
        self, ctx: AuthContext, property_id: str
    ) -> dict[str, Any]:
        """Die fehlenden Booking-Gebühren am Objekt anlegen.

        Über den regulären Objekt-Update-Weg und NICHT per Direkt-Schreibung:
        nur so laufen Prüfung (`normalize_fees`), die Spiegelung in
        `property_pricing_config` und der Portal-Sync wie bei jeder anderen
        Gebühr.

        Idempotent (Wurzel 2): ein zweiter Aufruf findet die Arten bereits am
        Objekt und legt nichts an. Bestehende Gebühren bleiben unberührt — der
        dort gepflegte Betrag ist die Vereinbarung des Betriebs.
        """
        tenant_id = self._require_tenant(ctx)  # type: ignore[attr-defined]
        ziel = load_scoped(
            self._db,  # type: ignore[attr-defined]
            "properties",
            property_id,
            tenant_id,
            columns="id, type_attributes",
            not_found=PropertyError("Objekt nicht gefunden.", status_code=404),
        )
        attrs = dict(ziel.get("type_attributes") or {})
        pricing = dict(attrs.get("pricing") or {})
        bestand = [f for f in (pricing.get("fees") or []) if isinstance(f, dict)]
        fehlende = booking_fehlende_gebuehren(
            self._db,  # type: ignore[attr-defined]
            tenant_id,
            property_id,
            bestand,
        )
        # Die Abrechnungs-Zuordnung MITSCHREIBEN, und zwar für ALLE Arten aus
        # den Booking-Buchungen dieses Objekts — nicht nur für die gerade neu
        # angelegten.
        #
        # WARUM DIE UNTERSCHEIDUNG ZÄHLT: Wer die Gebühr übernommen hat, BEVOR
        # dieser Schritt existierte, hätte sie sonst nie zugeordnet bekommen —
        # sie steht am Objekt, gilt damit nicht mehr als „fehlend", und ein
        # zweiter Klick wäre wirkungslos gewesen (live am 03.09.2026: Gebühr
        # „Stromkosten" angelegt, Abrechnung blockierte weiter). Deshalb wird
        # hier über die Buchungs-Arten gelaufen und nicht über die Neuzugänge.
        arten_aus_buchungen = sorted(
            {str(f["feeType"]) for f in fehlende}
            | {
                str(f.get("feeType") or "")
                for f in booking_arten_am_objekt(
                    self._db,  # type: ignore[attr-defined]
                    tenant_id,
                    property_id,
                    bestand,
                )
            }
        )
        zugeordnet = booking_zuordnung_nachziehen(
            self._db,  # type: ignore[attr-defined]
            tenant_id,
            [a for a in arten_aus_buchungen if a],
            zugeordnet_von=getattr(ctx, "user_id", None),
        )
        if not fehlende:
            log.info(
                "booking_gebuehren_nur_zuordnung",
                tenant_id=tenant_id,
                property_id=property_id,
                zuordnung_angelegt=zugeordnet,
            )
            return {"uebernommen": zugeordnet, "fees": bestand}

        pricing["fees"] = [*bestand, *fehlende]
        attrs["pricing"] = pricing
        self.update(  # type: ignore[attr-defined]
            ctx, property_id, PropertyUpdate(type_attributes=attrs)
        )
        log.info(
            "booking_gebuehren_uebernommen",
            tenant_id=tenant_id,
            property_id=property_id,
            arten=[f["feeType"] for f in fehlende],
            zuordnung_angelegt=zugeordnet,
        )
        return {
            "uebernommen": [f["feeType"] for f in fehlende],
            "fees": pricing["fees"],
        }

    def apply_fee_to_properties(
        self, ctx: AuthContext, property_id: str, fee_id: str, targets: list[str]
    ) -> dict[str, Any]:
        """Eine Gebühr des Objekts auf weitere Objekte übertragen.

        Wie bei der Steuer: jede Ziel-ID wird EINZELN tenant-gescopt geladen
        (Wurzel 3), und die Gebühr behält ihre Kennung — dasselbe Objekt
        zweimal zu bespielen aktualisiert die vorhandene Zeile, statt sie zu
        duplizieren (Wurzel 2).

        Zwei Dinge werden VOR dem ersten Schreiben geprüft, nicht unterwegs:

        * Die Währung des Ziels muss zur Währung der Quelle passen, sonst
          änderte die Übertragung den Preis (siehe `fee_library`).
        * Eine Kanal-Einschränkung (`portalScope`) muss beim Ziel überhaupt
          erfüllbar sein — ist das Portal dort nicht verbunden, wird die
          Übertragung ABGELEHNT statt die Einschränkung stillschweigend
          fallenzulassen. Ohne sie ginge die Gebühr beim Ziel an ALLE Portale;
          das ist eine Ausweitung, die niemand angefordert hat (fail-closed,
          Wurzel 5).

        Beides schlägt fehl, BEVOR irgendein Ziel geschrieben wurde — eine halb
        durchgelaufene Übertragung wäre schwer zu erkennen und noch schwerer
        zurückzunehmen.
        """
        tenant_id = self._require_tenant(ctx)  # type: ignore[attr-defined]
        quelle = load_scoped(
            self._db,  # type: ignore[attr-defined]
            "properties",
            property_id,
            tenant_id,
            columns="id, currency, type_attributes",
            not_found=PropertyError("Objekt nicht gefunden.", status_code=404),
        )
        vorlage = next(
            (f for f in _fees_von(quelle) if str(f.get("id")) == fee_id), None
        )
        if vorlage is None:
            raise PropertyError("Gebühr nicht gefunden.", status_code=404)

        prozent = str(vorlage.get("mode") or "amount") == "percent"
        quelle_currency = str(quelle.get("currency") or "").upper() or None
        scope = [str(x) for x in (vorlage.get("portalScope") or [])]

        ziel_ids = [z for z in dict.fromkeys(targets) if z != property_id]
        ziele = [
            load_scoped(
                self._db,  # type: ignore[attr-defined]
                "properties",
                ziel_id,
                tenant_id,
                columns="id, title, currency, type_attributes",
                not_found=PropertyError("Objekt nicht gefunden.", status_code=404),
            )
            for ziel_id in ziel_ids
        ]
        for ziel in ziele:
            self._pruefe_uebertragbar(
                ziel,
                tenant_id=tenant_id,
                prozent=prozent,
                quelle_currency=quelle_currency,
                scope=scope,
            )

        angewendet: list[str] = []
        for ziel in ziele:
            ziel_id = str(ziel["id"])
            attrs = dict(ziel.get("type_attributes") or {})
            pricing = dict(attrs.get("pricing") or {})
            bestand = [
                f
                for f in (pricing.get("fees") or [])
                if isinstance(f, dict) and str(f.get("id")) != fee_id
            ]
            pricing["fees"] = [*bestand, dict(vorlage)]
            attrs["pricing"] = pricing
            # Über den normalen Update-Pfad, NICHT per Direkt-Schreibung: nur so
            # laufen Prüfung (normalize_fees), Spiegelung in
            # property_pricing_config und der Sync-Entscheid (schlanker
            # Abgaben-Job statt vollem Content-Sync) wie überall sonst.
            self.update(  # type: ignore[attr-defined]
                ctx, ziel_id, PropertyUpdate(type_attributes=attrs)
            )
            angewendet.append(ziel_id)
        log.info(
            "fee_applied_to_properties",
            tenant_id=tenant_id,
            property_id=property_id,
            fee_id=fee_id,
            targets=len(angewendet),
        )
        return {"applied_to": angewendet}

    def _pruefe_uebertragbar(
        self,
        ziel: dict[str, Any],
        *,
        tenant_id: str,
        prozent: bool,
        quelle_currency: str | None,
        scope: list[str],
    ) -> None:
        """Darf die Gebühr auf DIESES Ziel? Wirft 422 mit dem Grund am Objekt."""
        titel = str(ziel.get("title") or ziel["id"])
        ziel_currency = str(ziel.get("currency") or "").upper() or None
        if not prozent and ziel_currency != quelle_currency:
            raise PropertyError(
                f"„{titel}“ rechnet in einer anderen Währung — ein Betrag lässt "
                "sich so nicht übernehmen.",
                status_code=422,
            )
        portal_codes = [c for c in scope if c not in EIGENE_KANAELE]
        if not portal_codes:
            return
        erlaubt = erlaubte_portale(
            self._db, tenant_id, str(ziel["id"])  # type: ignore[attr-defined]
        )
        # `None` = Portalliste nicht ladbar. Dann NICHT übertragen: die
        # Einschränkung ließe sich hier nicht belegen, und eine Gebühr, die
        # womöglich an alle Portale geht, ist der teurere Fehler (Wurzel 5).
        if erlaubt is None:
            raise PropertyError(
                f"Verbundene Portale von „{titel}“ sind nicht abrufbar — "
                "eingeschränkte Gebühr nicht übertragen.",
                status_code=503,
            )
        fehlend = sorted(set(portal_codes) - erlaubt)
        if fehlend:
            raise PropertyError(
                f"„{titel}“ ist nicht mit {', '.join(fehlend)} verbunden — die "
                "Einschränkung der Gebühr wäre dort nicht abbildbar.",
                status_code=422,
            )


def _fees_von(row: dict[str, Any]) -> list[dict[str, Any]]:
    """Gebühren eines properties-Datensatzes (Preis-Blob), nur echte Einträge."""
    pricing = (row.get("type_attributes") or {}).get("pricing") or {}
    return [f for f in (pricing.get("fees") or []) if isinstance(f, dict)]
