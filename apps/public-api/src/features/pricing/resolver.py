"""Zentraler Preis-Resolver — die EINE Preis-Wahrheit (Single Source of Truth).

Vorher lagen Preise in vier unverbundenen Quellen, die nicht zusammenspielten
(Objekt-Preise erschienen nicht im Kalender/Quote). Dieser Resolver vereint sie:

  effective_price(property_id, day) -> Effektivpreis EINES Tages in der Reihenfolge
    dynamic_price(Regel-Engine, Tag) > manueller price_override(Tag)
    > weekday_price(Wochentag, falls custom_by_weekday) > rate_plan.base_price.
    Kein Preis vorhanden → None (kein erfundener Fallback).

    Der dynamische Preis steht dabei NUR zur Verfügung, wenn die Agentur Dynamic
    Pricing für das Objekt eingeschaltet hat (`dp_settings.enabled`); sonst wird
    er gar nicht erst geladen. Ab dem Einschalten übernimmt der Autopilot die
    Preisgestaltung nach den eingestellten Kriterien und überstimmt bestehende
    Tagespreise. Beim Ausschalten gilt sofort wieder der manuelle Tagespreis —
    seine Zeile in `price_overrides` bleibt die ganze Zeit unangetastet stehen.

  quote(req) -> vollständige Buchungs-Aufschlüsselung: nimmt die Effektiv-Tages-
    preise, wendet Längenpreis/Kurzaufenthalt/Extra-Gast pro Nacht an, dann
    Kanal-Markup, Gebühren, Aktionen (Rabatt) und Steuern → Summe + Positionen.

Alle Oberflächen (Kalender, Reservierungs-Wizard, Buchungsstrecke) lesen Preise
ausschließlich über diesen Resolver — kein direktes Preis-Tabellenlesen mehr.
"""
# SCHWESTERDATEI — byte-identisch in beiden Bäumen halten:
#     apps/api/src/features/pricing/resolver.py
#     apps/public-api/src/features/pricing/resolver.py
# Die EINE Preisberechnung: Saisons, Aktionen, Aufenthaltsregeln, Kanal-Markup,
# Zusatzleistungen, Abgaben. Sie liegt in der öffentlichen API als Kopie unter
# demselben Importpfad, damit die Datei byte-identisch bleiben kann und der
# CI-Job `public-api-konsistenz` die Gleichheit prüft.
#
# WAS DRIFT ANRICHTET: die Preisvorschau der API nennt einen anderen Betrag als
# die Buchung im Dashboard — der Gast sieht zwei Preise für denselben
# Aufenthalt. Das ist kein Anzeigefehler, sondern ein Streit über Geld.
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal

from supabase import Client

from src.core.dates import nights as _nights
from src.core.logging import get_logger
from src.features.addons.pricing import addon_total

from .schemas import (
    MAX_QUOTE_NIGHTS,
    EffectivePriceDay,
    OptionalFeeOffer,
    QuoteLine,
    QuoteRequest,
    QuoteResponse,
)
from .tierbedingung import ist_tierbedingt

log = get_logger("nextdays.pricing")

# Wochentag-Index (date.weekday(): Mo=0) → Key in weekday_prices.
_WEEKDAY_KEYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")

# Default-Anzeigename je Rabatt-Typ, falls die Regel keinen i18n-Namen trägt.
_DISCOUNT_LABEL = {
    "length_of_stay": "Längen-Rabatt",
    "early_booker": "Frühbucher-Rabatt",
    "last_minute": "Last-Minute-Rabatt",
    "custom": "Rabatt",
    # Eine Promotion ohne Typ-Bedingung (nur Zeitraum/Code/Betrag) — im Standard
    # der Normalfall. Trägt der Betrieb einen gastseitigen Namen ein, gewinnt der.
    # Der Begriff ist bewusst „Promotion" (so heißt der Abschnitt in der
    # Oberfläche, auch auf Deutsch) — derselbe Posten darf nicht auf der Rechnung
    # anders heißen als im Formular.
    "promotion": "Promotion",
}


def _pick_locale_text(name: object, locale: str = "en") -> str | None:
    """Aus einem i18n-jsonb {locale: text} den Text in `locale` wählen.

    Reihenfolge: die verlangte Sprache → Englisch → der erste vorhandene Wert.
    None, wenn leer/kein dict.

    WARUM NICHT MEHR HART 'de': das Produkt läuft in 27 Ländern, und jede Zeile
    dieser Aufschlüsselung liest ein GAST. Ein fester Vorzug auf Deutsch war
    kein technischer Default, sondern eine inhaltliche Aussage, die sich als
    einer getarnt hat — für einen dänischen Gast ist „Haustiergebühr" auf seiner
    Rechnung keine neutrale Voreinstellung, sondern falsch (Wurzel 4). Dieselbe
    Begründung steht bereits in Migration 0335 für die Mail-Sprache; hier war
    die letzte Stelle, an der die alte Annahme noch stand.

    Englisch als Zwischenstufe aus demselben Grund wie dort (`core.mail_sprache
    .FALLBACK`): es wird als Ausweichsprache erkannt, Deutsch als
    Herkunftsaussage. Der letzte Rückfall bleibt „irgendein gepflegter Text",
    denn ein leeres Label wäre schlechter als ein fremdsprachiges: der Gast
    sähe einen Betrag ohne Bezeichnung.
    """
    if not isinstance(name, dict) or not name:
        return None
    # Regionsvariante auf die Basissprache kappen: die Kataloge sind nach
    # 2-Buchstaben-Codes geschlüsselt (`web/messages/*.json`), ein „de-AT" aus
    # einem Accept-Language-Header würde sonst nie treffen. Gleiche Regel wie
    # `core.mail_sprache.normalisieren`.
    code = str(locale or "").strip().lower().replace("_", "-").split("-", 1)[0]
    val = (
        name.get(code)
        or name.get("en")
        or next((v for v in name.values() if v), None)
    )
    return str(val) if val else None


def _gilt_fuer_kanal(eintrag: dict, channel: str) -> bool:
    """Greift diese Gebühr/Steuer auf dem Kanal dieser Anfrage?

    Die Kanal-Einschränkung (`portalScope`) zählt die eigene Buchungsstrecke
    mit — im Branchenstandard steht sie im Einschränkungs-Dialog gleichrangig
    neben Airbnb und Booking.com (live abgelesen 03.08.2026). Eine Gebühr „nur
    an Booking" darf deshalb auch in einer Direktbuchung nicht erscheinen; ohne
    diese Prüfung stünde sie hier auf der Rechnung, obwohl die Oberfläche das
    Gegenteil behauptet.

    Leer/fehlend = alle Kanäle.
    """
    scope = eintrag.get("portalScope")
    if not isinstance(scope, list) or not scope:
        return True
    return channel in {str(x) for x in scope}


def _in_zeitraum(tag: date, von: object, bis: object) -> bool:
    """Liegt `tag` im (beidseitig inklusiven) Zeitraum? Fehlende Grenze = offen."""
    if von and tag < date.fromisoformat(str(von)):
        return False
    if bis and tag > date.fromisoformat(str(bis)):
        return False
    return True


