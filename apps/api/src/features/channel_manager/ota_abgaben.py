"""Was von Steuern und Gebühren bei WELCHEM Portal ankommt.

Die eine Frage, die dieses Modul beantwortet: *Diese Gebühr / diese Steuer — geht
sie an Booking.com, an Airbnb, an Expedia? Und wenn ja, wie?*

Jedes Portal behandelt Abgaben anders, und zwar nicht nach unserem Geschmack,
sondern weil seine Schnittstelle es so verlangt. Das ist Branchenstandard und
belegt (Lodgify Help-Center „Taxes and Fees applied in OTAs", englisches Original
27.07.2026; ergänzt um live abgelesene Regeln aus dem Produkt selbst,
03.08.2026):

+--------------+-----------------------------------+---------------------------+
|              | Gebühren                          | Steuern                   |
+--------------+-----------------------------------+---------------------------+
| Airbnb       | nach Kategorie×Berechnungsmodell   | Prozent: ja.              |
|              | (Tabelle unten); gleiche Kategorie | Betrag: NUR pro Gast pro  |
|              | wird zu EINER Gebühr summiert;     | Nacht. Getrennt vom       |
|              | gemischte Modelle → gar nicht      | Zimmerpreis ausgewiesen.  |
|              |                                    | Hängt am Steuerszenario.  |
| Booking.com  | NUR Prozent, im Zimmerpreis        | NUR Prozent, im           |
|              | enthalten. Feste Beträge nicht.    | Zimmerpreis enthalten.    |
| Expedia      | nichts                             | nichts                    |
| HomeAway/    | Prozent UND Betrag, getrennt       | Prozent UND Betrag,       |
| Vrbo         | ausgewiesen, keine Summierung      | getrennt ausgewiesen      |
+--------------+-----------------------------------+---------------------------+

HomeAway/Vrbo ist hier NICHT verdrahtet: der Channex-Kanalkatalog führt diesen
Kanal nicht (live geprüft 03.08.2026, 52 Kanäle — kein Vrbo/HomeAway). Ein
Portal-Code dafür wäre erfunden (Wurzel 4). Die Regel steht oben, damit sie beim
Auftauchen des Kanals nur noch eingetragen werden muss.

Kanäle, über die der Standard nichts sagt (Agoda, Trip.com, Google, Hostelworld
…), behalten das bisherige Verhalten: alles übertragen, `is_inclusive` wie am
Objekt gepflegt. Nichts geraten.
"""
from __future__ import annotations

from typing import Any

from src.features.properties.gebuehren import (
    TAXABLE_BASE_CATEGORIES,
    fee_category,
)

from .common import log

# --- Berechnungsmodelle ------------------------------------------------------
# „calculation model" des Standards: zwei Achsen (einmalig | pro Gast) ×
# (pro Aufenthalt | pro Nacht). Wir führen die vier Kombinationen als einen Wert.
ALLE_BASEN = frozenset({"per_stay", "per_night", "per_guest_stay", "per_guest_night"})

# Gebühren-Basis → Channex `logic`. Alle vier Ziele sind live gegen POST /taxes
# mit type=fee geprüft (03.08.2026).
FEE_LOGIC = {
    "per_stay": "per_booking",
    "per_night": "per_night",
    "per_guest_stay": "per_person",
    "per_guest_night": "per_person_per_night",
}
# Betrags-Steuern: (chargeBasis, period) → Channex `logic`.
TAX_AMOUNT_LOGIC = {
    ("SingleCharge", "PerStay"): "per_booking",
    ("SingleCharge", "PerNight"): "per_night",
    ("PerPerson", "PerStay"): "per_person",
    ("PerPerson", "PerNight"): "per_person_per_night",
}

