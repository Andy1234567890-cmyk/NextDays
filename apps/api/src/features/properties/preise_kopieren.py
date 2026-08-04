"""Preise eines Objekts von einem ANDEREN eigenen Objekt übernehmen.

Der Branchenstandard hat das als Seitenmenü der Preise-Seite: „Preise einer
bestehenden Unterkunft kopieren — Preise, Verfügbarkeiten, Konditionen und
Saisonpreise von einer anderen Unterkunft importieren" (live abgelesen
04.08.2026, Lodgify `/pricing/<id>` → ⋯). Wer zehn gleich ausgestattete
Ferienhäuser führt, richtet Gebühren, Steuern und Aufschläge sonst zehnmal von
Hand ein — die Übernahme je EINZELNEM Posten (`fees/{id}/apply`) löst genau das
nicht, weil sie den Umweg über das Quell-Objekt und einen Klick je Posten
verlangt.

WAS ÜBERNOMMEN WIRD: der Preis-Block des Objekts (`type_attributes.pricing`) —
Grundpreis samt Wochentagen, Aufschlag pro Gast, Kurzaufenthalt, Längenpreise,
Gebühren, Steuern, Steuer-Informationen, Bezeichnung des Grundpreises. Und der
Grundpreis in `rate_plans`, weil DAS die Preis-Wahrheit ist (der Blob ist die
Kopie für die Oberfläche) — ohne diesen Schritt zeigte die Seite den neuen Preis
und die Portale bekämen weiter den alten.

WAS NICHT ÜBERNOMMEN WIRD, und warum das hier steht statt stillschweigend zu
fehlen: Aktionen (`property_discounts`) tragen Zeiträume und Angebotscodes, die
je Objekt verkauft werden — eine Kopie hätte zwei Zeilen mit demselben Code.
Verfügbarkeit und Belegungskalender gehören nicht in den Preis-Slice. Beides
sagt der Dialog dem Betrieb an, statt es zu verschweigen.

DREI DINGE WERDEN VOR DEM ERSTEN SCHREIBEN GEPRÜFT (nicht unterwegs):

* Die Währung. Ein Betrag in DKK, in ein Objekt in EUR kopiert, ist ein anderer
  Preis. Weichen sie ab, wird abgelehnt (422) — nicht umgerechnet (das wäre ein
  erfundener Kurs, Wurzel 4). Hat das Ziel noch keine Währung, übernimmt es die
  der Quelle: dann ist nichts umzurechnen.
* Die Kanal-Einschränkungen der Posten. Zeigt ein `portalScope` auf ein Portal,
  mit dem DIESES Objekt nicht verbunden ist, wird abgelehnt statt die
  Einschränkung stillschweigend fallen zu lassen — sonst ginge eine Gebühr, die
  nur zu Booking.com sollte, plötzlich an alle (fail-closed, Wurzel 5).
* Quelle ≠ Ziel. Ein Objekt auf sich selbst zu kopieren wäre ein Leerlauf, der
  wie ein Erfolg aussieht.

Der Schreibweg ist `self.update()`, NICHT ein Direkt-Schreiben: nur so laufen
`normalize_fees`/`normalize_taxes` (der Blob der Quelle ist für dieses Objekt
Fremdeingabe, Wurzel 3), die Spiegelung in `property_pricing_config` und der
Sync-Entscheid wie auf jedem anderen Weg.
"""
from __future__ import annotations

from typing import Any

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.supabase import load_scoped

from .errors import PropertyError
from .gebuehren import EIGENE_KANAELE, erlaubte_portale
from .schemas import PropertyUpdate

log = get_logger("nextdays.properties.preise_kopieren")

# Felder des Preis-Blocks, die übernommen werden. BEWUSST eine Aufzählung und
# kein „alles außer …": kommt später ein Feld dazu, das objekt-eigen sein muss
# (eine Kennung, eine Portal-Referenz), reist es sonst unbemerkt mit.
KOPIERTE_FELDER = (
    "basePrice",
    "customByWeekday",
    "weekdayPrices",
    "extraGuestCharge",
    "extraGuestFrom",
    "shortStayMaxNights",
    "shortStaySurcharge",
    "lengthPrices",
    "fees",
    "taxes",
    "businessTaxId",
    "totRegistrationId",
    "basePriceLabel",
)


