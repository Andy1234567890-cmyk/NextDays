"""Aktionen mit Bedingung an Airbnb — über Airbnbs eigene Rabattregeln.

WARUM DIESES MODUL EXISTIERT: Der Tagespreis kann nur Bedingungen ausdrücken,
die sich AM TAG entscheiden (Zeitraum). Ein Mindestaufenthalt, ein Frühbucher-
oder ein Last-Minute-Rabatt hängt an der BUCHUNG, nicht am Tag — über den
Tagespreis wäre er nur zu haben, indem man ihn jedem Gast gibt (Geldverlust).

Airbnb kennt genau diese drei Bedingungen aber als eigenes Objekt, und Channex
gibt sie durch: `default_pricing_rules` in den Preis-Einstellungen eines
Listings (`channels/{id}/mappings/{mapping_id}/pricing_settings`).

    +-----------------------------+--------------------------------+-------------+
    | unsere Aktion               | Airbnb-Regel (`rule_type`)     | Schwelle    |
    +-----------------------------+--------------------------------+-------------+
    | min_nights (Längenrabatt)   | STAYED_AT_LEAST_X_DAYS         | Nächte ≥ 1  |
    | lengthPrices (Wochen-/      | STAYED_AT_LEAST_X_DAYS         | Nächte ≥ 1  |
    |   Monats-/eigener Preis)    |   (Prozentsatz abgeleitet)      |             |
    | lead_min_days (Frühbucher)  | BOOKED_BEYOND_AT_LEAST_X_DAYS  | Vielfaches  |
    |                             |                                | von 28/30   |
    | lead_max_days (Last Minute) | BOOKED_WITHIN_AT_MOST_X_DAYS   | 1–28 Tage   |
    +-----------------------------+--------------------------------+-------------+
    `price_change` = Rabatt in Prozent, 0–99, ganzzahlig.

HERKUNFT DER GRENZEN (nicht geraten): ausgelieferter Channex-Client
(staging.channex.io/assets/index-*.js, 03.08.2026). Dort das Formular-Schema
`{ruleType, priceChange: 0…99, thresholdOne: ≥1}` mit
`BOOKED_WITHIN_AT_MOST_X_DAYS ≤ 28` und für `BOOKED_BEYOND_AT_LEAST_X_DAYS`
dem Test „muss ein Vielfaches von 28 oder 30 sein" (Auswahlliste
28/30/56/60/84/90). Verletzte Grenzen schicken wir NICHT auf Verdacht mit —
sondern melden die Aktion als „Manuelle Synchronisierung" samt Grund.

WAS AUCH SO NICHT GEHT: ein Angebotscode (kein Portal übergibt einen
Gast-Code), ein Buchungszeitraum (`booked_from/to` — die Airbnb-Regel hat kein
Gültigkeitsfenster), ein Aufenthaltszeitraum ZUSAMMEN mit einer dieser
Bedingungen (die Regel kennt kein Datum, der Tagespreis keine Buchung), eine
Pauschale (Airbnb-Regeln sind prozentual) und zwei Bedingungen in EINER Aktion
(eine Regel trägt genau eine Schwelle).

EIGENTUM AM ZUSTAND: `default_pricing_rules` wird von uns VOLLSTÄNDIG geführt.
Wir senden immer die komplette Soll-Liste, damit eine gelöschte oder
deaktivierte Aktion ihre Regel auch wieder verliert (Wurzel 1). Wer die Regeln
im Channex-Backend von Hand pflegt, verliert sie beim nächsten Push — das ist
gewollt: das PMS ist die Quelle der Wahrheit.
"""
from __future__ import annotations

from typing import Any

from supabase import Client

from src.core.security import AuthContext
from src.core.supabase import load_scoped

from .common import ChannelManagerError, log
from .ota_abgaben import AIRBNB

RULE_LOS = "STAYED_AT_LEAST_X_DAYS"
RULE_FRUEHBUCHER = "BOOKED_BEYOND_AT_LEAST_X_DAYS"
RULE_LAST_MINUTE = "BOOKED_WITHIN_AT_MOST_X_DAYS"