# --- Airbnb: „Fees to export" -----------------------------------------------
# Airbnb-Gebührenkategorie → Berechnungsmodelle, mit denen die Gebühr überhaupt
# exportiert wird. Alles, was hier fehlt, geht nicht an Airbnb — das ist die
# Aussage der Tabelle, kein Versehen.
#
# `security_deposit` steht bewusst NICHT drin: die Export-Tabelle führt es nicht
# (es ist eine Kaution, keine Gebühr im Preis). `None`-Kategorien (Unknown,
# MiscCharges, Gebühr ohne Art) ebenfalls nicht — „Unknown: not sent to Airbnb".
AIRBNB_FEE_EXPORT: dict[str, frozenset[str]] = {
    "cleaning": frozenset({"per_stay"}),
    "pet": frozenset({"per_stay"}),
    "linen": frozenset({"per_stay", "per_guest_stay"}),
    "community": ALLE_BASEN,
    "management": ALLE_BASEN,
    "resort": ALLE_BASEN,
}
# Kategorien, die als Prozentsatz gehen dürfen. Die Tabelle sagt es an jeder
# Zeile: „(Percentage or flat)" nur bei Community/Management/Resort, sonst
# „(Flat amount)" — und ausdrücklich „The pet fee must be calculated as a flat
# amount."
AIRBNB_FEE_PERCENT_OK = frozenset({"community", "management", "resort"})

# --- Airbnb-Steuererhebungsszenario -----------------------------------------
# Die drei Szenarien des Standards. Der Wert wird NICHT bei uns entschieden — er
# beschreibt, was Airbnb für dieses Inserat tut; im Standard steht er als
# read-only Infokasten in den Airbnb-Einstellungen (live abgelesen: „Keine von
# Airbnb erhobene Steuern — Airbnb erhebt oder überweist keine Steuern.").
SZENARIO_INELIGIBLE = "ineligible"
SZENARIO_KEINE_ERHEBUNG = "no_collected"
SZENARIO_GESTAPELT = "stacked"
AIRBNB_SZENARIEN = frozenset(
    {SZENARIO_INELIGIBLE, SZENARIO_KEINE_ERHEBUNG, SZENARIO_GESTAPELT}
)

# --- Kaskadenebenen ----------------------------------------------------------
# Channex rechnet von der höchsten Zahl zur niedrigsten; Posten auf DERSELBEN
# Ebene besteuern sich nicht gegenseitig. Damit lässt sich ausdrücken, welche
# Gebühren in der Bemessungsgrundlage einer prozentualen Steuer liegen:
# besteuerte Gebühr eine Ebene HÖHER als die Steuer, nicht besteuerte auf
# derselben Ebene wie die Steuer.
LEVEL_TAX = 0
LEVEL_FEE_BESTEUERT = 1
LEVEL_FEE_UNBESTEUERT = 0

# Portale mit Sonderregeln. Die Codes sind die echten Channex-Kanalcodes
# (live aus /channels/list).
AIRBNB = "AirBNB"
BOOKING = "BookingCom"
EXPEDIA = "Expedia"


class PortalRegel:
    """Wie Abgaben an EIN Portal gehen.

    * `gebuehren` — "airbnb" | "nur_prozent" | "keine" | "alle"
    * `steuern`   — "prozent_und_pro_gast_pro_nacht" | "nur_prozent" | "keine" |
                    "alle"
    * `im_zimmerpreis` — `True`: Abgabe steckt im gesendeten Preis
      (`is_inclusive`), `False`: getrennt ausgewiesen. `None`: keine Aussage,
      die Pflege am Objekt gilt.
    * `summieren` — Gebühren derselben Airbnb-Kategorie zu EINER zusammenfassen.
    * `grundlage_wirkt` — die Steuerbemessungsgrundlage wirkt bei diesem Portal.
      Sonst gilt: Steuern nur auf den Basispreis.
    """

    __slots__ = (
        "gebuehren", "steuern", "im_zimmerpreis", "summieren", "grundlage_wirkt",
    )

    def __init__(
        self,
        *,
        gebuehren: str,
        steuern: str,
        im_zimmerpreis: bool | None,
        summieren: bool = False,
        grundlage_wirkt: bool = False,
    ) -> None:
        self.gebuehren = gebuehren
        self.steuern = steuern
        self.im_zimmerpreis = im_zimmerpreis
        self.summieren = summieren
        self.grundlage_wirkt = grundlage_wirkt


