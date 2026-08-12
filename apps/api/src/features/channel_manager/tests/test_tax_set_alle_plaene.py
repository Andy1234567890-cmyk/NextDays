"""Ein Tax Set muss an ALLEN Rate-Plans des Objekts hängen.

DER VORFALL (11.08.2026, live): Bei FeWo *Stjerneskud* war das Tax Set
„Standard" in Channex korrekt gefüllt — Reinigung 795 DKK „Per booking", Resort
25 DKK „Per night", beide `Exclusive`, `Type: Fee`. Der Channex-Tax-Calculator
rechnete sie auch vor: Netto 100 → Total 920.

Verknüpft war das Set aber nur mit ZWEI Rate-Plans. Eine Booking.com-Buchung
über einen dritten Plan (Rate-Code 47588687, „Wochenrate – single occupancy")
bekam deshalb kein Tax Set und kam OHNE jede Gebühr an: Channex meldete
4.625,81 DKK, Booking.com selbst wies 5.420,81 aus. Die 795 DKK Reinigung
fehlten in der Auszahlungsrechnung des Eigentümers — und niemand konnte es
sehen, weil 4.625,81 eine plausible Summe ist.

Channex' Oberfläche bietet dafür „Select All Rates" an. Diese Tests sichern das
Gegenstück im Sync: der Betrieb soll nicht pro Objekt daran denken müssen.
"""
from typing import Any


class _Tabelle:
    """Minimaler Supabase-Stub: `table(...)` → gefilterte Zeilen."""

    def __init__(self, daten: dict[str, list[dict[str, Any]]]) -> None:
        self._daten = daten
        self._tabelle = ""
        self._filter: dict[str, str] = {}
        self.data: list[dict[str, Any]] = []

    def table(self, name: str) -> "_Tabelle":
        self._tabelle = name
        self._filter = {}
        return self

    def select(self, *_a: str) -> "_Tabelle":
        return self

    def eq(self, feld: str, wert: Any) -> "_Tabelle":
        self._filter[feld] = str(wert)
        return self

    def is_(self, _feld: str, _wert: str) -> "_Tabelle":
        return self

    def order(self, *_a: str) -> "_Tabelle":
        return self

    def execute(self) -> "_Tabelle":
        self.data = [
            z
            for z in self._daten.get(self._tabelle, [])
            if all(str(z.get(k)) == v for k, v in self._filter.items())
        ]
        return self


def _db() -> _Tabelle:
    """Ein Objekt mit DREI Rate-Plans, alle bei Channex gemappt."""
    return _Tabelle(
        {
            "rate_plans": [
                {"id": "rp-grund", "property_id": "prop-1", "portal_scope": None},
                {"id": "rp-woche", "property_id": "prop-1", "portal_scope": None},
                # Der Plan, über den Ursulas Buchung lief.
                {"id": "rp-single", "property_id": "prop-1", "portal_scope": None},
                # Fremdes Objekt — darf NICHT mitkommen.
                {"id": "rp-fremd", "property_id": "prop-2", "portal_scope": None},
            ],
            "channex_rate_plan_map": [
                {"local_rate_plan_id": "rp-grund", "channex_rate_plan_id": "cx-1",
                 "tenant_id": "t1", "created_at": "2026-01-01"},
                {"local_rate_plan_id": "rp-woche", "channex_rate_plan_id": "cx-2",
                 "tenant_id": "t1", "created_at": "2026-01-02"},
                {"local_rate_plan_id": "rp-single", "channex_rate_plan_id": "cx-3",
                 "tenant_id": "t1", "created_at": "2026-01-03"},
                {"local_rate_plan_id": "rp-fremd", "channex_rate_plan_id": "cx-9",
                 "tenant_id": "t1", "created_at": "2026-01-04"},
            ],
        }
    )


def test_alle_gemappten_plaene_des_objekts() -> None:
    """Alle drei Pläne — auch der, den die Kanal-Auswahl herausfiltert."""
    from src.features.channel_manager.tax_sync import TaxSyncMixin

    plaene = TaxSyncMixin._alle_channex_plaene(_db(), "t1", "prop-1")
    assert plaene == ["cx-1", "cx-2", "cx-3"]


def test_fremdes_objekt_bleibt_draussen() -> None:
    """Ein Tax Set gilt je Objekt — Pläne anderer Objekte gehören nicht dran.

    Ohne diese Grenze bekäme ein Objekt die Gebühren eines anderen: derselbe
    Geldfehler, nur mit umgekehrtem Vorzeichen.
    """
    from src.features.channel_manager.tax_sync import TaxSyncMixin

    plaene = TaxSyncMixin._alle_channex_plaene(_db(), "t1", "prop-1")
    assert "cx-9" not in plaene


def test_reihenfolge_ist_stabil() -> None:
    """Sortiert nach `created_at` — sonst erzeugt jeder Lauf ein Schein-Update.

    `associated_rate_plan_ids` geht als Liste an Channex; eine wechselnde
    Reihenfolge sähe wie eine Änderung aus und schickte bei jedem Sync ein
    unnötiges `PUT` (Wurzel 2: Channex-Budget).
    """
    from src.features.channel_manager.tax_sync import TaxSyncMixin

    db = _db()
    assert TaxSyncMixin._alle_channex_plaene(db, "t1", "prop-1") == (
        TaxSyncMixin._alle_channex_plaene(db, "t1", "prop-1")
    )


def test_objekt_ohne_mapping_ergibt_leer() -> None:
    """Kein Mapping → leere Liste, keine erfundene ID (Wurzel 4)."""
    from src.features.channel_manager.tax_sync import TaxSyncMixin

    assert TaxSyncMixin._alle_channex_plaene(_Tabelle({}), "t1", "prop-1") == []