PROZENT_MAX = 99
LAST_MINUTE_MAX_TAGE = 28
# Frühbucher-Vorlauf: Airbnb rechnet in Monatsblöcken. Erlaubt ist jedes
# Vielfache von 28 ODER 30 Tagen; die Channex-Oberfläche bietet diese sechs an.
FRUEHBUCHER_AUSWAHL = (28, 30, 56, 60, 84, 90)

# Preismodelle eines Airbnb-Listings (Channex: `pricing_availability_model`).
# Der Längenrabatt existiert nur im Standard-Modell; im LOS-Modell trägt die
# Aufenthaltslänge schon der Preis selbst, im Rate-Plan-Modell gibt es
# überhaupt keine Regeln.
MODELL_STANDARD = "standard"
MODELL_LOS = "los_record"
MODELL_RATE_PLAN = "rate_plan"


# --- Längenabhängige Preise („ab 7 Nächten kostet die Nacht weniger") --------
#
# Sie gehen über DENSELBEN Weg: ein Längenpreis IST ein Längenrabatt, und Airbnb
# kennt ihn als `STAYED_AT_LEAST_X_DAYS`. Deshalb werden sie hier in dieselbe
# Form gebracht wie eine Aktion und durch dieselbe Pipeline geschickt — dann
# gelten automatisch dieselben Airbnb-Grenzen, und ein Längenpreis und eine
# Aktion mit Mindestaufenthalt konkurrieren um die EINE Regel dieser Art (der
# höhere Rabatt gewinnt, wie im Resolver).
#
# ZWEI DINGE SIND DABEI EHRLICH ZU BENENNEN:
#
# 1. Airbnbs Regel ist PROZENTUAL, unser Längenpreis ein absoluter Nachtpreis.
#    Der Prozentsatz wird deshalb aus dem Grundpreis des Objekts abgeleitet.
#    Läuft der verkaufte Tagespreis auseinander (Wochentagspreise, Dynamic
#    Pricing, Datumspreise im Kalender), trifft der Prozentsatz den absoluten
#    Wunschpreis nicht auf den Cent — das ist eine Eigenschaft von Airbnbs
#    Modell, nicht unserer Umsetzung, und gilt für jedes PMS gleich.
# 2. Gerundet wird ABWÄRTS. Airbnb nimmt nur ganze Prozent; 8,9 % würden als
#    8 % gesendet. Aufwärts zu runden hieße, bei Airbnb billiger zu verkaufen,
#    als der Betrieb eingestellt hat — das ist der teurere Fehler (Wurzel 5).
#    Bleibt nach dem Abrunden 0 % übrig, wird NICHTS gesendet und die Zeile
#    meldet „manuelle Synchronisierung" statt einen Rabatt vorzutäuschen.
DISCOUNT_TYPE_LOS = "length_of_stay"


def laengenpreis_prozent(price_per_night: float, base_price: float) -> int | None:
    """Längenpreis → ganzzahliger Rabatt in Prozent, abgerundet.

    `None`, wenn sich daraus kein Rabatt ergibt: ohne Grundpreis, bei einem
    Längenpreis über dem Grundpreis (das ist ein AUFSCHLAG, den Airbnbs
    Rabattregel nicht kennt) oder wenn nach dem Abrunden 0 % bleiben.
    """
    if base_price <= 0 or price_per_night <= 0 or price_per_night >= base_price:
        return None
    # ZUERST multiplizieren, dann teilen — und vor dem Abschneiden auf sechs
    # Stellen runden. `1 - 405/450` ist in Gleitkomma 0,09999999999999998; ein
    # direktes `int(... * 100)` machte daraus 9 % statt 10 % und hätte bei Airbnb
    # dauerhaft einen Prozentpunkt zu wenig Rabatt gegeben.
    prozent = int(round((base_price - price_per_night) * 100 / base_price, 6))
    return prozent or None