PORTAL_REGELN: dict[str, PortalRegel] = {
    AIRBNB: PortalRegel(
        gebuehren="airbnb",
        steuern="prozent_und_pro_gast_pro_nacht",
        im_zimmerpreis=False,
        summieren=True,
        grundlage_wirkt=True,
    ),
    BOOKING: PortalRegel(
        gebuehren="nur_prozent",
        steuern="nur_prozent",
        im_zimmerpreis=True,
    ),
    EXPEDIA: PortalRegel(
        gebuehren="keine",
        steuern="keine",
        im_zimmerpreis=None,
    ),
}

# Kanäle ohne Sonderregel: unverändertes Verhalten (alles senden, Inklusiv-Frage
# entscheidet das Objekt). Auch das Standard-Set (portal=None) nutzt sie.
STANDARD_REGEL = PortalRegel(
    gebuehren="alle", steuern="alle", im_zimmerpreis=None
)


def regel_fuer(portal: str | None) -> PortalRegel:
    """Regelwerk eines Portals; ohne Sonderregel das Standardverhalten."""
    if portal is None:
        return STANDARD_REGEL
    return PORTAL_REGELN.get(portal, STANDARD_REGEL)


class Abgabe:
    """Ein Posten, wie er bei Channex angelegt wird.

    `schluessel` ist die lokale Kennung, unter der der Posten in
    `channex_tax_map` geführt wird. Bei summierten Airbnb-Gebühren ist das
    KEINE Gebühren-ID, sondern ein Kategorie-Schlüssel (`cat:community`) — sonst
    hätte die Summe keine stabile Identität und würde bei jedem Sync neu
    angelegt (Wurzel 2).
    """

    __slots__ = ("schluessel", "attrs", "level")

    def __init__(
        self, *, schluessel: str, attrs: dict[str, Any], level: int
    ) -> None:
        self.schluessel = schluessel
        self.attrs = attrs
        self.level = level

    def __repr__(self) -> str:  # pragma: no cover — nur Diagnose
        return f"Abgabe({self.schluessel!r}, {self.attrs.get('title')!r})"


def _gilt_fuer(eintrag: dict[str, Any], portal: str | None) -> bool:
    """Ausdrückliche Kanal-Einschränkung des Betriebs (`portalScope`).

    Leer = alle Kanäle. Gesetzt heißt „NUR diese". `portal=None` ist das
    Standard-Set und damit der Weg zu jedem Kanal ohne eigenen Plan — ein
    eingeschränkter Posten darf dort nicht hinein, sonst liefe die
    Einschränkung ins Leere.
    """
    scope = eintrag.get("portalScope")
    if not isinstance(scope, list) or not scope:
        return True
    return portal is not None and portal in {str(x) for x in scope}


def _fee_titel(fee: dict[str, Any], *, kategorie_titel: str | None = None) -> str:
    """Titel der Gebühr beim Portal.

    Der vom Betrieb vergebene Name gewinnt — er steht so auf der Rechnung. Bei
    einer summierten Kategorie kann er es nicht sein (mehrere Gebühren, ein
    Posten): dann trägt der Posten die Kategorie.
    """
    if kategorie_titel is not None:
        return kategorie_titel[:255]
    name = str(fee.get("name") or "").strip()
    return name[:255] if name else "Gebühr"


KATEGORIE_TITEL = {
    "community": "Gemeinschaftsgebühr",
    "management": "Verwaltungsgebühr",
    "resort": "Resortgebühr",
    "linen": "Wäscheservice",
    "pet": "Haustiergebühr",
    "cleaning": "Reinigungsgebühr",
    "security_deposit": "Kaution",
}