def _aktion_greift(  # pylint: disable=too-many-return-statements
    regel: dict,
    *,
    nights: int,
    check_in: date,
    as_of: date,
    channel: str,
    code: str,
) -> bool:
    """Treffen ALLE Bedingungen dieser Aktion zu?

    UND-Verknüpfung, wie im Branchenstandard: unter „Art der Aktion" stehen drei
    unabhängige Checkboxen, dazu Aufenthaltsdaten, Buchungsdaten und
    Angebotscodes. Jede gesetzte Bedingung muss erfüllt sein; eine NICHT gesetzte
    schränkt nicht ein. Fehlt jede, gilt die Aktion immer — das ist eine bewusste
    Eingabe des Betriebs („20 % auf alles"), kein Versehen.

    Fail-CLOSED bei kaputtem Datum: ein unlesbares Grenzdatum darf nicht dazu
    führen, dass die Bedingung wegfällt und der Rabatt plötzlich überall greift
    (Wurzel 5).
    """
    # Kanal — dieselbe Achse wie bei Gebühren/Steuern.
    scope = regel.get("portal_scope")
    if isinstance(scope, list) and scope and channel not in {str(x) for x in scope}:
        return False

    # Angebotscode: gesetzt heißt „nur mit einem dieser Codes".
    codes = [str(c).strip().upper() for c in (regel.get("promo_codes") or [])]
    codes = [c for c in codes if c]
    if codes and code not in codes:
        return False

    # Mindestaufenthalt.
    mn = regel.get("min_nights")
    if mn is not None and nights < int(mn):
        return False

    # Vorlauf zwischen Buchung und Anreise. Frühbucher = Untergrenze,
    # Last Minute = Obergrenze; beide zusammen ergeben ein Fenster.
    days_ahead = (check_in - as_of).days
    lead_min = regel.get("lead_min_days")
    lead_max = regel.get("lead_max_days")
    if lead_min is not None and days_ahead < int(lead_min):
        return False
    if lead_max is not None and not 0 <= days_ahead <= int(lead_max):
        return False

    # Aufenthaltsdaten werden hier NICHT geprüft: sie entscheiden nicht ob,
    # sondern WORAUF die Aktion wirkt — deckt der Zeitraum nur einen Teil des
    # Aufenthalts ab, gilt sie nur für die Nächte darin (`_rabatt_basis`). Eine
    # Prüfung an dieser Stelle hätte den Rabatt auf den GANZEN Aufenthalt
    # gegeben, sobald der Anreisetag im Zeitraum lag — und gar nicht, wenn der
    # Gast einen Tag früher anreiste.
    try:
        # Daten der Buchung: wann gebucht wird, nicht wann angereist wird.
        if not _in_zeitraum(as_of, regel.get("booked_from"), regel.get("booked_to")):
            return False
    except ValueError:
        return False
    return True


def _rabatt_basis(regel: dict, nacht_betrag: dict[date, float]) -> float:
    """Auf welchen Betrag wirkt diese Aktion?

    ZWEI Festlegungen des Branchenstandards, beide live abgelesen (03.08.2026):

    * Grundlage ist der Übernachtungswert der Buchung — „% des Gesamtwerts der
      Buchung (exkl. Gebühren, Steuern & Aktionen)" steht wörtlich am Wert-Feld.
      Gebühren zu rabattieren wäre eine andere Zusage, als die Oberfläche macht.
    * Mit Aufenthaltsdaten zählen NUR die Nächte im Zeitraum: „Wenn die
      Werbeaktion nur einen Teil der im Aufenthalt enthaltenen Tage abdeckt, gilt
      sie nur für die Tage, die in den Aktionszeitraum fallen." Damit rechnet die
      Buchungsstrecke dasselbe wie der Portal-Push, der schon immer je Tag
      rabattiert (`channel_manager/ota_aktionen.aktionsfaktor_je_tag`).

    Fail-closed: ein unlesbares Grenzdatum ergibt Basis 0 (kein Rabatt), statt
    den Zeitraum zu „gilt immer" aufzuweiten (Wurzel 5).
    """
    ranges = [z for z in (regel.get("stay_ranges") or []) if isinstance(z, dict)]
    if not ranges:
        return sum(nacht_betrag.values())
    summe = 0.0
    for tag, betrag in nacht_betrag.items():
        try:
            passt = any(
                _in_zeitraum(tag, z.get("from"), z.get("to")) for z in ranges
            )
        except ValueError:
            return 0.0
        if passt:
            summe += betrag
    return summe


