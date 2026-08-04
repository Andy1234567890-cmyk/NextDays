"""Serverseitige Prüfung und Säuberung der Objekt-Steuern.

Die Steuern eines Objekts liegen als Liste im Preis-Blob
(`type_attributes.pricing.taxes`) und werden von dort in
`property_pricing_config.taxes` gespiegelt, vom Preis-Resolver gerechnet, auf
die Rechnung geschrieben und an die Portale gesendet. Alles davon hängt an
Feldern, die aus dem Browser kommen — deshalb wird hier geprüft, nicht dort:

* GENAU EINE USt je Objekt (Wurzel 3: der Anfrage nicht vertrauen). Die
  Rechnung liest den Übernachtungssatz aus dieser einen Zeile; mehrere
  USt-Zeilen hießen „irgendeine gewinnt" und damit eine falsche Rechnung.
* Steuerart, Basis und Zeitraum nur aus den erlaubten Werten — sie gehen als
  Airbnb-Steuerart bzw. Channex-`logic` an die Portale (Wurzel 4: kein
  erfundener Ersatzwert, ungültige Eingabe schlägt fehl).
* Beschreibungstext mit einer Allowlist parsen, nie per Regex (Wurzel 8).
"""
from __future__ import annotations

from typing import Any

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.supabase import load_scoped

from .errors import PropertyError
from .gebuehren import (
    TAXABLE_BASE_CATEGORIES,
    TAXABLE_BASE_ITEMS,
    clean_description,
    clean_names,
    clean_portal_scope,
    fee_category,
)
from .schemas import PropertyUpdate

log = get_logger("nextdays.properties.steuern")

# Airbnb-Steuerarten; gehen so an die Portale (siehe channel_manager.content_sync
# `_TAX_TYPE_BY_LOCAL_KIND`). Gegenstück: LOCAL_TAX_TYPES in web/lib/pricing-meta.ts.
LOCAL_TAX_TYPES = frozenset(
    {
        "HotelTax",
        "LodgingTax",
        "RoomTax",
        "TourismAssessment",
        "TouristTax",
        "TransientOccupancyTax",
        "Unknown",
    }
)
CHARGE_BASES = frozenset({"SingleCharge", "PerPerson"})
PERIODS = frozenset({"PerStay", "PerNight"})

# Wer die Abgabe bei einem Portal einzieht, wird NICHT hier gepflegt: das
# erkennt der Sync selbst aus dem verbundenen Kanal
# (channel_manager/tax_regime.py, live aus dem Channex-Katalog + den echten
# Kanal-Einstellungen). Airbnb „Payout Amount" oder Expedia „Collect Amount"
# heißt, dass das Portal die Steuer zum Gastpreis rechnet — dann bleibt sie aus
# dem Set dieses Portals heraus. Ein Handschalter dafür wäre eine zweite,
# schlechtere Wahrheit über etwas, das der Kanal ohnehin ansagt.

# Die Beschreibungs-Säuberung liegt in gebuehren.py (untere Schicht, wird von hier
# ohnehin importiert). Eine eigene Kopie hier wäre eine zweite Wahrheit über
# erlaubtes HTML — und genau die Sorte Kopie, die auseinanderläuft. Dasselbe gilt
# seit dem mehrsprachigen Gebühren-Namen für `clean_names`: die stand hier und ist
# nach unten gewandert, statt sie für die Gebühr ein zweites Mal zu schreiben.


def _clean_value(raw: object, *, percent: bool) -> float:
    try:
        value = float(raw if raw is not None else 0)
    except (TypeError, ValueError) as exc:
        raise PropertyError("Steuerwert ist keine Zahl.", status_code=422) from exc
    if value < 0:
        raise PropertyError("Steuerwert darf nicht negativ sein.", status_code=422)
    if percent and value > 100:
        raise PropertyError(
            "Prozentsatz darf höchstens 100 sein.", status_code=422
        )
    return value