def _fee_exportfaehig_airbnb(fee: dict[str, Any], kategorie: str | None) -> bool:
    """Kommt DIESE Gebühr laut Export-Tabelle bei Airbnb an?"""
    if kategorie is None:
        return False
    erlaubte_basen = AIRBNB_FEE_EXPORT.get(kategorie)
    if erlaubte_basen is None:
        return False
    if str(fee.get("basis") or "per_stay") not in erlaubte_basen:
        return False
    if (
        str(fee.get("mode") or "amount") == "percent"
        and kategorie not in AIRBNB_FEE_PERCENT_OK
    ):
        return False
    return True


def _fee_attrs(
    fee: dict[str, Any],
    *,
    titel: str,
    currency: str,
    im_zimmerpreis: bool,
) -> dict[str, Any]:
    """Channex-Attribute einer Gebühr (ohne property_id)."""
    prozent = str(fee.get("mode") or "amount") == "percent"
    logic = (
        "percent"
        if prozent
        else FEE_LOGIC.get(str(fee.get("basis") or "per_stay"), "per_booking")
    )
    attrs: dict[str, Any] = {
        "title": titel,
        "logic": logic,
        "type": "fee",
        "rate": str(fee.get("amount") or 0),
        "is_inclusive": im_zimmerpreis,
    }
    if logic != "percent":
        attrs["currency"] = currency
    return attrs


def _airbnb_gebuehren(
    fees: list[dict[str, Any]],
    *,
    currency: str,
    im_zimmerpreis: bool,
    diagnose: dict[str, Any],
) -> list[tuple[str, dict[str, Any], str | None]]:
    """Gebühren für Airbnb: Kategorie-Gruppen, Summierung, Sperrregel.

    Rückgabe: (schluessel, channex-attrs, kategorie).

    Regel des Standards, in dieser Reihenfolge:
    1. Zwei oder mehr Gebühren derselben Kategorie mit UNTERSCHIEDLICHEM
       Berechnungsmodell werden NICHT exportiert — keine von beiden. („You will
       need to change the fee type or remove duplicates for them to be
       exported.") Dazu zählt auch Betrag gegen Prozent: zwei verschiedene
       Rechenarten sind nicht summierbar.
    2. Gleiches Modell: Beträge addieren, EINE Gebühr senden.
    3. Danach entscheidet die Export-Tabelle über Kategorie×Modell.
    """
    nach_kategorie: dict[str, list[dict[str, Any]]] = {}
    for fee in fees:
        kategorie = fee_category(fee)
        if kategorie is None:
            continue
        nach_kategorie.setdefault(kategorie, []).append(fee)

    posten: list[tuple[str, dict[str, Any], str | None]] = []
    for kategorie, gruppe in sorted(nach_kategorie.items()):
        modelle = {
            (str(f.get("mode") or "amount"), str(f.get("basis") or "per_stay"))
            for f in gruppe
        }
        if len(modelle) > 1:
            # Regel 1: gemischte Berechnungsmodelle sperren die ganze Kategorie.
            diagnose.setdefault("gesperrte_kategorien", []).append(kategorie)
            continue
        mode, basis = next(iter(modelle))
        vorlage = dict(gruppe[0])
        if len(gruppe) > 1:
            # Regel 2: summieren. Der Posten trägt die Kategorie als Titel und
            # einen Kategorie-Schlüssel als stabile Identität.
            summe = 0.0
            for f in gruppe:
                try:
                    summe += float(f.get("amount") or 0)
                except (TypeError, ValueError):  # noqa: PERF203 — je Gebühr
                    continue
            vorlage["amount"] = summe
        if not _fee_exportfaehig_airbnb(vorlage, kategorie):
            diagnose.setdefault("nicht_exportfaehig", []).append(
                f"{kategorie}/{mode}/{basis}"
            )
            continue
        einzeln = len(gruppe) == 1
        schluessel = str(gruppe[0].get("id")) if einzeln else f"cat:{kategorie}"
        titel = _fee_titel(
            vorlage,
            kategorie_titel=None if einzeln else KATEGORIE_TITEL.get(kategorie),
        )
        posten.append(
            (
                schluessel,
                _fee_attrs(
                    vorlage,
                    titel=titel,
                    currency=currency,
                    im_zimmerpreis=im_zimmerpreis,
                ),
                kategorie,
            )
        )
    return posten


