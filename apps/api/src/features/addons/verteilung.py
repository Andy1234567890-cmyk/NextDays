"""Eine Zusatzleistung auf mehrere Objekte verteilen.

Gegenstück zu `properties/gebuehren.py` für den ANDEREN Posten, den der Betrieb
je Objekt pflegt. Bei den Gebühren gibt es seit dem Gebühren-Editor zwei Wege,
dieselbe Sache nicht zwanzigmal abzutippen (live abgelesen 03.08.2026):

* „Fügen Sie eine neue oder bestehende Gebühr hinzu" — eine Auswahlliste dessen,
  was der Betrieb woanders schon angelegt hat (`fee_library`).
* Block „Zu anderen Objekten hinzufügen" im Editor — denselben Posten auf
  weitere Objekte übertragen (`apply_fee_to_properties`).

Die Zusatzleistungen hatten davon nichts: wer „Frühstück 12 EUR pro Gast" auf
achtzehn Objekten will, tippte es achtzehnmal — mit achtzehn Gelegenheiten für
einen anderen Betrag. Dieses Modul zieht beide Wege für `property_addons` nach.

Zwei Unterschiede zur Gebühr, bewusst und nicht übernommen:

* KEINE Portal-Prüfung. Eine Gebühr geht über `portalScope` an die Portale und
  darf beim Ziel nicht stillschweigend an ALLE gehen. Eine Zusatzleistung ist
  Direktverkauf (`appears_in`: Buchungsseite/Gäste-Portal/Check-in) und
  erreicht kein Portal — es gibt dort nichts zu prüfen.
* Die Währung hängt am RATE-PLAN, nicht an `properties.currency`: der
  Addons-Slice liest sie schon immer über `AddonsService._property_currency`.
  Es bleibt dieselbe Regel — ein Betrag ohne seine Währung ist keine
  übernehmbare Zahl (Wurzel 4).
"""
from __future__ import annotations

from typing import Any

from src.core.logging import get_logger
from src.core.security import AuthContext

log = get_logger("nextdays.addons.verteilung")

# Felder, die eine Zusatzleistung fachlich AUSMACHEN — alles, was kopiert wird.
#
# Bewusst als Liste und nicht „alles außer id/property_id": käme morgen eine
# Spalte dazu, die ans Objekt gebunden ist (ein objekt-eigener Link, eine
# Zuordnung), würde sie sonst stillschweigend mitkopiert.
_KOPIERFELDER = (
    "name",
    "description",
    "media",
    "price",
    "basis",
    "mandatory",
    "appears_in",
    "available_until",
    "tax_rate",
    "active",
    "sort_order",
)


def addon_signatur(addon: dict[str, Any]) -> str:
    """Fachliche Identität einer Zusatzleistung — ohne ihre Kennung.

    Dieselbe Leistung steht auf jedem Objekt als EIGENE Zeile mit eigener `id`
    (`property_addons` hängt am Objekt, es gibt keine gemeinsame Katalog-
    Tabelle). In der Auswahlliste soll „Frühstück 12,00 pro Gast" trotzdem
    EINMAL erscheinen und nicht achtzehnmal — gebündelt wird deshalb über die
    fachlichen Felder, nicht über die Kennung.

    Der Name ist Teil der Signatur: zwei gleich gerechnete Leistungen mit
    verschiedenem Namen sind für den Betrieb zwei Leistungen. Verglichen wird
    über ALLE Namens-Sprachen, damit „Frühstück/Breakfast" und
    „Frühstück/Brunch" auseinandergehalten werden.
    """
    namen = addon.get("name") or {}
    name_teil = "&".join(
        f"{k}={str(v).strip().casefold()}" for k, v in sorted(namen.items())
    )
    return "|".join(
        (
            name_teil,
            str(addon.get("basis") or "per_stay"),
            f"{float(addon.get('price') or 0):.2f}",
            "" if addon.get("tax_rate") is None else f"{float(addon['tax_rate']):.2f}",
        )
    )


