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

from typing import Any

from supabase import Client

from src.core.logging import get_logger

from .errors import PropertyError

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
#   * `security_deposit` steht in der Artikel-Tabelle, ist live NICHT wählbar.
#     Bleibt als gültiger Wert stehen (siehe unten), wird aber nicht angeboten.
#   * `short_term_cleaning` ist NICHT wählbar — die Export-Tabelle des Artikels
#     nennt es als eigene Zeile, das Produkt kennt dafür keine Gebührenart.
#     Deshalb hier keine erfundene Art (Wurzel 4).
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
    # → nicht übertragbar (keine Airbnb-Kategorie)
    "misc_charges": None,
    "unknown": None,
}
# Gültig, aber nicht (mehr) anzubieten.
#
# `security_deposit` steht in der Artikel-Zuordnung (→ SecurityDeposit), ist im
# Produkt aber nicht wählbar — wer den Wert schon hat, behält ihn.
# `linen`/`management`/`pet`/`cleaning`/`other` sind unsere eigenen Bestands-
# schlüssel aus der Zeit vor der vollen Taxonomie. Sie bleiben gültig, damit ein
# Objekt mit alter Gebühr speicherbar bleibt — sonst wirft jedes Speichern 422,
# auch beim Ändern der Beschreibung. Das Auswahlfeld zeigt nur die Werte oben.
FEE_TYPE_ALTBESTAND: dict[str, str | None] = {
    "security_deposit": "security_deposit",
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
     "security_deposit"}
)

# Berechnungsbasis („calculation model" der Export-Tabelle); bestimmt die
# Channex-`logic` (siehe channel_manager.tax_sync `_FEE_LOGIC`). Gegenstück:
# FeeBasis in web/lib/pricing-meta.ts.
#
# Im Branchenstandard sind das zwei Auswahlfelder — „Einmaliger Betrag | Pro
# Gast" × „Pro Aufenthalt | Pro Nacht" (live abgelesen). Wir führen die vier
# Kombinationen als EINEN Wert, weil genau vier möglich sind und die
# Channex-`logic` ohnehin die Kombination braucht.
FEE_BASES = frozenset(
    {"per_stay", "per_night", "per_guest_stay", "per_guest_night"}
)

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

        satz = _clean_tax_rate(eintrag.get("taxRate"))
        if satz is not None:
            sauber["taxRate"] = satz

        # Gebührenart: Altbestand hat sie nicht. Fehlt sie, bleibt sie weg —
        # der Export liest dann "other". Ein gesetzter Wert muss aber stimmen.
        art = eintrag.get("feeType")
        if art is not None and str(art).strip():
            if str(art) not in FEE_TYPES:
                raise PropertyError(f"Unbekannte Gebührenart: {art}", status_code=422)
            sauber["feeType"] = str(art)

        scope = clean_portal_scope(eintrag.get("portalScope"), erlaubt=portale)
        if scope:
            sauber["portalScope"] = scope

        fees.append(sauber)
    return fees
