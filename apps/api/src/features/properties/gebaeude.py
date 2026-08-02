"""Gebäude — die Klammer um Objekte, die sich EINE Portal-Kennung teilen.

Eigenes Modul, damit `service.py` nicht weiter wächst; der Mixin hängt an
`PropertiesService` und nutzt dessen `_db`/`_require_tenant`.

Ein Gebäude ist bewusst eine eigene Zeile und keine abgeleitete Gruppe: Die
Zuordnung steht zwar nach dem Verbinden auch in `channex_property_map` (mehrere
Objekte auf einer channex_property_id), aber sie hat dort keinen NAMEN — und der
Name ist das, was die Portale über den Einheiten anzeigen. Ohne ihn stünde bei
einer Agentur mit drei Häusern dreimal der Betriebsname (Migration 0264).
"""
from __future__ import annotations

from src.core.security import AuthContext

from .errors import PropertyError


class GebaeudeMixin:
    """Gebäude anlegen/auflisten und die Zuordnung eines Objekts prüfen."""

    def list_buildings(self, ctx: AuthContext) -> list[dict]:
        """Gebäude des Betriebs mit der Zahl ihrer Einheiten."""
        tenant_id = self._require_tenant(ctx)
        rows = (
            self._db.table("buildings")
            .select("id, name, address, city, postal_code, country")
            .eq("tenant_id", tenant_id)
            .order("name")
            .execute()
        ).data or []
        einheiten = (
            self._db.table("properties")
            .select("building_id")
            .eq("tenant_id", tenant_id)
            .not_.is_("building_id", "null")
            .execute()
        ).data or []
        anzahl: dict[str, int] = {}
        for e in einheiten:
            bid = str(e.get("building_id"))
            anzahl[bid] = anzahl.get(bid, 0) + 1
        return [
            {**r, "id": str(r["id"]), "unit_count": anzahl.get(str(r["id"]), 0)}
            for r in rows
        ]

    def create_building(self, ctx: AuthContext, name: str) -> dict:
        """Gebäude anlegen. Der Name trägt später die Portal-Property — deshalb
        Pflicht und nicht aus einem Objekttitel geraten (Wurzel 4)."""
        tenant_id = self._require_tenant(ctx)
        titel = (name or "").strip()
        if not titel:
            raise PropertyError("Name des Gebäudes fehlt.", status_code=422)
        res = (
            self._db.table("buildings")
            .insert({"tenant_id": tenant_id, "name": titel})
            .execute()
        ).data
        if not res:
            raise PropertyError("Gebäude konnte nicht angelegt werden.", status_code=500)
        return {**res[0], "id": str(res[0]["id"]), "unit_count": 0}

    def _pruefe_gebaeude(
        self, tenant_id: str, property_id: str, building_id: str | None
    ) -> str | None:
        """Gebäude-Zuordnung prüfen: leer = lösen, sonst muss es dem Betrieb
        gehören. Nach dem Verbinden ist die Zuordnung fest."""
        ziel = (building_id or "").strip() or None
        aktuell = (
            self._db.table("properties")
            .select("building_id")
            .eq("tenant_id", tenant_id)
            .eq("id", property_id)
            .limit(1)
            .execute()
        ).data
        vorher = (aktuell[0].get("building_id") if aktuell else None) or None
        if str(vorher or "") == str(ziel or ""):
            return ziel
        verbunden = (
            self._db.table("channex_property_map")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        ).data
        if verbunden:
            raise PropertyError(
                "Dieses Objekt ist bereits mit einem Portal verbunden — das "
                "Gebäude lässt sich danach nicht mehr wechseln. Trenne zuerst "
                "die Portal-Verbindung.",
                status_code=409,
            )
        if ziel is None:
            return None
        eigen = (
            self._db.table("buildings")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("id", ziel)
            .limit(1)
            .execute()
        ).data
        if not eigen:
            raise PropertyError("Gebäude nicht gefunden.", status_code=404)
        return ziel

    # --- Einheiten (0265/0266): Objekt in n identische Einheiten aufteilen ---
    def list_units(self, ctx: AuthContext, property_id: str) -> list[dict]:
        """Einheiten eines Objekts (mindestens eine)."""
        tenant_id = self._require_tenant(ctx)
        self.get(ctx, property_id)  # Scope: gehört das Objekt dem Tenant?
        rows = (
            self._db.table("property_units")
            .select("id, name, position")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .order("position")
            .execute()
        ).data or []
        return [{**r, "id": str(r["id"])} for r in rows]

    def set_unit_count(
        self, ctx: AuthContext, property_id: str, count: int
    ) -> list[dict]:
        """Zahl der Einheiten setzen (Hostaways „Convert to multi-unit").

        Vergrößern ist immer erlaubt. Verkleinern NUR, wenn die wegfallenden
        Einheiten weder belegt noch gesperrt sind — Hostaway lässt das Kürzen
        auch mit Buchungen zu und schreibt dazu „it can generate situations of
        overlapping reservations". Genau das ist der Zustand, den wir nicht
        wollen: eine Buchung ohne Einheit ist eine unsichtbare Doppelbelegung.
        Deshalb fail-closed mit klarer Meldung.
        """
        tenant_id = self._require_tenant(ctx)
        self.get(ctx, property_id)
        if count < 1 or count > 200:
            raise PropertyError(
                "Zahl der Einheiten muss zwischen 1 und 200 liegen.", status_code=422
            )
        vorhanden = self.list_units(ctx, property_id)
        if count > len(vorhanden):
            neu = [
                {
                    "tenant_id": tenant_id,
                    "property_id": property_id,
                    "name": f"Einheit {i + 1}",
                    "position": i,
                }
                for i in range(len(vorhanden), count)
            ]
            self._db.table("property_units").insert(neu).execute()
            return self.list_units(ctx, property_id)
        if count == len(vorhanden):
            return vorhanden

        weg = [u["id"] for u in vorhanden[count:]]
        belegt = (
            self._db.table("availability")
            .select("unit_id, date, status")
            .in_("unit_id", weg)
            .neq("status", "open")
            .limit(1)
            .execute()
        ).data or []
        if belegt:
            raise PropertyError(
                "Diese Einheiten sind belegt oder gesperrt und lassen sich nicht "
                "entfernen. Gib die betroffenen Tage frei oder ziehe die "
                "Reservierungen auf eine andere Einheit um.",
                status_code=409,
            )
        self._db.table("property_units").delete().in_("id", weg).execute()
        return self.list_units(ctx, property_id)