def _tax_titel(tax: dict[str, Any]) -> str:
    """Gastseitiger Name, wenn gepflegt — das sieht der Gast beim Portal."""
    names = tax.get("names") if isinstance(tax.get("names"), dict) else {}
    titel = (
        names.get("de")
        or next((v for v in names.values() if v), None)
        or tax.get("name")
        # Die USt trägt bewusst keinen eigenen Namen (sie IST die Umsatzsteuer
        # des Objekts). Ohne diesen Zweig stünde beim Portal „Steuer", also
        # genau der Platzhalter, den Wurzel 4 verbietet.
        or ("USt." if str(tax.get("kind")) == "vat" else None)
        or "Steuer"
    )
    return str(titel)[:255]


# Lokale Steuerart → Channex `type` ∈ tax|fee|city_tax. Ortsbezogene Abgaben
# sind „city_tax", Beherbergungs-/Zimmersteuern „tax".
#
# ACHTUNG, live gemessen (Sandbox, 03.08.2026): der Wert heißt `city_tax` mit
# UNTERSTRICH. Die Channex-Doku schreibt „city tax" mit Leerzeichen und
# Responses liefern „City Tax" — beide werden bei POST /taxes mit
# `422 {"type": ["is invalid"]}` abgelehnt. Nicht nach der Doku „korrigieren".
TAX_TYPE_BY_LOCAL_KIND = {
    "HotelTax": "tax",
    "LodgingTax": "tax",
    "RoomTax": "tax",
    "TourismAssessment": "city_tax",
    "TouristTax": "city_tax",
    "TransientOccupancyTax": "city_tax",
    "Unknown": "tax",
}
# Fallback auf der gröberen Achse (kind), wenn keine Steuerart gesetzt ist.
TAX_TYPE_BY_KIND = {"vat": "tax", "local": "city_tax"}


def tax_logic(tax: dict[str, Any]) -> str:
    """Channex-`logic` einer Steuer. Ohne gespeicherte Basis gilt bei
    Betrags-Steuern „einmalig pro Nacht" — genau das, was bisher gesendet
    wurde; nichts wird geraten."""
    if str(tax.get("mode") or "percent") == "percent":
        return "percent"
    schluessel = (
        str(tax.get("chargeBasis") or "SingleCharge"),
        str(tax.get("period") or "PerNight"),
    )
    return TAX_AMOUNT_LOGIC.get(schluessel, "per_night")


def tax_type(tax: dict[str, Any]) -> str:
    """Channex-`type` einer Steuer: aus der Steuerart, sonst aus `kind`."""
    art = tax.get("taxType")
    if art:
        return TAX_TYPE_BY_LOCAL_KIND.get(str(art), "tax")
    return TAX_TYPE_BY_KIND.get(str(tax.get("kind") or ""), "tax")


def _steuer_exportfaehig(tax: dict[str, Any], regel: PortalRegel) -> bool:
    """Kommt DIESE Steuer bei diesem Portal an?"""
    if regel.steuern == "keine":
        return False
    prozent = str(tax.get("mode") or "percent") == "percent"
    if regel.steuern == "alle":
        return True
    if regel.steuern == "nur_prozent":
        return prozent
    if regel.steuern == "prozent_und_pro_gast_pro_nacht":
        # „Fixed amounts are only exported if they are set as per guest per
        # night." Alles andere an Betrags-Steuern bleibt draußen.
        return prozent or tax_logic(tax) == "per_person_per_night"
    return False