def aktion_aus_laengenpreis(
    eintrag: dict[str, Any], base_price: float
) -> dict[str, Any]:
    """Längenpreis in die Form einer Aktion bringen (siehe Abschnitts-Kommentar).

    Bewusst dieselben Feldnamen wie eine `property_discounts`-Zeile: so laufen
    `regel_fuer_airbnb`, `per_tagespreis_uebertragbar` und der Status-Chip ohne
    Sonderfall darüber. Ein zweiter Übersetzungspfad wäre die zweite Wahrheit
    über Airbnbs Grenzen.
    """
    prozent = laengenpreis_prozent(
        float(eintrag.get("pricePerNight") or 0), base_price
    )
    return {
        "id": str(eintrag.get("id") or ""),
        "discount_type": DISCOUNT_TYPE_LOS,
        "discount_kind": "percent",
        # 0 heißt „nicht darstellbar" — `_prozent` lehnt es ab und der Grund
        # steht am Posten, statt einen erfundenen Rabatt zu senden (Wurzel 4).
        "discount_bps": (prozent or 0) * 100,
        "min_nights": int(eintrag.get("minNights") or 0),
        "lead_min_days": None,
        "lead_max_days": None,
        "stay_ranges": [],
        "booked_from": None,
        "booked_to": None,
        "promo_codes": [],
        # Längenpreise werden nicht je Kanal eingeschränkt — es gibt dafür keine
        # Oberfläche und keine Spalte. Leer = alle Kanäle.
        "portal_scope": [],
        "active": True,
    }


def laengenpreise_als_aktionen(
    pricing: dict[str, Any], base_price: float
) -> list[dict[str, Any]]:
    """Alle Längenpreise eines Objekts als Aktions-Zeilen."""
    return [
        aktion_aus_laengenpreis(eintrag, base_price)
        for eintrag in (pricing.get("lengthPrices") or [])
        if isinstance(eintrag, dict)
        and str(eintrag.get("id") or "")
        and int(eintrag.get("minNights") or 0) > 0
    ]


def _prozent(regel: dict[str, Any]) -> int | None:
    """Rabatt in ganzen Prozent — oder None, wenn Airbnb das nicht nehmen kann."""
    bps = int(regel.get("discount_bps") or 0)
    if bps <= 0 or bps % 100 != 0:
        return None
    prozent = bps // 100
    if not 1 <= prozent <= PROZENT_MAX:
        return None
    return prozent


def _grund_generell(aktion: dict[str, Any]) -> str | None:
    """Hindernisse, die unabhängig von der Bedingungsart gelten."""
    if not aktion.get("active"):
        return "inaktiv"
    if str(aktion.get("discount_kind") or "percent") != "percent":
        return "pauschalbetrag"
    if aktion.get("promo_codes"):
        return "angebotscode"
    if aktion.get("booked_from") or aktion.get("booked_to"):
        return "buchungszeitraum"
    return None


def _grund_schwelle(typ: str, schwelle: int, preismodell: str) -> str | None:
    """Grenzen der Airbnb-Regel je Art — Herkunft im Modul-Docstring."""
    if preismodell == MODELL_RATE_PLAN or (
        typ == RULE_LOS and preismodell != MODELL_STANDARD
    ):
        return "airbnb_preismodell"
    if typ == RULE_LOS:
        return None if schwelle >= 1 else "nachtzahl_ungueltig"
    if typ == RULE_FRUEHBUCHER:
        passt = schwelle >= 28 and (schwelle % 28 == 0 or schwelle % 30 == 0)
        return None if passt else "vorlauf_nicht_28_30"
    return (
        None if 1 <= schwelle <= LAST_MINUTE_MAX_TAGE else "last_minute_ueber_28"
    )


def _achse(
    aktion: dict[str, Any]
) -> tuple[tuple[str, int] | None, str | None]:
    """Welche EINE buchungsbezogene Bedingung trägt die Aktion?

    `(None, None)` heißt „keine" — dann ist die Aktion Sache des Tagespreises
    und hier ist nichts zu tun.
    """
    achsen = [
        (RULE_LOS, aktion.get("min_nights")),
        (RULE_FRUEHBUCHER, aktion.get("lead_min_days")),
        (RULE_LAST_MINUTE, aktion.get("lead_max_days")),
    ]
    gesetzt = [(typ, wert) for typ, wert in achsen if wert not in (None, "")]
    if not gesetzt:
        return None, None
    if len(gesetzt) > 1:
        # Eine Airbnb-Regel trägt genau EINE Schwelle.
        return None, "bedingungen_kombiniert"
    if aktion.get("stay_ranges"):
        # Die Airbnb-Regel gilt zeitlich unbegrenzt; ein Aufenthaltsfenster
        # ließe sich nur ausdrücken, indem wir die Regel zum Stichtag an- und
        # abschalten. Das wäre ein zweiter, unsichtbarer Zeitplan — nein.
        return None, "zeitraum_mit_bedingung"
    typ, wert = gesetzt[0]
    return (typ, int(wert)), None