def _grundlage_je_gebuehr(fees: list[dict[str, Any]] | None) -> dict[str, str]:
    """Gebühren-ID → Bemessungsgrundlage-Item ihrer Kategorie.

    Für Altbestand: die Bemessungsgrundlage stand früher als Liste von
    GEBÜHREN-IDs im Datensatz. Beim Portal gibt es „genau diese eine Gebühr"
    aber nicht — mehrere Gebührenarten werden dort zu EINER Gebühr ihrer
    Kategorie zusammengefasst. Der Alt-Wert wird deshalb beim nächsten Speichern
    auf seine Kategorie umgeschrieben, statt ihn abzulehnen (das machte jedes
    Objekt mit alter Grundlage unspeicherbar) oder still zu verwerfen (dann
    besteuerte die Steuer plötzlich nur noch den Grundpreis).
    """
    aus_id: dict[str, str] = {}
    for fee in fees or []:
        if not isinstance(fee, dict):
            continue
        fee_id = str(fee.get("id") or "").strip()
        kategorie = fee_category(fee)
        if fee_id and kategorie in TAXABLE_BASE_CATEGORIES:
            aus_id[fee_id] = str(kategorie)
    return aus_id


def _clean_taxable_base(
    raw: object, aus_gebuehr: dict[str, str]
) -> list[str]:
    """Bemessungsgrundlage säubern: Grundpreis und/oder Gebührenkategorien.

    Ein unbekanntes Item wird zuerst als Alt-Gebühren-ID gedeutet (siehe
    `_grundlage_je_gebuehr`); passt auch das nicht, ist es ein Fehler — eine
    Grundlage, die es beim Portal nicht gibt, dürfte nicht als „gespeichert"
    durchgehen (Wurzel 5).
    """
    if not isinstance(raw, list):
        return []
    items: list[str] = []
    for roh in raw:
        item = str(roh).strip()
        if not item:
            continue
        if item not in TAXABLE_BASE_ITEMS:
            item = aus_gebuehr.get(item, "")
        if not item:
            raise PropertyError(
                f"Unbekannte Bemessungsgrundlage: {roh}", status_code=422
            )
        items.append(item)
    return list(dict.fromkeys(items))