class PricingError(Exception):
    """Fachlicher Preis-Fehler; vom Router auf HTTP-Status gemappt."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


# Kaskade ist per Service verboten (Parent MUSS manual sein) — der Resolver
# braucht trotzdem einen Backstop gegen Fehldaten in der DB (A→B→A; der CHECK
# verbietet nur die Selbstreferenz). Ein besuchter Plan darf in einer Kette nie
# zweimal vorkommen: erkennt den Zyklus SOFORT statt nach n Ebenen (fail-closed).
_MAX_DERIVE_DEPTH = 4


@dataclass(frozen=True)
class _RatePlanMeta:
    """Preis-relevante Metadaten eines Rate-Plans (aus rate_plans)."""

    base: float | None
    currency: str | None
    rate_mode: str
    parent_id: str | None
    offset_amount: float | None
    offset_percent: float | None


def _apply_offset(
    parent_price: float | None,
    offset_amount: float | None,
    offset_percent: float | None,
) -> float | None:
    """Abgeleiteten Preis rechnen: erst Betrag, dann Prozent (SiteMinder-
    Reihenfolge). Kaufmännisch auf 2 Nachkommastellen. Ergebnis ≤ 0 oder Parent
    ohne Preis → None (fail-closed, kein 0-€-Verkauf, kein Clamp — Wurzel 4/5)."""
    if parent_price is None:
        return None
    val = Decimal(str(parent_price))
    if offset_amount is not None:
        val += Decimal(str(offset_amount))
    if offset_percent is not None:
        val *= Decimal(1) + Decimal(str(offset_percent)) / Decimal(100)
    val = val.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if val <= 0:
        return None
    return float(val)


def _to_float(value: object) -> float | None:
    """numeric/str → float; None bei fehlendem/ungültigem Wert (kein Fallback)."""
    if value is None:
        return None
    try:
        return float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None




class _PricingConfig:
    """Gelesene Pricing-Konfiguration eines Objekts (aus property_pricing_config).

    Hält die für den Resolver relevanten Felder typsicher vor. Fehlt die Zeile,
    sind alle Aufschläge 0/leer (das Objekt nutzt dann nur Basispreis/Overrides).
    """

    def __init__(self, row: dict | None) -> None:
        row = row or {}
        self.currency: str | None = row.get("currency") or None
        self.custom_by_weekday: bool = bool(row.get("custom_by_weekday"))
        self.weekday_prices: dict[str, object] = row.get("weekday_prices") or {}
        self.extra_guest_charge: float = _to_float(row.get("extra_guest_charge")) or 0.0
        self.extra_guest_from: int = int(row.get("extra_guest_from") or 1)
        self.short_stay_max_nights: int = int(row.get("short_stay_max_nights") or 0)
        self.short_stay_surcharge: float = (
            _to_float(row.get("short_stay_surcharge")) or 0.0
        )
        self.length_prices: list[dict] = [
            lp for lp in (row.get("length_prices") or []) if isinstance(lp, dict)
        ]
        self.fees: list[dict] = [
            f for f in (row.get("fees") or []) if isinstance(f, dict)
        ]
        self.taxes: list[dict] = [
            t for t in (row.get("taxes") or []) if isinstance(t, dict)
        ]
        # `promotions` (Blob) wird BEWUSST nicht mehr geladen: dort war die
        # Bedingung ein Freitext, der nie geprüft wurde — der Rabatt lief auf
        # jede Buchung. Aktionen kommen seit 0276 aus `property_discounts` mit
        # prüfbaren Bedingungen (siehe `_best_discount`). Die Spalte bleibt
        # vorerst stehen (Altbestand lesbar halten), wird aber nicht gerechnet.

    def weekday_price(self, day: date) -> float | None:
        if not self.custom_by_weekday:
            return None
        return _to_float(self.weekday_prices.get(_WEEKDAY_KEYS[day.weekday()]))

    def length_price_per_night(self, nights: int) -> float | None:
        """Reduzierter Nachtpreis für die längste passende Längen-Regel (>= minNights)."""
        best_min = -1
        best_price: float | None = None
        for lp in self.length_prices:
            min_nights = int(lp.get("minNights") or 0)
            price = _to_float(lp.get("pricePerNight"))
            if price is None or min_nights <= 0 or nights < min_nights:
                continue
            if min_nights > best_min:
                best_min = min_nights
                best_price = price
        return best_price



class PricingResolver:
    slice_name = "pricing"

    def __init__(self, service_client: Client | None = None) -> None:
        self._client = service_client

    def _db(self) -> Client:
        if self._client is None:
            raise PricingError("Preis-DB nicht verfügbar.", status_code=500)
        return self._client

    # -- Quellen einmalig laden ----------------------------------------------
    def _load_config(self, property_id: str) -> _PricingConfig:
        """Pricing-Konfiguration eines Objekts (Aufschläge/Gebühren/Steuern).

        Die Konfig ist OPTIONAL: fehlt sie (kein Eintrag — oder die Tabelle ist
        in einer noch nicht migrierten Umgebung gar nicht vorhanden), gelten
        keine Aufschläge. Das ist KEIN erfundener Preis — Basispreis/Override
        bleiben die Wahrheit; es entfallen nur die optionalen Zuschläge. So
        bleibt der Kalender unabhängig vom Migrationsstand funktionsfähig."""
        try:
            res = (
                self._db()
                .table("property_pricing_config")
                .select("*")
                .eq("property_id", property_id)
                .limit(1)
                .execute()
            ).data or []
        except Exception as exc:  # noqa: BLE001 — fehlende Tabelle = leere Konfig
            log.warning("pricing_config_unavailable", error=str(exc))
            return _PricingConfig(None)
        return _PricingConfig(res[0] if res else None)

    def _property_currency(self, property_id: str) -> str | None:
        """Zentrale Objektwährung (properties.currency, Migration 0161) — die
        Wahrheit, wenn kein Rate-Plan die Währung liefert. ECHTER gespeicherter
        Wert, kein Fallback-Ersatz (Wurzel 4): fehlt sie, bleibt es None und die
        Anzeige rendert symbollos, nie ein erfundenes €."""
        try:
            res = (
                self._db()
                .table("properties")
                .select("currency")
                .eq("id", property_id)
                .limit(1)
                .execute()
            ).data or []
        except Exception as exc:  # noqa: BLE001 — kein Kippen des Quotes
            log.warning("property_currency_unavailable", error=str(exc))
            return None
        return (res[0].get("currency") if res else None) or None

    def _load_addons(
        self, property_id: str, addon_ids: list[str]
    ) -> dict[str, dict]:
        """Aktive Katalog-Add-ons des Objekts zu den gewählten IDs (id → Zeile).

        Filtert auf property_id UND active=true, damit der Quote nur echte,
        freigegebene Upsells dieses Objekts bepreist (kein Vertrauen auf Input)."""
        if not addon_ids:
            return {}
        try:
            rows = (
                self._db()
                .table("property_addons")
                .select("id, name, price, basis, tax_rate")
                .eq("property_id", property_id)
                .eq("active", True)
                .in_("id", addon_ids)
                .execute()
            ).data or []
        except Exception as exc:  # noqa: BLE001 — fehlende Tabelle = keine Add-ons
            log.warning("pricing_addons_unavailable", error=str(exc))
            return {}
        return {str(r["id"]): r for r in rows}

    def _load_rate_plan(self, property_id: str) -> tuple[float | None, str | None]:
        """Basispreis + Währung aus dem (ersten) Rate-Plan. Ohne Plan → (None, None)."""
        res = (
            self._db()
            .table("rate_plans")
            .select("base_price, currency")
            .eq("property_id", property_id)
            .order("created_at")
            .limit(1)
            .execute()
        ).data or []
        if not res:
            return None, None
        return _to_float(res[0].get("base_price")), res[0].get("currency") or None

    def _load_rate_plan_meta(
        self, property_id: str, rate_plan_id: str
    ) -> _RatePlanMeta:
        """Metadaten EINES konkreten Rate-Plans (Basispreis, Währung, rate_mode,
        Ableitung), an das Objekt gebunden.

        Der property_id-Filter ist der Scope-Backstop (Service-Role umgeht RLS):
        ein fremder/gelöschter Plan ist ein Datenfehler des Aufrufers → 422,
        NIE stiller Fallback auf den ältesten Plan (der wäre der falsche Preis).
        """
        res = (
            self._db()
            .table("rate_plans")
            .select(
                "id, base_price, currency, rate_mode, "
                "derived_from_rate_plan_id, offset_amount, offset_percent"
            )
            .eq("id", rate_plan_id)
            .eq("property_id", property_id)
            .limit(1)
            .execute()
        ).data or []
        if not res:
            raise PricingError(
                "Rate-Plan gehört nicht zu diesem Objekt oder existiert nicht.",
                status_code=422,
            )
        row = res[0]
        return _RatePlanMeta(
            base=_to_float(row.get("base_price")),
            currency=row.get("currency") or None,
            rate_mode=row.get("rate_mode") or "manual",
            parent_id=row.get("derived_from_rate_plan_id"),
            offset_amount=_to_float(row.get("offset_amount")),
            offset_percent=_to_float(row.get("offset_percent")),
        )

    def _load_overrides(
        self, property_id: str, check_in: date, check_out: date
    ) -> dict[str, float]:
        res = (
            self._db()
            .table("price_overrides")
            .select("date, price")
            .eq("property_id", property_id)
            .gte("date", check_in.isoformat())
            .lt("date", check_out.isoformat())
            .not_.is_("price", "null")
            .execute()
        ).data or []
        out: dict[str, float] = {}
        for r in res:
            day, price = r.get("date"), _to_float(r.get("price"))
            if isinstance(day, str) and price is not None:
                out[day] = price
        return out

    def _load_rate_plan_overrides(
        self, rate_plan_id: str, check_in: date, check_out: date
    ) -> dict[str, float]:
        """Datumsgenaue Preise EINES Rate-Plans (Hotel: Twin/BAR ≠ Double/B&B).

        Optional wie die anderen Zusatzquellen: fehlt die Tabelle (Umgebung noch
        nicht auf 0146 migriert), gilt leer → der Resolver fällt sauber auf den
        property-weiten Override/Base zurück (kein erfundener Preis, kein Crash)."""
        try:
            res = (
                self._db()
                .table("rate_plan_price_overrides")
                .select("date, price")
                .eq("rate_plan_id", rate_plan_id)
                .gte("date", check_in.isoformat())
                .lt("date", check_out.isoformat())
                .not_.is_("price", "null")
                .execute()
            ).data or []
        except Exception as exc:  # noqa: BLE001 — fehlende Tabelle = keine RP-Preise
            log.warning("rate_plan_price_overrides_unavailable", error=str(exc))
            return {}
        out: dict[str, float] = {}
        for r in res:
            day, price = r.get("date"), _to_float(r.get("price"))
            if isinstance(day, str) and price is not None:
                out[day] = price
        return out

    def _dp_enabled(self, property_id: str) -> bool:
        """Hat die Agentur Dynamic Pricing für DIESES Objekt eingeschaltet?

        Das Gate für die gesamte Rangfolge (siehe `_effective_for_day`). Es sitzt
        bewusst am LADEN und nicht an der Auswertung: bei `false` kommt gar kein
        dynamic_price in den Resolver, damit greifen sofort wieder Override →
        Wochentag → Basis. Die berechneten Zeilen bleiben dabei unangetastet in
        `dynamic_prices` stehen (sie sind Vorschau/Empfehlung) — ohne dieses Gate
        wären sie nach dem Abschalten Geisterpreise, die weiter gälten.

        Fail-CLOSED: fehlende Zeile/Tabelle oder Query-Fehler = DP AUS. Ein
        stiller Fehler darf nie dazu führen, dass der Autopilot den manuellen
        Preis des Betriebs überstimmt."""
        try:
            res = (
                self._db()
                .table("dp_settings")
                .select("enabled")
                .eq("property_id", property_id)
                .limit(1)
                .execute()
            ).data or []
        except Exception as exc:  # noqa: BLE001 — fehlende Tabelle = DP aus
            log.warning("dp_settings_unavailable", error=str(exc))
            return False
        return bool(res) and bool(res[0].get("enabled"))

    def _load_dynamic(
        self, property_id: str, check_in: date, check_out: date
    ) -> dict[str, dict]:
        """Dynamic-Pricing-Tagespreise (Regel-Engine) inkl. Faktor-Aufschlüsselung.
        {ISO-Datum: {"price": float, "factors": dict}}. Optional wie die Konfig:
        fehlt die Tabelle (nicht migriert) oder die factors-Spalte → leer/None, der
        Resolver fällt auf weekday/base zurück (kein erfundener Preis).

        Ist Dynamic Pricing für das Objekt AUS, wird nichts geladen — der zuvor
        berechnete Bestand darf dann nicht mehr wirken (siehe `_dp_enabled`)."""
        if not self._dp_enabled(property_id):
            return {}
        try:
            res = (
                self._db()
                .table("dynamic_prices")
                .select("date, price, factors")
                .eq("property_id", property_id)
                .gte("date", check_in.isoformat())
                .lt("date", check_out.isoformat())
                .execute()
            ).data or []
        except Exception as exc:  # noqa: BLE001 — fehlende Tabelle/Spalte = kein DP
            log.warning("dynamic_prices_unavailable", error=str(exc))
            return {}
        out: dict[str, dict] = {}
        for r in res:
            day, price = r.get("date"), _to_float(r.get("price"))
            if isinstance(day, str) and price is not None:
                factors = r.get("factors")
                out[day] = {
                    "price": price,
                    "factors": factors if isinstance(factors, dict) else None,
                }
        return out

    # -- Effektivpreis pro Tag ------------------------------------------------
    def effective_price(
        self, property_id: str, day: date, *, rate_plan_id: str | None = None
    ) -> EffectivePriceDay:
        """Effektivpreis EINES Tages: rate_plan > dynamic (nur bei aktivem DP)
        > override > weekday > base.

        `rate_plan_id` optional — nur gesetzt, wenn ein KONKRETER Rate-Plan bepreist
        wird (Channex-Push pro Rate-Plan, Hotel-Quote). Ohne ihn bleibt das Verhalten
        property-weit wie bisher (FeWo, Kalender-Board)."""
        nxt = day + timedelta(days=1)
        return self.effective_prices(
            property_id, day, nxt, rate_plan_id=rate_plan_id
        )[0]

    @staticmethod
    def _effective_for_day(
        day: date,
        overrides: dict[str, float],
        dynamic: dict[str, dict],
        config: _PricingConfig,
        base: float | None,
        rate_plan_overrides: dict[str, float] | None = None,
    ) -> EffectivePriceDay:
        key = day.isoformat()
        # Datumsgenauer Preis DIESES Rate-Plans gewinnt vor allem anderen (Hotel:
        # Twin/BAR und Double/B&B können am selben Tag verschieden sein).
        if rate_plan_overrides and key in rate_plan_overrides:
            return EffectivePriceDay(
                date=day, price=rate_plan_overrides[key], source="rate_plan"
            )
        # Dynamic Pricing gewinnt vor dem manuellen Tagespreis — aber NUR, wenn die
        # Agentur es für dieses Objekt eingeschaltet hat: `dynamic` ist sonst leer
        # (Gate in `_load_dynamic`/`_load_dynamic_bulk`). Ab dem Einschalten
        # übernimmt der Autopilot die Preisgestaltung nach den eingestellten
        # Kriterien; beim Ausschalten greift der manuelle Preis sofort wieder,
        # weil seine Zeile in `price_overrides` unangetastet stehen bleibt.
        if key in dynamic:
            return EffectivePriceDay(
                date=day,
                price=dynamic[key]["price"],
                source="dynamic",
                factors=dynamic[key].get("factors"),
            )
        if key in overrides:
            return EffectivePriceDay(date=day, price=overrides[key], source="override")
        weekday = config.weekday_price(day)
        if weekday is not None:
            return EffectivePriceDay(date=day, price=weekday, source="weekday")
        if base is not None:
            return EffectivePriceDay(date=day, price=base, source="base")
        return EffectivePriceDay(date=day, price=None, source="none")

    def effective_prices(
        self,
        property_id: str,
        check_in: date,
        check_out: date,
        *,
        rate_plan_id: str | None = None,
    ) -> list[EffectivePriceDay]:
        """Effektivpreise für jeden Tag [check_in, check_out) in EINEM Lauf.

        `rate_plan_id` optional (siehe effective_price): gesetzt → DESSEN
        Basispreis ist die durchgehende Grundlinie und dessen datumsgenaue
        Preise gewinnen; None → property-weit wie bisher.

        Der Zeitraum ist gedeckelt (Wurzel 8). `/pricing/effective` reicht
        `start`/`end` ungeprüft aus der Query hierher; `start=1000-01-01&
        end=3000-01-01` baute ~730 000 Tagesobjekte plus vier Bereichs-Queries
        in EINEM Request. Der Deckel sitzt hier statt in der Route, damit er für
        jeden Aufrufer gilt — `quote` (MAX_QUOTE_NIGHTS) und das Rate-Grid
        (_GRID_MAX_DAYS) haben ihn längst.
        """
        if check_out <= check_in:
            raise PricingError(
                "Das Ende muss nach dem Anfang liegen.", status_code=422
            )
        if (check_out - check_in).days > MAX_QUOTE_NIGHTS:
            raise PricingError(
                f"Zeitraum zu lang (höchstens {MAX_QUOTE_NIGHTS} Tage).",
                status_code=422,
            )
        overrides = self._load_overrides(property_id, check_in, check_out)
        dynamic = self._load_dynamic(property_id, check_in, check_out)
        config = self._load_config(property_id)
        days = _nights(check_in, check_out)
        if rate_plan_id:
            return self._rate_plan_curve(
                property_id, rate_plan_id, days, check_in, check_out,
                overrides, dynamic, config,
            )
        base, _currency = self._load_rate_plan(property_id)
        return [
            self._effective_for_day(day, overrides, dynamic, config, base, {})
            for day in days
        ]

    def _rate_plan_curve(
        self,
        property_id: str,
        rate_plan_id: str,
        days: list[date],
        check_in: date,
        check_out: date,
        overrides: dict[str, float],
        dynamic: dict[str, dict],
        config: _PricingConfig,
        _seen: frozenset[str] = frozenset(),
    ) -> list[EffectivePriceDay]:
        """Tages-Preiskurve EINES Rate-Plans über [check_in, check_out).

        manual: base + eigene Datumspreise > dynamic (nur bei aktivem DP)
        > override > weekday > base.
        derived: Parent-Kurve rekursiv auflösen, dann pro Tag den Offset anwenden
        (erst Betrag, dann Prozent; ≤ 0 → kein Preis). Property-weite override/
        dynamic/weekday gelten NUR für manual — ein abgeleiteter Preis folgt
        ausschließlich seinem Parent (sonst zwei konkurrierende Quellen, Wurzel 4).

        `_seen` trägt die bereits besuchten Pläne der Kette (Zyklen-Backstop)."""
        meta = self._load_rate_plan_meta(property_id, rate_plan_id)
        if meta.rate_mode == "derived" and meta.parent_id:
            # Zyklus (A→B→A) oder zu tiefe Kette: beides sind Fehldaten, die der
            # Service nicht zulässt — hier fail-closed statt Endlos-Rekursion.
            if meta.parent_id in _seen or len(_seen) >= _MAX_DERIVE_DEPTH:
                raise PricingError(
                    "Ableitungskette zu tief oder zyklisch.", status_code=422
                )
            parent = self._rate_plan_curve(
                property_id, meta.parent_id, days, check_in, check_out,
                overrides, dynamic, config, _seen | {rate_plan_id},
            )
            return [
                EffectivePriceDay(
                    date=p.date,
                    price=_apply_offset(
                        p.price, meta.offset_amount, meta.offset_percent
                    ),
                    source="derived",
                )
                for p in parent
            ]
        rp_over = self._load_rate_plan_overrides(rate_plan_id, check_in, check_out)
        return [
            self._effective_for_day(
                day, overrides, dynamic, config, meta.base, rp_over
            )
            for day in days
        ]

    # -- Batch: viele Objekte in EINEM Lauf (Board-Endpunkt) ------------------
    def effective_prices_bulk(
        self, property_ids: list[str], check_in: date, check_out: date
    ) -> dict[str, list[EffectivePriceDay]]:
        """Effektivpreise für VIELE Objekte, mit je EINER `.in_()`-Query pro Quelle
        statt 4 Queries pro Objekt (N+1-Auflösung → 4 Queries gesamt).

        Liefert {property_id: [EffectivePriceDay,…]}. Nutzt dieselbe
        `_effective_for_day`-Logik wie der Einzelpfad — eine Preis-Wahrheit."""
        if not property_ids:
            return {}
        overrides = self._load_overrides_bulk(property_ids, check_in, check_out)
        dynamic = self._load_dynamic_bulk(property_ids, check_in, check_out)
        configs = self._load_config_bulk(property_ids)
        bases = self._load_rate_plan_bulk(property_ids)
        days = _nights(check_in, check_out)
        empty_cfg = _PricingConfig(None)
        out: dict[str, list[EffectivePriceDay]] = {}
        for pid in property_ids:
            ov = overrides.get(pid, {})
            dyn = dynamic.get(pid, {})
            cfg = configs.get(pid, empty_cfg)
            base = bases.get(pid)
            out[pid] = [
                self._effective_for_day(day, ov, dyn, cfg, base) for day in days
            ]
        return out

    def _load_overrides_bulk(
        self, property_ids: list[str], check_in: date, check_out: date
    ) -> dict[str, dict[str, float]]:
        res = (
            self._db()
            .table("price_overrides")
            .select("property_id, date, price")
            .in_("property_id", property_ids)
            .gte("date", check_in.isoformat())
            .lt("date", check_out.isoformat())
            .not_.is_("price", "null")
            .execute()
        ).data or []
        out: dict[str, dict[str, float]] = {}
        for r in res:
            pid, day, price = r.get("property_id"), r.get("date"), _to_float(r.get("price"))
            if isinstance(pid, str) and isinstance(day, str) and price is not None:
                out.setdefault(pid, {})[day] = price
        return out

    def _dp_enabled_bulk(self, property_ids: list[str]) -> set[str]:
        """Die Objekte aus `property_ids`, für die Dynamic Pricing AN ist.

        Sammelabfrage statt `_dp_enabled` je Objekt — der Board-Pfad lädt
        hunderte Objekte, eine Query je Objekt wäre ein N+1. Fail-CLOSED wie
        der Einzelpfad: wer nicht in der Menge steht, hat DP aus."""
        if not property_ids:
            return set()
        try:
            res = (
                self._db()
                .table("dp_settings")
                .select("property_id, enabled")
                .in_("property_id", property_ids)
                .execute()
            ).data or []
        except Exception as exc:  # noqa: BLE001 — fehlende Tabelle = DP aus
            log.warning("dp_settings_bulk_unavailable", error=str(exc))
            return set()
        return {
            r["property_id"]
            for r in res
            if isinstance(r.get("property_id"), str) and r.get("enabled")
        }

    def _load_dynamic_bulk(
        self, property_ids: list[str], check_in: date, check_out: date
    ) -> dict[str, dict[str, dict]]:
        # Nur Objekte MIT eingeschaltetem Dynamic Pricing (Gate wie im
        # Einzelpfad, siehe _dp_enabled). Ist es nirgends an, entfällt die
        # dynamic_prices-Query ganz.
        aktiv = self._dp_enabled_bulk(property_ids)
        if not aktiv:
            return {}
        # KEIN try/except-Fallback: schlägt die Query fehl, muss der Board-Call
        # hart scheitern (500) statt still leere DP-Preise zu liefern und damit
        # falsche (zu niedrige) Tagespreise anzuzeigen.
        res = (
            self._db()
            .table("dynamic_prices")
            .select("property_id, date, price, factors")
            .in_("property_id", sorted(aktiv))
            .gte("date", check_in.isoformat())
            .lt("date", check_out.isoformat())
            .execute()
        ).data or []
        out: dict[str, dict[str, dict]] = {}
        for r in res:
            pid, day, price = r.get("property_id"), r.get("date"), _to_float(r.get("price"))
            if isinstance(pid, str) and isinstance(day, str) and price is not None:
                factors = r.get("factors")
                out.setdefault(pid, {})[day] = {
                    "price": price,
                    "factors": factors if isinstance(factors, dict) else None,
                }
        return out

    def _load_config_bulk(self, property_ids: list[str]) -> dict[str, _PricingConfig]:
        # KEIN try/except-Fallback: ein Query-Fehler muss den Board-Call scheitern
        # lassen (500), nicht still eine leere Preis-Konfig unterstellen.
        res = (
            self._db()
            .table("property_pricing_config")
            .select("*")
            .in_("property_id", property_ids)
            .execute()
        ).data or []
        return {
            r["property_id"]: _PricingConfig(r)
            for r in res
            if isinstance(r.get("property_id"), str)
        }

    def _load_rate_plan_bulk(
        self, property_ids: list[str]
    ) -> dict[str, float | None]:
        """Basispreis je Objekt (erster Rate-Plan). Bei mehreren Plänen gewinnt der
        älteste (created_at) — wie der Einzelpfad `_load_rate_plan`."""
        res = (
            self._db()
            .table("rate_plans")
            .select("property_id, base_price, created_at")
            .in_("property_id", property_ids)
            .order("created_at")
            .execute()
        ).data or []
        out: dict[str, float | None] = {}
        for r in res:
            pid = r.get("property_id")
            if isinstance(pid, str) and pid not in out:  # erster = ältester
                out[pid] = _to_float(r.get("base_price"))
        return out

    def _best_discount(  # pylint: disable=too-many-arguments
        self,
        property_id: str,
        nights: int,
        check_in: date,
        as_of: date,
        *,
        channel: str,
        promo_code: str | None,
        nacht_betrag: dict[date, float],
    ) -> tuple[dict, float] | None:
        """Die AKTIVE Aktion mit der höchsten greifenden Ersparnis — oder None.

        BESTER EINZELRABATT, kein Stacking (Produktentscheidung, Booking/Airbnb-
        Standard): mehrere greifende Aktionen addieren sich NICHT. Deterministisch
        (`as_of` aus dem Request, kein `date.today()` tief in der Rechnung).

        Seit 0276 trägt eine Aktion BELIEBIG VIELE Bedingungen, die ALLE zutreffen
        müssen (UND) — so führt es der Branchenstandard, und so meint es der
        Betrieb: „20 % im Juni, ab 5 Nächten, nur mit Code SOMMER" ist EINE Aktion
        mit drei Bedingungen, nicht drei Aktionen. `discount_type` ist dabei nur
        noch die Art für die Anzeige; ausgewertet werden die Achsen.

        Vorher wurde je Typ GENAU EINE Bedingung geprüft und der Rest ignoriert.
        Die Aktionen der Preise-Seite hatten überhaupt keine prüfbare Bedingung
        (Freitext) und wurden auf jede Buchung angewandt.

        AUSNAHME vom „höchsten Wert": ein gültiger Angebotscode hat Vorrang und
        verdrängt die automatischen Aktionen, auch wenn sie mehr gebracht hätten
        (siehe Code-Vorrang unten).
        """
        try:
            rows = (
                self._db()
                .table("property_discounts")
                .select(
                    "discount_type, discount_kind, discount_bps, discount_amount, "
                    "min_nights, lead_min_days, lead_max_days, stay_ranges, "
                    "booked_from, booked_to, promo_codes, portal_scope, name"
                )
                .eq("property_id", property_id)
                .eq("active", True)
                .execute()
            ).data or []
        except Exception:  # noqa: BLE001 — fehlende Tabelle/Fehler = kein Rabatt
            return None
        code = (promo_code or "").strip().upper()
        # Kandidaten mit ihrer Ersparnis und der Angabe, ob sie an einem CODE
        # hängen — die Trennung braucht der Vorrang weiter unten.
        kandidaten: list[tuple[dict, float, bool]] = []
        for r in rows:
            if not _aktion_greift(
                r,
                nights=nights,
                check_in=check_in,
                as_of=as_of,
                channel=channel,
                code=code,
            ):
                continue
            basis = _rabatt_basis(r, nacht_betrag)
            if basis <= 0:
                # Kein Aufenthaltstag im Zeitraum → die Aktion greift nicht.
                continue
            # Verglichen wird die ERSPARNIS IN GELD, nicht der Prozentsatz: „der
            # Wert der Aktion" entscheidet (Branchenstandard: „wendet das System
            # automatisch die Aktion mit dem höchsten Wert an"). Vorher wurde nur
            # `discount_bps` verglichen — eine Pauschale trägt dort den
            # Mindestwert 1 und konnte deshalb NIE gewinnen, auch 200 € nicht
            # gegen 5 %.
            if str(r.get("discount_kind") or "percent") == "fixed":
                # Eine Pauschale darf den Übernachtungswert nicht übersteigen —
                # ein negativer Preis wäre eine Auszahlung an den Gast.
                ersparnis = min(_to_float(r.get("discount_amount")) or 0.0, basis)
            else:
                ersparnis = basis * (int(r.get("discount_bps") or 0) / 10000.0)
            if ersparnis <= 0:
                continue
            kandidaten.append((r, ersparnis, bool(r.get("promo_codes"))))

        # CODE-VORRANG (Branchenstandard, wörtlich): „Gibt ein Gast bei der
        # Buchung einen Aktionscode an […], werden Aktionen ohne Code nicht
        # angewendet. Stattdessen verwendet das System den Wert der Aktion, die
        # dem angegebenen Code zugeordnet ist, sofern der Code gültig ist."
        #
        # Der eingelöste Code gewinnt also, AUCH wenn eine automatische Aktion
        # mehr gebracht hätte — der Gast hat sich für diesen Code entschieden.
        # Ist der Code ungültig (keine Aktion hängt daran), bleibt alles beim
        # Normalfall und die automatischen Aktionen greifen weiter; deshalb wird
        # NUR gefiltert, wenn wirklich eine Code-Aktion greift.
        mit_code = [k for k in kandidaten if k[2]]
        if code and mit_code:
            kandidaten = mit_code

        beste_regel: dict | None = None
        beste_ersparnis = 0.0
        for regel, ersparnis, _hat_code in kandidaten:
            if ersparnis > beste_ersparnis:
                beste_regel, beste_ersparnis = regel, ersparnis
        return None if beste_regel is None else (beste_regel, beste_ersparnis)

    # -- Vollständiger Quote --------------------------------------------------
    def quote(self, req: QuoteRequest) -> QuoteResponse:
        """Vollständige Preisaufschlüsselung. Reihenfolge:

        1) Pro Nacht: Effektivpreis (override>weekday>base). Längenpreis verdrängt
           den Basispreis, wenn genug Nächte. Kurzaufenthalts-Aufschlag bei kurzen
           Aufenthalten. Extra-Gast-Aufschlag pro Nacht ab dem konfigurierten Gast.
        2) Kanal-Markup auf die Übernachtungssumme (direct = 0).
        3) Gebühren (fest/pro Nacht/pro Gast).
        4) Aktion (prozentualer Rabatt) auf Zwischensumme.
        5) Steuern (prozentual oder fest; im Preis enthaltene Steuern nicht addiert).
        """
        nights = _nights(req.check_in, req.check_out)
        n = len(nights)
        config = self._load_config(req.property_id)
        # Hotel: der konkrete Plan der Buchung bestimmt Basispreis, Währung und
        # die datumsgenauen Plan-Preise — nie der zufällig älteste Plan des
        # Objekts. FeWo (ohne rate_plan_id): das eine Objekt-Rate-Plan wie bisher.
        overrides = self._load_overrides(req.property_id, req.check_in, req.check_out)
        dynamic = self._load_dynamic(req.property_id, req.check_in, req.check_out)
        # 1) Übernachtungssumme aus Effektiv-Tagespreisen. Mit rate_plan_id nutzt
        # der Quote dieselbe Kurve wie Channex-Push/Portal (inkl. Ableitung).
        if req.rate_plan_id:
            rp_currency = self._load_rate_plan_meta(
                req.property_id, req.rate_plan_id
            ).currency
            per_day = self._rate_plan_curve(
                req.property_id, req.rate_plan_id, nights,
                req.check_in, req.check_out, overrides, dynamic, config,
            )
        else:
            base, rp_currency = self._load_rate_plan(req.property_id)
            per_day = [
                self._effective_for_day(day, overrides, dynamic, config, base, {})
                for day in nights
            ]
        # Währung (Priorität, alles ECHTE Werte — kein EUR-Fallback, Wurzel 4):
        # 1) Rate-Plan (Verkaufs-Wahrheit, in ihr pusht Channex; wird beim Setzen
        #    der Objektwährung ohnehin auf diese gezogen — 0161), 2) zentrale
        #    Objektwährung (properties.currency, greift auch ohne Rate-Plan),
        #    3) property_pricing_config, sonst leer → symbollose Anzeige.
        currency = (
            rp_currency
            or self._property_currency(req.property_id)
            or config.currency
            or ""
        )
        priced = [d.price for d in per_day if d.price is not None]
        priceless = len(priced) == 0
        unpriced_nights = len(per_day) - len(priced)
        # Längenpreis verdrängt nur den Basispreis-Anteil (nicht Overrides/Weekday).
        length_pn = config.length_price_per_night(n)
        nightly_total = 0.0
        # Betrag JE NACHT — Grundlage für Aktionen mit Aufenthaltszeitraum: deckt
        # der Zeitraum nur einen Teil des Aufenthalts ab, wird auch nur dieser
        # Teil rabattiert (`_rabatt_basis`).
        nacht_betrag: dict[date, float] = {}
        for d in per_day:
            if d.price is None:
                continue
            betrag = (
                length_pn if (d.source == "base" and length_pn is not None) else d.price
            )
            nightly_total += betrag
            nacht_betrag[d.date] = nacht_betrag.get(d.date, 0.0) + betrag

        lines: list[QuoteLine] = []
        if nightly_total > 0 or not priceless:
            # „Nächte" mit Umlaut — der Plural von „Nacht" ist nicht „Nachte".
            # Diese Zeile steht im Gast-Checkout und auf jeder Rechnung.
            label = f"Übernachtung ({n} {'Nächte' if n != 1 else 'Nacht'})"
            lines.append(
                QuoteLine(label=label, amount=round(nightly_total, 2), kind="lodging")
            )

        # Kurzaufenthalts-Aufschlag (pro Nacht), wenn Aufenthalt kurz genug.
        if (
            config.short_stay_max_nights > 0
            and n <= config.short_stay_max_nights
            and config.short_stay_surcharge > 0
        ):
            surcharge = config.short_stay_surcharge * n
            nightly_total += surcharge
            for tag in nacht_betrag:
                nacht_betrag[tag] += config.short_stay_surcharge
            lines.append(
                QuoteLine(
                    label="Kurzaufenthalts-Aufschlag",
                    amount=round(surcharge, 2),
                    kind="surcharge",
                )
            )

        # Extra-Gast-Aufschlag pro Nacht ab dem konfigurierten Gast.
        extra_guests = max(0, req.guests - (config.extra_guest_from - 1))
        if config.extra_guest_charge > 0 and extra_guests > 0:
            extra = config.extra_guest_charge * extra_guests * n
            nightly_total += extra
            for tag in nacht_betrag:
                nacht_betrag[tag] += config.extra_guest_charge * extra_guests
            lines.append(
                QuoteLine(
                    label=f"Aufschlag {extra_guests} weitere(r) Gast/Gäste",
                    amount=round(extra, 2),
                    kind="surcharge",
                )
            )

        # Der frühere „Kanal-Markup" wurde entfernt (0272): er war eine
        # Attrappe — die Quote läuft mit channel='direct', die Werte trugen
        # OTA-Keys, der Aufschlag wirkte NIRGENDS. Portal-Aufschläge sind
        # jetzt Kanal-Pläne (rate_plans.portal_scope), die über die normale
        # abgeleitete Kurve wirken.
        subtotal = nightly_total

        # Vom Gast gewählte optionale Gebühren — als Menge, weil die Schleife je
        # Gebühr danach fragt.
        gewaehlt = {str(x) for x in req.fees}
        # Wählbare Gebühren dieses Aufenthalts (gewählt oder nicht) für die
        # Oberfläche.
        optional_fees: list[OptionalFeeOffer] = []

        # 3) Gebühren. Eigener USt-Satz (fees[].taxRate, z. B. Frühstück 19 %)
        # wandert als Snapshot in die Zeile — die Rechnung nutzt ihn später
        # vorrangig vor dem Übernachtungssatz.
        for fee in config.fees:
            if not _gilt_fuer_kanal(fee, req.channel):
                continue
            # „Nur in der Eigentümer-Abrechnung": eine interne Abrechnungsgröße,
            # die der Gast nie zahlt — auf keinem Kanal.
            if bool(fee.get("ownerStatementOnly")):
                continue
            # Gültigkeit nach Anreise („gilt ab"/„gilt bis" an der Gebühr) —
            # dieselbe Regel wie `properties.gebuehren.gebuehr_gilt_am`, hier
            # über den lokalen Helfer, weil diese Datei als SCHWESTERDATEI in der
            # öffentlichen API liegt, die den properties-Slice nicht hat.
            if not _in_zeitraum(req.check_in, fee.get("validFrom"), fee.get("validUntil")):
                continue
            # „Nur für Kurzaufenthalte": dieselbe Grenze wie der
            # Kurzaufenthalts-Aufschlag des Objekts (`shortStayMaxNights`) — es
            # gibt genau EINE Definition von „kurz" je Objekt. Ist keine
            # gepflegt, greift die Gebühr NICHT: eine Schranke ohne Grenze wäre
            # sonst wirkungslos und die Gebühr liefe immer mit (Wurzel 4 — keine
            # geratene Nächtezahl).
            if bool(fee.get("shortStayOnly")) and not (
                config.short_stay_max_nights > 0
                and n <= config.short_stay_max_nights
            ):
                continue
            # Tierbedingte Gebühr ohne Tier: entfällt. Die Bedingung hängt an der
            # ART (`ist_tierbedingt`), nicht an der Basis — sonst schützt nur
            # `per_pet_stay`, weil es mit der Tierzahl multipliziert und bei null
            # nebenbei null wird. Die Haustier-PAUSCHALE (`per_stay`) multipliziert
            # nichts und lief deshalb jedem Gast mit; live waren das alle 9
            # gepflegten Haustiergebühren (150 DKK je Buchung ohne Hund).
            if ist_tierbedingt(fee) and req.pets <= 0:
                continue
            amount = self._fee_brutto(
                fee, self._fee_amount(fee, n, req.guests, nightly_total, req.pets)
            )
            if amount <= 0:
                continue
            # Gastseitiger Name in der Sprache des Gastes: der Editor pflegt
            # `names` in 24 Sprachen ausdrücklich für die Preisaufschlüsselung —
            # hier stand bisher nur der INTERNE Name, also las jeder Gast die
            # Eingabe des Betriebs.
            name = _pick_locale_text(fee.get("names"), req.locale) or str(
                fee.get("name") or "Gebühr"
            )
            fee_id = str(fee.get("id") or "")

            # Optionale Gebühr: sie wird ANGEBOTEN und nur bei ausdrücklicher
            # Wahl berechnet. Die Oberfläche sagt „Gast kann ab-/zuwählen" —
            # gelesen wurde das Flag hier nie, also bekam der Gast sie berechnet,
            # ohne sie abwählen zu KÖNNEN. Fail-closed in Richtung des Gastes:
            # ohne Wahl kein Zuschlag, denn eine nicht angeklickte Zusatzoption
            # ist eine Ablehnung und keine fehlende Angabe.
            #
            # Der Betrag wird auch für die NICHT gewählte gerechnet und
            # mitgeliefert: sonst müsste die Strecke „80 pro Nacht × 7" selbst
            # hochrechnen und käme bei Prozent- oder Gast-Basis auf etwas anderes
            # als der Server (Wurzel 3).
            #
            # Ohne `id` ist sie unwählbar und entfällt immer — sie taucht auch
            # nicht im Angebot auf, weil der Gast sie nicht anhaken könnte.
            # `normalize_fees` vergibt jeder Gebühr eine ID, das trifft also nur
            # von Hand gebauten Bestand.
            if bool(fee.get("optional")):
                if not fee_id:
                    continue
                optional_fees.append(
                    OptionalFeeOffer(
                        id=fee_id,
                        label=name,
                        amount=round(amount, 2),
                        selected=fee_id in gewaehlt,
                    )
                )
                if fee_id not in gewaehlt:
                    continue

            lines.append(
                QuoteLine(
                    label=name,
                    amount=round(amount, 2),
                    kind="fee",
                    tax_rate=_to_float(fee.get("taxRate")),
                    fee_id=fee_id or None,
                )
            )
            subtotal += amount

        # 4) Aktion/Rabatt (property_discounts, 0185 + 0276): die BESTE greifende
        #    Aktion als eigene Rabattzeile — pro Steuersatz aufgeteilt. Sonst
        #    würde der auf eine höher besteuerte Gebühr (Frühstück 19 %)
        #    entfallende Rabattanteil mit dem niedrigeren Übernachtungssatz
        #    (7 %) gutgeschrieben: falsche USt auf der Rechnung.
        #
        #    Der frühere ZWEITE Rabattpfad (`type_attributes.pricing.promotions`)
        #    ist WEG: dort stand die Bedingung als Freitext, wurde nie geprüft und
        #    der Prozentsatz von jeder Buchung abgezogen — eine Aktion „20 % nur
        #    Juni" rabattierte das ganze Jahr. Kein Objekt hatte eine solche
        #    Aktion (live geprüft, 0 von 34), die Umstellung ändert also keinen
        #    Bestandspreis. Aktionen laufen jetzt ausschließlich über die
        #    typisierte Tabelle mit prüfbaren Bedingungen.
        best_disc = self._best_discount(
            req.property_id,
            n,
            req.check_in,
            req.as_of,
            channel=req.channel,
            promo_code=req.promo_code,
            nacht_betrag=nacht_betrag,
        )
        promo_code_applied = False
        if best_disc and subtotal > 0:
            regel, gesamt = best_disc
            # „Angewendet" heißt: die gewinnende Aktion hängt WIRKLICH an diesem
            # Code. Eine automatische Aktion, die zufällig auch greift, macht
            # einen falschen Code nicht gültig.
            eingegeben = (req.promo_code or "").strip().upper()
            codes = {str(c).strip().upper() for c in (regel.get("promo_codes") or [])}
            promo_code_applied = bool(eingegeben) and eingegeben in codes
            disc_name = (
                _pick_locale_text(regel.get("name"), req.locale)
                or _DISCOUNT_LABEL.get(str(regel["discount_type"]), "Rabatt")
            )
            if str(regel.get("discount_kind") or "percent") == "fixed":
                etikett = disc_name
            else:
                disc_pct = int(regel["discount_bps"]) / 100.0
                etikett = f"{disc_name} (−{disc_pct:g}%)"
            # Der Rabatt wirkt auf die ÜBERNACHTUNG (inkl. Aufschläge), nicht auf
            # Gebühren — deshalb wird er über die Übernachtungszeilen aufgeteilt
            # und trägt deren Steuersatz. Vorher lief er über die ganze
            # Zwischensumme und rabattierte damit auch die Reinigungsgebühr,
            # obwohl am Eingabefeld „exkl. Gebühren, Steuern & Aktionen" steht.
            uebernachtung = [
                ln for ln in lines if ln.kind in ("lodging", "surcharge") and ln.amount > 0
            ]
            basis_summe = sum(ln.amount for ln in uebernachtung)
            by_rate_d: dict[float | None, float] = {}
            for ln in uebernachtung:
                by_rate_d[ln.tax_rate] = by_rate_d.get(ln.tax_rate, 0.0) + ln.amount
            for rate, base in by_rate_d.items():
                part = gesamt * (base / basis_summe) if basis_summe > 0 else 0.0
                if part <= 0:
                    continue
                lines.append(
                    QuoteLine(
                        label=etikett,
                        amount=round(-part, 2),
                        kind="discount",
                        tax_rate=rate,
                    )
                )
            subtotal -= gesamt

        # 5) Steuern (nicht im Preis enthaltene werden addiert). Prozent-Steuern
        #    mit gewählter Bemessungsgrundlage besteuern nur Grundpreis und/oder
        #    einzelne Gebühren; Betrags-Steuern zählen Gäste/Nächte nach ihrer
        #    Basis (Kurtaxe „pro Gast pro Nacht"). Die Grundlage wird VOR dieser
        #    Schleife eingefroren, damit sich Steuern nicht gegenseitig besteuern.
        steuer_basis_lines = list(lines)
        steuer_subtotal = subtotal
        for tax in config.taxes:
            if bool(tax.get("includedInPrice")):
                continue
            if not _gilt_fuer_kanal(tax, req.channel):
                continue
            basis = self._taxable_base(
                tax, steuer_basis_lines, nightly_total, steuer_subtotal
            )
            amount = self._tax_amount(tax, basis, n, req.guests)
            if amount > 0:
                name = _pick_locale_text(tax.get("names"), req.locale) or str(
                    tax.get("name") or "Steuer"
                )
                lines.append(QuoteLine(label=name, amount=round(amount, 2), kind="tax"))
                subtotal += amount

        # 6) Zusatzleistungen (Upsells): eigene Positionen, je nach Basis + eigener
        #    Steuer (brutto). Beträge serverseitig aus dem Katalog, nie aus Input.
        if req.addons:
            catalog = self._load_addons(
                req.property_id, [a.addon_id for a in req.addons]
            )
            for sel in req.addons:
                addon = catalog.get(sel.addon_id)
                if not addon:
                    continue
                _net, gross = addon_total(
                    float(addon.get("price") or 0),
                    str(addon.get("basis") or "per_stay"),
                    (
                        float(addon["tax_rate"])
                        if addon.get("tax_rate") is not None
                        else None
                    ),
                    nights=n,
                    qty=sel.qty,
                )
                if gross <= 0:
                    continue
                label = (
                    _pick_locale_text(addon.get("name"), req.locale)
                    or "Zusatzleistung"
                )
                if sel.qty > 1:
                    label = f"{label} ×{sel.qty}"
                lines.append(QuoteLine(label=label, amount=gross, kind="addon"))
                subtotal += gross

        total = round(max(0.0, subtotal), 2)
        return QuoteResponse(
            property_id=req.property_id,
            check_in=req.check_in,
            check_out=req.check_out,
            nights=n,
            guests=req.guests,
            channel=req.channel,
            currency=currency,
            nightly_total=round(nightly_total, 2),
            optional_fees=optional_fees,
            lines=lines,
            total=total,
            promo_code_applied=promo_code_applied,
            priceless=priceless,
            unpriced_nights=unpriced_nights,
        )

    @staticmethod
    def _fee_amount(
        fee: dict, nights: int, guests: int, nightly_total: float, pets: int = 0
    ) -> float:
        """Betrag einer Gebühr für diesen Aufenthalt.

        Prozentuale Gebühr: EINMALIG auf den Zimmerpreis, die Basis multipliziert
        nichts. Das ist die Regel des Branchenstandards („Gebühr wird als
        einmalige Gebühr berechnet, wenn sie prozentual basiert ist, und richtet
        sich nach dem Zimmerpreis einschließlich Promotions" — live abgelesen
        03.08.2026; dort verschwinden die Berechnungsfelder im Prozent-Modus).
        „Einschließlich Promotions" ergibt sich hier von selbst: die Aktion kürzt
        anschließend alle positiven Zeilen im gleichen Verhältnis, also auch
        diese.
        """
        amount = _to_float(fee.get("amount")) or 0.0
        if str(fee.get("mode") or "amount") == "percent":
            return nightly_total * amount / 100.0
        basis = str(fee.get("basis") or "per_stay")
        if basis == "per_night":
            return amount * nights
        if basis == "per_guest_stay":
            return amount * guests
        if basis == "per_guest_night":
            return amount * guests * nights
        if basis == "per_pet_stay":
            # Kein Tier → keine Tiergebühr. Die Zahl kommt aus der Buchung
            # (`reservations.pets`); fehlt sie, ist 0 die richtige Antwort und
            # kein Ersatzwert „bestimmt eines" (Wurzel 4).
            return amount * pets
        return amount  # per_stay

    @staticmethod
    def _fee_brutto(fee: dict, amount: float) -> float:
        """Gebührenbetrag als BRUTTO, wie ihn die Zeile trägt.

        Jede QuoteLine ist brutto — die Rechnung zerlegt sie in netto + Steuer
        (`buchhaltung/reservation_invoice._split_gross`). Der Betrag, den der
        Betrieb eintippt, ist dagegen entweder brutto oder netto; das sagt das
        Auswahlfeld an der Gebühr (`taxIncluded`, Branchenstandard: „Preis inkl.
        Umsatz-/MwSt." vs. „Der Preis enthält keine Umsatzsteuer / MwSt.").

        `taxIncluded` fehlt oder ist `True` → der Betrag IST brutto, unverändert
        (bisheriges Verhalten, Bestandsdaten bleiben gleich teuer). `False` →
        der Satz kommt obendrauf; `_split_gross` gewinnt daraus exakt den
        eingetippten Netto-Betrag zurück.

        Ohne eigenen Satz (`taxRate` fehlt) gibt es nichts aufzuschlagen: die
        Gebühr folgt dem Übernachtungssatz des Objekts, und der steckt nach
        dessen eigener „im Preis enthalten"-Einstellung im Preis. Hier einen
        Satz zu erfinden wäre ein Aufschlag aus Nichts (Wurzel 4).
        """
        if bool(fee.get("taxIncluded", True)):
            return amount
        satz = _to_float(fee.get("taxRate"))
        if satz is None or satz <= 0:
            return amount
        return amount * (1.0 + satz / 100.0)

    @staticmethod
    def _tax_amount(tax: dict, base: float, nights: int, guests: int) -> float:
        """Steuerbetrag einer Steuer auf ihre Bemessungsgrundlage.

        Prozent: Anteil der übergebenen Grundlage (die der Aufrufer je nach
        `taxableBase` bildet). Betrag: Stückzahl aus `chargeBasis` × `period`
        — „2,50 € pro Gast pro Nacht" ist damit abbildbar. Fehlt die Basis
        (Altdatensatz), gilt einmalig pro Nacht: genau das, was für
        `mode:"amount"` bisher gerechnet und an die Portale gesendet wurde
        (Channex-`logic` `per_night`) — kein Bedeutungswechsel im Bestand.
        """
        value = _to_float(tax.get("value")) or 0.0
        mode = str(tax.get("mode") or "percent")
        if mode == "percent":
            return base * value / 100.0
        charge = str(tax.get("chargeBasis") or "SingleCharge")
        period = str(tax.get("period") or "PerNight")
        faktor = 1
        if charge == "PerPerson":
            faktor *= max(guests, 0)
        if period == "PerNight":
            faktor *= max(nights, 0)
        return value * faktor

    @staticmethod
    def _taxable_base(
        tax: dict, lines: list[QuoteLine], nightly_total: float, subtotal: float
    ) -> float:
        """Bemessungsgrundlage einer Prozent-Steuer.

        LOKALE Steuer: der Grundpreis, nichts anderes. Das ist die Regel des
        Branchenstandards, live abgelesen am Steuer-Editor (03.08.2026): „Die
        steuerpflichtige Grundlage gilt nur für Gebühren, die an Airbnb
        übermittelt werden. Für alle anderen Kanäle gelten Steuern nur auf den
        Basispreis." Unsere eigenen Buchungsstrecken (Website, Marktplatz) sind
        genau diese „anderen Kanäle" — die am Objekt gepflegte `taxableBase`
        wirkt deshalb NUR beim Airbnb-Export (channel_manager/ota_abgaben.py),
        nicht hier. Vorher zählte hier die gesamte Zwischensumme inklusive
        Gebühren; das wich vom Standard ab.

        USt./MwSt. bleibt unverändert auf der Zwischensumme: sie ist keine
        lokale Abgabe, kennt die Grundlagen-Auswahl nicht (eigener Editor, nur
        Satz + „im Preis enthalten") und liegt fachlich auf allem, was verkauft
        wird. Gebühren mit eigenem Satz tragen ihren über `taxRate`.

        Rabatte haben die Zwischensumme bereits gesenkt; der Grundpreis-Anteil
        wird im selben Verhältnis gekürzt, statt ungekürzt besteuert zu werden.
        """
        if str(tax.get("kind") or "local") != "local":
            return subtotal
        if nightly_total <= 0:
            return 0.0
        positiv = sum(ln.amount for ln in lines if ln.amount > 0)
        if positiv <= 0:
            return 0.0
        return nightly_total * min(subtotal / positiv, 1.0)