def regel_fuer_airbnb(
    aktion: dict[str, Any], *, preismodell: str = MODELL_STANDARD
) -> tuple[dict[str, Any] | None, str | None]:
    """Eine Aktion in EINE Airbnb-Rabattregel übersetzen.

    Rückgabe `(regel, None)` oder `(None, grund)`. Der Grund ist ein Schlüssel,
    damit die Oberfläche ihn übersetzen und das Protokoll ihn auswerten kann.
    """
    grund = _grund_generell(aktion)
    if grund:
        return None, grund

    # Keine buchungsbezogene Bedingung → die Aktion trägt der Tagespreis, und
    # zwar für ALLE Portale (ota_aktionen). Kein Mangel, also auch kein Grund.
    achse, grund = _achse(aktion)
    if achse is None:
        return None, grund

    prozent = _prozent(aktion)
    if prozent is None:
        return None, "prozent_nicht_darstellbar"

    typ, schwelle = achse
    grund = _grund_schwelle(typ, schwelle, preismodell)
    if grund:
        return None, grund
    return (
        {"rule_type": typ, "price_change": prozent, "threshold_one": schwelle},
        None,
    )


def _airbnb_im_scope(aktion: dict[str, Any]) -> bool:
    """Darf diese Aktion überhaupt zu Airbnb? Leerer Scope = alle Kanäle."""
    scope = {str(x) for x in (aktion.get("portal_scope") or [])}
    return not scope or AIRBNB in scope


def regeln_fuer_listing(
    aktionen: list[dict[str, Any]], *, preismodell: str
) -> tuple[list[dict[str, Any]], dict[str, str]]:
    """Soll-Regelliste für EIN Listing + je Aktion der Grund, wenn sie fehlt.

    Doppelte `rule_type` sind nicht erlaubt (eine Regel je Art); bei mehreren
    Kandidaten gewinnt der HÖCHSTE Rabatt — dieselbe Regel wie im Resolver
    (bester Einzelrabatt, kein Stacking).
    """
    beste: dict[str, tuple[int, dict[str, Any]]] = {}
    gruende: dict[str, str] = {}
    for aktion in aktionen:
        kennung = str(aktion.get("id") or "")
        if not _airbnb_im_scope(aktion):
            continue  # bewusst eingeschränkt, kein Mangel
        regel, grund = regel_fuer_airbnb(aktion, preismodell=preismodell)
        if regel is None:
            if grund:
                gruende[kennung] = grund
            continue
        typ = str(regel["rule_type"])
        vorher = beste.get(typ)
        if vorher is None or int(regel["price_change"]) > vorher[0]:
            beste[typ] = (int(regel["price_change"]), regel)
    # Stabile Reihenfolge, damit ein unveränderter Stand auch als unverändert
    # erkannt wird (kein PUT ohne Anlass, Wurzel 2).
    reihen = [RULE_LOS, RULE_FRUEHBUCHER, RULE_LAST_MINUTE]
    return [beste[t][1] for t in reihen if t in beste], gruende


def _mappings(attrs: dict[str, Any]) -> list[dict[str, Any]]:
    """Listing-Mappings eines Kanals aus dem Channel-Objekt.

    Channex liefert die Mappings je nach Kanal als Liste ODER als Objekt
    (Schlüssel = Mapping-ID). Beide Formen werden akzeptiert; ohne Mapping-ID
    ist nichts zu tun (kein geratener Pfad, Wurzel 4).
    """
    roh = attrs.get("mappings")
    if isinstance(roh, dict):
        eintraege = [
            {**(wert or {}), "id": (wert or {}).get("id") or schluessel}
            for schluessel, wert in roh.items()
            if isinstance(wert, dict)
        ]
    elif isinstance(roh, list):
        eintraege = [m for m in roh if isinstance(m, dict)]
    else:
        eintraege = []
    return [m for m in eintraege if m.get("id")]