def _besteuerte_kategorien(
    taxes: list[dict[str, Any]], *, diagnose: dict[str, Any]
) -> frozenset[str] | None:
    """Welche Gebührenkategorien liegen in der Bemessungsgrundlage?

    `None` = keine Aussage (keine prozentuale lokale Steuer mit gepflegter
    Grundlage) → bisheriges Verhalten, alle Gebühren liegen in der Grundlage.

    Channex führt die Grundlage über die Kaskaden-EBENE, nicht am Posten. Eine
    Gebühr kann deshalb nur entweder in der Grundlage liegen oder nicht — für
    ALLE Steuern gemeinsam. Verlangen zwei Steuern Verschiedenes, ist das nicht
    abbildbar: dann wird protokolliert und beim bisherigen Verhalten geblieben,
    statt eine der beiden Seiten still falsch zu bespielen (Wurzel 4).
    """
    grundlagen: set[frozenset[str]] = set()
    for tax in taxes:
        if str(tax.get("mode") or "percent") != "percent":
            continue
        roh = tax.get("taxableBase")
        if not isinstance(roh, list) or not roh:
            continue
        gewaehlt = frozenset(
            str(x) for x in roh if str(x) in TAXABLE_BASE_CATEGORIES
        )
        grundlagen.add(gewaehlt)
    if not grundlagen:
        return None
    if len(grundlagen) > 1:
        diagnose["grundlage_widerspruch"] = sorted(
            sorted(g) for g in grundlagen
        )
        return None
    return next(iter(grundlagen))