def _pricing_von(row: dict[str, Any]) -> dict[str, Any]:
    """Preis-Block eines properties-Datensatzes, immer als eigenes dict."""
    attrs = row.get("type_attributes") or {}
    pricing = attrs.get("pricing") if isinstance(attrs, dict) else None
    return dict(pricing) if isinstance(pricing, dict) else {}


def _portal_codes(pricing: dict[str, Any]) -> list[str]:
    """Alle Portal-Codes, auf die ein Posten der Quelle eingeschränkt ist."""
    codes: set[str] = set()
    for liste in ("fees", "taxes"):
        for eintrag in pricing.get(liste) or []:
            if not isinstance(eintrag, dict):
                continue
            for code in eintrag.get("portalScope") or []:
                text = str(code)
                if text not in EIGENE_KANAELE:
                    codes.add(text)
    return sorted(codes)


class PreiseKopierenMixin:
    """Preise von einem anderen eigenen Objekt übernehmen. Mixin des Service."""

    def copy_pricing_from(
        self, ctx: AuthContext, property_id: str, source_id: str
    ) -> dict[str, Any]:
        """Preis-Block von `source_id` auf `property_id` übernehmen.

        Überschreibt den bestehenden Preis-Block dieses Objekts vollständig —
        das ist die Zusage des Dialogs („bereits konfigurierte Einstellungen
        werden überschrieben"). Ein Zusammenführen wäre die schlechtere Wahl: es
        ließe eine alte Gebühr stehen, die niemand mehr sucht.
        """
        tenant_id = self._require_tenant(ctx)  # type: ignore[attr-defined]
        if source_id == property_id:
            raise PropertyError(
                "Quelle und Ziel sind dasselbe Objekt.", status_code=422
            )
        ziel = load_scoped(
            self._db,  # type: ignore[attr-defined]
            "properties",
            property_id,
            tenant_id,
            columns="id, title, currency, type_attributes",
            not_found=PropertyError("Objekt nicht gefunden.", status_code=404),
        )
        quelle = load_scoped(
            self._db,  # type: ignore[attr-defined]
            "properties",
            source_id,
            tenant_id,
            columns="id, title, currency, type_attributes",
            not_found=PropertyError("Quell-Objekt nicht gefunden.", status_code=404),
        )

        quelle_pricing = _pricing_von(quelle)
        if not quelle_pricing:
            raise PropertyError(
                f"„{quelle.get('title') or source_id}“ hat noch keine Preise "
                "eingerichtet — es gibt nichts zu übernehmen.",
                status_code=422,
            )

        quelle_currency = str(quelle.get("currency") or "").upper() or None
        ziel_currency = str(ziel.get("currency") or "").upper() or None
        self._pruefe_waehrung(quelle_currency, ziel_currency)
        self._pruefe_scopes(tenant_id, property_id, quelle_pricing)

        attrs = dict(ziel.get("type_attributes") or {})
        neu = dict(_pricing_von(ziel))
        for feld in KOPIERTE_FELDER:
            if feld in quelle_pricing:
                neu[feld] = quelle_pricing[feld]
        # Die Währung steht am OBJEKT (properties.currency, 0161) und gilt für
        # alle Preispläne. Im Blob wird sie mitgeführt, damit die Oberfläche
        # Beträge formatieren kann — sie muss deshalb zur Objektwährung passen,
        # die unten gesetzt wird. Kein zweiter, abweichender Wert.
        waehrung = ziel_currency or quelle_currency
        if waehrung:
            neu["currency"] = waehrung
        attrs["pricing"] = neu

        changes = PropertyUpdate(type_attributes=attrs)
        # Objektwährung nur setzen, wenn das Ziel noch keine hatte — eine
        # bestehende zu überschreiben wäre eine Preisänderung, die niemand
        # angefordert hat (die Währungsprüfung oben hat sie bereits als gleich
        # bestätigt, wenn beide gesetzt sind).
        if not ziel_currency and quelle_currency:
            changes = PropertyUpdate(
                type_attributes=attrs, currency=quelle_currency
            )
        self.update(ctx, property_id, changes)  # type: ignore[attr-defined]

        # Grundpreis in die Preis-WAHRHEIT spiegeln (rate_plans). Der Blob ist
        # die Anzeige-Kopie; ohne diesen Schritt zeigte die Seite den neuen Preis
        # und Resolver/Channex rechneten weiter mit dem alten.
        basis = quelle_pricing.get("basePrice")
        if waehrung and isinstance(basis, (int, float)):
            self._grundpreis_spiegeln(
                ctx, property_id, float(basis), waehrung
            )

        log.info(
            "pricing_copied_from_property",
            tenant_id=tenant_id,
            property_id=property_id,
            source_id=source_id,
            fees=len(neu.get("fees") or []),
            taxes=len(neu.get("taxes") or []),
        )
        return {
            "property_id": property_id,
            "source_id": source_id,
            "fees": len(neu.get("fees") or []),
            "taxes": len(neu.get("taxes") or []),
        }

    @staticmethod
    def _pruefe_waehrung(quelle: str | None, ziel: str | None) -> None:
        """Beträge nur bei gleicher Währung übernehmen — nie umrechnen."""
        if quelle and ziel and quelle != ziel:
            raise PropertyError(
                f"Die Quelle rechnet in {quelle}, dieses Objekt in {ziel} — "
                "Beträge lassen sich so nicht übernehmen.",
                status_code=422,
            )

    def _pruefe_scopes(
        self, tenant_id: str, property_id: str, quelle_pricing: dict[str, Any]
    ) -> None:
        """Sind alle Kanal-Einschränkungen der Quelle hier erfüllbar?"""
        codes = _portal_codes(quelle_pricing)
        if not codes:
            return
        erlaubt = erlaubte_portale(
            self._db, tenant_id, property_id  # type: ignore[attr-defined]
        )
        # `None` = Portalliste nicht ladbar. Dann NICHT übernehmen: eine Gebühr,
        # die womöglich an alle Portale geht, ist der teurere Fehler (Wurzel 5).
        if erlaubt is None:
            raise PropertyError(
                "Verbundene Portale dieses Objekts sind nicht abrufbar — "
                "eingeschränkte Posten nicht übernommen.",
                status_code=503,
            )
        fehlend = sorted(set(codes) - erlaubt)
        if fehlend:
            raise PropertyError(
                f"Dieses Objekt ist nicht mit {', '.join(fehlend)} verbunden — "
                "die Einschränkungen der übernommenen Posten wären hier nicht "
                "abbildbar.",
                status_code=422,
            )

    def _grundpreis_spiegeln(
        self, ctx: AuthContext, property_id: str, basis: float, currency: str
    ) -> None:
        """Grundpreis in den Basis-Rate-Plan schreiben (rates-Slice).

        Best-effort und ausdrücklich mit Begründung: der Preis-Block ist
        gespeichert, wenn wir hier ankommen. Kippt die Spiegelung, darf das die
        Übernahme nicht zurückrollen — sie stünde sonst als Fehler da, obwohl
        Gebühren und Steuern angekommen sind. Der häufigste Grund ist KEIN
        Defekt, sondern Fachlogik: ein Objekt mit mehreren Preisplänen (Hotel)
        hat gar keinen einen Grundpreis, `set_base_price` lehnt es mit 409 ab.
        Der Betrieb sieht die Pläne in der Liste derselben Seite.
        """
        try:
            # Lokaler Import: der rates-Slice importiert selbst aus properties
            # (Objekt-Scope) — ein Modul-Import hier wäre ein Zirkel.
            from src.features.rates.schemas import RatePlanCreate
            from src.features.rates.service import RatesService

            RatesService(service_client=self._db).set_base_price(  # type: ignore[attr-defined]
                ctx,
                RatePlanCreate(
                    property_id=property_id, base_price=basis, currency=currency
                ),
            )
        except Exception as exc:  # noqa: BLE001 — Blob ist gespeichert, siehe Docstring
            log.warning(
                "pricing_copy_base_price_not_mirrored",
                property_id=property_id,
                error=str(exc)[:200],
            )