class VerteilungMixin:
    """Bibliothek + Übertragung auf weitere Objekte. Teil von `AddonsService`.

    Getrennte Datei, weil `service.py` bereits Katalog-CRUD, Medien, Verkauf und
    Storno trägt; ein vierter Themenblock darin wäre die Datei, die niemand mehr
    liest.
    """

    def addon_library(self, ctx: AuthContext, property_id: str) -> dict[str, Any]:
        """Zusatzleistungen anderer Objekte, die auf DIESES übernehmbar sind.

        Nur aus Objekten mit DERSELBEN Währung: „795" von einem DKK-Objekt auf
        ein EUR-Objekt zu kopieren wäre eine stille Preiserhöhung um den Faktor
        7,5 (Wurzel 4 — kein plausibel aussehender Ersatzwert). Anders als bei
        den Gebühren gibt es hier keine prozentualen Posten, die währungsfrei
        wären: eine Zusatzleistung hat immer einen Betrag.

        Hat das Zielobjekt noch keine Währung, bleibt die Liste LEER und
        `currency` ist `None` — die Oberfläche sagt dann, dass zuerst ein
        Rate-Plan mit Währung nötig ist. Kein geratenes EUR.

        Leistungen, die auf DIESEM Objekt schon liegen, fehlen bewusst: sie
        „hinzuzufügen" wäre eine Dublette.
        """
        tenant_id = self._require_tenant(ctx)  # type: ignore[attr-defined]
        self._assert_own_property(tenant_id, property_id)  # type: ignore[attr-defined]
        ziel_currency = self._property_currency(property_id)  # type: ignore[attr-defined]

        eigene = {
            addon_signatur(r) for r in self._addons_von_objekt(property_id)
        }
        objekte = (
            self._db.table("properties")  # type: ignore[attr-defined]
            .select("id, title")
            .eq("tenant_id", tenant_id)
            .order("title")
            .execute()
        ).data or []

        items: list[dict[str, Any]] = []
        gesehen: set[str] = set()
        for objekt in objekte:
            quelle_id = str(objekt["id"])
            if quelle_id == property_id:
                continue
            # Ohne Zielwährung ist nichts übernehmbar — dann gar nicht erst die
            # Kataloge der anderen Objekte durchgehen.
            if ziel_currency is None:
                break
            if self._property_currency(quelle_id) != ziel_currency:  # type: ignore[attr-defined]
                continue
            for row in self._addons_von_objekt(quelle_id):
                signatur = addon_signatur(row)
                if signatur in eigene or signatur in gesehen:
                    continue
                gesehen.add(signatur)
                items.append(
                    {
                        "addon": _katalog_zeile(row),
                        "property_id": quelle_id,
                        "property_title": objekt.get("title"),
                    }
                )
        return {"currency": ziel_currency, "items": items}

    def apply_addon_to_properties(
        self, ctx: AuthContext, addon_id: str, targets: list[str]
    ) -> dict[str, Any]:
        """Eine Zusatzleistung auf weitere eigene Objekte übertragen.

        Wie bei der Gebühr wird jede Ziel-ID EINZELN tenant-gescopt geprüft
        (Wurzel 3: Service-Role umgeht RLS) und die Währung des Ziels muss zur
        Quelle passen — beides VOR dem ersten Schreiben, damit keine halb
        durchgelaufene Übertragung stehen bleibt, die niemand als solche
        erkennt.

        Idempotent (Wurzel 2): liegt beim Ziel bereits eine Leistung mit
        derselben fachlichen Signatur, wird sie AKTUALISIERT statt ein zweites
        Mal angelegt. Ein Doppelklick auf „Speichern" erzeugt also kein zweites
        „Frühstück" im Katalog des Zielobjekts.

        Kopie, keine Verknüpfung: die Zeile beim Ziel ist danach eigenständig
        (eigene `id`), spätere Änderungen an der Quelle wandern NICHT mit —
        genau wie bei Gebühren und Steuern. Die Medien-URLs zeigen auf dieselben
        Dateien im Bucket; sie gehören dem Betrieb, nicht dem Objekt.
        """
        tenant_id = self._require_tenant(ctx)  # type: ignore[attr-defined]
        vorlage = self._get_addon(tenant_id, addon_id)  # type: ignore[attr-defined]
        quelle_id = str(vorlage["property_id"])
        quelle_currency = self._property_currency(quelle_id)  # type: ignore[attr-defined]

        ziel_ids = [z for z in dict.fromkeys(targets) if z != quelle_id]
        ziele = []
        for ziel_id in ziel_ids:
            self._assert_own_property(tenant_id, ziel_id)  # type: ignore[attr-defined]
            ziele.append(ziel_id)
        for ziel_id in ziele:
            self._pruefe_uebertragbar(ziel_id, quelle_currency=quelle_currency)

        signatur = addon_signatur(vorlage)
        felder = {k: vorlage.get(k) for k in _KOPIERFELDER}
        angewendet: list[str] = []
        for ziel_id in ziele:
            vorhanden = next(
                (
                    r
                    for r in self._addons_von_objekt(ziel_id)
                    if addon_signatur(r) == signatur
                ),
                None,
            )
            if vorhanden is not None:
                self._db.table("property_addons").update(felder).eq(  # type: ignore[attr-defined]
                    "id", str(vorhanden["id"])
                ).execute()
            else:
                self._db.table("property_addons").insert(  # type: ignore[attr-defined]
                    {**felder, "property_id": ziel_id}
                ).execute()
            angewendet.append(ziel_id)
        log.info(
            "addon_applied_to_properties",
            tenant_id=tenant_id,
            addon_id=addon_id,
            targets=len(angewendet),
        )
        return {"applied_to": angewendet}

    def _pruefe_uebertragbar(self, ziel_id: str, *, quelle_currency: str | None) -> None:
        """Darf die Leistung auf DIESES Ziel? Wirft 422 mit dem Grund am Objekt."""
        # Lokaler Import: `AddonError` lebt in service.py, das dieses Mixin
        # einbindet — ein Modul-Import wäre ein Zyklus.
        from .service import AddonError  # noqa: PLC0415

        ziel_currency = self._property_currency(ziel_id)  # type: ignore[attr-defined]
        if ziel_currency == quelle_currency and ziel_currency is not None:
            return
        titel = self._objekt_titel(ziel_id) or ziel_id
        if ziel_currency is None or quelle_currency is None:
            raise AddonError(
                f"„{titel}“ hat keine hinterlegte Währung — ein Betrag lässt "
                "sich so nicht übernehmen. Bitte zuerst einen Preisplan mit "
                "Währung anlegen.",
                status_code=422,
            )
        raise AddonError(
            f"„{titel}“ rechnet in {ziel_currency}, die Zusatzleistung in "
            f"{quelle_currency} — ein Betrag lässt sich so nicht übernehmen.",
            status_code=422,
        )

    def _addons_von_objekt(self, property_id: str) -> list[dict[str, Any]]:
        """Katalog eines Objekts (roh) — Bibliothek und Übertragung teilen ihn."""
        return (
            self._db.table("property_addons")  # type: ignore[attr-defined]
            .select(
                "id, property_id, name, description, media, price, basis, "
                "mandatory, appears_in, available_until, tax_rate, active, sort_order"
            )
            .eq("property_id", property_id)
            .order("sort_order")
            .execute()
        ).data or []

    def _objekt_titel(self, property_id: str) -> str | None:
        rows = (
            self._db.table("properties")  # type: ignore[attr-defined]
            .select("title")
            .eq("id", property_id)
            .limit(1)
            .execute()
        ).data or []
        return (rows[0].get("title") or None) if rows else None


def _katalog_zeile(r: dict[str, Any]) -> dict[str, Any]:
    """DB-Zeile → Katalog-Response. Spiegelt `service._addon_row`.

    Nicht importiert, weil `service.py` dieses Modul einbindet — der Import in
    die andere Richtung wäre ein Zyklus. Die Glättung ist dieselbe.
    """
    return {
        "id": str(r["id"]),
        "property_id": str(r["property_id"]),
        "name": r.get("name") or {},
        "description": r.get("description") or {},
        "media": list(r.get("media") or []),
        "price": float(r.get("price") or 0),
        "basis": r.get("basis") or "per_stay",
        "mandatory": bool(r.get("mandatory")),
        "appears_in": list(r.get("appears_in") or []),
        "available_until": r.get("available_until") or "anytime",
        "tax_rate": (float(r["tax_rate"]) if r.get("tax_rate") is not None else None),
        "active": bool(r.get("active")),
        "sort_order": int(r.get("sort_order") or 0),
    }