def abgaben_je_portal(  # pylint: disable=too-many-locals
    *,
    portal: str | None,
    taxes: list[dict[str, Any]],
    fees: list[dict[str, Any]],
    currency: str,
    objekt_inklusiv_erlaubt: bool = True,
    airbnb_steuern_erlaubt: bool = True,
) -> tuple[list[Abgabe], dict[str, Any]]:
    """Die Posten, die dieses Portal bekommt — plus Diagnose fürs Protokoll.

    `objekt_inklusiv_erlaubt=False` heißt: für dieses Portal ist bereits
    entschieden, dass es die Abgabe NICHT zusätzlich bekommt (das Portal rechnet
    sie selbst zum Gastpreis, siehe tax_regime.py) — dann kommt eine leere Liste.

    `airbnb_steuern_erlaubt` ist das Steuererhebungsszenario samt Schaltern
    (siehe AIRBNB_SZENARIEN). Es wirkt NUR auf Steuern, nicht auf Gebühren: der
    Standard hängt ausdrücklich nur die Steuerübertragung daran.
    """
    regel = regel_fuer(portal)
    diagnose: dict[str, Any] = {}
    if not objekt_inklusiv_erlaubt:
        return [], diagnose

    eigene_taxes = [
        t for t in taxes if isinstance(t, dict) and _gilt_fuer(t, portal)
    ]
    # Optionale Gebühren (Gast wählt sie ab) dürfen NICHT als Pflichtaufschlag
    # ans Portal: der Gast bekäme sie dort ohne Wahlmöglichkeit berechnet. Sie
    # bleiben in Direktbuchung/Rechnung.
    eigene_fees = [
        f
        for f in fees
        if isinstance(f, dict) and not f.get("optional") and _gilt_fuer(f, portal)
    ]

    steuer_inklusiv = (
        regel.im_zimmerpreis if regel.im_zimmerpreis is not None else None
    )
    besteuert = (
        _besteuerte_kategorien(eigene_taxes, diagnose=diagnose)
        if regel.grundlage_wirkt
        else frozenset()
    )
    # `frozenset()` bei „Grundlage wirkt hier nicht" ist kein Ratewert, sondern
    # genau die gemessene Regel: „Für alle anderen Kanäle gelten Steuern nur auf
    # den Basispreis" — also liegt keine Gebühr in der Grundlage.

    posten: list[Abgabe] = []

    # --- Steuern ---
    if portal != AIRBNB or airbnb_steuern_erlaubt:
        for tax in eigene_taxes:
            lokale_id = tax.get("id")
            if not lokale_id or not _steuer_exportfaehig(tax, regel):
                if lokale_id and regel.steuern != "keine":
                    diagnose.setdefault("steuer_nicht_exportfaehig", []).append(
                        str(lokale_id)
                    )
                continue
            logic = tax_logic(tax)
            attrs: dict[str, Any] = {
                "title": _tax_titel(tax),
                "logic": logic,
                "type": tax_type(tax),
                "rate": str(tax.get("value") or 0),
                "is_inclusive": (
                    bool(tax.get("includedInPrice"))
                    if steuer_inklusiv is None
                    else steuer_inklusiv
                ),
            }
            if logic != "percent":
                attrs["currency"] = currency
            posten.append(
                Abgabe(schluessel=str(lokale_id), attrs=attrs, level=LEVEL_TAX)
            )
    elif eigene_taxes:
        diagnose["airbnb_steuern_gesperrt"] = len(eigene_taxes)

    # --- Gebühren ---
    gebuehr_inklusiv = bool(regel.im_zimmerpreis)
    if regel.gebuehren == "keine":
        if eigene_fees:
            diagnose["gebuehren_nicht_exportiert"] = len(eigene_fees)
    elif regel.gebuehren == "airbnb":
        for schluessel, attrs, kategorie in _airbnb_gebuehren(
            eigene_fees,
            currency=currency,
            im_zimmerpreis=gebuehr_inklusiv,
            diagnose=diagnose,
        ):
            posten.append(
                Abgabe(
                    schluessel=schluessel,
                    attrs=attrs,
                    level=_fee_level(kategorie, besteuert),
                )
            )
    else:
        nur_prozent = regel.gebuehren == "nur_prozent"
        for fee in eigene_fees:
            lokale_id = fee.get("id")
            if not lokale_id:
                continue
            prozent = str(fee.get("mode") or "amount") == "percent"
            if nur_prozent and not prozent:
                # „Fixed amounts are not exported."
                diagnose.setdefault("gebuehr_kein_prozent", []).append(
                    str(lokale_id)
                )
                continue
            posten.append(
                Abgabe(
                    schluessel=str(lokale_id),
                    attrs=_fee_attrs(
                        fee,
                        titel=_fee_titel(fee),
                        currency=currency,
                        im_zimmerpreis=gebuehr_inklusiv,
                    ),
                    level=_fee_level(fee_category(fee), besteuert),
                )
            )
    return posten, diagnose


def _fee_level(kategorie: str | None, besteuert: frozenset[str] | None) -> int:
    """Kaskaden-Ebene einer Gebühr.

    `besteuert=None` = keine Aussage zur Grundlage → bisheriges Verhalten: die
    Gebühr liegt UNTER der Steuer, eine prozentuale Steuer rechnet also auf
    Grundpreis + Gebühr.
    """
    if besteuert is None:
        return LEVEL_FEE_BESTEUERT
    if kategorie is not None and kategorie in besteuert:
        return LEVEL_FEE_BESTEUERT
    return LEVEL_FEE_UNBESTEUERT


def diagnose_protokollieren(
    *, tenant_id: str, property_id: str, portal: str | None, diagnose: dict[str, Any]
) -> None:
    """Was ein Portal NICHT bekommt, sichtbar machen.

    Ohne diese Zeile ist „die Reinigungsgebühr steht nicht bei Airbnb" nicht
    erklärbar — und ein gesperrter Doppel-Eintrag (Regel 1) sieht wie ein Bug
    aus, obwohl er die Regel ist.
    """
    if not diagnose:
        return
    log.info(
        "ota_abgaben_gefiltert",
        tenant_id=tenant_id,
        property_id=property_id,
        portal=portal or "standard",
        **dict(sorted(diagnose.items())),
    )