def normalize_taxes(
    raw_taxes: list[Any],
    *,
    portale: frozenset[str] | None = frozenset(),
    fees: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    """Steuerliste prüfen und säubern; wirft PropertyError(422) bei Unsinn.

    `portale` sind die für das Objekt verbundenen Kanäle — nur auf sie darf eine
    Steuer eingeschränkt werden (siehe gebuehren.erlaubte_portale).

    `fees` sind die bereits geprüften Gebühren desselben Objekts. Gebraucht, um
    eine alte Bemessungsgrundlage (Gebühren-IDs) auf ihre Kategorie zu heben.
    """
    grundlage_aus_gebuehr = _grundlage_je_gebuehr(fees)
    taxes: list[dict[str, Any]] = []
    vat_gesehen = False
    for eintrag in raw_taxes:
        if not isinstance(eintrag, dict):
            continue
        tax_id = str(eintrag.get("id") or "").strip()
        if not tax_id:
            raise PropertyError("Steuer ohne Kennung.", status_code=422)
        kind = str(eintrag.get("kind") or "local")
        if kind not in {"vat", "local"}:
            raise PropertyError(f"Unbekannte Steuerart: {kind}", status_code=422)
        if kind == "vat":
            if vat_gesehen:
                raise PropertyError(
                    "Es kann nur eine USt./Mehrwertsteuer je Objekt geben.",
                    status_code=422,
                )
            vat_gesehen = True

        mode = str(eintrag.get("mode") or "percent")
        if mode not in {"percent", "amount"}:
            raise PropertyError(f"Unbekannter Steuer-Modus: {mode}", status_code=422)

        sauber: dict[str, Any] = {
            "id": tax_id,
            "kind": kind,
            "name": str(eintrag.get("name") or "").strip()[:255],
            "mode": mode,
            "value": _clean_value(eintrag.get("value"), percent=mode == "percent"),
            "includedInPrice": bool(eintrag.get("includedInPrice")),
        }

        namen = clean_names(eintrag.get("names"))
        if namen:
            sauber["names"] = namen
        beschreibung = clean_description(eintrag.get("descriptionHtml"))
        if beschreibung:
            sauber["descriptionHtml"] = beschreibung

        if kind == "local":
            art = eintrag.get("taxType")
            if art is not None:
                if str(art) not in LOCAL_TAX_TYPES:
                    raise PropertyError(
                        f"Unbekannte lokale Steuerart: {art}", status_code=422
                    )
                sauber["taxType"] = str(art)

        if mode == "amount":
            basis = eintrag.get("chargeBasis")
            zeitraum = eintrag.get("period")
            if basis is not None:
                if str(basis) not in CHARGE_BASES:
                    raise PropertyError(
                        f"Unbekannte Berechnungsbasis: {basis}", status_code=422
                    )
                sauber["chargeBasis"] = str(basis)
            if zeitraum is not None:
                if str(zeitraum) not in PERIODS:
                    raise PropertyError(
                        f"Unbekannter Zeitraum: {zeitraum}", status_code=422
                    )
                sauber["period"] = str(zeitraum)
        else:
            items = _clean_taxable_base(
                eintrag.get("taxableBase"), grundlage_aus_gebuehr
            )
            if items:
                sauber["taxableBase"] = items

        # Kanal-Einschränkung: leer = an alle Portale. Gesetzt heißt „NUR
        # diese" — nötig, wo das Portal die Abgabe selbst einzieht (Airbnb
        # „collects taxes", Booking in manchen Regionen); ohne das zahlte der
        # Gast doppelt.
        scope = clean_portal_scope(eintrag.get("portalScope"), erlaubt=portale)
        if scope:
            sauber["portalScope"] = scope

        # Lokale Steuern brauchen einen Namen — entweder intern oder gastseitig,
        # sonst stünde beim Portal ein Platzhalter (Wurzel 4). Die USt trägt
        # keinen eigenen Namen (sie ist die Umsatzsteuer des Objekts).
        if kind == "local" and not sauber["name"] and not sauber.get("names"):
            raise PropertyError("Steuer braucht einen Namen.", status_code=422)
        taxes.append(sauber)
    return taxes


def nur_steuern_geaendert(alte_attrs: dict, changes: dict) -> bool:
    """Betrifft dieses Update AUSSCHLIESSLICH Steuern oder Gebühren des Objekts?

    Nur dann reicht der schlanke Steuer-Sync. Gebühren zählen mit, seit sie
    ebenfalls als Channex-`taxes` gesendet werden — derselbe Sync-Pfad deckt
    beide ab, und ein voller Content-Sync wäre für eine geänderte
    Reinigungsgebühr Verschwendung.

    Bewusst KONSERVATIV: im Zweifel (andere Content-Felder im Update,
    Währungswechsel, kein Alt-Stand ladbar, irgendein anderer Unterschied in
    type_attributes) wird `False` gemeldet und der volle Content-Sync läuft. Ein
    zu viel gelaufener voller Sync kostet Calls; ein fälschlich ausgelassener
    ließe echten Content veralten.
    """
    if set(changes.keys()) - {"type_attributes"}:
        return False
    neu_attrs = changes.get("type_attributes")
    if not isinstance(neu_attrs, dict) or not isinstance(alte_attrs, dict):
        return False
    # Alles außer `pricing` muss gleich sein …
    if {k: v for k, v in alte_attrs.items() if k != "pricing"} != {
        k: v for k, v in neu_attrs.items() if k != "pricing"
    }:
        return False
    alt_pricing = alte_attrs.get("pricing") or {}
    neu_pricing = neu_attrs.get("pricing") or {}
    if not isinstance(alt_pricing, dict) or not isinstance(neu_pricing, dict):
        return False
    # … und innerhalb von `pricing` alles außer `taxes`/`fees`. Bleibt nur ein
    # tatsächlicher Unterschied dort übrig, genügt der schlanke Sync.
    _abgaben = {"taxes", "fees"}
    if {k: v for k, v in alt_pricing.items() if k not in _abgaben} != {
        k: v for k, v in neu_pricing.items() if k not in _abgaben
    }:
        return False
    return (
        (alt_pricing.get("taxes") or []) != (neu_pricing.get("taxes") or [])
        or (alt_pricing.get("fees") or []) != (neu_pricing.get("fees") or [])
    )


class SteuernMixin:
    """Steuer-Aktionen am Objekt. Wird von PropertiesService eingebunden."""

    def apply_tax_to_properties(
        self, ctx: AuthContext, property_id: str, tax_id: str, targets: list[str]
    ) -> dict[str, Any]:
        """Eine Steuer des Objekts auf weitere Objekte übertragen.

        Jede Ziel-ID wird EINZELN tenant-gescopt geladen (Wurzel 3) — eine
        fremde ID ist ein Fehler, kein stilles Überspringen, sonst meldet die
        UI Erfolg für Objekte, die gar nicht geändert wurden. Die Steuer
        behält ihre Kennung: dasselbe Objekt zweimal zu bespielen aktualisiert
        die vorhandene Zeile, statt sie zu duplizieren (Wurzel 2).
        """
        tenant_id = self._require_tenant(ctx)
        quelle = load_scoped(
            self._db,
            "properties",
            property_id,
            tenant_id,
            columns="id, type_attributes",
            not_found=PropertyError("Objekt nicht gefunden.", status_code=404),
        )
        steuern = ((quelle.get("type_attributes") or {}).get("pricing") or {}).get(
            "taxes"
        ) or []
        vorlage = next(
            (t for t in steuern if isinstance(t, dict) and str(t.get("id")) == tax_id),
            None,
        )
        if vorlage is None:
            raise PropertyError("Steuer nicht gefunden.", status_code=404)

        angewendet: list[str] = []
        for ziel_id in dict.fromkeys(targets):  # Reihenfolge behalten, Dubletten weg
            if ziel_id == property_id:
                continue
            ziel = load_scoped(
                self._db,
                "properties",
                ziel_id,
                tenant_id,
                columns="id, title, type_attributes",
                not_found=PropertyError("Objekt nicht gefunden.", status_code=404),
            )
            attrs = dict(ziel.get("type_attributes") or {})
            pricing = dict(attrs.get("pricing") or {})
            bestand = [
                t
                for t in (pricing.get("taxes") or [])
                if isinstance(t, dict) and str(t.get("id")) != tax_id
            ]
            # Eine USt je Objekt gilt auch hier: eine übertragene USt ERSETZT
            # die vorhandene, statt eine zweite anzulegen.
            if vorlage.get("kind") == "vat":
                bestand = [t for t in bestand if t.get("kind") != "vat"]
            pricing["taxes"] = [*bestand, dict(vorlage)]
            attrs["pricing"] = pricing
            # Über den normalen Update-Pfad, NICHT per Direkt-Schreibung: nur
            # so laufen Prüfung (normalize_taxes), Spiegelung in
            # property_pricing_config, der Sync-Entscheid (schlanker Steuer-Job
            # statt vollem Content-Sync) und der max_stay-Push wie überall
            # sonst. Ein eigener Schreibweg hier hieße, jede künftige Regel
            # zweimal pflegen zu müssen.
            self.update(  # type: ignore[attr-defined]
                ctx, ziel_id, PropertyUpdate(type_attributes=attrs)
            )
            angewendet.append(ziel_id)
        log.info(
            "tax_applied_to_properties",
            tenant_id=tenant_id,
            property_id=property_id,
            tax_id=tax_id,
            targets=len(angewendet),
        )
        return {"applied_to": angewendet}