def _preismodell(mapping: dict[str, Any]) -> str:
    """Preismodell eines Listings. Fehlt die Angabe, gilt Standard — das ist
    Channex' eigener Vorgabewert (`sA(pB.Standard)` im Formularschema), kein
    erfundener Ersatz."""
    modell = mapping.get("pricing_availability_model")
    if isinstance(modell, dict):
        modell = modell.get("type")
    text = str(modell or "").strip().lower()
    return text if text in (MODELL_STANDARD, MODELL_LOS, MODELL_RATE_PLAN) else MODELL_STANDARD


class AirbnbAktionenMixin:
    """Push der Aktions-Bedingungen in Airbnbs Rabattregeln. Mixin des Service."""

    def aktionen_an_airbnb(self, ctx: AuthContext, property_id: str) -> dict[str, Any]:
        """Route-Einstieg: Objekt tenant-gescopt prüfen, dann pushen (Wurzel 3)."""
        tenant_id = self._require_tenant(ctx)  # type: ignore[attr-defined]
        db = self._require_db()  # type: ignore[attr-defined]
        load_scoped(
            db, "properties", property_id, tenant_id, columns="id",
            not_found=ChannelManagerError("Objekt nicht gefunden.", status_code=404),
        )
        return self.sync_airbnb_aktionen(tenant_id, property_id)

    def sync_airbnb_aktionen(
        self, tenant_id: str, property_id: str
    ) -> dict[str, Any]:
        """Soll-Regeln aus `property_discounts` je Airbnb-Listing durchsetzen.

        Einstieg für den Worker (kein AuthContext): der Job trägt den Tenant
        selbst, und jede Abfrage bleibt darauf gescopt.

        Idempotent: geschrieben wird nur, wenn die Soll-Liste vom Ist-Stand
        abweicht (Wurzel 2). Der Rest der Preis-Einstellungen (Währung, Steuern,
        Gebühren) wird unverändert mitgeschickt, weil PUT das ganze Objekt
        ersetzt (Wurzel 1).
        """
        db = self._require_db()  # type: ignore[attr-defined]
        channel_id = self._airbnb_channel_id(db, tenant_id, property_id)
        if not channel_id:
            return {
                "channel_id": None, "listings": 0, "updated": 0,
                "rules": [], "skipped": {},
            }
        # Aktionen UND Längenpreise: beides sind Längen-/Buchungsrabatte, und
        # Airbnb hat für sie dieselbe Regel-Art. Sie konkurrieren deshalb um
        # dieselbe Regel (höherer Rabatt gewinnt, `regeln_fuer_listing`) —
        # getrennt zu pushen hieße, die zweite Regel würde die erste löschen.
        aktionen = self._aktionen_des_objekts(
            db, tenant_id, property_id
        ) + self.laengenpreise_des_objekts(db, tenant_id, property_id)
        kanal = self._channex.get_channel(channel_id)  # type: ignore[attr-defined]
        attrs = (kanal.get("data") or {}).get("attributes") or {}
        mappings = _mappings(attrs)
        if not mappings:
            log.info(
                "airbnb_aktionen_ohne_mapping",
                property_id=property_id, channel_id=channel_id,
            )
        geschrieben = 0
        letzte_regeln: list[dict[str, Any]] = []
        gruende: dict[str, str] = {}
        for mapping in mappings:
            regeln, mapping_gruende = regeln_fuer_listing(
                aktionen, preismodell=_preismodell(mapping)
            )
            gruende.update(mapping_gruende)
            letzte_regeln = regeln
            if self._listing_regeln_setzen(channel_id, str(mapping["id"]), regeln):
                geschrieben += 1
        return {
            "channel_id": channel_id,
            "listings": len(mappings),
            "updated": geschrieben,
            "rules": letzte_regeln,
            "skipped": gruende,
        }

    def _listing_regeln_setzen(
        self, channel_id: str, mapping_id: str, regeln: list[dict[str, Any]]
    ) -> bool:
        """Regeln eines Listings auf den Soll-Stand bringen. True = geschrieben."""
        antwort = self._channex.get_listing_pricing_settings(  # type: ignore[attr-defined]
            channel_id, mapping_id
        )
        ist = (antwort.get("data") or {}).get("attributes") or {}
        vorher = [
            {
                "rule_type": r.get("rule_type"),
                "price_change": r.get("price_change"),
                "threshold_one": r.get("threshold_one"),
            }
            for r in (ist.get("default_pricing_rules") or [])
            if isinstance(r, dict)
        ]
        if vorher == regeln:
            return False
        neu = {k: v for k, v in ist.items() if k != "id"}
        neu["default_pricing_rules"] = regeln
        self._channex.update_listing_pricing_settings(  # type: ignore[attr-defined]
            channel_id, mapping_id, neu
        )
        log.info(
            "airbnb_aktionsregeln_gesetzt",
            channel_id=channel_id, mapping_id=mapping_id,
            vorher=len(vorher), nachher=len(regeln),
        )
        return True

    @staticmethod
    def _airbnb_channel_id(
        db: Client, tenant_id: str, property_id: str
    ) -> str | None:
        """Channex-Kanal-ID der AKTIVEN Airbnb-Verbindung des Objekts."""
        rows = (
            db.table("channex_channel_connection")
            .select("channex_channel_id, is_active")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .eq("ota_portal_code", AIRBNB)
            .execute()
        ).data or []
        for row in rows:
            if row.get("is_active") and row.get("channex_channel_id"):
                return str(row["channex_channel_id"])
        return None

    @staticmethod
    def grundpreis_des_objekts(db: Client, property_id: str) -> float:
        """Grundpreis, aus dem der Längen-Prozentsatz abgeleitet wird.

        Quelle ist `rate_plans` — DIE Preis-Wahrheit (der Preis-Blob ist nur die
        Anzeige-Kopie). Bei MEHREREN property-weiten Plänen gibt es keinen einen
        Grundpreis: ein aus dem zufällig ältesten Plan abgeleiteter Prozentsatz
        wäre für die anderen falsch. Dann kommt 0 zurück, `laengenpreis_prozent`
        meldet „nicht darstellbar" und die Zeile sagt „manuell pflegen" —
        statt einen Rabatt zu senden, der auf halben Plänen nicht stimmt.

        `rate_plans` trägt KEINE tenant_id (RLS läuft über die property, 0016) —
        der Tenant-Scope kommt deshalb vom Aufrufer, der das Objekt bereits
        gescopt geladen hat. Kanal-Pläne (`portal_scope` gesetzt, 0272) sind
        abgeleitete Aufschläge und zählen hier nicht mit.
        """
        rows = (
            db.table("rate_plans")
            .select("base_price")
            .eq("property_id", property_id)
            .is_("portal_scope", "null")
            .order("created_at")
            .limit(2)
            .execute()
        ).data or []
        if len(rows) != 1:
            return 0.0
        try:
            return float(rows[0].get("base_price") or 0)
        except (TypeError, ValueError):
            return 0.0

    @classmethod
    def laengenpreise_des_objekts(
        cls, db: Client, tenant_id: str, property_id: str
    ) -> list[dict[str, Any]]:
        """Längenpreise des Objekts als Aktions-Zeilen — tenant-gescopt (Wurzel 3).

        Auch vom Status-Chip genutzt (`abgaben_status`), damit dort dieselbe
        Rechnung steht wie im Push — sonst behauptete der Chip „geht raus", wo
        der Push abrundet und nichts sendet.
        """
        rows = (
            db.table("properties")
            .select("type_attributes")
            .eq("tenant_id", tenant_id)
            .eq("id", property_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            return []
        pricing = (rows[0].get("type_attributes") or {}).get("pricing") or {}
        if not isinstance(pricing, dict):
            return []
        return laengenpreise_als_aktionen(
            pricing, cls.grundpreis_des_objekts(db, property_id)
        )

    @staticmethod
    def _aktionen_des_objekts(
        db: Client, tenant_id: str, property_id: str
    ) -> list[dict[str, Any]]:
        """Alle Aktionen des Objekts — tenant-gescopt (Wurzel 3)."""
        return (
            db.table("property_discounts")
            .select(
                "id, discount_type, discount_kind, discount_bps, discount_amount, "
                "min_nights, lead_min_days, lead_max_days, stay_ranges, "
                "booked_from, booked_to, promo_codes, portal_scope, active"
            )
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .execute()
        ).data or []
